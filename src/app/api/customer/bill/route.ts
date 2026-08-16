import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { accessContext, requestIpHash } from "@/lib/security/customerAccess";

export async function GET(request: NextRequest) {
  const access = accessContext(request);
  if (!access) return NextResponse.json({ error: "Customer access has expired." }, { status: 401 });
  const admin = createAdminClient();
  const limited = await admin.rpc("check_security_rate_limit", { p_scope: "customer-bill", p_key: `${requestIpHash(request)}:${access.accessHash.slice(0, 16)}`, p_limit: 90, p_window_seconds: 60 });
  if (limited.error || limited.data !== true) return NextResponse.json({ error: "Too many requests. Wait briefly and try again." }, { status: 429 });
  const { data, error } = await admin.rpc("secure_customer_table_bill", { p_access_hash: access.accessHash, p_device_hash: access.deviceHash });
  if (error || !data) return NextResponse.json({ error: "This table bill is unavailable or the access window has expired." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store, private", Pragma: "no-cache" } });
}