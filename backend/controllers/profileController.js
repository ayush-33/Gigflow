// controllers/profileController.js
import User from "../models/user.js";
import Gig from "../models/gig.js";
import Bid from "../models/bid.js";

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { name, bio, phone } = req.body;
    if (!name || name.trim().length < 2)
      return res.status(400).json({ message: "Name must be at least 2 characters." });

    const updated = await User.findByIdAndUpdate(
      req.userId,
      { name: name.trim(), bio: bio?.trim() || "", phone: phone?.trim() || "" },
      { new: true }
    ).select("-password");
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getMyGigs = async (req, res) => {
  try {
    const gigs = await Gig.find({ ownerId: req.userId }).sort({ createdAt: -1 });
    res.json(gigs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getMyBids = async (req, res) => {
  try {
    const bids = await Bid.find({ bidderId: req.userId })
      .populate({
        path: "gigId",
        select: "title price status deliveryTime image ownerId",
        populate: {
          path: "ownerId",
          select: "name"
        }
      })
      .sort({ createdAt: -1 });

    res.json(bids);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getBidsOnMyGigs = async (req, res) => {
  try {
    // Get all gigs owned by this user
    const gigs = await Gig.find({ ownerId: req.userId }).select("_id");
    const gigIds = gigs.map((g) => g._id);

    const bids = await Bid.find({ gigId: { $in: gigIds }, status: { $ne: "withdrawn" } })
      .populate("bidderId", "name email")
      .populate("gigId", "title price deliveryTime image")
      .sort({ createdAt: -1 });

    res.json(bids);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getProfileStats = async (req, res) => {
  try {
    const gigsPosted = await Gig.countDocuments({ ownerId: req.userId });
    const bidsPlaced = await Bid.countDocuments({ bidderId: req.userId });
    const pendingBids = await Bid.countDocuments({ bidderId: req.userId, status: { $in: ["pending", "countered"] } });
    const acceptedBids = await Bid.countDocuments({ bidderId: req.userId, status: { $in: ["payment_pending", "hired", "in_progress", "submitted", "completed"] } });
    const rejectedBids = await Bid.countDocuments({ bidderId: req.userId, status: "rejected" });
    const withdrawnBids = await Bid.countDocuments({ bidderId: req.userId, status: "withdrawn" });
    const hiresWon = await Bid.countDocuments({ bidderId: req.userId, status: { $in: ["hired", "in_progress", "submitted", "completed"] } });

    const myGigs = await Gig.find({ ownerId: req.userId }).select("_id");
    const myGigIds = myGigs.map((g) => g._id);
    const offersReceived = await Bid.countDocuments({ gigId: { $in: myGigIds }, status: { $ne: "withdrawn" } });

    res.json({ gigsPosted, bidsPlaced, pendingBids, acceptedBids, rejectedBids, withdrawnBids, hiresWon, offersReceived });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};