
const path = require('path');
const Database = require('better-sqlite3');
const { Client } = require('pg');

require('dotenv').config({
  path: path.join(__dirname, '.env'),
});

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

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is missing from the root .env file.'
    );
  }

  const sqlite = new Database(
    path.join(__dirname, 'data', 'timeless.db'),
    { readonly: true, fileMustExist: true }
  );

  const pg = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  let transactionOpen = false;

  try {
    await pg.connect();
    console.log('Connected to both databases.');

    // Do not import into any destination table that already has data.
    for (const table of TABLES) {
      const result = await pg.query(
        `SELECT COUNT(*)::int AS count
         FROM public.${quoteIdentifier(table)}`
      );

      if (result.rows[0].count !== 0) {
        throw new Error(
          `Safety stop: Supabase table "${table}" is not empty. ` +
          'No import was started.'
        );
      }
    }

    console.log('Safety check passed: all destination tables are empty.');

    // Confirm the SQLite and PostgreSQL columns match exactly.
    for (const table of TABLES) {
      const sourceColumns = sqlite
        .prepare(`PRAGMA table_info(${quoteIdentifier(table)})`)
        .all()
        .map(column => column.name)
        .sort();

      const destinationResult = await pg.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = $1`,
        [table]
      );

      const destinationColumns = destinationResult.rows
        .map(column => column.column_name)
        .sort();

      if (
        sourceColumns.length !== destinationColumns.length ||
        sourceColumns.some(
          (name, index) => name !== destinationColumns[index]
        )
      ) {
        throw new Error(
          `Column mismatch in "${table}". ` +
          `SQLite: ${sourceColumns.join(', ')}. ` +
          `Supabase: ${destinationColumns.join(', ')}. ` +
          'No import was started.'
        );
      }
    }

    console.log('Safety check passed: all table columns match.');

    await pg.query('BEGIN');
    transactionOpen = true;

    const counts = {};

    for (const table of TABLES) {
      const rows = sqlite
        .prepare(`SELECT * FROM ${quoteIdentifier(table)}`)
        .all();

      const columns = sqlite
        .prepare(`PRAGMA table_info(${quoteIdentifier(table)})`)
        .all()
        .map(column => column.name);

      if (rows.length > 0) {
        const columnSQL = columns
          .map(quoteIdentifier)
          .join(', ');

        const placeholders = columns
          .map((_, index) => `$${index + 1}`)
          .join(', ');

        const insertSQL =
          `INSERT INTO public.${quoteIdentifier(table)} ` +
          `(${columnSQL}) VALUES (${placeholders})`;

        for (const row of rows) {
          await pg.query(
            insertSQL,
            columns.map(column => row[column])
          );
        }
      }

      counts[table] = rows.length;
      console.log(`${table}: ${rows.length} source records`);
    }

    // Reset identity sequences to match the imported IDs.
    const identityTables = [
      'categories', 'products', 'users', 'suppliers',
      'variants', 'images', 'offers', 'purchases',
      'enquiries', 'orders', 'order_items', 'payments',
      'returns', 'stock_movements', 'expenses',
      'savings_entries', 'otps', 'audit_logs',
    ];

    for (const table of identityTables) {
      await pg.query(
        `SELECT setval(
          pg_get_serial_sequence($1, 'id'),
          COALESCE(MAX(id), 1),
          MAX(id) IS NOT NULL
        )
        FROM public.${quoteIdentifier(table)}`,
        [`public.${table}`]
      );
    }

    // Check every destination table before committing.
    for (const table of TABLES) {
      const result = await pg.query(
        `SELECT COUNT(*)::int AS count
         FROM public.${quoteIdentifier(table)}`
      );

      if (result.rows[0].count !== counts[table]) {
        throw new Error(
          `Verification failed for "${table}". ` +
          `Expected ${counts[table]}, found ${result.rows[0].count}.`
        );
      }
    }

    await pg.query('COMMIT');
    transactionOpen = false;

    const total = Object.values(counts)
      .reduce((sum, count) => sum + count, 0);

    console.log('\nMigration completed successfully.');
    console.log(`Tables verified: ${TABLES.length}`);
    console.log(`Records copied: ${total}`);
    console.log('SQLite database was opened read-only.');
  } catch (error) {
    if (transactionOpen) {
      try {
        await pg.query('ROLLBACK');
        console.error('Import rolled back.');
      } catch (rollbackError) {
        console.error('Rollback error:', rollbackError.message);
      }
    }

    throw error;
  } finally {
    sqlite.close();
    await pg.end().catch(() => {});
  }
}

main().catch(error => {
  console.error('\nMigration failed:', error.message);
  process.exitCode = 1;
});
