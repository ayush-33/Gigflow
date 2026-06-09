import express from 'express';
import { completeOrder } from '../controllers/orderController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/complete', protect, completeOrder);

export default router;
