import { createHmac } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { initiateClickPesa } from "@/lib/payments/clickpesa";

const methods = [
  "MPESA",
  "AIRTEL_MONEY",
  "MIXX",
  "HALOPESA",
  "SELCOM_PESA",
  "AZAMPESA",
];

const splitTypes = ["FULL", "EQUAL", "ITEM", "CUSTOM"];

function normalizePhone(input: string) {
  const digits = input.replace(/\D/g, "");

  if (/^0[67]\d{8}$/.test(digits)) {
    return `255${digits.slice(1)}`;
  }

  if (/^[67]\d{8}$/.test(digits)) {
    return `255${digits}`;
  }

  if (/^255[67]\d{8}$/.test(digits)) {
    return digits;
  }

  return null;
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "The payment request could not be sent.";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const phone = normalizePhone(String(body.phone || ""));

    if (!phone) {
      return NextResponse.json(
        {
          error:
            "Enter a valid Tanzanian mobile number, for example 0712345678.",
        },
        { status: 400 },
      );
    }

    if (!methods.includes(String(body.method))) {
      return NextResponse.json(
        { error: "Choose a supported mobile-money service." },
        { status: 400 },
      );
    }

    if (!splitTypes.includes(String(body.splitType))) {
      return NextResponse.json(
        { error: "Choose a valid bill-payment option." },
        { status: 400 },
      );
    }

    if (
      !/^[0-9a-f-]{36}$/i.test(String(body.requestId || ""))
    ) {
      return NextResponse.json(
        { error: "Invalid payment request. Please try again." },
        { status: 400 },
      );
    }

    const amount = Number(body.amount);

    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Enter a valid whole TZS amount." },
        { status: 400 },
      );
    }

    const mode = (
      process.env.PAYMENT_PROVIDER_MODE || "mock"
    ).toLowerCase();

    if (
      mode === "clickpesa" &&
      ["SELCOM_PESA", "AZAMPESA"].includes(body.method)
    ) {
      return NextResponse.json(
        {
          error:
            "This wallet is not enabled on the current ClickPesa merchant account. Choose an enabled service or ask the administrator to configure its provider adapter.",
        },
        { status: 400 },
      );
    }

    const hashKey =
      process.env.PAYMENT_PHONE_HASH_SECRET ||
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!hashKey) {
      throw new Error(
        "PAYMENT_PHONE_HASH_SECRET is not configured.",
      );
    }

    const phoneHash = createHmac("sha256", hashKey)
      .update(phone)
      .digest("hex");

    const admin = createAdminClient();

    const { data, error } = await admin.rpc(
      "create_customer_payment_intent",
      {
        p_qr_token: String(body.qrToken || ""),
        p_request_id: String(body.requestId),
        p_split_type: String(body.splitType),
        p_amount: amount,
        p_method: String(body.method),
        p_phone_hash: phoneHash,
        p_phone_last4: phone.slice(-4),
        p_item_ids: Array.isArray(body.itemIds)
          ? body.itemIds
          : [],
      },
    );

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 },
      );
    }

    const intent = data as {
      intent_id: string;
      order_reference: string;
      amount: number;
    };

    let providerReference = `MOCK-${intent.order_reference}`;

    try {
      if (mode === "clickpesa") {
        const provider = await initiateClickPesa({
          amount: intent.amount,
          orderReference: intent.order_reference,
          phoneNumber: phone,
        });

        providerReference = provider.id;
      } else if (mode !== "mock") {
        throw new Error(
          "PAYMENT_PROVIDER_MODE must be mock or clickpesa.",
        );
      }

      const marked = await admin.rpc(
        "mark_payment_intent_sent",
        {
          p_intent_id: intent.intent_id,
          p_provider_reference: providerReference,
        },
      );

      if (marked.error) throw marked.error;
    } catch (providerError) {
      await admin.rpc("fail_payment_intent", {
        p_order_reference: intent.order_reference,
        p_reason: errorMessage(providerError),
      });

      throw providerError;
    }

    return NextResponse.json({
      status: "PENDING",
      intentId: intent.intent_id,
      maskedPhone: `${phone.slice(0, 5)}***${phone.slice(-3)}`,
      mode: mode.toUpperCase(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error) },
      { status: 500 },
    );
  }
}