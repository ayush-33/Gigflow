import express from "express";
import {
  getProfile,
  updateProfile,
  getMyGigs,
  getMyBids,
  getBidsOnMyGigs,
  getProfileStats
} from "../controllers/profileController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/",                 protect, getProfile);
router.put("/update",           protect, updateProfile);   // ✅ NEW — was missing
router.get("/gigs",             protect, getMyGigs);
router.get("/bids",             protect, getMyBids);
router.get("/received-bids",    protect, getBidsOnMyGigs);
router.get("/stats",            protect, getProfileStats);

export default router;