import fs from 'fs';
import client from '../../connection.js';

// POST New Consultation Booking
export async function createConsultation(req, res) {
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
};

export async function getConsultationsByClientId(req, res) {
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
};

export async function getConsultationsByLawyerId(req, res) {
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
};

export async function patchConsultationStatus(req, res) {
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
      let purpose = '';
      if (consultation_status === 'Rejected') purpose = 'rejected';
      else if (consultation_status === 'Upcoming' || consultation_status === 'Unpaid') purpose = 'approved';
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
};

export async function updateConsultationStatus(req, res) {
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
};


// PATCH: Reschedule a consultation and notify client
export async function rescheduleConsultation(req, res) {
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
};


// --- Mark Consultation as Completed_Paid ---
export async function updateConsultationStatusToComplete(req, res) {
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
};
