import client from "../../connection.js";
import bcrypt from 'bcrypt';

export async function changePasswordSecretary(req, res) {
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
      ['Secretary', roleId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Secretary not found.' });
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
      [hashedPassword, 'Secretary', roleId]
    );

    await client.query(
      'UPDATE secretary SET password = $1 WHERE secretary_id = $2',
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


export async function signupSecretary(req, res) {
  const { first_name, last_name, email, contact_number, address, username, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check for existing username/email in secretary table
    const secretaryCheck = await client.query(
      'SELECT 1 FROM secretary WHERE username = $1 OR email = $2',
      [username, email]
    );

    // Check for existing username in users table
    const userCheck = await client.query(
      'SELECT 1 FROM users WHERE username = $1',
      [username]
    );

    if (secretaryCheck.rows.length > 0 || userCheck.rows.length > 0) {
      return res.status(400).json({ message: 'Username or email already in use.' });
    }

    const secRes = await client.query(
      `INSERT INTO secretary (first_name, last_name, email, contact_number, address, username, password)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING secretary_id`,
      [first_name, last_name, email, contact_number, address, username, hashedPassword]
    );

    const secretary_id = secRes.rows[0].secretary_id;

    await client.query(
      `INSERT INTO users (role_id, role, username, password, status, failed_attempts, locked_until)
       VALUES ($1, 'Secretary', $2, $3, 'Activated', 0, NULL)`,
      [secretary_id, username, hashedPassword]
    );

    res.json({ message: 'Secretary registered successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export async function createRequestBySecretaryId(req, res) {
  const { secretary_id, lawyer_id, work_status } = req.body;

  if (!secretary_id || !lawyer_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Check if the request already exists
    const existingRequest = await client.query(
      'SELECT * FROM secretary_lawyers WHERE secretary_id = $1 AND lawyer_id = $2',
      [secretary_id, lawyer_id]
    );

    if (existingRequest.rows.length > 0) {
      return res.status(400).json({ error: 'Request already exists' });
    }

    // Insert new request
    const result = await client.query(
      'INSERT INTO secretary_lawyers (secretary_id, lawyer_id, work_status) VALUES ($1, $2, $3) RETURNING work_id',
      [secretary_id, lawyer_id, work_status || 'Pending']
    );

    // Add notification for lawyer
    await client.query(
      `INSERT INTO notifications (notification_status, sender, receiver, date, time, notification_purpose)
       VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_TIME, $4)`,
      ['unread', secretary_id, lawyer_id, 'application']
    );

    res.status(201).json({
      message: 'Request sent successfully',
      work_id: result.rows[0].work_id
    });
  } catch (error) {
    console.error('Error adding secretary-lawyer relationship:', error);
    res.status(500).json({
      error: 'Internal server error',
      detail: error.detail
    });
  }
};

export async function getSecretaryLawyers(req, res) {
  const { role_id } = req.query;

  if (!role_id) {
    return res.status(400).json({ error: 'Missing role_id in query' });
  }

  try {
    const result = await client.query(
      'SELECT work_id, secretary_id, lawyer_id FROM secretary_lawyers WHERE secretary_id = $1',
      [role_id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching secretary-lawyers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export async function getSecretaryById(req, res) {
  const { role_id } = req.params;
  try {
    const result = await client.query(
      'SELECT * FROM secretary WHERE secretary_id = $1',
      [role_id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Secretary not found' });

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching secretary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export async function updateProfile(req, res) {
  const { secretary_id } = req.params;
  const { username, first_name, last_name, address, email, contact_number } = req.body;

  try {
    await client.query('BEGIN');

    // Update secretary table
    await client.query(`
      UPDATE secretary
      SET username = $1, first_name = $2, last_name = $3,
          address = $4, email = $5, contact_number = $6
      WHERE secretary_id = $7
    `, [username, first_name, last_name, address, email, contact_number, secretary_id]);

    // Update users table
    await client.query(`
      UPDATE users
      SET username = $1
      WHERE role = 'Secretary' AND role_id = $2
    `, [username, secretary_id]);

    await client.query('COMMIT');
    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export async function getRequestsBySecretaryId(req, res) {
  const { id } = req.params;
  const query = `
    SELECT sl.work_id, sl.lawyer_id, sl.work_status, l.first_name, l.last_name, l.profile_picture
    FROM secretary_lawyers sl
    JOIN lawyers l ON sl.lawyer_id = l.lawyer_id
    WHERE sl.secretary_id = $1
  `;

  try {
    const result = await client.query(query, [id]);
    const requests = result.rows.map(row => {
      let profilePicture = null;

      if (row.profile_picture) {
        const base64 = Buffer.from(row.profile_picture).toString('base64');
        profilePicture = `data:image/jpeg;base64,${base64}`;
      }

      return {
        work_id: row.work_id,           // <-- Add work_id here
        lawyer_id: row.lawyer_id,
        work_status: row.work_status,
        first_name: row.first_name,
        last_name: row.last_name,
        profile_picture: profilePicture,
      };
    });

    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

export async function deleteRequest(req, res) {
  const workId = req.params.work_id;

  if (isNaN(workId)) {
    return res.status(400).send('Invalid work ID');
  }

  try {
    await client.query('DELETE FROM secretary_lawyers WHERE work_id = $1', [workId]);
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to delete request');
  }
};

export async function getRequestsByLawyerId(req, res) {
  const lawyerId = parseInt(req.params.lawyer_id);
  if (isNaN(lawyerId)) {
    return res.status(400).send('Invalid lawyer ID');
  }

  try {
    // Join with secretary table to get secretary's first_name, last_name, profile_picture
    const result = await client.query(`
      SELECT sl.work_id, sl.work_status, s.secretary_id, s.first_name, s.last_name
      FROM secretary_lawyers sl
      JOIN secretary s ON sl.secretary_id = s.secretary_id
      WHERE sl.lawyer_id = $1
      ORDER BY sl.work_id DESC
    `, [lawyerId]);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to fetch requests');
  }
};

// --- Update a request's status (approve or reject) ---
export async function updateRequestStatus(req, res) {
  const workId = req.params.work_id;
  const { status } = req.body;

  // ✅ Validate that status is a string and one of the allowed values
  if (!status || !['Approved', 'Rejected'].includes(status)) {
    return res.status(400).send('Invalid status value');
  }

  try {
    await client.query(
      'UPDATE secretary_lawyers SET work_status = $1 WHERE work_id = $2',
      [status, workId]
    );
    // Fetch secretary_id and lawyer_id for notification
    const rel = await client.query('SELECT secretary_id, lawyer_id FROM secretary_lawyers WHERE work_id = $1', [workId]);
    if (rel.rows.length > 0) {
      const { secretary_id, lawyer_id } = rel.rows[0];
      let purpose = status === 'Approved' ? 'approved' : 'rejected';
      await client.query(
        `INSERT INTO notifications (notification_status, sender, receiver, date, time, notification_purpose)
         VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_TIME, $4)`,
        ['unread', lawyer_id, secretary_id, purpose]
      );
    }
    res.sendStatus(200);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).send('Failed to update status');
  }
};

// --- Delete a request (only if Approved or Rejected) ---
export async function deleteRequestOnApproveOrRejectById(req, res) {
  const workId = parseInt(req.params.work_id);

  if (isNaN(workId)) {
    return res.status(400).send('Invalid work ID');
  }

  try {
    const check = await client.query(
      'SELECT work_status FROM secretary_lawyers WHERE work_id = $1',
      [workId]
    );

    if (check.rows.length === 0) {
      return res.status(404).send('Request not found');
    }

    const status = check.rows[0].work_status;
    if (status === 'Pending') {
      return res.status(400).send('Cannot delete a pending request');
    }

    await client.query('DELETE FROM secretary_lawyers WHERE work_id = $1', [workId]);
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to delete request');
  }
};

export async function getSecretaryLawyersBySecId(req, res) {
  const { secretaryId } = req.params;
  const result = await client.query(
    `SELECT sl.*, l.first_name, l.last_name
     FROM secretary_lawyers sl
     JOIN lawyers l ON l.lawyer_id = sl.lawyer_id
     WHERE sl.secretary_id = $1 AND sl.work_status = 'Approved'`,
    [secretaryId]
  );
  res.json(result.rows);
};

