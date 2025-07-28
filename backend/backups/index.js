(async () => {

  const express = require('express');
  const mypath = require('path');
  const cors = require('cors');
  const client = require('./connection');
  const multer = require('multer');
  const fs = require('fs');
  const app = express();
  const { DateTime } = require('luxon');
  const bcrypt = require('bcrypt');
  const { hashPassword } = require('./hash-passwords');
  const cron = require('node-cron');
  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';
  
  app.use(express.static(__dirname));
  
  // Fallback to index.html for any route
  app.get('/', (req, res) => {
    res.sendFile(mypath.join(__dirname, 'index.html'));
  });
  
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  
  const upload = multer({ dest: 'uploads/' });
  
  // --- Payment Proof Upload (Client uploads proof of payment) ---
  const paymentProofUpload = multer({ storage: multer.memoryStorage() });
  
  client.connect()
    .then(() => console.log("Connected to PostgreSQL"))
    .catch(err => console.error("Connection error", err.stack));
  
  // --- Auto-complete past 'Upcoming' consultations ---
  cron.schedule('0 * * * *', async () => { // every hour
    try {
      // Use only the date part for comparison (YYYY-MM-DD)
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const todayStr = `${yyyy}-${mm}-${dd}`;
      // 1. Update status
      const updateResult = await client.query(
        `UPDATE consultation
         SET consultation_status = 'Completed'
         WHERE consultation_status = 'Upcoming'
           AND consultation_date::date < $1
         RETURNING consultation_id`,
        [todayStr]
      );
      const completedIds = updateResult.rows.map(row => row.consultation_id);
      if (completedIds.length > 0) {
        // 2. For each completed consultation, insert empty notes if not already present
        for (const consultationId of completedIds) {
          // Check if a note already exists
          const noteRes = await client.query(
            'SELECT 1 FROM lawyer_notes WHERE consultation_id = $1',
            [consultationId]
          );
          if (noteRes.rowCount === 0) {
            await client.query(
              'INSERT INTO lawyer_notes (consultation_id, note, recommendation) VALUES ($1, $2, $3)',
              [consultationId, '', '']
            );
          }
        }
      }
      console.log('Auto-completed past upcoming consultations and generated empty notes if needed');
    } catch (err) {
      console.error('Error auto-completing consultations:', err);
    }
  });
  
  app.post('/login', async (req, res) => {
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
    
        // For lawyers, fetch attorney_category
        let attorneyCategory = null;
        if (user.role === 'Lawyer') {
          const lawyerQuery = await client.query(
            'SELECT attorney_category FROM lawyers WHERE lawyer_id = $1',
            [user.role_id]
          );
          if (lawyerQuery.rowCount > 0) {
            attorneyCategory = lawyerQuery.rows[0].attorney_category;
          }
        }
    
        // Issue JWT
        const token = jwt.sign({
          user_id: user.user_id,
          role: user.role,
          role_id: user.role_id,
          username: user.username,
          attorney_category: attorneyCategory
        }, JWT_SECRET, { expiresIn: '8h' });
    
        // Respond with JWT and user info
        res.json({
          token,
          role: user.role,
          status: user.status,
          role_id: user.role_id,
          attorney_category: attorneyCategory
        });
    
      } catch (err) {
        console.error('Error during login:', err);
        res.status(500).json({ message: 'Server error.' });
      }
    });
    
    // Log trail function to record login attempts
    async function logTrail(role, userId, type, status) {
      const timestamp = new Date();
    
      try {
        if (role === 'Lawyer') {
          await client.query(
            'INSERT INTO log_trail_lawyers (user_id, log_timestamp, log_type, log_status) VALUES ($1, $2, $3, $4)',
            [userId, timestamp, type, status]
          );
        } else if (role === 'Client') {
          await client.query(
            'INSERT INTO log_trail_clients (user_id, log_timestamp, log_type, log_status) VALUES ($1, $2, $3, $4)',
            [userId, timestamp, type, status]
          );
        }
      } catch (err) {
        console.error('Error logging trail:', err);
      }
  }
  
  // JWT authentication middleware
  function authenticateJWT(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ message: 'Missing Authorization header' });
    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Missing token' });
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) return res.status(403).json({ message: 'Invalid or expired token' });
      req.user = user;
      next();
    });
  }
  
  // Add this helper to DRY up middleware usage
  const protected = [
    // All routes that need authentication
    // GET
    ['/api/lawyers', 'get'],
    ['/api/lawyer/by-role/:roleId', 'get'],
    ['/api/client/by-role/:roleId', 'get'],
    ['/api/admin/by-role/:roleId', 'get'],
    ['/api/specializations', 'get'],
    ['/api/lawyer/:id/specializations', 'get'],
    ['/api/lawyer/:id/availability', 'get'],
    ['/api/lawyer/:roleId/services', 'get'],
    ['/api/lawyer-details/:lawyerId', 'get'],
    ['/api/lawyers/:lawyerId', 'get'],
    ['/api/clients/:roleId', 'get'],
    ['/api/lawyer_availability/:lawyerId', 'get'],
    ['/api/lawyer_services/:lawyerId', 'get'],
    ['/api/consultations-client', 'get'],
    ['/api/consultations-lawyer', 'get'],
    ['/api/lawyer-services', 'get'],
    ['/api/admins/role/:adminId', 'get'],
    ['/api/view-specializations', 'get'],
    ['/api/lawyers/:lawyerId/consultations', 'get'],
    ['/api/lawyers/:lawyerId/logs', 'get'],
    ['/api/check-secretary-lawyers', 'get'],
    ['/api/secretary/by-role/:role_id', 'get'],
    ['/api/secretary/:id/requests', 'get'],
    ['/api/lawyer/:lawyer_id/requests', 'get'],
    ['/api/secretary-lawyers-view/:secretaryId', 'get'],
    ['/api/lawyer-notes-view/:consultation_id', 'get'],
    ['/api/lawyer/:lawyerId/reviews', 'get'],
    ['/api/reviews/consultation/:consultation_id/client/:client_id', 'get'],
    ['/api/notifications/client', 'get'],
    ['/api/notifications/lawyer', 'get'],
    ['/api/notifications/secretary', 'get'],
  
    ['/api/payments/receipt/:consultation_id', 'get'],
    // POST
    ['/api/check-username', 'post'],
    ['/api/lawyer/:role_id/specializations', 'post'],
    ['/api/lawyer/:id/availability', 'post'],
    ['/api/lawyer/:roleId/services', 'post'],
    ['/api/lawyer/upload-profile-picture/:lawyer_id', 'post'],
    ['/api/consultation', 'post'],
    ['/api/add-admin', 'post'],
    ['/api/add-specializations', 'post'],
    ['/api/secretary-lawyers', 'post'],
    ['/api/consultations-update/:id', 'post'],
    ['/api/lawyer-notes', 'post'],
    ['/api/reviews', 'post'],
    ['/api/payments/upload', 'post'],
    ['/api/payments/confirm', 'post'],
    ['/api/consultations/complete-paid/:consultation_id', 'post'],
    // PUT
    ['/api/lawyer/update/:lawyerId', 'put'],
    ['/api/client/update/:client_id', 'put'],
    ['/api/admin/update/:adminId', 'put'],
    ['/api/secretary/update/:secretary_id', 'put'],
    ['/api/secretary/requests/:work_id', 'put'],
    ['/api/reviews/:review_id', 'put'],
    // PATCH
    ['/api/consultations-update/:consultation_id', 'patch'],
    ['/api/consultations-reschedule/:consultation_id', 'patch'],
    ['/api/notifications/:notification_id/read', 'patch'],
    // DELETE
    ['/api/delete-specializations/:id', 'delete'],
    ['/api/secretary/requests/:work_id', 'delete'],
  ];
  protected.forEach(([route, method]) => {
    app[method](route, authenticateJWT);
  });
  
  // GET all lawyers
  app.get('/api/public-lawyers', (req, res) => {
    const query = `
      SELECT 
        *, 
        encode(attorney_license, 'base64') AS attorney_license,
        encode(profile_picture, 'base64') AS profile_picture
      FROM lawyers
    `;
  
    client.query(query, (err, result) => {
      if (err) {
        console.error('Error fetching lawyers:', err.message);
        return res.status(500).json({ error: 'Error fetching lawyers' });
      }
  
      res.json(result.rows);
    });
  });
  
  // PUT update lawyer's account status
  app.put('/api/public-lawyers/:lawyer_id/status', async (req, res) => {
    const { lawyer_id } = req.params;
    const { account_status } = req.body;
  
    // Validate account status
    if (!['Request', 'Activated', 'Rejected', 'Deactivated'].includes(account_status)) {
      return res.status(400).json({ error: 'Invalid account status value' });
    }
  
    const updateLawyerQuery = `
      UPDATE lawyers 
      SET account_status = $1 
      WHERE lawyer_id = $2 AND attorney_category = 'Public'
    `;
  
    try {
      const lawyerResult = await client.query(updateLawyerQuery, [account_status, lawyer_id]);
  
      if (lawyerResult.rowCount === 0) {
        return res.status(404).json({ error: 'Public lawyer not found' });
      }
  
      const updateUserQuery = `
        UPDATE users 
        SET status = $1 
        WHERE role_id = $2 AND role = 'Lawyer'
      `;
      await client.query(updateUserQuery, [account_status, lawyer_id]);
  
      res.json({ message: `Public lawyer and user status updated to ${account_status}` });
  
    } catch (err) {
      console.error('Error updating statuses:', err.message);
      res.status(500).json({ error: 'Failed to update statuses' });
    }
  });
  
  // GET all private lawyers
  app.get('/api/private-lawyers', (req, res) => {
    const query = `SELECT *, encode(attorney_license, 'base64') as attorney_license FROM lawyers WHERE attorney_category = 'Private'`;
  
    client.query(query, (err, result) => {
      if (err) {
        console.error('Error fetching lawyers:', err.message);
        return res.status(500).json({ error: 'Error fetching lawyers' });
      }
  
      res.json(result.rows);
    });
  });
  
  // PUT update private lawyer's account status
  app.put('/api/private-lawyers/:lawyer_id/status', async (req, res) => {
    const { lawyer_id } = req.params;
    const { account_status } = req.body;
  
    if (!['Request', 'Activated', 'Rejected', 'Deactivated'].includes(account_status)) {
      return res.status(400).json({ error: 'Invalid account status value' });
    }
  
    const updateLawyerQuery = `
      UPDATE lawyers 
      SET account_status = $1 
      WHERE lawyer_id = $2 AND attorney_category = 'Private'
    `;
  
    try {
      const lawyerResult = await client.query(updateLawyerQuery, [account_status, lawyer_id]);
  
      if (lawyerResult.rowCount === 0) {
        return res.status(404).json({ error: 'Private lawyer not found' });
      }
  
      const updateUserQuery = `
        UPDATE users 
        SET status = $1 
        WHERE role_id = $2 AND role = 'Lawyer'
      `;
      await client.query(updateUserQuery, [account_status, lawyer_id]);
  
      res.json({ message: `Private lawyer and user status updated to ${account_status}` });
  
    } catch (err) {
      console.error('Error updating statuses:', err.message);
      res.status(500).json({ error: 'Failed to update statuses' });
    }
  });
  
  // Get list of clients (for reference)
  app.post('/api/signup', upload.single('attorney_license'), async (req, res) => {
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
  });
  
  app.post('/api/signup-clients', upload.single('national_id'), async (req, res) => {
    const {
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
  
      fs.unlinkSync(nationalId.path); // Clean up
  
      res.status(201).json({
        message: 'Account created. You can now log in.',
        clientId
      });
    } catch (err) {
      if (nationalId && fs.existsSync(nationalId.path)) {
        fs.unlinkSync(nationalId.path); // Clean up in case of error
      }
      console.error('Error during signup:', err.message);
      res.status(500).json({ message: 'Failed to register client.' });
    }
  });
  
  // This goes with your other app.get or app.post routes
  app.get('/api/lawyers', async (req, res) => {
    try {
      const { specialization_id } = req.query;
  
      let query = `
        SELECT 
          l.lawyer_id,
          l.first_name,
          l.last_name,
          l.roll_number,
          l.attorney_category,
          l.profile_picture,
          COALESCE(ls.consultation, 0) AS consultation,
          COALESCE(ls.representation_min, 0) AS representation_min,
          COALESCE(ls.representation_max, 0) AS representation_max
        FROM lawyers l
        LEFT JOIN lawyer_services ls ON l.lawyer_id = ls.lawyer_id
      `;
  
      const values = [];
  
      if (specialization_id) {
        query += `
          WHERE l.account_status = 'Activated'
          AND (
            l.attorney_category = 'Public' 
            OR l.lawyer_id IN (
              SELECT lsp.lawyer_id 
              FROM lawyer_specializations lsp 
              WHERE lsp.specialization_id = $1
            )
          )
        `;
        values.push(parseInt(specialization_id));
      } else {
        query += `
          WHERE l.account_status = 'Activated'
        `;
      }
  
      query += `
        GROUP BY 
          l.lawyer_id, 
          l.first_name, 
          l.last_name, 
          l.roll_number, 
          l.attorney_category, 
          l.profile_picture, 
          ls.consultation, 
          ls.representation_min, 
          ls.representation_max
      `;
  
      const { rows } = await client.query(query, values);
  
      const lawyersWithBase64Images = rows.map(lawyer => {
        if (lawyer.profile_picture) {
          lawyer.profile_picture = `data:image/jpeg;base64,${lawyer.profile_picture.toString('base64')}`;
        }
        return lawyer;
      });
  
      res.json(lawyersWithBase64Images);
    } catch (err) {
      console.error('Error fetching lawyers:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  app.get('/api/lawyer/by-role/:roleId', async (req, res) => {
    const { roleId } = req.params;
  
    const result = await client.query(`
      SELECT l.*, l.profile_picture
      FROM users u
      JOIN lawyers l ON u.role_id = l.lawyer_id
      WHERE u.role_id = $1
    `, [roleId]);
  
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lawyer not found' });
    }
  
    const lawyer = result.rows[0];
  
    // Check if the profile_picture exists, and convert it to base64 if available
    if (lawyer.profile_picture) {
      const base64Image = lawyer.profile_picture.toString('base64');
      lawyer.profile_picture = base64Image;
    }
  
    res.json(lawyer);
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
  
  // Update lawyer profile
  app.put('/api/lawyer/update/:lawyerId', async (req, res) => {
    const lawyerId = req.params.lawyerId;
    console.log(`Received PUT request to update lawyer ID: ${lawyerId}`);
  
    try {
      await client.query('BEGIN');
  
      // Update the username in the users table where role_id matches lawyer_id
      await client.query(
        'UPDATE users SET username = $1 WHERE role_id = $2',
        [req.body.username, lawyerId]
      );
  
      // Update the lawyers table
      await client.query(
        `UPDATE lawyers 
         SET username = $1,
             last_name = $2,
             office_address = $3,
             email = $4,
             contact_number = $5,
             gcash_number = $6
         WHERE lawyer_id = $7`,
        [
          req.body.username,
          req.body.last_name,
          req.body.office_address,
          req.body.email,
          req.body.contact_number,
          req.body.gcash_number,
          lawyerId
        ]
      );
  
      await client.query('COMMIT');
      res.json({ message: 'Lawyer profile updated successfully' });
  
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error updating lawyer profile', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // GET client by role_id
  app.get('/api/client/by-role/:roleId', async (req, res) => {
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
  });
  
  // PUT update client
  app.put('/api/client/update/:client_id', async (req, res) => {
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
  });
  
  // Backend routes in index.js
  
  // GET admin by role_id
  app.get('/api/admin/by-role/:roleId', async (req, res) => {
    const { roleId } = req.params;
    try {
      const result = await client.query(`
        SELECT a.admin_id, a.first_name, a.last_name, a.email, a.contact_number,
               u.username, u.user_id
        FROM users u
        JOIN admin a ON u.role_id = a.admin_id
        WHERE u.role_id = $1
          AND u.role IN ('PAO-Admin','OLBA-Admin')
      `, [roleId]);
      if (!result.rows.length) return res.status(404).json({ error:'Admin not found' });
      res.json(result.rows[0]);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error:'Server error' });
    }
  });
  
  // PUT update admin
  app.put('/api/admin/update/:adminId', async (req, res) => {
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
        [adminId, 'PAO-Admin', 'OLBA-Admin']
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
  });
  
  app.post('/api/change-password-lawyer/:roleId', async (req, res) => {
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
        ['Lawyer', roleId]
      );
  
      if (result.rowCount === 0) {
        return res.status(404).json({ message: 'Lawyer not found.' });
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
        [hashedPassword, 'Lawyer', roleId]
      );
  
      await client.query(
        'UPDATE lawyers SET password = $1 WHERE lawyer_id = $2',
        [hashedPassword, roleId]
      );
  
      await client.query('COMMIT');
  
      res.json({ message: 'Password changed successfully.' });
  
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Change password error:', err);
      res.status(500).json({ message: 'Server error.' });
    }
  });
  
  app.post('/api/change-password-client/:roleId', async (req, res) => {
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
  });
  
  app.post('/api/change-password-admin/:roleId', async (req, res) => {
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
        ['PAO-Admin', 'OLBA-Admin', roleId]
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
        [hashedPassword, 'PAO-Admin', 'OLBA-Admin', roleId]
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
  });
  
  app.post('/api/change-password-secretary/:roleId', async (req, res) => {
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
  });
  
  app.get('/api/specializations', async (req, res) => {
    try {
      const result = await client.query(
        'SELECT specialization_id, specialization_name AS name FROM specializations ORDER BY specialization_name'
      );
      res.json(result.rows);
    } catch (err) {
      console.error('Error fetching specializations:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  
  // GET selected specializations for a lawyer
  app.get('/api/lawyer/:id/specializations', async (req, res) => {
    const lawyerId = req.params.id;
  
    try {
      const result = await client.query(
        'SELECT specialization_id FROM lawyer_specializations WHERE lawyer_id = $1',
        [lawyerId]
      );
      const specializationIds = result.rows.map(row => row.specialization_id);
      res.json(specializationIds);
    } catch (err) {
      console.error('Error fetching lawyer specializations:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  
  // POST selected specializations for a lawyer
  app.post('/api/lawyer/:role_id/specializations', async (req, res) => {
    const { role_id } = req.params;
    const { specializations } = req.body; // Array of specialization_ids (strings or numbers)
  
    if (!Array.isArray(specializations)) {
      return res.status(400).json({ error: 'Invalid data format' });
    }
  
    try {
      // Ensure all incoming IDs are integers
      const selectedIds = specializations.map(id => parseInt(id)).filter(id => !isNaN(id));
  
      // Get existing specialization IDs
      const { rows: existing } = await client.query(
        'SELECT specialization_id FROM lawyer_specializations WHERE lawyer_id = $1',
        [role_id]
      );
      const existingIds = existing.map(row => parseInt(row.specialization_id));
  
      // Determine what to insert or delete
      const toInsert = selectedIds.filter(id => !existingIds.includes(id));
      const toDelete = existingIds.filter(id => !selectedIds.includes(id));
  
      // Perform deletions
      if (toDelete.length > 0) {
        await client.query(
          `DELETE FROM lawyer_specializations 
           WHERE lawyer_id = $1 AND specialization_id = ANY($2::int[])`,
          [role_id, toDelete]
        );
      }
  
      // Perform insertions
      for (const id of toInsert) {
        await client.query(
          'INSERT INTO lawyer_specializations (lawyer_id, specialization_id) VALUES ($1, $2)',
          [role_id, id]
        );
      }
  
      res.json({ message: 'Specializations updated' });
    } catch (err) {
      console.error('Error updating specializations:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  
  // GET lawyer availability
  app.get('/api/lawyer/:id/availability', async (req, res) => {
    const lawyerId = req.params.id;
  
    try {
      const result = await client.query(
        'SELECT morning_start, morning_end, evening_start, evening_end, workday_start, workday_end FROM lawyer_availability WHERE lawyer_id = $1',
        [lawyerId]
      );
  
      if (result.rows.length > 0) {
        res.json(result.rows[0]);
      } else {
        res.json(null); // No availability set yet
      }
    } catch (err) {
      console.error('Error fetching availability:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  
  // POST availability
  app.post('/api/lawyer/:id/availability', async (req, res) => {
    const lawyerId = req.params.id;
    const {
      morning_start,
      morning_end,
      evening_start,
      evening_end,
      workday_start,
      workday_end
    } = req.body;
  
    try {
      await client.query(
        `
        INSERT INTO lawyer_availability (
          lawyer_id, morning_start, morning_end, evening_start, evening_end, workday_start, workday_end
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (lawyer_id) DO UPDATE SET
          morning_start = EXCLUDED.morning_start,
          morning_end = EXCLUDED.morning_end,
          evening_start = EXCLUDED.evening_start,
          evening_end = EXCLUDED.evening_end,
          workday_start = EXCLUDED.workday_start,
          workday_end = EXCLUDED.workday_end
        `,
        [lawyerId, morning_start, morning_end, evening_start, evening_end, workday_start, workday_end]
      );
  
      res.json({ message: 'Availability saved' });
    } catch (err) {
      console.error('Error saving availability:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  
  app.get('/api/lawyer/:roleId/services', async (req, res) => {
    const { roleId } = req.params;
  
    try {
      const result = await client.query(
        'SELECT consultation, representation_min, representation_max FROM lawyer_services WHERE lawyer_id = $1',
        [roleId]
      );
  
      if (result.rows.length === 0) {
        return res.status(200).json(null); // No services saved yet
      }
  
      res.status(200).json(result.rows[0]);
    } catch (err) {
      console.error('GET /lawyer/:roleId/services error:', err);
      res.status(500).json({ error: 'Failed to fetch services' });
    }
  });
  
  // POST (insert or update) lawyer services
  app.post('/api/lawyer/:roleId/services', async (req, res) => {
    const { roleId } = req.params;
    const { consultation, representation_min, representation_max } = req.body;
  
    try {
      // Check if the row already exists
      const { rows } = await client.query(
        'SELECT 1 FROM lawyer_services WHERE lawyer_id = $1',
        [roleId]
      );
  
      if (rows.length > 0) {
        // If it exists, update
        await client.query(
          `UPDATE lawyer_services
           SET consultation = $1,
               representation_min = $2,
               representation_max = $3
           WHERE lawyer_id = $4`,
          [consultation, representation_min, representation_max, roleId]
        );
      } else {
        // If it doesn't exist, insert
        await client.query(
          `INSERT INTO lawyer_services 
           (lawyer_id, consultation, representation_min, representation_max)
           VALUES ($1, $2, $3, $4)`,
          [roleId, consultation, representation_min, representation_max]
        );
      }
  
      res.status(200).json({ message: 'Services saved successfully' });
    } catch (err) {
      console.error('POST /lawyer/:roleId/services error:', err);
      res.status(500).json({ error: 'Failed to save services' });
    }
  });
  
  app.post('/api/lawyer/upload-profile-picture/:lawyer_id', upload.single('file'), async (req, res) => {
    const lawyerId = req.params.lawyer_id;
    const image = req.file;
  
    if (!image) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
  
    try {
      // Read the file from disk and get the buffer data
      const imageData = fs.readFileSync(image.path); // Read the image file buffer from disk
  
      // Update the profile picture in the database
      const updateQuery = `
        UPDATE lawyers
        SET profile_picture = $1
        WHERE lawyer_id = $2
        RETURNING profile_picture
      `;
      const result = await client.query(updateQuery, [imageData, lawyerId]);
  
      if (result.rows.length > 0) {
        // Optionally delete the file after saving it to the database
        fs.unlinkSync(image.path); // Delete the temporary file from disk
  
        return res.status(200).json({ message: 'Profile picture uploaded successfully' });
      } else {
        return res.status(404).json({ message: 'Lawyer not found' });
      }
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      return res.status(500).json({ message: 'Server error' });
    }
  });
  
  app.get('/api/lawyer-details/:lawyerId', async (req, res) => {
    const { lawyerId } = req.params;
  
    try {
      // Query for additional lawyer profile details
      const profileQuery = await client.query(`
        SELECT law_school, bar_admission_year, office_address, email, contact_number
        FROM lawyers
        WHERE lawyer_id = $1
      `, [lawyerId]);
  
      // Query for availability
      const availabilityQuery = await client.query(`
        SELECT workday_start, workday_end, morning_start, morning_end, evening_start, evening_end
        FROM lawyer_availability
        WHERE lawyer_id = $1
      `, [lawyerId]);
  
      // Query for services
      const servicesQuery = await client.query(`
        SELECT consultation, representation_min, representation_max
        FROM lawyer_services
        WHERE lawyer_id = $1
      `, [lawyerId]);
  
      res.json({
        profile: profileQuery.rows[0] || null,
        availability: availabilityQuery.rows[0] || null,
        services: servicesQuery.rows[0] || null
      });
    } catch (err) {
      console.error('Error fetching lawyer details:', err.message);
      res.status(500).json({ error: 'Server error fetching lawyer details' });
    }
  });
  
  app.get('/api/lawyers/:lawyerId', async (req, res) => {
    try {
      const { lawyerId } = req.params;
      const result = await client.query(
        `SELECT first_name, last_name, attorney_category FROM lawyers WHERE lawyer_id = $1`,
        [lawyerId]
      );
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch lawyer info' });
    }
  });
  
  app.get('/api/clients/:roleId', async (req, res) => {
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
  });
  
  // GET Lawyer Availability
  app.get('/api/lawyer_availability/:lawyerId', async (req, res) => {
    try {
      const { lawyerId } = req.params;
      const result = await client.query(
        `SELECT * FROM lawyer_availability WHERE lawyer_id = $1`,
        [lawyerId]
      );
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch availability' });
    }
  });
  
  // GET Consultation Fee Rate
  app.get('/api/lawyer_services/:lawyerId', async (req, res) => {
    try {
      const { lawyerId } = req.params;
      const result = await client.query(
        `SELECT consultation FROM lawyer_services WHERE lawyer_id = $1`,
        [lawyerId]
      );
      res.json({ consultation_fee: result.rows[0].consultation });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch fee' });
    }
  });
  
  // POST New Consultation Booking
  app.post('/api/consultation', upload.none(), async (req, res) => {
    try {
      const {
        client_id,
        lawyer_id,
        consultation_category,
        consultation_description,
        consultation_date,
        consultation_time,
        consultation_duration,
        consultation_fee,
        consultation_mode,
        payment_mode,
      } = req.body;
  
      const consultationResult = await client.query(
        `INSERT INTO consultation (
          client_id, lawyer_id, date, consultation_category, consultation_description,
          consultation_date, consultation_time, consultation_duration,
          consultation_fee, consultation_mode, payment_mode, consultation_status
        ) VALUES (
          $1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8, $9, $10, 'Pending'
        ) RETURNING consultation_id`,
        [
          client_id,
          lawyer_id,
          consultation_category,
          consultation_description,
          consultation_date,
          consultation_time,
          consultation_duration,
          consultation_fee,
          consultation_mode,
          payment_mode
        ]
      );
      const consultation_id = consultationResult.rows[0].consultation_id;
      // Insert notification row as specified
      await client.query(
        `INSERT INTO notifications (consultation_id, notification_status, sender, receiver, date, time, notification_purpose)
         VALUES ($1, $2, $3, $4, CURRENT_DATE, CURRENT_TIME, $5)`,
        [
          consultation_id,
          'unread',
          client_id, // sender is the client
          lawyer_id, // receiver is the lawyer
          'request'
        ]
      );
      res.json({ message: 'Consultation booked successfully' });
  
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Booking failed' });
    }
  });
  
  app.get('/api/consultations-client', async (req, res) => {
    const clientId = req.query.client_id;
    console.log('Received client_id:', clientId);
  
    if (!clientId) {
      return res.status(400).json({ error: 'Missing client_id query parameter' });
    }
  
    try {
      const query = `
        SELECT *
        FROM consultation
        WHERE client_id = $1
        ORDER BY date DESC
      `;
  
      const { rows } = await client.query(query, [clientId]);
  
      res.json(rows);
    } catch (error) {
      console.error('Error fetching consultations:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  
  app.get('/api/consultations-lawyer', async (req, res) => {
    try {
      const { lawyer_id } = req.query;
      if (!lawyer_id) {
        return res.status(400).json({ error: 'lawyer_id is required' });
      }
  
      // Query consultations by lawyer_id
      const query = `
        SELECT * FROM consultation
        WHERE lawyer_id = $1
        ORDER BY date DESC
      `;
      const { rows } = await client.query(query, [lawyer_id]);
  
      res.status(200).json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch consultations' });
    }
  });
  
  app.patch('/api/consultations-update/:consultation_id', async (req, res) => {
    const consultation_id = parseInt(req.params.consultation_id, 10);
    const { consultation_status } = req.body;
  
    if (isNaN(consultation_id)) {
      return res.status(400).json({ error: 'Invalid consultation ID' });
    }
  
    if (!consultation_status) {
      return res.status(400).json({ error: 'consultation_status is required' });
    }
  
    try {
      const result = await client.query(
        `UPDATE consultation
         SET consultation_status = $1
         WHERE consultation_id = $2
         RETURNING *`,
        [consultation_status, consultation_id]
      );
  
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Consultation not found' });
      }
  
      // Add notification for approval/rejection
      if (consultation_status === 'Rejected' || consultation_status === 'Upcoming' || consultation_status === 'Unpaid') {
        // Get lawyer_id and client_id
        const consult = result.rows[0];
        console.log('Consultation data:', consult); // Debug log
        let purpose = '';
        if (consultation_status === 'Rejected') purpose = 'rejected';
        else if (consultation_status === 'Upcoming' || consultation_status === 'Unpaid') {
          console.log('Consultation mode:', consult.consultation_mode); // Debug log
          if (consult.consultation_mode === 'Online') {
            purpose = 'approved_online';
            console.log('Setting purpose to approved_online'); // Debug log
          } else {
            purpose = 'approved';
            console.log('Setting purpose to approved'); // Debug log
          }
        }
        console.log('Final purpose:', purpose); // Debug log
        if (purpose) {
          await client.query(
            `INSERT INTO notifications (consultation_id, notification_status, sender, receiver, date, time, notification_purpose)
             VALUES ($1, $2, $3, $4, CURRENT_DATE, CURRENT_TIME, $5)`,
            [consultation_id, 'unread', consult.lawyer_id, consult.client_id, purpose]
          );
        }
        // If secretary_id is provided, add notification for lawyer
        if (req.body.secretary_id && (consultation_status === 'Upcoming' || consultation_status === 'Unpaid')) {
          await client.query(
            `INSERT INTO notifications (consultation_id, notification_status, sender, receiver, date, time, notification_purpose)
             VALUES ($1, $2, $3, $4, CURRENT_DATE, CURRENT_TIME, $5)`,
            [consultation_id, 'unread', req.body.secretary_id, consult.lawyer_id, 'approved_by_secretary']
          );
        }
      }
  
      res.status(200).json({ message: 'Consultation updated successfully', consultation: result.rows[0] });
    } catch (err) {
      console.error('Update error:', err);
      res.status(500).json({ error: 'Failed to update consultation' });
    }
  });
  
  app.get('/api/lawyer-services', async (req, res) => {
    try {
      const result = await client.query('SELECT * FROM lawyer_services');
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching lawyer services:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  app.post('/api/add-admin', async (req, res) => {
    const { username, first_name, last_name, email, password, contact_number, role_id } = req.body;
  
    try {
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
        [username, first_name, last_name, email, password, contact_number, adminRole]
      );
  
      const newAdminId = adminInsertResult.rows[0].admin_id;
  
      // 3. Map adminRole string to user role label
      let roleLabel;
      if (adminRole === 'paoadmin') {
        roleLabel = 'PAO-Admin';
      } else if (adminRole === 'olbaadmin') {
        roleLabel = 'OLBA-Admin';
      } else {
        roleLabel = 'Admin'; // fallback or default
      }
  
      // 4. Insert new user record linked to the new admin
      await client.query(
        `INSERT INTO users (role_id, role, username, password, status, failed_attempts, locked_until)
         VALUES ($1, $2, $3, $4, 'Activated', 0, NULL)`,
        [newAdminId, roleLabel, username, password]
      );
  
      res.json({ success: true, message: "Admin and user account added successfully." });
  
    } catch (err) {
      console.error('Error adding admin/user:', err);
      res.status(500).json({ success: false, message: "Error adding admin and user account." });
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
  
  app.post('/api/add-specializations', async (req, res) => {
    const { specialization_name } = req.body;
    try {
      const check = await client.query(
        'SELECT * FROM specializations WHERE LOWER(specialization_name) = LOWER($1)',
        [specialization_name]
      );
  
      if (check.rows.length > 0) {
        return res.json({ success: false, message: "Specialization already exists!" });
      }
  
      await client.query(
        'INSERT INTO specializations (specialization_name) VALUES ($1)',
        [specialization_name]
      );
  
      res.json({ success: true, message: "Specialization added." });
  
    } catch (err) {
      console.error('Error in /api/add-specializations:', err);  // Log the error details
      res.status(500).json({ success: false, message: "Error adding specialization." });
    }
  });
  
  // Delete Specialization
  app.delete('/api/delete-specializations/:id', async (req, res) => {
    const { id } = req.params;
    try {
      await client.query('DELETE FROM specializations WHERE specialization_id = $1', [id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Error deleting specialization." });
    }
  });
  
  app.get('/api/view-specializations', async (req, res) => {
    try {
      const result = await client.query('SELECT * FROM specializations ORDER BY specialization_name ASC');
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching specializations:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Fetch consultations for a lawyer
  app.get('/api/lawyers/:lawyerId/consultations', (req, res) => {
    const { lawyerId } = req.params;
    const query = `
      SELECT consultation_id, consultation_status 
      FROM consultation 
      WHERE lawyer_id = $1
    `;
  
    client.query(query, [lawyerId], (err, result) => {
      if (err) {
        console.error('Error fetching consultations:', err.message);
        return res.status(500).json({ error: 'Error fetching consultations' });
      }
  
      res.json(result.rows);
    });
  });
  
  // Fetch log trails for a lawyer
  app.get('/api/lawyers/:lawyerId/logs', (req, res) => {
    const { lawyerId } = req.params;
    const query = `
      SELECT log_timestamp, log_type, log_status 
      FROM log_trail_lawyers 
      WHERE user_id = $1
    `;
  
    client.query(query, [lawyerId], (err, result) => {
      if (err) {
        console.error('Error fetching log trails:', err.message);
        return res.status(500).json({ error: 'Error fetching log trails' });
      }
  
      res.json(result.rows);
    });
  });
  
  app.post('/api/signup-secretary', upload.none(), async (req, res) => {
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
  });
  
  app.post('/api/secretary-lawyers', async (req, res) => {
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
        `INSERT INTO notifications (consultation_id, notification_status, sender, receiver, date, time, notification_purpose)
         VALUES ($1, $2, $3, $4, CURRENT_DATE, CURRENT_TIME, $5)`,
        [0, 'unread', secretary_id, lawyer_id, 'application']
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
  });
  
  app.get('/api/check-secretary-lawyers', async (req, res) => {
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
  });
  
  app.get('/api/secretary/by-role/:role_id', async (req, res) => {
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
  });
  
  app.put('/api/secretary/update/:secretary_id', async (req, res) => {
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
  });
  
  app.get('/api/secretary/:id/requests', async (req, res) => {
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
  });
  
  app.delete('/api/secretary/requests/:work_id', async (req, res) => {
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
  });
  
  app.get('/api/lawyer/:lawyer_id/requests', async (req, res) => {
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
  });
  
  // --- Update a request's status (approve or reject) ---
  app.put('/api/secretary/requests/:work_id', async (req, res) => {
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
        if (status === 'Approved') {
          // Notify secretary of acceptance
          await client.query(
            `INSERT INTO notifications (consultation_id, notification_status, sender, receiver, date, time, notification_purpose)
             VALUES ($1, $2, $3, $4, CURRENT_DATE, CURRENT_TIME, $5)`,
            [0, 'unread', lawyer_id, secretary_id, 'application_accepted']
          );
        } else {
          // Notify secretary of rejection
          await client.query(
            `INSERT INTO notifications (consultation_id, notification_status, sender, receiver, date, time, notification_purpose)
             VALUES ($1, $2, $3, $4, CURRENT_DATE, CURRENT_TIME, $5)`,
            [0, 'unread', lawyer_id, secretary_id, 'application_rejected']
          );
        }
      }
      res.sendStatus(200);
    } catch (err) {
      console.error('Database error:', err);
      res.status(500).send('Failed to update status');
    }
  });
  
  // --- Delete a request (only if Approved or Rejected) ---
  app.delete('/api/secretary/requests/:work_id', async (req, res) => {
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
  });
  
  app.get('/api/secretary-lawyers-view/:secretaryId', async (req, res) => {
    const { secretaryId } = req.params;
    const result = await client.query(
      `SELECT sl.*, l.first_name, l.last_name
       FROM secretary_lawyers sl
       JOIN lawyers l ON l.lawyer_id = sl.lawyer_id
       WHERE sl.secretary_id = $1 AND sl.work_status = 'Approved'`,
      [secretaryId]
    );
    res.json(result.rows);
  });
  
  app.post('/api/consultations-update/:id', async (req, res) => {
    const { id } = req.params;
  
    try {
      const result = await client.query(
        `UPDATE consultation
         SET consultation_status = 'Completed'
         WHERE id = $1
         RETURNING *`,
        [id]
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to update consultation status' });
    }
  });
  
  // 2. Save notes and recommendation
  app.post('/api/lawyer-notes', async (req, res) => {
    const { consultation_id, note, recommendation } = req.body;
  
    try {
      const result = await client.query(
        `INSERT INTO lawyer_notes (consultation_id, note, recommendation)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [consultation_id, note, recommendation]
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to save notes and recommendation' });
    }
  });
  
  // 3. Fetch notes & recommendation for a completed consultation
  app.get('/api/lawyer-notes-view/:consultation_id', async (req, res) => {
    const { consultation_id } = req.params;
  
    try {
      // Check if consultation is completed
      const consult = await client.query(
        `SELECT consultation_status FROM consultation WHERE consultation_id = $1`,
        [consultation_id]
      );
  
      if (!consult.rows.length || consult.rows[0].consultation_status !== 'Completed') {
        return res.status(403).json({ error: 'Notes are only available after consultation is completed.' });
      }
  
      // Fetch the note and recommendation
      const result = await client.query(
        `SELECT * FROM lawyer_notes WHERE consultation_id = $1`,
        [consultation_id]
      );
  
      res.json(result.rows[0] || {});
  
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch notes' });
    }
  });
  
  // GET reviews for a lawyer (with client username and average rating)
  app.get('/api/lawyer/:lawyerId/reviews', async (req, res) => {
    const { lawyerId } = req.params;
    try {
      // Fetch reviews with client username and consultation_id
      const reviewsQuery = `
        SELECT r.review_id, r.rating, r.review_description, r.consultation_id, c.username
        FROM reviews r
        JOIN clients c ON r.client_id = c.client_id
        WHERE r.lawyer_id = $1
        ORDER BY r.review_id DESC
      `;
      const reviewsResult = await client.query(reviewsQuery, [lawyerId]);
  
      // Calculate average rating
      const avgQuery = `
        SELECT AVG(rating) AS average_rating
        FROM reviews
        WHERE lawyer_id = $1
      `;
      const avgResult = await client.query(avgQuery, [lawyerId]);
      const average_rating = avgResult.rows[0]?.average_rating || null;
  
      res.json({
        reviews: reviewsResult.rows,
        average_rating: average_rating ? parseFloat(average_rating).toFixed(2) : null
      });
    } catch (err) {
      console.error('Error fetching reviews:', err);
      res.status(500).json({ error: 'Failed to fetch reviews' });
    }
  });
  
  // POST: Add a new review
  app.post('/api/reviews', async (req, res) => {
    const { consultation_id, client_id, lawyer_id, rating, review_description } = req.body;
    if (!consultation_id || !client_id || !lawyer_id || !rating || !review_description) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }
    try {
      const result = await client.query(
        `INSERT INTO reviews (consultation_id, client_id, lawyer_id, rating, review_description)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [consultation_id, client_id, lawyer_id, rating, review_description]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Error adding review:', err);
      res.status(500).json({ error: 'Failed to add review' });
    }
  });
  
  // PUT: Edit an existing review
  app.put('/api/reviews/:review_id', async (req, res) => {
    const { review_id } = req.params;
    const { rating, review_description } = req.body;
    if (!rating || !review_description) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }
    try {
      const result = await client.query(
        `UPDATE reviews SET rating = $1, review_description = $2 WHERE review_id = $3 RETURNING *`,
        [rating, review_description, review_id]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Review not found' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      console.error('Error updating review:', err);
      res.status(500).json({ error: 'Failed to update review' });
    }
  });
  
  // GET: Get review for a consultation by client
  app.get('/api/reviews/consultation/:consultation_id/client/:client_id', async (req, res) => {
    const { consultation_id, client_id } = req.params;
    try {
      const result = await client.query(
        `SELECT * FROM reviews WHERE consultation_id = $1 AND client_id = $2`,
        [consultation_id, client_id]
      );
      if (result.rows.length === 0) {
        // Return 200 with a custom payload instead of 404
        return res.json({ exists: false, review: null });
      }
      res.json({ exists: true, review: result.rows[0] });
    } catch (err) {
      console.error('Error fetching review:', err);
      res.status(500).json({ error: 'Failed to fetch review' });
    }
  });
  
  app.get('/api/notifications/client', async (req, res) => {
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).json({ error: 'Missing user_id' });
    }
    try {
      const query = `
        SELECT n.*, l.first_name AS attorney_first_name, l.last_name AS attorney_last_name
        FROM notifications n
        LEFT JOIN lawyers l ON n.sender = l.lawyer_id
        WHERE n.receiver = $1
          AND n.notification_purpose IN ('rejected', 'approved', 'reschedule', 'approved_online', 'payment_denied', 'payment_confirmed')
        ORDER BY n.date DESC, n.time DESC
      `;
      const params = [user_id];
      const { rows } = await client.query(query, params);
      res.json(rows);
    } catch (err) {
      console.error('Error fetching client notifications:', err);
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  });
  
  // GET notifications for a lawyer
  app.get('/api/notifications/lawyer', async (req, res) => {
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).json({ error: 'Missing user_id' });
    }
    try {
      // Join with clients and secretary table to get names for notifications
      const query = `
        SELECT n.*, c.first_name AS client_first_name, c.last_name AS client_last_name,
          s.first_name AS secretary_first_name, s.last_name AS secretary_last_name
        FROM notifications n
        LEFT JOIN clients c ON n.sender = c.client_id
        LEFT JOIN secretary s ON (n.sender = s.secretary_id AND n.notification_purpose = 'application') OR (n.receiver = s.secretary_id AND n.notification_purpose = 'application_accepted')
        WHERE n.receiver = $1
          AND n.notification_purpose IN ('application', 'request', 'paid', 'application_accepted')
        ORDER BY n.date DESC, n.time DESC
      `;
      const params = [user_id];
      const { rows } = await client.query(query, params);
      res.json(rows);
    } catch (err) {
      console.error('Error fetching lawyer notifications:', err);
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  });
  
  // GET notifications for a secretary
  app.get('/api/notifications/secretary', async (req, res) => {
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).json({ error: 'Missing user_id' });
    }
    try {
      // Get all lawyer_ids managed by this secretary
      const managedLawyersRes = await client.query(
        'SELECT lawyer_id FROM secretary_lawyers WHERE secretary_id = $1 AND work_status = $2',
        [user_id, 'Approved']
      );
      const lawyerIds = managedLawyersRes.rows.map(row => row.lawyer_id);
      
      // Get notifications where secretary is receiver (application_accepted, application_rejected)
      // AND notifications for managed lawyers (request, etc.)
      const query = `
        SELECT n.*, l.first_name AS lawyer_first_name, l.last_name AS lawyer_last_name,
          s.first_name AS secretary_first_name, s.last_name AS secretary_last_name
        FROM notifications n
        LEFT JOIN lawyers l ON n.sender = l.lawyer_id
        LEFT JOIN secretary s ON n.receiver = s.secretary_id
        WHERE (n.receiver = $1 AND n.notification_purpose IN ('application_accepted', 'application_rejected'))
           OR (n.receiver = ANY($2) AND n.notification_purpose IN ('request'))
        ORDER BY n.date DESC, n.time DESC
      `;
      const params = [user_id, lawyerIds];
      const { rows } = await client.query(query, params);
      res.json(rows);
    } catch (err) {
      console.error('Error fetching secretary notifications:', err);
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  });
  
  // PATCH: Reschedule a consultation and notify client
  app.patch('/api/consultations-reschedule/:consultation_id', async (req, res) => {
    const consultation_id = parseInt(req.params.consultation_id, 10);
    const { consultation_date, consultation_time } = req.body;
  
    if (isNaN(consultation_id) || !consultation_date || !consultation_time) {
      return res.status(400).json({ error: 'Invalid input' });
    }
  
    try {
      // Update consultation date and time
      const updateResult = await client.query(
        `UPDATE consultation
         SET consultation_date = $1, consultation_time = $2
         WHERE consultation_id = $3
         RETURNING *`,
        [consultation_date, consultation_time, consultation_id]
      );
      if (updateResult.rowCount === 0) {
        return res.status(404).json({ error: 'Consultation not found' });
      }
      const updatedConsult = updateResult.rows[0];
  
      // Get lawyer_id and client_id from consultation
      const consultRes = await client.query(
        'SELECT lawyer_id, client_id FROM consultation WHERE consultation_id = $1',
        [consultation_id]
      );
      if (consultRes.rowCount === 0) {
        return res.status(404).json({ error: 'Consultation not found' });
      }
      const { lawyer_id, client_id } = consultRes.rows[0];
  
      // Insert notification
      await client.query(
        `INSERT INTO notifications (consultation_id, notification_status, sender, receiver, date, time, notification_purpose)
         VALUES ($1, $2, $3, $4, CURRENT_DATE, CURRENT_TIME, $5)`,
        [consultation_id, 'unread', lawyer_id, client_id, 'reschedule']
      );
  
      res.status(200).json({ message: 'Consultation rescheduled and notification sent', consultation: updatedConsult });
    } catch (err) {
      console.error('Reschedule error:', err);
      res.status(500).json({ error: 'Failed to reschedule consultation' });
    }
  });
  
  // --- Payment Proof Upload (Client uploads proof of payment) ---
  app.post('/api/payments/upload', paymentProofUpload.single('proof'), async (req, res) => {
    const { consultation_id, client_id, lawyer_id } = req.body;
    const proof = req.file ? req.file.buffer : null;
    const payment_date = new Date();
  
    try {
      // Insert payment receipt
      const result = await client.query(
        `INSERT INTO payment_receipt (consultation_id, payment_date, proof)
         VALUES ($1, $2, $3) RETURNING payment_id`,
        [consultation_id, payment_date, proof]
      );
      // Keep consultation status as Unpaid (don't change to Upcoming automatically)
      // Notify lawyer about payment receipt
      const clientNameResult = await client.query(
        `SELECT first_name, last_name FROM clients WHERE client_id = $1`, [client_id]
      );
      const client_name = clientNameResult.rows.length > 0 ? `${clientNameResult.rows[0].first_name} ${clientNameResult.rows[0].last_name}` : 'A client';
      await client.query(
        `INSERT INTO notifications (sender, receiver, date, time, notification_purpose, notification_status, consultation_id)
         VALUES ($1, $2, CURRENT_DATE, CURRENT_TIME, $3, 'unread', $4)` ,
        [client_id, lawyer_id, 'payment_receipt', consultation_id]
      );
      res.json({ success: true, payment_id: result.rows[0].payment_id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: 'Database error' });
    }
  });
  
  // --- Serve Payment Proof Image (for Receipt viewing) ---
  app.get('/api/payments/proof/:payment_id', authenticateJWT, async (req, res) => {
    const { payment_id } = req.params;
    try {
      const result = await client.query(
        `SELECT proof FROM payment_receipt WHERE payment_id = $1`,
        [payment_id]
      );
      if (!result.rows.length || !result.rows[0].proof) {
        return res.status(404).send('No proof found');
      }
      res.set('Content-Type', 'image/jpeg'); // or detect type if you store it
      res.send(result.rows[0].proof);
    } catch (err) {
      console.error(err);
      res.status(500).send('Database error');
    }
  });
  
  // --- Attorney Confirms Payment Receipt ---
  app.post('/api/payments/confirm', async (req, res) => {
    const { consultation_id, client_id, lawyer_id } = req.body;
    try {
      // Update consultation status to Upcoming
      await client.query(
        `UPDATE consultation SET consultation_status = 'Upcoming' WHERE consultation_id = $1`,
        [consultation_id]
      );
      // Notify client
      const lawyerNameResult = await client.query(
        `SELECT first_name, last_name FROM lawyers WHERE lawyer_id = $1`, [lawyer_id]
      );
      const lawyer_name = lawyerNameResult.rows.length > 0 ? `${lawyerNameResult.rows[0].last_name}` : 'Attorney';
      await client.query(
        `INSERT INTO notifications (sender, receiver, date, time, notification_purpose, notification_status, consultation_id)
         VALUES ($1, $2, CURRENT_DATE, CURRENT_TIME, $3, 'unread', $4)` ,
        [lawyer_id, client_id, 'payment_confirmed', consultation_id]
      );
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: 'Database error' });
    }
  });
  
  // --- Attorney Denies Payment Receipt ---
  app.post('/api/payments/deny', async (req, res) => {
    const { consultation_id, client_id, lawyer_id } = req.body;
    try {
      // Delete the payment receipt
      await client.query(
        `DELETE FROM payment_receipt WHERE consultation_id = $1`,
        [consultation_id]
      );
      // Notify client
      const lawyerNameResult = await client.query(
        `SELECT first_name, last_name FROM lawyers WHERE lawyer_id = $1`, [lawyer_id]
      );
      const lawyer_name = lawyerNameResult.rows.length > 0 ? `${lawyerNameResult.rows[0].last_name}` : 'Attorney';
      await client.query(
        `INSERT INTO notifications (sender, receiver, date, time, notification_purpose, notification_status, consultation_id)
         VALUES ($1, $2, CURRENT_DATE, CURRENT_TIME, $3, 'unread', $4)` ,
        [lawyer_id, client_id, 'payment_denied', consultation_id]
      );
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: 'Database error' });
    }
  });
  
  // --- Mark Consultation as Completed_Paid ---
  app.post('/api/consultations/complete-paid/:consultation_id', async (req, res) => {
    const consultation_id = parseInt(req.params.consultation_id, 10);
    if (isNaN(consultation_id)) {
      return res.status(400).json({ error: 'Invalid consultation ID' });
    }
    try {
      const result = await client.query(
        `UPDATE consultation SET consultation_status = 'Completed_Paid' WHERE consultation_id = $1 RETURNING *`,
        [consultation_id]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Consultation not found' });
      }
      res.json({ message: 'Consultation marked as Completed_Paid', consultation: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to update consultation status' });
    }
  });
  
  // --- Update Consultation Filters for Ongoing and Completed ---
  // (Update your frontend queries to include 'Upcoming-Paid' for ongoing and 'Completed_Paid' for completed)
  // Example for ongoing:
  // WHERE consultation_status IN ('Upcoming', 'Upcoming-Paid', ...)
  // Example for completed:
  // WHERE consultation_status IN ('Completed', 'Completed_Paid', ...)
  
  // --- Serve Receipt by Consultation ID (get payment_id by consultation_id) ---
  app.get('/api/payments/receipt/:consultation_id', async (req, res) => {
    const { consultation_id } = req.params;
    try {
      const result = await client.query(
        `SELECT payment_id FROM payment_receipt WHERE consultation_id = $1`,
        [consultation_id]
      );
      if (!result.rows.length) {
        return res.status(404).json({ error: 'No receipt found' });
      }
      res.json({ payment_id: result.rows[0].payment_id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });
  
  // PATCH: Mark notification as read
  app.patch('/api/notifications/:notification_id/read', async (req, res) => {
    const { notification_id } = req.params;
    try {
      await client.query(
        'UPDATE notifications SET notification_status = $1 WHERE notification_id = $2',
        ['read', notification_id]
      );
      res.json({ success: true });
    } catch (err) {
      console.error('Error marking notification as read:', err);
      res.status(500).json({ success: false, error: 'Database error' });
    }
  });
  
  // Start the server
  app.listen(5500, () => {
    console.log("Server running on port 5500");
  });
  
  })();