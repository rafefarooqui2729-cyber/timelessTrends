
require('./config'); // Load the root .env before opening PostgreSQL.
const bcrypt = require('bcryptjs');
const { pool, closePool } = require('./pg');

const partners = [
  { email: 'kaibralawxt97@gmail.com', name: 'Partner 1' },
  { email: 'siddiquemaaz081@gmail.com', name: 'Partner 2' },
  { email: 'mohammedezan724@gmail.com', name: 'Partner 3' },
];

function readHiddenPassword(promptText) {
  return new Promise((resolve, reject) => {
    const input = process.stdin;

    if (!input.isTTY || typeof input.setRawMode !== 'function') {
      reject(new Error(
        'Run this script directly in an interactive PowerShell terminal.'
      ));
      return;
    }

    const previousRawMode = input.isRaw;
    let password = '';
    let finished = false;

    input.setEncoding('utf8');
    input.setRawMode(true);
    input.resume();
    process.stdout.write(promptText);

    function cleanup() {
      input.removeListener('data', onData);
      input.setRawMode(previousRawMode);
      input.pause();
    }

    function onData(chunk) {
      for (const char of chunk) {
        if (char === '\u0003') {
          if (!finished) {
            finished = true;
            cleanup();
            process.stdout.write('\nCancelled.\n');
            reject(new Error('Cancelled by user.'));
          }
          return;
        }

        if (char === '\r' || char === '\n') {
          if (!finished) {
            finished = true;
            cleanup();
            process.stdout.write('\n');
            resolve(password);
          }
          return;
        }

        if (char === '\u007f' || char === '\b') {
          password = password.slice(0, -1);
        } else if (char >= ' ') {
          password += char;
        }
      }
    }

    input.on('data', onData);
  });
}

async function main() {
  const emails = partners.map((partner) => partner.email.toLowerCase());

  if (new Set(emails).size !== emails.length) {
    throw new Error('Duplicate email addresses in the partner list.');
  }

  // Check Supabase before asking anyone to enter a password.
  const existing = await pool.query(
    'SELECT email FROM users WHERE email = ANY($1::text[])',
    [emails]
  );

  if (existing.rows.length > 0) {
    throw new Error(
      'No accounts were created. These addresses already exist in Supabase: ' +
      existing.rows.map((user) => user.email).join(', ') +
      '. Verify the existing accounts before proceeding.'
    );
  }

  const accounts = [];

  for (const partner of partners) {
    const password = await readHiddenPassword(
      `Enter a NEW password for ${partner.email}: `
    );

    if (password.length < 10) {
      throw new Error(
        `Password for ${partner.email} must be at least 10 characters.`
      );
    }

    const confirmation = await readHiddenPassword(
      `Confirm password for ${partner.email}: `
    );

    if (password !== confirmation) {
      throw new Error(
        `Passwords do not match for ${partner.email}. No accounts were created.`
      );
    }

    accounts.push({
      ...partner,
      passwordHash: await bcrypt.hash(password, 12),
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Recheck inside the transaction before inserting.
    const recheck = await client.query(
      'SELECT email FROM users WHERE email = ANY($1::text[])',
      [emails]
    );

    if (recheck.rows.length > 0) {
      throw new Error(
        'An account now exists for: ' +
        recheck.rows.map((user) => user.email).join(', ') +
        '. No accounts were created.'
      );
    }

    const now = new Date().toISOString();

    for (const account of accounts) {
      await client.query(
        `INSERT INTO users
           (email, name, password_hash, role, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          account.email,
          account.name,
          account.passwordHash,
          'super_admin',
          1,
          now,
        ]
      );
    }

    await client.query('COMMIT');

    console.log('\nAll three partner accounts were created successfully.');
    console.log('Database: Supabase PostgreSQL');
    console.log('Role: super_admin');
    console.log('Status: active');
    console.log('Passwords were not printed or stored in this script.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

main()
  .catch((error) => {
    console.error('\nAccount creation stopped:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
