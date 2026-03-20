import express from "express";
import { createGig, getGigs } from "../controllers/gigController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, createGig);
router.get("/", getGigs);

export default router;
