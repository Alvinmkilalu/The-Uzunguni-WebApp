import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ACCESS_COOKIE, DEVICE_COOKIE, deviceHash, privateHash, randomToken, requestIpHash, secureCookieOptions, sha256 } from "@/lib/security/customerAccess";

export async function GET(request: NextRequest, { params }: { params: Promise<{ qrToken: string }> }) {
  const { qrToken } = await params;
  const safe = new URL("/pay?state=unavailable", request.url);
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(qrToken)) return NextResponse.redirect(safe, 303);

  const admin = createAdminClient();
  const ipHash = requestIpHash(request);
  const limited = await admin.rpc("check_security_rate_limit", { p_scope: "qr-scan", p_key: `${ipHash}:${sha256(qrToken).slice(0, 16)}`, p_limit: 20, p_window_seconds: 60 });
  if (limited.error || limited.data !== true) return NextResponse.redirect(new URL("/pay?state=rate-limited", request.url), 303);

  const deviceId = request.cookies.get(DEVICE_COOKIE)?.value || randomToken(24);
  const userAgent = request.headers.get("user-agent") || "unknown";
  const accessToken = randomToken(32);
  const exchange = await admin.rpc("exchange_table_qr", {
    p_qr_token: qrToken,
    p_access_hash: sha256(accessToken),
    p_device_hash: deviceHash(deviceId, userAgent),
    p_ip_hash: ipHash,
    p_user_agent_hash: privateHash(`ua:${userAgent.slice(0, 300)}`),
  });

  const result = exchange.data as { ok?: boolean; expires_at?: string } | null;
  if (exchange.error || !result?.ok || !result.expires_at) return NextResponse.redirect(safe, 303);
  const maxAge = Math.max(60, Math.min(1800, Math.floor((new Date(result.expires_at).getTime() - Date.now()) / 1000)));
  const response = NextResponse.redirect(new URL("/pay", request.url), 303);
  response.cookies.set(DEVICE_COOKIE, deviceId, secureCookieOptions(60 * 60 * 24 * 30, "lax"));
  response.cookies.set(ACCESS_COOKIE, accessToken, secureCookieOptions(maxAge));
  response.headers.set("Cache-Control", "no-store, private");
  return response;
}