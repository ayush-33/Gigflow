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

import authRoutes from "./routes/authRoutes.js";
import gigRoutes from "./routes/gigRoutes.js";
import bidRoutes from "./routes/bidRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import savedGigRoutes from "./routes/savedGigRoutes.js";
import Message from "./models/message.js";
import chatRoutes from "./routes/chatRoutes.js";

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

      const populated = await newMsg.populate("senderId", "name");

      // ✅ send to chat room
      io.to(roomId).emit("receiveMessage", populated);

      // ✅ send notification to receiver
      if (receiverId) {
        io.to(receiverId.toString()).emit("newNotification", {
          type: "message",
          message: "New message received",
        });
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
app.use("/uploads", express.static("uploads"));

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