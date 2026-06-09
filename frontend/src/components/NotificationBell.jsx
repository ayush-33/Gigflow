import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import { getSocket } from "../utils/socket";
import "../styles/Notifications.css";

export default function NotificationBell() {
  const [notifs, setNotifs]     = useState([]);
  const [unread, setUnread]     = useState(0);
  const [isOpen, setIsOpen]     = useState(false);
  const dropdownRef = useRef(null);
  const navigate    = useNavigate();

  useEffect(() => {
    fetchNotifs();

    const socket = getSocket();
    socket.on("newNotification", (notif) => {
      setNotifs(prev => [notif, ...prev].slice(0, 10));
      setUnread(prev => prev + 1);
    });

    return () => socket.off("newNotification");
  }, []);

  const fetchNotifs = async () => {
    try {
      const { data } = await api.get("/notifications");
      setNotifs(data.slice(0, 10));
      setUnread(data.filter(n => !n.read && !n.isRead).length);
    } catch (e) { console.error(e); }
  };

  const markAllRead = async () => {
    try {
      await api.put("/notifications/mark-all-read");
      setNotifs(prev => prev.map(n => ({ ...n, read: true, isRead: true })));
      setUnread(0);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="notification-bell-container" ref={dropdownRef}>
      <button className="bell-btn" onClick={() => setIsOpen(!isOpen)}>
        🔔 {unread > 0 && <span className="bell-badge">{unread}</span>}
      </button>

      {isOpen && (
        <div className="notif-dropdown">
          <div className="notif-header">
            <h3>Notifications</h3>
            <button onClick={markAllRead}>Mark all read</button>
          </div>
          <div className="notif-list">
            {notifs.length === 0 ? (
              <div className="notif-empty">No notifications</div>
            ) : (
              notifs.map(n => (
                <div 
                  key={n._id} 
                  className={`notif-item ${(!n.read && !n.isRead) ? 'unread' : ''}`}
                  onClick={() => {
                    if (n.link) navigate(n.link);
                    setIsOpen(false);
                  }}
                >
                  <strong>{n.title || 'New Notification'}</strong>
                  <p>{n.body || n.message}</p>
                  <small>{new Date(n.createdAt).toLocaleTimeString()}</small>
                </div>
              ))
            )}
          </div>
          <div className="notif-footer" onClick={() => { navigate("/notifications"); setIsOpen(false); }}>
            View all
          </div>
        </div>
      )}
    </div>
  );
}
