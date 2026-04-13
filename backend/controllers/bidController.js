import Bid from "../models/bid.js";
import Gig from "../models/gig.js";
import Notification from "../models/notificationModel.js";

/* ---------- Create Bid ---------- */
export const createBid = async (req, res) => {
  try {
    const { gigId, price, message } = req.body;

    const gig = await Gig.findById(gigId);

    if (!gig) {
      return res.status(404).json({ message: "Gig not found" });
    }

    // ✅ Prevent gig owner from bidding on their own gig
    if (gig.ownerId.toString() === req.userId) {
      return res.status(403).json({ message: "You cannot bid on your own gig" });
    }

    const existingBid = await Bid.findOne({ gigId, bidderId: req.userId });

    if (existingBid) {
      return res.status(400).json({ message: "You have already placed a bid on this gig" });
    }

    const bid = await Bid.create({
      gigId,
      bidderId: req.userId,
      price,
      message
    });

    const populatedBid = await bid.populate("bidderId", "name");

    if (!gig.ownerId) {
      return res.status(400).json({ message: "Gig owner not found" });
    }

    await Notification.create({
      userId: gig.ownerId,
      message: `${populatedBid.bidderId.name} placed a bid on your gig`,
      type: "message",
      link: `/gig/${gig._id}`
    });

    res.status(201).json(populatedBid);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


/* ---------- Get Bids For a Gig ---------- */
export const getBidsByGig = async (req, res) => {
  try {

    const { gigId } = req.params;

    const bids = await Bid.find({ gigId })
      .populate("bidderId", "name email");

    res.json(bids);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


/* ---------- Check if User Already Bid ---------- */
export const checkUserBid = async (req, res) => {
  try {

    const { gigId } = req.params;

    const bid = await Bid.findOne({
      gigId,
      bidderId: req.userId
    });

    res.json({
      alreadyBid: !!bid
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


/* ---------- Accept Bid ---------- */
export const acceptBid = async (req, res) => {
  try {
    const bid = await Bid.findById(req.params.bidId).populate("bidderId", "name");

    if (!bid) {
      return res.status(404).json({ message: "Bid not found" });
    }

    const gig = await Gig.findById(bid.gigId).populate("ownerId", "name");

    if (!gig || !gig.ownerId) {
      return res.status(400).json({ message: "Gig owner not found" });
    }

    // ✅ Only the gig owner can accept a bid
    if (gig.ownerId._id.toString() !== req.userId) {
      return res.status(403).json({ message: "Not authorized to accept this bid" });
    }

    bid.status = "hired";
    await bid.save();

    await Gig.findByIdAndUpdate(bid.gigId, { status: "assigned" });

    await Bid.updateMany(
      { gigId: bid.gigId, _id: { $ne: bid._id } },
      { status: "rejected" }
    );

    await Notification.create({
      userId: bid.bidderId._id,
      message: `${gig.ownerId.name} accepted your bid`,
      type: "bidAccepted",
      link: `/gig/${bid.gigId}`
    });

    res.json({ message: "Bid accepted successfully" });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ---------- Reject Bid ---------- */
export const rejectBid = async (req, res) => {
  try {
    const { bidId } = req.params;

    const bid = await Bid.findById(bidId).populate("bidderId", "name");

    if (!bid) {
      return res.status(404).json({ message: "Bid not found" });
    }

    const gig = await Gig.findById(bid.gigId).populate("ownerId", "name");

    if (!gig || !gig.ownerId) {
      return res.status(400).json({ message: "Gig owner not found" });
    }

    // ✅ Only the gig owner can reject a bid
    if (gig.ownerId._id.toString() !== req.userId) {
      return res.status(403).json({ message: "Not authorized to reject this bid" });
    }

    bid.status = "rejected";
    await bid.save();

    await Notification.create({
      userId: bid.bidderId._id,
      message: `${gig.ownerId.name} rejected your bid`,
      type: "bidRejected",
      link: `/gig/${gig._id}`
    });

    res.json(bid);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


/* ---------- Withdraw Bid ---------- */
export const withdrawBid = async (req, res) => {
  try {

    const bid = await Bid.findById(req.params.bidId)
      .populate("bidderId", "name");

    if (!bid) {
      return res.status(404).json({ message: "Bid not found" });
    }

    if (bid.bidderId._id.toString() !== req.userId) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (bid.status !== "pending") {
      return res.status(400).json({ message: "Cannot withdraw bid" });
    }

    const gig = await Gig.findById(bid.gigId);

    if (!gig || !gig.ownerId) {
      return res.status(400).json({ message: "Gig owner not found" });
    }

    await Notification.create({
      userId: gig.ownerId,
      message: `${bid.bidderId.name} withdrew their bid`,
      type: "message",
      link: `/gig/${gig._id}`
    });

    await bid.deleteOne();

    res.json({ message: "Bid withdrawn successfully" });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};