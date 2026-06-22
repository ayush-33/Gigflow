import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import NotificationBell from "./NotificationBell";
import { useNotifications } from "../context/NotificationContext";
import toast from "react-hot-toast";
import { 
  FiHome, 
  FiCompass, 
  FiMessageSquare, 
  FiAward, 
  FiLogIn, 
  FiUserPlus, 
  FiLogOut, 
  FiChevronRight 
} from "react-icons/fi";
import "../styles/Navbar.css";


export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // ✅ user from context — updates reactively on login/logout
  const { user, logout } = useAuth();
  const { unreadMessages } = useNotifications();

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

  // Prevent background scrolling when mobile menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMenuOpen]);

  const handleNavigation = (path) => {
    navigate(path);
    setIsMenuOpen(false);
  };

  // ✅ Calls api.post("/auth/logout") internally, clears context + cookie
  const handleLogout = async () => {
    await logout();
    toast.success("Logged out successfully.");
    navigate("/");
  };

  const isActive = (path) =>
    location.pathname === path ? "nav-link active" : "nav-link";

  return (
    <>
      {isMenuOpen && (
        <div className="nav-backdrop" onClick={() => setIsMenuOpen(false)} />
      )}
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
                <FiHome className="nav-link-icon" />
                <span className="nav-link-text">Home</span>
                <FiChevronRight className="nav-link-chevron" />
              </button>

              <button className={isActive("/explore")} onClick={() => handleNavigation("/explore")}>
                <FiCompass className="nav-link-icon" />
                <span className="nav-link-text">Explore Gigs</span>
                <FiChevronRight className="nav-link-chevron" />
              </button>

              {user && (
                <button
                  className={isActive("/chat")}
                  onClick={() => handleNavigation("/chat")}
                >
                  <FiMessageSquare className="nav-link-icon" />
                  <span className="nav-link-text" style={{ display: "inline-flex", alignItems: "center" }}>
                    Messages
                    {unreadMessages > 0 && (
                      <span className="navbar-unread-badge">{unreadMessages}</span>
                    )}
                  </span>
                  <FiChevronRight className="nav-link-chevron" />
                </button>
              )}

              <button className={isActive("/become-seller")} onClick={() => handleNavigation("/become-seller")}>
                <FiAward className="nav-link-icon" />
                <span className="nav-link-text">Become a Seller</span>
                <FiChevronRight className="nav-link-chevron" />
              </button>
            </div>

            <div className="nav-buttons">
              {!user ? (
                <>
                  <button className="btn-login" onClick={() => handleNavigation("/login")}>
                    <FiLogIn className="btn-auth-icon" />
                    <span>Login</span>
                  </button>
                  <button className="btn-signup" onClick={() => handleNavigation("/signup")}>
                    <FiUserPlus className="btn-auth-icon" />
                    <span>Sign Up</span>
                  </button>
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
                    <span className="profile-chevron-desktop">▾</span>
                    <FiChevronRight className="profile-chevron-mobile" />
                  </div>

                  <NotificationBell />

                  <button className="btn-logout" onClick={handleLogout}>
                    <FiLogOut className="btn-logout-icon" />
                    <span>Logout</span>
                  </button>

                </div>
              )}
            </div>
          </div>

        </div>
      </nav>
    </>
  );
}