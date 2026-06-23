// Script to generate bcrypt hash for passwords
const bcrypt = require('bcryptjs');

const password = 'admin123';
const saltRounds = 10;

bcrypt.hash(password, saltRounds, (err, hash) => {
  if (err) {
    console.error('Error generating hash:', err);
    return;
  }
  
  console.log('\n=================================');
  console.log('Password Hash Generated');
  console.log('=================================');
  console.log('Original Password:', password);
  console.log('Hash:', hash);
  console.log('=================================\n');
  console.log('Copy the hash above and use it in your auth configuration');
  console.log('\n');
});
