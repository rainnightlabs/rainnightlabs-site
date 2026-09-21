import { paddleBase } from "../lib/paddle-entitlement.js";

const LEGACY_PRODUCT_ID = "pro_01m2t1wm8w2hfh4apxcr3fdj5j";
const LEGACY_PRICE_ID = "pri_01m2t1zv55fefxr0dw8m7jm63c";
const LEGACY_CLIENT_TOKEN = "test_353edbf28f51b2cbcd019161e39";

function json(res, status, body) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(status).json(body);
}

function environmentFromToken(token) {
  return String(token || "").startsWith("test_") ? "sandbox" : "production";
}

async function getDiscount(apiKey, discountId) {
  let response;
  try {
    response = await fetch(
      `${paddleBase(apiKey)}/discounts/${encodeURIComponent(discountId)}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Paddle-Version": "1"
        }
      }
    );
  } catch {
    return { ok: false, error: "Unable to reach Paddle" };
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.data) {
    console.error("PADDLE_DISCOUNT_LOOKUP_FAILED", JSON.stringify({
      status: response.status,
      code: payload?.error?.code || "unknown"
    }));
    return {
      ok: false,
      status: response.status,
      code: payload?.error?.code || "unknown",
      error: response.status === 401
        ? "Paddle API authentication failed"
        : response.status === 403
          ? "Paddle API key needs Discounts: Read permission, or the key is for the wrong environment"
          : response.status === 404
            ? "Launch discount was not found in this Paddle environment"
            : "Unable to read launch discount"
    };
  }

  return { ok: true, discount: payload.data };
}

function discountIsAvailable(discount) {
  if (!discount) return false;
  if (discount.status !== "active" || discount.enabled_for_checkout !== true) return false;

  if (discount.expires_at && Date.parse(discount.expires_at) <= Date.now()) return false;

  const limit = discount.usage_limit;
  const used = Number(discount.times_used || 0);
  return limit == null || used < Number(limit);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return json(res, 405, { error: "Method not allowed" });
  }

  const clientToken = process.env.PADDLE_CLIENT_TOKEN || LEGACY_CLIENT_TOKEN;
  const productId = process.env.LIST2SHEET_PRODUCT_ID || LEGACY_PRODUCT_ID;
  const standardPriceId = String(process.env.LIST2SHEET_STANDARD_PRICE_ID || "").trim();
  const earlyDiscountId = String(process.env.LIST2SHEET_EARLY_DISCOUNT_ID || "").trim();

  if (standardPriceId && !/^pri_[a-z0-9]{26}$/.test(standardPriceId)) {
    return json(res, 500, {
      error: "LIST2SHEET_STANDARD_PRICE_ID must be a Paddle Price ID starting with pri_"
    });
  }

  if (earlyDiscountId && !/^dsc_[a-z0-9]{26}(?:@dscrev_[a-z0-9]{26})?$/.test(earlyDiscountId)) {
    return json(res, 500, {
      error: "LIST2SHEET_EARLY_DISCOUNT_ID must be the Paddle Discount ID starting with dsc_, not the checkout discount code"
    });
  }

  // Until the $29 catalog price and limited discount are configured, keep the
  // existing Sandbox checkout working exactly as before.
  if (!standardPriceId) {
    return json(res, 200, {
      mode: "legacy",
      environment: environmentFromToken(clientToken),
      clientToken,
      productId,
      priceId: LEGACY_PRICE_ID,
      offerActive: true,
      displayPrice: 19,
      standardPrice: 29
    });
  }

  if (!earlyDiscountId) {
    return json(res, 200, {
      mode: "standard",
      environment: environmentFromToken(clientToken),
      clientToken,
      productId,
      priceId: standardPriceId,
      offerActive: false,
      displayPrice: 29,
      standardPrice: 29
    });
  }

  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) {
    return json(res, 503, { error: "Launch offer status is temporarily unavailable" });
  }

  const lookup = await getDiscount(apiKey, earlyDiscountId);
  if (!lookup.ok) {
    return json(res, lookup.status === 401 || lookup.status === 403 ? 503 : 502, {
      error: lookup.error || "Launch offer status is temporarily unavailable",
      paddleStatus: lookup.status || null,
      paddleCode: lookup.code || "unknown",
      environment: environmentFromToken(clientToken)
    });
  }

  const active = discountIsAvailable(lookup.discount);
  return json(res, 200, {
    mode: "launch_limit",
    environment: environmentFromToken(clientToken),
    clientToken,
    productId,
    priceId: standardPriceId,
    discountId: active ? earlyDiscountId : null,
    offerActive: active,
    displayPrice: active ? 19 : 29,
    standardPrice: 29,
    usageLimit: lookup.discount.usage_limit,
    timesUsed: lookup.discount.times_used
  });
}
