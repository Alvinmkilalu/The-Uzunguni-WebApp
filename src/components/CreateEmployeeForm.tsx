"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateEmployeeForm() {
  const router = useRouter(); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const body = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/admin/employees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json(); setBusy(false);
    if (!response.ok) { setMessage(`⚠ ${result.error}`); return; }
    setMessage("✓ Employee account created. Hand the email and temporary password to the employee privately.");
    event.currentTarget.reset(); router.refresh();
  }
  return <form className="form-grid" onSubmit={submit}>
    <label>Full name<input name="fullName" required placeholder="Neema Joseph" /></label>
    <label>Username<input name="username" required pattern="[a-zA-Z0-9._-]{3,30}" placeholder="neema.j" /></label>
    <label>Email address<input name="email" type="email" required placeholder="neema@uzunguni.co.tz" /></label>
    <label>Temporary password<input name="password" type="password" required minLength={8} placeholder="Minimum 8 characters" /></label>
    <div className="form-footer"><button className="staff-button" disabled={busy}>{busy ? "Creating…" : "Create waiter account"}</button>{message && <p className={message.startsWith("⚠") ? "form-error" : "form-success"}>{message}</p>}</div>
  </form>;
}
