import { Router } from 'express'
import {
  getLawyerRoleId,
  updateLawyerProfile,
  getPrivateLawyers,
  updatePublicLawyerStatus,
  updatePrivateLawyerStatus,
  changeLawyerPassword,
  getLawyerAvailability,
  createLawyerAvailability,
  getLawyerServicesByLawyerId,
  updateLawyerServices,
  uploadProfilePicture,
  getLawyerDetails,
  getLawyerDetailsById,
  getLawyerAvailabilityByLawyerId,
  getLawyerConsultationFeeRate,
  getLawyerServices,
  getLawyerConsultation,
  getLogTrailsByLawyerId,
  saveNotesAndRecommendation,
  getLawyerNotes,
  getPublicLawyers,
  getLawyerReviews,
  getLawyers,
  getLawyerSetup
} from './lawyers.service.js'
import { upload } from '../../middlewares/multer.js'

const router = Router()

router.get('/lawyers', getLawyers)
router.get('/public-lawyers', getPublicLawyers)
router.put('/public-lawyers/:lawyer_id/status', updatePublicLawyerStatus) //* see html frontned, this route has no `/ap/` prefix
router.get('/private-lawyers', getPrivateLawyers)
router.put('/private-lawyers/:lawyer_id/status', updatePrivateLawyerStatus) //* see html frontned, this route has no `/ap/` prefix
router.get('/lawyer/:id/availability', getLawyerAvailability)
router.post('/lawyer/:id/availability', createLawyerAvailability)
router.get('/lawyer/:roleId/services', getLawyerServicesByLawyerId)
router.post('/lawyer/:roleId/services', updateLawyerServices)
router.post('/lawyer/upload-profile-picture/:lawyer_id', upload.single('file'), uploadProfilePicture)
router.get('/lawyer-details/:lawyerId', getLawyerDetails)
router.get('/lawyer_availability/:lawyerId', getLawyerAvailabilityByLawyerId)
router.get('/lawyer_services/:lawyerId', getLawyerConsultationFeeRate)
router.get('/lawyer-services', getLawyerServices)
router.get('/lawyer/:lawyerId/reviews', getLawyerReviews)
router.get('/lawyer/by-role/:roleId', getLawyerRoleId)
router.put('/lawyer/update/:lawyerId', updateLawyerProfile)
router.post('/change-password-lawyer/:roleId', changeLawyerPassword)
router.get('/lawyers/:lawyerId', getLawyerDetailsById)
router.get('/lawyers/:lawyerId/consultations', getLawyerConsultation)
router.get('/lawyers/:lawyerId/logs', getLogTrailsByLawyerId)
router.post('/lawyer-notes', saveNotesAndRecommendation)
router.get('/lawyer-notes-view/:consultation_id', getLawyerNotes)
router.get('/lawyer/:id/setup', getLawyerSetup)


export default router
