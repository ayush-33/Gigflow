import express from "express";
import { createBid, getBidsByGig } from "../controllers/bidController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, createBid);
router.get("/:gigId", protect, getBidsByGig);

export default router;
