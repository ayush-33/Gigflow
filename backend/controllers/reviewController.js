import Review from "../models/review.js";
import Gig from "../models/gig.js";
import Bid from "../models/bid.js";

const recalcRating = async (gigId) => {
  const reviews = await Review.find({ gigId });
  if (!reviews.length) return;
  const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  await Gig.findByIdAndUpdate(gigId, {
    rating: parseFloat(avg.toFixed(1)),
    reviewCount: reviews.length
  });
};

export const createReview = async (req, res) => {
  try {
    const { gigId, rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5)
      return res.status(400).json({ message: "Rating must be between 1 and 5." });
    if (!comment || comment.trim().length < 10)
      return res.status(400).json({ message: "Review must be at least 10 characters." });

    const gig = await Gig.findById(gigId);
    if (!gig) return res.status(404).json({ message: "Gig not found" });
    if (gig.status !== "assigned")
      return res.status(400).json({ message: "You can only review a completed gig." });

    // Verify buyer was involved (had an accepted bid OR is the gig owner reviewing the seller)
    const bid = await Bid.findOne({
  gigId,
  status: "hired"
});
    if (!bid)
      return res.status(403).json({ message: "No hired bid found on this gig." });

    if (gig.ownerId.toString() !== req.userId)
      return res.status(403).json({ message: "Only the gig owner can leave a review." });

    const existing = await Review.findOne({ gigId, reviewerId: req.userId });
    if (existing)
      return res.status(400).json({ message: "You have already reviewed this gig." });

    const review = await Review.create({
      gigId,
      reviewerId: req.userId,
      sellerId: bid.bidderId,
      bidId: bid._id,
      rating: Number(rating),
      comment: comment.trim()
    });

    await recalcRating(gigId);

    const populated = await review.populate("reviewerId", "name");
    res.status(201).json(populated);
  } catch (error) {
    if (error.code === 11000)
      return res.status(400).json({ message: "You have already reviewed this gig." });
    res.status(500).json({ message: error.message });
  }
};

export const getReviewsByGig = async (req, res) => {
  try {
    const reviews = await Review.find({ gigId: req.params.gigId })
      .populate("reviewerId", "name")
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getReviewsBySeller = async (req, res) => {
  try {
    const reviews = await Review.find({ sellerId: req.params.sellerId })
      .populate("reviewerId", "name")
      .populate("gigId", "title")
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const checkCanReview = async (req, res) => {
  try {
    const { gigId } = req.params;
    const gig = await Gig.findById(gigId);
    if (!gig) return res.status(404).json({ message: "Gig not found" });

    const isOwner = gig.ownerId.toString() === req.userId;
    const alreadyReviewed = await Review.findOne({ gigId, reviewerId: req.userId });
    const hiredBid = await Bid.findOne({ gigId, status: "hired" });

    res.json({
      canReview: isOwner && gig.status === "assigned" && !alreadyReviewed && !!hiredBid,
      alreadyReviewed: !!alreadyReviewed
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};