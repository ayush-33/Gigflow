import SavedGig from "../models/savedGig.js";
import Gig from "../models/gig.js";

export const toggleSavedGig = async (req, res) => {
  try {
    const { gigId } = req.body;
    const gig = await Gig.findById(gigId);
    if (!gig) return res.status(404).json({ message: "Gig not found" });

    const existing = await SavedGig.findOne({ userId: req.userId, gigId });
    if (existing) {
      await existing.deleteOne();
      return res.json({ saved: false, message: "Removed from saved" });
    }

    await SavedGig.create({ userId: req.userId, gigId });
    res.status(201).json({ saved: true, message: "Saved successfully" });
  } catch (err) {
    if (err.code === 11000)
      return res.json({ saved: true, message: "Already saved" });
    res.status(500).json({ message: err.message });
  }
};

export const getMySavedGigs = async (req, res) => {
  try {
    const saved = await SavedGig.find({ userId: req.userId })
      .populate({ path: "gigId", populate: { path: "ownerId", select: "name username" } })
      .sort({ createdAt: -1 });

    res.json(saved.filter(s => s.gigId).map(s => s.gigId));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getSavedGigIds = async (req, res) => {
  try {
    const saved = await SavedGig.find({ userId: req.userId }).select("gigId");
    res.json(saved.map(s => s.gigId.toString()));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};