import { issueLicense } from "../lib/license.js";
import {
  fetchPaddleTransaction,
  containsExpectedPrice,
  entitlementStatus
} from "../lib/paddle-entitlement.js";

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Method not allowed" });
  }

  if (!process.env.PADDLE_API_KEY) {
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

  const paddle = await fetchPaddleTransaction(transactionId, { includeCustomer: true });
  if (!paddle.ok) {
    const status = paddle.unavailable ? 502 : 403;
    return json(res, status, { error: paddle.error || "Unable to verify Paddle transaction." });
  }

  const transaction = paddle.transaction;
  if (transaction.status !== "completed") {
    return json(res, 409, { error: "Transaction is not completed" });
  }

  if (!containsExpectedPrice(transaction)) {
    return json(res, 403, { error: "Transaction does not include List2Sheet Pro" });
  }

  const entitlement = entitlementStatus(transaction);
  if (!entitlement.active) {
    return json(res, 403, {
      error: entitlement.reason === "refunded"
        ? "This purchase has been refunded"
        : entitlement.reason === "chargeback"
          ? "This purchase is no longer eligible because of a chargeback"
          : "This purchase is not eligible for a Pro license"
    });
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
