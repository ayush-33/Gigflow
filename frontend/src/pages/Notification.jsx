import { useState, useCallback } from "react";
import "../styles/Notifications.css";

const MOCK_NOTIFICATIONS = [
  { id: 1, type: "bid",     unread: true,  icon: "💼", tag: "Bid Received", message: "Alex submitted a bid of $45 on your Web Development gig",    sub: 'Proposal: "I can complete this in 3 days with full responsiveness..."', time: "2 min ago",  actions: [{ label: "View Bid", primary: true }, { label: "Decline" }] },
  { id: 2, type: "hired",   unread: true,  icon: "🎉", tag: "Hired",        message: "Congratulations! Sarah hired you for the Logo Design project", sub: "Project starts immediately. Check your dashboard for details.",           time: "18 min ago", actions: [{ label: "View Project", primary: true }] },
  { id: 3, type: "bid",     unread: true,  icon: "💼", tag: "Bid Received", message: "Mike placed a bid of $120 on your Mobile App gig",             sub: 'Proposal: "Full-stack developer with 5 years of React Native experience..."', time: "1 hr ago",   actions: [{ label: "View Bid", primary: true }, { label: "Decline" }] },
  { id: 4, type: "message", unread: true,  icon: "💬", tag: "Message",      message: "Jordan sent you a message about your SEO Services gig",        sub: '"Hi, do you offer keyword research as part of the package?"',           time: "2 hrs ago",  actions: [{ label: "Reply", primary: true }] },
  { id: 5, type: "payment", unread: true,  icon: "💰", tag: "Payment",      message: "Payment of $85 received for Graphic Design project",           sub: "Funds are now available in your wallet balance.",                        time: "3 hrs ago",  actions: [{ label: "View Wallet", primary: true }] },
  { id: 6, type: "bid",     unread: false, icon: "💼", tag: "Bid Received", message: "Chris submitted a bid of $60 on your Content Writing gig",     sub: 'Proposal: "Native English writer with 200+ articles delivered..."',     time: "Yesterday",  actions: [{ label: "View Bid", primary: true }, { label: "Decline" }] },
  { id: 7, type: "message", unread: false, icon: "💬", tag: "Message",      message: "Emma replied to your message in Music Production gig",         sub: '"Sure, I can add an extra revision for free."',                         time: "Yesterday",  actions: [{ label: "View Chat", primary: true }] },
  { id: 8, type: "system",  unread: false, icon: "⚙️", tag: "System",       message: "Your profile has been verified successfully",                  sub: "You now have access to featured gig placements.",                       time: "2 days ago", actions: [] },
];

const FILTERS = [
  { key: "all",     label: "All"      },
  { key: "unread",  label: "Unread"   },
  { key: "bid",     label: "Bids"     },
  { key: "message", label: "Messages" },
  { key: "hired",   label: "Hired"    },
  { key: "payment", label: "Payments" },
];

function Toast({ toasts }) {
  return (
    <div className="toast-area">
      {toasts.map(t => (
        <div key={t.id} className={`notif-toast ${t.type}`}>
          <span style={{ fontSize: 16 }}>{t.type === "info" ? "ℹ️" : "✅"}</span>
          {t.message}
        </div>
      ))}
    </div>
  );
}

export default function Notifications() {
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const [filter,   setFilter]   = useState("all");
  const [search,   setSearch]   = useState("");
  const [removing, setRemoving] = useState([]);
  const [toasts,   setToasts]   = useState([]);

  const showToast = (message, type = "info") => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 2800);
  };

  const filtered = notifications.filter(n => {
    if (filter === "unread" && !n.unread) return false;
    if (filter !== "all" && filter !== "unread" && n.type !== filter) return false;
    if (search && !n.message.toLowerCase().includes(search) && !n.sub.toLowerCase().includes(search)) return false;
    return true;
  });

  const counts = {
    all:     notifications.length,
    unread:  notifications.filter(n => n.unread).length,
    bid:     notifications.filter(n => n.type === "bid").length,
    message: notifications.filter(n => n.type === "message").length,
    hired:   notifications.filter(n => n.type === "hired").length,
    payment: notifications.filter(n => n.type === "payment").length,
  };

  const markRead = (id) => {
    setNotifications(p => p.map(n => n.id === id ? { ...n, unread: false } : n));
    showToast("Marked as read");
  };

  const deleteNotif = (id) => {
    setRemoving(p => [...p, id]);
    setTimeout(() => {
      setNotifications(p => p.filter(n => n.id !== id));
      setRemoving(p => p.filter(x => x !== id));
      showToast("Notification removed");
    }, 280);
  };

  const markAllRead = () => {
    setNotifications(p => p.map(n => ({ ...n, unread: false })));
    showToast("All notifications marked as read");
  };

  const clearAll = () => {
    setNotifications([]);
    showToast("All notifications cleared");
  };

  const handleCardClick = (n) => {
    if (n.unread) markRead(n.id);
  };

  const typeClass = (type) =>
    ({ bid: "bid", hired: "hired", review: "review", message: "message", system: "system", payment: "payment" }[type] || "system");

  return (
    <div className="notifications-page">
      <div className="notifications-container">

        {/* Header */}
        <div className="page-header">
          <div className="page-header-left">
            <div className="page-icon">🔔</div>
            <div>
              <h1 className="notifications-title">
                Notifications
                {counts.unread > 0 && <span className="unread-badge">{counts.unread}</span>}
              </h1>
              <p className="page-subtitle">Stay updated on your gigs, bids, and messages</p>
            </div>
          </div>
          <div className="header-actions">
            <button className="btn-ghost" onClick={markAllRead}>✓ Mark all read</button>
            <button className="btn-danger-ghost" onClick={clearAll}>🗑 Clear all</button>
          </div>
        </div>

        {/* Stats */}
        <div className="stats-row">
          <div className="stat-card"><div className="stat-label">Total</div><div className="stat-value">{notifications.length}</div></div>
          <div className="stat-card"><div className="stat-label">Unread</div><div className="stat-value blue">{counts.unread}</div></div>
          <div className="stat-card"><div className="stat-label">Bids</div><div className="stat-value amber">{counts.bid}</div></div>
          <div className="stat-card"><div className="stat-label">Messages</div><div className="stat-value green">{counts.message}</div></div>
        </div>

        {/* Filter bar */}
        <div className="filter-bar">
          {FILTERS.map(f => (
            <button
              key={f.key}
              className={`filter-chip${filter === f.key ? " active" : ""}`}
              onClick={() => setFilter(f.key)}
            >
              <span>{f.label}</span>
              <span className="chip-count">{counts[f.key] ?? 0}</span>
            </button>
          ))}
          <div className="filter-sep" />
          <div className="search-wrap">
            <span className="search-icon">🔍</span>
            <input
              className="notif-search"
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value.toLowerCase())}
            />
          </div>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔕</div>
            <div className="empty-title">No notifications</div>
            <div className="empty-sub">You're all caught up! Notifications will appear here.</div>
          </div>
        ) : (
          <div className="notif-list">
            {filtered.map((n, i) => (
              <div
                key={n.id}
                className={`notif-card${n.unread ? " unread" : ""}${removing.includes(n.id) ? " removing" : ""}`}
                style={{ animationDelay: `${i * 0.04}s` }}
                onClick={() => handleCardClick(n)}
              >
                <div className={`notif-icon-wrap ${typeClass(n.type)}`}>{n.icon}</div>

                <div className="notif-body">
                  <div className="notif-top">
                    <div className="notif-message">{n.message}</div>
                    <div className="notif-time">{n.time}</div>
                  </div>
                  <div className="notif-sub">{n.sub}</div>
                  <div className="notif-actions">
                    <span className={`notif-tag tag-${typeClass(n.type)}`}>{n.tag}</span>
                    {n.actions.map(a => (
                      <button
                        key={a.label}
                        className={`notif-action-btn${a.primary ? " primary" : ""}`}
                        onClick={e => e.stopPropagation()}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="notif-right">
                  {n.unread && <div className="unread-dot" />}
                  {n.unread && (
                    <div
                      className="mark-read-ico"
                      onClick={e => { e.stopPropagation(); markRead(n.id); }}
                      title="Mark as read"
                    >✓</div>
                  )}
                  <div
                    className="delete-ico"
                    onClick={e => { e.stopPropagation(); deleteNotif(n.id); }}
                    title="Delete"
                  >✕</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Toast toasts={toasts} />
    </div>
  );
}