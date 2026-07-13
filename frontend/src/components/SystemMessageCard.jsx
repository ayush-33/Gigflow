import React from "react";
import "../styles/SystemMessageCard.css";

const EVENT_MAP = {
  bid_submitted: { icon: "📨", title: "Bid Submitted", color: "neutral" },
  bid_resubmitted: { icon: "🔄", title: "Bid Resubmitted", color: "neutral" },
  counter_offer_received: { icon: "💼", title: "Counter Offer Received", color: "neutral" },
  counter_offer_accepted: { icon: "✅", title: "Counter Offer Accepted", color: "green" },
  counter_offer_declined: { icon: "❌", title: "Counter Offer Declined", color: "red" },
  bid_accepted: { icon: "✅", title: "Bid Accepted", color: "green" },
  bid_rejected: { icon: "❌", title: "Bid Rejected", color: "red" },
  payment_completed: { icon: "💳", title: "Payment Completed", color: "success" },
  hired: { icon: "🎉", title: "You Have Been Hired", color: "hired" },
  project_started: { icon: "📦", title: "Project Started", color: "hired" },
  project_completed: { icon: "🏁", title: "Project Completed", color: "success" },
  order_cancelled: { icon: "🚫", title: "Order Cancelled", color: "red" },
  review_received: { icon: "🌟", title: "Review Received", color: "success" }
};

const REGEX_RULES = [
  { pattern: /Freelancer hired\. Project started!/i, type: "project_started" },
  { pattern: /You have been hired for this project!/i, type: "hired" },
  { pattern: /Counter offer accepted/i, type: "counter_offer_accepted" },
  { pattern: /Bid accepted/i, type: "bid_accepted" },
  { pattern: /Counter offer declined/i, type: "counter_offer_declined" },
  { pattern: /Bid declined/i, type: "bid_rejected" },
  { pattern: /Bid rejected/i, type: "bid_rejected" },
  { pattern: /sent a counter offer/i, type: "counter_offer_received" },
  { pattern: /Order has been completed/i, type: "project_completed" },
  { pattern: /Order has been cancelled/i, type: "order_cancelled" },
  { pattern: /resubmitted a bid/i, type: "bid_resubmitted" },
  { pattern: /bid submitted/i, type: "bid_submitted" },
  { pattern: /payment completed/i, type: "payment_completed" },
  { pattern: /payment received/i, type: "payment_completed" },
  { pattern: /review received/i, type: "review_received" }
];

const extractPrice = (text) => {
  if (!text) return null;
  const match = text.match(/\$(\d+(?:\.\d+)?)/);
  return match ? `$${match[1]}` : null;
};

const formatTime = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
};

export default function SystemMessageCard({ msg }) {
  if (!msg) return null;

  // 1. Check if structured event/workflow type is already present in message object
  const structuredType = msg.eventType || msg.workflowType;
  let config = EVENT_MAP[structuredType];

  // 2. Regex fallback matching on the message string
  if (!config && msg.message) {
    const matchedRule = REGEX_RULES.find(rule => rule.pattern.test(msg.message));
    if (matchedRule) {
      config = EVENT_MAP[matchedRule.type];
    }
  }

  // 3. Fallback for generic system messages
  if (!config) {
    config = {
      icon: "⚙️",
      title: "System Notification",
      color: "neutral"
    };
  }

  // 4. Extract price metadata if present
  const extractedPrice = extractPrice(msg.message);

  return (
    <div className="smc-container">
      <div className={`smc-card ${config.color}`} role="status">
        <div className="smc-header">
          <span className="smc-icon" aria-hidden="true">{config.icon}</span>
          <h4 className="smc-title">{config.title}</h4>
        </div>
        
        <p className="smc-desc">{msg.message}</p>
        
        {extractedPrice && (
          <div className="smc-meta">
            <div className="smc-meta-item">
              <span className="smc-meta-label">Offer Amount</span>
              <span className="smc-meta-value">{extractedPrice}</span>
            </div>
          </div>
        )}
        
        <span className="smc-time">
          {formatTime(msg.createdAt)}
        </span>
      </div>
    </div>
  );
}
