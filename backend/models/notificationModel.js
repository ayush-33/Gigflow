import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
{
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  message: {
    type: String,
  },
  title:  { type: String },
  body:   { type: String },
  meta:   { type: mongoose.Schema.Types.Mixed },

  type: {
    type: String,
    enum: ["bidAccepted", "bidRejected", "message", "bid_accepted", "bid_rejected", "payment_received", "offer"],
  },

  link: {
    type: String
  },

  isRead: {
    type: Boolean,
    default: false
  },
  read: {
    type: Boolean,
    default: false
  }

}, { timestamps: true });

export default mongoose.model("Notification", notificationSchema);