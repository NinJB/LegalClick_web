import client from '../../connection.js';

// --- Payment Proof Upload (Client uploads proof of payment) ---
export async function uploadPaymentProof(req, res) {
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
    // Update consultation status to Pending-Paid
    await client.query(
      `UPDATE consultation SET consultation_status = 'Pending-Paid' WHERE consultation_id = $1`,
      [consultation_id]
    );
    // Notify lawyer
    const clientNameResult = await client.query(
      `SELECT first_name, last_name FROM clients WHERE client_id = $1`, [client_id]
    );
    const client_name = clientNameResult.rows.length > 0 ? `${clientNameResult.rows[0].first_name} ${clientNameResult.rows[0].last_name}` : 'A client';
    await client.query(
      `INSERT INTO notifications (sender, receiver, date, time, notification_purpose, notification_status, consultation_id)
       VALUES ($1, $2, CURRENT_DATE, CURRENT_TIME, $3, 'unread', $4)` ,
      [client_id, lawyer_id, 'paid', consultation_id]
    );
    res.json({ success: true, payment_id: result.rows[0].payment_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Database error' });
  }
};

// --- Serve Payment Proof Image (for Receipt viewing) ---
export async function uploadPaymentProofById(req, res) {
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
};

// --- Attorney Confirms Payment ---
export async function confirmPaymentFromAttorny(req, res) {
  const { consultation_id, client_id, lawyer_id } = req.body;
  try {
    // Update consultation status to Upcoming-Paid
    await client.query(
      `UPDATE consultation SET consultation_status = 'Upcoming-Paid' WHERE consultation_id = $1`,
      [consultation_id]
    );
    // Notify client
    const lawyerNameResult = await client.query(
      `SELECT first_name, last_name FROM lawyers WHERE lawyer_id = $1`, [lawyer_id]
    );
    const lawyer_name = lawyerNameResult.rows.length > 0 ? `${lawyerNameResult.rows[0].first_name} ${lawyerNameResult.rows[0].last_name}` : 'The attorney';
    await client.query(
      `INSERT INTO notifications (sender, receiver, date, time, notification_purpose, notification_status, consultation_id)
       VALUES ($1, $2, CURRENT_DATE, CURRENT_TIME, $3, 'unread', $4)` ,
      [lawyer_id, client_id, `Atty. ${lawyer_name} has approved your consultation. Please proceed to payment.`, consultation_id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Database error' });
  }
};

// --- Serve Receipt by Consultation ID (get payment_id by consultation_id) ---
export async function getPaymentProofByConsultationId(req, res) {
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
};