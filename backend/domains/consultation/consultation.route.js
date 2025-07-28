import { Router } from "express";
import { upload } from '../../middlewares/multer.js'
import { createConsultation,getConsultationsByClientId, updateConsultationStatus, getConsultationsByLawyerId, patchConsultationStatus, rescheduleConsultation, updateConsultationStatusToComplete } from "./consultation.service.js";

const router = Router();

router.post('/consultation', upload.none(), createConsultation);
router.get('/consultations-client', getConsultationsByClientId);
router.get('/consultations-lawyer', getConsultationsByLawyerId);
router.patch('/consultations-update/:consultation_id', patchConsultationStatus);
router.post('/consultations-update/:id', updateConsultationStatus);
router.patch('/consultations-reschedule/:consultation_id', rescheduleConsultation);
router.post('/consultations/complete-paid/:consultation_id', updateConsultationStatusToComplete);

//* no delete
export default router;