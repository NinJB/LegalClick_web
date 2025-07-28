import express from 'express';
import cors from 'cors'

import client from './connection.js';
// import { hashPassword } from './hash-passwords';

import bcrypt from 'bcrypt';
import cron from 'node-cron';

// routes
import addminRoutes from './domains/admins/admins.route.js';
import clientsRoutes from './domains/clients/clients.route.js'
import consultationRoutes from './domains/consultation/consultation.route.js'
import lawyerRoutes from './domains/lawyers/lawyers.routes.js'
import notificationRoutes from './domains/notifications/notifications.routes.js'
import reviewRoutes from './domains/reviews/reviews.routes.js'
import payementRoutes from './domains/payments/payments.routes.js'
import secretariesRoutes from './domains/secretaries/secretaries.routes.js'
import authRoutes from './domains/auth/auth.route.js'
import specializationRoutes from './domains/specializations/specializations.route.js'

import { JWT_SECRET, jwt } from './domains/configs/JWT.config.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
const protectedRoutes = [
  // All routes that need authentication
  // GET
  ['/api/lawyers', 'get'],
  ['/api/public-lawyers', 'get'],
  ['/api/private-lawyers', 'get'],
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
  ['/api/consultations', 'get'],
  ['/api/consultations-client', 'get'],
  ['/api/consultations-lawyer', 'get'],
  ['/consultations', 'get'],
  ['/api/lawyer-services', 'get'],
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
  ['/api/payments/proof/:payment_id', 'get'],
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
  ['/api/payments/deny', 'post'],
  ['/api/consultations/complete-paid/:consultation_id', 'post'],
  // PUT
  ['/api/public-lawyers/:lawyer_id/status', 'put'],
  ['/api/private-lawyers/:lawyer_id/status', 'put'],
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
protectedRoutes.forEach(([route, method]) => {
  app[method](route, authenticateJWT);
});

const apiVersion = '/api';

app.use(apiVersion, addminRoutes)
app.use(apiVersion, clientsRoutes)
app.use(apiVersion, consultationRoutes)
app.use(apiVersion, lawyerRoutes)
app.use(apiVersion, notificationRoutes)
app.use(apiVersion, reviewRoutes)
app.use(apiVersion, payementRoutes)
app.use(apiVersion, secretariesRoutes)
app.use(apiVersion, authRoutes)
app.use(apiVersion, specializationRoutes)

// Start the server
app.listen(5500, () => {
  console.log("Server running on port 5500");
});
