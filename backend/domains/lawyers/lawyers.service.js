import fs from 'fs';
import client from '../../connection.js';
import bcrypt from 'bcrypt';

// GET all lawyers
export async function getPublicLawyers(req, res) {
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
};

// PUT update lawyer's account status
export async function updatePublicLawyerStatus(req, res) {
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
};

// GET all private lawyers
export async function getPrivateLawyers(req, res) {
  const query = `SELECT *, encode(attorney_license, 'base64') as attorney_license FROM lawyers WHERE attorney_category = 'Private'`;

  client.query(query, (err, result) => {
    if (err) {
      console.error('Error fetching lawyers:', err.message);
      return res.status(500).json({ error: 'Error fetching lawyers' });
    }

    res.json(result.rows);
  });
};

// PUT update private lawyer's account status
export async function updatePrivateLawyerStatus(req, res) {
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
};

export async function changeLawyerPassword(req, res) {
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
};


// GET lawyer availability
export async function getLawyerAvailability(req, res) {
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
};

// POST availability
export async function createLawyerAvailability(req, res) {
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
};

export async function getLawyerServicesByLawyerId(req, res) {
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
};

// POST (insert or update) lawyer services
export async function updateLawyerServices(req, res) {
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
};

export async function uploadProfilePicture(req, res) {
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
};

export async function getLawyerDetails(req, res) {
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
};

export async function getLawyerDetailsById(req, res) {
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
};

// GET Lawyer Availability
export async function getLawyerAvailabilityByLawyerId(req, res) {
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
};

// GET Consultation Fee Rate
export async function getLawyerConsultationFeeRate(req, res) {
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
};

export async function getLawyerServices(req, res) {
  try {
    const result = await client.query('SELECT * FROM lawyer_services');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching lawyer services:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


// Fetch consultations for a lawyer
export async function getLawyerConsultation(req, res) {
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
};

// Fetch log trails for a lawyer
export const getLogTrailsByLawyerId = async (req, res) => {
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
};


// 2. Save notes and recommendation
export async function saveNotesAndRecommendation(req, res) {
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
};

// 3. Fetch notes & recommendation for a completed consultation
export async function getLawyerNotes(req, res) {
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
};

// GET reviews for a lawyer (with client username and average rating)
export async function getLawyerReviews(req, res) {
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
};

export async function getLawyers(req, res) {
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
};

export async function getLawyerRoleId(req, res) {
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
};

// Update lawyer profile
export async function updateLawyerProfile(req, res) {
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
};

export async function getLawyerSetup(req, res) {
  const lawyerId = req.params.id;
  try {
    // Get specializations
    const specResult = await client.query(
      'SELECT specialization_id FROM lawyer_specializations WHERE lawyer_id = $1',
      [lawyerId]
    );
    const specializations = specResult.rows.map(row => row.specialization_id);

    // Get availability
    const availResult = await client.query(
      'SELECT morning_start, morning_end, evening_start, evening_end, workday_start, workday_end FROM lawyer_availability WHERE lawyer_id = $1',
      [lawyerId]
    );
    const availability = availResult.rows[0] || null;

    // Get services
    const servResult = await client.query(
      'SELECT consultation, representation_min, representation_max FROM lawyer_services WHERE lawyer_id = $1',
      [lawyerId]
    );
    const services = servResult.rows[0] || null;

    res.json({
      specializations,
      availability,
      services
    });
  } catch (err) {
    console.error('Error fetching lawyer setup:', err);
    res.status(500).json({ error: 'Failed to fetch lawyer setup' });
  }
}