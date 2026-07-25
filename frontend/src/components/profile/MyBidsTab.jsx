import React from "react";
import { useNavigate } from "react-router-dom";
import { Badge, EmptyState } from "./ProfileCommon";
import api from "../../api/api";
import toast from "react-hot-toast";

export default function MyBidsTab({
  bids,
  bidsFilter,
  setBidsFilter,
  user,
  profile,
  handleRejectCounter,
  handleOpenCounter,
  handleAcceptCounter,
  handleWithdraw,
  fetchAll,
}) {
  const navigate = useNavigate();

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
}
