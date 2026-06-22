import mongoose from "mongoose";

const bidSchema = new mongoose.Schema(
  {
    gigId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Gig",
      required: true
    },
    bidderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    message: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ["pending", "countered", "payment_pending", "hired", "rejected", "withdrawn", "in_progress", "submitted", "completed"],
      default: "pending"
    },
    lastOfferBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    revisionNotes: {
      type: String,
      default: ""
    },
    revisionHistory: [
      {
        notes: { type: String, required: true },
        senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        timestamp: { type: Date, default: Date.now }
      }
    ],
    negotiationHistory: [
      {
        price: { type: Number, required: true },
        message: { type: String, required: true },
        senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        timestamp: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

export default mongoose.model("Bid", bidSchema);
