"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type MenuItem = { id:string; name:string; category:string; price_amount:number; is_active:boolean };

export default function MenuManager({items}:{items:MenuItem[]}) {
  const router=useRouter(); const [busy,setBusy]=useState(""); const [message,setMessage]=useState("");
  async function create(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy("new");setMessage("");const body=Object.fromEntries(new FormData(event.currentTarget));const res=await fetch("/api/admin/menu",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const out=await res.json();setBusy("");if(!res.ok){setMessage(`⚠ ${out.error}`);return;}event.currentTarget.reset();setMessage("✓ Menu item added and immediately available to waiters.");router.refresh();}
  async function update(item:MenuItem,changes:Partial<MenuItem>){setBusy(item.id);setMessage("");const res=await fetch("/api/admin/menu",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:item.id,...changes})});const out=await res.json();setBusy("");if(!res.ok){setMessage(`⚠ ${out.error}`);return;}router.refresh();}
  function edit(item:MenuItem){const name=prompt("Menu item name",item.name);if(name===null)return;const category=prompt("Category",item.category);if(category===null)return;const raw=prompt("Price in TZS",String(item.price_amount));if(raw===null)return;const price_amount=Number(raw.replaceAll(",",""));update(item,{name,category,price_amount});}
  return <>
    <section className="content-card"><div className="card-heading"><div><p className="eyebrow">NEW MENU ITEM</p><h2>Add an item</h2></div></div><form className="menu-form" onSubmit={create}><label>Item name<input name="name" required placeholder="Safari Lager 500ml"/></label><label>Category<input name="category" required placeholder="Beer & cider"/></label><label>Price (TZS)<input name="price" type="number" min="0" step="1" required placeholder="5000"/></label><button className="staff-button" disabled={busy==="new"}>{busy==="new"?"Adding…":"Add menu item"}</button></form>{message&&<p className={message.startsWith("⚠")?"form-error":"form-success"}>{message}</p>}</section>
    <section className="content-card"><div className="card-heading"><div><p className="eyebrow">WAITER MENU</p><h2>Items and current prices</h2></div><span>{items.filter(i=>i.is_active).length} active</span></div><div className="menu-admin-list">{items.map(item=><article key={item.id} className={!item.is_active?"inactive":""}><div><b>{item.name}</b><small>{item.category}</small></div><strong>TZS {item.price_amount.toLocaleString()}</strong><span className={`status-chip ${item.is_active?"paid":"failed"}`}>{item.is_active?"✓ Active":"× Hidden"}</span><button onClick={()=>edit(item)} disabled={busy===item.id}>Edit</button><button onClick={()=>update(item,{is_active:!item.is_active})} disabled={busy===item.id}>{item.is_active?"Hide":"Restore"}</button></article>)}</div></section>
  </>;
}
