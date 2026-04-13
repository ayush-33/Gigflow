import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useNotifications } from "../context/NotificationContext";
import "../styles/Profile.css";

/* ── Sidebar nav items ── */
const NAV = [
  { key: "dashboard", icon: "🏠", label: "Dashboard" },
  { key: "gigs",      icon: "📦", label: "My Gigs"   },
  { key: "bids",      icon: "💬", label: "My Bids"   },
  { key: "offers",    icon: "📥", label: "Received Offers" },
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
    open: "Open", active: "Active / Hired", hired: "Hired",
    pending: "Pending", closed: "Closed", rejected: "Rejected",
    withdrawn: "Withdrawn",
  };
  const cls = map[status] || "badge-pending";
  return <span className={`badge ${cls}`}>{label[status] || status}</span>;
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

export default function Profile() {
  const location = useLocation();
  const navigate = useNavigate();
  const { refreshNotifications } = useNotifications();

  const [profile,      setProfile]      = useState(null);
  const [gigs,         setGigs]         = useState([]);
  const [bids,         setBids]         = useState([]);
  const [receivedBids, setReceivedBids] = useState([]);
  const [stats,        setStats]        = useState({});
  const [activeTab,    setActiveTab]    = useState("dashboard");
  const [toast,        setToast]        = useState(null);

  /* settings edit state */
  const [editName,  setEditName]  = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editBio,   setEditBio]   = useState("");
  const [editPhone, setEditPhone] = useState("");

  const token = localStorage.getItem("token");

  /* pending offers count for badge */
  const pendingOffers = receivedBids.filter(b => b.status === "pending").length;
  const pendingBids   = bids.filter(b => b.status === "pending").length;

  const showToast = (message, type = "success") => setToast({ message, type });

  /* ── Fetch ── */
  const fetchAll = async () => {
    try {
      const h = { Authorization: `Bearer ${token}` };
      const [pR, gR, bR, rR, sR] = await Promise.all([
        fetch("http://localhost:5000/api/profile",             { headers: h }),
        fetch("http://localhost:5000/api/profile/gigs",        { headers: h }),
        fetch("http://localhost:5000/api/profile/bids",        { headers: h }),
        fetch("http://localhost:5000/api/profile/received-bids",{ headers: h }),
        fetch("http://localhost:5000/api/profile/stats",       { headers: h }),
      ]);
      const p = await pR.json();
      setProfile(p);
      setEditName(p.name  || "");
      setEditEmail(p.email || "");
      setEditBio(p.bio    || "");
      setEditPhone(p.phone || "");
      setGigs(await gR.json());
      setBids(await bR.json());
      setReceivedBids(await rR.json());
      setStats(await sR.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { fetchAll(); }, [token, location.search]);

  /* ── Actions ── */
  const doAction = async (url, method = "PUT", successMsg) => {
    try {
      await fetch(url, { method, headers: { Authorization: `Bearer ${token}` } });
      await fetchAll();
      refreshNotifications();
      showToast(successMsg);
    } catch (e) {
      showToast("Something went wrong", "error");
    }
  };

  const handleAccept   = (id) => doAction(`http://localhost:5000/api/bids/accept/${id}`,   "PUT",    "Offer accepted! 🎉");
  const handleReject   = (id) => doAction(`http://localhost:5000/api/bids/reject/${id}`,   "PUT",    "Offer rejected.");
  const handleWithdraw = (id) => {
    if (!window.confirm("Withdraw this bid?")) return;
    doAction(`http://localhost:5000/api/bids/withdraw/${id}`, "DELETE", "Bid withdrawn.");
  };
  const handleDelete   = (id) => {
    if (!window.confirm("Delete this gig?")) return;
    doAction(`http://localhost:5000/api/gigs/${id}`,          "DELETE", "Gig deleted.");
  };

  const handleSaveSettings = async () => {
    try {
      await fetch("http://localhost:5000/api/profile/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: editName, bio: editBio, phone: editPhone }),
      });
      await fetchAll();
      showToast("Profile updated! ✨");
    } catch {
      showToast("Update failed", "error");
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

      {/* ═══════════════ SIDEBAR ═══════════════ */}
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

        {/* mini user at bottom */}
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

      {/* ═══════════════ MAIN ═══════════════ */}
      <main className="dashboard-content">

        {/* ── Page Header ── */}
        <div className="page-header">
          <div className="page-header-left">
            <div className="page-header-title">
              {NAV.find(n => n.key === activeTab)?.icon}{" "}
              {NAV.find(n => n.key === activeTab)?.label}
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

        {/* ══════════ DASHBOARD TAB ══════════ */}
        {activeTab === "dashboard" && (
          <>
            {/* Stats */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon-box blue">📦</div>
                <div className="stat-body">
                  <div className="stat-number">{stats.gigsPosted  || 0}</div>
                  <div className="stat-label">Gigs Posted</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon-box amber">💬</div>
                <div className="stat-body">
                  <div className="stat-number">{stats.bidsPlaced  || 0}</div>
                  <div className="stat-label">Bids Placed</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon-box green">📥</div>
                <div className="stat-body">
                  <div className="stat-number">{receivedBids.length}</div>
                  <div className="stat-label">Offers Received</div>
                </div>
              </div>
            </div>

            {/* Recent Gigs */}
            <div className="section-card">
              <div className="section-card-header">
                <div className="section-card-title">
                  <span className="section-card-title-icon">📦</span> Recent Gigs
                </div>
                <button className="section-card-action"
                  onClick={() => setActiveTab("gigs")}>
                  View all →
                </button>
              </div>

              {gigs.length === 0 ? (
                <EmptyState icon="📭" title="No gigs yet"
                  sub="Post your first gig to start receiving offers." />
              ) : (
                <div className="recent-gigs-list">
                  {gigs.slice(0, 4).map((gig) => (
                    <div className="recent-gig-row" key={gig._id}>
                      <div className="recent-gig-info">
                        <div className="recent-gig-title">{gig.title}</div>
                        <div className="recent-gig-price">${gig.price}</div>
                      </div>
                      <Badge status={gig.status === "active" ? "hired" : gig.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Bids */}
            <div className="section-card">
              <div className="section-card-header">
                <div className="section-card-title">
                  <span className="section-card-title-icon">💬</span> Recent Bids
                </div>
                <button className="section-card-action"
                  onClick={() => setActiveTab("bids")}>
                  View all →
                </button>
              </div>

              {bids.length === 0 ? (
                <EmptyState icon="📭" title="No bids placed"
                  sub="Browse gigs and place your first bid." />
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Gig</th><th>Price</th><th>Status</th>
                      </tr>
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

        {/* ══════════ MY GIGS TAB ══════════ */}
        {activeTab === "gigs" && (
          <div className="section-card">
            <div className="section-card-header">
              <div className="section-card-title">
                <span className="section-card-title-icon">📦</span> My Gigs
              </div>
              <button className="section-card-action"
                onClick={() => navigate("/become-seller")}>
                + Post New Gig
              </button>
            </div>

            {gigs.length === 0 ? (
              <EmptyState icon="📭" title="No gigs posted yet"
                sub="Create your first gig to start getting hired." />
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Title</th><th>Price</th><th>Status</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gigs.map((gig) => (
                      <tr key={gig._id}>
                        <td className="td-title">{gig.title}</td>
                        <td className="td-price">${gig.price}</td>
                        <td>
                          <Badge status={gig.status === "active" ? "hired" : gig.status} />
                        </td>
                        <td>
                          <div className="action-btns">
                            <button className="btn-action btn-edit"
                              onClick={() => navigate(`/edit-gig/${gig._id}`)}>
                              ✏️ Edit
                            </button>
                            <button className="btn-action btn-delete"
                              onClick={() => handleDelete(gig._id)}>
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

        {/* ══════════ MY BIDS TAB ══════════ */}
        {activeTab === "bids" && (
          <div className="section-card">
            <div className="section-card-header">
              <div className="section-card-title">
                <span className="section-card-title-icon">💬</span> My Bids
              </div>
            </div>

            {bids.length === 0 ? (
              <EmptyState icon="🤝" title="No bids placed yet"
                sub="Explore gigs and submit your first bid." />
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Gig</th><th>Price</th><th>Status</th><th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bids.map((bid) => (
                      <tr key={bid._id}>
                        <td className="td-title">{bid.gigId?.title || "—"}</td>
                        <td className="td-price">${bid.price}</td>
                        <td><Badge status={bid.status} /></td>
                        <td>
                          {bid.status === "pending" ? (
                            <button className="btn-action btn-withdraw"
                              onClick={() => handleWithdraw(bid._id)}>
                              ↩ Withdraw
                            </button>
                          ) : bid.status === "hired" ? (
                            <Badge status="hired" />
                          ) : bid.status === "rejected" ? (
                            <Badge status="rejected" />
                          ) : (
                            <Badge status="closed" />
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

        {/* ══════════ RECEIVED OFFERS TAB ══════════ */}
        {activeTab === "offers" && (
          <div className="section-card">
            <div className="section-card-header">
              <div className="section-card-title">
                <span className="section-card-title-icon">📥</span> Received Offers
                {pendingOffers > 0 && (
                  <span className="sidebar-badge" style={{ marginLeft: 8 }}>
                    {pendingOffers} new
                  </span>
                )}
              </div>
            </div>

            {receivedBids.length === 0 ? (
              <EmptyState icon="📬" title="No offers yet"
                sub="Once freelancers bid on your gigs, they will appear here." />
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Freelancer</th><th>Price</th><th>Message</th>
                      <th>Status</th><th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receivedBids.map((bid) => (
                      <tr key={bid._id}>
                        <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                          {bid.bidderId?.name || "—"}
                        </td>
                        <td className="td-price">${bid.price}</td>
                        <td className="td-message">{bid.message || "—"}</td>
                        <td><Badge status={bid.status === "active" ? "hired" : bid.status} /></td>
                        <td>
                          {bid.status === "pending" ? (
                            <div className="action-btns">
                              <button className="btn-action btn-accept"
                                onClick={() => handleAccept(bid._id)}>
                                ✓ Accept
                              </button>
                              <button className="btn-action btn-reject"
                                onClick={() => handleReject(bid._id)}>
                                ✕ Reject
                              </button>
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
        )}

        {/* ══════════ SETTINGS TAB ══════════ */}
        {activeTab === "settings" && (
          <div className="section-card">
            <div className="section-card-header">
              <div className="section-card-title">
                <span className="section-card-title-icon">⚙️</span> Account Settings
              </div>
            </div>

            <div className="settings-grid">

              {/* Name */}
              <div className="settings-field">
                <label>Full Name</label>
                <input
                  className="field-value editable"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Your name"
                />
              </div>

              {/* Email (read-only) */}
              <div className="settings-field">
                <label>Email Address</label>
                <div className="field-value">{profile.email}</div>
              </div>

              {/* Phone */}
              <div className="settings-field">
                <label>Phone Number</label>
                <input
                  className="field-value editable"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="+91 00000 00000"
                />
              </div>

              {/* Member Since */}
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

              {/* Bio full width */}
              <div className="settings-field" style={{ gridColumn: "1 / -1" }}>
                <label>Bio / About</label>
                <textarea
                  className="field-value editable"
                  rows={3}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Tell clients a bit about yourself…"
                  style={{ resize: "vertical", lineHeight: 1.6 }}
                />
              </div>

              <div className="settings-divider" />

              {/* Save row */}
              <div className="settings-save-row">
                <button className="btn-cancel-settings"
                  onClick={() => {
                    setEditName(profile.name || "");
                    setEditBio(profile.bio   || "");
                    setEditPhone(profile.phone || "");
                  }}>
                  Cancel
                </button>
                <button className="btn-save" onClick={handleSaveSettings}>
                  Save Changes
                </button>
              </div>

              {/* Danger zone */}
              <div className="settings-danger-zone">
                <div className="danger-zone-info">
                  <div className="dz-title">Delete Account</div>
                  <div className="dz-sub">
                    Permanently delete your account and all data. This cannot be undone.
                  </div>
                </div>
                <button className="btn-danger"
                  onClick={() => window.confirm("Are you sure? This is permanent.") &&
                    showToast("Please contact support to delete your account.", "error")}>
                  Delete Account
                </button>
              </div>

            </div>
          </div>
        )}

      </main>

      {/* ═══════════════ TOAST ═══════════════ */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

    </div>
  );
}