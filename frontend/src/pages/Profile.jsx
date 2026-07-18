import { useEffect, useState, useCallback, Fragment, useRef } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useNotifications } from "../context/NotificationContext";
import { useAuth } from "../context/AuthContext";
import ConfirmModal from "../components/ConfirmModal";
import api from "../api/api";          // ✅ NEW
import toast from "react-hot-toast";
import "../styles/Profile.css";

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
    return <EmptyState icon="❤️" title="No saved gigs" sub="Heart a gig to save it here." />;

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
                  setActiveTab(item.key);
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
        {activeTab === "dashboard" && (() => {
          const sortedNotifs = [...notifications].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          return (
            <div className="dashboard-grid-container">
              {/* Header Greeting */}
              <div className="dashboard-welcome-banner">
                <div className="welcome-banner-text">
                  <h2>Welcome back, {profile.name} 👋</h2>
                  <p>Here is what is happening with your freelance projects today.</p>
                </div>
              </div>

              <div className="stats-grid">
                <div className="stat-card" onClick={() => setActiveTab("gigs")} style={{ cursor: 'pointer' }}>
                  <div className="stat-icon-box blue">📦</div>
                  <div className="stat-body">
                    <div className="stat-number">{stats.gigsPosted ?? gigs.length}</div>
                    <div className="stat-label">Gigs Posted</div>
                  </div>
                </div>
                <div className="stat-card" onClick={() => setActiveTab("bids")} style={{ cursor: 'pointer', position: 'relative' }}>
                  <div className="stat-icon-box blue">💬</div>
                  <div className="stat-body">
                    <div className="stat-number">
                      {stats.bidsPlaced ?? bids.length}
                      {bidsUnreadCount > 0 && (
                        <span className="stat-card-badge" style={{
                          position: "absolute",
                          top: "12px",
                          right: "12px",
                          background: "#ef4444",
                          color: "#fff",
                          fontSize: "11px",
                          fontWeight: "700",
                          padding: "2px 6px",
                          borderRadius: "10px",
                          lineHeight: 1
                        }}>{bidsUnreadCount}</span>
                      )}
                    </div>
                    <div className="stat-label">My Bids</div>
                  </div>
                </div>
                <div className="stat-card" onClick={() => setActiveTab("offers")} style={{ cursor: 'pointer', position: 'relative' }}>
                  <div className="stat-icon-box blue">📥</div>
                  <div className="stat-body">
                    <div className="stat-number">
                      {stats.offersReceived ?? receivedBids.length}
                      {offersUnreadCount > 0 && (
                        <span className="stat-card-badge" style={{
                          position: "absolute",
                          top: "12px",
                          right: "12px",
                          background: "#ef4444",
                          color: "#fff",
                          fontSize: "11px",
                          fontWeight: "700",
                          padding: "2px 6px",
                          borderRadius: "10px",
                          lineHeight: 1
                        }}>{offersUnreadCount}</span>
                      )}
                    </div>
                    <div className="stat-label">Offers Received</div>
                  </div>
                </div>
              </div>

              {/* Two Column Layout: Recent Activity & Bid Status Breakdown */}
              <div className="dashboard-secondary-grid">
                {/* Recent Activity */}
                <div className="section-card recent-activity-card">
                  <div className="section-card-header">
                    <div className="section-card-title">📋 Recent Activity</div>
                  </div>
                  {sortedNotifs.length === 0 ? (
                    <EmptyState
                      icon="📋"
                      title="No Recent Activity"
                      sub="Your recent account activity will appear here."
                      compact={true}
                    />
                  ) : (
                    <>
                      <div className="recent-activity-list">
                        {sortedNotifs.slice(0, 3).map((notif) => {
                          const activity = mapNotificationToActivity(notif);
                          return (
                            <div key={activity.id} className="activity-item-row" style={{ cursor: notif.link ? 'pointer' : 'default' }} onClick={() => {
                              if (notif.link) navigate(notif.link);
                            }}>
                              <div className="activity-icon-box">{activity.icon}</div>
                              <div className="activity-body">
                                <div className="activity-title-text">{activity.title}</div>
                                <p className="activity-desc">{activity.description}</p>
                                <span className="activity-time">{activity.time}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="recent-activity-footer">
                        <button className="view-all-activity-btn" onClick={() => navigate("/notifications")}>
                          View All Activity
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Bid Status Breakdown */}
                <div className="section-card status-breakdown-card">
                  <div className="section-card-header">
                    <div className="section-card-title">📊 Bid Status Breakdown</div>
                  </div>
                  <div className="stats-subgrid">
                    <div className="stat-subcard pending">
                      <span className="subcard-icon text-pending">⏳</span>
                      <div className="subcard-content">
                        <span className="subcard-val">{stats.pendingBids ?? 0}</span>
                        <span className="subcard-label">Pending</span>
                      </div>
                    </div>
                    <div className="stat-subcard accepted">
                      <span className="subcard-icon text-success">✅</span>
                      <div className="subcard-content">
                        <span className="subcard-val">{stats.acceptedBids ?? 0}</span>
                        <span className="subcard-label">Accepted</span>
                      </div>
                    </div>
                    <div className="stat-subcard rejected">
                      <span className="subcard-icon text-danger">❌</span>
                      <div className="subcard-content">
                        <span className="subcard-val">{stats.rejectedBids ?? 0}</span>
                        <span className="subcard-label">Rejected</span>
                      </div>
                    </div>
                    <div className="stat-subcard withdrawn">
                      <span className="subcard-icon text-muted">↩</span>
                      <div className="subcard-content">
                        <span className="subcard-val">{stats.withdrawnBids ?? 0}</span>
                        <span className="subcard-label">Withdrawn</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Gigs (Full Width) */}
              <div className="section-card recent-items-card">
                <div className="section-card-header">
                  <div className="section-card-title">📦 Recent Gigs</div>
                  {gigs.length > 2 && (
                    <button className="section-card-action" onClick={() => setActiveTab("gigs")}>
                      View all
                    </button>
                  )}
                </div>
                {gigs.length === 0 ? (
                  <EmptyState icon="📭" title="No gigs yet" sub="Post your first gig to start receiving offers." compact={true} />
                ) : (
                  <div className="recent-items-list">
                    {gigs.slice(0, 2).map((gig) => (
                      <div className="recent-item-row" key={gig._id} onClick={() => navigate(`/gig/${gig._id}`)}>
                        <div className="recent-item-info">
                          <span className="recent-item-title">{gig.title}</span>
                          <span className="recent-item-price">${gig.price}</span>
                        </div>
                        <Badge status={gig.status === "assigned" ? "hired" : gig.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Bids (Full Width) */}
              <div className="section-card recent-items-card">
                <div className="section-card-header">
                  <div className="section-card-title">💬 Recent Bids</div>
                  {bids.length > 2 && (
                    <button className="section-card-action" onClick={() => setActiveTab("bids")}>
                      View all
                    </button>
                  )}
                </div>
                {bids.length === 0 ? (
                  <EmptyState icon="📭" title="No bids placed" sub="Browse gigs and place your first bid." compact={true} />
                ) : (
                  <div className="recent-items-list">
                    {bids.slice(0, 2).map((bid) => (
                      <div className="recent-item-row" key={bid._id} onClick={() => bid.gigId?._id && navigate(`/gig/${bid.gigId._id}`)}>
                        <div className="recent-item-info">
                          <span className="recent-item-title">{bid.gigId?.title || "—"}</span>
                          <span className="recent-item-price">${bid.price}</span>
                        </div>
                        <Badge status={bid.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ── MY GIGS TAB ── */}
        {activeTab === "gigs" && (() => {
          const filteredGigs = gigs.filter(gig => {
            if (gigsFilter === "all") return true;
            if (gigsFilter === "open") return gig.status === "open";
            if (gigsFilter === "active") return ["assigned", "hired", "in_progress", "submitted"].includes(gig.status);
            if (gigsFilter === "completed") return gig.status === "completed";
            if (gigsFilter === "closed") return gig.status === "closed";
            return true;
          });

          return (
            <div className="section-card">
              <div className="section-card-header">
                <div className="section-card-title">
                  <span className="section-card-title-icon">📦</span> My Gigs
                </div>
                <button className="section-card-action" onClick={() => navigate("/become-seller")}>
                  + Post New Gig
                </button>
              </div>

              {/* Segmented Controls for Filters */}
              <div className="section-card-filters">
                <div className="segmented-filters">
                  {["all", "open", "active", "completed", "closed"].map((filterOpt) => (
                    <button
                      key={filterOpt}
                      className={`filter-btn ${gigsFilter === filterOpt ? "active" : ""}`}
                      onClick={() => setGigsFilter(filterOpt)}
                    >
                      {filterOpt === "all" ? "All Gigs" : filterOpt}
                    </button>
                  ))}
                </div>
              </div>

              {gigs.length === 0 ? (
                <EmptyState
                  icon="📭"
                  title="No gigs posted yet"
                  sub="Create your first gig listing to start attracting top freelancers."
                  actionText="Post New Gig"
                  onActionClick={() => navigate("/become-seller")}
                />
              ) : filteredGigs.length === 0 ? (
                <EmptyState
                  icon="🔍"
                  title="No matching gigs"
                  sub={`No gigs found with "${gigsFilter}" status.`}
                />
              ) : (
                <div className="my-gigs-grid">
                  {filteredGigs.map((gig) => {
                    const gigBids = receivedBids.filter(b => b.gigId && (b.gigId._id === gig._id || b.gigId === gig._id));
                    const bidCount = gigBids.length;
                    const hiredBid = gigBids.find(b => ["hired", "in_progress", "submitted", "completed"].includes(b.status));
                    const hiredFreelancer = hiredBid?.bidderId?.name;

                    return (
                      <div className="my-gig-card-new premium-dashboard-card" key={gig._id}>
                        {/* Header */}
                        <div className="card-header-section">
                          <div className="card-title-badges-row">
                            <span className="my-gig-card-category-tag">
                              {gig.category?.replace(/-/g, " ")}
                            </span>
                            <Badge status={gig.status === "assigned" ? "hired" : gig.status} />
                          </div>
                          <h3
                            className="card-title-clamp-2"
                            onClick={() => navigate(`/gig/${gig._id}`)}
                            title={gig.title}
                          >
                            {gig.title}
                          </h3>
                          <span className="my-gig-card-posted-date">
                            Posted {new Date(gig.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        </div>

                        {/* Content */}
                        <div className="card-content-section">
                          <p className="card-description-clamp-3">
                            {gig.description}
                          </p>

                          <div className="my-gig-card-meta-grid">
                            <div className="my-gig-card-meta-item">
                              <span className="my-gig-card-meta-label">Budget</span>
                              <span className="my-gig-card-meta-val price">${gig.price}</span>
                            </div>
                            <div className="my-gig-card-meta-item">
                              <span className="my-gig-card-meta-label">Total Bids</span>
                              <span className="my-gig-card-meta-val highlight">{bidCount} bid{bidCount !== 1 ? "s" : ""}</span>
                            </div>
                            <div className="my-gig-card-meta-item">
                              <span className="my-gig-card-meta-label">Views</span>
                              <span className="my-gig-card-meta-val">{getViewsCount(gig._id)}</span>
                            </div>
                          </div>

                          {hiredFreelancer && (
                            <div className="my-gig-activity-indicator">
                              <span className="activity-dot active" />
                              <span className="activity-text">Hired: <strong>{hiredFreelancer}</strong></span>
                            </div>
                          )}
                        </div>

                        {/* Spacer */}
                        <div className="spacer-grow" />

                        {/* Footer / Actions */}
                        <div className="card-footer-section">
                          {gig.status === "submitted" ? (
                            <div className="card-actions-group cols-3">
                              <button className="toolbar-btn btn-secondary" onClick={() => navigate(`/gig/${gig._id}`)}>
                                View
                              </button>
                              <button className="toolbar-btn btn-danger" onClick={() => handleOpenRevisionModal(gig._id)}>
                                Revisions
                              </button>
                              <button className="toolbar-btn btn-success" onClick={() => handleApproveWork(gig._id)}>
                                Approve
                              </button>
                            </div>
                          ) : (
                            <div className="card-actions-group cols-3">
                              <button className="toolbar-btn btn-primary" onClick={() => navigate(`/gig/${gig._id}`)}>
                                View Details
                              </button>
                              <button className="toolbar-btn btn-secondary" onClick={() => navigate(`/edit-gig/${gig._id}`)}>
                                Edit Gig
                              </button>
                              <button className="toolbar-btn btn-danger" onClick={() => handleDelete(gig._id)}>
                                Delete Gig
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* ── MY BIDS TAB ── */}
        {activeTab === "bids" && (() => {
          const filteredBids = bids.filter(bid => {
            if (bidsFilter === "all") return true;
            if (bidsFilter === "pending") return ["pending", "countered"].includes(bid.status);
            if (bidsFilter === "accepted") return ["payment_pending", "hired", "in_progress", "submitted", "completed"].includes(bid.status);
            if (bidsFilter === "rejected") return bid.status === "rejected";
            if (bidsFilter === "withdrawn") return bid.status === "withdrawn";
            return true;
          });

          return (
            <div className="section-card">
              <div className="section-card-header">
                <div className="section-card-title">
                  <span className="section-card-title-icon">💬</span> My Bids
                </div>
              </div>

              {/* Segmented Controls for Filters */}
              <div className="section-card-filters">
                <div className="segmented-filters">
                  {["all", "pending", "accepted", "rejected", "withdrawn"].map((filterOpt) => (
                    <button
                      key={filterOpt}
                      className={`filter-btn ${bidsFilter === filterOpt ? "active" : ""}`}
                      onClick={() => setBidsFilter(filterOpt)}
                    >
                      {filterOpt === "all" ? "All Bids" : filterOpt}
                    </button>
                  ))}
                </div>
              </div>

              {bids.length === 0 ? (
                <EmptyState
                  icon="🤝"
                  title="No bids placed yet"
                  sub="Explore open gigs in the marketplace and place your first proposal to get started."
                  actionText="Browse Gigs"
                  onActionClick={() => navigate("/explore")}
                />
              ) : filteredBids.length === 0 ? (
                <EmptyState
                  icon="🔍"
                  title="No matching bids"
                  sub={`No bids found with "${bidsFilter}" status.`}
                />
              ) : (
                <div className="my-gigs-grid">
                  {filteredBids.map((bid) => {
                    const isLastOfferByMe = bid.lastOfferBy === user?._id || bid.lastOfferBy === profile?._id;
                    return (
                      <div className="bid-card-new premium-dashboard-card" key={bid._id}>
                        {/* Header */}
                        {/* Header */}
                        <div className="card-header-section">

                          <div className="received-bid-header">

                            <div className="freelancer-profile-row">

                              <div className="freelancer-avatar-large">
                                {bid.gigId?.ownerId?.name
                                  ? bid.gigId.ownerId.name.charAt(0).toUpperCase()
                                  : "C"}
                              </div>

                              <div className="freelancer-info-block">

                                <h3 className="freelancer-name">
                                  {bid.gigId?.ownerId?.name || "Client"}
                                </h3>

                                <div className="freelancer-meta-row">
                                  <span>🧑 Client</span>
                                </div>

                              </div>

                            </div>

                            <Badge status={bid.status} />

                          </div>

                          <span
                            className="bid-card-title-link"
                            style={{
                              marginTop: "18px",
                              display: "block",
                              fontSize: "13.5px",
                              color: "var(--text-muted)"
                            }}
                          >
                            Project:&nbsp;
                            <strong
                              className="gig-link"
                              onClick={() => navigate(`/gig/${bid.gigId?._id}`)}
                            >
                              {bid.gigId?.title || "—"}
                            </strong>
                          </span>

                        </div>
                        {/* Content */}
                        <div className="card-content-section">
                          <div className="bid-card-details-grid">
                            <div className="bid-detail-item">
                              <span className="bid-detail-label">Your Bid</span>
                              <span className="bid-detail-value price">${bid.price}</span>
                            </div>
                            <div className="bid-detail-item">
                              <span className="bid-detail-label">Delivery</span>
                              <span className="bid-detail-value">{bid.gigId?.deliveryTime || "—"} Days</span>
                            </div>
                            <div className="bid-detail-item">
                              <span className="bid-detail-label">Submitted</span>
                              <span className="bid-detail-value">
                                {new Date(bid.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </span>
                            </div>
                          </div>

                          <div className="bid-proposal-section">
                            <span className="bid-proposal-label">Proposal Message</span>
                            <p className="card-description-clamp-3">
                              {bid.message}
                            </p>
                          </div>

                          {bid.revisionNotes && (
                            <div className="revision-notes-container">
                              <span className="info-label" style={{ color: "var(--danger)", display: "block", marginBottom: "4px" }}>⚠️ Revisions requested:</span>
                              <p style={{ margin: 0, fontSize: "12.5px", color: "var(--text-secondary)" }}>{bid.revisionNotes}</p>
                            </div>
                          )}
                        </div>

                        {/* Spacer */}
                        <div className="spacer-grow" />

                        {/* Footer / Actions */}
                        <div className="card-footer-section">
                          {(bid.status === "pending" || bid.status === "countered") ? (
                            <>
                              {!isLastOfferByMe ? (
                                <div className="card-actions-group cols-3">
                                  <button className="toolbar-btn btn-danger" onClick={() => handleRejectCounter(bid)}>Decline</button>
                                  <button className="toolbar-btn btn-primary" onClick={() => handleOpenCounter(bid)}>Counter</button>
                                  <button className="toolbar-btn btn-success" onClick={() => handleAcceptCounter(bid)}>Accept</button>
                                </div>
                              ) : (
                                <div className="card-actions-group cols-3">
                                  <button className="toolbar-btn btn-primary" onClick={() => bid.gigId?._id && navigate(`/gig/${bid.gigId._id}`)}>View Gig</button>
                                  <button className="toolbar-btn btn-purple" onClick={() => navigate("/chat", {
                                    state: {
                                      gigId: bid.gigId?._id || bid.gigId,
                                      receiverId: bid.gigId?.ownerId?._id || bid.gigId?.ownerId,
                                      gigTitle: bid.gigId?.title,
                                      gigPrice: bid.price,
                                      receiverName: bid.gigId?.ownerId?.name,
                                    }
                                  })}>Message Client</button>
                                  <button className="toolbar-btn btn-danger" onClick={() => handleWithdraw(bid._id)}>Withdraw Bid</button>
                                </div>
                              )}
                            </>
                          ) : bid.status === "hired" ? (
                            <div className="card-actions-group cols-3">
                              <button className="toolbar-btn btn-primary" onClick={() => navigate(`/gig/${bid.gigId?._id}`)}>View Gig</button>
                              <button className="toolbar-btn btn-purple" onClick={() => navigate("/chat", {
                                state: {
                                  gigId: bid.gigId?._id || bid.gigId,
                                  receiverId: bid.gigId?.ownerId?._id || bid.gigId?.ownerId,
                                  gigTitle: bid.gigId?.title,
                                  gigPrice: bid.price,
                                  receiverName: bid.gigId?.ownerId?.name,
                                }
                              })}>Message Client</button>
                              <button className="toolbar-btn btn-success" onClick={() => {
                                api.put(`/gigs/${bid.gigId?._id || bid.gigId}/start-work`)
                                  .then(() => { fetchAll(); toast.success("Work started! 🔨"); })
                                  .catch(err => toast.error(err.response?.data?.message || "Start failed"));
                              }}>Start Work</button>
                            </div>
                          ) : bid.status === "in_progress" ? (
                            <div className="card-actions-group cols-3">
                              <button className="toolbar-btn btn-primary" onClick={() => navigate(`/gig/${bid.gigId?._id}`)}>View Gig</button>
                              <button className="toolbar-btn btn-purple" onClick={() => navigate("/chat", {
                                state: {
                                  gigId: bid.gigId?._id || bid.gigId,
                                  receiverId: bid.gigId?.ownerId?._id || bid.gigId?.ownerId,
                                  gigTitle: bid.gigId?.title,
                                  gigPrice: bid.price,
                                  receiverName: bid.gigId?.ownerId?.name,
                                }
                              })}>Message Client</button>
                              <button className="toolbar-btn btn-success" onClick={() => {
                                api.put(`/gigs/${bid.gigId?._id || bid.gigId}/submit-work`)
                                  .then(() => { fetchAll(); toast.success("Work submitted! ✅"); })
                                  .catch(err => toast.error(err.response?.data?.message || "Submit failed"));
                              }}>{bid.revisionNotes ? "Submit Revised Work" : "Submit Work"}</button>
                            </div>
                          ) : bid.status === "completed" ? (
                            <div className="card-actions-group cols-3">
                              <button className="toolbar-btn btn-primary" onClick={() => bid.gigId?._id && navigate(`/gig/${bid.gigId._id}`)}>View Project</button>
                              <button className="toolbar-btn btn-purple" onClick={() => navigate("/chat", {
                                state: {
                                  gigId: bid.gigId?._id || bid.gigId,
                                  receiverId: bid.gigId?.ownerId?._id || bid.gigId?.ownerId,
                                  gigTitle: bid.gigId?.title,
                                  gigPrice: bid.price,
                                  receiverName: bid.gigId?.ownerId?.name,
                                }
                              })}>Message Client</button>
                              <button className="toolbar-btn btn-success" onClick={() => bid.gigId?._id && navigate(`/gig/${bid.gigId._id}`)}>Leave Review</button>
                            </div>
                          ) : bid.status === "payment_pending" ? (
                            <div className="card-actions-group cols-3">
                              <button className="toolbar-btn btn-primary" onClick={() => bid.gigId?._id && navigate(`/gig/${bid.gigId._id}`)}>View Gig</button>
                              <button className="toolbar-btn btn-purple" onClick={() => navigate("/chat", {
                                state: {
                                  gigId: bid.gigId?._id || bid.gigId,
                                  receiverId: bid.gigId?.ownerId?._id || bid.gigId?.ownerId,
                                  gigTitle: bid.gigId?.title,
                                  gigPrice: bid.price,
                                  receiverName: bid.gigId?.ownerId?.name,
                                }
                              })}>Message Client</button>
                              <button className="toolbar-btn btn-danger" onClick={() => handleWithdraw(bid._id)}>Withdraw Bid</button>
                            </div>
                          ) : (
                            <div className="card-actions-group cols-2">
                              <button className="toolbar-btn btn-primary" onClick={() => bid.gigId?._id && navigate(`/gig/${bid.gigId._id}`)}>View Gig</button>
                              <button className="toolbar-btn btn-purple" onClick={() => navigate("/chat", {
                                state: {
                                  gigId: bid.gigId?._id || bid.gigId,
                                  receiverId: bid.gigId?.ownerId?._id || bid.gigId?.ownerId,
                                  gigTitle: bid.gigId?.title,
                                  gigPrice: bid.price,
                                  receiverName: bid.gigId?.ownerId?.name,
                                }
                              })}>Message Client</button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* ── RECEIVED OFFERS TAB ── */}
        {activeTab === "offers" && (() => {
          const filteredOffers = receivedBids.filter(bid => {
            if (offersFilter === "all") return true;
            if (offersFilter === "pending") return bid.status === "pending";
            if (offersFilter === "countered") return bid.status === "countered";
            if (offersFilter === "hired") return ["payment_pending", "hired", "in_progress", "submitted", "active"].includes(bid.status);
            if (offersFilter === "completed") return bid.status === "completed";
            return true;
          });

          return (
            <>
              {pendingOffers >= 2 && (
                <div style={{ marginBottom: "1.5rem" }}>
                  <button
                    className="section-card-action"
                    style={{ marginBottom: "1rem", display: "inline-flex", alignItems: "center", gap: 6 }}
                    onClick={() => setShowComparison((p) => !p)}
                  >
                    {showComparison ? "Hide" : "⚖️ Compare all bids side by side"}
                  </button>
                  {showComparison && (
                    <BidComparisonView bids={receivedBids} onAccept={handleAccept} onReject={handleReject} />
                  )}
                </div>
              )}

              <div className="section-card">
                <div className="section-card-header">
                  <div className="section-card-title">
                    <span className="section-card-title-icon">📥</span> Received Offers
                    {pendingOffers > 0 && (
                      <span className="sidebar-badge" style={{ marginLeft: 8 }}>{pendingOffers} new</span>
                    )}
                  </div>
                </div>

                {/* Segmented Controls for Filters */}
                <div className="section-card-filters">
                  <div className="segmented-filters">
                    {["all", "pending", "countered", "hired", "completed"].map((filterOpt) => (
                      <button
                        key={filterOpt}
                        className={`filter-btn ${offersFilter === filterOpt ? "active" : ""}`}
                        onClick={() => setOffersFilter(filterOpt)}
                      >
                        {filterOpt === "all" ? "All Offers" : filterOpt === "hired" ? "Hired" : filterOpt}
                      </button>
                    ))}
                  </div>
                </div>

                {receivedBids.length === 0 ? (
                  <EmptyState
                    icon="📬"
                    title="No offers yet"
                    sub="Once freelancers bid on your gigs, they will appear here. Share your gigs to get offers."
                    actionText="Post New Gig"
                    onActionClick={() => navigate("/become-seller")}
                  />
                ) : filteredOffers.length === 0 ? (
                  <EmptyState
                    icon="🔍"
                    title="No matching offers"
                    sub={`No offers found with "${offersFilter}" status.`}
                  />
                ) : (
                  <div className="my-gigs-grid">
                    {filteredOffers.map((bid) => {
                      const isLastOfferByMe = bid.lastOfferBy === user?._id || bid.lastOfferBy === profile?._id;
                      const freelancerInitials = bid.bidderId?.name ? bid.bidderId.name.charAt(0).toUpperCase() : "?";

                      return (
                        <div className="bid-card-new received-bid-card premium-dashboard-card" key={bid._id}>
                          {/* Freelancer Header */}
                          <div className="card-header-section">
                            <div className="received-bid-header">
                              <div className="freelancer-profile-row">
                                <div className="freelancer-avatar-large">
                                  {freelancerInitials}
                                </div>
                                <div className="freelancer-info-block">
                                  <h3 className="freelancer-name">{bid.bidderId?.name || "Freelancer"}</h3>
                                  <div className="freelancer-meta-row">
                                    <span className="freelancer-rating">⭐ {getFreelancerRating(bid.bidderId?._id)}</span>
                                    <span className="freelancer-divider">•</span>
                                    <span className="freelancer-completed-projects">💼 {getFreelancerProjects(bid.bidderId?._id)} projects</span>
                                  </div>
                                </div>
                              </div>
                              <Badge status={bid.status === "active" ? "hired" : bid.status} />
                            </div>
                            <span className="bid-card-title-link" style={{ marginTop: '10px', display: 'block', fontSize: '13.5px', color: 'var(--text-muted)' }}>
                              Project: <strong className="gig-link" onClick={() => navigate(`/gig/${bid.gigId?._id}`)}>{bid.gigId?.title || "—"}</strong>
                            </span>
                          </div>

                          {/* Content */}
                          <div className="card-content-section">
                            <div className="bid-card-details-grid">
                              <div className="bid-detail-item">
                                <span className="bid-detail-label">Bid Amount</span>
                                <span className="bid-detail-value price">${bid.price}</span>
                              </div>
                              <div className="bid-detail-item">
                                <span className="bid-detail-label">Delivery</span>
                                <span className="bid-detail-value">{bid.gigId?.deliveryTime || "—"} Days</span>
                              </div>
                              <div className="bid-detail-item">
                                <span className="bid-detail-label">Submitted</span>
                                <span className="bid-detail-value">
                                  {new Date(bid.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </span>
                              </div>
                            </div>

                            <div className="bid-proposal-section">
                              <span className="bid-proposal-label">Proposal Details</span>
                              <p className="card-description-clamp-3">
                                {bid.message}
                              </p>
                            </div>

                            {bid.revisionNotes && (
                              <div className="revision-notes-container">
                                <span className="info-label" style={{ color: "var(--danger)", display: "block", marginBottom: "4px" }}>⚠️ Revision Instructions:</span>
                                <p style={{ margin: 0, fontSize: "12.5px", color: "var(--text-secondary)" }}>{bid.revisionNotes}</p>
                              </div>
                            )}
                          </div>

                          {/* Spacer */}
                          <div className="spacer-grow" />

                          {/* Footer / Actions */}
                          <div className="card-footer-section">
                            {(bid.status === "pending" || bid.status === "countered") ? (
                              <>
                                {!isLastOfferByMe ? (
                                  <div className="card-actions-group cols-4">
                                    <button className="toolbar-btn btn-danger" onClick={() => handleReject(bid._id)}>Reject Bid</button>
                                    <button className="toolbar-btn btn-purple" onClick={() => navigate("/chat", {
                                      state: {
                                        gigId: bid.gigId?._id || bid.gigId,
                                        receiverId: bid.bidderId?._id || bid.bidderId,
                                        gigTitle: bid.gigId?.title,
                                        gigPrice: bid.price,
                                        receiverName: bid.bidderId?.name,
                                      }
                                    })}>Message Freelancer</button>
                                    <button className="toolbar-btn btn-primary" onClick={() => handleOpenCounter(bid)}>Counter Offer</button>
                                    <button className="toolbar-btn btn-success" onClick={() => handleAccept(bid._id)}>Accept Bid</button>
                                  </div>
                                ) : (
                                  <div className="card-actions-group cols-2">
                                    <button className="toolbar-btn btn-purple" onClick={() => navigate("/chat", {
                                      state: {
                                        gigId: bid.gigId?._id || bid.gigId,
                                        receiverId: bid.bidderId?._id || bid.bidderId,
                                        gigTitle: bid.gigId?.title,
                                        gigPrice: bid.price,
                                        receiverName: bid.bidderId?.name,
                                      }
                                    })}>Message Freelancer</button>
                                    <span className="toolbar-label-status flex-grow-label">Awaiting response</span>
                                  </div>
                                )}
                              </>
                            ) : bid.status === "payment_pending" ? (
                              <div className="card-actions-group cols-2">
                                <button className="toolbar-btn btn-purple" onClick={() => navigate("/chat", {
                                  state: {
                                    gigId: bid.gigId?._id || bid.gigId,
                                    receiverId: bid.bidderId?._id || bid.bidderId,
                                    gigTitle: bid.gigId?.title,
                                    gigPrice: bid.price,
                                    receiverName: bid.bidderId?.name,
                                  }
                                })}>Message Freelancer</button>
                                <button
                                  className="toolbar-btn btn-success"
                                  onClick={() => bid.gigId?._id && navigate('/checkout', {
                                    state: {
                                      gig: {
                                        _id: bid.gigId._id,
                                        title: bid.gigId.title,
                                        price: bid.price,
                                        deliveryTime: bid.gigId.deliveryTime,
                                        image: bid.gigId.image,
                                        ownerId: { name: bid.bidderId?.name },
                                      },
                                      bid: { _id: bid._id, price: bid.price }
                                    }
                                  })}
                                >
                                  Pay Now
                                </button>
                              </div>
                            ) : bid.status === "submitted" ? (
                              <div className="card-actions-group cols-3">
                                <button className="toolbar-btn btn-purple" onClick={() => navigate("/chat", {
                                  state: {
                                    gigId: bid.gigId?._id || bid.gigId,
                                    receiverId: bid.bidderId?._id || bid.bidderId,
                                    gigTitle: bid.gigId?.title,
                                    gigPrice: bid.price,
                                    receiverName: bid.bidderId?.name,
                                  }
                                })}>Message Freelancer</button>
                                <button className="toolbar-btn btn-danger" onClick={() => handleOpenRevisionModal(bid.gigId?._id || bid.gigId)}>Request Revisions</button>
                                <button className="toolbar-btn btn-success" onClick={() => handleApproveWork(bid.gigId?._id || bid.gigId)}>Approve Work</button>
                              </div>
                            ) : (
                              <div className="card-actions-group cols-2">
                                <button className="toolbar-btn btn-primary" onClick={() => navigate(`/gig/${bid.gigId?._id}`)}>View Gig</button>
                                <button className="toolbar-btn btn-purple" onClick={() => navigate("/chat", {
                                  state: {
                                    gigId: bid.gigId?._id || bid.gigId,
                                    receiverId: bid.bidderId?._id || bid.bidderId,
                                    gigTitle: bid.gigId?.title,
                                    gigPrice: bid.price,
                                    receiverName: bid.bidderId?.name,
                                  }
                                })}>Message Freelancer</button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          );
        })()}
        {activeTab === "saved" && <SavedGigsTab />}
        {activeTab === "reviews" && <MyReviewsTab />}

        {/* ── SETTINGS TAB ── */}
        {activeTab === "settings" && (
          <div className="section-card">
            <div className="section-card-header">
              <div className="section-card-title">
                <span className="section-card-title-icon">⚙️</span> Account Settings
              </div>
            </div>
            <div className="settings-grid">
              <div className="settings-field">
                <label>Full Name</label>
                <input
                  className={`field-value editable${settingsErr && !editName.trim() ? " input-error" : ""}`}
                  value={editName}
                  onChange={(e) => { setEditName(e.target.value); setSettingsErr(""); }}
                  placeholder="Your name"
                />
              </div>
              <div className="settings-field">
                <label>Email Address</label>
                <div className="field-value">{profile.email}</div>
              </div>
              <div className="settings-field">
                <label>Phone Number</label>
                <input
                  className="field-value editable"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="+91 00000 00000"
                />
              </div>
              <div className="settings-field">
                <label>Member Since</label>
                <div className="field-value">
                  {profile.createdAt
                    ? new Date(profile.createdAt).toLocaleDateString("en-US", {
                      year: "numeric", month: "long", day: "numeric",
                    })
                    : "—"}
                </div>
              </div>
              <div className="settings-field" style={{ gridColumn: "1 / -1" }}>
                <label>Bio / About</label>
                <textarea
                  className="field-value editable"
                  rows={3}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Tell clients a bit about yourself…"
                  style={{ resize: "vertical", lineHeight: 1.6 }}
                  maxLength={500}
                />
                <span style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                  {editBio.length}/500
                </span>
              </div>

              {settingsErr && (
                <div style={{ gridColumn: "1 / -1", color: "#ef4444", fontSize: 14, padding: "4px 0" }}>
                  ⚠ {settingsErr}
                </div>
              )}

              <div className="settings-divider" />
              <div className="settings-save-row">
                <button
                  className="btn-cancel-settings"
                  onClick={() => {
                    setEditName(profile.name || "");
                    setEditBio(profile.bio || "");
                    setEditPhone(profile.phone || "");
                    setSettingsErr("");
                  }}
                >
                  Cancel
                </button>
                <button className="btn-save" onClick={handleSaveSettings}>
                  Save Changes
                </button>
              </div>

              <div className="settings-danger-zone">
                <div className="danger-zone-info">
                  <div className="dz-title">Delete Account</div>
                  <div className="dz-sub">
                    Permanently delete your account and all data. This cannot be undone.
                  </div>
                </div>
                <button
                  className="btn-danger"
                  onClick={() =>
                    setModal({
                      type: "danger",
                      title: "Delete your account?",
                      body: "This is permanent. All your gigs, bids, and data will be lost forever.",
                      confirmLabel: "Delete Account",
                      onConfirm: () => showToast("Please contact support to delete your account.", "error"),
                    })
                  }
                >
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        )}

      </main>

      <ConfirmModal modal={modal} onClose={() => setModal(null)} />

      {counterBidId && (
        <div className="modal-overlay" onClick={() => setCounterBidId(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="modal-title">Make a Counter Offer</div>
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
          </div>
        </div>
      )}

      {revisionBidId && (
        <div className="modal-overlay" onClick={() => setRevisionBidId(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="modal-title">Request Revisions</div>
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
          </div>
        </div>
      )}
    </div>
  );
}