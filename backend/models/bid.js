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
      enum: ["pending", "payment_pending", "hired", "rejected", "withdrawn"],
      default: "pending"
    }
  },
  { timestamps: true }
);

export default mongoose.model("Bid", bidSchema);
