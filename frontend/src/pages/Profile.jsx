import { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useNotifications } from "../context/NotificationContext";
import ConfirmModal from "../components/ConfirmModal";
import api from "../api/api";          // ✅ NEW
import "../styles/Profile.css";

/* ── Sidebar nav ── */
const NAV = [
  { key: "dashboard", icon: "🏠", label: "Dashboard" },
  { key: "gigs",      icon: "📦", label: "My Gigs" },
  { key: "bids",      icon: "💬", label: "My Bids" },
  { key: "offers",    icon: "📥", label: "Received Offers" },
  { key: "saved",     icon: "❤️", label: "Saved Gigs" }, // ✅ ADD THIS
  { key: "settings",  icon: "⚙️",  label: "Settings" },
];

/* ── Status badge ── */
function Badge({ status }) {
  const map = {
    open:      "badge-open",
    active:    "badge-active",
    hired:     "badge-hired",
    pending:   "badge-pending",
    closed:    "badge-closed",
    rejected:  "badge-rejected",
    withdrawn: "badge-withdrawn",
  };
  const label = {
    open:      "Open",
    active:    "Active / Hired",
    hired:     "Hired",
    pending:   "Pending",
    closed:    "Closed",
    rejected:  "Rejected",
    withdrawn: "Withdrawn",
  };
  return (
    <span className={`badge ${map[status] || "badge-pending"}`}>
      {label[status] || status}
    </span>
  );
}

/* ── Toast ── */
function Toast({ message, type = "success", onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`toast toast-${type}`}>
      <span className="toast-icon">{type === "success" ? "✅" : "❌"}</span>
      {message}
    </div>
  );
}

/* ── Empty state ── */
function EmptyState({ icon, title, sub }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      <div className="empty-sub">{sub}</div>
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
    api.get("/saved-gigs").then(r => setGigs(r.data)).catch(() => {});
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
                <td className="td-title" style={{ cursor:"pointer", color:"var(--brand)" }}
                  onClick={() => navigate(`/gig/${gig._id}`)}>
                  {gig.title}
                </td>
                <td className="td-price">${gig.price}</td>
                <td><Badge status={gig.status === "assigned" ? "hired" : "open"} /></td>
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


export default function Profile() {
  const location = useLocation();
  const navigate = useNavigate();

  // ✅ FIX: context exports fetchNotifications, not refreshNotifications
  const { fetchNotifications } = useNotifications();

  const [profile,        setProfile]        = useState(null);
  const [gigs,           setGigs]           = useState([]);
  const [bids,           setBids]           = useState([]);
  const [receivedBids,   setReceivedBids]   = useState([]);
  const [stats,          setStats]          = useState({});
  const [activeTab,      setActiveTab]      = useState("dashboard");
  const [toast,          setToast]          = useState(null);
  const [modal,          setModal]          = useState(null);
  const [showComparison, setShowComparison] = useState(false);

  /* settings */
  const [editName,    setEditName]    = useState("");
  const [editBio,     setEditBio]     = useState("");
  const [editPhone,   setEditPhone]   = useState("");
  const [settingsErr, setSettingsErr] = useState("");

  // ✅ REMOVED: const token = localStorage.getItem("token")

  const pendingOffers = receivedBids.filter((b) => b.status === "pending").length;
  const pendingBids   = bids.filter((b) => b.status === "pending").length;

  const showToast = (message, type = "success") => setToast({ message, type });

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
      setEditName(p.name   || "");
      setEditBio(p.bio     || "");
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
      body: "This will hire the freelancer and close your gig to other bidders.",
      confirmLabel: "Accept Bid",
      onConfirm: () => doAction(`/bids/accept/${id}`, "put", "Offer accepted! 🎉"),
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

  /* ── Settings save ── */
  const handleSaveSettings = async () => {
    setSettingsErr("");
    if (!editName.trim() || editName.trim().length < 2) {
      setSettingsErr("Name must be at least 2 characters.");
      return;
    }
    try {
      // ✅ api.put — no manual Content-Type or Authorization needed
      await api.put("/profile/update", {
        name:  editName,
        bio:   editBio,
        phone: editPhone,
      });
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

  // ── Everything below this line is IDENTICAL to your original ──

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
              onClick={() => setActiveTab(item.key)}
            >
              <span className="sidebar-icon">{item.icon}</span>
              {item.label}
              {item.key === "offers" && pendingOffers > 0 && (
                <span className="sidebar-badge">{pendingOffers}</span>
              )}
              {item.key === "bids" && pendingBids > 0 && (
                <span className="sidebar-badge">{pendingBids}</span>
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
              {activeTab === "gigs"      && `${gigs.length} gig${gigs.length !== 1 ? "s" : ""} posted`}
              {activeTab === "bids"      && `${bids.length} bid${bids.length !== 1 ? "s" : ""} placed`}
              {activeTab === "offers"    && `${receivedBids.length} offer${receivedBids.length !== 1 ? "s" : ""} received`}
              {activeTab === "settings"  && "Manage your account preferences"}
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
          <>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon-box blue">📦</div>
                <div className="stat-body">
                  <div className="stat-number">{stats.gigsPosted ?? gigs.length}</div>
                  <div className="stat-label">Gigs Posted</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon-box amber">💬</div>
                <div className="stat-body">
                  <div className="stat-number">{stats.bidsPlaced ?? bids.length}</div>
                  <div className="stat-label">Bids Placed</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon-box green">🎉</div>
                <div className="stat-body">
                  <div className="stat-number">{stats.hiresWon || 0}</div>
                  <div className="stat-label">Times Hired</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon-box blue">📥</div>
                <div className="stat-body">
                  <div className="stat-number">{receivedBids.length}</div>
                  <div className="stat-label">Offers Received</div>
                </div>
              </div>
            </div>

            <div className="section-card">
              <div className="section-card-header">
                <div className="section-card-title">
                  <span className="section-card-title-icon">📦</span> Recent Gigs
                </div>
                <button className="section-card-action" onClick={() => setActiveTab("gigs")}>
                  View all →
                </button>
              </div>
              {gigs.length === 0 ? (
                <EmptyState icon="📭" title="No gigs yet" sub="Post your first gig to start receiving offers." />
              ) : (
                <div className="recent-gigs-list">
                  {gigs.slice(0, 4).map((gig) => (
                    <div className="recent-gig-row" key={gig._id}>
                      <div className="recent-gig-info">
                        <div className="recent-gig-title">{gig.title}</div>
                        <div className="recent-gig-price">${gig.price}</div>
                      </div>
                      <Badge status={gig.status === "assigned" ? "hired" : gig.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="section-card">
              <div className="section-card-header">
                <div className="section-card-title">
                  <span className="section-card-title-icon">💬</span> Recent Bids
                </div>
                <button className="section-card-action" onClick={() => setActiveTab("bids")}>
                  View all →
                </button>
              </div>
              {bids.length === 0 ? (
                <EmptyState icon="📭" title="No bids placed" sub="Browse gigs and place your first bid." />
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr><th>Gig</th><th>Price</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {bids.slice(0, 3).map((bid) => (
                        <tr key={bid._id}>
                          <td className="td-title">{bid.gigId?.title || "—"}</td>
                          <td className="td-price">${bid.price}</td>
                          <td><Badge status={bid.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── MY GIGS TAB ── */}
        {activeTab === "gigs" && (
          <div className="section-card">
            <div className="section-card-header">
              <div className="section-card-title">
                <span className="section-card-title-icon">📦</span> My Gigs
              </div>
              <button className="section-card-action" onClick={() => navigate("/become-seller")}>
                + Post New Gig
              </button>
            </div>
            {gigs.length === 0 ? (
              <EmptyState icon="📭" title="No gigs posted yet" sub="Create your first gig to start getting hired." />
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr><th>Title</th><th>Price</th><th>Status</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {gigs.map((gig) => (
                      <tr key={gig._id}>
                        <td
                          className="td-title"
                          style={{ cursor: "pointer", color: "var(--brand)" }}
                          onClick={() => navigate(`/gig/${gig._id}`)}
                        >
                          {gig.title}
                        </td>
                        <td className="td-price">${gig.price}</td>
                        <td><Badge status={gig.status === "assigned" ? "hired" : gig.status} /></td>
                        <td>
                          <div className="action-btns">
                            <button className="btn-action btn-edit" onClick={() => navigate(`/edit-gig/${gig._id}`)}>
                              ✏️ Edit
                            </button>
                            <button className="btn-action btn-delete" onClick={() => handleDelete(gig._id)}>
                              🗑 Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── MY BIDS TAB ── */}
        {activeTab === "bids" && (
          <div className="section-card">
            <div className="section-card-header">
              <div className="section-card-title">
                <span className="section-card-title-icon">💬</span> My Bids
              </div>
            </div>
            {bids.length === 0 ? (
              <EmptyState icon="🤝" title="No bids placed yet" sub="Explore gigs and submit your first bid." />
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr><th>Gig</th><th>Price</th><th>Status</th><th>Action</th></tr>
                  </thead>
                  <tbody>
                    {bids.map((bid) => (
                      <tr key={bid._id}>
                        <td
                          className="td-title"
                          style={{ cursor: "pointer", color: "var(--brand)" }}
                          onClick={() => navigate(`/gig/${bid.gigId?._id}`)}
                        >
                          {bid.gigId?.title || "—"}
                        </td>
                        <td className="td-price">${bid.price}</td>
                        <td><Badge status={bid.status} /></td>
                        <td>
                          {bid.status === "pending" ? (
                            <button className="btn-action btn-withdraw" onClick={() => handleWithdraw(bid._id)}>
                              ↩ Withdraw
                            </button>
                          ) : (
                            <Badge status={bid.status} />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── RECEIVED OFFERS TAB ── */}
        {activeTab === "offers" && (
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
              {receivedBids.length === 0 ? (
                <EmptyState icon="📬" title="No offers yet" sub="Once freelancers bid on your gigs, they will appear here." />
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Freelancer</th><th>Gig</th><th>Price</th>
                        <th>Message</th><th>Status</th><th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receivedBids.map((bid) => (
                        <tr key={bid._id}>
                          <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                            {bid.bidderId?.name || "—"}
                          </td>
                          <td className="td-title">{bid.gigId?.title || "—"}</td>
                          <td className="td-price">${bid.price}</td>
                          <td className="td-message">{bid.message || "—"}</td>
                          <td><Badge status={bid.status === "active" ? "hired" : bid.status} /></td>
                          <td>
                            {bid.status === "pending" ? (
                              <div className="action-btns">
                                <button className="btn-action btn-accept" onClick={() => handleAccept(bid._id)}>✓ Accept</button>
                                <button className="btn-action btn-reject" onClick={() => handleReject(bid._id)}>✕ Reject</button>
                              </div>
                            ) : (
                              <Badge status={bid.status === "active" ? "hired" : bid.status} />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
{activeTab === "saved" && <SavedGigsTab />}

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
                    setEditName(profile.name  || "");
                    setEditBio(profile.bio    || "");
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

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <ConfirmModal modal={modal} onClose={() => setModal(null)} />
    </div>
  );
}