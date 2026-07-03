// Script to generate bcrypt hash for passwords
//
// Usage:
//   node scripts/hash-password.js <password>
//   node scripts/hash-password.js "MySecurePassword123!"
//
// The password is read from the command-line argument — never hardcoded
// in source or stored in version control.

const bcrypt = require('bcryptjs');

const password = process.argv[2];

if (!password) {
  console.error('\n❌  No password provided.\n');
  console.log('Usage: node scripts/hash-password.js <password>');
  console.log('Example: node scripts/hash-password.js "MySecurePassword123!"\n');
  process.exit(1);
}

if (password.length < 6) {
  console.error('❌  Password must be at least 6 characters.');
  process.exit(1);
}

const saltRounds = 10;

bcrypt.hash(password, saltRounds, (err, hash) => {
  if (err) {
    console.error('Error generating hash:', err);
    process.exit(1);
  }

  console.log('\n=================================');
  console.log('Password Hash Generated');
  console.log('=================================');
  console.log('Password length:', password.length, 'characters');
  console.log('Hash:', hash);
  console.log('=================================\n');
  console.log('Copy the hash above and use it in your auth configuration.');
  console.log('Store the hash (NOT the plain-text password) in ADMIN_PASSWORD env var.\n');
});
