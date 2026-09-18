# Rainnight Labs — Phase 1 Website

This repository contains the first deployable website for **Rainnight Labs**.

## Current state

- Brand domain: `https://rainnightlabs.com`
- Vercel production deployment: active
- Paddle environment: Sandbox
- List2Sheet validation price: **$19 USD one-time**
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

The public Paddle Sandbox identifiers live in `assets/paddle-config.js`.

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
