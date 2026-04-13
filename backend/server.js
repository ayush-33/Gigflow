import dotenv from "dotenv";
dotenv.config();
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/authRoutes.js";
import gigRoutes from "./routes/gigRoutes.js";
import bidRoutes from "./routes/bidRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";  
import notificationRoutes from "./routes/notificationRoutes.js";


/* ===============================
   TEMP CONFIG (UNBLOCK DEV)
   =============================== */
// ⚠️ This bypasses Windows dotenv issue
// You will still provide .env.example in GitHub
const MONGO_URI = process.env.MONGO_URI;

const app = express();

/* ---------- Debug: Incoming Requests ---------- */
app.use((req, res, next) => {
  console.log("👉 REQUEST RECEIVED:", req.method, req.url);
  next();
});

/* ---------- Middlewares ---------- */
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));

app.use("/uploads", express.static("uploads"));

/* ---------- Routes ---------- */
app.use("/api/auth", authRoutes);
app.use("/api/gigs", gigRoutes);
app.use("/api/bids", bidRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/notifications", notificationRoutes);

/* ---------- Database Connection ---------- */
const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

connectDB();

/* ---------- Test Route ---------- */
app.get("/", (req, res) => {
  res.send("GigFlow Backend Running");
});

/* ---------- Server ---------- */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
