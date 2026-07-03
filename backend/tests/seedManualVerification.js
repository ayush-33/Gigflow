import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
dotenv.config({ path: path.join(__dirname, "../.env") });

import User from "../models/user.js";
import Gig from "../models/gig.js";
import Bid from "../models/bid.js";
import Conversation from "../models/conversation.js";
import Notification from "../models/notificationModel.js";
import Order from "../models/Order.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/gigflowdb";

const seed = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB for seeding...");

    // Clean tables
    await User.deleteMany({ email: { $in: ["client-v@test.com", "free-a@test.com", "free-b@test.com"] } });
    await Gig.deleteMany({ title: "Verification Web Project" });
    await Order.deleteMany({});
    await Notification.deleteMany({});
    
    // Create users
    const client = await User.create({
      name: "Client Verification",
      email: "client-v@test.com",
      password: "password123",
      role: "buyer"
    });

    const freeA = await User.create({
      name: "Freelancer A",
      email: "free-a@test.com",
      password: "password123",
      role: "seller"
    });

    const freeB = await User.create({
      name: "Freelancer B",
      email: "free-b@test.com",
      password: "password123",
      role: "seller"
    });

    // Create Gig
    const gig = await Gig.create({
      ownerId: client._id,
      title: "Verification Web Project",
      description: "Need a beautiful React web app designed and developed in Vite.",
      price: 500,
      deliveryTime: 7,
      category: "web-development",
      status: "open"
    });

    // Place Bid A (Accepted/Payment Pending)
    const bidA = await Bid.create({
      gigId: gig._id,
      bidderId: freeA._id,
      price: 450,
      message: "I can build your Vite React app with premium HSL tailormade styles.",
      status: "payment_pending"
    });

    // Create Conversation for A
    const roomIdA = [client._id.toString(), freeA._id.toString()].sort().join("_") + "_" + gig._id.toString();
    const convA = await Conversation.create({
      roomId: roomIdA,
      gigId: gig._id,
      clientId: client._id,
      freelancerId: freeA._id,
      currentBidId: bidA._id,
      bidHistory: [{
        bidId: bidA._id,
        price: bidA.price,
        status: bidA.status,
        submittedAt: new Date()
      }]
    });

    // Create Notification for A accepted
    await Notification.create({
      userId: freeA._id,
      receiverId: freeA._id,
      senderId: client._id,
      type: "BID_ACCEPTED",
      title: "Bid Accepted",
      message: `Your bid on "${gig.title}" has been accepted.`,
      link: "/profile",
      meta: { role: "freelancer", bidId: bidA._id, gigId: gig._id }
    });

    // Place Bid B (Countered)
    const bidB = await Bid.create({
      gigId: gig._id,
      bidderId: freeB._id,
      price: 480,
      message: "I have 5 years experience with Vite and Socket.io.",
      status: "countered",
      lastOfferBy: client._id
    });

    // Create Conversation for B
    const roomIdB = [client._id.toString(), freeB._id.toString()].sort().join("_") + "_" + gig._id.toString();
    const convB = await Conversation.create({
      roomId: roomIdB,
      gigId: gig._id,
      clientId: client._id,
      freelancerId: freeB._id,
      currentBidId: bidB._id,
      bidHistory: [{
        bidId: bidB._id,
        price: bidB.price,
        status: bidB.status,
        submittedAt: new Date()
      }]
    });

    // Create Notification for B countered
    await Notification.create({
      userId: freeB._id,
      receiverId: freeB._id,
      senderId: client._id,
      type: "COUNTER_OFFER_RECEIVED",
      title: "Counter Offer Received",
      message: `You received a counter offer of $480 on "${gig.title}".`,
      link: "/profile",
      meta: { role: "freelancer", bidId: bidB._id, gigId: gig._id }
    });

    console.log("Seeding complete!");
    console.log("Client V: client-v@test.com / password123");
    console.log("Freelancer A: free-a@test.com / password123");
    console.log("Freelancer B: free-b@test.com / password123");
    
    mongoose.connection.close();
  } catch (err) {
    console.error("Seeding failed:", err);
    process.exit(1);
  }
};

seed();
