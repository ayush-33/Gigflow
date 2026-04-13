import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/GigForm.css";

const CATEGORIES = [
  { value: "logo-design",          label: "🎨 Logo Design"             },
  { value: "web-development",      label: "💻 Web Development"          },
  { value: "video-editing",        label: "🎬 Video Editing"            },
  { value: "content-writing",      label: "✍️  Content Writing"          },
  { value: "seo",                  label: "🔍 SEO"                      },
  { value: "graphic-design",       label: "🖌 Graphic Design"           },
  { value: "music-production",     label: "🎵 Music Production"         },
  { value: "social-media",         label: "📱 Social Media Marketing"   },
  { value: "mobile-development",   label: "📲 Mobile App Development"   },
  { value: "data-analysis",        label: "📊 Data Analysis"            },
  { value: "ai-ml",                label: "🤖 AI & Machine Learning"    },
];

/* step definitions */
const STEPS = ["Basics", "Details", "Media"];

function Toast({ message, type, onClose }) {
  useState(() => {
    const t = setTimeout(onClose, 3200);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className={`form-toast ${type}`}>
      <span className="toast-emoji">{type === "success" ? "✅" : "❌"}</span>
      {message}
    </div>
  );
}

export default function BecomeSeller() {
  const navigate = useNavigate();

  const [step, setStep]     = useState(0);   // 0 · 1 · 2
  const [loading, setLoading] = useState(false);
  const [toast, setToast]   = useState(null);

  const [form, setForm] = useState({
    gigTitle:     "",
    category:     "",
    description:  "",
    price:        "",
    deliveryTime: "",
    image:        null,
  });

  const showToast = (message, type = "success") => setToast({ message, type });

  const handleChange = (e) => {
    const { name, value, type, files } = e.target;
    setForm((p) => ({ ...p, [name]: type === "file" ? files[0] : value }));
  };

  /* basic per-step validation */
  const canAdvance = () => {
    if (step === 0) return form.gigTitle.trim() && form.category;
    if (step === 1) return form.description.trim() && form.price && form.deliveryTime;
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.image) { showToast("Please upload a gig image.", "error"); return; }

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const fd = new FormData();
      fd.append("title",        form.gigTitle);
      fd.append("category",     form.category);
      fd.append("description",  form.description);
      fd.append("price",        form.price);
      fd.append("deliveryTime", form.deliveryTime);
      fd.append("image",        form.image);

      const res  = await fetch("http://localhost:5000/api/gigs", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();

      if (res.ok) {
        showToast("Gig published successfully! 🎉");
        setTimeout(() => navigate("/"), 1500);
      } else {
        showToast(data.message || "Failed to publish gig.", "error");
      }
    } catch {
      showToast("Server error. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  const stepState = (i) =>
    i < step ? "done" : i === step ? "active" : "";

  return (
    <div className="gig-page">
      <div className="gig-card">

        {/* ── Header ── */}
        <div className="gig-card-header">
          <div className="gig-card-icon">🚀</div>
          <h1 className="gig-card-title">Create Your Gig</h1>
          <p className="gig-card-sub">
            Share your skills and start earning on GigFlow
          </p>
        </div>

        {/* ── Body ── */}
        <div className="gig-card-body">

          {/* Progress steps */}
          <div className="form-steps">
            {STEPS.map((label, i) => (
              <>
                <div className={`form-step ${stepState(i)}`} key={label}>
                  <div className={`step-dot ${stepState(i)}`}>
                    {i < step ? "✓" : i + 1}
                  </div>
                  <span className="step-label">{label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`step-line ${i < step ? "done" : ""}`} key={`line-${i}`} />
                )}
              </>
            ))}
          </div>

          <form className="gig-form" onSubmit={handleSubmit}>

            {/* ─── STEP 0: Basics ─── */}
            {step === 0 && (
              <>
                <div className="form-section-label">Gig Identity</div>

                <div className="form-group">
                  <label className="form-label">
                    Gig Title <span className="required">*</span>
                  </label>
                  <input
                    className="form-input"
                    name="gigTitle"
                    value={form.gigTitle}
                    onChange={handleChange}
                    placeholder="e.g., I will design a professional logo"
                    maxLength={80}
                    required
                  />
                  <span className="form-hint">
                    {form.gigTitle.length}/80 characters — be specific and clear
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Category <span className="required">*</span>
                  </label>
                  <select
                    className="form-select"
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select a category</option>
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  className="btn-primary"
                  disabled={!canAdvance()}
                  onClick={() => setStep(1)}
                >
                  Continue →
                </button>
              </>
            )}

            {/* ─── STEP 1: Details ─── */}
            {step === 1 && (
              <>
                <div className="form-section-label">Gig Details</div>

                <div className="form-group">
                  <label className="form-label">
                    Description <span className="required">*</span>
                  </label>
                  <textarea
                    className="form-textarea"
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    placeholder="Describe what you'll deliver, your process, and what makes you stand out…"
                    rows={6}
                    required
                  />
                  <span className="form-hint">
                    Minimum 80 characters recommended for better visibility
                  </span>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">
                      Price (USD) <span className="required">*</span>
                    </label>
                    <div className="input-with-prefix">
                      <span className="input-prefix">$</span>
                      <input
                        className="form-input"
                        type="number"
                        name="price"
                        value={form.price}
                        onChange={handleChange}
                        placeholder="25"
                        min="5"
                        step="1"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Delivery Time <span className="required">*</span>
                    </label>
                    <div className="input-with-prefix">
                      <span className="input-prefix">📅</span>
                      <input
                        className="form-input"
                        type="number"
                        name="deliveryTime"
                        value={form.deliveryTime}
                        onChange={handleChange}
                        placeholder="3"
                        min="1"
                        max="60"
                        required
                        style={{ paddingLeft: "36px" }}
                      />
                    </div>
                    <span className="form-hint">Days</span>
                  </div>
                </div>

                <div className="btn-row">
                  <button type="button" className="btn-secondary"
                    onClick={() => setStep(0)}>
                    ← Back
                  </button>
                  <button type="button" className="btn-primary"
                    disabled={!canAdvance()}
                    onClick={() => setStep(2)}>
                    Continue →
                  </button>
                </div>
              </>
            )}

            {/* ─── STEP 2: Media ─── */}
            {step === 2 && (
              <>
                <div className="form-section-label">Gig Image</div>

                <div className="form-group">
                  <label className="form-label">
                    Cover Image <span className="required">*</span>
                  </label>

                  <div className={`upload-zone ${form.image ? "has-file" : ""}`}>
                    <input
                      type="file"
                      name="image"
                      accept="image/*"
                      onChange={handleChange}
                    />
                    {form.image ? (
                      <>
                        <img
                          className="upload-preview"
                          src={URL.createObjectURL(form.image)}
                          alt="Preview"
                        />
                        <div className="upload-filename">
                          ✅ {form.image.name}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="upload-icon">🖼</div>
                        <div className="upload-title">
                          Drop your image here or{" "}
                          <span className="upload-link">browse</span>
                        </div>
                        <div className="upload-sub">PNG, JPG · max 5 MB</div>
                      </>
                    )}
                  </div>
                  <span className="form-hint">
                    High-quality images improve your gig's visibility
                  </span>
                </div>

                <div className="btn-row">
                  <button type="button" className="btn-secondary"
                    onClick={() => setStep(1)}>
                    ← Back
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={loading}
                  >
                    {loading ? (
                      <><div className="btn-spinner" /> Publishing…</>
                    ) : (
                      "🚀 Publish Gig"
                    )}
                  </button>
                </div>
              </>
            )}

          </form>
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}