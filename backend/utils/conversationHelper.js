import Conversation from "../models/conversation.js";

/**
 * Syncs the status and price of a Bid document into its corresponding Conversation's history
 * and updates the conversation's currentBidId.
 * If actorId is provided, also creates a system message, increments recipient unread count,
 * and emits real-time Socket.IO notifications.
 * @param {Object} bid - The Bid document to sync
 * @param {String|mongoose.Types.ObjectId|null} actorId - The ID of the user performing the action
 * @param {Object} options - Custom options (e.g. systemMessageText override)
 */
export const syncBidToConversation = async (bid, actorId = null, options = {}) => {
  try {
    const conversation = await Conversation.findOne({
      $or: [
        { currentBidId: bid._id },
        { gigId: bid.gigId, freelancerId: bid.bidderId }
      ]
    });

    if (conversation) {
      // Update currentBidId to this bid
      conversation.currentBidId = bid._id;

      // Find the index of the bid in history
      const historyIndex = conversation.bidHistory.findIndex(
        (item) => item.bidId.toString() === bid._id.toString()
      );

      if (historyIndex > -1) {
        // Update existing history entry
        conversation.bidHistory[historyIndex].status = bid.status;
        conversation.bidHistory[historyIndex].price = bid.price;
      } else {
        // Add new history entry
        conversation.bidHistory.push({
          bidId: bid._id,
          price: bid.price,
          status: bid.status,
          submittedAt: bid.createdAt || new Date()
        });
      }

      // If actorId is provided and isMilestone is true, handle system message and unread count
      const isMilestone = ["hired", "completed", "cancelled"].includes(bid.status) || options.systemMessageText;

      if (actorId && isMilestone) {
        const Message = (await import("../models/message.js")).default;
        const isClient = conversation.clientId.toString() === actorId.toString();
        const recipientId = isClient ? conversation.freelancerId : conversation.clientId;

        let msgText = options.systemMessageText;
        if (!msgText) {
          if (bid.status === "hired") {
            msgText = "Freelancer hired. Project started!";
          } else if (bid.status === "completed") {
            msgText = "Order has been completed.";
          } else if (bid.status === "cancelled") {
            msgText = "Order has been cancelled.";
          } else {
            msgText = `Bid status updated to ${bid.status}`;
          }
        }

        const sysMsg = await Message.create({
          conversationId: conversation._id,
          roomId: conversation.roomId,
          gigId: conversation.gigId,
          senderId: actorId,
          receiverId: recipientId,
          type: "system",
          message: msgText
        });

        conversation.lastMessage = {
          _id: sysMsg._id,
          type: "system",
          message: sysMsg.message,
          createdAt: sysMsg.createdAt,
          senderId: sysMsg.senderId,
          receiverId: sysMsg.receiverId
        };
        conversation.lastMessageAt = sysMsg.createdAt;

        const recipientRole = conversation.clientId.toString() === recipientId.toString() ? "client" : "freelancer";
        conversation.unreadCount[recipientRole] += 1;
      }

      await conversation.save();

      // Dynamic import to break circular dependency at startup
      const { io } = await import("../server.js");

      if (io) {
        const eventPayload = {
          conversationId: conversation._id,
          roomId: conversation.roomId,
          clientId: conversation.clientId,
          freelancerId: conversation.freelancerId,
          lastMessage: conversation.lastMessage,
          lastMessageAt: conversation.lastMessageAt,
          unreadCount: conversation.unreadCount,
          currentBidId: {
            _id: bid._id,
            status: bid.status,
            price: bid.price
          },
          bidHistory: conversation.bidHistory
        };

        // Emit conversationUpdated to both participants
        io.to(conversation.clientId.toString()).emit("conversationUpdated", eventPayload);
        io.to(conversation.freelancerId.toString()).emit("conversationUpdated", eventPayload);

        // If actorId is provided and isMilestone is true, emit system message events
        if (actorId && isMilestone) {
          const isClient = conversation.clientId.toString() === actorId.toString();
          const recipientId = isClient ? conversation.freelancerId : conversation.clientId;

          const Message = (await import("../models/message.js")).default;
          const sysMsg = await Message.findOne({
            conversationId: conversation._id,
            type: "system"
          }).sort({ createdAt: -1 });

          if (sysMsg) {
            const populated = await sysMsg.populate("senderId", "name email");
            await populated.populate("receiverId", "name email");

            // Emit newMessage to both roomId (chat thread) and recipient personal user room (background badge/toast)
            io.to(conversation.roomId).emit("newMessage", populated);
            io.to(recipientId.toString()).emit("newMessage", populated);
          }

          // Emit navbarUnreadUpdate for recipient
          const totalUnread = await getUnreadCountForUser(recipientId);
          console.log(`[syncBidToConversation] Emitting navbarUnreadUpdate for user ${recipientId}: ${totalUnread}`);
          io.to(recipientId.toString()).emit("navbarUnreadUpdate", { userId: recipientId, totalUnread });
        }
      }
    }
  } catch (error) {
    console.error("Error syncing bid to conversation:", error.message);
  }
};

/**
 * Calculates the total unread message count for a given user across all their conversations.
 * @param {String|mongoose.Types.ObjectId} userId - The user ID
 * @returns {Promise<Number>} Total unread count
 */
export const getUnreadCountForUser = async (userId) => {
  try {
    const conversations = await Conversation.find({
      $or: [
        { clientId: userId },
        { freelancerId: userId }
      ]
    });

    return conversations.reduce((sum, conv) => {
      const role = conv.clientId.toString() === userId.toString() ? "client" : "freelancer";
      return sum + (conv.unreadCount[role] || 0);
    }, 0);
  } catch (error) {
    console.error("Error getting unread count for user:", error.message);
    return 0;
  }
};
