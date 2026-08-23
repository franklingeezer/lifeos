"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Loader2, Mail, Lock, ArrowRight, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// useSearchParams() has to be wrapped in a Suspense boundary or `next build`
// fails while trying to statically prerender this page — dev mode doesn't
// enforce this, which is why it can pass locally and only break on build.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) {
      setError(error.message === "Invalid login credentials" ? "Wrong email or password." : error.message);
      return;
    }

    const next = searchParams.get("next") || "/";
    router.push(next);
    router.refresh();
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "rgb(var(--bg))",
        padding: 24,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* dangerouslySetInnerHTML, not a JSX text child, on purpose — this
          CSS contains content: "" (for the .lifeos-login-link::after
          underline), and a literal quote character inside a JSX-
          interpolated <style>{`...`}</style> block gets HTML-escaped
          differently server-side (&quot;&quot;) than the client's own
          re-render of the same template string, producing a genuine,
          deterministic "text content does not match" hydration error on
          every load — not a caching artifact like the earlier issues in
          this thread. Writing the raw string via dangerouslySetInnerHTML
          skips JSX's escaping step entirely, so server and client end up
          with byte-identical text. Other pages using the same inline
          <style>{`...`}</style> pattern (e.g. Dashboard) don't hit this,
          because none of their CSS contains a quote character. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes lifeosFadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .lifeos-login-hero { animation: lifeosFadeUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .lifeos-login-card { animation: lifeosFadeUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both; }
        .lifeos-login-input-wrap { transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease; }
        .lifeos-login-input-wrap:focus-within { border-color: rgb(var(--accent) / 0.5) !important; box-shadow: 0 0 0 3px rgb(var(--accent) / 0.1); background: rgb(var(--surface)) !important; }
        .lifeos-login-input { color: rgb(var(--text)); }
        .lifeos-login-btn { transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease; }
        .lifeos-login-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgb(var(--accent) / 0.25); }
        .lifeos-login-btn:active:not(:disabled) { transform: translateY(0); filter: brightness(0.96); }
        .lifeos-login-link { position: relative; }
        .lifeos-login-link::after {
          content: ""; position: absolute; left: 0; right: 0; bottom: -2px; height: 1px;
          background: rgb(var(--accent)); transform: scaleX(0); transform-origin: right; transition: transform 0.2s ease;
        }
        .lifeos-login-link:hover::after { transform: scaleX(1); transform-origin: left; }
        @keyframes lifeosBreathe { 0%, 100% { opacity: 0.7; transform: scale(1); } 50% { opacity: 1; transform: scale(1.08); } }
        @keyframes lifeosDrift1 { 0% { transform: translate(0, 0); opacity: 0; } 15% { opacity: 0.5; } 85% { opacity: 0.5; } 100% { transform: translate(-18px, -140px); opacity: 0; } }
        @keyframes lifeosDrift2 { 0% { transform: translate(0, 0); opacity: 0; } 15% { opacity: 0.4; } 85% { opacity: 0.4; } 100% { transform: translate(22px, -170px); opacity: 0; } }
        .lifeos-login-halo { animation: lifeosBreathe 3.6s ease-in-out infinite; }
        .lifeos-particle-a { animation: lifeosDrift1 9s ease-in-out infinite; }
        .lifeos-particle-b { animation: lifeosDrift2 11s ease-in-out infinite 2.5s; }
        @media (prefers-reduced-motion: reduce) {
          .lifeos-login-halo, .lifeos-particle-a, .lifeos-particle-b { animation: none; }
        }
      `,
        }}
      />

      {/* One soft, centered glow — quiet ambience, not a light show. This
          is the entire "premium" strategy for the background: restraint,
          plus a very fine grain texture for material depth. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "34%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 680,
          height: 620,
          borderRadius: "48% 52% 55% 45% / 45% 48% 52% 55%",
          background: "radial-gradient(circle, rgb(var(--accent) / 0.09), transparent 70%)",
          pointerEvents: "none",
        }}
      />
      {/* A second, smaller, warmer glow off to one side — the pairing of
          teal + gold echoes the app's own theme tokens (Dashboard's
          priority dots, the login card's own top hairline later on) and
          keeps the canvas from reading as one flat, single-color wash. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "62%",
          left: "68%",
          transform: "translate(-50%, -50%)",
          width: 380,
          height: 340,
          borderRadius: "55% 45% 48% 52% / 52% 55% 45% 48%",
          background: "radial-gradient(circle, rgb(var(--gold) / 0.07), transparent 72%)",
          pointerEvents: "none",
        }}
      />
      {/* A couple of very faint particles, slowly drifting upward and
          fading — the one place motion carries the "interesting" feeling
          rather than a static shape. Kept to two, small, and slow, so it
          reads as ambient life rather than a snow/confetti effect. */}
      <div
        aria-hidden
        className="lifeos-particle-a"
        style={{ position: "absolute", top: "58%", left: "28%", width: 4, height: 4, borderRadius: "50%", background: "rgb(var(--accent) / 0.7)", pointerEvents: "none" }}
      />
      <div
        aria-hidden
        className="lifeos-particle-b"
        style={{ position: "absolute", top: "64%", left: "74%", width: 3, height: 3, borderRadius: "50%", background: "rgb(var(--gold) / 0.7)", pointerEvents: "none" }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.4,
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E\")",
          pointerEvents: "none",
        }}
      />

      <div className="lifeos-login-hero" style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 32 }}>
        <div style={{ position: "relative", marginBottom: 20 }}>
          <div
            aria-hidden
            className="lifeos-login-halo"
            style={{ position: "absolute", inset: -14, borderRadius: "50%", background: "radial-gradient(circle, rgb(var(--accent) / 0.2), transparent 70%)" }}
          />
          <img
            src="/icons/icon-192.png"
            alt=""
            width={48}
            height={48}
            style={{ position: "relative", borderRadius: 16, boxShadow: "0 10px 30px rgb(0 0 0 / 0.35)" }}
          />
        </div>
        <h1 className="font-display" style={{ fontSize: 30, fontWeight: 500, color: "rgb(var(--text))", letterSpacing: -0.3, marginBottom: 8 }}>
          LifeOS
        </h1>
        <p style={{ color: "rgb(var(--text-muted))", fontSize: 14 }}>Sign in to your personal operating system.</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="lifeos-login-card"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 404,
          background: "rgb(var(--surface))",
          border: "1px solid rgb(var(--border))",
          borderRadius: 24,
          padding: "34px 32px 30px",
          boxShadow: "0 24px 60px rgb(0 0 0 / 0.35)",
        }}
      >
        <label style={{ display: "block", fontSize: 13, color: "rgb(var(--text-muted))", marginBottom: 8, fontWeight: 500 }}>Email</label>
        <div className="lifeos-login-input-wrap" style={inputWrapStyle}>
          <Mail size={17} color="rgb(var(--text-muted))" style={{ flexShrink: 0 }} />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus className="lifeos-login-input" style={inputStyle} />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "20px 0 8px" }}>
          <label style={{ fontSize: 13, color: "rgb(var(--text-muted))", fontWeight: 500 }}>Password</label>
          <Link href="/forgot-password" className="lifeos-login-link" style={{ fontSize: 12.5, color: "rgb(var(--accent))" }}>
            Forgot password?
          </Link>
        </div>
        <div className="lifeos-login-input-wrap" style={inputWrapStyle}>
          <Lock size={17} color="rgb(var(--text-muted))" style={{ flexShrink: 0 }} />
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="lifeos-login-input"
            style={inputStyle}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", flexShrink: 0, display: "flex" }}
          >
            {showPassword ? <EyeOff size={15} color="rgb(var(--text-muted))" /> : <Eye size={15} color="rgb(var(--text-muted))" />}
          </button>
        </div>

        {error && (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 16, padding: 12, borderRadius: 10, background: "rgb(var(--danger) / 0.1)", border: "1px solid rgb(var(--danger) / 0.3)" }}>
            <AlertCircle size={14} color="rgb(var(--danger))" style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 12.5, color: "rgb(var(--danger))", lineHeight: 1.5 }}>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="lifeos-login-btn"
          style={{
            width: "100%",
            marginTop: 28,
            padding: "16px 16px",
            borderRadius: 14,
            border: "none",
            background: "rgb(var(--accent))",
            color: "rgb(var(--bg))",
            fontWeight: 600,
            fontSize: 15.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.75 : 1,
          }}
        >
          {loading ? <Loader2 size={16} className="spin" /> : (<>Sign in <ArrowRight size={15} /></>)}
        </button>

        <div style={{ borderTop: "1px solid rgb(var(--border))", marginTop: 24, paddingTop: 16 }}>
          <p style={{ color: "rgb(var(--text-muted))", fontSize: 12, lineHeight: 1.6 }}>
            No sign-up here — LifeOS is single-user. Create your account from the Supabase
            dashboard under Authentication → Users.
          </p>
        </div>
      </form>
    </main>
  );
}

const inputWrapStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 11,
  padding: "14.5px 16px",
  borderRadius: 14,
  border: "1px solid rgb(var(--border))",
  background: "rgb(var(--surface-2))",
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: "none",
  outline: "none",
  background: "transparent",
  fontSize: 15.5,
};