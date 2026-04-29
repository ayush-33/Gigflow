import Notification from "../models/notificationModel.js";
import { io } from "../server.js";

export const notifyUser = async ({ userId, message, type, link }) => {
  const notification = await Notification.create({ userId, message, type, link });
  // Emit to that user's socket room in real time
  io.to(userId.toString()).emit("notification", notification);
  return notification;
};