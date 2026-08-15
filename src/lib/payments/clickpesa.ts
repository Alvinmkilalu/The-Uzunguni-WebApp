import { createHmac, timingSafeEqual } from "crypto";

const API_URL = "https://api.clickpesa.com/third-parties";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        if (
          key !== "checksum" &&
          key !== "checksumMethod"
        ) {
          result[key] = canonicalize(
            (value as Record<string, unknown>)[key],
          );
        }

        return result;
      }, {});
  }

  return value;
}

export function checksum(payload: unknown) {
  const key = process.env.CLICKPESA_CHECKSUM_KEY;

  if (!key) return undefined;

  return createHmac("sha256", key)
    .update(JSON.stringify(canonicalize(payload)))
    .digest("hex");
}

export function verifyWebhook(
  payload: Record<string, unknown>,
) {
  const supplied = String(payload.checksum || "");
  const expected = checksum(payload);

  if (!expected || supplied.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(supplied, "hex"),
    Buffer.from(expected, "hex"),
  );
}

async function getToken() {
  const clientId = process.env.CLICKPESA_CLIENT_ID;
  const apiKey = process.env.CLICKPESA_API_KEY;

  if (!clientId || !apiKey) {
    throw new Error(
      "ClickPesa credentials are not configured.",
    );
  }

  const response = await fetch(`${API_URL}/generate-token`, {
    method: "POST",
    headers: {
      "client-id": clientId,
      "api-key": apiKey,
    },
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok || !data.token) {
    throw new Error(
      data.message || "ClickPesa authentication failed.",
    );
  }

  return String(data.token);
}

export async function initiateClickPesa(input: {
  amount: number;
  orderReference: string;
  phoneNumber: string;
}) {
  const accessToken = await getToken();

  const base = {
    amount: String(input.amount),
    currency: "TZS",
    orderReference: input.orderReference,
    phoneNumber: input.phoneNumber,
  };

  const generatedChecksum = checksum(base);

  const body = {
    ...base,
    ...(generatedChecksum
      ? { checksum: generatedChecksum }
      : {}),
  };

  const response = await fetch(
    `${API_URL}/payments/initiate-ussd-push-request`,
    {
      method: "POST",
      headers: {
        Authorization: accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
        "The mobile-money prompt could not be sent.",
    );
  }

  return data as {
    id: string;
    status?: string;
    orderReference: string;
    channel?: string;
  };
}

export async function queryClickPesa(
  orderReference: string,
) {
  const accessToken = await getToken();

  const response = await fetch(
    `${API_URL}/payments/${encodeURIComponent(
      orderReference,
    )}`,
    {
      headers: { Authorization: accessToken },
      cache: "no-store",
    },
  );

  const data = await response.json();

  if (response.status === 404) return null;

  if (!response.ok) {
    throw new Error(
      data.message || "Could not check the payment status.",
    );
  }

  const payment = Array.isArray(data) ? data[0] : data;

  return payment as {
    id: string;
    status: string;
    paymentReference?: string;
    orderReference: string;
    collectedAmount: number | string;
    message?: string;
  };
}