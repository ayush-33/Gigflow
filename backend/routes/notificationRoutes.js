import express from "express";
import { getMyNotifications, markAsRead, markAllAsRead } from "../controllers/notificationController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", protect, getMyNotifications);
router.put("/mark-all-read", protect, markAllAsRead);  // ✅ moved above /:id/read
router.put("/:id/read", protect, markAsRead);

export default router;