import { useState, useEffect, useRef } from "react";
  import { useNavigate, useLocation } from "react-router-dom";
  import { useAuth } from "../context/AuthContext";
  import NotificationBell from "./NotificationBell";
  import "../styles/Navbar.css";

  export default function Navbar() {
    const [isMenuOpen,        setIsMenuOpen]        = useState(false);
    const [scrolled,          setScrolled]          = useState(false);

    // ✅ user from context — updates reactively on login/logout
    const { user, logout } = useAuth();

    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
      const onScroll = () => setScrolled(window.scrollY > 10);
      window.addEventListener("scroll", onScroll, { passive: true });
      return () => window.removeEventListener("scroll", onScroll);
    }, []);

    useEffect(() => {
      setIsMenuOpen(false);
    }, [location.pathname]);

    const handleNavigation = (path) => {
      navigate(path);
      setIsMenuOpen(false);
    };

    // ✅ Calls api.post("/auth/logout") internally, clears context + cookie
    const handleLogout = async () => {
      await logout();
      navigate("/");
    };

    const isActive = (path) =>
      location.pathname === path ? "nav-link active" : "nav-link";

    return (
      <nav className={`navbar${scrolled ? " scrolled" : ""}`}>
        <div className="navbar-container">

          <div className="navbar-logo" onClick={() => handleNavigation("/")}>
            GigFlow
          </div>

          <button
            className={`hamburger${isMenuOpen ? " active" : ""}`}
            onClick={() => setIsMenuOpen((p) => !p)}
            aria-label="Toggle menu"
          >
            <span /><span /><span />
          </button>

          <div className={`nav-menu${isMenuOpen ? " active" : ""}`}>
            <div className="nav-links">
                <button className={isActive("/")} onClick={() => handleNavigation("/")}>
      Home
    </button>

    <button className={isActive("/explore")} onClick={() => handleNavigation("/explore")}>
      Explore Gigs
    </button>

    {user && (
      <button
        className={isActive("/chat")}
        onClick={() => handleNavigation("/Chat")}
      >
        Messages
      </button>
    )}

    <button className={isActive("/become-seller")} onClick={() => handleNavigation("/become-seller")}>
      Become a Seller
    </button>

            </div>

            <div className="nav-buttons">
              {!user ? (
                <>
                  <button className="btn-login"  onClick={() => handleNavigation("/login")}>Login</button>
                  <button className="btn-signup" onClick={() => handleNavigation("/signup")}>Sign Up</button>
                </>
              ) : (
                <div className="user-section">

                  <div className="nav-profile" onClick={() => handleNavigation("/profile")}>
                    <div className="profile-avatar">
                      {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                    </div>
                    <div className="profile-text">
                      <span className="profile-name">{user.name}</span>
                      <span className="profile-role">My Account</span>
                    </div>
                    <span className="profile-chevron">▾</span>
                  </div>

                  <NotificationBell />

                  <button className="btn-logout" onClick={handleLogout}>Logout</button>

                </div>
              )}
            </div>
          </div>

        </div>
      </nav>
    );
  }