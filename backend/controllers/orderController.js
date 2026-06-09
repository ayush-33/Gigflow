import Order from '../models/Order.js';
import Bid from '../models/bid.js';
import Gig from '../models/gig.js';
import { io } from '../server.js';

export const completeOrder = async (req, res) => {
  try {
    const { bidId, gigId, paymentMethod, amount } = req.body;

    const bid = await Bid.findById(bidId).populate('bidderId', 'name email');
    if (!bid || bid.status !== 'payment_pending') {
      return res.status(400).json({ message: 'Invalid or already processed bid' });
    }

    bid.status = 'hired';
    await bid.save();

    await Bid.updateMany(
      { gigId, _id: { $ne: bidId }, status: { $in: ['pending', 'payment_pending'] } },
      { $set: { status: 'rejected' } }
    );

    await Gig.findByIdAndUpdate(gigId, { status: 'assigned' });

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

    if (io) {
      io.to(`user_${bid.bidderId._id.toString()}`).emit('bidHired', {
        message: `Your bid was accepted! Payment of $${amount} received.`,
        gigId,
        orderId: order._id,
        orderRef,
      });
    }

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
