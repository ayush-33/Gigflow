import React from "react";
import { useNavigate } from "react-router-dom";
import { Badge, EmptyState, BidComparisonView } from "./ProfileCommon";

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

export default function ReceivedBidsTab({
  receivedBids,
  offersFilter,
  setOffersFilter,
  pendingOffers,
  showComparison,
  setShowComparison,
  user,
  profile,
  handleReject,
  handleAccept,
  handleOpenCounter,
  handleOpenRevisionModal,
  handleApproveWork,
}) {
  const navigate = useNavigate();

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
}
