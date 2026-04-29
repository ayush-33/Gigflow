import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import "../styles/Home.css";

/* ── Helpers ── */
function StarRating({ score = 0 }) {
  const full  = Math.floor(score);
  const half  = score % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return (
    <span className="stars">
      {"★".repeat(full)}{half ? "½" : ""}{"☆".repeat(empty)}
    </span>
  );
}

// ✅ FIX: same helper as Explore — handles both legacy /uploads/file and bare filename
function buildImageUrl(image) {
  if (!image) return null;
  if (image.startsWith("/uploads/")) return `http://localhost:5000${image}`;
  return `http://localhost:5000/uploads/${image}`;
}

/* ── Gig Card ── */
function GigCard({ gig, onNavigate }) {
  const [imgError, setImgError] = useState(false);

  const guessIcon = () => {
    const t = (gig.title || "").toLowerCase();
    if (t.includes("logo") || t.includes("design"))  return "🎨";
    if (t.includes("web")  || t.includes("website")) return "💻";
    if (t.includes("video"))                         return "🎬";
    if (t.includes("seo"))                           return "🔍";
    if (t.includes("write") || t.includes("content")) return "✍️";
    if (t.includes("music") || t.includes("audio"))   return "🎵";
    return "💼";
  };

  // ✅ FIX: useMemo so mock values don't re-randomise on every render
  const { rating, reviewCount } = useMemo(() => ({
    rating:      gig.rating      ?? parseFloat((4 + Math.random()).toFixed(1)),
    reviewCount: gig.reviewCount ?? Math.floor(Math.random() * 120 + 5),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [gig._id]);

  const imageUrl   = buildImageUrl(gig.image);
  const isAssigned = gig.status === "assigned";

  return (
    <div className="gig-card" onClick={() => onNavigate(`/gig/${gig._id}`)}>

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
          <span className="gig-category-tag">{gig.category}</span>
        )}

        {isAssigned ? (
          <span className="gig-hired-badge-home">🔒 Hired</span>
        ) : (
          <span className="gig-open-badge-home">✓ Open</span>
        )}
      </div>

      <div className="gig-content">
        <div className="gig-seller">
          <div className="seller-avatar">👤</div>
          <span className="seller-name">
            {gig.ownerId?.name || gig.ownerId?.username || "Unknown"}
          </span>
        </div>

        <h3 className="gig-title">{gig.title}</h3>

        <div className="gig-rating">
          <StarRating score={rating} />
          <span className="rating-score">{Number(rating).toFixed(1)}</span>
          <span className="reviews">({reviewCount})</span>
        </div>

        <div className="gig-footer">
          <div className="gig-price-block">
            <span className="gig-price-label">Starting at</span>
            <span className="gig-price">${gig.price}</span>
          </div>
          <button
            className="gig-btn"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate(`/gig/${gig._id}`);
            }}
          >
            View Gig
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Home Page ── */
export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  // ✅ Exactly 6 gigs on home page
  const [gigs, setGigs] = useState([]);
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) navigate(`/explore?q=${encodeURIComponent(q)}&page=1`);
  };

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/gigs");

        // ✅ Slice to exactly 6
        setGigs(Array.isArray(data) ? data.slice(0, 6) : []);
      } catch (err) {
        console.error("Error fetching gigs:", err);
      }
    })();
  }, []);

  const categories = [
    { id: 1,  name: "Web Development",  icon: "💻" },
    { id: 2,  name: "Design",           icon: "🎨" },
    { id: 3,  name: "Writing",          icon: "✍️"  },
    { id: 4,  name: "Marketing",        icon: "📱" },
    { id: 5,  name: "Video Editing",    icon: "🎬" },
    { id: 6,  name: "Music Production", icon: "🎵" },
    { id: 7,  name: "Mobile Apps",      icon: "📲" },
    { id: 8,  name: "Data Analysis",    icon: "📊" },
    { id: 9,  name: "SEO Services",     icon: "🔍" },
    { id: 10, name: "AI & ML",          icon: "🤖" },
  ];

  const steps = [
    { num: "1", title: "Post Your Requirements",
      desc: "Describe what you need in minutes and let freelancers come to you." },
    { num: "2", title: "Browse & Hire",
      desc: "Compare top-rated freelancers, read reviews, and hire the perfect match." },
    { num: "3", title: "Get It Done",
      desc: "Collaborate seamlessly and receive your work on time, every time." },
  ];

  return (
    <div className="home-page">

      {/* HERO */}
      <section className="hero-section">
        <div className="hero-container">
          <div className="hero-badge">🚀 Trusted by thousands of clients</div>
          <h1 className="hero-title">
            Find Talented Freelancers<br />
            For <span className="highlight">Any Job</span>
          </h1>
          <p className="hero-subtitle">
            Connect with skilled professionals and get your projects done
            faster, smarter, and better.
          </p>
          <form className="search-form" onSubmit={handleSearch}>
            <input
              type="text"
              className="search-input"
              placeholder="Search for services… e.g. logo design"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit" className="search-btn">Search</button>
          </form>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="categories-section">
        <div className="section-container">
          <div className="section-header">
            <h2 className="section-title">Popular Categories</h2>
            <button className="section-link" onClick={() => navigate("/explore")}>
              Browse all →
            </button>
          </div>
          <div className="categories-grid">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="category-card"
                onClick={() =>
                  navigate(`/explore?category=${encodeURIComponent(cat.name)}&page=1`)
                }
              >
                <div className="category-icon">{cat.icon}</div>
                <h3 className="category-name">{cat.name}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED GIGS — exactly 6 */}
      <section className="featured-gigs-section">
        <div className="section-container">
          <div className="section-header">
            <h2 className="section-title">Featured Gigs</h2>
            <button className="section-link" onClick={() => navigate("/explore")}>
              View all →
            </button>
          </div>

          {gigs.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "3rem 1rem",
              color: "var(--text-muted, #6b7280)", fontSize: "0.9rem"
            }}>
              No gigs yet.{" "}
              <button
                onClick={() => navigate("/become-seller")}
                style={{ background: "none", border: "none", cursor: "pointer",
                  color: "var(--brand, #6366f1)", fontWeight: 700 }}
              >
                Post the first one →
              </button>
            </div>
          ) : (
            <div className="gigs-grid">
              {gigs.map((gig) => (
                <GigCard key={gig._id} gig={gig} onNavigate={navigate} />
              ))}
            </div>
          )}

          <div className="load-more-wrapper">
            <button className="load-more-btn" onClick={() => navigate("/explore")}>
              Explore All Gigs →
            </button>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="how-it-works-section">
        <div className="section-container">
          <div className="section-header" style={{ justifyContent: "center" }}>
            <h2 className="section-title">How It Works</h2>
          </div>
          <div className="steps-grid">
            {steps.map((s) => (
              <div className="step-card" key={s.num}>
                <div className="step-number">{s.num}</div>
                <h3 className="step-title">{s.title}</h3>
                <p className="step-desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="cta-container">
          <h2>Ready to Get Started?</h2>
          <p>Join thousands of satisfied clients and hire talented freelancers today.</p>
          <div className="cta-buttons">
            <button className="cta-btn-primary" onClick={() => navigate("/explore")}>
              Browse Gigs
            </button>
            <button className="cta-btn-primary" onClick={() => navigate("/become-seller")}>
              Become a Seller
            </button>
          </div>
        </div>
      </section>

    </div>
  );
}