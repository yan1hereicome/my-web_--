"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, Eye, EyeOff, AlertCircle, LogIn, KeyRound } from "lucide-react";

const DEMO_EMAIL    = "demo@travellens.com";
const DEMO_PASSWORD = "travellens123";

export default function LoginPage() {
  const router = useRouter();
  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [error,        setError]        = useState("");
  const [loading,      setLoading]      = useState(false);
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
    <main className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-blue-50 via-white to-emerald-50">
      <div className="w-full max-w-md">

        {/* Branding */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
            <Globe size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 mb-1">TravelLens</h1>
          <p className="text-slate-500 text-sm">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-8">
          <form onSubmit={handleSubmit} noValidate className="space-y-5">

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="demo@travellens.com"
                autoComplete="email"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm font-medium">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-bold tracking-wide transition-all ${
                loading
                  ? "bg-blue-300 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 active:scale-[0.98]"
              }`}
            >
              <LogIn size={16} />
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        {/* Demo credentials */}
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <KeyRound size={15} className="text-amber-600" />
            <p className="text-sm font-bold text-amber-800">Demo account</p>
          </div>
          <p className="text-sm text-amber-700 leading-relaxed">
            Email: <strong>demo@travellens.com</strong><br />
            Password: <strong>travellens123</strong>
          </p>
        </div>

        <p className="text-center mt-5 text-xs text-slate-400">
          TravelLens · Photo Map &amp; Face Detection
        </p>
      </div>
    </main>
  );
}
