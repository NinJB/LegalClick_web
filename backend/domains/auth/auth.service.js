app.post('/api/login', async (req, res) => {
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
  });

  // Check if a username is already used by another user
app.post('/api/check-username', async (req, res) => {
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
});

// Get Admins with Same Role
app.get('/api/admins/role/:adminId', async (req, res) => {
  const { adminId } = req.params;
  try {
    // Get role of the current admin
    const roleRes = await client.query('SELECT role FROM admin WHERE admin_id = $1', [adminId]);
    if (roleRes.rowCount === 0) {
      return res.status(404).json({ message: 'Admin not found.' });
    }

    const role = roleRes.rows[0].role;

    // Get all admins with the same role
    const adminsRes = await client.query('SELECT * FROM admin WHERE role = $1', [role]);
    res.json(adminsRes.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching admins by role.' });
  }
});