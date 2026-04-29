import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import api from "../api/api";
import ReviewSection from "../components/ReviewSection";
import { useAuth } from "../context/AuthContext";
import ConfirmModal from "../components/ConfirmModal";

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
  const [toast,      setToast]      = useState(null);
  const { user } = useAuth();


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
          navigate("/profile");
        } catch (err) {
          console.error(err);
        }
      },
    });
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
      ? `http://localhost:5000${gig.image}`         // legacy: already has /uploads/
      : `http://localhost:5000/uploads/${gig.image}` // new: just filename
    : null;

  // ✅ FIX: isAssigned is now visible to ALL visitors (not just owner)
  const isAssigned = gig.status === "assigned";
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

              {/* ✅ FIX: status badge visible to ALL visitors */}
              <span className={`gig-status-badge ${isAssigned ? "assigned" : "open"}`}>
                {isAssigned ? "🔒 Hired" : "● Open"}
              </span>

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

              {/* ✅ FIX: assigned status shown to ALL visitors */}
              {isAssigned && (
                <div className="taken-badge">
                  🔒 A freelancer has already been hired for this gig
                </div>
              )}

              {isAssigned && isOwner && (
  <button
    className="btn-bid"
    onClick={() =>
      navigate("/checkout", {
        state: {
          gig,
          bid: {
            price: bidStatus?.acceptedPrice ?? gig.price
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

              {user && !isOwner && !alreadyBid && !isAssigned && (
                <button className="btn-bid" onClick={() => navigate(`/gigs/${id}/bid`)}>
                  Place a Bid →
                </button>
              )}

  {user && !isOwner && !isAssigned && (
  <button
    className="btn-message"
    onClick={() =>
      navigate("/chat", {
        state: {
          gigId: gig._id,
          receiverId: gig.ownerId?._id,
          gigTitle: gig.title,
          gigPrice: gig.price,
        }
      })
    }
  >
    💬 Message Seller
  </button>
)}

              {user && !isOwner && alreadyBid && !isAssigned && (
                <div className="btn-bid-submitted">
                  <span>✓</span> Bid Submitted
                </div>
              )}

              {user && !isOwner && alreadyBid && bidStatus?.bidStatus === "hired" && (
                <div className="btn-bid-submitted" style={{ background: "#dcfce7", color: "#166534" }}>
                  🎉 You were hired for this gig!
                </div>
              )}

              { user && isOwner && (
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <button className="btn-bid" style={{ flex: 1 }} onClick={() => navigate(`/edit-gig/${id}`)}>
                    ✏️ Edit Gig
                  </button>
                  <button className="btn-delete" onClick={handleDelete}>
                    🗑 Delete
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
    </div>
  );
}