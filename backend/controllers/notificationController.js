import Notification from "../models/notificationModel.js";

/* ---------- Get My Notifications ---------- */
export const getMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification
      .find({ userId: req.userId })
      .sort({ createdAt: -1 });

    res.status(200).json(notifications);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
};

/* ---------- Mark One As Read ---------- */
export const markAsRead = async (req, res) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },  // ✅ security: ensure ownership
      { isRead: true }
    );
    res.status(200).json({ message: "Notification marked as read" });
  } catch (error) {
    res.status(500).json({ message: "Error updating notification" });
  }
};

/* ---------- Mark All As Read ---------- */
export const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.userId, isRead: false },
      { isRead: true }
    );
    res.status(200).json({ message: "All notifications marked as read" });
  } catch (error) {
    res.status(500).json({ message: "Error updating notifications" });
  }
};

/* ---------- Delete One Notification ---------- */
// ✅ NEW: needed by Notifications page for persistent delete
export const deleteNotification = async (req, res) => {
  try {
    await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId     // only delete own notifications
    });
    res.status(200).json({ message: "Notification deleted" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting notification" });
  }
};

/* ---------- Clear All Notifications ---------- */
// ✅ NEW: needed by "Clear all" button in Notifications page
export const clearAllNotifications = async (req, res) => {
  try {
    await Notification.deleteMany({ userId: req.userId });
    res.status(200).json({ message: "All notifications cleared" });
  } catch (error) {
    res.status(500).json({ message: "Error clearing notifications" });
  }
};