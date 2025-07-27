import client from '../../connection.js'

export async function getNotificationsForClient(req, res) {
  const { user_id } = req.query;
  if (!user_id) {
    return res.status(400).json({ error: 'Missing user_id' });
  }
  try {
    const query = `
      SELECT * FROM notifications
      WHERE receiver = $1
        AND notification_purpose IN ('rejected', 'approved', 'reschedule')
      ORDER BY date DESC, time DESC
    `;
    const params = [user_id];
    const { rows } = await client.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching client notifications:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

// GET notifications for a lawyer
export async function getNotificationsForLawyer(req, res) {
  const { user_id } = req.query;
  if (!user_id) {
    return res.status(400).json({ error: 'Missing user_id' });
  }
  try {
    // Join with clients table to get client name for 'request' notifications
    const query = `
      SELECT n.*, c.first_name AS client_first_name, c.last_name AS client_last_name
      FROM notifications n
      LEFT JOIN clients c ON n.sender = c.client_id
      WHERE n.receiver = $1
        AND n.notification_purpose IN ('application', 'request', 'paid')
      ORDER BY n.date DESC, n.time DESC
    `;
    const params = [user_id];
    const { rows } = await client.query(query, params);
    // console.log('Lawyer notifications:', rows); // Debug log removed
    res.json(rows);
  } catch (err) {
    console.error('Error fetching lawyer notifications:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

// GET notifications for a secretary
export async function getNotificationsForSecretary(req, res) {
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
    if (lawyerIds.length === 0) {
      return res.json([]); // No managed lawyers, no notifications
    }
    // Get notifications for those lawyer_ids
    const query = `
      SELECT * FROM notifications
      WHERE receiver = ANY($1)
        AND notification_purpose IN ('application', 'request')
      ORDER BY date DESC, time DESC
    `;
    const params = [lawyerIds];
    const { rows } = await client.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching secretary notifications:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

// PATCH: Mark notification as read
export async function patchNotifications(req, res) {
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
};