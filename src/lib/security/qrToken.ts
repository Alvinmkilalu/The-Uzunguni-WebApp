import { createHmac } from "crypto";

export function deriveQrToken(tableId: string, version: number) {
  const secret = process.env.QR_TOKEN_SECRET;
  if (!secret || secret.length < 32) throw new Error("QR_TOKEN_SECRET must contain at least 32 characters.");
  return createHmac("sha256", secret).update(`uzunguni-table:${tableId}:v${version}`).digest("base64url");
}

export function publicAppUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const value = configured || (vercel ? `https://${vercel}` : "http://localhost:3000");
  const url = new URL(value);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("NEXT_PUBLIC_APP_URL must use HTTPS in production.");
  return url.origin;
}