import { NextResponse } from "next/server";
import { getApiStaff } from "@/lib/auth";

export async function POST(request: Request) {
  const staff = await getApiStaff(); if (!staff) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { sessionId, menuItemId } = await request.json();
  const { data: session } = await staff.supabase.from("table_sessions").select("id,waiter_id,status").eq("id", sessionId).single();
  if (!session || (staff.profile.role !== "ADMIN" && session.waiter_id !== staff.user.id)) return NextResponse.json({ error: "You do not own this table session." }, { status: 403 });
  if (["CLOSED","CANCELLED","SETTLED"].includes(session.status)) return NextResponse.json({ error: "This session cannot be edited." }, { status: 400 });
  const { data: menu } = await staff.supabase.from("menu_items").select("id,name,price_amount").eq("id", menuItemId).single();
  if (!menu) return NextResponse.json({ error: "Menu item not found." }, { status: 404 });
  const { data: existing } = await staff.supabase.from("order_items").select("id,quantity").eq("table_session_id", sessionId).eq("menu_item_id", menuItemId).maybeSingle();
  const query = existing
    ? staff.supabase.from("order_items").update({ quantity: existing.quantity + 1 }).eq("id", existing.id)
    : staff.supabase.from("order_items").insert({ table_session_id: sessionId, menu_item_id: menu.id, item_name: menu.name, unit_price_amount: menu.price_amount, quantity: 1 });
  const { error } = await query; if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
