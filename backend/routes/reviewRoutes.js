import express from "express";
import {
  createReview, getReviewsByGig, getReviewsBySeller, checkCanReview, getMyReviews
} from "../controllers/reviewController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/",                          protect, createReview);
router.get("/my-reviews",                 protect, getMyReviews);
router.get("/gig/:gigId",                 getReviewsByGig);
router.get("/seller/:sellerId",           getReviewsBySeller);
router.get("/can-review/:gigId",          protect, checkCanReview);

export default router;