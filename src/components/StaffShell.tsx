"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function StaffShell({ children, role, name }: { children: React.ReactNode; role: "ADMIN" | "WAITER"; name: string }) {
  const path = usePathname(); const router = useRouter();
  const links = role === "ADMIN"
    ? [["/admin", "▦", "Overview"], ["/admin/employees", "♙", "Employees"], ["/admin/tables", "⌗", "Table QR codes"]]
    : [["/waiter", "▦", "My tables"]];
  async function logout() { await createClient().auth.signOut(); router.replace("/login"); router.refresh(); }
  return <div className="ops-shell">
    <aside>
      <Link href={role === "ADMIN" ? "/admin" : "/waiter"} className="ops-logo">UZUNGUNI<small>CITY PARK</small></Link>
      <div className="role-label">{role === "ADMIN" ? "ADMINISTRATION" : "WAITER WORKSPACE"}</div>
      <nav>{links.map(([href, icon, label]) => <Link key={href} href={href} className={path === href ? "active" : ""}><span>{icon}</span>{label}</Link>)}</nav>
      <div className="ops-user"><b>{name}</b><small>{role === "ADMIN" ? "Administrator" : "Cashier / Waiter"}</small><button onClick={logout}>Sign out</button></div>
    </aside>
    <main className="ops-main">{children}</main>
  </div>;
}
