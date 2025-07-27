import client from '../../connection.js'

// POST: Add a new review
export async function addReview(req, res) {
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
};

// PUT: Edit an existing review
export async function updateReviewById(req, res) {
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
};


// PUT: Edit an existing review
export async function updateReview(req, res) {
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
};

// GET: Get review for a consultation by client
export async function getReviewByConsultationAndClient(req, res) {
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
};