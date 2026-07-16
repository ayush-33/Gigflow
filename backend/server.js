import dotenv from "dotenv";
dotenv.config();

import fs from "fs";

if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

import authRoutes from "./routes/authRoutes.js";
import gigRoutes from "./routes/gigRoutes.js";
import bidRoutes from "./routes/bidRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import savedGigRoutes from "./routes/savedGigRoutes.js";
import Message from "./models/message.js";
import chatRoutes from "./routes/chatRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import conversationRoutes from "./routes/conversationRoutes.js";

const app = express();
const httpServer = createServer(app);

export const io = new Server(httpServer, {
  cors: { origin: ["http://localhost:5173", "http://localhost:5174"], credentials: true }
});

/* ─────────────────────────
   🔐 SOCKET AUTH
───────────────────────── */
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error("No token"));

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    socket.userId = decoded.id;
    next();
  } catch {
    next(new Error("Invalid token"));
  }
});

/* ─────────────────────────
   🔌 SOCKET CONNECTION
───────────────────────── */
io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.userId}`);

  // ✅ personal room (for notifications)
  socket.join(socket.userId.toString());

  // ✅ mark any sent messages as delivered since the user is now connected
  (async () => {
    try {
      const sentMsgs = await Message.find({ receiverId: socket.userId, status: "sent" });
      if (sentMsgs.length > 0) {
        await Message.updateMany(
          { receiverId: socket.userId, status: "sent" },
          { $set: { status: "delivered" } }
        );
        // Notify senders that their messages are now delivered
        const senders = [...new Set(sentMsgs.map(m => m.senderId.toString()))];
        senders.forEach(senderId => {
          io.to(senderId).emit("messagesDelivered", {
            receiverId: socket.userId,
            roomId: sentMsgs.find(m => m.senderId.toString() === senderId)?.roomId
          });
        });
      }
    } catch (e) {
      console.error("Error updating message statuses to delivered:", e.message);
    }
  })();

  /* ─────────────────────────
     🧩 CHAT ROOMS
  ───────────────────────── */
  socket.on("joinRoom", (roomId) => {
    if (!roomId) return;
    socket.join(roomId);
  });

  socket.on("markSeen", async ({ roomId }) => {
    if (!roomId || !socket.userId) return;
    
    // Mark received messages in this room as read
    await Message.updateMany(
      { roomId, receiverId: socket.userId, isRead: false },
      { $set: { isRead: true, readAt: new Date(), status: "read" } }
    );

    io.to(roomId).emit("messagesSeen", {
      roomId,
      userId: socket.userId,
    });

    try {
      const Conversation = (await import("./models/conversation.js")).default;
      const conversation = await Conversation.findOne({ roomId });
      if (conversation) {
        const isClient = conversation.clientId.toString() === socket.userId.toString();
        const role = isClient ? "client" : "freelancer";
        conversation.unreadCount[role] = 0;
        await conversation.save();

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
        const { getUnreadCountForUser } = await import("./utils/conversationHelper.js");
        const totalUnread = await getUnreadCountForUser(socket.userId);
        io.to(socket.userId.toString()).emit("navbarUnreadUpdate", { userId: socket.userId, totalUnread });
      }
    } catch (e) {
      console.error("Error in markSeen socket handler:", e.message);
    }
  });

  socket.on("leaveRoom", (roomId) => {
    if (!roomId) return;
    socket.leave(roomId);
  });

  /* ─────────────────────────
     💬 SEND MESSAGE
  ───────────────────────── */
  socket.on("sendMessage", async (data) => {
    try {
      const { roomId, gigId, receiverId, type, message, price } = data;

      // ✅ validation
      if (!roomId) {
        return socket.emit("messageError", { error: "Invalid room" });
      }

      if (!message && type !== "offer") {
        return socket.emit("messageError", { error: "Message cannot be empty" });
      }

      const Conversation = (await import("./models/conversation.js")).default;
      const conversation = await Conversation.findOne({ roomId });
      if (!conversation) {
        return socket.emit("messageError", { error: "Conversation not found" });
      }

      // Authorization check
      const isClient = conversation.clientId.toString() === socket.userId.toString();
      const isFreelancer = conversation.freelancerId.toString() === socket.userId.toString();
      if (!isClient && !isFreelancer) {
        return socket.emit("messageError", { error: "Not authorized: you are not a participant in this conversation" });
      }

      const otherUserId = isClient ? conversation.freelancerId : conversation.clientId;

      const receiverSockets = await io.in(otherUserId.toString()).fetchSockets();
      const isOnline = receiverSockets.length > 0;

      const roomSockets = await io.in(roomId).fetchSockets();
      const isReceiverInRoom = roomSockets.some(s => s.userId?.toString() === otherUserId.toString());

      const initialStatus = isReceiverInRoom ? "read" : (isOnline ? "delivered" : "sent");
      const isRead = initialStatus === "read";
      const readAt = isRead ? new Date() : null;

      const newMsg = await Message.create({
        conversationId: conversation._id,
        roomId,
        gigId: conversation.gigId,
        senderId: socket.userId,
        receiverId: otherUserId,
        type: type || "text",
        message: message || (type === "offer" ? `I can do this for $${price}` : ""),
        price: price || null,
        offerStatus: type === "offer" ? "pending" : null,
        status: initialStatus,
        isRead,
        readAt
      });

      const populated = await newMsg.populate("senderId", "name email");
      await populated.populate("receiverId", "name email");

      // Update Bid document if it's a price offer
      if (type === "offer") {
        const Bid = (await import("./models/bid.js")).default;
        let bid;
        if (conversation.currentBidId) {
          bid = await Bid.findById(conversation.currentBidId);
        } else {
          bid = await Bid.findOne({ gigId: conversation.gigId, bidderId: conversation.freelancerId });
        }

        if (bid) {
          bid.price = Number(price);
          bid.status = "countered";
          bid.lastOfferBy = socket.userId;
          bid.negotiationHistory.push({
            price: Number(price),
            message: message?.trim() || `Proposed a price offer of $${price}`,
            senderId: socket.userId,
            timestamp: new Date()
          });
          await bid.save();
          
          const { syncBidToConversation } = await import("./utils/conversationHelper.js");
          await syncBidToConversation(bid);
        }
      }

      // Update Conversation denormalized preview and unread count
      conversation.lastMessage = {
        _id: newMsg._id,
        type: newMsg.type,
        message: newMsg.message,
        price: newMsg.price,
        offerStatus: newMsg.offerStatus,
        status: newMsg.status,
        isRead,
        readAt,
        createdAt: newMsg.createdAt,
        senderId: newMsg.senderId,
        receiverId: newMsg.receiverId
      };
      conversation.lastMessageAt = newMsg.createdAt;
      
      const receiverRole = conversation.clientId.toString() === otherUserId.toString() ? "client" : "freelancer";
      if (!isReceiverInRoom) {
        conversation.unreadCount[receiverRole] += 1;
      }
      await conversation.save();

      // ✅ send to chat room
      io.to(roomId).emit("receiveMessage", populated);

      // ✅ send to receiver's personal room
      io.to(otherUserId.toString()).emit("newMessage", populated);

      // ✅ Emit conversationUpdated event
      const eventPayload = {
        conversationId: conversation._id,
        roomId,
        lastMessage: conversation.lastMessage,
        lastMessageAt: conversation.lastMessageAt,
        unreadCount: conversation.unreadCount,
        currentBidId: conversation.currentBidId ? {
          _id: conversation.currentBidId
        } : null
      };
      io.to(conversation.clientId.toString()).emit("conversationUpdated", eventPayload);
      io.to(conversation.freelancerId.toString()).emit("conversationUpdated", eventPayload);

      // ✅ Emit navbarUnreadUpdate for the receiver
      const { getUnreadCountForUser } = await import("./utils/conversationHelper.js");
      const totalUnread = await getUnreadCountForUser(otherUserId);
      io.to(otherUserId.toString()).emit("navbarUnreadUpdate", { userId: otherUserId, totalUnread });

      // ✅ send notification to receiver (only for offers / counters)
      if (type === "offer") {
        try {
          const senderName = populated.senderId?.name || "Someone";
          const { notifyUser } = await import("./utils/notifyUser.js");
          const role = receiverRole;

          await notifyUser({
            senderId: socket.userId,
            receiverId: otherUserId,
            type: "COUNTER_OFFER_RECEIVED",
            title: "Counter Offer Received",
            message: `${senderName} proposed a price offer of $${price}`,
            link: "/profile",
            meta: { roomId, gigId: conversation.gigId, role },
          });
        } catch (e) {
          console.error("Notification error:", e.message);
        }
      }

    } catch (err) {
      socket.emit("messageError", { error: err.message });
    }
  });

  /* ─────────────────────────
     🤝 OFFER UPDATE
  ───────────────────────── */
  socket.on("offerUpdate", async ({ messageId, status, roomId }) => {
    try {
      // ✅ validate status
      if (!["accepted", "rejected"].includes(status)) return;

      const msg = await Message.findById(messageId);
      if (!msg) return;

      msg.offerStatus = status;
      await msg.save();

      // update chat UI
      io.to(roomId).emit("offerUpdated", { messageId, status });

      // notify sender
      io.to(msg.senderId.toString()).emit("newNotification", {
        type: "offer",
        message: `Your offer was ${status}`,
      });

    } catch (err) {
      socket.emit("messageError", { error: err.message });
    }
  });

  /* ─────────────────────────
     ✍️ TYPING INDICATOR
  ───────────────────────── */
  socket.on("typing", ({ roomId, userName }) => {
    if (!roomId) return;
    socket.to(roomId).emit("userTyping", { userName });
  });

  socket.on("stopTyping", ({ roomId }) => {
    if (!roomId) return;
    socket.to(roomId).emit("userStopTyping");
  });

  /* ─────────────────────────
     ❌ DISCONNECT
  ───────────────────────── */
  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.userId}`);
  });
});

/* ─────────────────────────
   🌐 MIDDLEWARE
───────────────────────── */
app.use(cors({ origin: ["http://localhost:5173", "http://localhost:5174"], credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* ─────────────────────────
   🛣 ROUTES
───────────────────────── */
app.use("/api/auth", authRoutes);
app.use("/api/gigs", gigRoutes);
app.use("/api/bids", bidRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/saved-gigs", savedGigRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/orders", orderRoutes);

app.get("/", (req, res) => res.send("GigFlow Backend Running"));

/* ─────────────────────────
   🗄 DATABASE
───────────────────────── */
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

if (process.env.NODE_ENV !== "test") {
  const PORT = process.env.PORT || 5000;
  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}