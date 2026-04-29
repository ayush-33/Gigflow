import express from "express";
import {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications
} from "../controllers/notificationController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/",                       protect, getMyNotifications);
router.put("/mark-all-read",          protect, markAllAsRead);       // before /:id routes
router.delete("/clear-all",           protect, clearAllNotifications); // ✅ NEW
router.put("/:id/read",               protect, markAsRead);
router.delete("/:id/delete",          protect, deleteNotification);  // ✅ NEW

export default router;