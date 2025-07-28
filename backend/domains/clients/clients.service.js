import fs from 'fs'
import client from '../../connection.js';
import bcrypt from 'bcrypt';

// Get list of clients (for reference)
export async function signup(req, res) {
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
    if (attorneyLicense && fs.existsSync(attorneyLicense.path)) {
      fs.unlinkSync(attorneyLicense.path); // Clean up in case of error
    }
    console.error('Error during signup:', err.message);
    res.status(500).json({ message: "Failed to register lawyer." });
  }
};

export async function signupClients(req, res) {
  const {
    first_name,
    username,
    last_name,
    birth_date,
    age,
    gender,
    address,
    email,
    contact_number,
    marital_status,
    password
  } = req.body;

  const nationalId = req.file;

  if (!nationalId) {
    return res.status(400).json({ message: 'National ID image is required.' });
  }

  const fileBuffer = fs.readFileSync(nationalId.path);

  try {
    // Check if username exists in users table
    const userCheck = await client.query('SELECT 1 FROM users WHERE username = $1', [username]);
    if (userCheck.rowCount > 0) {
      fs.unlinkSync(nationalId.path); // Clean up file
      console.error('Username already exists.');
      return res.status(400).json({ message: 'Username already exists.' });
    }

    // Hash the password before storing
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert into clients table
    const insertClientQuery = `
      INSERT INTO clients (
        username, first_name, last_name, birth_date, age,
        gender, address, email, contact_number, marital_status,
        password, national_id
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12
      )
      RETURNING client_id;
    `;

    const clientValues = [
      username,
      first_name,
      last_name,
      birth_date,
      age,
      gender,
      address,
      email,
      contact_number,
      marital_status,
      hashedPassword,
      fileBuffer
    ];

    const clientResult = await client.query(insertClientQuery, clientValues);
    const clientId = clientResult.rows[0].client_id;

    // Insert into users table
    const insertUserQuery = `
      INSERT INTO users (
        role_id, role, username, password, status, failed_attempts, locked_until
      ) VALUES ($1, 'Client', $2, $3, 'Activated', 0, NULL);
    `;

    const userValues = [clientId, username, hashedPassword];
    await client.query(insertUserQuery, userValues);

    fs.unlinkSync(nationalId.path); // Clean up file

    res.status(201).json({
      message: "Registration successful. You can now log in.",
      clientId
    });

  } catch (err) {
    fs.unlinkSync(nationalId.path); // Clean up file in case of error
    console.error('Error during signup:', err.message);
    res.status(500).json({ message: "Failed to register client." });
  }
};

export async function changePasswordClient(req, res) {
  const { roleId } = req.params;  // Extract roleId from the URL parameter
  const { oldPassword, newPassword, confirmPassword } = req.body;

  if (!oldPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: 'New passwords do not match.' });
  }

  try {
    // Find user with role = 'Lawyer' and matching role_id
    const result = await client.query(
      'SELECT * FROM users WHERE role = $1 AND role_id = $2',
      ['Client', roleId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const user = result.rows[0];

    // Verify current password
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Old password is incorrect.' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password in both users and lawyers tables
    await client.query('BEGIN');

    await client.query(
      'UPDATE users SET password = $1 WHERE role = $2 AND role_id = $3',
      [hashedPassword, 'Client', roleId]
    );

    await client.query(
      'UPDATE clients SET password = $1 WHERE client_id = $2',
      [hashedPassword, roleId]
    );

    await client.query('COMMIT');

    res.json({ message: 'Password changed successfully.' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Change password error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

// GET client by role_id
export async function getClientByRole(req, res) {
  const { roleId } = req.params;

  const result = await client.query(`
    SELECT c.*
    FROM users u
    JOIN clients c ON u.role_id = c.client_id
    WHERE u.role_id = $1
  `, [roleId]);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Client not found' });
  }

  res.json(result.rows[0]);
};

// PUT update client
export async function updateClient(req, res) {
  const { client_id } = req.params;
  const { username, marital_status, last_name, age, address, email, contact_number } = req.body;

  try {
    await client.query('BEGIN');

    // Update username in users table
    await client.query(`
      UPDATE users
      SET username = $1
      WHERE role = 'Client' AND role_id = $2
    `, [username, client_id]);

    // Update marital status, last name, age, address, email, contact_number in clients table
    await client.query(`
      UPDATE clients
      SET marital_status = $1, last_name = $2, age = $3, address = $4, email = $5, contact_number = $6
      WHERE client_id = $7
    `, [marital_status, last_name, age, address, email, contact_number, client_id]);

    await client.query('COMMIT');

    res.json({ message: 'Client profile updated successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating client profile:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export async function getClientById(req, res) {
  try {
    const { roleId } = req.params;
    const result = await client.query(
      `SELECT * FROM clients WHERE client_id = $1`,
      [roleId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch client info' });
  }
};