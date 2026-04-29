import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import { useNotifications } from "../context/NotificationContext";
import "../styles/Notifications.css";

/* ── Type metadata ── */
const TYPE_META = {
  bidAccepted: { icon: "🎉", label: "Hired",    color: "hired"   },
  bidRejected: { icon: "😞", label: "Rejected",  color: "rejected" },
  message:     { icon: "💬", label: "Message",   color: "message"  },
  default:     { icon: "🔔", label: "Update",    color: "system"   },
};

const getMeta = (type) => TYPE_META[type] || TYPE_META.default;

const FILTERS = [
  { key: "all",         label: "All"       },
  { key: "unread",      label: "Unread"    },
  { key: "bidAccepted", label: "Hired"     },
  { key: "bidRejected", label: "Rejected"  },
  { key: "message",     label: "Messages"  },
];

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

/* ── Toast ── */
function Toast({ toasts }) {
  return (
    <div className="toast-area">
      {toasts.map((t) => (
        <div key={t.id} className={`notif-toast ${t.type}`}>
          <span style={{ fontSize: 15 }}>{t.type === "success" ? "✅" : "ℹ️"}</span>
          {t.message}
        </div>
      ))}
    </div>
  );
}

/* ── Confirm Modal ── */
function ConfirmModal({ isOpen, title, body, onConfirm, onCancel }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        <div className="modal-body">{body}</div>
        <div className="modal-actions">
          <button className="modal-btn-cancel" onClick={onCancel}>Cancel</button>
          <button className="modal-btn-confirm" onClick={onConfirm}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

export default function Notifications() {
  const navigate = useNavigate();
  // ✅ FIX: use real notifications from context (backed by DB), not mock data
const { notifications, markOneAsRead, markAllRead, fetchNotifications } = useNotifications();

  const [filter,   setFilter]   = useState("all");
  const [search,   setSearch]   = useState("");
  const [removing, setRemoving] = useState(new Set());
  const [toasts,   setToasts]   = useState([]);
  const [modal,    setModal]    = useState(null);


  const showToast = useCallback((message, type = "success") => {
    const id = Date.now();
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 2800);
  }, []);

  /* ── Delete a single notification (DB) ── */
  const deleteNotif = useCallback(async (id) => {
  setRemoving((prev) => new Set([...prev, id]));
  try {
    await api.delete(`/notifications/${id}/delete`);

    setTimeout(() => {
      setRemoving((prev) => {
        const s = new Set(prev);
        s.delete(id);
        return s;
      });
      fetchNotifications();
    }, 300);

    showToast("Notification removed");
  } catch {
    setRemoving((prev) => {
      const s = new Set(prev);
      s.delete(id);
      return s;
    });
    showToast("Failed to remove", "error");
  }
}, [fetchNotifications, showToast]);

  /* ── Clear all (DB) ── */
  const clearAll = useCallback(async () => {
  setModal({
    title: "Clear all notifications",
    body: "This will permanently delete all your notifications.",
    onConfirm: async () => {
      setModal(null);
      try {
        await api.delete("/notifications/clear-all");
        fetchNotifications();
        showToast("All notifications cleared");
      } catch {
        showToast("Failed to clear", "error");
      }
    }
  });
}, [fetchNotifications, showToast]);

  /* ── Filtered list ── */
  const filtered = notifications.filter((n) => {
    if (filter === "unread" && n.isRead) return false;
    if (filter !== "all" && filter !== "unread" && n.type !== filter) return false;
    if (search && !n.message.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = {
    all:         notifications.length,
    unread:      notifications.filter((n) => !n.isRead).length,
    bidAccepted: notifications.filter((n) => n.type === "bidAccepted").length,
    bidRejected: notifications.filter((n) => n.type === "bidRejected").length,
    message:     notifications.filter((n) => n.type === "message").length,
  };

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
                {counts.unread > 0 && (
                  <span className="unread-badge">{counts.unread}</span>
                )}
              </h1>
              <p className="page-subtitle">
                Stay updated on your gigs, bids, and messages
              </p>
            </div>
          </div>
          <div className="header-actions">
            {counts.unread > 0 && (
              <button className="btn-ghost" onClick={() => { markAllRead(); showToast("All marked as read"); }}>
                ✓ Mark all read
              </button>
            )}
            {notifications.length > 0 && (
              <button className="btn-danger-ghost" onClick={clearAll}>
                🗑 Clear all
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Total</div>
            <div className="stat-value">{notifications.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Unread</div>
            <div className="stat-value blue">{counts.unread}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Hired</div>
            <div className="stat-value green">{counts.bidAccepted}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Messages</div>
            <div className="stat-value amber">{counts.message}</div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="filter-bar">
          {FILTERS.map((f) => (
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
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 13 }}
                onClick={() => setSearch("")}
              >✕</button>
            )}
          </div>
        </div>

        {/* Notification list */}
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔕</div>
            <div className="empty-title">
              {search ? "No matching notifications" : "You're all caught up!"}
            </div>
            <div className="empty-sub">
              {search
                ? `No notifications match "${search}"`
                : "New notifications will appear here automatically."}
            </div>
            {search && (
              <button className="empty-results-clear" onClick={() => setSearch("")}>
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="notif-list">
            {filtered.map((n, i) => {
              const meta = getMeta(n.type);
              return (
                <div
                  key={n._id}
                  className={`notif-card${!n.isRead ? " unread" : ""}${removing.has(n._id) ? " removing" : ""}`}
                  style={{ animationDelay: `${i * 0.04}s` }}
                  onClick={() => {
                    if (!n.isRead) markOneAsRead(n._id);
                    if (n.link) navigate(n.link);
                  }}
                >
                  <div className={`notif-icon-wrap ${meta.color}`}>
                    {meta.icon}
                  </div>

                  <div className="notif-body">
                    <div className="notif-top">
                      <div className="notif-message">{n.message}</div>
                      <div className="notif-time">{relTime(n.createdAt)}</div>
                    </div>
                    <div className="notif-actions">
                      <span className={`notif-tag tag-${meta.color}`}>{meta.label}</span>
                      {n.link && (
                        <button
                          className="notif-action-btn primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!n.isRead) markOneAsRead(n._id);
                            navigate(n.link);
                          }}
                        >
                          View →
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="notif-right">
                    {!n.isRead && (
                      <>
                        <div className="unread-dot" />
                        <div
                          className="mark-read-ico"
                          title="Mark as read"
                          onClick={(e) => {
                            e.stopPropagation();
                            markOneAsRead(n._id);
                            showToast("Marked as read");
                          }}
                        >✓</div>
                      </>
                    )}
                    <div
                      className="delete-ico"
                      title="Delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotif(n._id);
                      }}
                    >✕</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Toast toasts={toasts} />

      <ConfirmModal
        isOpen={!!modal}
        title={modal?.title}
        body={modal?.body}
        onConfirm={modal?.onConfirm}
        onCancel={() => setModal(null)}
      />
    </div>
  );
}