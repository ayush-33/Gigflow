import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../styles/Explore.css";

/* ─── Constants ─── */
const CATEGORIES = [
  { value: "all",                label: "All",                icon: "✨" },
  { value: "logo-design",        label: "Logo Design",        icon: "🎨" },
  { value: "web-development",    label: "Web Dev",            icon: "💻" },
  { value: "video-editing",      label: "Video Editing",      icon: "🎬" },
  { value: "content-writing",    label: "Writing",            icon: "✍️"  },
  { value: "seo",                label: "SEO",                icon: "🔍" },
  { value: "graphic-design",     label: "Graphic Design",     icon: "🖌"  },
  { value: "music-production",   label: "Music",              icon: "🎵" },
  { value: "social-media",       label: "Social Media",       icon: "📱" },
  { value: "mobile-development", label: "Mobile Apps",        icon: "📲" },
  { value: "data-analysis",      label: "Data Analysis",      icon: "📊" },
  { value: "ai-ml",              label: "AI & ML",            icon: "🤖" },
];

const SORT_OPTIONS = [
  { value: "newest",    label: "Newest First"    },
  { value: "oldest",    label: "Oldest First"    },
  { value: "price_asc", label: "Price: Low → High" },
  { value: "price_desc",label: "Price: High → Low" },
  { value: "rating",    label: "Top Rated"       },
];

const DELIVERY_OPTIONS = [
  { value: "any",  label: "Any delivery time" },
  { value: "1",    label: "Up to 1 day"       },
  { value: "3",    label: "Up to 3 days"      },
  { value: "7",    label: "Up to 7 days"      },
  { value: "14",   label: "Up to 14 days"     },
];

const RATING_OPTIONS = [
  { value: "any", stars: "",       label: "Any rating"  },
  { value: "4.5", stars: "★★★★★",  label: "4.5 & above" },
  { value: "4",   stars: "★★★★☆",  label: "4.0 & above" },
  { value: "3",   stars: "★★★☆☆",  label: "3.0 & above" },
];

const PER_PAGE = 9;

/* ─── Star rating display ─── */
function Stars({ score = 0 }) {
  const full  = Math.floor(score);
  const half  = score % 1 >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <span className="stars">
      {"★".repeat(full)}{half ? "½" : ""}{"☆".repeat(empty)}
    </span>
  );
}

/* ─── Skeleton card ─── */
function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton-image" />
      <div className="skeleton-body">
        <div className="skeleton-line w-70" />
        <div className="skeleton-line w-50" />
        <div className="skeleton-line w-40" />
      </div>
    </div>
  );
}

/* ─── Gig Card ─── */
function GigCard({ gig, onNavigate, saved, onToggleSave }) {
  const [imgError, setImgError] = useState(false);

  const guessIcon = () => {
    const t = (gig.title || "").toLowerCase();
    if (t.includes("logo") || t.includes("design")) return "🎨";
    if (t.includes("web")  || t.includes("website")) return "💻";
    if (t.includes("video")) return "🎬";
    if (t.includes("seo"))   return "🔍";
    if (t.includes("write") || t.includes("content")) return "✍️";
    if (t.includes("music") || t.includes("audio"))   return "🎵";
    return "💼";
  };

  const rating = gig.rating ?? parseFloat((4 + Math.random()).toFixed(1));
  const reviews = gig.reviewCount ?? Math.floor(Math.random() * 150 + 5);
  const delivery = gig.deliveryTime ?? Math.floor(Math.random() * 7 + 1);

  return (
    <div className="gig-card" onClick={() => onNavigate(`/gig/${gig._id}`)}>
      <div className="gig-image-wrapper">
        {!imgError ? (
          <img
            src={`http://localhost:5000/uploads/${gig.image}`}
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
          <span className="gig-category-tag">{gig.category.replace(/-/g, " ")}</span>
        )}
        <button
          className={`gig-wishlist-btn${saved ? " saved" : ""}`}
          onClick={(e) => { e.stopPropagation(); onToggleSave(gig._id); }}
          title={saved ? "Remove from saved" : "Save gig"}
        >
          {saved ? "❤️" : "🤍"}
        </button>
      </div>

      <div className="gig-content">
        <div className="gig-seller">
          <div className="seller-avatar">👤</div>
          <span className="seller-name">{gig.ownerId?.username || "Unknown"}</span>
        </div>

        <h3 className="gig-title">{gig.title}</h3>

        <div className="gig-rating">
          <Stars score={rating} />
          <span className="rating-score">{rating.toFixed(1)}</span>
          <span className="review-count">({reviews})</span>
        </div>

        <div className="gig-footer">
          <div className="gig-price-block">
            <span className="gig-price-label">Starting at</span>
            <span className="gig-price">${gig.price}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <span className="gig-delivery">⏱ {delivery}d delivery</span>
            <button
              className="gig-btn"
              onClick={(e) => { e.stopPropagation(); onNavigate(`/gig/${gig._id}`); }}
            >
              View Gig
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Filter Panel (shared between sidebar and drawer) ─── */
function FilterPanel({ filters, onChange, onClear }) {
  return (
    <>
      <div className="filter-header">
        <span className="filter-header-title">🎛 Filters</span>
        <button className="filter-clear-btn" onClick={onClear}>Clear all</button>
      </div>

      {/* Price Range */}
      <div className="filter-section">
        <div className="filter-section-title">Price Range (USD)</div>
        <div className="price-inputs">
          <input
            className="price-input"
            type="number"
            placeholder="Min"
            value={filters.minPrice}
            onChange={(e) => onChange("minPrice", e.target.value)}
          />
          <span className="price-sep">—</span>
          <input
            className="price-input"
            type="number"
            placeholder="Max"
            value={filters.maxPrice}
            onChange={(e) => onChange("maxPrice", e.target.value)}
          />
        </div>
      </div>

      {/* Delivery Time */}
      <div className="filter-section">
        <div className="filter-section-title">Delivery Time</div>
        <div className="delivery-options">
          {DELIVERY_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`delivery-option${filters.delivery === opt.value ? " active" : ""}`}
            >
              <input
                type="radio"
                name="delivery"
                value={opt.value}
                checked={filters.delivery === opt.value}
                onChange={() => onChange("delivery", opt.value)}
              />
              <div className="delivery-dot" />
              <span className="delivery-label">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Min Rating */}
      <div className="filter-section">
        <div className="filter-section-title">Minimum Rating</div>
        <div className="rating-options">
          {RATING_OPTIONS.map((opt) => (
            <div
              key={opt.value}
              className={`rating-option${filters.minRating === opt.value ? " active" : ""}`}
              onClick={() => onChange("minRating", opt.value)}
            >
              {opt.stars && <span className="rating-stars">{opt.stars}</span>}
              <span className="rating-label">{opt.label}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════
   EXPLORE PAGE
═══════════════════════════════════════ */
export default function Explore() {
  const navigate = useNavigate();
  const location = useLocation();

  /* ── State ── */
  const [allGigs,       setAllGigs]       = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [searchQuery,   setSearchQuery]   = useState("");
  const [liveQuery,     setLiveQuery]     = useState("");
  const [activeCategory,setActiveCategory]= useState("all");
  const [sortBy,        setSortBy]        = useState("newest");
  const [viewMode,      setViewMode]      = useState("grid");
  const [page,          setPage]          = useState(1);
  const [savedGigs,     setSavedGigs]     = useState(() => {
    try { return JSON.parse(localStorage.getItem("savedGigs")) || []; } catch { return []; }
  });
  const [filters, setFilters] = useState({
    minPrice:  "",
    maxPrice:  "",
    delivery:  "any",
    minRating: "any",
  });
  const [drawerOpen, setDrawerOpen] = useState(false);

  const searchInputRef = useRef(null);

  /* ── Read URL params on mount ── */
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q   = params.get("q")        || "";
    const cat = params.get("category") || "all";
    setLiveQuery(q);
    setSearchQuery(q);
    const matched = CATEGORIES.find(
      (c) => c.label.toLowerCase() === cat.toLowerCase() || c.value === cat
    );
    setActiveCategory(matched?.value || "all");
  }, [location.search]);

  /* ── Fetch gigs ── */
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res  = await fetch("http://localhost:5000/api/gigs");
        const data = await res.json();
        setAllGigs(Array.isArray(data) ? data : []);
      } catch {
        setAllGigs([]);
      } finally {
        // slight delay so skeleton shows briefly
        setTimeout(() => setLoading(false), 400);
      }
    })();
  }, []);

  /* ── Filter + sort pipeline ── */
  const processed = useCallback(() => {
    let result = [...allGigs];

    // text search
    if (liveQuery.trim()) {
      const q = liveQuery.toLowerCase();
      result = result.filter(
        (g) =>
          g.title?.toLowerCase().includes(q) ||
          g.description?.toLowerCase().includes(q) ||
          g.category?.toLowerCase().includes(q)
      );
    }

    // category
    if (activeCategory !== "all") {
      result = result.filter((g) => g.category === activeCategory);
    }

    // price
    if (filters.minPrice !== "") result = result.filter((g) => g.price >= Number(filters.minPrice));
    if (filters.maxPrice !== "") result = result.filter((g) => g.price <= Number(filters.maxPrice));

    // delivery
    if (filters.delivery !== "any") {
      result = result.filter((g) => (g.deliveryTime || 99) <= Number(filters.delivery));
    }

    // rating
    if (filters.minRating !== "any") {
      result = result.filter(
        (g) => (g.rating || 4.0) >= Number(filters.minRating)
      );
    }

    // sort
    switch (sortBy) {
      case "price_asc":  result.sort((a, b) => a.price - b.price);  break;
      case "price_desc": result.sort((a, b) => b.price - a.price);  break;
      case "rating":     result.sort((a, b) => (b.rating || 4) - (a.rating || 4)); break;
      case "oldest":     result.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); break;
      default:           result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); break;
    }

    return result;
  }, [allGigs, liveQuery, activeCategory, filters, sortBy]);

  const filtered  = processed();
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const pageGigs  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  /* reset to page 1 on any filter change */
  useEffect(() => { setPage(1); }, [liveQuery, activeCategory, filters, sortBy]);

  /* ── Wishlist ── */
  const toggleSave = (id) => {
    setSavedGigs((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem("savedGigs", JSON.stringify(next));
      return next;
    });
  };

  /* ── Filter helpers ── */
  const handleFilterChange = (key, value) => {
    setFilters((p) => ({ ...p, [key]: value }));
  };
  const clearFilters = () => {
    setFilters({ minPrice: "", maxPrice: "", delivery: "any", minRating: "any" });
    setActiveCategory("all");
    setLiveQuery("");
    setSearchQuery("");
  };

  const activeFilterCount =
    (filters.minPrice !== "" ? 1 : 0) +
    (filters.maxPrice !== "" ? 1 : 0) +
    (filters.delivery !== "any" ? 1 : 0) +
    (filters.minRating !== "any" ? 1 : 0) +
    (activeCategory !== "all" ? 1 : 0);

  /* ── Pagination helpers ── */
  const buildPages = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 4) return [1, 2, 3, 4, 5, "…", totalPages];
    if (page >= totalPages - 3) return [1, "…", totalPages-4, totalPages-3, totalPages-2, totalPages-1, totalPages];
    return [1, "…", page - 1, page, page + 1, "…", totalPages];
  };

  return (
    <div className="explore-page">

      {/* ── Hero search ── */}
      <div className="explore-hero">
        <div className="explore-hero-inner">
          <h1 className="explore-hero-title">Explore Freelance Services</h1>
          <p className="explore-hero-sub">
            Browse {allGigs.length > 0 ? `${allGigs.length}+` : ""} gigs from talented freelancers worldwide
          </p>

          <div className="explore-search-bar">
            <span className="explore-search-icon">🔍</span>
            <input
              ref={searchInputRef}
              className="explore-search-input"
              placeholder="Search for any service… e.g. logo design, web development"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setLiveQuery(searchQuery)}
            />
            {searchQuery && (
              <button
                style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-muted)", padding:"0 8px", fontSize:16 }}
                onClick={() => { setSearchQuery(""); setLiveQuery(""); }}
              >✕</button>
            )}
            <button
              className="explore-search-btn"
              onClick={() => setLiveQuery(searchQuery)}
            >
              Search
            </button>
          </div>
        </div>

        {/* Category chips */}
        <div className="category-chips-row">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              className={`chip${activeCategory === cat.value ? " active" : ""}`}
              onClick={() => setActiveCategory(cat.value)}
            >
              <span className="chip-icon">{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main body ── */}
      <div className="explore-body">

        {/* ── Desktop filter sidebar ── */}
        <aside className="filter-sidebar">
          <div className="filter-card">
            <FilterPanel
              filters={filters}
              onChange={handleFilterChange}
              onClear={clearFilters}
            />
          </div>
        </aside>

        {/* ── Results area ── */}
        <div className="results-area">

          {/* Toolbar */}
          <div className="results-toolbar">
            <div className="results-count">
              {loading ? "Loading…" : (
                <>
                  <strong>{filtered.length}</strong> gig{filtered.length !== 1 ? "s" : ""} found
                  {liveQuery && <> for "<strong>{liveQuery}</strong>"</>}
                </>
              )}
            </div>

            <div className="toolbar-right">
              {/* mobile filter btn */}
              <button
                className="mobile-filter-btn"
                onClick={() => setDrawerOpen(true)}
              >
                🎛 Filters
                {activeFilterCount > 0 && (
                  <span style={{
                    background: "var(--brand)", color: "#fff",
                    borderRadius: "100px", padding: "1px 7px",
                    fontSize: 11, fontWeight: 800, marginLeft: 2,
                  }}>{activeFilterCount}</span>
                )}
              </button>

              {/* sort */}
              <select
                className="sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              {/* view toggle */}
              <div className="view-toggle">
                <button
                  className={`view-btn${viewMode === "grid" ? " active" : ""}`}
                  onClick={() => setViewMode("grid")}
                  title="Grid view"
                >⊞</button>
                <button
                  className={`view-btn${viewMode === "list" ? " active" : ""}`}
                  onClick={() => setViewMode("list")}
                  title="List view"
                >≡</button>
              </div>
            </div>
          </div>

          {/* Gig grid / skeleton / empty */}
          {loading ? (
            <div className="skeleton-grid">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : (
            <div className={`gigs-grid${viewMode === "list" ? " list-view" : ""}`}>
              {pageGigs.length === 0 ? (
                <div className="empty-results">
                  <div className="empty-results-icon">🔎</div>
                  <div className="empty-results-title">No gigs found</div>
                  <div className="empty-results-sub">
                    Try adjusting your search or filters to find what you're looking for.
                  </div>
                  <button className="empty-results-clear" onClick={clearFilters}>
                    Clear Filters
                  </button>
                </div>
              ) : (
                pageGigs.map((gig) => (
                  <GigCard
                    key={gig._id}
                    gig={gig}
                    onNavigate={navigate}
                    saved={savedGigs.includes(gig._id)}
                    onToggleSave={toggleSave}
                  />
                ))
              )}
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="pagination">
              <button
                className="page-btn"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >‹</button>

              {buildPages().map((p, i) =>
                p === "…" ? (
                  <span key={`dots-${i}`} className="page-dots">…</span>
                ) : (
                  <button
                    key={p}
                    className={`page-btn${page === p ? " active" : ""}`}
                    onClick={() => setPage(p)}
                  >{p}</button>
                )
              )}

              <button
                className="page-btn"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >›</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile filter drawer ── */}
      {drawerOpen && (
        <div className="filter-overlay" onClick={() => setDrawerOpen(false)}>
          <div
            className={`filter-drawer open`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="filter-drawer-handle" />
            <div className="filter-card" style={{ border: "none", borderRadius: 0 }}>
              <FilterPanel
                filters={filters}
                onChange={handleFilterChange}
                onClear={() => { clearFilters(); setDrawerOpen(false); }}
              />
            </div>
            <button
              style={{
                marginTop: 16, width: "100%", padding: "13px",
                background: "var(--brand)", color: "#fff", border: "none",
                borderRadius: "var(--radius-md)", fontFamily: "var(--font)",
                fontSize: 14, fontWeight: 700, cursor: "pointer",
              }}
              onClick={() => setDrawerOpen(false)}
            >
              Show {filtered.length} Results
            </button>
          </div>
        </div>
      )}

    </div>
  );
}