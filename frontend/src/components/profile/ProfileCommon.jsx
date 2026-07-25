import React from "react";

/* ── Status badge ── */
export function Badge({ status }) {
  const map = {
    open: "badge-open",
    active: "badge-active",
    hired: "badge-hired",
    in_progress: "badge-hired",
    submitted: "badge-submitted",
    completed: "badge-completed",
    pending: "badge-pending",
    countered: "badge-countered",
    payment_pending: "badge-pending",
    closed: "badge-closed",
    rejected: "badge-rejected",
    withdrawn: "badge-withdrawn",
  };
  const label = {
    open: "Open",
    active: "Active",
    hired: "Hired · In Progress",
    in_progress: "In Progress",
    submitted: "Work Submitted",
    completed: "Completed",
    pending: "Pending",
    countered: "Counter Offer",
    payment_pending: "Awaiting Payment",
    closed: "Closed",
    rejected: "Rejected",
    withdrawn: "Withdrawn",
  };
  return (
    <span className={`badge ${map[status] || "badge-pending"}`}>
      {label[status] || status}
    </span>
  );
}

/* ── Empty state ── */
export function EmptyState({ icon, title, sub, actionText, onActionClick, compact }) {
  return (
    <div className={`premium-empty-state${compact ? " compact" : ""}`}>
      <div className="empty-state-icon-wrapper">
        <span className="empty-state-icon">{icon}</span>
      </div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-description">{sub}</p>
      {actionText && (
        <button className="empty-state-btn" onClick={onActionClick}>
          {actionText}
        </button>
      )}
    </div>
  );
}

/* ── Bid Comparison Card ── */
export function BidComparisonView({ bids, onAccept, onReject }) {
  const pending = bids.filter((b) => b.status === "pending");
  if (pending.length < 2) return null;

  const avgPrice = Math.round(pending.reduce((s, b) => s + b.price, 0) / pending.length);
  const minPrice = Math.min(...pending.map((b) => b.price));

  return (
    <div className="bid-comparison">
      <div className="bid-comparison-header">
        <span className="bch-title">⚖️ Bid Comparison</span>
        <span className="bch-sub">
          {pending.length} bids · avg ${avgPrice} · lowest ${minPrice}
        </span>
      </div>
      <div className="bid-comparison-grid">
        {pending.map((bid) => (
          <div
            key={bid._id}
            className={`bid-comp-card${bid.price === minPrice ? " best-value" : ""}`}
          >
            {bid.price === minPrice && (
              <div className="best-value-tag">💰 Best Value</div>
            )}
            <div className="bcc-name">{bid.bidderId?.name || "Freelancer"}</div>
            <div className="bcc-price">${bid.price}</div>
            <div className="bcc-diff">
              {bid.price === minPrice
                ? "Lowest bid"
                : `+$${bid.price - minPrice} vs lowest`}
            </div>
            <p className="bcc-message">{bid.message || "—"}</p>
            <div className="bcc-actions">
              <button className="btn-action btn-accept" onClick={() => onAccept(bid._id)}>
                ✓ Accept
              </button>
              <button className="btn-action btn-reject" onClick={() => onReject(bid._id)}>
                ✕ Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
