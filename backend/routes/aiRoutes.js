import express from "express";
import {
  generateGigDescription,
  suggestSkills,
  generateProposal
} from "../controllers/aiController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/generate-gig-description", protect, generateGigDescription);
router.post("/suggest-skills", protect, suggestSkills);
router.post("/generate-proposal", protect, generateProposal);

export default router;

