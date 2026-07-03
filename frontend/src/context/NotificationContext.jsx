import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "../api/api";
import { useAuth } from "./AuthContext";
import { getAccessToken } from "../utils/auth";
import { getSocket } from "../utils/socket";
import toast from "react-hot-toast";

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const { user, socket } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const showToast = useCallback((message, type = "success") => {
    if (type === "success") {
      toast.success(message);
    } else if (type === "error") {
      toast.error(message);
    } else if (type === "message" || type === "info") {
      toast(message, { icon: "💬" });
    } else {
      toast(message, { icon: "🔔" });
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!user || !getAccessToken()) {
      setNotifications([]);
      setUnreadMessages(0);
      return;
    }

    try {
      const [notifRes, chatRes] = await Promise.all([
        api.get("/notifications"),
        api.get("/chat/unread-count")
      ]);
      setNotifications(Array.isArray(notifRes.data) ? notifRes.data : []);
      setUnreadMessages(chatRes.data.unreadCount || 0);
    } catch (err) {
      console.log("Notification fetch error:", err.response?.data);
    }
  }, [user]);

  // Connect socket when user logs in, disconnect on logout
  useEffect(() => {
    if (!user || !getAccessToken()) {
      setNotifications([]);
      setUnreadMessages(0);
      return;
    }

    fetchNotifications();

    if (!socket) return;

    const handleNotification = (newNotif) => {
      // Guard: do not show toast or append to notification array if current user is the sender (actor)
      const senderIdStr = newNotif.senderId?._id?.toString() || newNotif.senderId?.toString();
      const currentUserId = user?._id?.toString() || user?.id?.toString();
      if (senderIdStr && currentUserId && senderIdStr === currentUserId) {
        console.log("[NotificationContext] Bypassing self-notification from socket");
        return;
      }
      setNotifications((prev) => [newNotif, ...prev]);
      showToast(newNotif.message || newNotif.body || "New notification!", "notification");
    };

    const handleNewMessage = (msg) => {
      // Guard: do not show toast or increment count if current user is the sender (actor)
      const senderIdStr = msg.senderId?._id?.toString() || msg.senderId?.toString();
      const currentUserId = user?._id?.toString() || user?.id?.toString();
      if (senderIdStr && currentUserId && senderIdStr === currentUserId) {
        return;
      }

      // ✅ Only toast and increment if the message is actually unread/new
      if (msg.status === "read") return;

      // ✅ Skip toast & increment if user is already in this chat room
      if (window.location.pathname === `/chat/${msg.roomId}`) {
        return;
      }

      showToast(`${msg.senderId?.name || "Someone"} sent you a message: "${msg.message.slice(0, 40)}${msg.message.length > 40 ? '...' : ''}"`, "message");
    };

    const handleMessagesSeen = () => {
      fetchNotifications();
    };

    const handleNavbarUnreadUpdate = ({ totalUnread }) => {
      console.log(`[NotificationContext] Received navbarUnreadUpdate count: ${totalUnread}`);
      setUnreadMessages(totalUnread);
    };

    socket.on("notification", handleNotification);
    socket.on("newMessage", handleNewMessage);
    socket.on("messagesSeen", handleMessagesSeen);
    socket.on("navbarUnreadUpdate", handleNavbarUnreadUpdate);

    return () => {
      socket.off("notification", handleNotification);
      socket.off("newMessage", handleNewMessage);
      socket.off("messagesSeen", handleMessagesSeen);
      socket.off("navbarUnreadUpdate", handleNavbarUnreadUpdate);
    };
  }, [user, socket, fetchNotifications, showToast]);

  // Poll every 60s as fallback
  useEffect(() => {
    if (!user || !getAccessToken()) return;
    const id = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(id);
  }, [fetchNotifications, user]);

  const markOneAsRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true, read: true } : n))
      );
    } catch { /* silent */ }
  };

  const markAllRead = async (role) => {
    try {
      const actualRole = (typeof role === "string") ? role : undefined;
      const url = actualRole ? `/notifications/mark-all-read?role=${actualRole}` : "/notifications/mark-all-read";
      await api.put(url);
      setNotifications((prev) =>
        prev.map((n) => (actualRole ? n.meta?.role === actualRole : true) ? { ...n, isRead: true, read: true } : n)
      );
    } catch { /* silent */ }
  };

  const deleteOne = async (id) => {
    try {
      await api.delete(`/notifications/${id}/delete`);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
    } catch { /* silent */ }
  };

  const clearAll = async () => {
    try {
      await api.delete("/notifications/clear-all");
      setNotifications([]);
    } catch { /* silent */ }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        fetchNotifications,
        markOneAsRead,
        markAllRead,
        deleteOne,
        clearAll,
        unreadMessages,
        setUnreadMessages
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);