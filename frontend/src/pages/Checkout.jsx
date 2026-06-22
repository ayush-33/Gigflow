import { useState, useEffect } from "react";
import api from "../api/api";
import { useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import "../styles/Checkout.css";

const PAYMENT_METHODS = [
  { id: "card",   label: "Credit / Debit Card", icon: "💳" },
  { id: "upi",    label: "UPI",                  icon: "📱" },
  { id: "wallet", label: "Wallet",               icon: "👛" },
];

export default function Checkout() {
  const navigate  = useNavigate();
  const { state } = useLocation();
  
  const [gig, setGig] = useState(() => state?.gig || JSON.parse(sessionStorage.getItem("checkout_gig")));
  const [bid, setBid] = useState(() => state?.bid || JSON.parse(sessionStorage.getItem("checkout_bid")));

  useEffect(() => {
    if (state?.gig) sessionStorage.setItem("checkout_gig", JSON.stringify(state.gig));
    if (state?.bid) sessionStorage.setItem("checkout_bid", JSON.stringify(state.bid));
  }, [state]);

  const [method,    setMethod]    = useState("card");
  const [step,      setStep]      = useState(1); // 1 = details, 2 = confirmation
  const [loading,   setLoading]   = useState(false);
  const [orderRef,  setOrderRef]  = useState("");
  const [payError,  setPayError]  = useState("");
  const [card, setCard] = useState({
    number: "", name: "", expiry: "", cvv: ""
  });

  useEffect(() => {
    if (!gig || !bid) {
      toast.error("Invalid checkout session. Redirecting to explore...");
      navigate("/explore");
    }
  }, [gig, bid, navigate]);

  if (!gig || !bid) {
    return null;
  }

  const total    = bid?.price ?? gig.price;
  const platform = Math.round(total * 0.1);
  const subtotal = total - platform;

  const handlePayment = async (e) => {
    e.preventDefault();
    setLoading(true);
    setPayError("");
    try {
      const { data } = await api.post('/orders/complete', {
        bidId:         bid._id,
        gigId:         gig._id,
        paymentMethod: method,
        amount:        total,
      });
      setOrderRef(data.order.orderRef);
      sessionStorage.removeItem("checkout_gig");
      sessionStorage.removeItem("checkout_bid");
      toast.success("✅ Payment Successful");
      setStep(2);
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Payment failed. Please try again.';
      setPayError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const formatCard = (val) => {
    return val.replace(/\D/g, "").slice(0,16).replace(/(.{4})/g, "$1 ").trim();
  };
  const formatExpiry = (val) => {
    return val.replace(/\D/g, "").slice(0,4).replace(/(.{2})/, "$1/");
  };

  if (step === 2) {
    return (
      <div className="checkout-page">
        <div className="checkout-success-card">
          <div className="success-icon">✅</div>
          <h1>Order Placed!</h1>
          <p>Your payment of <strong>${total}</strong> has been processed.</p>
          <p className="success-sub">
            The freelancer has been notified and will begin work shortly.
          </p>
          <div className="success-order-ref">
            Order ref: <strong>{orderRef}</strong>
          </div>
          <div className="success-actions">
            <button className="btn-success-primary" onClick={() => navigate("/profile")}>
              Go to Dashboard →
            </button>
            <button className="btn-success-ghost" onClick={() => navigate("/explore")}>
              Explore More Gigs
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="checkout-page">
      <div className="checkout-container">

        {/* Left — Payment form */}
        <div className="checkout-left">
          <div className="checkout-header">
            <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
            <h1 className="checkout-title">Secure Checkout</h1>
            <div className="secure-badge">🔒 SSL Protected</div>
          </div>

          {/* Payment method tabs */}
          <div className="payment-methods">
            {PAYMENT_METHODS.map(m => (
              <button
                key={m.id}
                className={`method-btn${method === m.id ? " active" : ""}`}
                onClick={() => setMethod(m.id)}
              >
                <span className="method-icon">{m.icon}</span>
                {m.label}
              </button>
            ))}
          </div>

          <form className="payment-form" onSubmit={handlePayment}>
            {method === "card" && (
              <>
                <div className="form-group">
                  <label>Card Number</label>
                  <input
                    placeholder="1234 5678 9012 3456"
                    value={card.number}
                    onChange={e => setCard(p => ({...p, number: formatCard(e.target.value)}))}
                    maxLength={19}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Cardholder Name</label>
                  <input
                    placeholder="John Doe"
                    value={card.name}
                    onChange={e => setCard(p => ({...p, name: e.target.value}))}
                    required
                  />
                </div>
                <div className="form-row-2">
                  <div className="form-group">
                    <label>Expiry Date</label>
                    <input
                      placeholder="MM/YY"
                      value={card.expiry}
                      onChange={e => setCard(p => ({...p, expiry: formatExpiry(e.target.value)}))}
                      maxLength={5}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>CVV</label>
                    <input
                      type="password"
                      placeholder="•••"
                      value={card.cvv}
                      onChange={e => setCard(p => ({...p, cvv: e.target.value.slice(0,4)}))}
                      maxLength={4}
                      required
                    />
                  </div>
                </div>
              </>
            )}

            {method === "upi" && (
              <div className="form-group">
                <label>UPI ID</label>
                <input placeholder="yourname@upi" required />
                <span className="form-hint">e.g. mobile@paytm, user@gpay</span>
              </div>
            )}

            {method === "wallet" && (
              <div className="wallet-options">
                {["Paytm","PhonePe","Amazon Pay","Mobikwik"].map(w => (
                  <div key={w} className="wallet-option">
                    <input type="radio" name="wallet" id={w} />
                    <label htmlFor={w}>{w}</label>
                  </div>
                ))}
              </div>
            )}

            <button type="submit" className="btn-pay" disabled={loading}>
              {loading ? (
                <><span className="pay-spinner" /> Processing…</>
              ) : (
                `Pay $${total} →`
              )}
            </button>
            {payError && <div className="pay-error" style={{color: 'red', marginTop: '10px'}}>{payError}</div>}

            <p className="pay-disclaimer">
              By completing this purchase you agree to our Terms of Service.
              Your payment is encrypted and secure.
            </p>
          </form>
        </div>

        {/* Right — Order summary */}
        <div className="checkout-right">
          <div className="order-summary-card">
            <h2 className="summary-title">Order Summary</h2>

            <div className="summary-gig">
              <div className="summary-gig-icon">💼</div>
              <div>
                <div className="summary-gig-title">{gig.title}</div>
                <div className="summary-gig-seller">
                  by {gig.ownerId?.name || "Seller"}
                </div>
              </div>
            </div>

            <div className="summary-lines">
              <div className="summary-line">
                <span>Service fee</span>
                <span>${subtotal}</span>
              </div>
              <div className="summary-line">
                <span>Platform fee (10%)</span>
                <span>${platform}</span>
              </div>
              <div className="summary-line total">
                <span>Total</span>
                <span>${total}</span>
              </div>
            </div>

            <div className="summary-delivery">
              <span className="delivery-icon">⏱</span>
              Delivery in {gig.deliveryTime} day{gig.deliveryTime !== 1 ? "s" : ""}
            </div>

            <div className="summary-guarantee">
              <div className="guarantee-item">✅ Money-back guarantee</div>
              <div className="guarantee-item">🔒 Secure payment</div>
              <div className="guarantee-item">🛡 Buyer protection</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}