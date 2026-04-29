import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/api";
import "../styles/Auth.css";

function getPasswordStrength(pw) {
  if (!pw) return { score: 0, label: "", color: "transparent", width: "0%" };
  let score = 0;
  if (pw.length >= 8)           score++;
  if (/[A-Z]/.test(pw))         score++;
  if (/[0-9]/.test(pw))         score++;
  if (/[^A-Za-z0-9]/.test(pw))  score++;

  const map = [
    { label: "",        color: "transparent",    width: "0%"   },
    { label: "Weak",    color: "#ef4444",         width: "25%"  },
    { label: "Fair",    color: "#f59e0b",         width: "50%"  },
    { label: "Good",    color: "#3b82f6",         width: "75%"  },
    { label: "Strong",  color: "#22c55e",         width: "100%" },
  ];
  return map[score];
}

export default function Signup() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullName: "", email: "", password: "", confirmPassword: "",
  });
  const [loading, setLoading]   = useState(false);
  const [error,   setError]     = useState("");

  const handleChange = (e) => {
    setError("");
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const strength = getPasswordStrength(formData.password);

  const handleSubmit = async (e) => {
  e.preventDefault();
  setError("");

  if (formData.password !== formData.confirmPassword) {
    setError("Passwords do not match.");
    return;
  }

  if (formData.password.length < 6) {
    setError("Password must be at least 6 characters.");
    return;
  }

  setLoading(true);

  try {
    await api.post("/auth/register", {
      name: formData.fullName,
      email: formData.email,
      password: formData.password,
    });

    navigate("/login");

  } catch (err) {
    setError(
      err.response?.data?.message || "Signup failed. Please try again."
    );
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="auth-page">
      <div className="auth-card">

        {/* Logo */}
        <div className="auth-logo">
          <span className="auth-logo-text">GigFlow</span>
        </div>

        {/* Header */}
        <div className="auth-header">
          <h1>Create your account</h1>
          <p>Join GigFlow and start your freelance journey</p>
        </div>

        {/* Form */}
        <form className="auth-form" onSubmit={handleSubmit}>

          <div className="form-group">
            <label htmlFor="fullName">Full name</label>
            <div className="input-wrapper">
              <span className="input-icon">👤</span>
              <input
                id="fullName"
                type="text"
                name="fullName"
                placeholder="John Doe"
                value={formData.fullName}
                onChange={handleChange}
                required
                autoComplete="name"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email">Email address</label>
            <div className="input-wrapper">
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
            <div className="input-wrapper">
              <span className="input-icon">🔒</span>
              <input
                id="password"
                type="password"
                name="password"
                placeholder="Create a strong password"
                value={formData.password}
                onChange={handleChange}
                required
                autoComplete="new-password"
              />
            </div>
            {formData.password && (
              <div className="password-strength">
                <div className="strength-bar">
                  <div
                    className="strength-fill"
                    style={{ width: strength.width, background: strength.color }}
                  />
                </div>
                <span
                  className="strength-label"
                  style={{ color: strength.color }}
                >
                  {strength.label}
                </span>
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm password</label>
            <div className="input-wrapper">
              <span className="input-icon">🔑</span>
              <input
                id="confirmPassword"
                type="password"
                name="confirmPassword"
                placeholder="Repeat your password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                autoComplete="new-password"
              />
            </div>
          </div>

          {error && (
            <p className="form-error">⚠ {error}</p>
          )}

          <button
            type="submit"
            className="btn-auth"
            disabled={loading}
          >
            {loading ? "Creating account…" : "Create Account →"}
          </button>

        </form>

        <div className="auth-divider" />

        <div className="auth-footer">
          Already have an account?{" "}
          <Link to="/login">Sign in</Link>
        </div>

      </div>
    </div>
  );
}