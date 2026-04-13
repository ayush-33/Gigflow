import User from "../models/user.js";
import Gig from "../models/gig.js";
import Bid from "../models/bid.js";

/* ---------- Get Logged In User Profile ---------- */
export const getProfile = async (req, res) => {
  try {

    const user = await User.findById(req.userId).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


/* ---------- Get Gigs Posted By User ---------- */
export const getMyGigs = async (req, res) => {
  try {

    const gigs = await Gig.find({ ownerId: req.userId });

    res.json(gigs);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


/* ---------- Get Bids Placed By User ---------- */
export const getMyBids = async (req, res) => {
  try {

    const bids = await Bid.find({ bidderId: req.userId })
      .populate("gigId", "title price");

    res.json(bids);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getBidsOnMyGigs = async (req, res) => {
  try {

    const gigs = await Gig.find({ ownerId: req.userId });

    const bids = await Bid.find({
      gigId: { $in: gigs.map(g => g._id) }
    }).populate("bidderId", "name email");

    res.json(bids);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getProfileStats = async (req, res) => {
  try {

    const gigsCount = await Gig.countDocuments({ ownerId: req.userId });

    const bidsCount = await Bid.countDocuments({ bidderId: req.userId });

    res.json({
      gigsPosted: gigsCount,
      bidsPlaced: bidsCount
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};