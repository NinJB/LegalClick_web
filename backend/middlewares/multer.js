import multer from 'multer';

// export const upload = multer({ dest: '../uploads/' });
export const upload = multer({ dest: 'backend/uploads' }); //* docker requirement, needs to be fixed later to be stateful

// --- Payment Proof Upload (Client uploads proof of payment) ---
export const paymentProofUpload = multer({ storage: multer.memoryStorage() });

