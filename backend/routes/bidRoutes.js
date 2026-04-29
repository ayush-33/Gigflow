import express from "express";
import {
  createBid,
  getBidsByGig,
  checkUserBid,
  acceptBid,
  rejectBid,
  withdrawBid
} from "../controllers/bidController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/",                    protect, createBid);
router.get("/check/:gigId",         protect, checkUserBid);   // must be before /:gigId
router.get("/:gigId",               protect, getBidsByGig);

router.put("/accept/:bidId",        protect, acceptBid);
router.put("/reject/:bidId",        protect, rejectBid);

// ✅ FIX: was PUT, must be DELETE to match Profile.jsx's doAction call
router.delete("/withdraw/:bidId",   protect, withdrawBid);

export default router;