import express from "express";
import {
  createReview, getReviewsByGig, getReviewsBySeller, checkCanReview
} from "../controllers/reviewController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/",                          protect, createReview);
router.get("/gig/:gigId",                 getReviewsByGig);
router.get("/seller/:sellerId",           getReviewsBySeller);
router.get("/can-review/:gigId",          protect, checkCanReview);

export default router;