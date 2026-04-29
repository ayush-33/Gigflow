import mongoose from "mongoose";

const savedGigSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  gigId:  { type: mongoose.Schema.Types.ObjectId, ref: "Gig",  required: true }
}, { timestamps: true });

savedGigSchema.index({ userId: 1, gigId: 1 }, { unique: true });

export default mongoose.model("SavedGig", savedGigSchema);