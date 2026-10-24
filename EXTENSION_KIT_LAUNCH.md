# Extension Monetization Kit — Storefront Setup

This storefront intentionally reuses Rainnight Labs' existing Paddle authentication. Normally the only new Paddle values are the Kit's product ID and price ID.

## 1. Create the Kit product

Create a separate Paddle product:

- Name: `Rainnight Extension Monetization Kit`
- Description: `Commercialization infrastructure for turning an existing Chrome extension into a paid product.`
- Tax category: `standard` (pre-written downloadable software)
- Price name: `Early Access — One-time`
- Currency: USD
- Amount: $39.00
- Billing: one-time / non-recurring
- Quantity: 1

Create it in Sandbox first. Sandbox and Live have separate product/price IDs.

## 2. Vercel variables

New values normally required:

```
EXTENSION_KIT_PRODUCT_ID=pro_...
EXTENSION_KIT_PRICE_ID=pri_...
BLOB_READ_WRITE_TOKEN=...
EXTENSION_KIT_BLOB_PATH=...
```

The storefront falls back to Rainnight's existing `PADDLE_CLIENT_TOKEN` and `PADDLE_API_KEY`.

Optional overrides exist if the Kit ever needs separate Paddle credentials:

```
EXTENSION_KIT_CLIENT_TOKEN=
EXTENSION_KIT_PADDLE_API_KEY=
```

Never put API keys or Blob tokens in browser JavaScript.

## 3. Test order

1. Create Sandbox Product + $39 one-time Price.
2. Configure Sandbox `EXTENSION_KIT_PRODUCT_ID` and `EXTENSION_KIT_PRICE_ID` on the preview deployment.
3. Configure Private Blob delivery.
4. Complete Sandbox checkout.
5. Confirm private download.
6. Confirm recovery creates a fresh download URL.
7. Refund the Sandbox transaction and confirm recovery is rejected.
8. Create the same Product + Price in Live.
9. Configure the Live IDs.
10. Run one controlled real $39 purchase.
11. Merge the sales branch only after that passes.
