import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhook } from "@/lib/payments/clickpesa";

export async function POST(request: Request) {
  const payload =
    (await request.json()) as Record<string, unknown>;

  if (!verifyWebhook(payload)) {
    return NextResponse.json(
      { error: "Invalid webhook checksum." },
      { status: 401 },
    );
  }

  const event = String(payload.event || "");

  const data = (payload.data || {}) as Record<
    string,
    unknown
  >;

  const orderReference = String(
    data.orderReference || "",
  );

  if (!orderReference) {
    return NextResponse.json(
      { error: "Missing order reference." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  if (
    event === "PAYMENT RECEIVED" &&
    ["SUCCESS", "SETTLED"].includes(
      String(data.status || ""),
    )
  ) {
    const result = await admin.rpc(
      "confirm_payment_intent",
      {
        p_order_reference: orderReference,
        p_provider_reference: String(
          data.paymentReference || data.id || "",
        ),
        p_collected_amount: Number(data.collectedAmount),
      },
    );

    if (result.error) {
      return NextResponse.json(
        { error: result.error.message },
        { status: 400 },
      );
    }
  } else if (event === "PAYMENT FAILED") {
    await admin.rpc("fail_payment_intent", {
      p_order_reference: orderReference,
      p_reason: String(
        data.message || "Payment failed",
      ),
    });
  }

  return NextResponse.json({ received: true });
}