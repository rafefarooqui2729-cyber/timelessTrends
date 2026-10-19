
const Database = require('better-sqlite3');
const config = require('./server/config');
const sqliteReports = require('./server/reports');
const pgReports = require('./server/pg-reports');
const { closePool } = require('./server/pg');

const DATE = '2026-10-16';
const MONTH = '2026-10';
const AS_OF = '2026-10-31';

function isNumeric(value) {
  return (
    typeof value === 'number' ||
    (typeof value === 'string' &&
      value.trim() !== '' &&
      Number.isFinite(Number(value)))
  );
}

function compareValues(a, b, path, differences) {
  if (a == null || b == null) {
    if (a !== b) {
      differences.push({ path, sqlite: a, postgres: b });
    }
    return;
  }

  if (isNumeric(a) && isNumeric(b)) {
    const left = Number(a);
    const right = Number(b);

    if (Math.abs(left - right) > 0.01) {
      differences.push({ path, sqlite: a, postgres: b });
    }
    return;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      differences.push({
        path: `${path}.length`,
        sqlite: a.length,
        postgres: b.length,
      });
    }

    const length = Math.min(a.length, b.length);

    for (let i = 0; i < length; i++) {
      compareValues(a[i], b[i], `${path}[${i}]`, differences);
    }
    return;
  }

  if (
    typeof a === 'object' &&
    typeof b === 'object' &&
    !Array.isArray(a) &&
    !Array.isArray(b)
  ) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);

    for (const key of keys) {
      if (!(key in a) || !(key in b)) {
        differences.push({
          path: `${path}.${key}`,
          sqlite: a[key],
          postgres: b[key],
        });
      } else {
        compareValues(a[key], b[key], `${path}.${key}`, differences);
      }
    }
    return;
  }

  if (a !== b) {
    differences.push({ path, sqlite: a, postgres: b });
  }
}

async function main() {
  // Open SQLite in read-only mode. This test does not seed or modify it.
  const sqliteDb = new Database(config.dbFile, {
    readonly: true,
    fileMustExist: true,
  });

  const tests = [
   {
  name: 'financials',
  sqlite: () =>
    sqliteReports.financials(sqliteDb, MONTH + '-01', MONTH + '-31'),
  postgres: () =>
    pgReports.financials(null, MONTH + '-01', MONTH + '-31'),
},
    {
      name: 'inventoryValue',
      sqlite: () => sqliteReports.inventoryValue(sqliteDb),
      postgres: () => pgReports.inventoryValue(),
    },
    {
      name: 'cashBalance',
      sqlite: () => sqliteReports.cashBalance(sqliteDb, AS_OF),
      postgres: () => pgReports.cashBalance(AS_OF),
    },
    {
      name: 'savingsBalance',
      sqlite: () => sqliteReports.savingsBalance(sqliteDb, AS_OF),
      postgres: () => pgReports.savingsBalance(AS_OF),
    },
    {
      name: 'stockSummary',
      sqlite: () => sqliteReports.stockSummary(sqliteDb, MONTH + '-01', MONTH + '-31'),
      postgres: () => pgReports.stockSummary(null, MONTH + '-01', MONTH + '-31'),
    },
    {
      name: 'stockByVariant',
      sqlite: () => sqliteReports.stockByVariant(sqliteDb),
      postgres: () => pgReports.stockByVariant(),
    },
    {
      name: 'lowStock',
      sqlite: () => sqliteReports.lowStock(sqliteDb),
      postgres: () => pgReports.lowStock(),
    },
    {
      name: 'daily',
      sqlite: () => sqliteReports.daily(sqliteDb, DATE),
      postgres: () => pgReports.daily(null, DATE),
    },
    {
      name: 'monthly',
      sqlite: () => sqliteReports.monthly(sqliteDb, MONTH),
      postgres: () => pgReports.monthly(null, MONTH),
    },
    {
      name: 'outstandingPayments',
      sqlite: () => sqliteReports.outstandingPayments(sqliteDb),
      postgres: () => pgReports.outstandingPayments(),
    },
  ];

  let failures = 0;

  try {
    for (const test of tests) {
      try {
        const sqliteResult = await test.sqlite();
        const postgresResult = await test.postgres();
        const differences = [];

        compareValues(sqliteResult, postgresResult, test.name, differences);

        if (differences.length === 0) {
          console.log(`PASS ${test.name}: results match`);
        } else {
          failures++;
          console.log(`FAIL ${test.name}: ${differences.length} difference(s)`);

          for (const difference of differences.slice(0, 15)) {
            console.log(' ', JSON.stringify(difference));
          }

          if (differences.length > 15) {
            console.log(`  ... ${differences.length - 15} more differences`);
          }
        }
      } catch (error) {
        failures++;
        console.error(`ERROR ${test.name}: ${error.message}`);
      }
    }
  } finally {
    sqliteDb.close();
    await closePool();
  }

  if (failures > 0) {
    console.error(`\nComparison finished with ${failures} failing report(s).`);
    process.exitCode = 1;
  } else {
    console.log('\nAll report comparisons passed.');
  }
}

main().catch((error) => {
  console.error('Comparison could not complete:', error.message);
  process.exitCode = 1;
});
