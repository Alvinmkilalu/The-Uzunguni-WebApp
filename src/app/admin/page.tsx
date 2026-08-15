import Link from "next/link";
import StaffShell from "@/components/StaffShell";
import { requireStaff } from "@/lib/auth";

export default async function AdminDashboard() {
  const { supabase, profile } = await requireStaff("ADMIN");
  const [{ data: tables }, { data: sessions }, { data: staff }] = await Promise.all([
    supabase.from("dining_tables").select("id,table_number,label").order("table_number"),
    supabase.from("table_sessions").select("id,table_id,status,waiter_id,opened_at"),
    supabase.from("profiles").select("id,full_name,role,is_active")
  ]);
  const active = (sessions || []).filter(s => s.status !== "CLOSED" && s.status !== "CANCELLED");
  const sessionByTable = new Map(active.map(s => [s.table_id, s]));
  const waiterById = new Map((staff || []).map(s => [s.id, s.full_name]));
  return <StaffShell role="ADMIN" name={profile.full_name}>
    <header className="ops-header"><div><p className="eyebrow">DODOMA BRANCH · LIVE OPERATIONS</p><h1>Administrator overview</h1><p>All table activity and employee access in one place.</p></div><Link className="staff-button" href="/admin/employees">+ Add employee</Link></header>
    <section className="metric-grid">
      <article><span>Active tables</span><b>{active.length}</b><small>of {tables?.length || 40}</small></article>
      <article><span>Waiter accounts</span><b>{(staff || []).filter(s => s.role === "WAITER" && s.is_active).length}</b><small>currently active</small></article>
      <article><span>Part paid</span><b>{active.filter(s => s.status === "PARTIALLY_PAID").length}</b><small>need attention</small></article>
      <article><span>Ready to close</span><b>{active.filter(s => s.status === "SETTLED").length}</b><small>fully settled</small></article>
    </section>
    <section className="content-card"><div className="card-heading"><div><p className="eyebrow">40-TABLE FLOOR</p><h2>Table status</h2></div><span className="status-chip neutral">● Live database</span></div>
      <div className="admin-table-grid">{(tables || []).map(table => { const s = sessionByTable.get(table.id); const body = <><span>{table.label}</span><b>{s ? s.status.replaceAll("_"," ") : "FREE"}</b><small>{s ? `Opened by ${waiterById.get(s.waiter_id) || "staff"} · Open →` : "Ready to initiate"}</small></>; return s ? <Link href={`/waiter/table/${s.id}`} key={table.id} className="mini-table busy">{body}</Link> : <article key={table.id} className="mini-table">{body}</article>; })}</div>
    </section>
  </StaffShell>;
}
