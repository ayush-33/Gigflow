import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/authRoutes.js";
import gigRoutes from "./routes/gigRoutes.js";
import bidRoutes from "./routes/bidRoutes.js";


/* ===============================
   TEMP CONFIG (UNBLOCK DEV)
   =============================== */
// ⚠️ This bypasses Windows dotenv issue
// You will still provide .env.example in GitHub
const MONGO_URI = "mongodb://127.0.0.1:27017/gigflowdb";

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

/* ---------- Routes ---------- */
app.use("/api/auth", authRoutes);
app.use("/api/gigs", gigRoutes);
app.use("/api/bids", bidRoutes);


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
const PORT = 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
