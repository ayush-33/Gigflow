import Notification from "../models/notificationModel.js";

export const notifyUser = async (data) => {
  const { senderId, receiverId, type, title, message, link, meta } = data;

  // Backward compatibility support for older calls
  const resolvedReceiverId = receiverId || data.userId;
  const resolvedMessage = message || data.message || data.body;
  const resolvedTitle = title || data.title || "New Update";
  const resolvedLink = link || data.link || "/";

  // Self-notification / actor-recipient guard
  if (senderId && resolvedReceiverId && senderId.toString() === resolvedReceiverId.toString()) {

    return null;
  }

  // Deduplication check: check if an identical notification exists within the last 60 seconds
  const targetEntityId = meta?.bidId?.toString() || meta?.orderId?.toString() || meta?.gigId?.toString() || resolvedLink || "";
  const sixtySecondsAgo = new Date(Date.now() - 60000);
  const duplicate = await Notification.findOne({
    receiverId: resolvedReceiverId,
    type,
    createdAt: { $gte: sixtySecondsAgo }
  });

  if (duplicate) {
    const duplicateTargetEntityId = duplicate.meta?.bidId?.toString() || duplicate.meta?.orderId?.toString() || duplicate.meta?.gigId?.toString() || duplicate.link || "";
    if (duplicateTargetEntityId === targetEntityId) {

      const { io } = await import("../server.js");
      if (io) {
        const roomStr = resolvedReceiverId.toString();
        io.to(roomStr).emit("notification", duplicate);
        io.to(roomStr).emit("newNotification", duplicate);
      }
      return duplicate;
    }
  }

  const notification = await Notification.create({
    senderId: senderId || null,
    receiverId: resolvedReceiverId,
    userId: resolvedReceiverId, // duplicated for legacy queries
    type,
    title: resolvedTitle,
    message: resolvedMessage,
    body: resolvedMessage,      // duplicated for legacy queries
    link: resolvedLink,
    isRead: false,
    read: false,
    meta: meta || {}
  });

  const { io } = await import("../server.js");
  if (io) {
    const roomStr = resolvedReceiverId.toString();
    io.to(roomStr).emit("notification", notification);
    io.to(roomStr).emit("newNotification", notification);
  }

  return notification;
};