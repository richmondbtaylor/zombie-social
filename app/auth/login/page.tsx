"use client";

import { useState } from "react";
import { signInWithEmail } from "@/lib/useMe";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await signInWithEmail(email);
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: "80px auto", padding: 24 }}>
      <h1>Sign in</h1>
      <p className="sub">Enter your email to receive a magic link.</p>
      {sent ? (
        <div className="card">
          <strong>Check your email</strong>
          <p className="muted">We sent a sign-in link to {email}.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="stack">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
            />
          </label>
          <button type="submit">Send magic link</button>
          {error && <div className="error">{error}</div>}
        </form>
      )}
    </div>
  );
}
