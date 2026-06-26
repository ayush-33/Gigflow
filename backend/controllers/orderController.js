import Order from '../models/Order.js';
import Bid from '../models/bid.js';
import Gig from '../models/gig.js';
import Notification from '../models/notificationModel.js';
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

    // Update Gig status to hired
    gig.status = 'hired';
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

    // Trigger notification for freelancer
    await notifyUser({
      senderId: req.userId,
      receiverId: bid.bidderId._id,
      type: "GIG_HIRED",
      title: "Gig Hired",
      message: `You have been hired for "${gig.title}".`,
      link: "/profile",
      meta: { role: "freelancer", bidId: bid._id, gigId: gig._id }
    });

    // Mark the BID_ACCEPTED notification as read since action is completed
    await Notification.updateMany(
      {
        receiverId: req.userId,
        type: "BID_ACCEPTED",
        isRead: false
      },
      {
        $set: { isRead: true, read: true }
      }
    );

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
