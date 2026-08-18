"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type StaffRole = "ADMIN" | "WAITER";

type StaffShellProps = {
  children: ReactNode;
  role: StaffRole;
  name: string;
};

type NavigationItem = readonly [
  href: string,
  icon: string,
  label: string,
];

export default function StaffShell({
  children,
  role,
  name,
}: StaffShellProps) {
  const path = usePathname();
  const router = useRouter();

  const links: NavigationItem[] =
    role === "ADMIN"
      ? [
          ["/admin", "▦", "Overview"],
          ["/admin/sales", "◫", "Sales history"],
          ["/admin/employees", "♙", "Employees"],
          ["/admin/menu", "☷", "Menu"],
          ["/admin/tables", "⌗", "Table QR codes"],
        ]
      : [["/waiter", "▦", "My tables"]];

  function isActive(href: string) {
    if (href === "/admin" || href === "/waiter") {
      return path === href;
    }

    return path.startsWith(href);
  }

  async function logout() {
    await createClient().auth.signOut();

    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="ops-shell">
      <aside>
        <Link
          href={role === "ADMIN" ? "/admin" : "/waiter"}
          className="ops-logo"
        >
          UZUNGUNI
          <small>CITY PARK</small>
        </Link>

        <div className="role-label">
          {role === "ADMIN"
            ? "ADMINISTRATION"
            : "WAITER WORKSPACE"}
        </div>

        <nav>
          {links.map(([href, icon, label]) => (
            <Link
              key={href}
              href={href}
              className={isActive(href) ? "active" : ""}
            >
              <span>{icon}</span>
              {label}
            </Link>
          ))}
        </nav>

        <div className="ops-user">
          <b>{name}</b>

          <small>
            {role === "ADMIN"
              ? "Administrator"
              : "Cashier / Waiter"}
          </small>

          <button onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="ops-main">
        {children}
      </main>
    </div>
  );
}