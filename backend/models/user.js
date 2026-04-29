import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    select: false
  },
  bio: {
    type: String,
    default: "",
    trim: true,
    maxlength: 500
  },
  phone: {
    type: String,
    default: "",
    trim: true
  },

  // ✅ NEW: for dual-token auth
  refreshToken: {
  type: String,
  default: null,
  select: false
},

  // ✅ NEW: role-based access for future use
  role: {
    type: String,
    enum: ["buyer", "seller", "both"],
    default: "both"
  }

}, { timestamps: true });

export default mongoose.model("User", userSchema);