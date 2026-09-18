# Rainnight Labs — Phase 1 Website

This repository contains the first deployable website for **Rainnight Labs**.

## Purpose

Phase 1 is intentionally simple. It gives us a real HTTPS website that can later be connected to:

- `rainnightlabs.com`
- Paddle Sandbox / Live Checkout
- List2Sheet licensing
- Chrome Web Store and Microsoft Edge Add-ons
- future digital assets

## Current pages

- `/` — Rainnight Labs home
- `/products/` — products
- `/products/list2sheet/` — List2Sheet
- `/pricing/` — pricing
- `/privacy/` — privacy policy
- `/terms/` — terms
- `/refund/` — refund policy
- `/contact/` — contact

## Deploy to Vercel

1. Create a GitHub repository.
2. Upload the contents of this folder to the repository root.
3. In Vercel choose **Add New → Project**.
4. Import the GitHub repository.
5. Framework preset: **Other**.
6. Leave Build Command empty.
7. Leave Output Directory empty.
8. Deploy.

Vercel should produce an address such as:

```text
https://rainnightlabs-site.vercel.app
```

## Later: connect the domain

Do this only after the Vercel deployment works:

1. Vercel → Project → Settings → Domains.
2. Add:
   - `rainnightlabs.com`
   - `www.rainnightlabs.com`
3. Vercel will show the exact DNS records.
4. Add those DNS records in Dynadot.
5. Wait until Vercel shows **Valid Configuration**.

Do not copy DNS values from random tutorials. Use the values Vercel shows for this project.

## Paddle integration

The first site version does **not** contain a live payment credential.

The upgrade buttons currently point to placeholders. We will add Paddle only after:

1. the site is deployed;
2. Paddle Sandbox is created;
3. List2Sheet Pro exists as a Sandbox product/price;
4. we have the Sandbox client-side token and price ID.

Never commit Paddle API keys or webhook secrets to GitHub.

## Brand

**Rainnight Labs**  
Website: https://rainnightlabs.com  
Support: admin@rainnightlabs.com
