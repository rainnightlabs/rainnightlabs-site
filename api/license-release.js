import { verifyLicense } from "../lib/license.js";
import {
  activationStoreConfigured,
  releaseInstallation
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
    return json(res, 503, { ok: false, unavailable: true });
  }

  const { license, installationId } = parseBody(req);
  const signed = verifyLicense({ license });
  if (!signed.valid) {
    return json(res, 403, { ok: false, reason: signed.reason || "invalid_license" });
  }

  if (!validInstallationId(installationId)) {
    return json(res, 400, { ok: false, reason: "installation_required" });
  }

  if (!activationStoreConfigured()) {
    return json(res, 200, {
      ok: true,
      protected: false,
      released: false
    });
  }

  const release = await releaseInstallation(
    signed.transactionId,
    String(installationId).trim()
  );

  if (!release.ok) {
    return json(res, 503, {
      ok: false,
      unavailable: true,
      reason: "activation_service_unavailable"
    });
  }

  return json(res, 200, {
    ok: true,
    protected: true,
    released: release.released
  });
}
