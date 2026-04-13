import express from "express";
import { createGig, getGigs, getGigById, deleteGig, updateGig, getGigBidStatus } from "../controllers/gigController.js";
import { protect } from "../middleware/authMiddleware.js";
import upload from "../middleware/upload.js";

const router = express.Router();

router.post("/", protect, upload.single("image"), createGig);
router.get("/", getGigs);
router.get("/:id/bid-status", protect, getGigBidStatus); // ✅ must be before /:id
router.get("/:id", getGigById);
router.delete("/:id", protect, deleteGig);
router.put("/:id", protect, upload.single("image"), updateGig);

export default router;