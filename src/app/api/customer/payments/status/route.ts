import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { queryClickPesa } from "@/lib/payments/clickpesa";

export async function GET(request: Request) {
  const url = new URL(request.url);

  const intentId = url.searchParams.get("intentId");
  const qrToken = url.searchParams.get("qrToken");

  if (!intentId || !qrToken) {
    return NextResponse.json(
      { error: "Missing payment reference." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const visible = await admin.rpc(
    "customer_payment_intent_status",
    {
      p_qr_token: qrToken,
      p_intent_id: intentId,
    },
  );

  if (visible.error || !visible.data) {
    return NextResponse.json(
      { error: "Payment request not found." },
      { status: 404 },
    );
  }

  let result = visible.data as {
    status: string;
    order_reference: string;
    amount: number;
    reference?: string;
    message?: string;
    created_at: string;
  };

  if (result.status === "PENDING") {
    const mode = (
      process.env.PAYMENT_PROVIDER_MODE || "mock"
    ).toLowerCase();

    if (
      mode === "mock" &&
      Date.now() - new Date(result.created_at).getTime() >= 6000
    ) {
      const confirmation = await admin.rpc(
        "confirm_payment_intent",
        {
          p_order_reference: result.order_reference,
          p_provider_reference: `MOCK-${result.order_reference}`,
          p_collected_amount: result.amount,
        },
      );

      if (!confirmation.error) {
        result = {
          ...result,
          ...confirmation.data,
          status: "PAID",
        };
      }
    } else if (mode === "clickpesa") {
      try {
        const provider = await queryClickPesa(
          result.order_reference,
        );

        if (
          provider &&
          ["SUCCESS", "SETTLED"].includes(provider.status)
        ) {
          const confirmation = await admin.rpc(
            "confirm_payment_intent",
            {
              p_order_reference: result.order_reference,
              p_provider_reference:
                provider.paymentReference || provider.id,
              p_collected_amount: Number(
                provider.collectedAmount,
              ),
            },
          );

          if (!confirmation.error) {
            result = {
              ...result,
              ...confirmation.data,
              status: "PAID",
            };
          }
        } else if (provider?.status === "FAILED") {
          await admin.rpc("fail_payment_intent", {
            p_order_reference: result.order_reference,
            p_reason:
              provider.message ||
              "The provider declined the payment.",
          });

          result = {
            ...result,
            status: "FAILED",
            message:
              provider.message ||
              "The provider declined the payment.",
          };
        }
      } catch {
        // Keep it pending. A verified webhook may still confirm it.
      }
    }
  }

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}