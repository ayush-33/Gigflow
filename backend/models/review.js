import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
  gigId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Gig",
    required: true
  },
  reviewerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  bidId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Bid",
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    required: true,
    trim: true,
    minlength: 10,
    maxlength: 1000
  }
}, { timestamps: true });

// One review per buyer per gig
reviewSchema.index({ gigId: 1, reviewerId: 1 }, { unique: true });

export default mongoose.model("Review", reviewSchema);