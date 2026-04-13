import { createContext, useContext, useState, useEffect } from "react";

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {

  const [notifications, setNotifications] = useState([]);

  /* ---------- Fetch Notifications ---------- */
  const fetchNotifications = async () => {

    try {

      const token = localStorage.getItem("token");

      if (!token) {
        setNotifications([]);
        return;
      }

      const res = await fetch("http://localhost:5000/api/notifications", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();

      if (Array.isArray(data)) {

        // create a new sorted array (avoid mutating original)
        const sorted = [...data].sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );

        setNotifications(sorted);
      }

    } catch (error) {
      console.log("Notification fetch error:", error);
    }
  };


  /* ---------- Mark One Notification ---------- */
  const markOneAsRead = async (id) => {

    try {

      const token = localStorage.getItem("token");

      await fetch(`http://localhost:5000/api/notifications/${id}/read`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      // update UI instantly
      setNotifications(prev =>
        prev.map(n =>
          n._id === id ? { ...n, isRead: true } : n
        )
      );

    } catch (error) {
      console.log("Mark one read error:", error);
    }
  };


  /* ---------- Mark All Notifications ---------- */
  const markAllRead = async () => {

    try {

      const token = localStorage.getItem("token");

      await fetch("http://localhost:5000/api/notifications/mark-all-read", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      // update UI instantly
      setNotifications(prev =>
        prev.map(n => ({ ...n, isRead: true }))
      );

    } catch (error) {
      console.log("Mark all read error:", error);
    }
  };


  /* ---------- Auto Fetch Notifications ---------- */
  useEffect(() => {

    fetchNotifications();

    const interval = setInterval(fetchNotifications, 10000);

    return () => clearInterval(interval);

  }, []);


  return (
    <NotificationContext.Provider
      value={{
        notifications,
        refreshNotifications: fetchNotifications,
        markOneAsRead,
        markAllRead
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);