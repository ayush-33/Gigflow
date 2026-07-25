import React from "react";
import { useNavigate } from "react-router-dom";
import { Badge, EmptyState } from "./ProfileCommon";

export default function DashboardTab({
  profile,
  notifications,
  stats,
  gigs,
  bids,
  receivedBids,
  bidsUnreadCount,
  offersUnreadCount,
  setActiveTab,
  mapNotificationToActivity,
}) {
  const navigate = useNavigate();
  const sortedNotifs = [...notifications].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <div className="dashboard-grid-container">
      {/* Top Section Layout */}
      <div className="dashboard-top-section">
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
}
