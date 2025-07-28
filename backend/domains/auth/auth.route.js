import { Router } from "express";
import { upload } from '../../middlewares/multer.js';

import { loginUser, checkUsername, signupLawyer } from "./auth.service.js";

const router = Router();

router.post('/login', loginUser)
router.post('/check-username', checkUsername)
router.post('/signup', upload.single('attorney_license'), signupLawyer)

export default router