import express from "express";
import {
  createGig,
  getGigs,
  getGigById,
  deleteGig,
  updateGig,
  getGigBidStatus,
  startWork,
  submitWork,
  approveWork,
  requestChanges
} from "../controllers/gigController.js";
import { protect } from "../middleware/authMiddleware.js";
import upload from "../middleware/upload.js";

const router = express.Router();

router.post("/", protect, upload.single("image"), createGig);
router.get("/", getGigs);
router.get("/:id/bid-status", protect, getGigBidStatus); // ✅ must be before /:id
router.get("/:id", getGigById);
router.delete("/:id", protect, deleteGig);
router.put("/:id", protect, upload.single("image"), updateGig);

// Project Workflow Lifecycle Routes
router.put("/:id/start-work", protect, startWork);
router.put("/:id/submit-work", protect, submitWork);
router.put("/:id/approve-work", protect, approveWork);
router.put("/:id/request-changes", protect, requestChanges);

export default router;