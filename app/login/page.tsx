"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
        alignItems: "center",
        justifyContent: "center",
        background: "rgb(var(--bg))",
        padding: 24,
      }}
    >
      <form
        onSubmit={handleSubmit}
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
          LifeOS
        </h1>
        <p style={{ color: "rgb(var(--text-muted))", fontSize: 14, marginBottom: 24 }}>
          Sign in to your personal operating system.
        </p>

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

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "16px 0 6px" }}>
          <label style={{ fontSize: 13, color: "rgb(var(--text-muted))" }}>Password</label>
          <Link href="/forgot-password" style={{ fontSize: 12, color: "rgb(var(--accent))" }}>
            Forgot password?
          </Link>
        </div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={inputStyle}
        />

        {error && (
          <p style={{ color: "rgb(var(--danger))", fontSize: 13, marginTop: 12 }}>{error}</p>
        )}

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
          {loading ? "Signing in..." : "Sign in"}
        </button>

        <p style={{ color: "rgb(var(--text-muted))", fontSize: 12, marginTop: 16 }}>
          No sign-up here — LifeOS is single-user. Create your account from the Supabase
          dashboard under Authentication → Users.
        </p>
      </form>
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