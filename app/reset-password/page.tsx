"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, AlertCircle, CheckCircle2, KeyRound, ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import AppLogo from "@/components/AppLogo";

type Stage = "waiting" | "form" | "success" | "invalid";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [stage,           setStage]           = useState<Stage>("waiting");
  const [password,        setPassword]        = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword,    setShowPassword]    = useState(false);
  const [error,           setError]           = useState("");
  const [loading,         setLoading]         = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setStage((prev) => (prev === "waiting" ? "invalid" : prev));
    }, 6000);

    // Supabase fires PASSWORD_RECOVERY when it detects the recovery token in the URL.
    // Subscribe first so we don't miss the event.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setStage("form");
        clearTimeout(timeout);
      }
    });

    // The PASSWORD_RECOVERY event above can fire before this useEffect subscribes
    // (detectSessionInUrl: true in lib/supabase.ts makes the client parse the URL
    // and exchange it automatically — for BOTH the implicit hash token and a PKCE
    // `?code=` — as soon as the client initializes, which can happen as early as
    // lib/supabase.ts being imported by AuthGuard higher up the tree). As a
    // fallback, check whether a session already exists rather than re-processing
    // the URL ourselves: a PKCE `code` is one-time-use, so calling
    // exchangeCodeForSession here again — after the client's own automatic
    // exchange already redeemed it — just fails against an already-consumed code
    // and wrongly reports the (perfectly valid) link as expired.
    const hash   = new URLSearchParams(window.location.hash.slice(1));
    const search = new URLSearchParams(window.location.search);

    // A genuinely expired/used link redirects back here with ?error=... (e.g.
    // error_code=otp_expired) instead of a code — no point waiting out the
    // timeout for this case, Supabase already told us it's invalid.
    if (search.get("error") || hash.get("error")) {
      clearTimeout(timeout);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStage("invalid");
      return;
    }

    const hasRecoveryParams = hash.get("type") === "recovery" || !!search.get("code");

    if (hasRecoveryParams) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          clearTimeout(timeout);
          setStage((prev) => (prev === "waiting" ? "form" : prev));
        }
      });
    }

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
    } else {
      setStage("success");
      setTimeout(() => router.replace("/login"), 3000);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-blue-50 via-white to-emerald-50">
      <div className="w-full max-w-md">

        {/* Branding */}
        <div className="text-center mb-8">
          <div className="relative inline-flex mb-5">
            <div className="absolute inset-0 bg-blue-400/25 blur-2xl rounded-full scale-[1.6]" />
            <AppLogo size="xl" className="relative shadow-xl shadow-blue-300/50" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 mb-1">
            Travel<span className="bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">ries</span>
          </h1>
          <p className="text-slate-500 text-sm">Set a new password</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-8">

          {/* Waiting for token */}
          {stage === "waiting" && (
            <div className="text-center py-6">
              <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-slate-500">Verifying your reset link…</p>
            </div>
          )}

          {/* Invalid / expired link */}
          {stage === "invalid" && (
            <div className="text-center py-4">
              <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={28} className="text-red-500" />
              </div>
              <h2 className="text-lg font-extrabold text-slate-900 mb-2">Link expired</h2>
              <p className="text-sm text-slate-500 mb-6">
                This password reset link is invalid or has expired. Please request a new one.
              </p>
              <Link
                href="/forgot-password"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors"
              >
                Request new link
              </Link>
              <div className="mt-4">
                <Link href="/login" className="text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors inline-flex items-center gap-1">
                  <ArrowLeft size={14} /> Back to sign in
                </Link>
              </div>
            </div>
          )}

          {/* New password form */}
          {stage === "form" && (
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              <p className="text-sm text-slate-500 mb-1">
                Choose a strong password of at least 6 characters.
              </p>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-2">
                  New password
                </label>
                <div className="relative">
                  <input
                    id="password" type={showPassword ? "text" : "password"} value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••" autoComplete="new-password" autoFocus
                    className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                  <button
                    type="button" onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirm" className="block text-sm font-semibold text-slate-700 mb-2">
                  Confirm new password
                </label>
                <input
                  id="confirm" type={showPassword ? "text" : "password"} value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••" autoComplete="new-password"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>

              {error && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm font-medium">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit" disabled={loading}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-bold tracking-wide transition-all ${
                  loading ? "bg-blue-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 active:scale-[0.98]"
                }`}
              >
                <KeyRound size={16} />
                {loading ? "Saving…" : "Set new password"}
              </button>
            </form>
          )}

          {/* Success */}
          {stage === "success" && (
            <div className="text-center py-4">
              <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={28} className="text-emerald-600" />
              </div>
              <h2 className="text-lg font-extrabold text-slate-900 mb-2">Password updated!</h2>
              <p className="text-sm text-slate-500 mb-6">
                Your password has been changed. Redirecting you to sign in…
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
              >
                <ArrowLeft size={15} /> Go to sign in
              </Link>
            </div>
          )}

        </div>

        <p className="text-center mt-5 text-xs text-slate-400">
          Travelries · Photo Map &amp; Face Detection
        </p>
      </div>
    </main>
  );
}
