import { Router } from "express";
import { upload } from "../../middlewares/multer.js";

import {
  changePasswordSecretary,
  signupSecretary,
  createRequestBySecretaryId,
  getSecretaryLawyers,
  getSecretaryById,
  updateProfile,
  getRequestsBySecretaryId,
  deleteRequest,
  getRequestsByLawyerId,
  updateRequestStatus,
  deleteRequestOnApproveOrRejectById,
  getSecretaryLawyersBySecId
} from './secreteries.service.js'

const router = Router();

router.post("/change-password-secretary/:roleId", changePasswordSecretary);
router.post("/signup-secretary", upload.none(), signupSecretary);
router.post("/secretary-lawyers", createRequestBySecretaryId);
router.get("/check-secretary-lawyers", getSecretaryLawyers);
router.get("/secretary/by-role/:role_id", getSecretaryById);
router.put("/secretary/update/:secretary_id", updateProfile);
router.get("/secretary/:id/requests", getRequestsBySecretaryId);
router.delete("/secretary/requests/:work_id", deleteRequest);
router.get("/lawyer/:lawyer_id/requests", getRequestsByLawyerId);
router.put("/secretary/requests/:work_id", updateRequestStatus);
router.delete("/secretary/requests/:work_id", deleteRequestOnApproveOrRejectById);
router.get("/secretary-lawyers-view/:secretaryId", getSecretaryLawyersBySecId);


export default router;
