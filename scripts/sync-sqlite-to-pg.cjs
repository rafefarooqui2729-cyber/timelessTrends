const path = require('path');
const Database = require('better-sqlite3');
const { pool, closePool } = require('../server/pg');

const TABLES = [
  'categories',
  'products',
  'users',
  'suppliers',
  'variants',
  'images',
  'offers',
  'purchases',
  'enquiries',
  'orders',
  'order_items',
  'payments',
  'returns',
  'stock_movements',
  'expenses',
  'savings_entries',
  'sessions',
  'otps',
  'audit_logs',
  'settings',
];

function quoteIdentifier(name) {
  return '"' + name.replace(/"/g, '""') + '"';
}

async function sync() {
  const sqlite = new Database(path.join(__dirname, '..', 'data', 'timeless.db'), {
    readonly: true,
    fileMustExist: true,
  });

  const client = await pool.connect();
  let inTx = false;

  try {
    console.log('--- SYNCING SQLITE DATA TO SUPABASE POSTGRESQL ---');
    await client.query('BEGIN');
    inTx = true;

    for (const table of TABLES) {
      const sourceRows = sqlite.prepare(`SELECT * FROM ${quoteIdentifier(table)}`).all();
      if (!sourceRows.length) continue;

      const columns = sqlite
        .prepare(`PRAGMA table_info(${quoteIdentifier(table)})`)
        .all()
        .map((c) => c.name);

      const hasId = columns.includes('id');
      const hasKey = columns.includes('key');
      const hasTokenHash = columns.includes('token_hash');

      for (const row of sourceRows) {
        let exists = false;
        if (hasId) {
          const res = await client.query(
            `SELECT 1 FROM public.${quoteIdentifier(table)} WHERE id = $1`,
            [row.id]
          );
          exists = res.rowCount > 0;
        } else if (hasKey) {
          const res = await client.query(
            `SELECT 1 FROM public.${quoteIdentifier(table)} WHERE key = $1`,
            [row.key]
          );
          exists = res.rowCount > 0;
        } else if (hasTokenHash) {
          const res = await client.query(
            `SELECT 1 FROM public.${quoteIdentifier(table)} WHERE token_hash = $1`,
            [row.token_hash]
          );
          exists = res.rowCount > 0;
        }

        if (!exists) {
          const colNames = columns.map(quoteIdentifier).join(', ');
          const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
          const insertSql = `INSERT INTO public.${quoteIdentifier(table)} (${colNames}) VALUES (${placeholders})`;
          const values = columns.map((col) => row[col]);
          await client.query(insertSql, values);
          console.log(`Inserted missing row into ${table}:`, hasId ? `id=${row.id}` : (row.key || row.token_hash));
        }
      }
    }

    // Reset sequences
    const identityTables = [
      'categories', 'products', 'users', 'suppliers',
      'variants', 'images', 'offers', 'purchases',
      'enquiries', 'orders', 'order_items', 'payments',
      'returns', 'stock_movements', 'expenses',
      'savings_entries', 'otps', 'audit_logs',
    ];

    for (const table of identityTables) {
      await client.query(
        `SELECT setval(
          pg_get_serial_sequence($1, 'id'),
          COALESCE(MAX(id), 1),
          MAX(id) IS NOT NULL
        )
        FROM public.${quoteIdentifier(table)}`,
        [`public.${table}`]
      );
    }

    await client.query('COMMIT');
    inTx = false;

    // Purge expired sessions
    const nowIso = new Date().toISOString();
    await client.query('DELETE FROM sessions WHERE expires_at < $1', [nowIso]);

    console.log('\n--- VERIFYING RECORD COUNTS ---');
    let allMatched = true;
    for (const table of TABLES) {
      if (table === 'sessions') continue; // Sessions are ephemeral
      const srcCount = sqlite.prepare(`SELECT count(*) AS c FROM ${quoteIdentifier(table)}`).get().c;
      const dstRes = await pool.query(`SELECT count(*)::int AS c FROM public.${quoteIdentifier(table)}`);
      const dstCount = dstRes.rows[0].c;
      const match = srcCount === dstCount;
      if (!match) allMatched = false;
      console.log(`${table}: SQLite=${srcCount}, PostgreSQL=${dstCount} [${match ? 'OK' : 'MISMATCH'}]`);
    }

    if (!allMatched) {
      throw new Error('Verification failed: some table counts do not match.');
    }

    console.log('\nSync completed and verified successfully!');
  } catch (err) {
    if (inTx) {
      await client.query('ROLLBACK').catch(() => {});
    }
    console.error('Sync failed:', err);
    process.exitCode = 1;
  } finally {
    sqlite.close();
    client.release();
    await closePool();
  }
}

sync();
