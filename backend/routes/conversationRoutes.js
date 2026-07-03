import express from "express";
import {
  getMyChatRooms,
  getRoomMessages,
  updateOfferStatus,
  getUnreadMessageCount,
  getConversationDetails,
} from "../controllers/chatController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/unread-count",                protect, getUnreadMessageCount);
router.get("/",                            protect, getMyChatRooms);
router.get("/:roomId",                     protect, getConversationDetails);
router.get("/:roomId/messages",            protect, getRoomMessages);
router.put("/messages/:messageId/offer",   protect, updateOfferStatus);

export default router;
