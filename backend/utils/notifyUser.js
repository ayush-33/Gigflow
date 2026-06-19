import Notification from "../models/notificationModel.js";
import { io } from "../server.js";

export const notifyUser = async (data) => {
  const { senderId, receiverId, type, title, message, link, meta } = data;
  
  // Backward compatibility support for older calls
  const resolvedReceiverId = receiverId || data.userId;
  const resolvedMessage = message || data.message || data.body;
  const resolvedTitle = title || data.title || "New Update";
  const resolvedLink = link || data.link || "/";

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

  if (io) {
    const roomStr = resolvedReceiverId.toString();
    io.to(roomStr).emit("notification", notification);
    io.to(roomStr).emit("newNotification", notification);
  }

  return notification;
};