const { types } = require('pg');

// Parse PostgreSQL numeric (type OID 1700) as floating point number
types.setTypeParser(1700, (val) => (val === null ? null : parseFloat(val)));
// Parse PostgreSQL bigint (type OID 20) as integer where safe
types.setTypeParser(20, (val) => (val === null ? null : parseInt(val, 10)));

/**
 * Replace SQLite ? placeholders with PostgreSQL $1, $2... parameter placeholders.
 */
function toPgSql(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

/**
 * Normalize params passed to prepare methods.
 * Accepts either (...params) or ([paramArray]).
 */
function normalizeParams(params) {
  if (params.length === 1 && Array.isArray(params[0])) {
    return params[0];
  }
  return params;
}

/**
 * SQLite Adapter wrapping better-sqlite3 database.
 */
function createSqliteAdapter(sqlite) {
  const adapter = {
    isPg: false,
    raw: sqlite,

    prepare(sql) {
      const stmt = sqlite.prepare(sql);

      return {
        all(...params) {
          const p = normalizeParams(params);
          return stmt.all(...p);
        },

        get(...params) {
          const p = normalizeParams(params);
          return stmt.get(...p);
        },

        run(...params) {
          const p = normalizeParams(params);
          const result = stmt.run(...p);
          return {
            lastInsertRowid: result.lastInsertRowid,
            changes: result.changes,
          };
        },
      };
    },

    transaction(fn) {
      return (...args) => {
        if (sqlite.inTransaction) {
          return fn(adapter, ...args);
        }
        sqlite.exec('BEGIN');
        try {
          const res = fn(adapter, ...args);
          if (res && typeof res.then === 'function') {
            return res.then(
              (val) => {
                sqlite.exec('COMMIT');
                return val;
              },
              (err) => {
                try { sqlite.exec('ROLLBACK'); } catch (_) {}
                throw err;
              }
            );
          }
          sqlite.exec('COMMIT');
          return res;
        } catch (err) {
          try { sqlite.exec('ROLLBACK'); } catch (_) {}
          throw err;
        }
      };
    },

    async close() {
      sqlite.close();
    },
  };

  return adapter;
}

/**
 * PostgreSQL Adapter wrapping pg Pool or Client.
 */
function createPgAdapter(poolOrClient) {
  const isClient = typeof poolOrClient.release === 'function';

  const adapter = {
    isPg: true,
    raw: poolOrClient,

    prepare(sql) {
      const isInsert = /^\s*INSERT\s+INTO/i.test(sql);
      const hasReturning = /RETURNING/i.test(sql);
      const isNoIdTable = /INSERT\s+INTO\s+(?:public\.)?(?:sessions|settings)/i.test(sql);
      const runSql = isInsert && !hasReturning && !isNoIdTable ? `${sql} RETURNING id` : sql;

      const pgSql = toPgSql(sql);
      const pgRunSql = toPgSql(runSql);

      return {
        async all(...params) {
          const p = normalizeParams(params);
          const res = await poolOrClient.query(pgSql, p);
          return res.rows;
        },

        async get(...params) {
          const p = normalizeParams(params);
          const res = await poolOrClient.query(pgSql, p);
          return res.rows[0] || null;
        },

        async run(...params) {
          const p = normalizeParams(params);
          const res = await poolOrClient.query(pgRunSql, p);
          const id = res.rows[0]?.id;
          return {
            lastInsertRowid: id,
            changes: res.rowCount,
          };
        },
      };
    },

    transaction(fn) {
      if (isClient) {
        // Already inside a transaction client
        return async (...args) => fn(adapter, ...args);
      }

      return async (...args) => {
        const client = await poolOrClient.connect();
        try {
          await client.query('BEGIN');
          const txAdapter = createPgAdapter(client);
          const result = await fn(txAdapter, ...args);
          await client.query('COMMIT');
          return result;
        } catch (err) {
          await client.query('ROLLBACK').catch(() => {});
          throw err;
        } finally {
          client.release();
        }
      };
    },

    async close() {
      if (!isClient && typeof poolOrClient.end === 'function') {
        await poolOrClient.end();
      }
    },
  };

  return adapter;
}

/**
 * Detects database type and returns appropriate unified adapter.
 */
function createAdapter(db) {
  if (!db) {
    throw new Error('Database instance or connection pool is required');
  }

  // Already adapted
  if (db.isPg !== undefined && typeof db.prepare === 'function') {
    return db;
  }

  // PostgreSQL Pool or Client
  if (typeof db.query === 'function') {
    return createPgAdapter(db);
  }

  // better-sqlite3 Database
  if (typeof db.prepare === 'function') {
    return createSqliteAdapter(db);
  }

  throw new Error('Unsupported database driver: expected PostgreSQL pool or SQLite database');
}

module.exports = {
  createAdapter,
  createSqliteAdapter,
  createPgAdapter,
  toPgSql,
};
