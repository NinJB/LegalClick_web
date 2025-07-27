import { Router } from 'express'

import { addReview, updateReview, updateReviewById, getReviewByConsultationAndClient } from './reviews.service.js';

const router = Router();

router.post('/reviews', addReview)
router.put('/reviews/:review_id', updateReviewById)


router.put('/reviews/:review_id', updateReview)
router.get('/reviews/consultation/:consultation_id/client/:client_id', getReviewByConsultationAndClient)


export default router;