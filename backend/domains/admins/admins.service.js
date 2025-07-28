import fs from 'fs'
import client from '../../connection.js'
import bcrypt from 'bcrypt'

export async function changeAdminPassword(req, res) {
  const { roleId } = req.params;
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
      'SELECT * FROM users WHERE role IN ($1, $2) AND role_id = $3',
      ['paoadmin', 'olbaadmin', roleId]
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
      'UPDATE users SET password = $1 WHERE role IN ($2, $3) AND role_id = $4',
      [hashedPassword, 'paoadmin', 'olbaadmin', roleId]
    );

    await client.query(
      'UPDATE admin SET password = $1 WHERE admin_id = $2',
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


// GET admin by role_id
export async function getAdminbyRole(req, res) {
  const { roleId } = req.params;
  try {
    const result = await client.query(`
      SELECT a.admin_id, a.first_name, a.last_name, a.email, a.contact_number,
             u.username, u.user_id
      FROM users u
      JOIN admin a ON u.role_id = a.admin_id
      WHERE u.role_id = $1
        AND u.role IN ('paoadmin','olbaadmin')
    `, [roleId]);
    if (!result.rows.length) return res.status(404).json({ error: 'Admin not found' });
    res.json(result.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
};

// PUT update admin
export async function updateAdmin(req, res) {
  const { adminId } = req.params;
  const { username, first_name, last_name, email, contact_number } = req.body;

  try {
    await client.query('BEGIN');

    // 1) Locate the users.user_id whose role_id matches this admin_id and whose role is an admin
    const userRes = await client.query(
      `SELECT user_id
         FROM users
        WHERE role_id = $1
          AND (role = $2 OR role = $3)`,
      [adminId, 'paoadmin', 'olbaadmin']
    );

    if (userRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Admin user not found' });
    }
    const userId = userRes.rows[0].user_id;

    // 2) Update the username in users
    await client.query(
      'UPDATE users SET username = $1 WHERE user_id = $2',
      [username, userId]
    );

    // 3) Update the admin table itself
    await client.query(
      `UPDATE admin
          SET username       = $1,
              first_name     = $2,
              last_name      = $3,
              email          = $4,
              contact_number = $5
        WHERE admin_id       = $6`,
      [username, first_name, last_name, email, contact_number, adminId]
    );

    await client.query('COMMIT');
    res.json({ message: 'Admin updated successfully' });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error updating admin:', e);
    res.status(500).json({ error: 'Server error' });
  }
};

export async function addAdmin(req, res) {
  const { username, first_name, last_name, email, password, contact_number, role_id } = req.body;

  try {
    // Hash the password before storing
    const hashedPassword = await bcrypt.hash(password, 10);

    // 1. Get the role of the admin performing the addition by admin_id (role_id here is admin_id of the logged-in admin)
    const roleResult = await client.query(
      `SELECT role FROM admin WHERE admin_id = $1`,
      [role_id]
    );

    if (roleResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Admin not found." });
    }

    // rename variable to avoid shadowing: this is the string role of the logged-in admin
    const adminRole = roleResult.rows[0].role;

    // 2. Insert new admin with the same role
    const adminInsertResult = await client.query(
      `INSERT INTO admin (username, first_name, last_name, email, password, contact_number, role)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING admin_id`,
      [username, first_name, last_name, email, hashedPassword, contact_number, adminRole]
    );

    const newAdminId = adminInsertResult.rows[0].admin_id;

    // 3. Map adminRole string to user role label
    // 4. Insert new user record linked to the new admin (use lowercase role names consistently)
    await client.query(
      `INSERT INTO users (role_id, role, username, password, status, failed_attempts, locked_until)
       VALUES ($1, $2, $3, $4, 'Activated', 0, NULL)`,
      [newAdminId, adminRole, username, hashedPassword]
    );

    res.json({ success: true, message: "Admin and user account added successfully." });

  } catch (err) {
    console.error('Error adding admin/user:', err);
    res.status(500).json({ success: false, message: "Error adding admin and user account." });
  }
};

export async function getAdminsByRole(req, res) {
  const { roleId } = req.params;
  try {
    // Get the role of the requesting admin
    const roleRes = await client.query('SELECT role FROM admin WHERE admin_id = $1', [roleId]);
    if (roleRes.rows.length === 0) return res.status(404).json({ error: 'Admin not found' });
    const adminRole = roleRes.rows[0].role;
    // Get all admins with the same role
    const adminsRes = await client.query(
      `SELECT a.admin_id, a.first_name, a.last_name, a.email, a.contact_number, a.username
       FROM admin a
       WHERE a.role = $1`,
      [adminRole]
    );
    res.json(adminsRes.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
}
