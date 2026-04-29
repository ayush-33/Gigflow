import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import api from "../api/api";
import "../styles/PlaceBid.css";

export default function PlaceBid() {
  const { id }   = useParams();
  const navigate = useNavigate();

  const [gig,     setGig]     = useState(null);
  const [price,   setPrice]   = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors,  setErrors]  = useState({});
  const [toast,   setToast]   = useState(null);
  const [focused, setFocused] = useState(null);

  

  /* Fetch gig info for context */
  useEffect(() => {
    (async () => {
      try {
const { data } = await api.get(`/gigs/${id}`);
setGig(data);
        
      } catch (err) {
        console.error(err);
      }
    })();
  }, [id]);

  /* Auto-dismiss toast */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  /* Client-side validation */
  const validate = () => {
    const errs = {};
    if (!price || isNaN(price) || Number(price) < 1)
      errs.price = "Please enter a valid bid amount (minimum $1).";
    if (!message.trim() || message.trim().length < 10)
      errs.message = "Your proposal must be at least 10 characters.";
    if (message.trim().length > 1000)
      errs.message = "Proposal must be under 1000 characters.";
    return errs;
  };

  const handleSubmit = async (e) => {
  e.preventDefault();
  const errs = validate();
  if (Object.keys(errs).length) { setErrors(errs); return; }

  setLoading(true);
  try {
    await api.post("/bids", {
      gigId: id,
      price: Number(price),
      message: message.trim(),
    });

    setToast({ type: "success", message: "Bid submitted successfully! Redirecting…" });
    setTimeout(() => navigate("/profile", { state: { refresh: Date.now() } }), 1600);

  } catch (err) {
    setToast({
      type: "error",
      message: err.response?.data?.message || "Failed to submit bid."
    });
  } finally {
    setLoading(false);
  }
};

  /* Budget hint logic */
  const getBudgetHint = () => {
    if (!gig || !price || isNaN(price)) return null;
    const n = Number(price);
    if (n < gig.price) {
      const pct = Math.round(((gig.price - n) / gig.price) * 100);
      return { type: "ok", text: `✓ ${pct}% below client's budget — competitive!` };
    }
    if (n === gig.price) return { type: "exact", text: "Matches client's budget exactly" };
    return { type: "warn", text: `$${n - gig.price} above client's budget` };
  };

  const budgetHint   = getBudgetHint();
  const charPct      = Math.min((message.length / 1000) * 100, 100);
  const charOverflow = message.length > 900;

  return (
    <div className="place-bid-page">
      <div className="bid-card">

        {/* Top accent bar */}
        <div className="bid-accent-bar" />

        <div className="bid-card-inner">

          {/* Gig context strip */}
          {gig && (
            <div className="bid-gig-context">
              <span className="bgc-label">Bidding on</span>
              <span className="bgc-title">{gig.title}</span>
              <span className="bgc-price">Budget: ${gig.price}</span>
            </div>
          )}

          {/* Header */}
          <div className="bid-header">
            <div className="bid-header-icon">💼</div>
            <div>
              <h1 className="bid-title">Submit your bid</h1>
              <p className="bid-subtitle">
                Specific, tailored proposals win significantly more often than generic ones.
              </p>
            </div>
          </div>

          {/* Toast */}
          {toast && (
            <div className={`bid-toast bid-toast--${toast.type}`}>
              <span className="bid-toast-icon">{toast.type === "success" ? "✓" : "✕"}</span>
              {toast.message}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>

            {/* Price field */}
            <div className={`bid-field${focused === "price" ? " bid-field--focused" : ""}`}>
              <label className="bid-label">
                Your bid price <span className="bid-required">*</span>
              </label>
              <div className="bid-price-wrap">
                <span className="bid-price-symbol">$</span>
                <input
                  className={`bid-input bid-input--price${errors.price ? " bid-input--error" : ""}`}
                  type="number"
                  placeholder="Enter your offer"
                  value={price}
                  min="1"
                  step="1"
                  onFocus={() => setFocused("price")}
                  onBlur={() => setFocused(null)}
                  onChange={(e) => {
                    setPrice(e.target.value);
                    setErrors((p) => ({ ...p, price: undefined }));
                  }}
                />
              </div>
              {errors.price ? (
                <span className="bid-error-msg">{errors.price}</span>
              ) : budgetHint ? (
                <span className={`bid-budget-hint bid-budget-hint--${budgetHint.type}`}>
                  {budgetHint.text}
                </span>
              ) : (
                <span className="bid-hint-text">Enter the amount you'd charge for this gig</span>
              )}
            </div>

            {/* Message field */}
            <div className={`bid-field${focused === "message" ? " bid-field--focused" : ""}`}>
              <label className="bid-label">
                Proposal message <span className="bid-required">*</span>
              </label>
              <textarea
                className={`bid-textarea${errors.message ? " bid-input--error" : ""}`}
                placeholder="Explain your approach, timeline, relevant experience, and why you're the right fit…"
                value={message}
                rows={7}
                maxLength={1000}
                onFocus={() => setFocused("message")}
                onBlur={() => setFocused(null)}
                onChange={(e) => {
                  setMessage(e.target.value);
                  setErrors((p) => ({ ...p, message: undefined }));
                }}
              />
              <div className="bid-char-row">
                {errors.message ? (
                  <span className="bid-error-msg">{errors.message}</span>
                ) : (
                  <span className="bid-hint-text">Min 10 characters. Be specific — it wins bids.</span>
                )}
                <span className={`bid-char-count${charOverflow ? " bid-char-count--warn" : ""}`}>
                  {message.length} / 1000
                </span>
              </div>
              {/* Progress bar */}
              <div className="bid-char-bar">
                <div
                  className={`bid-char-fill${charOverflow ? " bid-char-fill--warn" : ""}`}
                  style={{ width: `${charPct}%` }}
                />
              </div>
            </div>

            {/* Tips */}
            <div className="bid-tips">
              <div className="bid-tips-title">Tips for winning bids</div>
              <ul className="bid-tips-list">
                <li>Reference your portfolio or a relevant past project</li>
                <li>Provide a realistic breakdown of your timeline</li>
                <li>Ask one smart clarifying question to show genuine interest</li>
              </ul>
            </div>

            {/* Actions */}
            <div className="bid-actions">
              <button type="button" className="bid-btn-cancel" onClick={() => navigate(-1)}>
                Cancel
              </button>
              <button type="submit" className="bid-btn-submit" disabled={loading}>
                {loading ? (
                  <>
                    <span className="bid-spinner" />
                    Submitting…
                  </>
                ) : (
                  "Submit bid →"
                )}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}