"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Table = { id: string; table_number: number; label: string };
type Session = { id: string; table_id: string; status: string; opened_at: string };

export default function WaiterDashboard({ tables, sessions }: { tables: Table[]; sessions: Session[] }) {
  const router = useRouter(); const [selected, setSelected] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const occupied = new Set(sessions.map(s => s.table_id));
  async function start() {
    if (!selected) return; setBusy(true); setError("");
    const response = await fetch("/api/tables/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tableId: selected }) });
    const result = await response.json(); setBusy(false);
    if (!response.ok) { setError(result.error); return; }
    router.push(`/waiter/table/${result.id}`); router.refresh();
  }
  return <>
    <section className="start-strip"><div><b>Initiate another table</b><span>Choose a free table to begin entering its order.</span></div><select value={selected} onChange={e => setSelected(e.target.value)}><option value="">Select free table…</option>{tables.filter(t => !occupied.has(t.id)).map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select><button className="staff-button" onClick={start} disabled={!selected || busy}>{busy ? "Starting…" : "Start table"}</button></section>
    {error && <p className="form-error">⚠ {error}</p>}
    <div className="waiter-table-grid">{sessions.length ? sessions.map(session => { const table = tables.find(t => t.id === session.table_id); return <button key={session.id} onClick={() => router.push(`/waiter/table/${session.id}`)} className="waiter-table-card"><div><span>{table?.label || "Table"}</span><span className="status-chip pending">● {session.status.replaceAll("_"," ")}</span></div><b>Open workspace →</b><small>Started {new Date(session.opened_at).toLocaleString()}</small></button>; }) : <div className="empty-state"><b>No tables initiated yet</b><span>Choose a free table above to begin serving.</span></div>}</div>
  </>;
}
