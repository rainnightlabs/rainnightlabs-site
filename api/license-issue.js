import { issueLicense } from "../lib/license.js";

const EXPECTED_PRICE_ID = "pri_01m2t1zv55fefxr0dw8m7jm63c";

function json(res, status, body) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(body);
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "object") return req.body;
  try { return JSON.parse(req.body); } catch { return {}; }
}

function paddleBase(apiKey) {
  return apiKey.startsWith("pdl_live_")
    ? "https://api.paddle.com"
    : "https://sandbox-api.paddle.com";
}

function containsExpectedPrice(transaction) {
  const items = Array.isArray(transaction.items) ? transaction.items : [];
  return items.some((item) =>
    item?.price?.id === EXPECTED_PRICE_ID ||
    item?.price_id === EXPECTED_PRICE_ID
  );
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Method not allowed" });
  }

  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) {
    return json(res, 503, { error: "License service is not configured yet" });
  }

  if (!process.env.LICENSE_SIGNING_SECRET) {
    return json(res, 503, { error: "License signing is not configured yet" });
  }

  const { transactionId, email } = parseBody(req);
  if (!/^txn_[a-z0-9]{26}$/.test(String(transactionId || ""))) {
    return json(res, 400, { error: "Invalid transaction ID" });
  }
  if (!email || !String(email).includes("@")) {
    return json(res, 400, { error: "Purchase email is required" });
  }

  let response;
  try {
    response = await fetch(
      `${paddleBase(apiKey)}/transactions/${encodeURIComponent(transactionId)}?include=customer`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        }
      }
    );
  } catch {
    return json(res, 502, { error: "Unable to reach Paddle" });
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.data) {
    return json(res, 502, { error: "Unable to verify Paddle transaction" });
  }

  const transaction = payload.data;
  if (transaction.status !== "completed") {
    return json(res, 409, { error: "Transaction is not completed" });
  }

  if (!containsExpectedPrice(transaction)) {
    return json(res, 403, { error: "Transaction does not include List2Sheet Pro" });
  }

  const paddleEmail = transaction.customer?.email;
  if (!paddleEmail ||
      paddleEmail.trim().toLowerCase() !== String(email).trim().toLowerCase()) {
    return json(res, 403, { error: "Purchase email does not match transaction" });
  }

  const license = issueLicense({
    transactionId: transaction.id,
    email: paddleEmail
  });

  return json(res, 200, {
    ok: true,
    product: "List2Sheet Pro",
    license,
    transactionId: transaction.id
  });
}
