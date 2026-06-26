import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../context/NotificationContext";
import "../styles/Notifications.css";

/* ── Type metadata ── */
const TYPE_META = {
  bidAccepted: { icon: "🎉", label: "Hired",    color: "hired"   },
  BID_ACCEPTED: { icon: "🎉", label: "Hired",    color: "hired"   },
  bid_accepted: { icon: "🎉", label: "Hired",    color: "hired"   },
  GIG_HIRED: { icon: "🎉", label: "Hired",    color: "hired"   },
  
  bidRejected: { icon: "😞", label: "Rejected",  color: "rejected" },
  BID_REJECTED: { icon: "😞", label: "Rejected",  color: "rejected" },
  bid_rejected: { icon: "😞", label: "Rejected",  color: "rejected" },
  
  message:     { icon: "💬", label: "Message",   color: "message"  },
  NEW_MESSAGE: { icon: "💬", label: "Message",   color: "message"  },
  
  NEW_BID:     { icon: "📥", label: "New Bid",   color: "system"   },
  COUNTER_OFFER_RECEIVED: { icon: "↩", label: "Counter", color: "system" },
  ORDER_COMPLETED: { icon: "✅", label: "Completed", color: "hired" },
  
  PROJECT_AWARDED: { icon: "🏆", label: "Awarded", color: "hired" },
  PROJECT_COMPLETED: { icon: "✅", label: "Completed", color: "hired" },
  PAYMENT_RECEIVED: { icon: "💰", label: "Paid", color: "system" },
  CONTRACT_STARTED: { icon: "🚀", label: "Started", color: "system" },
  WORK_SUBMITTED: { icon: "📤", label: "Work Submitted", color: "system" },
  WORK_APPROVED: { icon: "✅", label: "Work Approved", color: "hired" },
  REVISIONS_REQUESTED: { icon: "🔄", label: "Revisions Requested", color: "rejected" },
  REVISION_SUBMITTED: { icon: "📤", label: "Revision Submitted", color: "system" },
  BID_WITHDRAWN: { icon: "🗑️", label: "Bid Withdrawn", color: "rejected" },
  GIG_DELETED: { icon: "🗑️", label: "Gig Deleted", color: "rejected" },
  
  default:     { icon: "🔔", label: "Update",    color: "system"   },
};

const getMeta = (type) => TYPE_META[type] || TYPE_META.default;

/* ── Relative time ── */
function relTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)    return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)    return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)    return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)     return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

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
            {unread > 0 && <button onClick={() => markAllRead()}>Mark all read</button>}
          </div>
          <div className="notif-list">
            {notifs.length === 0 ? (
              <div className="notif-empty">No notifications</div>
            ) : (
              notifs.map(n => {
                const meta = getMeta(n.type);
                const isUnread = !n.read && !n.isRead;
                return (
                  <div 
                    key={n._id} 
                    className={`notif-item ${isUnread ? 'unread' : ''}`}
                    onClick={() => {
                      if (isUnread) markOneAsRead(n._id);
                      if (n.link) navigate(n.link);
                      setIsOpen(false);
                    }}
                  >
                    <div className={`notif-icon-wrap ${meta.color}`} style={{ width: "26px", height: "26px", fontSize: "12px", marginRight: "2px" }}>
                      {meta.icon}
                    </div>
                    <div className="notif-content-flow">
                      <div className="notif-title-row">
                        <div className="notif-title-badge-group">
                          {isUnread && <span className="notif-unread-indicator" />}
                          <strong className="notif-title">{n.title || meta.label}</strong>
                        </div>
                      </div>
                      <p className="notif-description">{n.body || n.message}</p>
                      <div className="notif-footer-row">
                        <span className={`notif-tag tag-${meta.color}`}>{meta.label}</span>
                        <span className="notif-dot-separator">•</span>
                        <small className="notif-time">{relTime(n.createdAt)}</small>
                      </div>
                    </div>
                  </div>
                );
              })
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
