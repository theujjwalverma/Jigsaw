import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../services/api";

export function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    api
      .get("/auth/session")
      .then(() => {
        if (!cancelled) {
          navigate("/admin", { replace: true });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCheckingSession(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await api.post("/auth/login", { password });
      navigate("/admin", { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || "Incorrect admin password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <section className="page login-page">
        <p className="muted">Verifying host session...</p>
      </section>
    );
  }

  return (
    <section className="page login-page">
      <div className="clay-illustration" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>

      <p className="eyebrow">HOST PORTAL</p>
      <h1>Host Login</h1>
      <p className="subtitle">
        Enter your admin password to create, manage, and run tournament rooms.
      </p>

      <form onSubmit={handleLogin} className="login-form">
        <label htmlFor="admin-password">Admin Password</label>
        <div className="login-input-wrapper">
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            placeholder="Enter admin password"
            autoFocus
            required
            autoComplete="current-password"
          />
          <button type="submit" disabled={isLoading || !password.trim()}>
            {isLoading ? "Logging in..." : "Log In & Continue"}
          </button>
        </div>
      </form>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="login-footer">
        <Link to="/" className="accent-link">
          &larr; Back to Join Tournament
        </Link>
      </div>
    </section>
  );
}
