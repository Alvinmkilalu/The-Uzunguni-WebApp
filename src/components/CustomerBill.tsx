"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Bill = { table_number:number; table_label:string; session_id:string|null; status:string; items:{id:string;name:string;quantity:number;unit_price_amount:number;total_amount:number}[]; total_amount:number; paid_amount:number };

export default function CustomerBill({token}:{token:string}) {
  const [bill,setBill]=useState<Bill|null>(null); const [loading,setLoading]=useState(true);
  async function load(){const {data}=await createClient().rpc("customer_table_bill",{p_qr_token:token});setBill(data as Bill|null);setLoading(false);}
  useEffect(()=>{load();const timer=setInterval(load,5000);return()=>clearInterval(timer)},[token]);
  if(loading)return <main className="customer-phone"><div className="customer-loading">Checking this table securely…</div></main>;
  if(!bill)return <main className="customer-phone"><div className="customer-empty"><div>⌁</div><h1>QR not recognised</h1><p>Please scan the QR label fixed to your table again.</p></div></main>;
  if(!bill.session_id)return <main className="customer-phone"><div className="customer-top"><b>UZUNGUNI</b><span>{bill.table_label}</span></div><div className="customer-empty"><div>✓</div><h1>No active bill</h1><p>Your table is ready. Ask your waiter to initiate the table after taking your order.</p></div></main>;
  const remaining=Math.max(0,bill.total_amount-bill.paid_amount);
  return <main className="customer-phone"><div className="customer-top"><b>UZUNGUNI</b><span>{bill.table_label}</span></div><section className="customer-content"><p className="eyebrow">SECURE LIVE BILL</p><h1>Your bill</h1><p className="muted">Review the items entered by your waiter before paying.</p><div className="verified-line"><span>● Live session</span><b>{bill.status.replaceAll("_"," ")}</b></div><div className="customer-items">{bill.items.map(item=><div key={item.id}><span><b>{item.name}</b><small>{item.quantity} × TZS {item.unit_price_amount.toLocaleString()}</small></span><strong>TZS {item.total_amount.toLocaleString()}</strong></div>)}</div><div className="customer-totals"><span><i>Total bill</i><b>TZS {bill.total_amount.toLocaleString()}</b></span><span><i>Paid</i><b>TZS {bill.paid_amount.toLocaleString()}</b></span><span className="customer-remaining"><i>Remaining</i><strong>TZS {remaining.toLocaleString()}</strong></span></div>{remaining>0?<><button className="primary" onClick={()=>alert("Payment-provider connection is intentionally simulated in this board-demo build. Ask the administrator to use Simulate confirmation.")}>Pay TZS {remaining.toLocaleString()}</button><p className="demo-note">TEST MODE · No real money will be collected</p></>:<div className="paid-banner">✓ Payment received · Server verified</div>}</section></main>;
}
