import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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

export default function EditGig() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const token     = localStorage.getItem("token");

  const [gig, setGig] = useState({
    title: "", description: "", price: "",
    category: "", deliveryTime: "",
  });
  const [image,   setImage]   = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetching,setFetching]= useState(true);
  const [toast,   setToast]   = useState(null);
  const [changed, setChanged] = useState(false);

  const showToast = (message, type = "success") => setToast({ message, type });

  /* ── Fetch existing gig ── */
  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch(`http://localhost:5000/api/gigs/${id}`);
        const data = await res.json();
        setGig({
          title:        data.title        || "",
          description:  data.description  || "",
          price:        data.price        || "",
          category:     data.category     || "",
          deliveryTime: data.deliveryTime || "",
        });
        if (data.image) setPreview(`http://localhost:5000/uploads/${data.image}`);
      } catch {
        showToast("Failed to load gig data.", "error");
      } finally {
        setFetching(false);
      }
    })();
  }, [id]);

  const handleChange = (e) => {
    setGig((p) => ({ ...p, [e.target.name]: e.target.value }));
    setChanged(true);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImage(file);
    setPreview(URL.createObjectURL(file));
    setChanged(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("title",        gig.title);
      fd.append("description",  gig.description);
      fd.append("price",        gig.price);
      fd.append("category",     gig.category);
      fd.append("deliveryTime", gig.deliveryTime);
      if (image) fd.append("image", image);

      const res = await fetch(`http://localhost:5000/api/gigs/${id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      if (res.ok) {
        showToast("Gig updated successfully! ✨");
        setTimeout(() => navigate("/profile"), 1400);
      } else {
        const data = await res.json();
        showToast(data.message || "Update failed.", "error");
      }
    } catch {
      showToast("Server error. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="gig-page" style={{ alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <div className="btn-spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
          <p style={{ color: "var(--text-muted)", fontFamily: "var(--font)", fontSize: 14 }}>
            Loading gig…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="gig-page">
      <div className="gig-card">

        {/* ── Header ── */}
        <div className="gig-card-header">
          <div className="gig-card-icon">✏️</div>
          <h1 className="gig-card-title">Edit Gig</h1>
          <p className="gig-card-sub">
            Update your gig details to attract more clients
          </p>
        </div>

        {/* ── Body ── */}
        <div className="gig-card-body">
          <form className="gig-form" onSubmit={handleSubmit}>

            {/* Image */}
            <div className="form-section-label">Cover Image</div>
            <div className="form-group">
              <label className="form-label">Gig Image</label>
              <div className={`upload-zone ${preview ? "has-file" : ""}`}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                />
                {preview ? (
                  <>
                    <img className="upload-preview" src={preview} alt="Preview" />
                    <div className="upload-filename">
                      {image ? `✅ ${image.name}` : "✅ Current image (click to change)"}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="upload-icon">🖼</div>
                    <div className="upload-title">
                      Click to upload a new image
                    </div>
                    <div className="upload-sub">PNG, JPG · max 5 MB</div>
                  </>
                )}
              </div>
            </div>

            {/* Title */}
            <div className="form-section-label">Gig Details</div>

            <div className="form-group">
              <label className="form-label">
                Gig Title <span className="required">*</span>
              </label>
              <input
                className="form-input"
                name="title"
                value={gig.title}
                onChange={handleChange}
                placeholder="e.g., I will design a professional logo"
                maxLength={80}
                required
              />
              <span className="form-hint">{gig.title.length}/80 characters</span>
            </div>

            {/* Category */}
            <div className="form-group">
              <label className="form-label">Category</label>
              <select
                className="form-select"
                name="category"
                value={gig.category}
                onChange={handleChange}
              >
                <option value="">Select a category</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div className="form-group">
              <label className="form-label">
                Description <span className="required">*</span>
              </label>
              <textarea
                className="form-textarea"
                name="description"
                value={gig.description}
                onChange={handleChange}
                placeholder="Describe what you'll deliver…"
                rows={5}
                required
              />
            </div>

            {/* Price + Delivery */}
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
                    value={gig.price}
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
                  Delivery (days) <span className="required">*</span>
                </label>
                <input
                  className="form-input"
                  type="number"
                  name="deliveryTime"
                  value={gig.deliveryTime}
                  onChange={handleChange}
                  placeholder="3"
                  min="1"
                  max="60"
                  required
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="btn-row">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => navigate("/profile")}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={loading || !changed}
              >
                {loading ? (
                  <><div className="btn-spinner" /> Saving…</>
                ) : (
                  "💾 Save Changes"
                )}
              </button>
            </div>

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