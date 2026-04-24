"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DEMO_EMAIL = "demo@travellens.com";
const DEMO_PASSWORD = "travellens123";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    setTimeout(() => {
      if (email.trim() === DEMO_EMAIL && password === DEMO_PASSWORD) {
        localStorage.setItem("tl_auth", JSON.stringify({ email, loggedInAt: Date.now() }));
        router.push("/");
      } else {
        setError("Incorrect email or password. Try the demo account below.");
        setLoading(false);
      }
    }, 600);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #eff6ff 0%, #f8fafc 50%, #f0fdf4 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: "420px" }}>

        {/* Logo / Branding */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              background: "#2563eb",
              borderRadius: "18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "30px",
              margin: "0 auto 16px",
              boxShadow: "0 8px 24px rgba(37,99,235,0.3)",
            }}
          >
            🌍
          </div>
          <h1 style={{ fontSize: "28px", fontWeight: 800, color: "#0f172a", margin: "0 0 6px" }}>
            TravelLens
          </h1>
          <p style={{ color: "#64748b", fontSize: "15px", margin: 0 }}>
            Sign in to your account
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            background: "white",
            borderRadius: "20px",
            padding: "32px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
            border: "1px solid #e2e8f0",
          }}
        >
          <form onSubmit={handleSubmit} noValidate>

            {/* Email */}
            <div style={{ marginBottom: "18px" }}>
              <label
                htmlFor="email"
                style={{ display: "block", fontWeight: 700, fontSize: "14px", color: "#334155", marginBottom: "8px" }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="demo@travellens.com"
                autoComplete="email"
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  borderRadius: "10px",
                  border: "1.5px solid #cbd5e1",
                  fontSize: "15px",
                  outline: "none",
                  boxSizing: "border-box",
                  color: "#0f172a",
                  background: "#f8fafc",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#2563eb")}
                onBlur={(e) => (e.target.style.borderColor = "#cbd5e1")}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: "24px" }}>
              <label
                htmlFor="password"
                style={{ display: "block", fontWeight: 700, fontSize: "14px", color: "#334155", marginBottom: "8px" }}
              >
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  style={{
                    width: "100%",
                    padding: "11px 44px 11px 14px",
                    borderRadius: "10px",
                    border: "1.5px solid #cbd5e1",
                    fontSize: "15px",
                    outline: "none",
                    boxSizing: "border-box",
                    color: "#0f172a",
                    background: "#f8fafc",
                    transition: "border-color 0.15s",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#2563eb")}
                  onBlur={(e) => (e.target.style.borderColor = "#cbd5e1")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "16px",
                    color: "#94a3b8",
                    padding: "2px",
                    lineHeight: 1,
                  }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "10px",
                  padding: "12px 14px",
                  marginBottom: "18px",
                  color: "#dc2626",
                  fontSize: "14px",
                  fontWeight: 600,
                }}
              >
                ⚠️ {error}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "13px",
                background: loading ? "#93c5fd" : "#2563eb",
                color: "white",
                border: "none",
                borderRadius: "10px",
                fontSize: "16px",
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                transition: "background 0.15s",
                letterSpacing: "0.01em",
              }}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        {/* Demo credentials hint */}
        <div
          style={{
            marginTop: "20px",
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: "14px",
            padding: "16px 18px",
          }}
        >
          <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: "13px", color: "#92400e" }}>
            🔑 Demo account
          </p>
          <p style={{ margin: 0, fontSize: "13px", color: "#78350f", lineHeight: 1.6 }}>
            Email: <strong>demo@travellens.com</strong><br />
            Password: <strong>travellens123</strong>
          </p>
        </div>

        <p style={{ textAlign: "center", marginTop: "20px", fontSize: "13px", color: "#94a3b8" }}>
          TravelLens · Photo Map &amp; Face Detection
        </p>
      </div>
    </main>
  );
}
