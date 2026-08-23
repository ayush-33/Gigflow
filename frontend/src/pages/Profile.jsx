import { useEffect, useState, useCallback, Fragment, useRef } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useNotifications } from "../context/NotificationContext";
import { useAuth } from "../context/AuthContext";
import ConfirmModal from "../components/ConfirmModal";
import Modal from "../components/Modal";
import api from "../api/api";          // ✅ NEW
import toast from "react-hot-toast";
import "../styles/Profile.css";
import DashboardTab from "../components/profile/DashboardTab";
import MyGigsTab from "../components/profile/MyGigsTab";
import MyBidsTab from "../components/profile/MyBidsTab";
import ReceivedBidsTab from "../components/profile/ReceivedBidsTab";
import SettingsTab from "../components/profile/SettingsTab";

/* ── Sidebar nav ── */
const NAV = [
  { key: "dashboard", icon: "🏠", label: "Dashboard" },
  { key: "gigs", icon: "📦", label: "My Gigs" },
  { key: "bids", icon: "💬", label: "My Bids" },
  { key: "offers", icon: "📥", label: "Received Bids" },
  // { key: "messages", icon: "💬", label: "Messages" },
  // { key: "notifications", icon: "🔔", label: "Notifications" },
  { key: "reviews", icon: "⭐", label: "My Reviews" },
  { key: "saved", icon: "❤️", label: "Saved Gigs" }, // ✅ ADD THIS
  { key: "settings", icon: "⚙️", label: "Settings" },
];

/* ── Status badge ── */
function Badge({ status }) {
  const map = {
    open: "badge-open",
    active: "badge-active",
    hired: "badge-hired",
    in_progress: "badge-hired",
    submitted: "badge-submitted",
    completed: "badge-completed",
    pending: "badge-pending",
    countered: "badge-countered",
    payment_pending: "badge-pending",
    closed: "badge-closed",
    rejected: "badge-rejected",
    withdrawn: "badge-withdrawn",
  };
  const label = {
    open: "Open",
    active: "Active",
    hired: "Hired · In Progress",
    in_progress: "In Progress",
    submitted: "Work Submitted",
    completed: "Completed",
    pending: "Pending",
    countered: "Counter Offer",
    payment_pending: "Awaiting Payment",
    closed: "Closed",
    rejected: "Rejected",
    withdrawn: "Withdrawn",
  };
  return (
    <span className={`badge ${map[status] || "badge-pending"}`}>
      {label[status] || status}
    </span>
  );
}

// Helper for views count mock
const getViewsCount = (id) => {
  if (!id) return 0;
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
  return (12 + (sum % 89));
};

// Helper for freelancer rating mock
const getFreelancerRating = (id) => {
  if (!id) return "5.0";
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
  return (4.5 + (sum % 6) * 0.1).toFixed(1);
};

// Helper for freelancer projects count mock
const getFreelancerProjects = (id) => {
  if (!id) return "0";
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
  return (3 + (sum % 15)).toString();
};

// Helper for relative time formatting in activity feed
const relTime = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

// Helper to map notifications to activity feed items
const mapNotificationToActivity = (notif) => {
  const meta = {
    bidAccepted: { icon: "🎉", title: "Bid Accepted" },
    BID_ACCEPTED: { icon: "🎉", title: "Bid Accepted" },
    bid_accepted: { icon: "🎉", title: "Bid Accepted" },
    GIG_HIRED: { icon: "🎉", title: "Gig Hired" },

    bidRejected: { icon: "😞", title: "Bid Rejected" },
    BID_REJECTED: { icon: "😞", title: "Bid Rejected" },
    bid_rejected: { icon: "😞", title: "Bid Rejected" },

    message: { icon: "💬", title: "New Message Received" },
    NEW_MESSAGE: { icon: "💬", title: "New Message Received" },

    NEW_BID: { icon: "📥", title: "New Bid Received" },
    COUNTER_OFFER_RECEIVED: { icon: "↩", title: "Counter Offer Received" },
    ORDER_COMPLETED: { icon: "✅", title: "Project Completed" },

    PROJECT_AWARDED: { icon: "🏆", title: "Project Awarded" },
    PROJECT_COMPLETED: { icon: "✅", title: "Project Completed" },
    PAYMENT_RECEIVED: { icon: "💰", title: "Payment Received" },
    CONTRACT_STARTED: { icon: "🚀", title: "Project Started" },
    WORK_SUBMITTED: { icon: "📤", title: "Work Submitted" },
    WORK_APPROVED: { icon: "✅", title: "Work Approved" },
    REVISIONS_REQUESTED: { icon: "🔄", title: "Revision Requested" },
    REVISION_SUBMITTED: { icon: "📤", title: "Revision Submitted" },
    BID_WITHDRAWN: { icon: "🗑️", title: "Bid Withdrawn" },
    GIG_DELETED: { icon: "🗑️", title: "Gig Deleted" },

    default: { icon: "🔔", title: "Account Update" }
  };

  const itemMeta = meta[notif.type] || meta.default;
  return {
    id: notif._id,
    icon: itemMeta.icon,
    title: itemMeta.title,
    description: notif.message || notif.body || "Notification update received.",
    time: relTime(notif.createdAt)
  };
};

/* ── Empty state ── */
function EmptyState({ icon, title, sub, actionText, onActionClick, compact }) {
  return (
    <div className={`premium-empty-state${compact ? " compact" : ""}`}>
      <div className="empty-state-icon-wrapper">
        <span className="empty-state-icon">{icon}</span>
      </div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-description">{sub}</p>
      {actionText && (
        <button className="empty-state-btn" onClick={onActionClick}>
          {actionText}
        </button>
      )}
    </div>
  );
}

/* ── Bid Comparison Card ── */
function BidComparisonView({ bids, onAccept, onReject }) {
  const pending = bids.filter((b) => b.status === "pending");
  if (pending.length < 2) return null;

  const avgPrice = Math.round(pending.reduce((s, b) => s + b.price, 0) / pending.length);
  const minPrice = Math.min(...pending.map((b) => b.price));

  return (
    <div className="bid-comparison">
      <div className="bid-comparison-header">
        <span className="bch-title">⚖️ Bid Comparison</span>
        <span className="bch-sub">
          {pending.length} bids · avg ${avgPrice} · lowest ${minPrice}
        </span>
      </div>
      <div className="bid-comparison-grid">
        {pending.map((bid) => (
          <div
            key={bid._id}
            className={`bid-comp-card${bid.price === minPrice ? " best-value" : ""}`}
          >
            {bid.price === minPrice && (
              <div className="best-value-tag">💰 Best Value</div>
            )}
            <div className="bcc-name">{bid.bidderId?.name || "Freelancer"}</div>
            <div className="bcc-price">${bid.price}</div>
            <div className="bcc-diff">
              {bid.price === minPrice
                ? "Lowest bid"
                : `+$${bid.price - minPrice} vs lowest`}
            </div>
            <p className="bcc-message">{bid.message || "—"}</p>
            <div className="bcc-actions">
              <button className="btn-action btn-accept" onClick={() => onAccept(bid._id)}>
                ✓ Accept
              </button>
              <button className="btn-action btn-reject" onClick={() => onReject(bid._id)}>
                ✕ Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SavedGigsTab() {
  const [gigs, setGigs] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/saved-gigs").then(r => setGigs(r.data)).catch(() => { });
  }, []);

  const removeSaved = async (gigId) => {
    await api.post("/saved-gigs/toggle", { gigId });
    setGigs(prev => prev.filter(g => g._id !== gigId));
  };

  if (!gigs.length)
    return (
      <EmptyState
        icon="❤️"
        title="No saved gigs"
        sub="Heart a gig to save it here."
        actionText="Browse Gigs"
        onActionClick={() => navigate("/explore")}
      />
    );

  return (
    <div className="section-card">
      <div className="section-card-header">
        <div className="section-card-title"><span>❤️</span> Saved Gigs</div>
      </div>
      <div className="table-wrapper">
        <table>
          <thead><tr><th>Title</th><th>Price</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            {gigs.map(gig => (
              <tr key={gig._id}>
                <td className="td-title" style={{ cursor: "pointer", color: "var(--brand)" }}
                  onClick={() => navigate(`/gig/${gig._id}`)}>
                  {gig.title}
                </td>
                <td className="td-price">${gig.price}</td>
                <td><Badge status={gig.status === "assigned" ? "hired" : gig.status} /></td>
                <td>
                  <button className="btn-action btn-delete" onClick={() => removeSaved(gig._id)}>
                    ♡ Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MyReviewsTab() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/reviews/my-reviews")
      .then(r => setReviews(r.data))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="review-loading" style={{ padding: "40px", display: "flex", justifyContent: "center" }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!reviews.length) {
    return <EmptyState icon="⭐" title="No reviews yet" sub="Reviews left by clients or freelancers will appear here." />;
  }

  return (
    <div className="section-card" style={{ padding: "24px" }}>
      <div className="section-card-header" style={{ borderBottom: "none", padding: "0 0 20px" }}>
        <div className="section-card-title"><span>⭐</span> My Reviews ({reviews.length})</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {reviews.map((r) => {
          const initials = r.reviewerId?.name ? r.reviewerId.name.charAt(0).toUpperCase() : "?";
          return (
            <div key={r._id} className="review-card" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px" }}>
              <div className="review-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "linear-gradient(135deg, var(--brand-dark), var(--brand-hover))", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", fontSize: "14px" }}>
                    {initials}
                  </div>
                  <div>
                    <div style={{ fontWeight: "700", fontSize: "14px", color: "var(--text-primary)" }}>{r.reviewerId?.name || "Anonymous"}</div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>Project: <span style={{ color: "var(--brand-hover)" }}>{r.gigId?.title || "—"}</span></div>
                  </div>
                </div>
                <div style={{ color: "#f59e0b", fontSize: "14px" }}>
                  {"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}
                </div>
              </div>
              <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", lineHeight: "1.6", margin: 0 }}>{r.comment}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}


export default function Profile() {
  const location = useLocation();
  const navigate = useNavigate();

  // ✅ FIX: context exports fetchNotifications, not refreshNotifications
  const { fetchNotifications, unreadMessages, notifications, markAllRead, refreshTrigger } = useNotifications();
  const { user, setUser, socket } = useAuth();
  const unreadNotifications = notifications.filter(n => !n.isRead).length;
  const inFlightMarkRead = useRef(null);

  const [profile, setProfile] = useState(null);
  const [gigs, setGigs] = useState([]);
  const [bids, setBids] = useState([]);
  const [receivedBids, setReceivedBids] = useState([]);
  const [stats, setStats] = useState({});
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "dashboard";
  const setActiveTab = useCallback((tab) => {
    setSearchParams({ tab });
  }, [setSearchParams]);
  const [modal, setModal] = useState(null);
  const [showComparison, setShowComparison] = useState(false);
  const [counterBidId, setCounterBidId] = useState(null);
  const [counterPrice, setCounterPrice] = useState("");
  const [counterMessage, setCounterMessage] = useState("");
  const [isCountering, setIsCountering] = useState(false);


  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [settingsErr, setSettingsErr] = useState("");

  const [revisionBidId, setRevisionBidId] = useState(null);
  const [gigsFilter, setGigsFilter] = useState("all");
  const [bidsFilter, setBidsFilter] = useState("all");
  const [offersFilter, setOffersFilter] = useState("all");
  const [revisionNotes, setRevisionNotes] = useState("");
  const [isSubmittingRevision, setIsSubmittingRevision] = useState(false);

  // ✅ REMOVED: const token = localStorage.getItem("token")

  const pendingOffers = receivedBids.filter((b) => b.status === "pending" || (b.status === "countered" && b.lastOfferBy !== (user?._id || profile?._id))).length;
  const pendingBids = bids.filter((b) => b.status === "pending" || (b.status === "countered" && b.lastOfferBy !== (user?._id || profile?._id))).length;

  const bidsUnreadCount = notifications.filter(n => !n.isRead && n.meta?.role === "freelancer").length;
  const offersUnreadCount = notifications.filter(n => !n.isRead && n.meta?.role === "client").length;

  // Parts 4/5/6: Dashboard action indicators
  const counterOffersReceived = bids.filter(b => b.status === "countered" && b.lastOfferBy !== (user?._id || profile?._id)).length;

  const showToast = (message, type = "success") => {
    if (type === "success") {
      toast.success(message);
    } else {
      toast.error(message);
    }
  };

  /* ── fetchAll — uses api instance, no manual headers ── */
  const fetchAll = useCallback(async () => {
    try {
      // ✅ All 5 requests use api — token attached automatically,
      //    401 TOKEN_EXPIRED triggers silent refresh via interceptor
      const [pR, gR, bR, rR, sR] = await Promise.all([
        api.get("/profile"),
        api.get("/profile/gigs"),
        api.get("/profile/bids"),
        api.get("/profile/received-bids"),
        api.get("/profile/stats"),
      ]);

      const p = pR.data;
      const g = gR.data;
      const b = bR.data;
      const r = rR.data;
      const s = sR.data;

      setProfile(p);
      setEditName(p.name || "");
      setEditBio(p.bio || "");
      setEditPhone(p.phone || "");
      setGigs(Array.isArray(g) ? g : []);
      setBids(Array.isArray(b) ? b : []);
      setReceivedBids(Array.isArray(r) ? r : []);
      setStats(s || {});
    } catch (e) {
      console.error("fetchAll error:", e);
    }
  }, []); // ✅ no token dependency — api reads token from memory internally

  useEffect(() => {
    fetchAll();
  }, [fetchAll, location.key]);

  // ✅ Refresh dashboard statistics automatically in real time when centralized context trigger increments
  useEffect(() => {
    fetchAll();
  }, [fetchAll, refreshTrigger]);

  useEffect(() => {
    if (location.state?.tab) {
      const tab = location.state.tab;
      navigate(location.pathname + location.search, { replace: true, state: {} });
      setActiveTab(tab);
    }
  }, [location.state, navigate, location.pathname, location.search, setActiveTab]);

  // Clear unread badges when visiting relevant tabs
  useEffect(() => {
    if (activeTab === "offers") {
      const hasUnread = notifications.some(n => !n.isRead && n.meta?.role === "client");
      if (hasUnread && inFlightMarkRead.current !== "client") {
        inFlightMarkRead.current = "client";
        markAllRead("client").finally(() => {
          inFlightMarkRead.current = null;
        });
      }
    } else if (activeTab === "bids") {
      const hasUnread = notifications.some(n => !n.isRead && n.meta?.role === "freelancer");
      if (hasUnread && inFlightMarkRead.current !== "freelancer") {
        inFlightMarkRead.current = "freelancer";
        markAllRead("freelancer").finally(() => {
          inFlightMarkRead.current = null;
        });
      }
    }
  }, [activeTab, notifications, markAllRead]);

  /* ── Generic action — uses api, no manual headers ── */
  const doAction = async (endpoint, method = "put", successMsg) => {
    try {
      // ✅ api.put / api.delete — method is lowercase axios style
      await api[method](endpoint);
      await fetchAll();
      fetchNotifications();         // ✅ correct name from context
      showToast(successMsg);
    } catch (err) {
      showToast(err.response?.data?.message || "Something went wrong", "error");
    }
  };

  /* ── Modal-guarded actions — pass relative endpoint paths ── */
  const handleAccept = (id) => {
    setModal({
      type: "confirm",
      title: "Accept this bid?",
      body: "This will proceed to checkout to hire the freelancer.",
      confirmLabel: "Checkout",
      onConfirm: async () => {
        try {
          const { data } = await api.put(`/bids/accept/${id}`);
          await fetchAll();
          navigate('/checkout', {
            state: {
              gig: {
                _id: data.checkoutData.gigId,
                title: data.checkoutData.gigTitle,
                image: data.checkoutData.gigImage,
                price: data.checkoutData.gigPrice,
                deliveryTime: data.checkoutData.deliveryTime,
                ownerId: { name: data.checkoutData.freelancerName },
              },
              bid: {
                _id: data.checkoutData.bidId,
                price: data.checkoutData.gigPrice,
              },
            }
          });
        } catch (err) {
          showToast(err.response?.data?.message || "Accept failed", "error");
        }
      },
    });
  };

  const handleReject = (id) => {
    setModal({
      type: "danger",
      title: "Reject this bid?",
      body: "The freelancer will be notified that their bid was not selected.",
      confirmLabel: "Reject",
      onConfirm: () => doAction(`/bids/reject/${id}`, "put", "Offer rejected."),
    });
  };

  const handleWithdraw = (id) => {
    setModal({
      type: "danger",
      title: "Withdraw your bid?",
      body: "Your bid will be permanently removed from this gig.",
      confirmLabel: "Withdraw",
      onConfirm: () => doAction(`/bids/withdraw/${id}`, "delete", "Bid withdrawn."),
    });
  };

  const handleDelete = (id) => {
    setModal({
      type: "danger",
      title: "Delete this gig?",
      body: "All associated bids will also be removed. This cannot be undone.",
      confirmLabel: "Delete Gig",
      onConfirm: () => doAction(`/gigs/${id}`, "delete", "Gig deleted."),
    });
  };

  const handleOpenCounter = (bid) => {
    setCounterBidId(bid._id);
    setCounterPrice(bid.price);
    setCounterMessage("");
  };

  const handleCounterSubmit = async (e) => {
    e.preventDefault();
    if (!counterPrice || isNaN(counterPrice) || Number(counterPrice) < 1) {
      showToast("Please enter a valid price.", "error");
      return;
    }
    if (!counterMessage.trim() || counterMessage.trim().length < 10) {
      showToast("Please enter a proposal message (minimum 10 characters).", "error");
      return;
    }
    setIsCountering(true);
    try {
      await api.put(`/bids/counter/${counterBidId}`, {
        price: Number(counterPrice),
        message: counterMessage.trim()
      });
      showToast("Counter offer submitted!");
      setCounterBidId(null);
      await fetchAll();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to submit counter offer.", "error");
    } finally {
      setIsCountering(false);
    }
  };

  const handleAcceptCounter = (bid) => {
    setModal({
      type: "confirm",
      title: "Accept this counter offer?",
      body: "This will accept the client's proposal. The client will be prompted to complete checkout.",
      confirmLabel: "Accept Offer",
      onConfirm: () => doAction(`/bids/accept/${bid._id}`, "put", "Counter offer accepted!"),
    });
  };

  const handleRejectCounter = (bid) => {
    setModal({
      type: "danger",
      title: "Decline this counter offer?",
      body: "The counter offer will be rejected.",
      confirmLabel: "Decline",
      onConfirm: () => doAction(`/bids/reject/${bid._id}`, "put", "Counter offer declined."),
    });
  };

  const handleOpenRevisionModal = (gigId) => {
    setRevisionBidId(gigId);
    setRevisionNotes("");
  };

  const handleRevisionSubmit = async (e) => {
    e.preventDefault();
    if (!revisionNotes.trim()) {
      showToast("Please enter revision notes.", "error");
      return;
    }
    setIsSubmittingRevision(true);
    try {
      await api.put(`/gigs/${revisionBidId}/request-changes`, {
        notes: revisionNotes.trim()
      });
      showToast("Revision request sent successfully! ↩");
      setRevisionBidId(null);
      setRevisionNotes("");
      await fetchAll();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to send revision request.", "error");
    } finally {
      setIsSubmittingRevision(false);
    }
  };

  const handleApproveWork = (gigId) => {
    setModal({
      type: "confirm",
      title: "Approve Freelancer's Work?",
      body: "This will approve the submitted work and mark the project as completed.",
      confirmLabel: "Approve & Complete",
      onConfirm: () => doAction(`/gigs/${gigId}/approve-work`, "put", "Work approved and project completed! 🎉"),
    });
  };

  /* ── Settings save ── */
  const handleSaveSettings = async () => {
    setSettingsErr("");
    if (!editName.trim() || editName.trim().length < 2) {
      setSettingsErr("Name must be at least 2 characters.");
      return;
    }
    try {
      // ✅ api.put — no manual Content-Type or Authorization needed
      const { data } = await api.put("/profile/update", {
        name: editName,
        bio: editBio,
        phone: editPhone,
      });
      setUser(data);
      localStorage.setItem("user", JSON.stringify(data));
      await fetchAll();
      showToast("Profile updated! ✨");
    } catch (err) {
      setSettingsErr(err.response?.data?.message || "Update failed");
    }
  };

  if (!profile) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p className="loading-text">Loading your dashboard…</p>
      </div>
    );
  }

  const initials = profile.name ? profile.name.charAt(0).toUpperCase() : "U";

  return (
    <div className="dashboard">

      {/* ═══ SIDEBAR ═══ */}
      <aside className="sidebar">
        <div className="sidebar-logo" onClick={() => navigate("/")}>GigFlow</div>
        <div className="sidebar-section-label">Navigation</div>
        <ul>
          {NAV.map((item) => (
            <li
              key={item.key}
              className={activeTab === item.key ? "active" : ""}
              onClick={() => {
                if (item.key === "messages") {
                  navigate("/chat");
                } else if (item.key === "notifications") {
                  navigate("/notifications");
                } else {
                  if (activeTab !== item.key) {
                    setActiveTab(item.key);
                  }
                }
              }}
            >
              <span className="sidebar-icon">{item.icon}</span>
              {item.label}
              {item.key === "bids" && bidsUnreadCount > 0 && (
                <span className="sidebar-badge">{bidsUnreadCount}</span>
              )}
              {item.key === "offers" && offersUnreadCount > 0 && (
                <span className="sidebar-badge">{offersUnreadCount}</span>
              )}
              {item.key === "messages" && unreadMessages > 0 && (
                <span className="sidebar-badge">{unreadMessages}</span>
              )}
              {item.key === "notifications" && unreadNotifications > 0 && (
                <span className="sidebar-badge">{unreadNotifications}</span>
              )}
            </li>
          ))}
        </ul>
        <div className="sidebar-footer">
          <div className="sidebar-user-mini" onClick={() => setActiveTab("settings")}>
            <div className="mini-avatar">{initials}</div>
            <div className="mini-info">
              <div className="mini-name">{profile.name}</div>
              <div className="mini-role">View Settings</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ═══ MAIN ═══ */}
      <main className="dashboard-content">

        {/* Page Header */}
        <div className="page-header">
          <div className="page-header-left">
            <div className="page-header-title">
              {NAV.find((n) => n.key === activeTab)?.icon}{" "}
              {NAV.find((n) => n.key === activeTab)?.label}
            </div>
            <div className="page-header-sub">
              {activeTab === "dashboard" && `Welcome back, ${profile.name} 👋`}
              {activeTab === "gigs" && `${gigs.length} gig${gigs.length !== 1 ? "s" : ""} posted`}
              {activeTab === "bids" && (
                pendingBids > 0
                  ? `${pendingBids} pending · ${bids.length} total`
                  : `${bids.length} bid${bids.length !== 1 ? "s" : ""} placed`
              )}
              {activeTab === "offers" && `${receivedBids.length} bid${receivedBids.length !== 1 ? "s" : ""} received`}
              {activeTab === "settings" && "Manage your account preferences"}
            </div>
          </div>
          <div className="header-profile">
            <div className="header-info">
              <div className="user-name">{profile.name}</div>
              <div className="user-email">{profile.email}</div>
            </div>
            <div className="header-avatar">{initials}</div>
          </div>
        </div>

        {/* ── DASHBOARD TAB ── */}
        {activeTab === "dashboard" && (
          <DashboardTab
            profile={profile}
            notifications={notifications}
            stats={stats}
            gigs={gigs}
            bids={bids}
            receivedBids={receivedBids}
            bidsUnreadCount={bidsUnreadCount}
            offersUnreadCount={offersUnreadCount}
            setActiveTab={setActiveTab}
            mapNotificationToActivity={mapNotificationToActivity}
          />
        )}

        {/* ── MY GIGS TAB ── */}
        {activeTab === "gigs" && (
          <MyGigsTab
            gigs={gigs}
            receivedBids={receivedBids}
            gigsFilter={gigsFilter}
            setGigsFilter={setGigsFilter}
            handleOpenRevisionModal={handleOpenRevisionModal}
            handleApproveWork={handleApproveWork}
            handleDelete={handleDelete}
          />
        )}

        {/* ── MY BIDS TAB ── */}
        {activeTab === "bids" && (
          <MyBidsTab
            bids={bids}
            bidsFilter={bidsFilter}
            setBidsFilter={setBidsFilter}
            user={user}
            profile={profile}
            handleRejectCounter={handleRejectCounter}
            handleOpenCounter={handleOpenCounter}
            handleAcceptCounter={handleAcceptCounter}
            handleWithdraw={handleWithdraw}
            fetchAll={fetchAll}
          />
        )}

        {/* ── RECEIVED OFFERS TAB ── */}
        {activeTab === "offers" && (
          <ReceivedBidsTab
            receivedBids={receivedBids}
            offersFilter={offersFilter}
            setOffersFilter={setOffersFilter}
            pendingOffers={pendingOffers}
            showComparison={showComparison}
            setShowComparison={setShowComparison}
            user={user}
            profile={profile}
            handleReject={handleReject}
            handleAccept={handleAccept}
            handleOpenCounter={handleOpenCounter}
            handleOpenRevisionModal={handleOpenRevisionModal}
            handleApproveWork={handleApproveWork}
          />
        )}

        {/* ── SAVED GIGS TAB ── */}
        {activeTab === "saved" && <SavedGigsTab />}

        {/* ── MY REVIEWS TAB ── */}
        {activeTab === "reviews" && <MyReviewsTab />}

        {/* ── SETTINGS TAB ── */}
        {activeTab === "settings" && (
          <SettingsTab
            profile={profile}
            editName={editName}
            setEditName={setEditName}
            editPhone={editPhone}
            setEditPhone={setEditPhone}
            editBio={editBio}
            setEditBio={setEditBio}
            settingsErr={settingsErr}
            setSettingsErr={setSettingsErr}
            handleSaveSettings={handleSaveSettings}
            setModal={setModal}
            showToast={showToast}
          />
        )}

      </main>

      <ConfirmModal modal={modal} onClose={() => setModal(null)} />

       {counterBidId && (
        <Modal isOpen={!!counterBidId} onClose={() => setCounterBidId(null)} title="Make a Counter Offer">
          <form onSubmit={handleCounterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600' }}>Counter Price (USD)</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }}>$</span>
                <input
                  type="number"
                  style={{ padding: '10px 10px 10px 24px', width: '100%', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'inherit' }}
                  placeholder="Enter amount"
                  value={counterPrice}
                  min="1"
                  onChange={(e) => setCounterPrice(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600' }}>Proposal / Message</label>
              <textarea
                style={{ padding: '10px', width: '100%', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'inherit' }}
                rows={4}
                placeholder="Explain your proposal details..."
                value={counterMessage}
                onChange={(e) => setCounterMessage(e.target.value)}
                required
              />
            </div>
            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <button type="button" className="btn-secondary" style={{ padding: '10px 20px', borderRadius: '8px' }} onClick={() => setCounterBidId(null)}>Cancel</button>
              <button type="submit" className="btn-primary" style={{ padding: '10px 20px', borderRadius: '8px' }} disabled={isCountering}>
                {isCountering ? "Sending..." : "Submit Counter"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {revisionBidId && (
        <Modal isOpen={!!revisionBidId} onClose={() => setRevisionBidId(null)} title="Request Revisions">
          <form onSubmit={handleRevisionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600' }}>Revision Notes / Required Changes</label>
              <textarea
                style={{ padding: '10px', width: '100%', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'inherit' }}
                rows={6}
                placeholder="Describe the changes or adjustments you need the freelancer to make..."
                value={revisionNotes}
                onChange={(e) => setRevisionNotes(e.target.value)}
                required
              />
            </div>
            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <button type="button" className="btn-secondary" style={{ padding: '10px 20px', borderRadius: '8px' }} onClick={() => setRevisionBidId(null)}>Cancel</button>
              <button type="submit" className="btn-primary btn-danger" style={{ padding: '10px 20px', borderRadius: '8px' }} disabled={isSubmittingRevision}>
                {isSubmittingRevision ? "Sending..." : "Request Changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}