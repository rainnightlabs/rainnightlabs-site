import crypto from "node:crypto";

export const config = {
  api: {
    bodyParser: false
  }
};

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function parsePaddleSignature(header = "") {
  const parts = header.split(";").map((part) => part.trim());
  const ts = parts.find((part) => part.startsWith("ts="))?.slice(3);
  const signatures = parts
    .filter((part) => part.startsWith("h1="))
    .map((part) => part.slice(3))
    .filter(Boolean);
  return { ts, signatures };
}

function safeEqualHex(a, b) {
  try {
    const ab = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      service: "rainnight-paddle-webhook",
      configured: Boolean(process.env.PADDLE_WEBHOOK_SECRET_KEY)
    });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = process.env.PADDLE_WEBHOOK_SECRET_KEY;
  if (!secret) {
    console.error("PADDLE_WEBHOOK_SECRET_KEY is not configured");
    return res.status(500).json({ error: "Webhook secret is not configured" });
  }

  const signatureHeader = req.headers["paddle-signature"];
  if (!signatureHeader || typeof signatureHeader !== "string") {
    return res.status(400).json({ error: "Missing Paddle-Signature header" });
  }

  const rawBody = await readRawBody(req);
  const { ts, signatures } = parsePaddleSignature(signatureHeader);

  if (!ts || signatures.length === 0) {
    return res.status(400).json({ error: "Invalid Paddle-Signature header" });
  }

  const timestampSeconds = Number(ts);
  if (!Number.isFinite(timestampSeconds)) {
    return res.status(400).json({ error: "Invalid webhook timestamp" });
  }

  // Paddle SDKs use a short tolerance by default. Give Sandbox a little
  // breathing room while still rejecting stale replay attempts.
  const ageSeconds = Math.abs(Date.now() / 1000 - timestampSeconds);
  if (ageSeconds > 60) {
    return res.status(408).json({ error: "Webhook event expired" });
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${ts}:${rawBody}`, "utf8")
    .digest("hex");

  const verified = signatures.some((signature) => safeEqualHex(expected, signature));
  if (!verified) {
    return res.status(401).json({ error: "Invalid webhook signature" });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: "Invalid JSON payload" });
  }

  if (event.event_type === "transaction.completed") {
    const transaction = event.data || {};
    const customData = transaction.custom_data || {};

    // Phase 1: prove that the signed payment event reaches our backend.
    // Phase 2 will mint and deliver a List2Sheet license.
    console.log("PADDLE_TRANSACTION_COMPLETED", JSON.stringify({
      eventId: event.event_id,
      transactionId: transaction.id,
      customerId: transaction.customer_id,
      currencyCode: transaction.currency_code,
      product: customData.product || null,
      productId: customData.product_id || null,
      occurredAt: event.occurred_at
    }));
  } else {
    console.log("PADDLE_EVENT_RECEIVED", JSON.stringify({
      eventId: event.event_id,
      eventType: event.event_type,
      occurredAt: event.occurred_at
    }));
  }

  return res.status(200).json({ received: true });
}
