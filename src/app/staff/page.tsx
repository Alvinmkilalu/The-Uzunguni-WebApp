"use client";

import { useState } from "react";

const tables = ["12", "14", "18", "20", "24", "28", "32", "36"];
const money = (n: number) => `TZS ${new Intl.NumberFormat("en-US").format(n)}`;

export default function StaffPage() {
  const [selected, setSelected] = useState("12");
  return <main className="staff-shell"><aside><a className="staff-logo" href="/">UZUNGUNI</a><nav><b>Tables</b><span>Orders</span><span>Payments</span><span>Reports</span></nav><div className="staff-user">AM<br/><small>Cashier</small></div></aside><section className="staff-content"><header><div><p className="eyebrow">STAFF PORTAL</p><h1>Tables</h1></div><button className="staff-button">+ Open table</button></header><p className="muted">24 tables in service · 1 pending payment</p><div className="table-grid">{tables.map((table, index) => <button className={`table-card ${selected === table ? "current" : ""}`} key={table} onClick={() => setSelected(table)}><span>Table {table}</span><b>{index === 0 ? money(106000) : index % 3 === 0 ? "Open" : "Available"}</b><small>{index === 0 ? "Awaiting payment" : index % 3 === 0 ? "2 guests" : "Ready"}</small></button>)}</div><section className="workspace"><div><p className="eyebrow">TABLE {selected} WORKSPACE</p><h2>Current order</h2><div className="order-row"><span>Uzunguni grilled chicken × 1</span><b>TZS 28,000</b></div><div className="order-row"><span>Pilau ya nyama × 1</span><b>TZS 18,000</b></div><div className="order-row"><span>Beef mishkaki × 1</span><b>TZS 16,000</b></div><div className="order-row"><span>Fresh juice × 1</span><b>TZS 12,000</b></div><div className="order-row"><span>Soda × 1</span><b>TZS 6,000</b></div></div><div className="payment-summary"><p>PAYMENT STATUS</p><strong>{money(106000)}</strong><span>Balance outstanding</span><button>View QR payment link</button></div></section></section></main>;
}
