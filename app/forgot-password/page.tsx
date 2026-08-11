"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// useSearchParams() needs a Suspense boundary at build time, same reason
// as the login page — see the comment there for the full explanation.
export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordForm />
    </Suspense>
  );
}

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const linkExpired = searchParams.get("error") === "link_expired";

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    // Deliberately show the same success state whether or not the email
    // actually matches an account — confirming which emails exist in the
    // system is an information leak on an otherwise single-user app.
    setSent(true);
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgb(var(--bg))",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 360,
          background: "rgb(var(--surface))",
          border: "1px solid rgb(var(--border))",
          borderRadius: 12,
          padding: 32,
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-fraunces)",
            fontSize: 24,
            marginBottom: 4,
            color: "rgb(var(--text))",
          }}
        >
          Reset password
        </h1>

        {sent ? (
          <>
            <p style={{ color: "rgb(var(--text-muted))", fontSize: 14, marginTop: 12, lineHeight: 1.6 }}>
              If <strong style={{ color: "rgb(var(--text))" }}>{email}</strong> is a LifeOS account, a reset
              link is on its way. Check your inbox (and spam folder) — the link is valid for a limited time.
            </p>
            <Link
              href="/login"
              style={{ display: "inline-block", marginTop: 20, fontSize: 13, color: "rgb(var(--accent))" }}
            >
              ← Back to sign in
            </Link>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <p style={{ color: "rgb(var(--text-muted))", fontSize: 14, marginBottom: 24 }}>
              Enter your account email and we'll send you a link to set a new password.
            </p>

            {linkExpired && (
              <p style={{ color: "rgb(var(--danger))", fontSize: 13, marginBottom: 16 }}>
                That reset link expired or was already used — request a new one below.
              </p>
            )}

            <label style={{ display: "block", fontSize: 13, color: "rgb(var(--text-muted))", marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              style={inputStyle}
            />

            {error && <p style={{ color: "rgb(var(--danger))", fontSize: 13, marginTop: 12 }}>{error}</p>}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                marginTop: 20,
                padding: "10px 16px",
                borderRadius: 8,
                border: "none",
                background: "rgb(var(--accent))",
                color: "rgb(var(--bg))",
                fontWeight: 600,
                cursor: loading ? "default" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Sending..." : "Send reset link"}
            </button>

            <Link
              href="/login"
              style={{ display: "inline-block", marginTop: 16, fontSize: 13, color: "rgb(var(--text-muted))" }}
            >
              ← Back to sign in
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid rgb(var(--border))",
  background: "rgb(var(--surface-2))",
  color: "rgb(var(--text))",
  fontSize: 14,
  outline: "none",
};