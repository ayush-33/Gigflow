import mongoose from "mongoose";

const gigSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },

  category: {
    type: String,
    required: true
  },

  description: {
    type: String,
    required: true
  },

  price: {
    type: Number,
    required: true
  },

  deliveryTime: {
    type: Number,
    required: true
  },

  image: {
    type: String
  },

  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  status: {
    type: String,
    enum: ["open", "assigned"],
    default: "open"
  }

}, { timestamps: true });

export default mongoose.model("Gig", gigSchema);