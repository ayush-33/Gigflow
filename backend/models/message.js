import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    roomId:     { type: String, required: true, index: true },
    gigId:      { type: mongoose.Schema.Types.ObjectId, ref: "Gig", required: true },
    senderId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type:       { type: String, enum: ["text", "offer", "system"], default: "text" },
    message:    { type: String, required: true, trim: true },
    price:      { type: Number, default: null },           // only for type="offer"
    offerStatus:{ type: String, enum: ["pending", "accepted", "rejected", "countered"], default: null },
    status:     { type: String, enum: ["sent", "delivered", "read"], default: "sent" },
    isRead:     { type: Boolean, default: false },
    readAt:     { type: Date, default: null }
  },
  { timestamps: true }
);

export default mongoose.model("Message", messageSchema);