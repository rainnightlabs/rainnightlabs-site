import crypto from "node:crypto";

const PRODUCT_CODE = "list2sheet";

function b64url(input) {
  return Buffer.from(input).toString("base64url");
}

function fromB64url(input) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function emailHash(email) {
  return crypto.createHash("sha256")
    .update(String(email).trim().toLowerCase(), "utf8")
    .digest("hex")
    .slice(0, 24);
}

function signingSecret() {
  const value = process.env.LICENSE_SIGNING_SECRET;
  if (!value || value.length < 24) {
    throw new Error("LICENSE_SIGNING_SECRET is not configured");
  }
  return value;
}

function signature(payloadPart) {
  return crypto.createHmac("sha256", signingSecret())
    .update(payloadPart, "utf8")
    .digest("base64url")
    .slice(0, 32);
}

export function issueLicense({ transactionId, email }) {
  const payload = {
    v: 1,
    p: PRODUCT_CODE,
    t: transactionId,
    e: emailHash(email)
  };
  const payloadPart = b64url(JSON.stringify(payload));
  return `L2S1.${payloadPart}.${signature(payloadPart)}`;
}

export function verifyLicense({ license, email }) {
  if (!license) return { valid: false, reason: "missing_input" };
  const parts = String(license).trim().split(".");
  if (parts.length !== 3 || parts[0] !== "L2S1") {
    return { valid: false, reason: "format" };
  }

  const [, payloadPart, suppliedSig] = parts;
  const expectedSig = signature(payloadPart);

  const a = Buffer.from(suppliedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { valid: false, reason: "signature" };
  }

  let payload;
  try {
    payload = JSON.parse(fromB64url(payloadPart));
  } catch {
    return { valid: false, reason: "payload" };
  }

  if (payload.v !== 1 || payload.p !== PRODUCT_CODE) {
    return { valid: false, reason: "product" };
  }

  if (!/^txn_[a-z0-9]{26}$/.test(String(payload.t || ""))) {
    return { valid: false, reason: "transaction" };
  }

  // Email remains part of the signed payload for deterministic recovery and
  // backwards compatibility, but normal activation no longer requires users
  // to type it. If an email is supplied (for recovery/support flows), verify it.
  if (email && payload.e !== emailHash(email)) {
    return { valid: false, reason: "email" };
  }

  return {
    valid: true,
    product: PRODUCT_CODE,
    transactionId: payload.t
  };
}
