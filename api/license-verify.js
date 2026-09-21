import { verifyLicense } from "../lib/license.js";
import { fetchPaddleTransaction, entitlementStatus } from "../lib/paddle-entitlement.js";

function json(res, status, body) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(body);
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "object") return req.body;
  try { return JSON.parse(req.body); } catch { return {}; }
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return json(res, 204, {});
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return json(res, 405, { error: "Method not allowed" });
  }

  if (!process.env.LICENSE_SIGNING_SECRET) {
    return json(res, 503, { valid: false, unavailable: true, error: "License service unavailable" });
  }

  const { license } = parseBody(req);
  const signed = verifyLicense({ license });
  if (!signed.valid) {
    return json(res, 403, signed);
  }

  const paddle = await fetchPaddleTransaction(signed.transactionId);
  if (!paddle.ok) {
    const status = paddle.unavailable ? 503 : 403;
    return json(res, status, {
      valid: false,
      unavailable: Boolean(paddle.unavailable),
      reason: "purchase_verification_failed"
    });
  }

  const entitlement = entitlementStatus(paddle.transaction);
  if (!entitlement.active) {
    return json(res, 403, {
      valid: false,
      reason: entitlement.reason
    });
  }

  return json(res, 200, {
    valid: true,
    product: signed.product,
    transactionId: signed.transactionId
  });
}
