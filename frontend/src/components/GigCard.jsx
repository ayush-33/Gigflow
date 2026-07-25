import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import StarRating from "./StarRating";
import api from "../api/api";
import "../styles/GigCard.css";

// Helper to resolve backend image paths
function buildImageUrl(image) {
  if (!image) return null;

  if (image.startsWith('http://') || image.startsWith('https://')) {
    return image;
  }

  const backendUrl = api.defaults.baseURL
    ? api.defaults.baseURL.replace("/api", "")
    : "http://localhost:5001";

  if (image.includes('\\')) {
    const filename = image.split('\\').pop();
    return `${backendUrl}/uploads/${filename}`;
  }

  if (image.includes('/uploads/')) {
    const filename = image.split('/uploads/').pop();
    return `${backendUrl}/uploads/${filename}`;
  }

  if (image.startsWith('uploads/')) {
    return `${backendUrl}/${image}`;
  }

  return `${backendUrl}/uploads/${image}`;
}

export default function GigCard({ gig, saved, onToggleSave, showDelivery = false }) {
  const navigate = useNavigate();
  const [imgError, setImgError] = useState(false);

  const guessIcon = () => {
    const t = (gig.title || "").toLowerCase();
    if (t.includes("logo") || t.includes("design")) return "🎨";
    if (t.includes("web") || t.includes("website")) return "💻";
    if (t.includes("video")) return "🎬";
    if (t.includes("seo")) return "🔍";
    if (t.includes("write") || t.includes("content")) return "✍️";
    if (t.includes("music") || t.includes("audio")) return "🎵";
    return "💼";
  };

  const rating = gig.rating ?? 0;
  const reviewCount = gig.reviewCount ?? 0;
  const delivery = gig.deliveryTime ?? 1;

  const imageUrl = buildImageUrl(gig.image);
  const isAssigned = ["assigned", "hired", "in_progress", "submitted", "completed"].includes(gig.status);

  const initials = useMemo(() => {
    const name = gig.ownerId?.name || gig.ownerId?.username || "Unknown";
    return name.charAt(0).toUpperCase();
  }, [gig.ownerId]);

  const handleCardClick = () => {
    navigate(`/gig/${gig._id}`);
  };

  const handleWishlistClick = (e) => {
    e.stopPropagation();
    onToggleSave(gig._id);
  };

  return (
    <div className="gig-card" onClick={handleCardClick}>
      <div className="gig-image-wrapper">
        {!imgError && imageUrl ? (
          <img
            src={imageUrl}
            alt={gig.title}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="gig-image-fallback">
            <span className="fallback-icon">{guessIcon()}</span>
            <span className="fallback-label">No Preview</span>
          </div>
        )}

        {gig.category && (
          <span className="gig-category-tag">
            {gig.category.replace(/-/g, " ")}
          </span>
        )}

        <button
          type="button"
          className={`gig-wishlist-btn${saved ? " saved" : ""}`}
          onClick={handleWishlistClick}
          title={saved ? "Remove from saved" : "Save gig"}
          aria-label={saved ? "Remove from saved" : "Save gig"}
        >
          {saved ? "❤️" : "🤍"}
        </button>

        {gig.status === "open" ? (
          <span className="gig-status-badge open">✓ Open</span>
        ) : gig.status === "submitted" ? (
          <span className="gig-status-badge submitted">📤 Under Review</span>
        ) : gig.status === "completed" ? (
          <span className="gig-status-badge completed">✅ Completed</span>
        ) : ["in_progress", "hired"].includes(gig.status) ? (
          <span className="gig-status-badge in-progress">🔨 In Progress</span>
        ) : isAssigned ? (
          <span className="gig-status-badge assigned">🔒 Hired</span>
        ) : (
          <span className="gig-status-badge open">✓ Open</span>
        )}
      </div>

      <div className="gig-content">
        <div className="gig-seller">
          <div className="seller-avatar">{initials}</div>
          <span className="seller-name">
            {gig.ownerId?.name || gig.ownerId?.username || "Unknown"}
          </span>
        </div>

        <h3 className="gig-title">{gig.title}</h3>

        <div className="gig-rating-row">
          <StarRating score={rating} />
          <span className="rating-score">{Number(rating).toFixed(1)}</span>
          <span className="reviews">({reviewCount})</span>
        </div>

        <div className="gig-footer">
          <div className="gig-price-block">
            <span className="gig-price-label">Starting at</span>
            <span className="gig-price">${gig.price}</span>
          </div>
          <div className="gig-footer-right">
            {showDelivery && (
              <span className="gig-delivery">⏱ {delivery}d delivery</span>
            )}
            <button
              type="button"
              className="gig-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleCardClick();
              }}
            >
              View Gig
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
