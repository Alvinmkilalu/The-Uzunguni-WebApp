import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { getApiStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { deriveQrToken, publicAppUrl } from "@/lib/security/qrToken";

export async function POST(request: Request) {
  const staff = await getApiStaff();
  if (!staff || staff.profile.role !== "ADMIN") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const rotateTableId = typeof body.rotateTableId === "string" ? body.rotateTableId : null;
  const admin = createAdminClient();
  const query = admin.from("dining_tables").select("id,table_number,label,qr_version").eq("is_active", true).order("table_number");
  const { data: tables, error } = rotateTableId ? await query.eq("id", rotateTableId) : await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const origin = publicAppUrl();
  const codes = [];
  for (const table of tables || []) {
    const version = rotateTableId ? Number(table.qr_version || 1) + 1 : Number(table.qr_version || 1);
    const token = deriveQrToken(table.id, version);
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const updated = await admin.from("dining_tables").update({ qr_version: version, qr_token_hash: tokenHash }).eq("id", table.id);
    if (updated.error) return NextResponse.json({ error: updated.error.message }, { status: 400 });
    codes.push({ id: table.id, table_number: table.table_number, label: table.label, qr_version: version, url: `${origin}/q/${token}` });
    if (rotateTableId) await admin.from("security_audit_events").insert({ event_type: "QR_ROTATED", actor_id: staff.user.id, table_id: table.id, metadata: { version } });
  }
  return NextResponse.json({ codes }, { headers: { "Cache-Control": "no-store, private" } });
}