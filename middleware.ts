import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  if (["POST","PUT","PATCH","DELETE"].includes(request.method) && !request.nextUrl.pathname.startsWith("/api/webhooks/")) {
    const origin = request.headers.get("origin");
    if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Cross-site request rejected." }, { status: 403 });
  }
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items: { name: string; value: string; options: CookieOptions }[]) => {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    } }
  );
  await supabase.auth.getUser();
  response.headers.set("X-Content-Type-Options","nosniff");
  response.headers.set("Referrer-Policy","no-referrer");
  response.headers.set("Permissions-Policy","camera=(), microphone=(), geolocation=(), payment=()");
  response.headers.set("X-Frame-Options","DENY");
  if(request.nextUrl.pathname.startsWith("/pay")||request.nextUrl.pathname.startsWith("/q/")||request.nextUrl.pathname.startsWith("/api/customer/"))response.headers.set("Cache-Control","no-store, private");
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"] };