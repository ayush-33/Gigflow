import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
{
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  type: {
    type: String,
    enum: [
      // Primary types (uppercase, canonical)
      "BID_SUBMITTED",
      "BID_ACCEPTED",
      "BID_REJECTED",
      "NEW_BID",
      "NEW_MESSAGE",
      "PROJECT_AWARDED",
      "PROJECT_COMPLETED",
      "PAYMENT_RECEIVED",
      "CONTRACT_STARTED",
      "GIG_DELETED",
      "COUNTER_OFFER_RECEIVED",
      "GIG_HIRED",
      "ORDER_COMPLETED",
      "WORK_SUBMITTED",
      "WORK_APPROVED",
      "REVISIONS_REQUESTED",
      // Legacy/lowercase aliases (kept for backward-compat)
      "message",
      "offer",
      "bid_accepted",
      "bid_rejected",
      "payment_received",
      "bidAccepted",
      "bidRejected",
    ],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  body: {
    type: String
  },
  link: {
    type: String,
    default: "/"
  },
  isRead: {
    type: Boolean,
    default: false
  },
  read: {
    type: Boolean,
    default: false
  },
  meta: {
    type: mongoose.Schema.Types.Mixed
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

notificationSchema.virtual("notificationId").get(function() {
  return this._id.toHexString();
});

export default mongoose.model("Notification", notificationSchema);