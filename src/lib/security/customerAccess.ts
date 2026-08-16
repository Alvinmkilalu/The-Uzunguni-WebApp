import { createHash, createHmac, randomBytes } from "crypto";
import type { NextRequest } from "next/server";

export const ACCESS_COOKIE = "__Host-uzp_access";
export const DEVICE_COOKIE = "__Host-uzp_device";

function secret() {
  const value = process.env.CUSTOMER_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("CUSTOMER_SESSION_SECRET must contain at least 32 characters.");
  return value;
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function privateHash(value: string) {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

export function deviceHash(deviceId: string, userAgent: string) {
  return privateHash(`device:${deviceId}:${userAgent.slice(0, 300)}`);
}

export function requestIpHash(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "unknown";
  return privateHash(`ip:${ip}`);
}

export function accessContext(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const deviceId = request.cookies.get(DEVICE_COOKIE)?.value;
  if (!accessToken || !deviceId) return null;
  const userAgent = request.headers.get("user-agent") || "unknown";
  return { accessHash: sha256(accessToken), deviceHash: deviceHash(deviceId, userAgent) };
}

export function secureCookieOptions(maxAge: number, sameSite: "lax" | "strict" = "strict") {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite, path: "/", maxAge } as const;
}