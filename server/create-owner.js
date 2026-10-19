
const readline = require('readline');
const bcrypt = require('bcryptjs');
const config = require('./config');
const { pool, closePool } = require('./pg');

const [emailArg, name, cliPassword, cliRole] = process.argv.slice(2);

const email = emailArg?.trim().toLowerCase();

const allowedRoles = [
  'super_admin',
  'inventory_manager',
  'marketing_manager',
  'owner',
];

const role = allowedRoles.includes(cliRole) ? cliRole : 'super_admin';

function askPassword() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Choose a password (min 10 characters): ', (password) => {
      rl.close();
      resolve(password);
    });
  });
}

async function saveUser(password) {
  if (!password || password.length < 10) {
    throw new Error('Password must be at least 10 characters.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date().toISOString();

  const result = await pool.query(
    `INSERT INTO users
       (email, name, password_hash, role, is_active, created_at)
     VALUES ($1, $2, $3, $4, 1, $5)
     ON CONFLICT (email) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       role = EXCLUDED.role,
       is_active = 1
     RETURNING id, email, role`,
    [email, name || null, passwordHash, role, now]
  );

  const user = result.rows[0];

  console.log(
    `Administrator account (${user.email}) successfully provisioned with role '${user.role}'.`
  );
}

async function main() {
  if (!email) {
    throw new Error(
      'Usage: npm run create-admin -- email "Name" [password] [role]'
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Please provide a valid email address.');
  }

  const password = cliPassword || process.env.ADMIN_PASSWORD || await askPassword();

  await saveUser(password);
}

main()
  .catch((error) => {
    console.error('Administrator provisioning failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
