import { Router } from "express";

import { loginUser, checkUsername, getAdminbyRole } from "./auth.service.js";

const router = Router();

router.post('/login', loginUser)
router.post('/check-username', checkUsername)
router.post('/admins/role/:adminId', getAdminbyRole)


export default router