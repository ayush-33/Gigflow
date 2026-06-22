import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../context/NotificationContext";
import "../styles/Notifications.css";

export default function NotificationBell() {
  const { notifications, markAllRead, markOneAsRead } = useNotifications();
  const [isOpen, setIsOpen]     = useState(false);
  const dropdownRef = useRef(null);
  const navigate    = useNavigate();

  const unread = notifications.filter(n => !n.read && !n.isRead).length;
  const notifs = notifications.slice(0, 10);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="notification-bell-container" ref={dropdownRef}>
      <button className="bell-btn" onClick={handleToggle}>
        <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg" className="bell-icon"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
        <span className="bell-label-mobile">Notifications</span>
        {unread > 0 && <span className="bell-badge">{unread}</span>}
        <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg" className="bell-chevron-mobile"><path d="M9 18l6-6-6-6"></path></svg>
      </button>

      {isOpen && (
        <div className="notif-dropdown">
          <div className="notif-header">
            <h3>Notifications</h3>
            {unread > 0 && <button onClick={markAllRead}>Mark all read</button>}
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
                    if (!n.isRead && !n.read) markOneAsRead(n._id);
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
