import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/api";
import GigCard from "../components/GigCard";
import "../styles/Home.css";

/* ── Home Page ── */
export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  // ✅ Exactly 6 gigs on home page
  const [gigs, setGigs] = useState([]);
  const [savedGigIds, setSavedGigIds] = useState(new Set());
  const [saveToast, setSaveToast]     = useState(null);
  const { user }                      = useAuth();
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

  useEffect(() => {
    if (!user) return;
    api.get("/saved-gigs/ids")
      .then(res => setSavedGigIds(new Set(res.data)))
      .catch(() => {});
  }, [user]);

  const toggleSave = async (gigId) => {
    if (!user) { navigate("/login"); return; }
    try {
      const { data } = await api.post("/saved-gigs/toggle", { gigId });
      setSavedGigIds(prev => {
        const next = new Set(prev);
        data.saved ? next.add(gigId) : next.delete(gigId);
        return next;
      });
      setSaveToast({ isSave: data.saved });
      setTimeout(() => setSaveToast(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

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
              <button
                key={cat.id}
                type="button"
                className="category-card"
                onClick={() =>
                  navigate(`/explore?category=${encodeURIComponent(cat.name)}&page=1`)
                }
              >
                <div className="category-icon">{cat.icon}</div>
                <h3 className="category-name">{cat.name}</h3>
              </button>
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
                <GigCard key={gig._id} gig={gig} saved={savedGigIds.has(gig._id)} onToggleSave={toggleSave} />
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
            <button className="cta-btn-secondary" onClick={() => navigate("/become-seller")}>
              Become a Seller
            </button>
          </div>
        </div>
      </section>

      {saveToast && (
        <div className={`save-toast ${saveToast.isSave ? "save-toast-saved" : "save-toast-removed"}`}>
          {saveToast.isSave ? (
            <>
              ❤️ Gig saved!{" "}
              <span
                className="save-toast-link"
                onClick={() => navigate("/profile", { state: { tab: "saved" } })}
              >
                View in My Gigs →
              </span>
            </>
          ) : (
            "Removed from saved"
          )}
        </div>
      )}

    </div>
  );
}