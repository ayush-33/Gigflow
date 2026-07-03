import Message from "../models/message.js";
import Gig from "../models/gig.js";
import User from "../models/user.js";
import mongoose from "mongoose";
import { io } from "../server.js";

/* ── Build roomId (deterministic, order-independent, project-scoped) ── */
export const buildRoomId = (gigId, userA, userB) => {
  const sorted = [userA.toString(), userB.toString()].sort().join("_");
  return sorted + "_" + gigId.toString();
};

/* ---------- Get chat rooms for current user ---------- */
export const getMyChatRooms = async (req, res) => {
  try {
    const Conversation = (await import("../models/conversation.js")).default;
    const rooms = await Conversation.find({
      $or: [
        { clientId: req.userId },
        { freelancerId: req.userId }
      ]
    })
    .populate("gigId", "title price image")
    .populate("clientId", "name email")
    .populate("freelancerId", "name email")
    .populate("currentBidId", "status price message")
    .sort({ lastMessageAt: -1 })
    .lean();

    const populated = rooms.map((room) => {
      const isClient = room.clientId?._id?.toString() === req.userId.toString();
      const otherUser = isClient ? room.freelancerId : room.clientId;
      const unreadCount = isClient ? (room.unreadCount?.client || 0) : (room.unreadCount?.freelancer || 0);

      return {
        _id: room.roomId, // Map roomId as _id for frontend compatibility
        conversationId: room._id,
        roomId: room.roomId,
        gigId: room.gigId?._id || room.gigId,
        gig: room.gigId,
        senderId: room.clientId?._id || room.clientId,
        receiverId: room.freelancerId?._id || room.freelancerId,
        lastMessage: room.lastMessage,
        unreadCount,
        otherUser,
        bidHistory: room.bidHistory,
        currentBidId: room.currentBidId
      };
    });

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ---------- Get messages for a room ---------- */
export const getRoomMessages = async (req, res) => {
  try {
    const { roomId } = req.params;
    const Conversation = (await import("../models/conversation.js")).default;

    const conversation = await Conversation.findOne({ roomId });
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const isParticipant =
      conversation.clientId.toString() === req.userId.toString() ||
      conversation.freelancerId.toString() === req.userId.toString();

    if (!isParticipant) {
      return res.status(403).json({ message: "Not authorized to view this chat" });
    }

    // Reset unread count for the active user
    const isClient = conversation.clientId.toString() === req.userId.toString();
    const role = isClient ? "client" : "freelancer";
    conversation.unreadCount[role] = 0;
    await conversation.save();

    // Mark messages in this room received by current user as read
    await Message.updateMany(
      { roomId, receiverId: req.userId, isRead: false },
      { $set: { isRead: true, readAt: new Date(), status: "read" } }
    );

    // Notify room that messages have been read
    if (io) {
      io.to(roomId).emit("messagesSeen", {
        roomId,
        userId: req.userId,
      });

      // Emit conversationUpdated
      const eventPayload = {
        conversationId: conversation._id,
        roomId: conversation.roomId,
        lastMessage: conversation.lastMessage,
        lastMessageAt: conversation.lastMessageAt,
        unreadCount: conversation.unreadCount,
        currentBidId: conversation.currentBidId ? {
          _id: conversation.currentBidId
        } : null
      };
      io.to(conversation.clientId.toString()).emit("conversationUpdated", eventPayload);
      io.to(conversation.freelancerId.toString()).emit("conversationUpdated", eventPayload);

      // Emit navbarUnreadUpdate
      const { getUnreadCountForUser } = await import("../utils/conversationHelper.js");
      const totalUnread = await getUnreadCountForUser(req.userId);
      io.to(req.userId.toString()).emit("navbarUnreadUpdate", { userId: req.userId, totalUnread });
    }

    const messages = await Message.find({ roomId })
      .populate("senderId", "name email")
      .populate("receiverId", "name email")
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ---------- Update offer status (accept / reject) ---------- */
export const updateOfferStatus = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { status }    = req.body; // "accepted" | "rejected"

    if (!["accepted", "rejected"].includes(status))
      return res.status(400).json({ message: "Invalid status" });

    const msg = await Message.findById(messageId);
    if (!msg)           return res.status(404).json({ message: "Message not found" });
    if (msg.type !== "offer")
      return res.status(400).json({ message: "Not an offer message" });

    // Only the receiver can accept/reject an offer
    if (msg.receiverId.toString() !== req.userId)
      return res.status(403).json({ message: "Only the offer recipient can respond" });

    msg.offerStatus = status;
    await msg.save();

    // Sync with the freelancer's Bid document via Conversation currentBidId
    const gig = await Gig.findById(msg.gigId);
    if (!gig) return res.status(404).json({ message: "Gig not found" });

    const bidderId = gig.ownerId.toString() === msg.senderId.toString() ? msg.receiverId : msg.senderId;
    const Conversation = (await import("../models/conversation.js")).default;
    const Bid = (await import("../models/bid.js")).default;

    // Guard: check if any other bid is already hired
    const conflictingBid = await Bid.findOne({ 
      gigId: gig._id, 
      status: "hired" 
    });
    if (conflictingBid) {
      return res.status(409).json({ message: "Another freelancer has already been hired for this gig." });
    }

    const conversation = await Conversation.findOne({ roomId: msg.roomId });

    let bid;
    if (conversation && conversation.currentBidId) {
      bid = await Bid.findById(conversation.currentBidId);
    } else {
      bid = await Bid.findOne({ gigId: gig._id, bidderId });
    }

    if (bid) {
      bid.price = msg.price;
      if (status === "accepted") {
        bid.status = "payment_pending";
      } else {
        bid.status = "rejected";
      }
      await bid.save();
      
      const { syncBidToConversation } = await import("../utils/conversationHelper.js");
      await syncBidToConversation(bid);
    }

    // Direct real-time update of chat UI offer bubble
    if (io) {
      io.to(msg.roomId).emit("offerUpdated", { messageId: msg._id, status });
    }

    // Notify the sender about the update
    const { notifyUser } = await import("../utils/notifyUser.js");
    const isSenderOwner = gig.ownerId.toString() === msg.senderId.toString();
    const role = isSenderOwner ? "client" : "freelancer";

    await notifyUser({
      senderId: req.userId,
      receiverId: msg.senderId,
      type: status === "accepted" ? "BID_ACCEPTED" : "BID_REJECTED",
      title: status === "accepted" ? "Offer Accepted" : "Offer Declined",
      message: status === "accepted"
        ? `Your offer of $${msg.price} on "${gig.title}" has been accepted.`
        : `Your offer of $${msg.price} on "${gig.title}" was declined.`,
      link: "/profile",
      meta: { role, gigId: gig._id, bidId: bid?._id }
    });

    if (status === "accepted" && bid && gig.ownerId.toString() === req.userId) {
      const User = (await import("../models/user.js")).default;
      const otherUser = await User.findById(msg.senderId);

      const checkoutData = {
        gig: {
          _id:          gig._id,
          title:        gig.title,
          image:        gig.image,
          price:        msg.price,
          deliveryTime: gig.deliveryTime,
          ownerId:      { name: otherUser?.name || 'Freelancer' }
        },
        bid: {
          _id:   bid._id,
          price: msg.price
        }
      };
      return res.json({ msg, checkoutData });
    }

    res.json({ msg });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ---------- Get unread message count for user ---------- */
export const getUnreadMessageCount = async (req, res) => {
  try {
    const { getUnreadCountForUser } = await import("../utils/conversationHelper.js");
    const count = await getUnreadCountForUser(req.userId);
    res.json({ unreadCount: count });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ---------- Get conversation details by roomId ---------- */
export const getConversationDetails = async (req, res) => {
  try {
    const { roomId } = req.params;
    const Conversation = (await import("../models/conversation.js")).default;
    
    let conversation = await Conversation.findOne({ roomId })
      .populate("gigId", "title price image")
      .populate("clientId", "name email")
      .populate("freelancerId", "name email")
      .populate("currentBidId", "status price message")
      .lean();

    if (!conversation) {
      // Fallback for brand new rooms: parse roomId and dynamically construct mock conversation details on backend
      const parts = roomId.split("_");
      if (parts.length === 3) {
        const userA = parts[0];
        const userB = parts[1];
        const gigId = parts[2];

        const isParticipant = req.userId.toString() === userA || req.userId.toString() === userB;
        if (!isParticipant) {
          return res.status(403).json({ message: "Not authorized to access this conversation" });
        }

        const User = (await import("../models/user.js")).default;
        const Gig = (await import("../models/gig.js")).default;
        const Bid = (await import("../models/bid.js")).default;

        const otherUserId = req.userId.toString() === userA ? userB : userA;
        const otherUser = await User.findById(otherUserId).select("name email");
        const gig = await Gig.findById(gigId).select("title price image");
        
        // Lookup standard bid for this freelancer + gig
        const freelancerId = req.userId.toString() === userA ? userB : userA;
        const bid = await Bid.findOne({ gigId, bidderId: freelancerId, status: "pending" });

        const mockRoom = {
          _id: roomId,
          roomId,
          gigId,
          gig,
          senderId: req.userId.toString() === userA ? userA : userB,
          receiverId: req.userId.toString() === userA ? userB : userA,
          lastMessage: null,
          unreadCount: 0,
          otherUser,
          bidHistory: [],
          currentBidId: bid
        };
        return res.json(mockRoom);
      } else {
        return res.status(404).json({ message: "Conversation not found" });
      }
    }

    // Verify authorized user
    const isClient = conversation.clientId?._id?.toString() === req.userId.toString();
    const isFreelancer = conversation.freelancerId?._id?.toString() === req.userId.toString();
    if (!isClient && !isFreelancer) {
      return res.status(403).json({ message: "Not authorized to access this conversation" });
    }

    const otherUser = isClient ? conversation.freelancerId : conversation.clientId;
    const unreadCount = isClient ? (conversation.unreadCount?.client || 0) : (conversation.unreadCount?.freelancer || 0);

    const formatted = {
      _id: conversation.roomId,
      conversationId: conversation._id,
      roomId: conversation.roomId,
      gigId: conversation.gigId?._id || conversation.gigId,
      gig: conversation.gigId,
      senderId: conversation.clientId?._id || conversation.clientId,
      receiverId: conversation.freelancerId?._id || conversation.freelancerId,
      lastMessage: conversation.lastMessage,
      unreadCount,
      otherUser,
      bidHistory: conversation.bidHistory,
      currentBidId: conversation.currentBidId
    };

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};