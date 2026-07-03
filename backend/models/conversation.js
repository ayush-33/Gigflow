import mongoose from "mongoose";

const bidHistoryItemSchema = new mongoose.Schema(
  {
    bidId: { type: mongoose.Schema.Types.ObjectId, ref: "Bid", required: true },
    price: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "countered", "payment_pending", "hired", "rejected", "withdrawn", "in_progress", "submitted", "completed"],
      required: true
    },
    submittedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const conversationSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true, unique: true, index: true },
    gigId: { type: mongoose.Schema.Types.ObjectId, ref: "Gig", required: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    freelancerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    currentBidId: { type: mongoose.Schema.Types.ObjectId, ref: "Bid", default: null },
    bidHistory: [bidHistoryItemSchema],
    lastMessage: { type: mongoose.Schema.Types.Mixed, default: null },
    lastMessageAt: { type: Date, default: Date.now },
    unreadCount: {
      client: { type: Number, default: 0 },
      freelancer: { type: Number, default: 0 }
    }
  },
  { timestamps: true }
);

// Compound index to ensure uniqueness per (gig, client, freelancer)
conversationSchema.index({ gigId: 1, clientId: 1, freelancerId: 1 }, { unique: true });

export default mongoose.model("Conversation", conversationSchema);
