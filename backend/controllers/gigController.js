import Gig from "../models/gig.js";
import Bid from "../models/bid.js";
import { notifyUser } from "../utils/notifyUser.js";
import { io } from "../server.js";

/* ── Helper: sanitise image path ── */
// Ensures we ONLY store the filename (e.g. "abc123.jpg") in the DB.
// The frontend then builds the full URL: http://localhost:5000/uploads/{filename}
const getFilename = (file) => {
  if (!file) return null;
  // multer sets file.filename. Strip any accidental path prefixes.
  return file.filename || file.originalname;
};

/* ── Server-side validation ── */
const validateGig = ({ title, description, price, deliveryTime, category }) => {
  const errors = [];
  if (!title || title.trim().length < 5) errors.push("Title must be at least 5 characters.");
  if (!description || description.trim().length < 20) errors.push("Description must be at least 20 characters.");
  if (!category) errors.push("Category is required.");
  if (!price || isNaN(price) || Number(price) < 5) errors.push("Price must be at least $5.");
  if (!deliveryTime || isNaN(deliveryTime) || Number(deliveryTime) < 1 || Number(deliveryTime) > 60)
    errors.push("Delivery time must be between 1 and 60 days.");
  return errors;
};

/* ---------- Create Gig ---------- */
export const createGig = async (req, res) => {
  try {
    const { title, category, description, price, deliveryTime } = req.body;

    const errors = validateGig({ title, category, description, price, deliveryTime });
    if (errors.length) return res.status(400).json({ message: errors[0], errors });

    // ✅ FIX: store ONLY the filename, not the full path
    const image = getFilename(req.file);

    const gig = await Gig.create({
      title: title.trim(),
      category,
      description: description.trim(),
      price: Number(price),
      deliveryTime: Number(deliveryTime),
      image,
      ownerId: req.userId,
      status: "open"
    });

    res.status(201).json(gig);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ---------- Get All Open Gigs ---------- */
export const getGigs = async (req, res) => {
  try {
    const search = req.query.search || "";
    // Include all active statuses so Explore shows hired/in_progress with status overlay
    const query = { status: { $in: ["open", "assigned", "hired", "in_progress", "submitted"] } };

    if (search.trim()) {
      const keywords = search.trim().split(/\s+/).filter(Boolean);
      query.$and = keywords.map(kw => {
        const regex = new RegExp(kw, "i");
        return {
          $or: [
            { title: { $regex: regex } },
            { description: { $regex: regex } },
            { category: { $regex: regex } },
            { tags: { $regex: regex } }
          ]
        };
      });
    }

    const gigs = await Gig.find(query).populate("ownerId", "name username");
    res.json(gigs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ---------- Get Single Gig ---------- */
export const getGigById = async (req, res) => {
  try {
    const gig = await Gig.findById(req.params.id).populate("ownerId", "name username");

    if (!gig) return res.status(404).json({ message: "Gig not found" });

    // ✅ Attach bid count so frontend can display "X bids"
    const bidCount = await Bid.countDocuments({ gigId: gig._id });

    res.json({ ...gig.toObject(), bidCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ---------- Delete Gig ---------- */
export const deleteGig = async (req, res) => {
  try {
    const gig = await Gig.findById(req.params.id);

    if (!gig) return res.status(404).json({ message: "Gig not found" });

    if (gig.ownerId.toString() !== req.userId)
      return res.status(403).json({ message: "Not authorized to delete this gig" });

    // Fetch all bids on this gig before deletion to notify bidders
    const bids = await Bid.find({ gigId: gig._id });

    // Send notification and emit socket event for each bidder
    for (const bid of bids) {
      try {
        await notifyUser({
          senderId: req.userId,
          receiverId: bid.bidderId,
          type: "GIG_DELETED",
          title: "Gig Deleted",
          message: `The gig "${gig.title}" you bid on has been deleted.`,
          link: "/profile"
        });

        if (io) {
          io.to(bid.bidderId.toString()).emit("gigDeleted", { gigId: gig._id });
        }
      } catch (err) {
        console.error(`Error notifying bidder ${bid.bidderId}:`, err.message);
      }
    }

    // Also emit gigDeleted event to the owner's socket room (triggers real-time stats update if they are on another tab/device)
    if (io) {
      io.to(req.userId.toString()).emit("gigDeleted", { gigId: gig._id });
    }

    // Also remove all bids for this gig
    await Bid.deleteMany({ gigId: gig._id });
    await gig.deleteOne();

    res.json({ message: "Gig deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ---------- Update Gig ---------- */
export const updateGig = async (req, res) => {
  try {
    const gig = await Gig.findById(req.params.id);

    if (!gig) return res.status(404).json({ message: "Gig not found" });
    if (gig.ownerId.toString() !== req.userId)
      return res.status(403).json({ message: "Not authorized" });

    const { title, category, description, price, deliveryTime } = req.body;
    const errors = validateGig({ title, category, description, price, deliveryTime });
    if (errors.length) return res.status(400).json({ message: errors[0], errors });

    const updatedData = {
      title: title.trim(),
      category,
      description: description.trim(),
      price: Number(price),
      deliveryTime: Number(deliveryTime),
    };

    // ✅ FIX: store ONLY the filename
    if (req.file) updatedData.image = getFilename(req.file);

    const updatedGig = await Gig.findByIdAndUpdate(req.params.id, updatedData, { new: true });
    res.json(updatedGig);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ---------- Get Gig Bid Status ---------- */
export const getGigBidStatus = async (req, res) => {
  try {
    const gig = await Gig.findById(req.params.id);

    if (!gig) return res.status(404).json({ message: "Gig not found" });

    const isOwner = gig.ownerId.toString() === req.userId;
    const isAssigned = ["assigned", "hired", "in_progress", "submitted", "completed"].includes(gig.status);

    const existingBid = await Bid.findOne({ gigId: req.params.id, bidderId: req.userId }).sort({ createdAt: -1 });
    const bidCount = await Bid.countDocuments({ gigId: req.params.id });

    const blockStatuses = ["pending", "countered", "payment_pending", "hired", "in_progress", "submitted", "completed"];
    const alreadyBid = existingBid ? blockStatuses.includes(existingBid.status) : false;

    // Find the hired bid
    const acceptedBid = await Bid.findOne({
      gigId: req.params.id,
      status: { $in: ["hired", "in_progress", "submitted", "completed"] }
    }).select("price bidderId").populate("bidderId", "name");

    res.json({
      isOwner,
      isAssigned,
      alreadyBid,
      bidStatus: existingBid ? existingBid.status : null,
      revisionNotes: existingBid ? existingBid.revisionNotes : null,
      bidCount,
      acceptedBidPrice: acceptedBid?.price ?? null,
      acceptedBidderId: acceptedBid?.bidderId?._id?.toString() ?? null,
      acceptedBidderName: acceptedBid?.bidderId?.name ?? null,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ---------- Start Work (Freelancer) ---------- */
export const startWork = async (req, res) => {
  try {
    const gig = await Gig.findById(req.params.id);
    if (!gig) return res.status(404).json({ message: "Gig not found" });

    if (gig.status !== "hired") {
      return res.status(400).json({ message: "Gig is not in hired state." });
    }

    // Find the hired bid
    const bid = await Bid.findOne({ gigId: gig._id, status: "hired" });
    if (!bid) return res.status(404).json({ message: "Hired bid not found for this gig." });

    if (bid.bidderId.toString() !== req.userId) {
      return res.status(403).json({ message: "Only the hired freelancer can start work." });
    }

    gig.status = "in_progress";
    await gig.save();

    bid.status = "in_progress";
    await bid.save();

    // Notify client
    await notifyUser({
      senderId: req.userId,
      receiverId: gig.ownerId,
      type: "CONTRACT_STARTED",
      title: "Work Started",
      message: `Freelancer started work on "${gig.title}".`,
      link: "/profile"
    });

    res.json({ success: true, gig });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ---------- Submit Work (Freelancer) ---------- */
export const submitWork = async (req, res) => {
  try {
    const gig = await Gig.findById(req.params.id);
    if (!gig) return res.status(404).json({ message: "Gig not found" });

    if (gig.status !== "in_progress") {
      return res.status(400).json({ message: "Work can only be submitted when project is In Progress." });
    }

    // Find the hired bid on this gig
    const bid = await Bid.findOne({ gigId: gig._id, status: { $in: ["hired", "in_progress"] } });
    if (!bid) return res.status(404).json({ message: "No hired bid found for this gig." });

    if (bid.bidderId.toString() !== req.userId) {
      return res.status(403).json({ message: "Only the hired freelancer can submit work." });
    }

    gig.status = "submitted";
    await gig.save();

    bid.status = "submitted";
    bid.revisionNotes = ""; // Clear active revision notes on resubmission
    await bid.save();

    // Notify client
    await notifyUser({
      senderId: req.userId,
      receiverId: gig.ownerId,
      type: "WORK_SUBMITTED",
      title: "Work Submitted for Review",
      message: `Freelancer submitted work for review on "${gig.title}".`,
      link: `/gig/${gig._id}`
    });

    res.json({ success: true, gig });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ---------- Approve Work (Client) ---------- */
export const approveWork = async (req, res) => {
  try {
    const gig = await Gig.findById(req.params.id);
    if (!gig) return res.status(404).json({ message: "Gig not found" });

    if (gig.status !== "submitted") {
      return res.status(400).json({ message: "No work has been submitted for this gig." });
    }

    if (gig.ownerId.toString() !== req.userId) {
      return res.status(403).json({ message: "Only the gig owner can approve work." });
    }

    const bid = await Bid.findOne({ gigId: gig._id, status: "submitted" });
    if (!bid) return res.status(404).json({ message: "No submitted bid found." });

    gig.status = "completed";
    await gig.save();

    bid.status = "completed";
    bid.revisionNotes = ""; // Clear active notes on approval too
    await bid.save();

    // Notify freelancer
    await notifyUser({
      senderId: req.userId,
      receiverId: bid.bidderId,
      type: "WORK_APPROVED",
      title: "Work Approved!",
      message: `Your work on "${gig.title}" has been approved.`,
      link: `/gig/${gig._id}`
    });

    res.json({ success: true, gig });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ---------- Request Changes (Client) ---------- */
export const requestChanges = async (req, res) => {
  try {
    const { notes } = req.body;
    if (!notes || !notes.trim()) {
      return res.status(400).json({ message: "Revision notes are required." });
    }

    const gig = await Gig.findById(req.params.id);
    if (!gig) return res.status(404).json({ message: "Gig not found" });

    if (gig.status !== "submitted") {
      return res.status(400).json({ message: "No work has been submitted for this gig." });
    }

    if (gig.ownerId.toString() !== req.userId) {
      return res.status(403).json({ message: "Only the gig owner can request changes." });
    }

    const bid = await Bid.findOne({ gigId: gig._id, status: "submitted" });
    if (!bid) return res.status(404).json({ message: "No submitted bid found." });

    gig.status = "in_progress";
    await gig.save();

    bid.status = "in_progress";
    bid.revisionNotes = notes.trim();
    bid.revisionHistory.push({
      notes: notes.trim(),
      senderId: req.userId,
      timestamp: new Date()
    });
    await bid.save();

    // Notify freelancer
    await notifyUser({
      senderId: req.userId,
      receiverId: bid.bidderId,
      type: "REVISIONS_REQUESTED",
      title: "Revisions Requested",
      message: `Client requested revisions on "${gig.title}".`,
      link: `/gig/${gig._id}`,
      meta: { notes: notes.trim(), gigId: gig._id }
    });

    res.json({ success: true, gig });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

