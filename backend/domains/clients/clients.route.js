import { Router } from "express";
import { signup, signupClients, getClientById, changePasswordClient, getClientByRole, updateClient } from "./clients.service.js";
import { upload } from "../../middlewares/multer.js";

const router = Router();

router.post('/signup', upload.single('attorney_license'), signup); //* undocumented route change
router.post('/signup-clients', upload.single('national_id'), signupClients); //* undocumented route change
router.post('/change-password-client/:roleId', changePasswordClient); //* undocumented route change
router.get('/client/by-role/:roleId', getClientByRole); //* undocumented route change
router.put('/client/update/:client_id', updateClient); //* undocumented route change
router.get('/clients/:roleId', getClientById);

//* no delete

export default router;