import Gig from "../models/gig.js";
import Bid from "../models/bid.js"; // ✅ add this line


/* ---------- Create Gig ---------- */
export const createGig = async (req, res) => {
  try {
    const { title, category, description, price, deliveryTime } = req.body;

    // ✅ Store full relative path, not just filename
    const image = req.file ? `/uploads/${req.file.filename}` : null;

    const gig = await Gig.create({
      title,
      category,
      description,
      price,
      deliveryTime,
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
      status: "open",
      title: { $regex: search, $options: "i" }
    }).populate("ownerId", "name");

    res.json(gigs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ---------- Get Single Gig ---------- */
export const getGigById = async (req, res) => {
  try {

    const gig = await Gig.findById(req.params.id)
  .populate("ownerId", "name");

    if (!gig) {
      return res.status(404).json({ message: "Gig not found" });
    }

    res.json(gig);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


/* ---------- Delete Gig ---------- */
export const deleteGig = async (req, res) => {
  try {

    const gig = await Gig.findById(req.params.id);

    if (!gig) {
      return res.status(404).json({ message: "Gig not found" });
    }

    // check owner
    if (gig.ownerId.toString() !== req.userId) {
      return res.status(403).json({ message: "Not authorized to delete this gig" });
    }

    await gig.deleteOne();

    res.json({ message: "Gig deleted successfully" });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//update gig 
export const updateGig = async (req, res) => {
  try {
    const gig = await Gig.findById(req.params.id);

    if (!gig) return res.status(404).json({ message: "Gig not found" });
    if (gig.ownerId.toString() !== req.userId)
      return res.status(403).json({ message: "Not authorized" });

    const updatedData = { ...req.body };

    // ✅ Same fix here
    if (req.file) updatedData.image = `/uploads/${req.file.filename}`;

    const updatedGig = await Gig.findByIdAndUpdate(req.params.id, updatedData, { new: true });
    res.json(updatedGig);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Status 
export const getGigBidStatus = async (req, res) => {
  try {
    const gig = await Gig.findById(req.params.id);

    if (!gig) {
      return res.status(404).json({ message: "Gig not found" });
    }

    const isOwner = gig.ownerId.toString() === req.userId;
    const isAssigned = gig.status === "assigned";

    const existingBid = await Bid.findOne({
      gigId: req.params.id,
      bidderId: req.userId
    });

    // This tells the frontend everything it needs to decide what to show
    res.json({
      isOwner,           // true → hide bid button entirely
      isAssigned,        // true → show "This gig is filled"
      alreadyBid: !!existingBid,  // true → show "Bid already submitted"
      bidStatus: existingBid ? existingBid.status : null  // "pending" | "hired" | "rejected"
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};