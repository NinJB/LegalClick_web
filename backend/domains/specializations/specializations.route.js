import { Router } from "express";

import {
  addSpecializationsByRoleId,
  addSpecializations,
  deleteSpecialization,
  getSpecializations,
  getAllSpecializations,
  getLawyerSpecializations
} from './specializations.service.js'

const router = Router();

router.post('/lawyer/:role_id/specializations', addSpecializationsByRoleId)
router.post('/add-specializations', addSpecializations)
router.delete('/delete-specializations/:id', deleteSpecialization)
router.get('/view-specializations', getSpecializations)
router.get('/specializations', getAllSpecializations)
router.get('/lawyer/:id/specializations', getLawyerSpecializations)

export default router;