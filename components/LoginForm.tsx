"use client";

import { useState } from "react";
import { ArrowRight, LockKeyhole, TrendingUp } from "lucide-react";

export default function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not sign in.");
      window.location.href = "/";
    } catch (error) { setError((error as Error).message); setBusy(false); }
  }

  return <main className="login-page"><div className="login-card"><div className="login-brand"><span className="brand-mark"><TrendingUp size={21} strokeWidth={2.7} /></span><span>Lead<span>Flow</span></span></div><span className="login-icon"><LockKeyhole size={22} /></span><h1>Welcome back</h1><p>Sign in to your lead workspace.</p><form onSubmit={submit}><label>Username<input autoComplete="username" required value={username} onChange={(event) => setUsername(event.target.value)} /></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error && <div className="form-error" role="alert">{error}</div>}<button type="submit" className="button button-primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}<ArrowRight size={16} /></button></form></div></main>;
}
