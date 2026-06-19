import Order from '../models/Order.js';
import Bid from '../models/bid.js';
import Gig from '../models/gig.js';
import { io } from '../server.js';
import { notifyUser } from '../utils/notifyUser.js';

export const completeOrder = async (req, res) => {
  try {
    const { bidId, gigId, paymentMethod, amount } = req.body;

    // Input Validation
    if (!bidId || !gigId || !paymentMethod || !amount) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: bidId, gigId, paymentMethod, and amount are required."
      });
    }

    // Query Gig
    const gig = await Gig.findById(gigId);
    if (!gig) {
      return res.status(404).json({
        success: false,
        message: "Gig not found"
      });
    }

    // Query and Validate Bid
    const bid = await Bid.findById(bidId).populate('bidderId', 'name email');
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found"
      });
    }

    if (bid.gigId.toString() !== gigId) {
      return res.status(400).json({
        success: false,
        message: "Bid does not belong to this gig"
      });
    }

    if (gig.ownerId.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to complete payment for this gig"
      });
    }

    if (bid.status !== 'payment_pending') {
      return res.status(400).json({
        success: false,
        message: 'Invalid or already processed bid'
      });
    }

    bid.status = 'hired';
    await bid.save();

    await Bid.updateMany(
      { gigId, _id: { $ne: bidId }, status: { $in: ['pending', 'payment_pending'] } },
      { $set: { status: 'rejected' } }
    );

    // Update Gig status
    gig.status = 'assigned';
    await gig.save();

    const orderRef = `GF-${Date.now().toString().slice(-8)}`;
    const platformFee = Math.round(amount * 0.1);

    const order = await Order.create({
      gigId,
      bidId,
      clientId: req.userId,
      freelancerId: bid.bidderId._id,
      amount,
      platformFee,
      paymentMethod,
      status: 'completed',
      orderRef,
    });

    // Trigger notifications for freelancer
    await notifyUser({
      senderId: req.userId,
      receiverId: bid.bidderId._id,
      type: "PROJECT_AWARDED",
      title: "Project Awarded",
      message: `You have been awarded Project "${gig.title}".`,
      link: "/profile"
    });

    await notifyUser({
      senderId: req.userId,
      receiverId: bid.bidderId._id,
      type: "PAYMENT_RECEIVED",
      title: "Payment Received",
      message: `You received a payment for Project "${gig.title}".`,
      link: "/profile"
    });

    await notifyUser({
      senderId: req.userId,
      receiverId: bid.bidderId._id,
      type: "CONTRACT_STARTED",
      title: "Contract Started",
      message: `Contract started for Project "${gig.title}".`,
      link: "/profile"
    });

    if (io) {
      io.to(bid.bidderId._id.toString()).emit('bidHired', {
        message: `Your bid was accepted! Payment of $${amount} received.`,
        gigId,
        orderId: order._id,
        orderRef,
      });
    }

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
