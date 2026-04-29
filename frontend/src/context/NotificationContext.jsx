import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "../api/api";
import { useAuth } from "./AuthContext";
import { getAccessToken } from "../utils/auth";
import { connectSocket, disconnectSocket, getSocket } from "../utils/socket";

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
const fetchNotifications = useCallback(async () => {
  if (!user || !getAccessToken()) {
    setNotifications([]);
    return;
  }

  try {
    const { data } = await api.get("/notifications");
    setNotifications(Array.isArray(data) ? data : []);
  } catch (err) {
    console.log("Notification error:", err.response?.data);
  }
}, [user]);

  // Connect socket when user logs in, disconnect on logout
useEffect(() => {
  if (!user || !getAccessToken()) {
    setNotifications([]);
    return;
  }

  fetchNotifications();

  const socket = getSocket();
  if (!socket) return;

  socket.on("notification", (newNotif) => {
    setNotifications((prev) => [newNotif, ...prev]);
  });

  return () => {
    socket.off("notification");
  };    
}, [user, fetchNotifications]);

  // Poll every 60s as fallback (reduced from 30s since socket handles real-time)
  useEffect(() => {
    if (!user || !getAccessToken()) return;
    const id = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(id);
  }, [fetchNotifications, user]);

  const markOneAsRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
    } catch { /* silent */ }
  };

  const markAllRead = async () => {
    try {
      await api.put("/notifications/mark-all-read");
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
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
      value={{ notifications, fetchNotifications, markOneAsRead, markAllRead, deleteOne, clearAll }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);