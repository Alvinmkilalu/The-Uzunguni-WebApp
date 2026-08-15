import { NextResponse } from "next/server";
import { getApiStaff } from "@/lib/auth";

export async function POST(request: Request) {
  const staff = await getApiStaff();
  if (!staff) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { tableId } = await request.json();
  const { data, error } = await staff.supabase.from("table_sessions").insert({ table_id: tableId, waiter_id: staff.user.id, status: "OPEN" }).select("id").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "This table already has an active session." : error.message }, { status: 400 });
  return NextResponse.json({ id: data.id });
}
