import express from "express";
import {
  getMyChatRooms,
  getRoomMessages,
  updateOfferStatus,
} from "../controllers/chatController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/rooms",                       protect, getMyChatRooms);
router.get("/rooms/:roomId/messages",      protect, getRoomMessages);
router.put("/messages/:messageId/offer",   protect, updateOfferStatus);

export default router;