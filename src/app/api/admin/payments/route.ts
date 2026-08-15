import { NextResponse } from "next/server";
import { getApiStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const staff = await getApiStaff(); if (!staff || staff.profile.role !== "ADMIN") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const { sessionId, amount } = await request.json();
  if (!sessionId || !Number.isInteger(amount) || amount <= 0) return NextResponse.json({ error: "Enter a valid whole TZS amount." }, { status: 400 });
  const admin = createAdminClient();
  const [{ data: beforeItems }, { data: beforePayments }] = await Promise.all([admin.from("order_items").select("unit_price_amount,quantity").eq("table_session_id", sessionId), admin.from("payments").select("amount").eq("table_session_id", sessionId).eq("status", "PAID")]);
  const beforeTotal = (beforeItems || []).reduce((n,i) => n + i.unit_price_amount * i.quantity, 0); const beforePaid = (beforePayments || []).reduce((n,p) => n + p.amount, 0); const beforeRemaining = Math.max(0, beforeTotal - beforePaid);
  if (beforeRemaining === 0 || amount > beforeRemaining) return NextResponse.json({ error: `Payment cannot exceed the remaining TZS ${beforeRemaining.toLocaleString()}.` }, { status: 400 });
  const { error } = await admin.from("payments").insert({ table_session_id: sessionId, amount, payment_method: "DEMO", status: "PAID", provider_reference: `DEMO-${crypto.randomUUID()}`, confirmed_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const [{ data: items }, { data: payments }] = await Promise.all([admin.from("order_items").select("unit_price_amount,quantity").eq("table_session_id", sessionId), admin.from("payments").select("amount").eq("table_session_id", sessionId).eq("status", "PAID")]);
  const total = (items || []).reduce((n,i) => n + i.unit_price_amount * i.quantity, 0); const paid = (payments || []).reduce((n,p) => n + p.amount, 0);
  await admin.from("table_sessions").update({ status: paid >= total && total > 0 ? "SETTLED" : "PARTIALLY_PAID" }).eq("id", sessionId);
  return NextResponse.json({ ok: true });
}
