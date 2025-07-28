import { Router } from "express";
import { upload } from '../../middlewares/multer.js';

import { loginUser, checkUsername, getAdminbyRole, signupLawyer } from "./auth.service.js";

const router = Router();

router.post('/login', loginUser)
router.post('/check-username', checkUsername)
router.post('/admins/role/:adminId', getAdminbyRole)
router.post('/signup', upload.single('attorney_license'), signupLawyer)

export default router