import Gig from "../models/gig.js";
import Bid from "../models/bid.js";

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
  if (!title || title.trim().length < 5)        errors.push("Title must be at least 5 characters.");
  if (!description || description.trim().length < 20) errors.push("Description must be at least 20 characters.");
  if (!category)                                 errors.push("Category is required.");
  if (!price || isNaN(price) || Number(price) < 5)    errors.push("Price must be at least $5.");
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

    const gigs = await Gig.find({
      status: { $in: ["open", "assigned"] },   // show assigned gigs too so users see they're taken
      title: { $regex: search, $options: "i" }
    }).populate("ownerId", "name username");

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

    const isOwner    = gig.ownerId.toString() === req.userId;
    const isAssigned = gig.status === "assigned";

    const existingBid = await Bid.findOne({ gigId: req.params.id, bidderId: req.userId });
    const bidCount    = await Bid.countDocuments({ gigId: req.params.id });

    res.json({
      isOwner,
      isAssigned,
      alreadyBid: !!existingBid,
      bidStatus: existingBid ? existingBid.status : null,
      bidCount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

