import { NextResponse } from "next/server";
import { getApiStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const staff = await getApiStaff();
  if (!staff || staff.profile.role !== "ADMIN") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const { fullName, username, email, password } = await request.json();
  if (!fullName || !username || !email || typeof password !== "string" || password.length < 8) return NextResponse.json({ error: "Complete every field; password must contain at least 8 characters." }, { status: 400 });
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: String(email).toLowerCase().trim(), password, email_confirm: true,
    user_metadata: { full_name: String(fullName).trim(), username: String(username).toLowerCase().trim() }
  });
  if (error || !data.user) return NextResponse.json({ error: error?.message || "Could not create employee." }, { status: 400 });
  await admin.from("profiles").update({ full_name: String(fullName).trim(), username: String(username).toLowerCase().trim(), role: "WAITER", is_active: true }).eq("id", data.user.id);
  return NextResponse.json({ ok: true });
}
