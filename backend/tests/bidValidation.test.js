process.env.NODE_ENV = "test";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import assert from "assert";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
dotenv.config({ path: path.join(__dirname, "../.env") });

import User from "../models/user.js";
import Gig from "../models/gig.js";
import Bid from "../models/bid.js";
import Conversation from "../models/conversation.js";
import Message from "../models/message.js";

// Mock controller request context and run logic directly
import { createBid, acceptBid, rejectBid, withdrawBid, counterBid } from "../controllers/bidController.js";
import { syncBidToConversation } from "../utils/conversationHelper.js";

const setupTestDB = async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is missing from env variables.");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB for testing.");
};

const clearSandbox = async () => {
  // Clear any existing test data to ensure clean sandbox runs
  await User.deleteMany({ email: { $regex: /@test-gigflow\.com$/ } });
  await Gig.deleteMany({ title: { $regex: /^Test Gig/ } });
  // Note: bids and conversations will be cleared via their refs if needed, or simply delete all
  await Bid.deleteMany({});
  await Conversation.deleteMany({});
  await Message.deleteMany({});
};

const runTests = async () => {
  try {
    await setupTestDB();
    await clearSandbox();

    console.log("-----------------------------------------");
    console.log("🚀 STARTING BID & CONVERSATION TEST SUITE");
    console.log("-----------------------------------------");

    // 1. Create Test Client & Freelancer
    const client = await User.create({
      name: "Test Client",
      email: "client@test-gigflow.com",
      password: "password123",
      role: "buyer"
    });

    const freelancer = await User.create({
      name: "Test Freelancer",
      email: "freelancer@test-gigflow.com",
      password: "password123",
      role: "seller"
    });

    const otherFreelancer = await User.create({
      name: "Other Freelancer",
      email: "other@test-gigflow.com",
      password: "password123",
      role: "seller"
    });

    // 2. Create Test Gig
    const gig = await Gig.create({
      title: "Test Gig Title",
      description: "This is a detailed description of the test gig, must be long.",
      price: 200,
      deliveryTime: 5,
      ownerId: client._id,
      category: "Design",
      status: "open"
    });

    // 3. Test: First Bid Placement (Creates Conversation)
    console.log("👉 Test 1: First Bid Placement...");
    let req = {
      userId: freelancer._id.toString(),
      body: {
        gigId: gig._id.toString(),
        price: 150,
        message: "Hi, I can do this job perfectly for you."
      }
    };
    let res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.data = data;
        return this;
      }
    };

    await createBid(req, res);
    assert.strictEqual(res.statusCode, 201, "First bid creation should return 201 status code.");
    const firstBid = res.data;
    assert.strictEqual(firstBid.price, 150, "First bid price should be 150.");

    // Verify conversation was created
    const expectedRoomId = [client._id.toString(), freelancer._id.toString()].sort().join("_") + "_" + gig._id.toString();
    const conv1 = await Conversation.findOne({ roomId: expectedRoomId });
    assert.ok(conv1, "Conversation should be created on first bid placement.");
    assert.strictEqual(conv1.clientId.toString(), client._id.toString(), "Client ID should match.");
    assert.strictEqual(conv1.freelancerId.toString(), freelancer._id.toString(), "Freelancer ID should match.");
    assert.strictEqual(conv1.currentBidId.toString(), firstBid._id.toString(), "Current bid should point to first bid.");
    assert.strictEqual(conv1.bidHistory.length, 1, "Bid history should contain 1 bid.");
    assert.strictEqual(conv1.bidHistory[0].bidId.toString(), firstBid._id.toString(), "Bid ID in history should match.");
    assert.strictEqual(conv1.bidHistory[0].price, 150);
    assert.strictEqual(conv1.bidHistory[0].status, "pending");

    console.log("✅ First bid & conversation creation passed.");

    // 4. Test: Block Duplicate Pending Bid
    console.log("👉 Test 2: Blocking Duplicate Pending Bid...");
    req.body.price = 160;
    res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.data = data;
        return this;
      }
    };

    await createBid(req, res);
    assert.strictEqual(res.statusCode, 400, "Should block duplicate pending bid.");
    assert.match(res.data.message, /already have a pending bid/i, "Error message should mention pending bid.");

    console.log("✅ Block duplicate pending bid passed.");

    // 5. Test: Withdraw Bid & syncBidToConversation helper
    console.log("👉 Test 3: Withdraw Bid and Sync Helper...");
    req = {
      userId: freelancer._id.toString(),
      params: { bidId: firstBid._id.toString() }
    };
    res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.data = data;
        return this;
      }
    };

    await withdrawBid(req, res);
    assert.strictEqual(res.statusCode, 200, "Withdraw should be successful.");

    // Check bid status is withdrawn in database
    const bidAfterWithdraw = await Bid.findById(firstBid._id);
    assert.strictEqual(bidAfterWithdraw.status, "withdrawn", "Bid status should be withdrawn.");

    // Check conversation is synced
    const convAfterWithdraw = await Conversation.findOne({ roomId: expectedRoomId });
    assert.strictEqual(convAfterWithdraw.bidHistory[0].status, "withdrawn", "Conversation bidHistory should reflect withdrawn status.");

    console.log("✅ Withdraw & syncBidToConversation helper passed.");

    // 6. Test: Rebid after rejection/withdrawal (reuses conversation)
    console.log("👉 Test 4: Rebid Placement (Conversation Reuse)...");
    req = {
      userId: freelancer._id.toString(),
      body: {
        gigId: gig._id.toString(),
        price: 180,
        message: "Hi, I am resubmitting my bid with a revised proposal."
      }
    };
    res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.data = data;
        return this;
      }
    };

    await createBid(req, res);
    assert.strictEqual(res.statusCode, 201, "Rebid creation should succeed.");
    const secondBid = res.data;

    // Verify conversation reuse
    const conv2 = await Conversation.findOne({ roomId: expectedRoomId });
    assert.strictEqual(conv2._id.toString(), conv1._id.toString(), "Conversation ID should be reused, not recreated.");
    assert.strictEqual(conv2.currentBidId.toString(), secondBid._id.toString(), "Current bid should now point to second bid.");
    assert.strictEqual(conv2.bidHistory.length, 2, "Bid history should contain 2 bids.");
    assert.strictEqual(conv2.bidHistory[1].bidId.toString(), secondBid._id.toString(), "Second bid should be appended.");
    assert.strictEqual(conv2.bidHistory[1].status, "pending");

    // Verify NO system message insertion on rebid (Feature 3)
    const sysMsg = await Message.findOne({ conversationId: conv2._id, type: "system" }).sort({ createdAt: -1 });
    assert.ok(!sysMsg, "Routine rebid should NOT insert a system message.");

    console.log("✅ Conversation reuse verified successfully.");

    // 7. Test: Client rejects the second bid (calls rejectBid)
    console.log("👉 Test 5: Reject Bid & Helper Sync...");
    req = {
      userId: client._id.toString(),
      params: { bidId: secondBid._id.toString() }
    };
    res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.data = data;
        return this;
      }
    };

    await rejectBid(req, res);
    assert.strictEqual(res.statusCode, 200, "Rejection should be successful.");

    const bidAfterReject = await Bid.findById(secondBid._id);
    assert.strictEqual(bidAfterReject.status, "rejected", "Bid status should be rejected.");

    const convAfterReject = await Conversation.findOne({ roomId: expectedRoomId });
    assert.strictEqual(convAfterReject.bidHistory[1].status, "rejected", "Conversation history status should match.");

    console.log("✅ Rejection & syncBidToConversation helper passed.");

    // Reset bid status to pending so it can be countered for testing
    const resetBid = await Bid.findById(secondBid._id);
    resetBid.status = "pending";
    await resetBid.save();

    // 8. Test: Counter Bid (calls counterBid)
    console.log("👉 Test 6: Counter Bid & Helper Sync...");
    req = {
      userId: client._id.toString(),
      params: { bidId: secondBid._id.toString() },
      body: {
        price: 165,
        message: "Can you do $165 instead?"
      }
    };
    res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.data = data;
        return this;
      }
    };

    await counterBid(req, res);
    assert.strictEqual(res.statusCode, 200, "Counter bid should succeed.");

    const bidAfterCounter = await Bid.findById(secondBid._id);
    assert.strictEqual(bidAfterCounter.status, "countered", "Bid status should be countered.");
    assert.strictEqual(bidAfterCounter.price, 165, "Bid price should be updated to 165.");

    const convAfterCounter = await Conversation.findOne({ roomId: expectedRoomId });
    assert.strictEqual(convAfterCounter.bidHistory[1].status, "countered", "Conversation status should be countered.");
    assert.strictEqual(convAfterCounter.bidHistory[1].price, 165, "Conversation price should be updated.");

    console.log("✅ Counter bid & syncBidToConversation helper passed.");

    // 9. Test: Accept Bid (calls acceptBid)
    console.log("👉 Test 7: Accept Bid & Helper Sync...");
    req = {
      userId: freelancer._id.toString(),
      params: { bidId: secondBid._id.toString() }
    };
    res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.data = data;
        return this;
      }
    };

    await acceptBid(req, res);
    assert.strictEqual(res.statusCode, 200, "Accept bid should succeed.");

    const bidAfterAccept = await Bid.findById(secondBid._id);
    assert.strictEqual(bidAfterAccept.status, "payment_pending", "Bid status should be payment_pending.");

    const convAfterAccept = await Conversation.findOne({ roomId: expectedRoomId });
    assert.strictEqual(convAfterAccept.bidHistory[1].status, "payment_pending", "Conversation status should be payment_pending.");

    console.log("✅ Accept bid & syncBidToConversation helper passed.");

    // 10. Test: Direct syncBidToConversation test
    console.log("👉 Test 8: Direct syncBidToConversation direct execution...");
    const dummyBid = await Bid.create({
      gigId: gig._id,
      bidderId: otherFreelancer._id,
      price: 250,
      message: "This is a dummy test bid for sync testing."
    });
    
    // Create conversation for other freelancer
    const otherRoomId = [client._id.toString(), otherFreelancer._id.toString()].sort().join("_") + "_" + gig._id.toString();
    const otherConv = await Conversation.create({
      roomId: otherRoomId,
      gigId: gig._id,
      clientId: client._id,
      freelancerId: otherFreelancer._id,
      currentBidId: dummyBid._id,
      bidHistory: [{
        bidId: dummyBid._id,
        price: dummyBid.price,
        status: dummyBid.status,
        submittedAt: new Date()
      }]
    });

    // Update status and call helper directly
    dummyBid.status = "hired";
    dummyBid.price = 240;
    await dummyBid.save();

    await syncBidToConversation(dummyBid);

    const updatedConv = await Conversation.findOne({ roomId: otherRoomId });
    assert.strictEqual(updatedConv.currentBidId.toString(), dummyBid._id.toString());
    assert.strictEqual(updatedConv.bidHistory[0].status, "hired");
    assert.strictEqual(updatedConv.bidHistory[0].price, 240);

    console.log("✅ Direct syncBidToConversation helper passed.");

    // 11. Test: Upgraded syncBidToConversation helper behaviors with actorId (routine vs milestone status)
    console.log("👉 Test 9: Upgraded syncBidToConversation helper behaviors (routine vs milestone status)...");
    const testBidObj = await Bid.create({
      gigId: gig._id,
      bidderId: freelancer._id,
      price: 300,
      message: "Bid for upgraded helper test."
    });

    const activeRoomId = [client._id.toString(), freelancer._id.toString()].sort().join("_") + "_" + gig._id.toString();
    const beforeConv = await Conversation.findOne({ roomId: activeRoomId });

    // A. Test routine status (payment_pending) - should NOT generate system message or increment unreadCount
    testBidObj.status = "payment_pending";
    testBidObj.price = 300;
    await testBidObj.save();

    const beforeUnreadFreelancer = beforeConv.unreadCount.freelancer;
    await syncBidToConversation(testBidObj, client._id);

    const afterConvRoutine = await Conversation.findOne({ roomId: activeRoomId });
    assert.strictEqual(afterConvRoutine.unreadCount.freelancer, beforeUnreadFreelancer, "Freelancer unreadCount should NOT increment for routine status.");
    assert.notStrictEqual(afterConvRoutine.lastMessage?.type, "system", "lastMessage should NOT be updated to a system message.");

    // B. Test milestone status (hired) - SHOULD generate system message and increment unreadCount
    testBidObj.status = "hired";
    await testBidObj.save();

    await syncBidToConversation(testBidObj, client._id);

    const afterConvMilestone = await Conversation.findOne({ roomId: activeRoomId });
    assert.strictEqual(afterConvMilestone.unreadCount.freelancer, beforeUnreadFreelancer + 1, "Freelancer unreadCount should increment by 1 for milestone status.");
    assert.strictEqual(afterConvMilestone.lastMessage.type, "system", "lastMessage should be a system message.");
    assert.strictEqual(afterConvMilestone.lastMessage.message, "Freelancer hired. Project started!", "lastMessage message should match default hired message.");

    // Verify system message exists in the database
    const sysMsgDoc = await Message.findOne({
      conversationId: afterConvMilestone._id,
      type: "system"
    }).sort({ createdAt: -1 });
    assert.ok(sysMsgDoc, "System message document should be stored in the DB.");
    assert.strictEqual(sysMsgDoc.message, "Freelancer hired. Project started!");
    assert.strictEqual(sysMsgDoc.senderId.toString(), client._id.toString());
    assert.strictEqual(sysMsgDoc.receiverId.toString(), freelancer._id.toString());

    console.log("✅ Upgraded syncBidToConversation helper behaviors passed.");

    // 12. Test: Concurrency and Multi-Accept (Feature 1)
    console.log("👉 Test 10: Verify multiple bids can be accepted concurrently (coexisting payment_pending)...");
    
    // Clean up all existing bids to avoid test pollution (e.g. status: 'hired' from Test 8)
    await Bid.deleteMany({ gigId: gig._id });

    const bidA = await Bid.create({
      gigId: gig._id,
      bidderId: freelancer._id,
      price: 150,
      message: "Bid A message details..."
    });
    const bidB = await Bid.create({
      gigId: gig._id,
      bidderId: otherFreelancer._id,
      price: 180,
      message: "Bid B message details..."
    });

    // Accept bid A
    const reqA = {
      params: { bidId: bidA._id },
      userId: client._id.toString()
    };
    const resA = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.data = data;
        return this;
      }
    };
    await acceptBid(reqA, resA);
    assert.strictEqual(resA.statusCode, 200, "Should accept Bid A successfully.");

    // Accept bid B concurrently
    const reqB = {
      params: { bidId: bidB._id },
      userId: client._id.toString()
    };
    const resB = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.data = data;
        return this;
      }
    };
    await acceptBid(reqB, resB);
    assert.strictEqual(resB.statusCode, 200, "Should accept Bid B concurrently without throwing a 409.");

    const bidA_after = await Bid.findById(bidA._id);
    const bidB_after = await Bid.findById(bidB._id);
    assert.strictEqual(bidA_after.status, "payment_pending");
    assert.strictEqual(bidB_after.status, "payment_pending");
    console.log("✅ Conconcurrent accept behavior verified successfully.");

    // 13. Test: Auto-rejection on payment (Feature 2)
    console.log("👉 Test 11: Verify payment completion auto-rejects other active, countered, and payment_pending bids...");
    
    // Set up a countered bid to verify it gets auto-rejected too
    const bidC = await Bid.create({
      gigId: gig._id,
      bidderId: otherFreelancer._id,
      price: 220,
      message: "Bid C negotiation details",
      status: "countered",
      lastOfferBy: client._id
    });

    const { completeOrder } = await import("../controllers/orderController.js");
    const reqPay = {
      body: {
        bidId: bidA._id.toString(),
        gigId: gig._id.toString(),
        paymentMethod: "card",
        amount: 150
      },
      userId: client._id.toString()
    };
    const resPay = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.data = data;
        return this;
      }
    };

    await completeOrder(reqPay, resPay);
    assert.strictEqual(resPay.statusCode, 200, "Payment should complete successfully. Message: " + (resPay.data ? resPay.data.message : ""));

    // Check states
    const bidA_final = await Bid.findById(bidA._id);
    const bidB_final = await Bid.findById(bidB._id);
    const bidC_final = await Bid.findById(bidC._id);

    assert.strictEqual(bidA_final.status, "hired", "Hired bid should be 'hired'.");
    assert.strictEqual(bidB_final.status, "rejected", "Conflicting payment_pending bid should be auto-rejected.");
    assert.strictEqual(bidC_final.status, "rejected", "Conflicting countered bid should be auto-rejected.");

    console.log("✅ Auto-rejection of active/countered/payment_pending bids passed.");

    console.log("-----------------------------------------");
    console.log("🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉");
    console.log("-----------------------------------------");

    mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error("❌ TEST FAILURE:", err);
    mongoose.connection.close();
    process.exit(1);
  }
};

runTests();
