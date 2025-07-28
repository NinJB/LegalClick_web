import { Router } from "express";

import { changeAdminPassword, addAdmin, getAdminbyRole, updateAdmin, getAdminsByRole } from "./admins.service.js";

const router = Router();

router.post("/change-password-admin/:roleId", changeAdminPassword) //* route undocumented
router.get("/admin/by-role/:roleId", getAdminbyRole) //* route undocumented
router.put("/admin/update/:adminId", updateAdmin) //* route undocumented
router.post("/add-admin", addAdmin)
router.get("/admins/by-role/:roleId", getAdminsByRole);

//* no delete


export default router;