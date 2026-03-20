import Bid from "../models/bid.js";

/* ---------- Create Bid ---------- */
export const createBid = async (req, res) => {
  try {
    const { gigId, price, message } = req.body;

    const bid = await Bid.create({
      gigId,
      bidderId: req.userId,
      price,
      message
    });

    res.status(201).json(bid);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ---------- Get Bids For a Gig ---------- */
export const getBidsByGig = async (req, res) => {
  try {
    const { gigId } = req.params;

    const bids = await Bid.find({ gigId });

    res.json(bids);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
