import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/api";
import "../styles/Auth.css";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const handleChange = (e) => {
    setError("");
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const validate = () => {
  if (!formData.email.trim()) return "Email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
    return "Enter a valid email address.";
  if (!formData.password) return "Password is required.";
  return null;
};

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }

    setLoading(true);
    setError("");

    try {
      // ✅ api.post — no manual headers needed, withCredentials set globally
      const { data } = await api.post("/auth/login", formData);

      // ✅ Backend sends accessToken (not token)
      login(data.accessToken, data.user);

      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">

        <div className="auth-logo">
          <span className="auth-logo-text">GigFlow</span>
        </div>

        <div className="auth-header">
          <h1>Welcome back</h1>
          <p>Sign in to your GigFlow account</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>

          <div className="form-group">
            <label htmlFor="email">Email address</label>
            <div className={`input-wrapper${error && !formData.email ? " input-error" : ""}`}>
              <span className="input-icon">✉️</span>
              <input
                id="email"
                type="email"
                name="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleChange}
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className={`input-wrapper${error && !formData.password ? " input-error" : ""}`}>
              <span className="input-icon">🔒</span>
              <input
                id="password"
                type="password"
                name="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          {error && <p className="form-error">⚠ {error}</p>}

          <button type="submit" className="btn-auth" disabled={loading}>
            {loading ? "Signing in…" : "Sign In →"}
          </button>

        </form>

        <div className="auth-divider" />

        <div className="auth-footer">
          Don't have an account?{" "}
          <Link to="/signup">Create one</Link>
        </div>

      </div>
    </div>
  );
}