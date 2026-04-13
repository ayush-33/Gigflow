import Notification from "../models/notificationModel.js";

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


export const markAsRead = async (req, res) => {
  try {

    await Notification.findByIdAndUpdate(
      req.params.id,
      { isRead: true }
    );

    res.status(200).json({ message: "Notification marked as read" });

  } catch (error) {
    res.status(500).json({ message: "Error updating notification" });
  }
};

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