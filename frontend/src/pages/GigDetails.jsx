import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import "../styles/GigDetails.css";

function StarRating({ score = 4.5 }) {
  const full  = Math.floor(score);
  const half  = score % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return (
    <span className="stars">
      {"★".repeat(full)}
      {half ? "½" : ""}
      {"☆".repeat(empty)}
    </span>
  );
}

export default function GigDetails() {
  const { id }     = useParams();
  const navigate   = useNavigate();

  const [gig,        setGig]        = useState(null);
  const [alreadyBid, setAlreadyBid] = useState(false);
  const [imgError,   setImgError]   = useState(false);

  const token  = localStorage.getItem("token");
  const userId = localStorage.getItem("userId");

  useEffect(() => {
    const fetchGig = async () => {
      try {
        const res  = await fetch(`http://localhost:5000/api/gigs/${id}`);
        const data = await res.json();
        setGig(data);
      } catch (err) {
        console.error(err);
      }
    };

    const checkUserBid = async () => {
      if (!token) return;
      try {
        const res  = await fetch(`http://localhost:5000/api/bids/check/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setAlreadyBid(data.alreadyBid);
      } catch (err) {
        console.error(err);
      }
    };

    fetchGig();
    checkUserBid();
  }, [id, token]);

  const handleDelete = async () => {
    if (!window.confirm("Delete this gig?")) return;
    try {
      await fetch(`http://localhost:5000/api/gigs/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      alert("Gig deleted");
      navigate("/");
    } catch (err) {
      console.error(err);
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

  const ownerId = typeof gig.ownerId === "object" ? gig.ownerId._id : gig.ownerId;
  const isOwner = userId === ownerId;
  const sellerName = gig.ownerId?.username || "Unknown Seller";

  /* stable-ish mock rating */
  const rating      = gig.rating      ?? 4.8;
  const reviewCount = gig.reviewCount ?? 47;

  return (
    <div className="gig-details-page">

      {/* ── Breadcrumb ── */}
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

          {/* ── LEFT — Image + Seller ── */}
          <div className="gig-image-panel">

            {/* Image */}
            <div className="gig-image-wrapper">
              {!imgError ? (
                <>
                  <img
                    src={`http://localhost:5000/uploads/${gig.image}`}
                    alt={gig.title}
                    onError={() => setImgError(true)}
                  />
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

              <span className={`gig-status-badge ${gig.status}`}>
                {gig.status === "open" ? "● Open" : "🔒 Hired"}
              </span>
            </div>

            {/* Seller card */}
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

          {/* ── RIGHT — Info + CTA ── */}
          <div className="gig-info-panel">

            {/* Header */}
            <div className="gig-header">
              {gig.category && (
                <p className="gig-category-line">{gig.category}</p>
              )}
              <h1 className="gig-title-main">{gig.title}</h1>
              <div className="gig-rating-row">
                <StarRating score={rating} />
                <span className="rating-val">{Number(rating).toFixed(1)}</span>
                <span className="review-count">({reviewCount} reviews)</span>
              </div>
            </div>

            <div className="gig-divider" />

            {/* Description */}
            <div className="gig-description-block">
              <p className="block-label">About this gig</p>
              <p className="gig-description-text">{gig.description}</p>
            </div>

            <div className="gig-divider" />

            {/* Meta stats */}
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
            </div>

            {/* CTA card */}
            <div className="gig-cta-card">

              {gig.status === "active" && (
                <div className="taken-badge">🔒 Freelancer Already Hired</div>
              )}

              {token && !isOwner && !alreadyBid && gig.status === "open" && (
                <button className="btn-bid" onClick={() => navigate(`/gigs/${id}/bid`)}>
                  Place a Bid →
                </button>
              )}

              {token && !isOwner && alreadyBid && gig.status === "open" && (
                <div className="btn-bid-submitted">
                  <span>✓</span> Bid Submitted
                </div>
              )}

              {token && isOwner && (
                <button className="btn-delete" onClick={handleDelete}>
                  Delete Gig
                </button>
              )}

              <p className="cta-note">
                {gig.status === "open"
                  ? "💡 Submit your best offer to get hired on this project."
                  : "This gig is no longer accepting bids."}
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}