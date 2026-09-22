import { verifyLicense } from "../lib/license.js";
import { fetchPaddleTransaction, entitlementStatus } from "../lib/paddle-entitlement.js";
import {
  activationStoreConfigured,
  maxInstallations,
  registerInstallation
} from "../lib/license-activations.js";

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

function validInstallationId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "").trim()
  );
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

  const { license, installationId } = parseBody(req);
  const signed = verifyLicense({ license });
  if (!signed.valid) {
    return json(res, 403, signed);
  }

  if (activationStoreConfigured() && !validInstallationId(installationId)) {
    return json(res, 400, {
      valid: false,
      reason: "installation_required"
    });
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

  let activation = {
    configured: false,
    allowed: true,
    used: null,
    limit: maxInstallations()
  };

  if (validInstallationId(installationId)) {
    activation = await registerInstallation(signed.transactionId, String(installationId).trim());
    if (!activation.ok) {
      return json(res, 503, {
        valid: false,
        unavailable: true,
        reason: "activation_service_unavailable"
      });
    }

    if (!activation.allowed) {
      return json(res, 403, {
        valid: false,
        reason: "activation_limit",
        activations: {
          used: activation.used,
          limit: activation.limit
        }
      });
    }
  }

  return json(res, 200, {
    valid: true,
    product: signed.product,
    transactionId: signed.transactionId,
    activations: {
      protected: Boolean(activation.configured),
      used: activation.used,
      limit: activation.limit
    }
  });
}
