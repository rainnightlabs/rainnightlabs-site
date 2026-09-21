const DEFAULT_PRICE_ID = "pri_01m2t1zv55fefxr0dw8m7jm63c";

export function expectedPriceId() {
  return process.env.LIST2SHEET_PRICE_ID || DEFAULT_PRICE_ID;
}

export function paddleBase(apiKey) {
  return apiKey.startsWith("pdl_live_")
    ? "https://api.paddle.com"
    : "https://sandbox-api.paddle.com";
}

export async function fetchPaddleTransaction(transactionId, { includeCustomer = false } = {}) {
  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) {
    return { ok: false, unavailable: true, status: 503, error: "License service is not configured yet" };
  }

  const include = includeCustomer ? "customer,adjustments" : "adjustments";
  let response;
  try {
    response = await fetch(
      `${paddleBase(apiKey)}/transactions/${encodeURIComponent(transactionId)}?include=${include}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Paddle-Version": "1"
        }
      }
    );
  } catch {
    return { ok: false, unavailable: true, status: 502, error: "Unable to reach Paddle" };
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.data) {
    const code = payload?.error?.code || "unknown";
    console.error("PADDLE_TRANSACTION_VERIFY_FAILED", JSON.stringify({
      status: response.status,
      code,
      transactionId
    }));
    return {
      ok: false,
      unavailable: response.status >= 500 || response.status === 429,
      status: response.status || 502,
      error: response.status === 403
        ? "Paddle API permission denied. The API key needs Transactions: Read."
        : response.status === 401
          ? "Paddle API authentication failed."
          : "Unable to verify Paddle transaction."
    };
  }

  return { ok: true, transaction: payload.data };
}

export function containsExpectedPrice(transaction) {
  const priceId = expectedPriceId();
  const items = Array.isArray(transaction?.items) ? transaction.items : [];
  return items.some((item) =>
    item?.price?.id === priceId ||
    item?.price_id === priceId
  );
}

function expectedTransactionItemIds(transaction) {
  const priceId = expectedPriceId();
  const items = Array.isArray(transaction?.items) ? transaction.items : [];
  return new Set(
    items
      .filter((item) => item?.price?.id === priceId || item?.price_id === priceId)
      .map((item) => item?.id)
      .filter(Boolean)
  );
}

export function entitlementStatus(transaction) {
  if (!transaction || transaction.status !== "completed") {
    return { active: false, reason: "transaction_not_completed" };
  }

  if (!containsExpectedPrice(transaction)) {
    return { active: false, reason: "wrong_product" };
  }

  const adjustments = Array.isArray(transaction.adjustments) ? transaction.adjustments : [];
  const expectedItemIds = expectedTransactionItemIds(transaction);

  for (const adjustment of adjustments) {
    const action = adjustment?.action;
    const status = adjustment?.status;

    // A successful chargeback removes entitlement. If Paddle later reverses
    // the chargeback, the original adjustment is marked reversed.
    if (action === "chargeback" && status !== "reversed") {
      return { active: false, reason: "chargeback" };
    }

    // Pending/rejected refunds do not revoke access. Full approved refunds do.
    if (action === "refund" && status === "approved") {
      if (adjustment?.type === "full") {
        return { active: false, reason: "refunded" };
      }

      const items = Array.isArray(adjustment?.items) ? adjustment.items : [];
      const fullyRefundedProduct = items.some((item) =>
        expectedItemIds.has(item?.item_id) && item?.type === "full"
      );
      if (fullyRefundedProduct) {
        return { active: false, reason: "refunded" };
      }
    }
  }

  return { active: true };
}
