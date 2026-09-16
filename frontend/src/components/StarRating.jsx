import React from "react";
import "../styles/StarRating.css";

export default function StarRating({ score = 0, count, maxStars = 5 }) {
  // Enforce score bounds
  const clampedScore = Math.max(0, Math.min(maxStars, score));
  const fullStars = Math.floor(clampedScore);
  const halfStar = clampedScore % 1 >= 0.5 ? 1 : 0;
  const emptyStars = Math.max(0, maxStars - fullStars - halfStar);

  return (
    <div className="star-rating-container" aria-label={`Rated ${clampedScore} out of ${maxStars} stars`}>
      <span className="star-rating-stars">
        {"★".repeat(fullStars)}
        {halfStar ? "½" : ""}
        {"☆".repeat(emptyStars)}
      </span>
      {count !== undefined && (
        <span className="star-rating-count">({count})</span>
      )}
    </div>
  );
}
