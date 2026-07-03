import mongoose from "mongoose";
import Bid from "../models/bid.js";
import Gig from "../models/gig.js";
import { notifyUser } from "../utils/notifyUser.js";
import { syncBidToConversation, getUnreadCountForUser } from "../utils/conversationHelper.js";

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

    const existingPendingBid = await Bid.findOne({
      gigId,
      bidderId: req.userId,
      status: "pending"
    });
    if (existingPendingBid)
      return res.status(400).json({ message: "You already have a pending bid on this gig" });

    const bid = await Bid.create({
      gigId,
      bidderId: req.userId,
      price: Number(price),
      message: message.trim(),
      lastOfferBy: req.userId,
      status: "pending",
      negotiationHistory: [{
        price: Number(price),
        message: message.trim(),
        senderId: req.userId,
        timestamp: new Date()
      }]
    });

    const populatedBid = await bid.populate("bidderId", "name");

    // Lookup-or-create Conversation logic
    const Conversation = (await import("../models/conversation.js")).default;
    const Message = (await import("../models/message.js")).default;
    const { io } = await import("../server.js");

    const roomId = [gig.ownerId.toString(), req.userId.toString()].sort().join("_") + "_" + gigId;
    let conversation = await Conversation.findOne({
      gigId,
      clientId: gig.ownerId,
      freelancerId: req.userId
    });

    let isNewConversation = false;

    if (!conversation) {
      isNewConversation = true;
      conversation = new Conversation({
        roomId,
        gigId,
        clientId: gig.ownerId,
        freelancerId: req.userId,
        currentBidId: bid._id,
        bidHistory: [{
          bidId: bid._id,
          price: bid.price,
          status: bid.status,
          submittedAt: bid.createdAt || new Date()
        }],
        unreadCount: { client: 0, freelancer: 0 }
      });
      try {
        await conversation.save();
      } catch (err) {
        if (err.code === 11000) {
          // Handle potential concurrency by loading the existing conversation
          conversation = await Conversation.findOne({
            gigId,
            clientId: gig.ownerId,
            freelancerId: req.userId
          });
          isNewConversation = false;
        } else {
          throw err;
        }
      }
    }

    if (!isNewConversation) {
      // Rebid case:
      const prevBidId = conversation.currentBidId;
      let prevPrice = 0;
      let prevStatus = "unknown";
      if (prevBidId) {
        const prevBid = await Bid.findById(prevBidId);
        if (prevBid) {
          prevPrice = prevBid.price;
          prevStatus = prevBid.status;
        }
      }

      // Update currentBidId and history
      conversation.currentBidId = bid._id;
      conversation.bidHistory.push({
        bidId: bid._id,
        price: bid.price,
        status: bid.status,
        submittedAt: bid.createdAt || new Date()
      });

      // Save conversation without system message or unread increment
      await conversation.save();

      // Create distinct rebid notification for the client
      if (gig.ownerId) {
        await notifyUser({
          senderId: req.userId,
          receiverId: gig.ownerId,
          type: "NEW_BID",
          title: "Bid Resubmitted",
          message: `${populatedBid.bidderId.name} resubmitted a bid on "${gig.title}" for $${bid.price}`,
          link: `/profile`,
          meta: { role: "client", bidId: bid._id, gigId: gig._id }
        });
      }

      // Emit Socket.IO events for rebid
      if (io) {
        const eventPayload = {
          conversationId: conversation._id,
          roomId,
          lastMessage: conversation.lastMessage,
          lastMessageAt: conversation.lastMessageAt,
          unreadCount: conversation.unreadCount,
          currentBidId: {
            _id: bid._id,
            status: bid.status,
            price: bid.price
          }
        };
        io.to(gig.ownerId.toString()).emit("conversationUpdated", eventPayload);
        io.to(req.userId).emit("conversationUpdated", eventPayload);

        io.to(gig.ownerId.toString()).emit("bidResubmitted", {
          conversationId: conversation._id,
          roomId,
          gigId,
          newBidId: bid._id,
          previousBidId: prevBidId,
          isNewConversation: false
        });

        const clientUnread = await getUnreadCountForUser(gig.ownerId);
        io.to(gig.ownerId.toString()).emit("navbarUnreadUpdate", { userId: gig.ownerId, totalUnread: clientUnread });
      }
    } else {
      // First bid notification and Socket event
      if (gig.ownerId) {
        await notifyUser({
          senderId: req.userId,
          receiverId: gig.ownerId,
          type: "NEW_BID",
          title: "New Bid Received",
          message: `You received a new bid from ${populatedBid.bidderId.name}.`,
          link: `/profile`,
          meta: { role: "client", bidId: bid._id, gigId: gig._id }
        });

        if (io) {
          io.to(gig.ownerId.toString()).emit("bidPlaced", {
            conversationId: conversation._id,
            roomId,
            gigId,
            bidId: bid._id,
            freelancerId: req.userId,
            isNewConversation: true
          });
        }
      }
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

    if (!gigId || gigId === "undefined" || !mongoose.Types.ObjectId.isValid(gigId)) {
      return res.status(400).json({ message: "Invalid or missing Gig ID" });
    }

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
    const bid = await Bid.findOne({ gigId, bidderId: req.userId, status: "pending" });
    const alreadyBid = !!bid;

    res.json({ alreadyBid, bidStatus: bid ? bid.status : null });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ---------- Accept Bid ---------- */
export const acceptBid = async (req, res) => {
  try {
    const bid = await Bid.findById(req.params.bidId).populate("bidderId", "name");
    if (!bid) return res.status(404).json({ message: "Bid not found" });

    const gig = await Gig.findById(bid.gigId);
    if (!gig || !gig.ownerId)
      return res.status(400).json({ message: "Gig owner not found" });

    const isOwner = gig.ownerId.toString() === req.userId;
    const isBidder = bid.bidderId._id.toString() === req.userId;

    if (!isOwner && !isBidder)
      return res.status(403).json({ message: "Not authorized to accept this bid" });

    if (bid.lastOfferBy && bid.lastOfferBy.toString() === req.userId) {
      return res.status(400).json({ message: "You cannot accept your own counter offer/bid." });
    }

    // Guard against race condition: check if any other bid is already hired
    const conflictingBid = await Bid.findOne({ 
      gigId: gig._id, 
      status: 'hired' 
    });
    
    if (conflictingBid) {
      return res.status(409).json({ message: "Another freelancer has already been hired for this gig." });
    }

    bid.status = "payment_pending";
    await bid.save();
    await syncBidToConversation(bid);

    await notifyUser({
      senderId: req.userId,
      receiverId: isOwner ? bid.bidderId._id : gig.ownerId,
      type: "BID_ACCEPTED",
      title: "Bid Accepted",
      message: isOwner 
        ? `Your bid on "${gig.title}" has been accepted.` 
        : `${bid.bidderId.name} accepted your counter offer on "${gig.title}". Complete payment to start the project.`,
      link: "/profile",
      meta: { role: isOwner ? "freelancer" : "client", bidId: bid._id, gigId: gig._id }
    });

    res.json({
      success: true,
      checkoutData: {
        bidId:           bid._id,
        gigId:           gig._id,
        gigTitle:        gig.title,
        gigImage:        gig.image,
        gigPrice:        bid.price,
        deliveryTime:    gig.deliveryTime,
        freelancerName:  bid.bidderId?.name || 'Freelancer',
        freelancerId:    bid.bidderId?._id,
      }
    });
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

    const isOwner = gig.ownerId._id.toString() === req.userId;
    const isBidder = bid.bidderId._id.toString() === req.userId;

    if (!isOwner && !isBidder)
      return res.status(403).json({ message: "Not authorized to reject this bid" });

    if (bid.lastOfferBy && bid.lastOfferBy.toString() === req.userId) {
      return res.status(400).json({ message: "You cannot reject your own counter offer/bid." });
    }

    if (bid.status !== "pending" && bid.status !== "countered")
      return res.status(400).json({ message: "Only active bids can be rejected." });

    bid.status = "rejected";
    await bid.save();
    await syncBidToConversation(bid);

    await notifyUser({
      senderId: req.userId,
      receiverId: isOwner ? bid.bidderId._id : gig.ownerId._id,
      type: "BID_REJECTED",
      title: "Bid Declined",
      message: isOwner
        ? `Your bid on "${gig.title}" was rejected.`
        : `Your counter offer on "${gig.title}" was declined.`,
      link: "/profile",
      meta: { role: isOwner ? "freelancer" : "client", bidId: bid._id, gigId: gig._id }
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
        senderId: req.userId,
        receiverId: gig.ownerId,
        type: "BID_WITHDRAWN",
        title: "Bid Withdrawn",
        message: `${bid.bidderId.name} withdrew their bid from "${gig.title}"`,
        link: `/profile`,
        meta: { role: "client", bidId: bid._id, gigId: gig._id }
      });
    }

    bid.status = "withdrawn";
    await bid.save();
    await syncBidToConversation(bid);
    res.json({ message: "Bid withdrawn successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ---------- Counter Bid ---------- */
export const counterBid = async (req, res) => {
  try {
    const { bidId } = req.params;
    const { price, message } = req.body;

    const bid = await Bid.findById(bidId);
    if (!bid) return res.status(404).json({ message: "Bid not found" });

    const gig = await Gig.findById(bid.gigId);
    if (!gig) return res.status(404).json({ message: "Gig not found" });

    // Validate that the request user is either the bidder or the gig owner
    const isOwner = gig.ownerId.toString() === req.userId;
    const isBidder = bid.bidderId.toString() === req.userId;

    if (!isOwner && !isBidder) {
      return res.status(403).json({ message: "Not authorized to negotiate on this bid" });
    }

    if (bid.lastOfferBy && bid.lastOfferBy.toString() === req.userId) {
      return res.status(400).json({ message: "You cannot counter your own counter offer/bid." });
    }

    if (bid.status === "hired" || bid.status === "rejected" || bid.status === "withdrawn") {
      return res.status(400).json({ message: "Cannot counter a closed or hired bid." });
    }

    bid.price = Number(price);
    bid.message = message.trim();
    bid.lastOfferBy = req.userId;
    bid.status = "countered";
    bid.negotiationHistory.push({
      price: Number(price),
      message: message.trim(),
      senderId: req.userId,
      timestamp: new Date()
    });

    await bid.save();
    await syncBidToConversation(bid);

    const receiverId = isOwner ? bid.bidderId : gig.ownerId;
    await notifyUser({
      senderId: req.userId,
      receiverId,
      type: "COUNTER_OFFER_RECEIVED",
      title: "Counter Offer Received",
      message: `You received a counter offer of $${price} on "${gig.title}".`,
      link: "/profile",
      meta: { role: isOwner ? "freelancer" : "client", bidId: bid._id, gigId: gig._id }
    });

    res.json(bid);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};