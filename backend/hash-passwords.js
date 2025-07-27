import client from './connection.js';
import bcrypt from 'bcrypt';

async function hashPasswords() {
  const users = await client.query('SELECT user_id, password FROM users');

  for (const user of users.rows) {
    const plainPassword = user.password;
    if (plainPassword.startsWith('$2b$')) continue;

    const hashed = await bcrypt.hash(plainPassword, 10);
    await client.query('UPDATE users SET password = $1 WHERE user_id = $2', [hashed, user.user_id]);
  }

  console.log('All passwords hashed.');
}

export default hashPasswords;

// hashPasswords().catch(console.error);
