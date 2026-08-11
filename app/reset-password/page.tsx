"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const MIN_PASSWORD_LENGTH = 8;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      // The most common real-world case here: the recovery link was valid
      // for the callback exchange but has since expired by the time the
      // user actually submits the form (they left the tab open a while).
      setError(error.message);
      return;
    }

    setDone(true);
    setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 1800);
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
          Set a new password
        </h1>

        {done ? (
          <p style={{ color: "rgb(var(--accent))", fontSize: 14, marginTop: 16, lineHeight: 1.6 }}>
            Password updated — taking you to LifeOS...
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <p style={{ color: "rgb(var(--text-muted))", fontSize: 14, marginBottom: 24 }}>
              Choose a new password for your account.
            </p>

            <label style={{ display: "block", fontSize: 13, color: "rgb(var(--text-muted))", marginBottom: 6 }}>
              New password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              minLength={MIN_PASSWORD_LENGTH}
              style={inputStyle}
            />

            <label style={{ display: "block", fontSize: 13, color: "rgb(var(--text-muted))", margin: "16px 0 6px" }}>
              Confirm password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={MIN_PASSWORD_LENGTH}
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
              {loading ? "Updating..." : "Update password"}
            </button>
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