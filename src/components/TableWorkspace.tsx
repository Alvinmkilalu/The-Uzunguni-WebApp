"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Item = { id: string; item_name: string; unit_price_amount: number; quantity: number };
type Menu = { id: string; name: string; category: string; price_amount: number };

export default function TableWorkspace({ sessionId, items, menu, payments, isAdmin }: { sessionId: string; items: Item[]; menu: Menu[]; payments: {id:string;amount:number;payment_method:string;status:string;provider_reference:string|null;created_at:string}[]; isAdmin: boolean }) {
  const router = useRouter(); const [menuId, setMenuId] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const total = items.reduce((n,i) => n + i.unit_price_amount * i.quantity, 0); const paid = payments.filter(p => p.status === "PAID").reduce((n,p) => n + p.amount, 0); const remaining = Math.max(0,total-paid);
  async function addItem() { setBusy(true); setError(""); const res = await fetch("/api/order-items", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({sessionId,menuItemId:menuId}) }); const out=await res.json(); setBusy(false); if(!res.ok){setError(out.error);return;} setMenuId(""); router.refresh(); }
  async function simulate() { const raw=prompt(`Demo only: amount to confirm (remaining TZS ${remaining.toLocaleString()})`,String(remaining)); if(!raw)return; const amount=Number(raw.replaceAll(",","")); const res=await fetch("/api/admin/payments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId,amount})}); const out=await res.json(); if(!res.ok){setError(out.error);return;} router.refresh(); }
  return <div className="workspace-stack">
    <section className="content-card"><div className="card-heading"><div><p className="eyebrow">ORDER</p><h2>Items ordered</h2></div><span>{items.reduce((n,i)=>n+i.quantity,0)} items</span></div>
      <div className="order-list">{items.map(item=><div key={item.id}><span><b>{item.item_name}</b><small>Quantity {item.quantity} × TZS {item.unit_price_amount.toLocaleString()}</small></span><strong>TZS {(item.quantity*item.unit_price_amount).toLocaleString()}</strong></div>)}{!items.length&&<div className="empty-inline">No items added yet.</div>}</div>
      <div className="add-item-row"><select value={menuId} onChange={e=>setMenuId(e.target.value)}><option value="">Select menu item…</option>{menu.map(item=><option key={item.id} value={item.id}>{item.name} — TZS {item.price_amount.toLocaleString()}</option>)}</select><button onClick={addItem} disabled={!menuId||busy}>{busy?"Adding…":"+ Add item"}</button></div>{error&&<p className="form-error">⚠ {error}</p>}
    </section>
    <section className="content-card"><div className="card-heading"><div><p className="eyebrow">PAYMENTS</p><h2>Verified payment history</h2></div>{isAdmin&&remaining>0&&<button className="outline-button" onClick={simulate}>Simulate confirmation</button>}</div>
      <div className="payment-list">{payments.map(payment=><div key={payment.id}><span><b>TZS {payment.amount.toLocaleString()} · {payment.payment_method}</b><small>{payment.provider_reference||"Awaiting provider reference"}</small></span><span className={`status-chip ${payment.status==="PAID"?"paid":"pending"}`}>{payment.status==="PAID"?"✓ Verified":"◷ Pending"}</span></div>)}{!payments.length&&<div className="empty-inline">No payments yet. The customer can review the bill through the table QR.</div>}</div>
    </section>
    <section className="content-card totals-card"><div><span>Order total</span><b>TZS {total.toLocaleString()}</b></div><div><span>Paid and verified</span><b>TZS {paid.toLocaleString()}</b></div><div className="remaining-total"><span>REMAINING</span><strong>TZS {remaining.toLocaleString()}</strong></div></section>
  </div>;
}
