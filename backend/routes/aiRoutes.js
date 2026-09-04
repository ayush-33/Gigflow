import express from "express";
import { generateGigDescription, suggestSkills } from "../controllers/aiController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/generate-gig-description", protect, generateGigDescription);
router.post("/suggest-skills", protect, suggestSkills);

export default router;
