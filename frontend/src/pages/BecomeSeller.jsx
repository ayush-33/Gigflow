import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import "../styles/GigForm.css";

const CATEGORIES = [
  { value: "logo-design",        label: "🎨 Logo Design"           },
  { value: "web-development",    label: "💻 Web Development"        },
  { value: "video-editing",      label: "🎬 Video Editing"          },
  { value: "content-writing",    label: "✍️  Content Writing"        },
  { value: "seo",                label: "🔍 SEO"                    },
  { value: "graphic-design",     label: "🖌 Graphic Design"         },
  { value: "music-production",   label: "🎵 Music Production"       },
  { value: "social-media",       label: "📱 Social Media Marketing" },
  { value: "mobile-development", label: "📲 Mobile App Development" },
  { value: "data-analysis",      label: "📊 Data Analysis"          },
  { value: "ai-ml",              label: "🤖 AI & Machine Learning"  },
];

const STEPS = ["Basics", "Details", "Media"];

/* Toast with auto-dismiss */
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3200);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`form-toast ${type}`}>
      <span className="toast-emoji">{type === "success" ? "✅" : "❌"}</span>
      {message}
    </div>
  );
}

/* Per-field validation */
const validate = (step, form) => {
  const errors = {};
  if (step === 0) {
    if (!form.gigTitle.trim() || form.gigTitle.trim().length < 5)
      errors.gigTitle = "Title must be at least 5 characters.";
    if (!form.category)
      errors.category = "Please select a category.";
  }
  if (step === 1) {
    if (!form.description.trim() || form.description.trim().length < 20)
      errors.description = "Description must be at least 20 characters.";
    if (!form.price || Number(form.price) < 5)
      errors.price = "Price must be at least $5.";
    if (!form.deliveryTime || Number(form.deliveryTime) < 1 || Number(form.deliveryTime) > 60)
      errors.deliveryTime = "Delivery must be 1–60 days.";
  }
  if (step === 2) {
    if (!form.image)
      errors.image = "Please upload a gig image.";
  }
  return errors;
};

export default function BecomeSeller() {
  const navigate = useNavigate();

  const [step,    setStep]    = useState(0);
  const [loading, setLoading] = useState(false);
  const [toast,   setToast]   = useState(null);
  const [errors,  setErrors]  = useState({});

  const [form, setForm] = useState({
    gigTitle: "", category: "", description: "",
    price: "", deliveryTime: "", image: null,
  });

  const showToast = (message, type = "success") => setToast({ message, type });

  const handleChange = (e) => {
    const { name, value, type: t, files } = e.target;
    setForm((p) => ({ ...p, [name]: t === "file" ? files[0] : value }));
    setErrors((p) => ({ ...p, [name]: undefined }));
  };

  const tryAdvance = (nextStep) => {
    const errs = validate(step, form);
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setStep(nextStep);
  };

  const handleSubmit = async (e) => {
  e.preventDefault();
  const errs = validate(2, form);
  if (Object.keys(errs).length) { setErrors(errs); return; }

  setLoading(true);
  try {
    const fd = new FormData();
    fd.append("title",        form.gigTitle.trim());
    fd.append("category",     form.category);
    fd.append("description",  form.description.trim());
    fd.append("price",        form.price);
    fd.append("deliveryTime", form.deliveryTime);
    fd.append("image",        form.image);

    // ✅ NEW — using api.js
    await api.post("/gigs", fd, {
      headers: { "Content-Type": "multipart/form-data" }
    });

    showToast("Gig published successfully! 🎉");

    setTimeout(
      () => navigate("/profile", { state: { refresh: Date.now() } }),
      1500
    );

  } catch (err) {
    showToast(err.response?.data?.message || "Failed to publish gig.", "error");
  } finally {
    setLoading(false);
  }
};

  const stepState = (i) => (i < step ? "done" : i === step ? "active" : "");

  return (
    <div className="gig-page">
      <div className="gig-card">

        <div className="gig-card-header">
          <div className="gig-card-icon">🚀</div>
          <h1 className="gig-card-title">Create Your Gig</h1>
          <p className="gig-card-sub">Share your skills and start earning on GigFlow</p>
        </div>

        <div className="gig-card-body">

          {/* Progress steps */}
          <div className="form-steps">
            {STEPS.map((label, i) => (
              <div key={label} style={{ display: "contents" }}>
                <div className={`form-step ${stepState(i)}`}>
                  <div className={`step-dot ${stepState(i)}`}>
                    {i < step ? "✓" : i + 1}
                  </div>
                  <span className="step-label">{label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`step-line ${i < step ? "done" : ""}`} />
                )}
              </div>
            ))}
          </div>

          <form className="gig-form" onSubmit={handleSubmit}>

            {/* STEP 0 — Basics */}
            {step === 0 && (
              <>
                <div className="form-section-label">Gig Identity</div>

                <div className="form-group">
                  <label className="form-label">
                    Gig Title <span className="required">*</span>
                  </label>
                  <input
                    className={`form-input${errors.gigTitle ? " input-error" : ""}`}
                    name="gigTitle"
                    value={form.gigTitle}
                    onChange={handleChange}
                    placeholder="e.g., I will design a professional logo"
                    maxLength={80}
                  />
                  {errors.gigTitle ? (
                    <span className="form-error-msg">{errors.gigTitle}</span>
                  ) : (
                    <span className="form-hint">{form.gigTitle.length}/80 — be specific and clear</span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Category <span className="required">*</span>
                  </label>
                  <select
                    className={`form-select${errors.category ? " input-error" : ""}`}
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                  >
                    <option value="">Select a category</option>
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                  {errors.category && (
                    <span className="form-error-msg">{errors.category}</span>
                  )}
                </div>

                <button type="button" className="btn-primary" onClick={() => tryAdvance(1)}>
                  Continue →
                </button>
              </>
            )}

            {/* STEP 1 — Details */}
            {step === 1 && (
              <>
                <div className="form-section-label">Gig Details</div>

                <div className="form-group">
                  <label className="form-label">
                    Description <span className="required">*</span>
                  </label>
                  <textarea
                    className={`form-textarea${errors.description ? " input-error" : ""}`}
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    placeholder="Describe what you'll deliver, your process, and what makes you stand out…"
                    rows={6}
                  />
                  {errors.description ? (
                    <span className="form-error-msg">{errors.description}</span>
                  ) : (
                    <span className="form-hint">Minimum 80 characters recommended</span>
                  )}
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">
                      Price (USD) <span className="required">*</span>
                    </label>
                    <div className="input-with-prefix">
                      <span className="input-prefix">$</span>
                      <input
                        className={`form-input${errors.price ? " input-error" : ""}`}
                        type="number"
                        name="price"
                        value={form.price}
                        onChange={handleChange}
                        placeholder="25"
                        min="5"
                        step="1"
                      />
                    </div>
                    {errors.price && (
                      <span className="form-error-msg">{errors.price}</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Delivery Time <span className="required">*</span>
                    </label>
                    <div className="input-with-prefix">
                      <span className="input-prefix">📅</span>
                      <input
                        className={`form-input${errors.deliveryTime ? " input-error" : ""}`}
                        type="number"
                        name="deliveryTime"
                        value={form.deliveryTime}
                        onChange={handleChange}
                        placeholder="3"
                        min="1"
                        max="60"
                        style={{ paddingLeft: "36px" }}
                      />
                    </div>
                    {errors.deliveryTime ? (
                      <span className="form-error-msg">{errors.deliveryTime}</span>
                    ) : (
                      <span className="form-hint">Days</span>
                    )}
                  </div>
                </div>

                <div className="btn-row">
                  <button type="button" className="btn-secondary" onClick={() => setStep(0)}>
                    ← Back
                  </button>
                  <button type="button" className="btn-primary" onClick={() => tryAdvance(2)}>
                    Continue →
                  </button>
                </div>
              </>
            )}

            {/* STEP 2 — Media */}
            {step === 2 && (
              <>
                <div className="form-section-label">Gig Image</div>

                <div className="form-group">
                  <label className="form-label">
                    Cover Image <span className="required">*</span>
                  </label>
                  <div
                    className={`upload-zone ${form.image ? "has-file" : ""}${
                      errors.image ? " upload-error" : ""
                    }`}
                  >
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
                        <div className="upload-filename">✅ {form.image.name}</div>
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
                  {errors.image ? (
                    <span className="form-error-msg">{errors.image}</span>
                  ) : (
                    <span className="form-hint">
                      High-quality images improve your gig's visibility
                    </span>
                  )}
                </div>

                <div className="btn-row">
                  <button type="button" className="btn-secondary" onClick={() => setStep(1)}>
                    ← Back
                  </button>
                  <button type="submit" className="btn-primary" disabled={loading}>
                    {loading ? (
                      <>
                        <div className="btn-spinner" /> Publishing…
                      </>
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
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}