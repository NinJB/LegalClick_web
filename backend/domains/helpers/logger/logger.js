import client from "../../../connection.js";

// Log trail function to record login attempts
export async function logTrail(role, userId, type, status) {
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