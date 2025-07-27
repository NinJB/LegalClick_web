import { Router } from "express";

import { changeAdminPassword, addAdmin, getAdminbyRole, updateAdmin } from "./admins.service.js";

const router = Router();

router.post("/change-password-admin/:roleId", changeAdminPassword) //* route undocumented
router.get("/admin/by-role/:roleId", getAdminbyRole) //* route undocumented
router.put("/admin/update/:adminId", updateAdmin) //* route undocumented
router.post("/add-admin", addAdmin)

//* no delete


export default router;