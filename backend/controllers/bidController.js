import Bid from "../models/bid.js";
import Gig from "../models/gig.js";
import { notifyUser } from "../utils/notifyUser.js";

/* ── Validation ── */
const validateBid = ({ price, message }) => {
  const errors = [];
  if (!price || isNaN(price) || Number(price) < 1)
    errors.push("Bid price must be at least $1.");
  if (!message || message.trim().length < 10)
    errors.push("Proposal message must be at least 10 characters.");
  return errors;
};

/* ---------- Create Bid ---------- */
export const createBid = async (req, res) => {
  try {
    const { gigId, price, message } = req.body;

    const errors = validateBid({ price, message });
    if (errors.length) return res.status(400).json({ message: errors[0], errors });

    const gig = await Gig.findById(gigId);
    if (!gig) return res.status(404).json({ message: "Gig not found" });

    if (gig.status !== "open")
      return res.status(400).json({ message: "This gig is no longer accepting bids." });

    if (gig.ownerId.toString() === req.userId)
      return res.status(403).json({ message: "You cannot bid on your own gig" });

    const existingBid = await Bid.findOne({ gigId, bidderId: req.userId });
    if (existingBid)
      return res.status(400).json({ message: "You have already placed a bid on this gig" });

    const bid = await Bid.create({
      gigId,
      bidderId: req.userId,
      price: Number(price),
      message: message.trim()
    });

    const populatedBid = await bid.populate("bidderId", "name");

    if (gig.ownerId) {
      await notifyUser({
  userId: gig.ownerId,
  message: `${populatedBid.bidderId.name} placed a bid of $${price} on your gig`,
  type: "message",
  link: `/gig/${gig._id}`
});
    }

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
      .populate("bidderId", "name email")
      .sort({ createdAt: -1 });

    res.json(bids);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ---------- Check if User Already Bid ---------- */
export const checkUserBid = async (req, res) => {
  try {
    const { gigId } = req.params;
    const bid = await Bid.findOne({ gigId, bidderId: req.userId });

    res.json({ alreadyBid: !!bid, bidStatus: bid ? bid.status : null });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ---------- Accept Bid ---------- */
export const acceptBid = async (req, res) => {
  try {
    const bid = await Bid.findById(req.params.bidId).populate("bidderId", "name");
    if (!bid) return res.status(404).json({ message: "Bid not found" });

    const gig = await Gig.findById(bid.gigId).populate("ownerId", "name");
    if (!gig || !gig.ownerId)
      return res.status(400).json({ message: "Gig owner not found" });

    if (gig.ownerId._id.toString() !== req.userId)
      return res.status(403).json({ message: "Not authorized to accept this bid" });

    if (gig.status === "assigned")
      return res.status(400).json({ message: "A bid has already been accepted for this gig." });

    bid.status = "hired";
    await bid.save();

    await Gig.findByIdAndUpdate(bid.gigId, { status: "assigned" });

    // Reject all other pending bids
    await Bid.updateMany(
      { gigId: bid.gigId, _id: { $ne: bid._id }, status: "pending" },
      { status: "rejected" }
    );

    // Notify accepted bidder
await notifyUser({
  userId: bid.bidderId._id,
  message: `🎉 ${gig.ownerId.name} accepted your bid for "${gig.title}"`,
  type: "bidAccepted",
  link: `/gig/${bid.gigId}`
});

    // Notify rejected bidders
    const rejectedBids = await Bid.find({
      gigId: bid.gigId,
      _id: { $ne: bid._id },
      status: "rejected"
    }).populate("bidderId", "name");

    for (const rb of rejectedBids) {
      if (rb.bidderId?._id) {
        await notifyUser({
  userId: rb.bidderId._id,
  message: `Your bid on "${gig.title}" was not selected`,
  type: "bidRejected",
  link: `/gig/${bid.gigId}`
});
      }
    }

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
    if (!bid) return res.status(404).json({ message: "Bid not found" });

    const gig = await Gig.findById(bid.gigId).populate("ownerId", "name");
    if (!gig || !gig.ownerId)
      return res.status(400).json({ message: "Gig owner not found" });

    if (gig.ownerId._id.toString() !== req.userId)
      return res.status(403).json({ message: "Not authorized to reject this bid" });

    if (bid.status !== "pending")
      return res.status(400).json({ message: "Only pending bids can be rejected." });

    bid.status = "rejected";
    await bid.save();

await notifyUser({
  userId: bid.bidderId._id,
  message: `Your bid on "${gig.title}" was not selected`,
  type: "bidRejected",
  link: `/gig/${gig._id}`
});

    res.json(bid);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ---------- Withdraw Bid ---------- */
// ✅ FIX: route was registered as PUT — changing controller to handle DELETE properly
// Update bidRoutes.js to use: router.delete("/withdraw/:bidId", protect, withdrawBid)
export const withdrawBid = async (req, res) => {
  try {
    const bid = await Bid.findById(req.params.bidId).populate("bidderId", "name");
    if (!bid) return res.status(404).json({ message: "Bid not found" });

    if (bid.bidderId._id.toString() !== req.userId)
      return res.status(403).json({ message: "Not authorized" });

    if (bid.status !== "pending")
      return res.status(400).json({ message: "Cannot withdraw a bid that has already been actioned." });

    const gig = await Gig.findById(bid.gigId);
    if (gig?.ownerId) {
      await notifyUser({
  userId: gig.ownerId,
  message: `${bid.bidderId.name} withdrew their bid from "${gig.title}"`,
  type: "message",
  link: `/gig/${gig._id}`
});
    }

    await bid.deleteOne();
    res.json({ message: "Bid withdrawn successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};