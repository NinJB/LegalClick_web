import { Router } from 'express'

import { getNotificationsForClient, getNotificationsForLawyer, getNotificationsForSecretary, patchNotifications } from './notifications.service.js';

const router = Router();

router.get('/notifications/client', getNotificationsForClient)
router.get('/notifications/lawyer', getNotificationsForLawyer)
router.get('/notifications/secretary', getNotificationsForSecretary)
router.patch('/notifications/:notification_id/read', patchNotifications)


export default router;