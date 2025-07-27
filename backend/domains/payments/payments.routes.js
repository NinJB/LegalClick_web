import { Router } from "express";
import { paymentProofUpload } from '../../middlewares/multer.js';

import { uploadPaymentProof, uploadPaymentProofById, confirmPaymentFromAttorny, getPaymentProofByConsultationId } from "./payments.service.js";

const router = Router();

router.post('/payments/upload', paymentProofUpload.single('proof'), uploadPaymentProof)
router.get('/payments/proof/:payment_id', uploadPaymentProofById)
router.post('/payments/confirm', confirmPaymentFromAttorny)
router.post('/payments/receipt/:consultation_id', getPaymentProofByConsultationId)

export default router
