import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/api";
import "../styles/Explore.css";

/* ─── Constants ─── */
const CATEGORIES = [
  { value: "all",                label: "All",           icon: "✨" },
  { value: "logo-design",        label: "Logo Design",   icon: "🎨" },
  { value: "web-development",    label: "Web Dev",       icon: "💻" },
  { value: "video-editing",      label: "Video Editing", icon: "🎬" },
  { value: "content-writing",    label: "Writing",       icon: "✍️"  },
  { value: "seo",                label: "SEO",           icon: "🔍" },
  { value: "graphic-design",     label: "Graphic Design",icon: "🖌"  },
  { value: "music-production",   label: "Music",         icon: "🎵" },
  { value: "social-media",       label: "Social Media",  icon: "📱" },
  { value: "mobile-development", label: "Mobile Apps",   icon: "📲" },
  { value: "data-analysis",      label: "Data Analysis", icon: "📊" },
  { value: "ai-ml",              label: "AI & ML",       icon: "🤖" },
];

const SORT_OPTIONS = [
  { value: "newest",     label: "Newest First"      },
  { value: "oldest",     label: "Oldest First"      },
  { value: "price_asc",  label: "Price: Low → High" },
  { value: "price_desc", label: "Price: High → Low" },
  { value: "rating",     label: "Top Rated"         },
];

const DELIVERY_OPTIONS = [
  { value: "any", label: "Any delivery time" },
  { value: "1",   label: "Up to 1 day"       },
  { value: "3",   label: "Up to 3 days"      },
  { value: "7",   label: "Up to 7 days"      },
  { value: "14",  label: "Up to 14 days"     },
];

const RATING_OPTIONS = [
  { value: "any", stars: "",      label: "Any rating"  },
  { value: "4.5", stars: "★★★★★", label: "4.5 & above" },
  { value: "4",   stars: "★★★★☆", label: "4.0 & above" },
  { value: "3",   stars: "★★★☆☆", label: "3.0 & above" },
];

// ✅ Changed from 9 to 6
const PER_PAGE = 6;

/* ─── Helpers ─── */
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

// ✅ FIX: build image URL correctly — backend now stores only the filename
function buildImageUrl(image) {
  if (!image) return null;
  // Handle legacy paths that were stored as "/uploads/filename"
  if (image.startsWith("/uploads/")) return `http://localhost:5000${image}`;
  // New format: just the filename
  return `http://localhost:5000/uploads/${image}`;
}

/* ─── Skeleton ─── */
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
    if (t.includes("logo") || t.includes("design"))    return "🎨";
    if (t.includes("web")  || t.includes("website"))   return "💻";
    if (t.includes("video"))                           return "🎬";
    if (t.includes("seo"))                             return "🔍";
    if (t.includes("write") || t.includes("content"))  return "✍️";
    if (t.includes("music") || t.includes("audio"))    return "🎵";
    return "💼";
  };

  // ✅ FIX: stable mock values via useMemo so they don't flicker on re-render
  const { rating, reviews, delivery } = useMemo(() => ({
rating:   gig.rating || 0,
reviews:  gig.reviewCount || 0,
delivery: gig.deliveryTime || 1,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [gig._id]);

  const imageUrl = buildImageUrl(gig.image);
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
          <span className="gig-category-tag">
            {gig.category.replace(/-/g, " ")}
          </span>
        )}

        {/* ✅ Show hired badge on card too */}


        <button
          className={`gig-wishlist-btn${saved ? " saved" : ""}`}
          onClick={(e) => { e.stopPropagation(); onToggleSave(gig._id); }}
          title={saved ? "Remove from saved" : "Save gig"}
        >
          {saved ? "❤️" : "🤍"}
        </button>
        {isAssigned ? (
  <span className="gig-hired-badge">🔒 Hired</span>
) : (
  <span className="gig-open-badge">✓ Open</span>
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

/* ─── Filter Panel ─── */
function FilterPanel({ filters, onChange, onClear }) {
  return (
    <>
      <div className="filter-header">
        <span className="filter-header-title">🎛 Filters</span>
        <button className="filter-clear-btn" onClick={onClear}>Clear all</button>
      </div>

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

  const [allGigs,        setAllGigs]        = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [searchQuery,    setSearchQuery]    = useState("");
  const [liveQuery,      setLiveQuery]      = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [sortBy,         setSortBy]         = useState("newest");
  const [viewMode,       setViewMode]       = useState("grid");
  const [page,           setPage]           = useState(1);
  const { user } = useAuth();
const [savedGigIds, setSavedGigIds] = useState(new Set());
useEffect(() => {
  if (!user) return;

  api.get("/saved-gigs/ids")
    .then((res) => {
      setSavedGigIds(new Set(res.data));
    })
    .catch(() => {});
}, [user]);
  const [filters, setFilters] = useState({
    minPrice: "", maxPrice: "", delivery: "any", minRating: "any",
  });
  const [drawerOpen, setDrawerOpen] = useState(false);

  const searchInputRef = useRef(null);
  const topRef         = useRef(null);

  /* ── Read URL params on mount + on navigation ── */
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q      = params.get("q")        || "";
    const cat    = params.get("category") || "all";
    // ✅ NEW: read page from URL so back button works
    const p      = parseInt(params.get("page") || "1", 10);

    setLiveQuery(q);
    setSearchQuery(q);
    setPage(isNaN(p) || p < 1 ? 1 : p);

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
        const { data } = await api.get("/gigs");

        setAllGigs(Array.isArray(data) ? data : []);
      } catch {
        setAllGigs([]);
      } finally {
        setTimeout(() => setLoading(false), 400);
      }
    })();
  }, []);

  /* ── Filter + sort pipeline ── */
  const filtered = useMemo(() => {
    let result = [...allGigs];

    if (liveQuery.trim()) {
      const q = liveQuery.toLowerCase();
      result = result.filter(
        (g) =>
          g.title?.toLowerCase().includes(q) ||
          g.description?.toLowerCase().includes(q) ||
          g.category?.toLowerCase().includes(q)
      );
    }

    if (activeCategory !== "all") {
      result = result.filter((g) => g.category === activeCategory);
    }

    if (filters.minPrice !== "") result = result.filter((g) => g.price >= Number(filters.minPrice));
    if (filters.maxPrice !== "") result = result.filter((g) => g.price <= Number(filters.maxPrice));

    if (filters.delivery !== "any") {
      result = result.filter((g) => (g.deliveryTime || 99) <= Number(filters.delivery));
    }

    if (filters.minRating !== "any") {
      result = result.filter((g) => (g.rating || 0) >= Number(filters.minRating));
    }

    switch (sortBy) {
      case "price_asc":  result.sort((a, b) => a.price - b.price); break;
      case "price_desc": result.sort((a, b) => b.price - a.price); break;
      case "rating":     result.sort((a, b) => (b.rating || 0) - (a.rating || 0)); break;
      case "oldest":     result.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); break;
      default:           result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); break;
    }

    return result;
  }, [allGigs, liveQuery, activeCategory, filters, sortBy]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  // Clamp page in case filters reduce total
  const safePage   = Math.min(page, totalPages || 1);
  const pageGigs   = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  /* ✅ Reset to page 1 + update URL when filters change */
  const pushPage = useCallback((nextPage, extra = {}) => {
    const params = new URLSearchParams(location.search);
    params.set("page", nextPage);
    if (extra.q !== undefined)   params.set("q", extra.q);
    if (extra.cat !== undefined) params.set("category", extra.cat);
    navigate(`/explore?${params.toString()}`, { replace: false });
    // Scroll back to top of results
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.search, navigate]);

  // Reset page to 1 when any filter changes
  useEffect(() => {
    if (page !== 1) {
      const params = new URLSearchParams(location.search);
      params.set("page", "1");
      navigate(`/explore?${params.toString()}`, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveQuery, activeCategory, filters, sortBy]);

  /* ── Wishlist ── */
  const toggleSave = async (gigId) => {
  if (!user) {
    navigate("/login");
    return;
  }

  try {
    const { data } = await api.post("/saved-gigs/toggle", { gigId });

    setSavedGigIds((prev) => {
      const next = new Set(prev);
      data.saved ? next.add(gigId) : next.delete(gigId);
      return next;
    });

  } catch (err) {
    console.error(err);
  }
};

  /* ── Filter helpers ── */
  const handleFilterChange = (key, value) => setFilters((p) => ({ ...p, [key]: value }));

  const clearFilters = () => {
    setFilters({ minPrice: "", maxPrice: "", delivery: "any", minRating: "any" });
    setActiveCategory("all");
    setLiveQuery("");
    setSearchQuery("");
    navigate("/explore");
  };

  const activeFilterCount =
    (filters.minPrice  !== ""    ? 1 : 0) +
    (filters.maxPrice  !== ""    ? 1 : 0) +
    (filters.delivery  !== "any" ? 1 : 0) +
    (filters.minRating !== "any" ? 1 : 0) +
    (activeCategory    !== "all" ? 1 : 0);

  /* ── Pagination helper ── */
  const buildPages = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (safePage <= 4)  return [1, 2, 3, 4, 5, "…", totalPages];
    if (safePage >= totalPages - 3)
      return [1, "…", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, "…", safePage - 1, safePage, safePage + 1, "…", totalPages];
  };

  /* ── Search submit ── */
  const handleSearch = () => {
    setLiveQuery(searchQuery);
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    if (activeCategory !== "all") params.set("category", activeCategory);
    params.set("page", "1");
    navigate(`/explore?${params.toString()}`);
  };

  return (
    <div className="explore-page">

      {/* Hero */}
      <div className="explore-hero">
        <div className="explore-hero-inner">
          <h1 className="explore-hero-title">Explore Freelance Services</h1>
          <p className="explore-hero-sub">
            Browse {allGigs.length > 0 ? `${allGigs.length}+` : ""} gigs from talented freelancers
          </p>

          <div className="explore-search-bar">
            <span className="explore-search-icon">🔍</span>
            <input
              ref={searchInputRef}
              className="explore-search-input"
              placeholder="Search for any service… e.g. logo design, web development"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            {searchQuery && (
              <button
                className="explore-search-clear"
                onClick={() => { setSearchQuery(""); setLiveQuery(""); navigate("/explore"); }}
              >✕</button>
            )}
            <button className="explore-search-btn" onClick={handleSearch}>
              Search
            </button>
          </div>
        </div>

        <div className="category-chips-row">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              className={`chip${activeCategory === cat.value ? " active" : ""}`}
              onClick={() => {
                setActiveCategory(cat.value);
                const params = new URLSearchParams();
                if (liveQuery) params.set("q", liveQuery);
                params.set("category", cat.value);
                params.set("page", "1");
                navigate(`/explore?${params.toString()}`);
              }}
            >
              <span className="chip-icon">{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main layout */}
      <div className="explore-body">

        {/* Desktop sidebar */}
        <aside className="filter-sidebar">
          <div className="filter-card">
            <FilterPanel filters={filters} onChange={handleFilterChange} onClear={clearFilters} />
          </div>
        </aside>

        {/* Results */}
        <div className="results-area" ref={topRef}>

          {/* Toolbar */}
          <div className="results-toolbar">
            <div className="results-count">
              {loading ? "Loading…" : (
                <>
                  <strong>{filtered.length}</strong> gig{filtered.length !== 1 ? "s" : ""} found
                  {liveQuery && <> for "<strong>{liveQuery}</strong>"</>}
                  {totalPages > 1 && (
                    <span style={{ color: "var(--text-muted)", marginLeft: 8, fontWeight: 400 }}>
                      · Page {safePage} of {totalPages}
                    </span>
                  )}
                </>
              )}
            </div>

            <div className="toolbar-right">
              <button
                className="mobile-filter-btn"
                onClick={() => setDrawerOpen(true)}
              >
                🎛 Filters
                {activeFilterCount > 0 && (
                  <span style={{
                    background: "var(--brand)", color: "#fff",
                    borderRadius: "100px", padding: "1px 7px",
                    fontSize: 11, fontWeight: 800, marginLeft: 4,
                  }}>{activeFilterCount}</span>
                )}
              </button>

              <select
                className="sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

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

          {/* Cards */}
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
                    Try adjusting your search or filters.
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
                    saved={savedGigIds.has(gig._id)}
                    onToggleSave={toggleSave}
                  />
                ))
              )}
            </div>
          )}

          {/* ✅ Pagination — 6 per page, URL-synced */}
          {!loading && totalPages > 1 && (
            <div className="pagination">
              {/* Prev */}
              <button
                className="page-btn page-nav"
                onClick={() => pushPage(safePage - 1)}
                disabled={safePage === 1}
                aria-label="Previous page"
              >‹</button>

              {buildPages().map((p, i) =>
                p === "…" ? (
                  <span key={`dots-${i}`} className="page-dots">…</span>
                ) : (
                  <button
                    key={p}
                    className={`page-btn${safePage === p ? " active" : ""}`}
                    onClick={() => pushPage(p)}
                    aria-label={`Go to page ${p}`}
                    aria-current={safePage === p ? "page" : undefined}
                  >
                    {p}
                  </button>
                )
              )}

              {/* Next */}
              <button
                className="page-btn page-nav"
                onClick={() => pushPage(safePage + 1)}
                disabled={safePage === totalPages}
                aria-label="Next page"
              >›</button>
            </div>
          )}

          {/* Per-page info */}
          {!loading && filtered.length > 0 && (
            <div className="pagination-info">
              Showing {(safePage - 1) * PER_PAGE + 1}–{Math.min(safePage * PER_PAGE, filtered.length)} of {filtered.length} gigs
            </div>
          )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      {drawerOpen && (
        <div className="filter-overlay" onClick={() => setDrawerOpen(false)}>
          <div className="filter-drawer open" onClick={(e) => e.stopPropagation()}>
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