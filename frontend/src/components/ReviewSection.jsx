import { useState, useEffect } from "react";
import api from "../api/api";
import "../styles/ReviewSection.css";

function StarPicker({ rating, setRating }) {
  const [hovered, setHovered] = useState(0);
  const labels = ["", "Terrible", "Poor", "Fair", "Good", "Excellent"];

  return (
    <div className="star-picker">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          className={`star-btn ${s <= (hovered || rating) ? "filled" : ""}`}
          onMouseEnter={() => setHovered(s)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => setRating(s)}
          aria-label={`Rate ${s} stars`}
        >
          ★
        </button>
      ))}
      {rating > 0 && (
        <span className="star-label">{labels[rating]}</span>
      )}
    </div>
  );
}

function RatingDistribution({ reviews }) {
  if (!reviews.length) return null;

  return (
    <div className="rating-distribution">
      {[5, 4, 3, 2, 1].map((star) => {
        const count = reviews.filter((r) => r.rating === star).length;
        const pct   = Math.round((count / reviews.length) * 100);
        return (
          <div key={star} className="rating-bar-row">
            <span className="rating-bar-label">{star} ★</span>
            <div className="rating-bar-track">
              <div
                className="rating-bar-fill"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="rating-bar-count">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

function ReviewCard({ review }) {
  const initial = review.reviewerId?.name?.charAt(0)?.toUpperCase() || "?";
  const date    = new Date(review.createdAt).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });

  return (
    <div className="review-card">
      <div className="review-card-header">
        <div className="reviewer-avatar">{initial}</div>
        <div className="reviewer-info">
          <span className="reviewer-name">
            {review.reviewerId?.name || "Anonymous"}
          </span>
          <span className="review-date">{date}</span>
        </div>
        <div className="review-stars">
          {"★".repeat(review.rating)}
          {"☆".repeat(5 - review.rating)}
        </div>
      </div>
      <p className="review-comment">{review.comment}</p>
    </div>
  );
}

function ReviewForm({ gigId, onSuccess }) {
  const [rating,     setRating]     = useState(0);
  const [comment,    setComment]    = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rating) {
      setError("Please select a star rating.");
      return;
    }
    if (comment.trim().length < 10) {
      setError("Review must be at least 10 characters.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await api.post("/reviews", { gigId, rating, comment: comment.trim() });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit review.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="review-form" onSubmit={handleSubmit} noValidate>
      <h3 className="review-form-title">Leave a Review</h3>

      <StarPicker rating={rating} setRating={setRating} />

      <div className="review-textarea-wrap">
        <textarea
          className="review-textarea"
          placeholder="Share your experience working with this freelancer…"
          value={comment}
          onChange={(e) => {
            setComment(e.target.value);
            if (error) setError("");
          }}
          rows={4}
          maxLength={1000}
        />
        <span className="review-char-count">
          {comment.length} / 1000
        </span>
      </div>

      {error && <p className="review-error">⚠ {error}</p>}

      <div className="review-form-footer">
        <button
          type="submit"
          className="btn-review-submit"
          disabled={submitting}
        >
          {submitting ? (
            <><span className="review-spinner" /> Submitting…</>
          ) : (
            "Submit Review"
          )}
        </button>
      </div>
    </form>
  );
}

export default function ReviewSection({ gigId, isOwner, gigStatus, user }) {
  const [reviews,      setReviews]      = useState([]);
  const [canReview,    setCanReview]    = useState(false);
  const [alreadyDone,  setAlreadyDone]  = useState(false);
  const [submitted,    setSubmitted]    = useState(false);
  const [loadingReviews, setLoadingReviews] = useState(true);

  // Fetch reviews & check eligibility
  const loadData = async () => {
    setLoadingReviews(true);
    try {
      const { data } = await api.get(`/reviews/gig/${gigId}`);
      setReviews(Array.isArray(data) ? data : []);
    } catch {
      setReviews([]);
    } finally {
      setLoadingReviews(false);
    }

    if (user) {
      try {
        const { data } = await api.get(`/reviews/can-review/${gigId}`);
        setCanReview(data.canReview);
        setAlreadyDone(data.alreadyReviewed);
      } catch {
        setCanReview(false);
      }
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gigId, user, submitted]);

  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  const handleSuccess = () => {
    setSubmitted((prev) => !prev); // triggers useEffect re-fetch
    setCanReview(false);
    setAlreadyDone(true);
  };

  return (
    <section className="review-section">

      {/* Header */}
      <div className="review-section-header">
        <h2 className="review-section-title">
          Reviews
          {avgRating && (
            <span className="review-avg-badge">
              ★ {avgRating}
              <span className="review-total-count">
                ({reviews.length} review{reviews.length !== 1 ? "s" : ""})
              </span>
            </span>
          )}
        </h2>
      </div>

      {/* Rating distribution */}
      {reviews.length > 0 && (
        <RatingDistribution reviews={reviews} />
      )}

      {/* Review form — only for gig owner after a bid is hired */}
      {canReview && !alreadyDone && (
        <ReviewForm gigId={gigId} onSuccess={handleSuccess} />
      )}

      {/* Feedback banners */}
      {submitted && (
        <div className="review-banner success">
          ✓ Your review has been submitted. Thank you!
        </div>
      )}
      {alreadyDone && !submitted && (
        <div className="review-banner info">
          You have already reviewed this gig.
        </div>
      )}
      {!user && gigStatus === "assigned" && (
        <div className="review-banner info">
          Log in to leave a review.
        </div>
      )}

      {/* Reviews list */}
      {loadingReviews ? (
        <div className="review-loading">
          <div className="review-skeleton" />
          <div className="review-skeleton" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="review-empty">
          <span className="review-empty-icon">💬</span>
          <p>No reviews yet.</p>
          <span>Be the first to review this gig after hiring.</span>
        </div>
      ) : (
        <div className="review-list">
          {reviews.map((r) => (
            <ReviewCard key={r._id} review={r} />
          ))}
        </div>
      )}

    </section>
  );
}