  import { useState, useEffect, useRef } from "react";
  import { useNavigate, useLocation } from "react-router-dom";
  import { useAuth } from "../context/AuthContext";
  import { useNotifications } from "../context/NotificationContext";
  import "../styles/Navbar.css";

  export default function Navbar() {
    const [isMenuOpen,        setIsMenuOpen]        = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [scrolled,          setScrolled]          = useState(false);

    // ✅ user from context — updates reactively on login/logout
    const { user, logout } = useAuth();
    const { notifications, markOneAsRead, markAllRead } = useNotifications();

    const navigate = useNavigate();
    const location = useLocation();
    const bellRef  = useRef(null);

    useEffect(() => {
      const onScroll = () => setScrolled(window.scrollY > 10);
      window.addEventListener("scroll", onScroll, { passive: true });
      return () => window.removeEventListener("scroll", onScroll);
    }, []);

    useEffect(() => {
      if (!showNotifications) return;
      const handler = (e) => {
        if (bellRef.current && !bellRef.current.contains(e.target))
          setShowNotifications(false);
      };
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }, [showNotifications]);

    useEffect(() => {
      setIsMenuOpen(false);
      setShowNotifications(false);
    }, [location.pathname]);

    const unreadCount = Array.isArray(notifications)
      ? notifications.filter((n) => !n.isRead).length : 0;

    const handleNavigation = (path) => {
      navigate(path);
      setIsMenuOpen(false);
      setShowNotifications(false);
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

                  <div
                    ref={bellRef}
                    className={`notification-bell${unreadCount > 0 ? " has-unread" : ""}`}
                    onClick={() => setShowNotifications((p) => !p)}
                  >
                    🔔
                    {unreadCount > 0 && (
                      <span className="notification-count">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}

                    {showNotifications && (
                      <div className="notification-dropdown">
                        <div className="dropdown-header">
                          <span className="dropdown-header-title">Notifications</span>
                          {notifications.length > 0 && (
                            <button className="mark-all-btn"
                              onClick={(e) => { e.stopPropagation(); markAllRead(); }}>
                              Mark all read
                            </button>
                          )}
                        </div>

                        {notifications.length === 0 ? (
                          <p className="empty-notification">You're all caught up 🎉</p>
                        ) : (
                          <>
                            <div className="notification-list">
                              {notifications.slice(0, 5).map((n) => (
                                <div key={n._id}
                                  className={`notification-item${!n.isRead ? " unread" : ""}`}>
                                  <span onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(n.link);
                                    setShowNotifications(false);
                                  }}>
                                    {n.message}
                                  </span>
                                  <button className="dismiss-btn"
                                    onClick={(e) => { e.stopPropagation(); markOneAsRead(n._id); }}>
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                            <div className="view-all-notifications"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNavigation("/notifications");
                              }}>
                              View all notifications →
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <button className="btn-logout" onClick={handleLogout}>Logout</button>

                </div>
              )}
            </div>
          </div>

        </div>
      </nav>
    );
  }