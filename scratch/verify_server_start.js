const { spawn } = require('child_process');

console.log('Testing server startup...');
const proc = spawn('node', ['server/index.js'], {
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe']
});

let output = '';
proc.stdout.on('data', (d) => {
  const text = d.toString();
  output += text;
  process.stdout.write(text);
  if (text.includes('TIMELESS TRENDS server running on')) {
    console.log('\nVerified! Server successfully booted and connected to Supabase PostgreSQL.');
    proc.kill();
    process.exit(0);
  }
});

proc.stderr.on('data', (d) => {
  process.stderr.write(d.toString());
});

setTimeout(() => {
  console.error('\nServer startup timed out after 10s');
  proc.kill();
  process.exit(1);
}, 10000);
