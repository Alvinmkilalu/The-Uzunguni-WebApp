import { NextResponse } from "next/server";
import { getApiStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

type PendingIntent = {
  id: string;
  order_reference: string;
  amount: number;
  provider_reference: string | null;
};

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "The mock payment could not be verified.";
}

export async function POST(request: Request) {
  try {
    const mode = (
      process.env.PAYMENT_PROVIDER_MODE || "mock"
    ).toLowerCase();

    if (mode !== "mock") {
      return NextResponse.json(
        { error: "Payment simulation is disabled outside TEST mode." },
        { status: 404 },
      );
    }

    const staff = await getApiStaff();

    if (!staff || staff.profile.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Administrator access required." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const sessionId = String(body.sessionId || "");

    if (!/^[0-9a-f-]{36}$/i.test(sessionId)) {
      return NextResponse.json(
        { error: "Invalid table session." },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("payment_intents")
      .select(
        "id,order_reference,amount,provider_reference,status,expires_at,created_at",
      )
      .eq("table_session_id", sessionId)
      .in("status", ["CREATED", "PENDING"])
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(2);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 },
      );
    }

    const intents = (data || []) as PendingIntent[];

    if (intents.length === 0) {
      return NextResponse.json(
        {
          error:
            "There is no active customer payment request to verify. Ask the customer to press Send prompt first.",
        },
        { status: 409 },
      );
    }

    if (intents.length > 1) {
      return NextResponse.json(
        {
          error:
            "More than one payment request is pending. Let each customer page complete its own mock verification.",
        },
        { status: 409 },
      );
    }

    const intent = intents[0];
    const providerReference =
      intent.provider_reference || `MOCK-${intent.order_reference}`;

    const confirmation = await admin.rpc("confirm_payment_intent", {
      p_order_reference: intent.order_reference,
      p_provider_reference: providerReference,
      p_collected_amount: intent.amount,
    });

    if (confirmation.error) {
      return NextResponse.json(
        { error: confirmation.error.message },
        { status: 409 },
      );
    }

    return NextResponse.json({
      ok: true,
      intentId: intent.id,
      amount: intent.amount,
      status: "PAID",
      confirmation: confirmation.data,
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error) },
      { status: 500 },
    );
  }
}

