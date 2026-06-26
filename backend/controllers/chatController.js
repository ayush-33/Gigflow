import Message from "../models/message.js";
import Gig from "../models/gig.js";
import User from "../models/user.js";
import mongoose from "mongoose";
import { io } from "../server.js";

/* ── Build roomId (deterministic, order-independent) ── */
export const buildRoomId = (gigId, userA, userB) => {
  const sorted = [userA.toString(), userB.toString()].sort().join("_");
  return sorted;
};

/* ---------- Get chat rooms for current user ---------- */
// Returns list of distinct rooms the user participates in, with last message
export const getMyChatRooms = async (req, res) => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(req.userId);

    // Find all distinct roomIds where user is sender or receiver
    const rooms = await Message.aggregate([
      {
        $match: {
          $or: [
            { senderId:   userObjectId },
            { receiverId: userObjectId },
          ],
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id:         "$roomId",
          lastMessage: { $first: "$$ROOT" },
          gigId:       { $first: "$gigId" },
          senderId:    { $first: "$senderId" },
          receiverId:  { $first: "$receiverId" },
        },
      },
      { $sort: { "lastMessage.createdAt": -1 } },
    ]);

    // Populate gig + other user info
    const populated = await Promise.all(
      rooms.map(async (room) => {
        const gig = await Gig.findById(room.gigId).select("title price image").lean();
        
        // Find other user in the room
        const otherUserId = room.senderId.toString() === req.userId.toString() ? room.receiverId : room.senderId;
        const otherUser = await User.findById(otherUserId).select("name email").lean();

        const unreadCount = await Message.countDocuments({
          roomId: room._id,
          receiverId: req.userId,
          isRead: false
        });
        return { ...room, gig, unreadCount, otherUser };
      })
    );

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ---------- Get messages for a room ---------- */
export const getRoomMessages = async (req, res) => {
  try {
    const { roomId } = req.params;

    // Security: user must be part of this room
    const parts = roomId.split("_");
    let user1, user2;
    if (parts.length === 3) {
      user1 = parts[1];
      user2 = parts[2];
    } else if (parts.length === 2) {
      user1 = parts[0];
      user2 = parts[1];
    } else {
      return res.status(400).json({ message: "Invalid room ID" });
    }

    const isParticipant = user1 === req.userId || user2 === req.userId;
    if (!isParticipant) {
      return res.status(403).json({ message: "Not authorized to view this chat" });
    }

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

    // Sync with the freelancer's Bid document
    const gig = await Gig.findById(msg.gigId);
    if (!gig) return res.status(404).json({ message: "Gig not found" });

    const bidderId = gig.ownerId.toString() === msg.senderId.toString() ? msg.receiverId : msg.senderId;
    const Bid = (await import("../models/bid.js")).default;
    const bid = await Bid.findOne({ gigId: gig._id, bidderId });

    if (bid) {
      bid.price = msg.price;
      if (status === "accepted") {
        bid.status = "payment_pending";
      } else {
        bid.status = "rejected";
      }
      await bid.save();
    }

    // Create a persistent system message in conversation history
    const sysMsg = await Message.create({
      roomId: msg.roomId,
      gigId: msg.gigId,
      senderId: req.userId,
      receiverId: msg.senderId,
      type: "system",
      message: status === "accepted"
        ? `Offer of $${msg.price} was accepted.`
        : `Offer of $${msg.price} was declined.`
    });

    if (io) {
      const populatedSys = await sysMsg.populate("senderId", "name email");
      io.to(msg.roomId).emit("receiveMessage", populatedSys);
    }

    // Notify the sender about the update using standard uppercase type enums
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
    const count = await Message.countDocuments({
      receiverId: req.userId,
      isRead: false
    });
    res.json({ unreadCount: count });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};