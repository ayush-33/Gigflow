import { useNavigate } from "react-router-dom";
import "../styles/NotFound.css";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="notfound-page">
      <div className="notfound-card">
        <div className="notfound-icon">🛸</div>
        <h1 className="notfound-title">404 - Page Not Found</h1>
        <p className="notfound-text">
          Oops! The page you are looking for does not exist, has been removed, or is temporarily unavailable.
        </p>
        <button className="btn-primary" onClick={() => navigate("/")}>
          Back to Home
        </button>
      </div>
    </div>
  );
}
