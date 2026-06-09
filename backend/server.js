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

  /* ─────────────────────────
     🧩 CHAT ROOMS
  ───────────────────────── */
  socket.on("joinRoom", (roomId) => {
    if (!roomId) return;
    socket.join(roomId);
  });

  socket.on("markSeen", async ({ roomId }) => {
    if (!roomId || !socket.userId) return;
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

      const newMsg = await Message.create({
        roomId,
        gigId,
        senderId: socket.userId,
        receiverId,
        type: type || "text",
        message,
        price: price || null,
        offerStatus: type === "offer" ? "pending" : null,
      });

      const populated = await newMsg.populate("senderId", "name email");
      await populated.populate("receiverId", "name email");

      // ✅ send to chat room
      io.to(roomId).emit("receiveMessage", populated);

      // ✅ send notification to receiver
      if (receiverId) {
        try {
          const senderName = populated.senderId?.name || "Someone";
          const Notification = (await import("./models/notificationModel.js")).default;
          const notif = await Notification.create({
            userId: receiverId,
            type: "message",
            title: `New message from ${senderName}`,
            body: type === "offer"
              ? `Sent a price offer of $${price}`
              : (message || "").slice(0, 80),
            link: "/chat",
            meta: { roomId, gigId },
          });
          io.to(receiverId.toString()).emit("newNotification", notif);
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

/* ─────────────────────────
   🗄 DATABASE
───────────────────────── */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
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