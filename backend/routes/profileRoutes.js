import express from "express";
import {
  getProfile,
  getMyGigs,
  getMyBids,
  getBidsOnMyGigs,
  getProfileStats
} from "../controllers/profileController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

/* ---------- Profile Info ---------- */
router.get("/", protect, getProfile);

/* ---------- My Posted Gigs ---------- */
router.get("/gigs", protect, getMyGigs);

/* ---------- My Bids ---------- */
router.get("/bids", protect, getMyBids);

/* ---------- Bids Received On My Gigs ---------- */
router.get("/received-bids", protect, getBidsOnMyGigs);

/* ---------- Profile Statistics ---------- */
router.get("/stats", protect, getProfileStats);

export default router;