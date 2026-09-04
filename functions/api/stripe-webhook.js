/* ===========================================================================
   Stripe webhook — fulfilment for a one-time digital purchase.
   ---------------------------------------------------------------------------
   Listens for `checkout.session.completed`, mints a licence key, stores it,
   and emails it to the buyer.

   Zero dependencies: signature verification uses Web Crypto, Stripe and the
   email provider are called over plain `fetch`. That means this same file runs
   on Cloudflare Pages/Workers, Vercel Edge, Netlify Edge and Deno Deploy — see
   the adapters at the bottom.

   Required environment variables (set them as SECRETS, never in this repo):
     STRIPE_WEBHOOK_SECRET   whsec_...   Developers → Webhooks → your endpoint
     STRIPE_SECRET_KEY       sk_live_... only needed if you call back to Stripe
     RESEND_API_KEY          re_...      or swap sendEmail() for your provider
     FROM_EMAIL              "Nightfall <hello@yourdomain.com>"
   Optional bindings:
     LICENCES                Cloudflare KV namespace — stores keys + idempotency
=========================================================================== */

const TOLERANCE_SECONDS = 300; // reject replayed events older than 5 minutes

/* ---------------------------------------------------------------- handler */
export async function handleStripeWebhook(request, env) {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  // The raw body is required — parsing it first would break the signature.
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  const ok = await verifySignature(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  if (!ok) {
    // 400 tells Stripe not to retry: a bad signature will never become good.
    return new Response("Invalid signature", { status: 400 });
  }

  let event;
  try { event = JSON.parse(rawBody); }
  catch { return new Response("Malformed payload", { status: 400 }); }

  // Stripe retries on any non-2xx, and may deliver the same event twice even on
  // success. Without this guard a network blip means the buyer gets two keys.
  if (env.LICENCES && await env.LICENCES.get(`event:${event.id}`)) {
    return json({ received: true, deduped: true });
  }

  try {
    if (event.type === "checkout.session.completed") {
      await fulfil(event.data.object, env);
    }
    // Any other event type is acknowledged and ignored, so Stripe stops retrying.
  } catch (err) {
    // 500 makes Stripe retry with backoff — the right call for a transient
    // failure (email provider down, KV write failed). Log it so you can see it.
    console.error("Fulfilment failed", event.id, err);
    return new Response("Fulfilment failed", { status: 500 });
  }

  if (env.LICENCES) {
    // 3-day TTL comfortably outstrips Stripe's retry window.
    await env.LICENCES.put(`event:${event.id}`, "1", { expirationTtl: 60 * 60 * 24 * 3 });
  }
  return json({ received: true });
}

/* -------------------------------------------------------------- fulfilment */
async function fulfil(session, env) {
  // `payment_status` matters: a session can complete with payment still pending
  // for delayed methods (bank debits). Don't ship the goods until it's paid.
  if (session.payment_status !== "paid") return;

  const email = session.customer_details?.email || session.customer_email;
  if (!email) throw new Error(`No email on session ${session.id}`);

  const key = makeLicenceKey();

  if (env.LICENCES) {
    await env.LICENCES.put(`licence:${key}`, JSON.stringify({
      email,
      sessionId: session.id,
      amountTotal: session.amount_total,
      currency: session.currency,
      issuedAt: new Date().toISOString()
    }));
    // Reverse index so support can find a buyer's key from their email.
    await env.LICENCES.put(`email:${email.toLowerCase()}`, key);
  }

  await sendEmail(env, email, key);
}

/* ----------------------------------------------------------- licence keys */
function makeLicenceKey(prefix = "NGHT") {
  // Crockford-ish alphabet: no I, L, O, 0 or 1, so keys survive being read
  // aloud on a support call or retyped from a screenshot.
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  let out = "";
  for (let i = 0; i < 12; i++) {
    out += alphabet[bytes[i] % alphabet.length];
    if (i % 4 === 3 && i < 11) out += "-";
  }
  return `${prefix}-${out}`; // ~59 bits of entropy — fine for a licence key
}

/* ----------------------------------------------------------------- email */
async function sendEmail(env, to, key) {
  const html = `
    <p>Thanks for buying Nightfall.</p>
    <p>Your licence key:</p>
    <p style="font:600 18px ui-monospace,Menlo,monospace;background:#f4f4f7;
              padding:14px 18px;border-radius:8px;display:inline-block">${key}</p>
    <p><a href="https://yourdomain.com/download">Download Nightfall</a></p>
    <p>Any trouble at all, just reply to this email. 30-day refunds, no questions.</p>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL,
      to,
      subject: "Your Nightfall licence key",
      html
    })
  });

  // Throwing here returns a 500 above, so Stripe retries and the buyer still
  // gets their key once the provider recovers.
  if (!res.ok) throw new Error(`Email send failed: ${res.status} ${await res.text()}`);
}

/* --------------------------------------------------- signature verification
   Stripe-Signature: t=1699999999,v1=<hex>,v1=<hex during secret rotation>
   signed payload = "<t>.<raw body>", HMAC-SHA256 with the endpoint secret.   */
async function verifySignature(rawBody, header, secret) {
  if (!header || !secret) return false;

  let timestamp = null;
  const signatures = [];
  for (const part of header.split(",")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k === "t") timestamp = v;
    else if (k === "v1") signatures.push(v);
  }
  if (!timestamp || signatures.length === 0) return false;

  // Reject stale events so a captured request can't be replayed later.
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) return false;

  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(`${timestamp}.${rawBody}`));
  const expected = [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, "0")).join("");

  return signatures.some(sig => timingSafeEqual(sig, expected));
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json" }
  });
}

/* ================================ adapters ================================
   Cloudflare Pages Functions (this file at functions/api/stripe-webhook.js
   serves POST /api/stripe-webhook) — active by default:                     */
export const onRequestPost = ({ request, env }) => handleStripeWebhook(request, env);

/* Vercel Edge — move to api/stripe-webhook.js and use instead:
     export const config = { runtime: "edge" };
     export default (request) => handleStripeWebhook(request, process.env);

   Netlify Edge — move to netlify/edge-functions/stripe-webhook.js:
     export default (request) => handleStripeWebhook(request, Deno.env.toObject());

   Node (Express) — you must pass the RAW body, not a parsed one:
     app.post("/api/stripe-webhook", express.raw({ type: "application/json" }), ...)
========================================================================== */
