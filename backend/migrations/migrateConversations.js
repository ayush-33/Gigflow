import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the backend folder
dotenv.config({ path: path.join(__dirname, "../.env") });

import Message from "../models/message.js";
import Bid from "../models/bid.js";
import Gig from "../models/gig.js";
import Conversation from "../models/conversation.js";

const migrate = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error("Error: MONGO_URI is not defined in your environment variables.");
      process.exit(1);
    }

    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected successfully.");

    console.log("Fetching all messages...");
    const messages = await Message.find({});
    console.log(`Found ${messages.length} messages.`);

    // Group existing messages by roomId + gigId
    const groups = {};
    for (const msg of messages) {
      if (!msg.roomId || !msg.gigId || !msg.senderId || !msg.receiverId) {
        console.log(`Skipping invalid or incomplete message: ${msg._id}`);
        continue;
      }
      
      const parts = msg.roomId.split("_");
      let userA, userB;
      if (parts.length === 3) {
        userA = parts[1];
        userB = parts[2];
      } else if (parts.length === 2) {
        userA = parts[0];
        userB = parts[1];
      } else {
        // Fallback: derive from sender/receiver
        userA = msg.senderId.toString();
        userB = msg.receiverId.toString();
      }
      
      const sortedPair = [userA, userB].sort().join("_");
      const expectedRoomId = `${sortedPair}_${msg.gigId.toString()}`;

      if (!groups[expectedRoomId]) {
        groups[expectedRoomId] = {
          roomId: expectedRoomId,
          gigId: msg.gigId,
          userA,
          userB,
          messages: []
        };
      }
      groups[expectedRoomId].messages.push(msg);
    }

    console.log(`Grouped messages into ${Object.keys(groups).length} distinct rooms.`);

    let migrationCount = 0;

    for (const roomId of Object.keys(groups)) {
      const group = groups[roomId];
      const gig = await Gig.findById(group.gigId);
      if (!gig) {
        console.log(`Warning: Gig ${group.gigId} not found in database for room ${roomId}, skipping...`);
        continue;
      }

      const clientId = gig.ownerId.toString();
      const freelancerId = group.userA.toString() === clientId ? group.userB.toString() : group.userA.toString();

      // Find all historical bids for this freelancer + gig, sorted chronologically
      const bids = await Bid.find({ gigId: group.gigId, bidderId: freelancerId }).sort({ createdAt: 1 });

      let currentBidId = null;
      const bidHistory = [];
      if (bids.length > 0) {
        currentBidId = bids[bids.length - 1]._id;
        for (const bid of bids) {
          bidHistory.push({
            bidId: bid._id,
            price: bid.price,
            status: bid.status,
            submittedAt: bid.createdAt
          });
        }
      }

      // Find or create conversation
      let conversation = await Conversation.findOne({
        gigId: group.gigId,
        clientId,
        freelancerId
      });
      if (!conversation) {
        conversation = new Conversation({
          roomId,
          gigId: group.gigId,
          clientId,
          freelancerId,
          currentBidId,
          bidHistory,
          unreadCount: { client: 0, freelancer: 0 }
        });
      } else {
        // Update roomId, history, and current bid on existing
        conversation.roomId = roomId;
        conversation.currentBidId = currentBidId;
        conversation.bidHistory = bidHistory;
      }

      // Sort messages chronologically to extract last message details
      const groupMsgs = group.messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      const lastMsg = groupMsgs[groupMsgs.length - 1];

      conversation.lastMessage = {
        _id: lastMsg._id,
        type: lastMsg.type,
        message: lastMsg.message,
        price: lastMsg.price,
        offerStatus: lastMsg.offerStatus,
        status: lastMsg.status,
        isRead: lastMsg.isRead,
        readAt: lastMsg.readAt,
        createdAt: lastMsg.createdAt,
        senderId: lastMsg.senderId,
        receiverId: lastMsg.receiverId
      };
      conversation.lastMessageAt = lastMsg.createdAt;

      // Recompute unread counts
      let unreadClient = 0;
      let unreadFreelancer = 0;
      for (const m of groupMsgs) {
        if (!m.isRead) {
          if (m.receiverId.toString() === clientId) {
            unreadClient++;
          } else if (m.receiverId.toString() === freelancerId) {
            unreadFreelancer++;
          }
        }
      }
      conversation.unreadCount = {
        client: unreadClient,
        freelancer: unreadFreelancer
      };

      await conversation.save();

      // Update room ID and backfill conversationId on messages
      await Message.updateMany(
        { _id: { $in: groupMsgs.map(m => m._id) } },
        { $set: { conversationId: conversation._id, roomId } }
      );

      migrationCount++;
    }

    console.log(`Migration complete. Successfully processed ${migrationCount} conversations.`);
    mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("Migration script failed:", error);
    process.exit(1);
  }
};

migrate();
