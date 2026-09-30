# Extension Monetization Kit — Storefront Setup

This document covers only the Rainnight Labs storefront for the paid Kit. It does not replace the buyer-facing setup docs inside the Kit.

## 1. Paddle catalog

Create a separate Paddle product:

- Name: `Rainnight Extension Monetization Kit`
- Description: `Commercialization infrastructure for turning an existing Chrome extension into a paid product.`
- Price name: `Early Access — One-time`
- Currency: USD
- Amount: $39.00
- Billing: one-time / non-recurring
- Quantity: 1

Do this in Sandbox first. Sandbox and Live use separate catalog IDs and credentials.

## 2. Vercel environment variables

Preview / Sandbox:

```
EXTENSION_KIT_CLIENT_TOKEN=test_...
EXTENSION_KIT_PRODUCT_ID=pro_...
EXTENSION_KIT_PRICE_ID=pri_...
EXTENSION_KIT_PADDLE_API_KEY=pdl_sdbx_...
BLOB_READ_WRITE_TOKEN=...
EXTENSION_KIT_BLOB_PATH=...
```

Production / Live:

```
EXTENSION_KIT_CLIENT_TOKEN=live_...
EXTENSION_KIT_PRODUCT_ID=pro_...
EXTENSION_KIT_PRICE_ID=pri_...
EXTENSION_KIT_PADDLE_API_KEY=pdl_live_...
BLOB_READ_WRITE_TOKEN=...
EXTENSION_KIT_BLOB_PATH=...
```

Never put `EXTENSION_KIT_PADDLE_API_KEY` or `BLOB_READ_WRITE_TOKEN` in browser JavaScript.

## 3. Required test sequence

1. Deploy the branch with Sandbox variables.
2. Open `/products/extension-monetization-kit/`.
3. Complete one Sandbox checkout.
4. Confirm the transaction belongs to `EXTENSION_KIT_PRICE_ID`.
5. Confirm the buyer receives a short-lived private ZIP URL.
6. Use the recovery form with transaction ID + purchase email and confirm a fresh URL is issued.
7. Refund the Sandbox transaction and confirm download recovery is rejected.
8. Only then configure Live variables.
9. Run one controlled real $39 purchase and verify private delivery.
10. Merge the sales branch after the real purchase path passes.

## 4. Product release rule

Do not merge this storefront to production while any required product/delivery environment variable is missing.
