"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError || !data.user) { setError(authError?.message || "Login failed"); setBusy(false); return; }
    const { data: profile } = await supabase.from("profiles").select("role,is_active").eq("id", data.user.id).single();
    if (!profile?.is_active) { await supabase.auth.signOut(); setError("This staff account is inactive."); setBusy(false); return; }
    router.replace(profile.role === "ADMIN" ? "/admin" : "/waiter"); router.refresh();
  }

  return <form onSubmit={submit} className="login-form">
    <label>Email address<input name="email" type="email" required autoComplete="email" placeholder="staff@uzunguni.co.tz" /></label>
    <label>Password<input name="password" type="password" required autoComplete="current-password" placeholder="Enter your password" /></label>
    {error && <p className="form-error" role="alert">⚠ {error}</p>}
    <button className="primary" disabled={busy}>{busy ? "Signing in…" : "Sign in securely"}</button>
  </form>;
}
