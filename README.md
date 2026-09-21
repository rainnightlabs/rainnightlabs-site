# Rainnight Labs — Phase 1 Website

This repository contains the first deployable website for **Rainnight Labs**.

## Current state

- Brand domain: `https://rainnightlabs.com`
- Vercel production deployment: active
- Paddle environment: Sandbox
- List2Sheet launch offer: **first 500 completed purchases at $19 USD one-time**\n- Standard price after the launch offer: **$29 USD one-time**
- Paddle product ID: `pro_01m2t1wm8w2hfh4apxcr3fdj5j`
- Paddle price ID: `pri_01m2t1zv55fefxr0dw8m7jm63c`

## Current pages

- `/` — Rainnight Labs home
- `/products/` — products
- `/products/list2sheet/` — List2Sheet
- `/pricing/` — pricing and Paddle Sandbox checkout
- `/privacy/` — privacy policy
- `/terms/` — terms
- `/refund/` — refund policy
- `/contact/` — contact

## Paddle integration

The legacy public Paddle Sandbox identifiers live in `assets/paddle-config.js`. Checkout now prefers `/api/checkout-config/`, which can switch automatically from the limited launch discount to the standard price.

The remaining frontend requirement is a **Sandbox client-side token** from:

`Paddle → Developer tools → Authentication → Client-side tokens`

Client-side tokens are designed to be used in frontend code. Do **not** put Paddle API keys or webhook secrets in this repository.

The next backend phase is:

1. Open a real Paddle Sandbox checkout.
2. Confirm a test transaction.
3. Configure a webhook destination.
4. Verify webhook signatures server-side.
5. Generate and validate List2Sheet licenses.

## Brand

**Rainnight Labs**  
Website: https://rainnightlabs.com  
Support: admin@rainnightlabs.com


Git deployment link confirmed on 2026-09-18.


## First-500 pricing configuration

The pricing flow is feature-gated by Vercel environment variables. Until these are configured, Sandbox continues using the legacy $19 test price.

Required for the limited launch offer:

- `LIST2SHEET_STANDARD_PRICE_ID` — the Paddle $29 one-time List2Sheet Pro price ID.
- `LIST2SHEET_EARLY_DISCOUNT_ID` — the Paddle $10 flat discount ID, restricted to List2Sheet Pro and configured with `usage_limit=500`.
- `PADDLE_CLIENT_TOKEN` — public Paddle.js client-side token for the active environment (optional in Sandbox while the legacy token is used).
- `LIST2SHEET_PRODUCT_ID` — Paddle product ID (optional while the existing List2Sheet product is unchanged).
- `LIST2SHEET_PRICE_IDS` — optional comma-separated additional historical price IDs accepted by license verification.

The server-side `PADDLE_API_KEY` also needs `discount.read` in addition to the transaction/customer permissions already used by licensing. The API key remains server-side only.

At checkout, Rainnight Labs queries the discount's current `times_used` and `usage_limit`. While the discount is active and below its limit, the $10 discount is applied automatically to the $29 price. When the limit is reached, checkout automatically falls through to $29.
