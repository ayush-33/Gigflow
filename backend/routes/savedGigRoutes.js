import express from "express";
import { toggleSavedGig, getMySavedGigs, getSavedGigIds } from "../controllers/savedGigController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();
router.post("/toggle",  protect, toggleSavedGig);
router.get("/",         protect, getMySavedGigs);
router.get("/ids",      protect, getSavedGigIds);

export default router;