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

const app = express();
const httpServer = createServer(app);

export const io = new Server(httpServer, {
  cors: { origin: "http://localhost:5173", credentials: true }
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

      // Security check: one must be gig owner, other must be bidder
      const Gig = (await import("./models/gig.js")).default;
      const Bid = (await import("./models/bid.js")).default;

      const gig = await Gig.findById(gigId);
      if (!gig) {
        return socket.emit("messageError", { error: "Gig not found" });
      }

      const userA = socket.userId.toString();
      const userB = receiverId.toString();

      const expectedRoomId = [userA, userB].sort().join("_");
      if (roomId !== expectedRoomId) {
        return socket.emit("messageError", { error: "Not authorized: invalid room ID for these participants" });
      }

      const isUserAOwner = gig.ownerId.toString() === userA;
      const isUserBOwner = gig.ownerId.toString() === userB;

      if (!isUserAOwner && !isUserBOwner) {
        return socket.emit("messageError", { error: "Not authorized: one participant must be the gig owner" });
      }

      const bidderId = isUserAOwner ? userB : userA;
      const bid = await Bid.findOne({ gigId, bidderId });
      if (!bid) {
        return socket.emit("messageError", { error: "Not authorized: freelancer must have bid on this gig" });
      }

      const receiverSockets = await io.in(receiverId.toString()).fetchSockets();
      const isOnline = receiverSockets.length > 0;

      const roomSockets = await io.in(roomId).fetchSockets();
      const isReceiverInRoom = roomSockets.some(s => s.userId?.toString() === receiverId.toString());

      const initialStatus = isReceiverInRoom ? "read" : (isOnline ? "delivered" : "sent");

      const isRead = initialStatus === "read";
      const readAt = isRead ? new Date() : null;

      const newMsg = await Message.create({
        roomId,
        gigId,
        senderId: socket.userId,
        receiverId,
        type: type || "text",
        message,
        price: price || null,
        offerStatus: type === "offer" ? "pending" : null,
        status: initialStatus,
        isRead,
        readAt
      });

      const populated = await newMsg.populate("senderId", "name email");
      await populated.populate("receiverId", "name email");

      // Update Bid document if it's a price offer
      if (type === "offer" && bid) {
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
      }

      // ✅ send to chat room
      io.to(roomId).emit("receiveMessage", populated);

      // ✅ send to receiver's personal room for real-time navbar update
      if (receiverId) {
        io.to(receiverId.toString()).emit("newMessage", populated);
      }

      // ✅ send notification to receiver (only for offers / counters, normal text messages only trigger newMessage socket event)
      if (receiverId && type === "offer") {
        try {
          const senderName = populated.senderId?.name || "Someone";
          const { notifyUser } = await import("./utils/notifyUser.js");
          await notifyUser({
            senderId: socket.userId,
            receiverId,
            type: "COUNTER_OFFER_RECEIVED",
            title: "Counter Offer Received",
            message: `${senderName} proposed a price offer of $${price}`,
            link: "/profile",
            meta: { roomId, gigId },
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
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
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
app.use("/api/orders", orderRoutes);

app.get("/", (req, res) => res.send("GigFlow Backend Running"));

const normalizeRoomIds = async () => {
  try {
    const Message = (await import("./models/message.js")).default;
    const messages = await Message.find({ roomId: { $regex: /_.*_/ } });
    if (messages.length > 0) {
      console.log(`[MIGRATION] Normalizing ${messages.length} messages with 3-part roomIds...`);
      let count = 0;
      for (const msg of messages) {
        const parts = msg.roomId.split("_");
        if (parts.length === 3) {
          msg.roomId = [parts[1], parts[2]].sort().join("_");
          await msg.save();
          count++;
        }
      }
      console.log(`[MIGRATION] Normalization complete. ${count} messages updated.`);
    }
  } catch (err) {
    console.error("[MIGRATION] Error normalizing room IDs:", err);
  }
};

/* ─────────────────────────
   🗄 DATABASE
───────────────────────── */
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    normalizeRoomIds();
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

/* ─────────────────────────
   🚀 SERVER START
───────────────────────── */
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});