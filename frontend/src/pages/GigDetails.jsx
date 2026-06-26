import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import api from "../api/api";
import ReviewSection from "../components/ReviewSection";
import { useAuth } from "../context/AuthContext";
import ConfirmModal from "../components/ConfirmModal";
import toast from "react-hot-toast";

import "../styles/GigDetails.css";

function StarRating({ score = 4.5 }) {
  const full  = Math.floor(score);
  const half  = score % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return (
    <span className="stars">
      {"★".repeat(full)}{half ? "½" : ""}{"☆".repeat(empty)}
    </span>
  );
}

export default function GigDetails() {
  const { id }   = useParams();
  const navigate = useNavigate();

  const [gig,        setGig]        = useState(null);
  const [bidStatus,  setBidStatus]  = useState(null); // { isOwner, isAssigned, alreadyBid, bidCount }
  const [imgError,   setImgError]   = useState(false);
  const [modal,      setModal]      = useState(null);
  const { user } = useAuth();

  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState("");
  const [isSubmittingRevision, setIsSubmittingRevision] = useState(false);


  const fetchData = useCallback(async () => {
  try {
    // Public
    const { data: gigData } = await api.get(`/gigs/${id}`);
    setGig(gigData);

    // Protected
    if (user) {
      const { data: bsData } = await api.get(`/gigs/${id}/bid-status`);
      setBidStatus(bsData);
    }

  } catch (err) {
    console.error(err);
  }
}, [id, user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = () => {
    setModal({
      type: "danger",
      title: "Delete this gig?",
      body: "All bids on this gig will also be removed. This cannot be undone.",
      confirmLabel: "Delete Gig",
      onConfirm: async () => {
        try {
          await api.delete(`/gigs/${id}`);
          toast.success("Gig deleted successfully.");
          navigate("/profile");
        } catch (err) {
          console.error(err);
          toast.error(err.response?.data?.message || "Delete failed");
        }
      },
    });
  };

  const handleLifecycleAction = async (action) => {
    try {
      await api.put(`/gigs/${id}/${action}`);
      await fetchData();
      if (action === "submit-work") {
        toast.success("Work submitted for review! 📤");
      } else if (action === "approve-work") {
        toast.success("Project approved and completed! 🎉");
      } else if (action === "request-changes") {
        toast.success("Revisions requested. ↩");
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Action failed");
    }
  };

  const handleRevisionSubmit = async (e) => {
    e.preventDefault();
    if (!revisionNotes.trim()) {
      toast.error("Please enter revision notes.");
      return;
    }
    setIsSubmittingRevision(true);
    try {
      await api.put(`/gigs/${id}/request-changes`, { notes: revisionNotes.trim() });
      toast.success("Revision request sent successfully! ↩");
      setShowRevisionModal(false);
      setRevisionNotes("");
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send revision request.");
    } finally {
      setIsSubmittingRevision(false);
    }
  };

  const guessIcon = (title = "") => {
    const t = title.toLowerCase();
    if (t.includes("logo") || t.includes("design"))   return "🎨";
    if (t.includes("web")  || t.includes("website"))  return "💻";
    if (t.includes("video"))  return "🎬";
    if (t.includes("seo"))    return "🔍";
    if (t.includes("write") || t.includes("content")) return "✍️";
    if (t.includes("music") || t.includes("audio"))   return "🎵";
    return "💼";
  };

  if (!gig) {
    return (
      <div className="gig-details-page">
        <div className="gig-loading">
          <div className="loading-spinner" />
          <span>Loading gig details…</span>
        </div>
      </div>
    );
  }

  const sellerName = gig.ownerId?.username || gig.ownerId?.name || "Unknown Seller";
  const rating = gig.rating || 0;
const reviewCount = gig.reviewCount || 0;

  // ✅ FIX: image path — backend now stores ONLY filename, so prepend full URL here
  const imageUrl = gig.image
    ? gig.image.startsWith("/uploads/")
      ? `http://localhost:5001${gig.image}`         // legacy: already has /uploads/
      : `http://localhost:5001/uploads/${gig.image}` // new: just filename
    : null;

  // ✅ FIX: isAssigned is now visible to ALL visitors (not just owner)
  const isAssigned = ["assigned", "hired", "in_progress", "submitted", "completed"].includes(gig.status);
  const isOwner    = bidStatus?.isOwner ?? false;
  const alreadyBid = bidStatus?.alreadyBid ?? false;
  const bidCount   = gig.bidCount ?? bidStatus?.bidCount ?? 0;

  return (
    <div className="gig-details-page">

      {/* Breadcrumb */}
      <nav className="gig-breadcrumb">
        <button onClick={() => navigate("/")}>Home</button>
        <span>/</span>
        <button onClick={() => navigate("/explore")}>Explore Gigs</button>
        <span>/</span>
        <span style={{ color: "var(--text-secondary)" }}>
          {gig.title?.slice(0, 32)}{gig.title?.length > 32 ? "…" : ""}
        </span>
      </nav>

      <div className="gig-details-container">
        <div className="gig-details-grid">

          {/* LEFT */}
          <div className="gig-image-panel">
            <div className="gig-image-wrapper">
              {!imgError && imageUrl ? (
                <>
                  <img src={imageUrl} alt={gig.title} onError={() => setImgError(true)} />
                  <div className="gig-image-shimmer" />
                </>
              ) : (
                <div className="gig-image-fallback">
                  <span className="fallback-icon">{guessIcon(gig.title)}</span>
                  <span className="fallback-label">No Preview</span>
                </div>
              )}

              {gig.category && (
                <span className="gig-category-badge">{gig.category}</span>
              )}

              {/* ✅ FIX: status badge visible to ALL visitors with granular labels */}
              {(() => {
                const statusLabels = {
                  open:        { label: "● Open",          cls: "open" },
                  assigned:    { label: "🔒 Hired",         cls: "assigned" },
                  hired:       { label: "🔨 In Progress",   cls: "assigned" },
                  in_progress: { label: "🔨 In Progress",   cls: "assigned" },
                  submitted:   { label: "📤 Under Review",  cls: "submitted" },
                  completed:   { label: "✅ Completed",      cls: "completed" },
                };
                const s = statusLabels[gig.status] || statusLabels.open;
                return <span className={`gig-status-badge ${s.cls}`}>{s.label}</span>;
              })()}

              {/* ✅ NEW: bid counter */}
              {bidCount > 0 && (
                <span className="gig-bid-count-badge">
                  {bidCount} bid{bidCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            <div className="seller-card">
              <div className="seller-avatar-lg">
                {sellerName.charAt(0).toUpperCase()}
              </div>
              <div className="seller-info">
                <p className="seller-label">Posted by</p>
                <p className="seller-name-lg">{sellerName}</p>
              </div>
              <span className="seller-badge">Seller</span>
            </div>
          </div>

          {/* RIGHT */}
          <div className="gig-info-panel">
            <div className="gig-header">
              {gig.category && <p className="gig-category-line">{gig.category}</p>}
              <h1 className="gig-title-main">{gig.title}</h1>
              <div className="gig-rating-row">
                <StarRating score={rating} />
                <span className="rating-val">{Number(rating).toFixed(1)}</span>
                <span className="review-count">({reviewCount} reviews)</span>
              </div>
            </div>

            <div className="gig-divider" />

            <div className="gig-description-block">
              <p className="block-label">About this gig</p>
              <p className="gig-description-text">{gig.description}</p>
            </div>

            <div className="gig-divider" />

            <div className="gig-meta-grid">
              <div className="meta-stat">
                <span className="meta-icon">💰</span>
                <span className="meta-label">Starting at</span>
                <span className="meta-value price">${gig.price}</span>
              </div>
              <div className="meta-stat">
                <span className="meta-icon">⏱️</span>
                <span className="meta-label">Delivery</span>
                <span className="meta-value delivery">{gig.deliveryTime}d</span>
              </div>
              {bidCount > 0 && (
                <div className="meta-stat">
                  <span className="meta-icon">📊</span>
                  <span className="meta-label">Bids received</span>
                  <span className="meta-value">{bidCount}</span>
                </div>
              )}
            </div>

            {/* CTA card */}
            <div className="gig-cta-card">

              {user && !isOwner && bidStatus?.revisionNotes && (
                <div className="revision-notes-banner" style={{
                  background: "rgba(239, 68, 68, 0.08)",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                  borderLeft: "4px solid #ef4444",
                  borderRadius: "8px",
                  padding: "16px",
                  marginBottom: "16px",
                  fontSize: "14px",
                  color: "#f87171",
                  textAlign: "left",
                  lineHeight: "1.5"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", color: "#ef4444", marginBottom: "8px" }}>
                    <span>↩</span> Revision Request Notes
                  </div>
                  <div style={{ whiteSpace: "pre-wrap", color: "var(--text-secondary, #e2e8f0)" }}>
                    {bidStatus.revisionNotes}
                  </div>
                </div>
              )}

              {/* ✅ FIX: assigned status shown to ALL visitors */}
              {isAssigned && (
                bidStatus?.bidStatus && ["hired", "in_progress", "submitted", "completed"].includes(bidStatus.bidStatus) ? (
                  <div className="taken-badge hired-success" style={{ background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0", padding: "12px", borderRadius: "8px", fontWeight: "700", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                    ✅ You were selected for this gig
                  </div>
                ) : (
                  <div className="taken-badge" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", padding: "12px", borderRadius: "8px", color: "var(--text-secondary)", textAlign: "center" }}>
                    🔒 A freelancer has already been hired for this gig
                  </div>
                )
              )}

              {user && isOwner && (bidStatus?.bidStatus === "payment_pending" || gig.status === "payment_pending") && (
                <button
                  className="btn-bid"
                  onClick={() =>
                    navigate("/checkout", {
                      state: {
                        gig,
                        bid: {
                          _id: bidStatus?.acceptedBidId,
                          price: bidStatus?.acceptedBidPrice ?? gig.price
                        }
                      }
                    })
                  }
                >
                  💳 Pay & Hire Now
                </button>
              )}

              {!user && !isAssigned && (
                <button className="btn-bid" onClick={() => navigate("/login")}>
                  Login to Place a Bid →
                </button>
              )}

              {user && !isOwner && !alreadyBid && bidStatus?.bidStatus !== "rejected" && !isAssigned && (
                <button className="btn-bid" onClick={() => navigate(`/gigs/${id}/bid`)}>
                  Place a Bid →
                </button>
              )}

              {user && !isOwner && bidStatus?.bidStatus === "rejected" && !isAssigned && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%" }}>
                  <div className="btn-bid-submitted" style={{ background: "rgba(239,68,68,0.12)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.25)" }}>
                    ❌ Bid Rejected
                  </div>
                  <button className="btn-bid" onClick={() => navigate(`/gigs/${id}/bid`)}>
                    Submit New Bid →
                  </button>
                </div>
              )}

              {/* Freelancer who bid can message the client */}
              {user && !isOwner && (alreadyBid || bidStatus?.bidStatus === "rejected") && (
                <button
                  className="btn-message"
                  onClick={() => navigate("/chat", {
                    state: {
                      gigId: gig._id,
                      receiverId: gig.ownerId?._id || gig.ownerId,
                      gigTitle: gig.title,
                      gigPrice: gig.price,
                    }
                  })}
                >
                  💬 Message Client
                </button>
              )}

              {/* Freelancer workflow actions */}
              {user && !isOwner && bidStatus?.bidStatus && ["hired", "in_progress"].includes(bidStatus.bidStatus) && ["hired", "in_progress"].includes(gig.status) && (
                <button className="btn-bid" style={{ background: "#10b981", borderColor: "#10b981", marginTop: "8px" }} onClick={() => handleLifecycleAction("submit-work")}>
                  📤 Submit Work for Review
                </button>
              )}
              {user && !isOwner && bidStatus?.bidStatus === "submitted" && gig.status === "submitted" && (
                <div className="btn-bid-submitted" style={{ marginTop: "8px" }}>
                  ⏳ Work Submitted. Awaiting Client Approval...
                </div>
              )}
              {user && !isOwner && bidStatus?.bidStatus === "completed" && gig.status === "completed" && (
                <div className="btn-bid-submitted" style={{ background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0", marginTop: "8px" }}>
                  🏆 Project Completed & Approved!
                </div>
              )}

              {/* Client workflow actions */}
              {user && isOwner && gig.status === "submitted" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px", width: "100%" }}>
                  <div className="btn-bid-submitted" style={{ background: "rgba(245,158,11,0.12)", color: "#fcd34d", borderColor: "rgba(245,158,11,0.25)" }}>
                    📩 Freelancer submitted work for review
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button className="btn-bid" style={{ background: "#10b981", borderColor: "#10b981", flex: 1 }} onClick={() => handleLifecycleAction("approve-work")}>
                      ✓ Approve
                    </button>
                    <button className="btn-delete" style={{ background: "#f59e0b", borderColor: "#d97706", color: "#fff", flex: 1 }} onClick={() => setShowRevisionModal(true)}>
                      ↩ Revisions
                    </button>
                  </div>
                </div>
              )}
              {user && isOwner && gig.status === "completed" && (
                <div className="btn-bid-submitted" style={{ background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0", marginTop: "8px" }}>
                  🏆 Project Completed!
                </div>
              )}
              {user && isOwner && ["hired", "in_progress"].includes(gig.status) && (
                <div className="btn-bid-submitted" style={{ marginTop: "8px" }}>
                  ⏳ Project in progress...
                </div>
              )}

{/* Gig owner can message the hired freelancer */}
{user && isOwner && isAssigned && bidStatus?.acceptedBidderId && (
  <button
    className="btn-message"
    onClick={() => navigate("/chat", {
      state: {
        gigId: gig._id,
        receiverId: bidStatus.acceptedBidderId,
        gigTitle: gig.title,
        gigPrice: bidStatus.acceptedBidPrice ?? gig.price,
      }
    })}
  >
    💬 Message Freelancer
  </button>
)}

              {user && !isOwner && alreadyBid && !isAssigned && (
                <div className="btn-bid-submitted">
                  <span>✓</span> Bid Submitted
                </div>
              )}



              { user && isOwner && (
                <div className="owner-actions-row">
                  <button className="btn-bid" onClick={() => navigate(`/edit-gig/${id}`)}>
                    ✏️ Edit Gig
                  </button>
                  <button className="btn-delete" onClick={handleDelete}>
                    🗑 Delete Gig
                  </button>
                </div>
              )}

              <p className="cta-note">
                {isAssigned
                  ? "This gig is no longer accepting new bids."
                  : bidCount > 0
                    ? `💡 ${bidCount} freelancer${bidCount !== 1 ? "s have" : " has"} already bid. Submit your best offer!`
                    : "💡 Be the first to bid on this project!"}
              </p>
            </div>

          </div>
        </div>
      </div>
      {/* Reviews section */}

          <div className="gig-details-container" style={{ marginTop: "0.5rem" }}>
        <ReviewSection
          gigId={id}
          isOwner={isOwner}
          gigStatus={gig.status}
          user={user}
        />
      </div>

      <ConfirmModal modal={modal} onClose={() => setModal(null)} />

      {showRevisionModal && (
        <div className="modal-overlay" onClick={() => setShowRevisionModal(false)}>
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
                <button type="button" className="btn-secondary" style={{ padding: '10px 20px', borderRadius: '8px' }} onClick={() => setShowRevisionModal(false)}>Cancel</button>
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