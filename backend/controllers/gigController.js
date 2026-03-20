import Gig from "../models/gig.js";

/* ---------- Create Gig ---------- */
export const createGig = async (req, res) => {
  try {
    const { title, description, budget } = req.body;

    const gig = await Gig.create({
      title,
      description,
      budget,
      ownerId: req.userId,   // comes from auth middleware
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
    });

    res.json(gigs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
