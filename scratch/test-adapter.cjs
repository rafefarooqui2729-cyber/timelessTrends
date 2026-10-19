const Database = require('better-sqlite3');
const { pool, closePool } = require('../server/pg');
const { types } = require('pg');

// Parse PostgreSQL numeric as float
types.setTypeParser(1700, (val) => (val === null ? null : parseFloat(val)));

function toPgSql(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

function createSqliteAdapter(sqlite) {
  return {
    isPg: false,
    prepare(sql) {
      const stmt = sqlite.prepare(sql);
      return {
        all: async (...params) => stmt.all(...params),
        get: async (...params) => stmt.get(...params),
        run: async (...params) => {
          const res = stmt.run(...params);
          return { lastInsertRowid: res.lastInsertRowid, changes: res.changes };
        },
      };
    },
    transaction(fn) {
      const tx = sqlite.transaction(fn);
      return async (...args) => tx(...args);
    },
  };
}

function createPgAdapter(pgPool) {
  return {
    isPg: true,
    prepare(sql) {
      const isInsert = /^\s*INSERT\s+INTO/i.test(sql);
      const hasReturning = /RETURNING/i.test(sql);
      const runSql = isInsert && !hasReturning ? `${sql} RETURNING id` : sql;

      const pgSql = toPgSql(sql);
      const pgRunSql = toPgSql(runSql);

      return {
        all: async (...params) => {
          const res = await pgPool.query(pgSql, params.flat());
          return res.rows;
        },
        get: async (...params) => {
          const res = await pgPool.query(pgSql, params.flat());
          return res.rows[0] || null;
        },
        run: async (...params) => {
          const res = await pgPool.query(pgRunSql, params.flat());
          const id = res.rows[0]?.id;
          return { lastInsertRowid: id, changes: res.rowCount };
        },
      };
    },
    transaction(fn) {
      return async (...args) => {
        const client = await pgPool.connect();
        try {
          await client.query('BEGIN');
          const txAdapter = {
            isPg: true,
            prepare(sql) {
              const isInsert = /^\s*INSERT\s+INTO/i.test(sql);
              const hasReturning = /RETURNING/i.test(sql);
              const runSql = isInsert && !hasReturning ? `${sql} RETURNING id` : sql;
              const pgSql = toPgSql(sql);
              const pgRunSql = toPgSql(runSql);

              return {
                all: async (...params) => {
                  const res = await client.query(pgSql, params.flat());
                  return res.rows;
                },
                get: async (...params) => {
                  const res = await client.query(pgSql, params.flat());
                  return res.rows[0] || null;
                },
                run: async (...params) => {
                  const res = await client.query(pgRunSql, params.flat());
                  return { lastInsertRowid: res.rows[0]?.id, changes: res.rowCount };
                },
              };
            },
          };
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
  };
}

async function test() {
  console.log('--- Testing SQLite Adapter ---');
  const sqlite = new Database(':memory:');
  sqlite.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT);');
  const sqliteAdapter = createSqliteAdapter(sqlite);
  const sRes = await sqliteAdapter.prepare('INSERT INTO test (name) VALUES (?)').run('Watch A');
  console.log('SQLite inserted id:', sRes.lastInsertRowid);
  const sRows = await sqliteAdapter.prepare('SELECT * FROM test WHERE id = ?').all(sRes.lastInsertRowid);
  console.log('SQLite read row:', sRows[0]);

  console.log('\n--- Testing PostgreSQL (Supabase) Adapter ---');
  const pgAdapter = createPgAdapter(pool);
  const pProducts = await pgAdapter.prepare('SELECT id, name, selling_price, status, is_active FROM products WHERE status = ? AND is_active = ? LIMIT 3').all('published', 1);
  console.log('PostgreSQL products read:', pProducts);

  const pOne = await pgAdapter.prepare('SELECT id, name, slug FROM products WHERE slug = ?').get('aethelgard-master-chronograph');
  console.log('PostgreSQL single product read:', pOne);

  await closePool();
}

test().catch(console.error);
