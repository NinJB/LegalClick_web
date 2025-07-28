import client from '../../connection.js'
import { logTrail } from '../helpers/logger/logger.js';
import { DateTime } from 'luxon';
import bcrypt from 'bcrypt';
import { JWT_SECRET, jwt } from '../configs/JWT.config.js';
import fs from 'fs';

export async function loginUser(req, res) {
  const { username, password } = req.body;

  try {
    // Fetch user by username
    const userQuery = await client.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );

    // If user doesn't exist, return error
    if (userQuery.rowCount === 0) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const user = userQuery.rows[0];
    const now = DateTime.now();
    const lockedUntil = user.locked_until ? DateTime.fromJSDate(user.locked_until) : null;

    // Check if account is locked
    if (lockedUntil && lockedUntil > now) {
      return res.status(403).json({
        message: 'Account is locked.',
        locked_until: lockedUntil.toISO(),
        failed_attempts: user.failed_attempts
      });
    }

    // Check if account is activated
    if (user.status !== 'Activated') {
      return res.status(403).json({ message: 'Account is not activated.' });
    }

    // Check if password matches
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      let attempts = user.failed_attempts + 1;
      let lockTime = null;

      // Lock account after 5 failed attempts
      if (attempts >= 5) {
        lockTime = now.plus({ hours: 5 }).toJSDate();
        attempts = 5;
      }

      // Update failed attempts and lockout time if applicable
      await client.query(
        'UPDATE users SET failed_attempts = $1, locked_until = $2 WHERE user_id = $3',
        [attempts, lockTime, user.user_id]
      );

      await logTrail(user.role, user.role_id, 'Log In', 'Failed');

      return res.status(401).json({
        message: 'Invalid credentials.',
        failed_attempts: attempts,
        locked_until: lockTime ? DateTime.fromJSDate(lockTime).toISO() : null
      });
    }

    // Reset failed attempts and lockout if login is successful
    await client.query(
      'UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE user_id = $1',
      [user.user_id]
    );

    await logTrail(user.role, user.role_id, 'Log In', 'Successful');

    // Issue JWT
    const token = jwt.sign({
      user_id: user.user_id,
      role: user.role,
      role_id: user.role_id,
      username: user.username
    }, JWT_SECRET, { expiresIn: '8h' });

    // Respond with JWT and user info
    res.json({
      token,
      role: user.role,
      status: user.status,
      role_id: user.role_id
    });

  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

// Check if a username is already used by another user
export async function checkUsername(req, res) {
  const { username, role_id } = req.body;

  try {
    const result = await client.query(
      'SELECT * FROM users WHERE username = $1 AND role_id != $2',
      [username, role_id]
    );

    res.json({ available: result.rows.length === 0 });
  } catch (err) {
    console.error('Error checking username', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};



// Lawyer signup function
export async function signupLawyer(req, res) {
  const {
    roll_number,
    username,
    first_name,
    last_name,
    bar_admission_year,
    gender,
    office_address,
    email,
    contact_number,
    gcash_number,
    attorney_category,
    law_school,
    password
  } = req.body;

  const attorneyLicense = req.file;

  if (!attorneyLicense) {
    return res.status(400).json({ message: 'Attorney license image is required.' });
  }

  try {
    // Check if username exists in users table
    const userCheck = await client.query(
      'SELECT 1 FROM users WHERE username = $1 AND LOWER(status) = $2',
      [username, 'Activated']
    );
    if (userCheck.rowCount > 0) {
      fs.unlinkSync(attorneyLicense.path);
      console.error('Username already exists.');
      return res.status(400).json({ message: 'Username already exists.' });
    }    

    // Check if roll number exists in lawyers table with 'Activated' status
    const rollCheck = await client.query(
      'SELECT 1 FROM lawyers WHERE roll_number = $1 AND account_status = $2',
      [roll_number, 'Activated']
    );
    
    if (rollCheck.rowCount > 0) {
      fs.unlinkSync(attorneyLicense.path);
      return res.status(400).json({ message: 'Roll number already exists.' });
    }

    // Hash the password before storing
    const hashedPassword = await bcrypt.hash(password, 10);

    const insertLawyerQuery = `
      INSERT INTO lawyers (
        roll_number, username, first_name, last_name,
        bar_admission_year, gender, office_address, email,
        contact_number, gcash_number, attorney_category,
        attorney_license, law_school, password, account_status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
      )
      RETURNING lawyer_id;
    `;

    const fileBuffer = fs.readFileSync(attorneyLicense.path);

    const lawyerValues = [
      roll_number,
      username,
      first_name,
      last_name,
      bar_admission_year,
      gender,
      office_address,
      email,
      contact_number,
      gcash_number,
      attorney_category,
      fileBuffer,
      law_school,
      hashedPassword,
      'Request' // <-- now passed as $15
    ];

    const lawyerResult = await client.query(insertLawyerQuery, lawyerValues);
    const lawyerId = lawyerResult.rows[0].lawyer_id;

    // Insert into users table
    const insertUserQuery = `
      INSERT INTO users (
        role_id, role, username, password, status, failed_attempts, locked_until
      ) VALUES ($1, 'Lawyer', $2, $3, 'Request', 0, NULL);
    `;

    await client.query(insertUserQuery, [lawyerId, username, hashedPassword]);

    fs.unlinkSync(attorneyLicense.path); // Clean up

    res.status(201).json({
      message: "Registration successful. Awaiting approval.",
      lawyerId
    });

  } catch (err) {
    console.error('Error during lawyer signup:', err);
    if (attorneyLicense) {
      fs.unlinkSync(attorneyLicense.path);
    }
    res.status(500).json({ message: 'Server error during registration.' });
  }
};