import Message from "../models/message.js";
import Gig from "../models/gig.js";

/* ── Build roomId (deterministic, order-independent) ── */
export const buildRoomId = (gigId, userA, userB) => {
  const sorted = [userA.toString(), userB.toString()].sort().join("_");
  return `${gigId}_${sorted}`;
};

/* ---------- Get chat rooms for current user ---------- */
// Returns list of distinct rooms the user participates in, with last message
export const getMyChatRooms = async (req, res) => {
  try {
    // Find all distinct roomIds where user is sender or receiver
    const rooms = await Message.aggregate([
      {
        $match: {
          $or: [
            { senderId:   { $eq: req.userId } },
            { receiverId: { $eq: req.userId } },
          ],
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id:         "$roomId",
          lastMessage: { $first: "$$ROOT" },
          gigId:       { $first: "$gigId" },
          senderId:    { $first: "$senderId" },
          receiverId:  { $first: "$receiverId" },
        },
      },
      { $sort: { "lastMessage.createdAt": -1 } },
    ]);

    // Populate gig + other user info
    const populated = await Promise.all(
      rooms.map(async (room) => {
        const gig = await Gig.findById(room.gigId).select("title price image").lean();
        return { ...room, gig };
      })
    );

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ---------- Get messages for a room ---------- */
export const getRoomMessages = async (req, res) => {
  try {
    const { roomId } = req.params;

    // Security: user must be part of this room
    const first = await Message.findOne({ roomId });
    if (first) {
      const isParticipant =
        first.senderId.toString()   === req.userId ||
        first.receiverId.toString() === req.userId;
      if (!isParticipant)
        return res.status(403).json({ message: "Not authorized to view this chat" });
    }

    const messages = await Message.find({ roomId })
      .populate("senderId", "name")
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ---------- Update offer status (accept / reject) ---------- */
export const updateOfferStatus = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { status }    = req.body; // "accepted" | "rejected"

    if (!["accepted", "rejected"].includes(status))
      return res.status(400).json({ message: "Invalid status" });

    const msg = await Message.findById(messageId);
    if (!msg)           return res.status(404).json({ message: "Message not found" });
    if (msg.type !== "offer")
      return res.status(400).json({ message: "Not an offer message" });

    // Only the receiver can accept/reject an offer
    if (msg.receiverId.toString() !== req.userId)
      return res.status(403).json({ message: "Only the offer recipient can respond" });

    msg.offerStatus = status;
    await msg.save();

    res.json(msg);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};