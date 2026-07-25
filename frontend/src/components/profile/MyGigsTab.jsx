import React from "react";
import { useNavigate } from "react-router-dom";
import { Badge, EmptyState } from "./ProfileCommon";

// Helper for views count mock
const getViewsCount = (id) => {
  if (!id) return 0;
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
  return (12 + (sum % 89));
};

export default function MyGigsTab({
  gigs,
  receivedBids,
  gigsFilter,
  setGigsFilter,
  handleOpenRevisionModal,
  handleApproveWork,
  handleDelete,
}) {
  const navigate = useNavigate();

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
}
