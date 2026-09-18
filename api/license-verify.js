import { verifyLicense } from "../lib/license.js";

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
    return json(res, 503, { valid: false, error: "License service unavailable" });
  }

  const { license, email } = parseBody(req);
  const result = verifyLicense({ license, email });
  return json(res, result.valid ? 200 : 403, result);
}
