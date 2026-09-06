/* ===========================================================================
   Stripe webhook — fulfilment for a one-time digital purchase.
   ---------------------------------------------------------------------------
   Listens for `checkout.session.completed`, works out which app(s) were bought,
   mints a licence key for each, stores them, and emails them to the buyer.

   Zero dependencies: signature verification uses Web Crypto, Stripe and the
   email provider are called over plain `fetch`. That means this same file runs
   on Cloudflare Pages/Workers, Vercel Edge, Netlify Edge and Deno Deploy — see
   the adapters at the bottom.

   Required environment variables (set them as SECRETS, never in this repo):
     STRIPE_WEBHOOK_SECRET   whsec_...   Developers → Webhooks → your endpoint
     STRIPE_SECRET_KEY       sk_...      only used by the line-item fallback below
     STRIPE_LIVEMODE         "true"/"false" — optional but recommended. Asserts
                             the event's livemode matches this deployment, so a
                             sandbox purchase can never issue a real licence.
     RESEND_API_KEY          re_...      or swap sendEmail() for your provider
     FROM_EMAIL              "Throughline <hello@throughlinetools.com>"
     DELIVERY_ESTIMATE       "Q2 2027" — while pre-ordering, the date promised in
                             the receipt. Keep it identical to config.js, or the
                             page and the receipt will contradict each other.
     PREORDER                "true" while the apps are unreleased. Switches the
                             receipt from a download link to an order confirmation.
   Optional bindings:
     LICENCES                Cloudflare KV namespace — stores keys + idempotency
=========================================================================== */

const TOLERANCE_SECONDS = 300; // reject replayed events older than 5 minutes

/* What we sell. `apps` is what a purchase of that SKU actually unlocks, so the
   bundle is one row here rather than a special case scattered through the code. */
const CATALOGUE = {
  progression: { label: "Throughline Progression", apps: ["progression"] },
  balance:     { label: "Throughline Balance",     apps: ["balance"] },
  bundle:      { label: "Throughline Progression + Balance", apps: ["progression", "balance"] }
};

/* Licence key prefixes, so a key tells you what it opens at a glance. */
const KEY_PREFIX = { progression: "GP", balance: "GB" };

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

  // Test and live are separate worlds with separate signing secrets, so a
  // mismatch here normally means a misconfigured deployment — most likely the
  // test secret pasted into production. Without this, a sandbox purchase would
  // mint a real licence in the production store. 400, not 500: retrying a test
  // event against a live endpoint will never start working.
  if (env.STRIPE_LIVEMODE !== undefined) {
    const expectLive = String(env.STRIPE_LIVEMODE) === "true";
    if (Boolean(event.livemode) !== expectLive) {
      console.error(
        `Rejected ${event.livemode ? "live" : "test"} event ${event.id} on an endpoint ` +
        `configured for ${expectLive ? "live" : "test"}. Check STRIPE_WEBHOOK_SECRET.`
      );
      return new Response("Livemode mismatch", { status: 400 });
    }
  }

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

  const sku = await resolveSku(session, env);
  const product = CATALOGUE[sku];
  if (!product) throw new Error(`Unrecognised SKU "${sku}" on session ${session.id}`);

  // One key per app, so a bundle buyer can be given Balance-only support later
  // without reissuing the key that unlocks Progression.
  const keys = product.apps.map(app => ({ app, key: makeLicenceKey(KEY_PREFIX[app]) }));

  if (env.LICENCES) {
    for (const { app, key } of keys) {
      await env.LICENCES.put(`licence:${key}`, JSON.stringify({
        app,
        sku,
        email,
        sessionId: session.id,
        amountTotal: session.amount_total,
        currency: session.currency,
        issuedAt: new Date().toISOString()
      }));
    }
    // Reverse index so support can find a buyer's keys from their email alone.
    await env.LICENCES.put(
      `email:${email.toLowerCase()}`,
      JSON.stringify(keys.map(k => ({ app: k.app, key: k.key })))
    );
  }

  await sendEmail(env, email, product, keys);
}

/* Which SKU was this?

   Preferred: `metadata.product` on the Payment Link, which Stripe copies onto
   the session. No API call, no secret key, works offline in tests.

   Fallback: ask Stripe for the session's line items and match on the price ID.
   Only runs when metadata is missing — e.g. a link created before you started
   setting it — and needs STRIPE_SECRET_KEY plus a PRICE_<SKU> mapping. */
async function resolveSku(session, env) {
  const fromMetadata = session.metadata?.product;
  if (fromMetadata) return fromMetadata;

  if (!env.STRIPE_SECRET_KEY) {
    throw new Error(
      `Session ${session.id} has no metadata.product and no STRIPE_SECRET_KEY to look it up. ` +
      `Set metadata.product on the Payment Link — see STRIPE.md.`
    );
  }

  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${session.id}/line_items?limit=10`,
    { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } }
  );
  if (!res.ok) throw new Error(`Line-item lookup failed: ${res.status} ${await res.text()}`);

  const { data = [] } = await res.json();
  for (const item of data) {
    const priceId = item.price?.id;
    for (const sku of Object.keys(CATALOGUE)) {
      if (priceId && env[`PRICE_${sku.toUpperCase()}`] === priceId) return sku;
    }
  }
  throw new Error(`No SKU matched the line items on session ${session.id}`);
}

/* ----------------------------------------------------------- licence keys */
function makeLicenceKey(prefix = "PF") {
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
async function sendEmail(env, to, product, keys) {
  const preorder = String(env.PREORDER) === "true";
  const eta = env.DELIVERY_ESTIMATE || "a date I'll confirm shortly";

  const rows = keys.map(({ app, key }) => `
    <p style="margin:18px 0 4px;color:#555">${CATALOGUE[app].label}</p>
    <p style="font:600 18px ui-monospace,Menlo,monospace;background:#f4f4f7;
              padding:14px 18px;border-radius:8px;display:inline-block;margin:0">${key}</p>`).join("");

  // Two different emails. A pre-order receipt that links a download would be a
  // broken promise in the buyer's inbox, and "where is my download" is the most
  // expensive support mail there is.
  const body = preorder
    ? `<p>Thanks for pre-ordering ${product.label}.</p>
       <p><strong>This is an order confirmation, not a delivery.</strong> The software isn't
          released yet — that's what you pre-ordered. I'll email the build to this address when
          it's ready, currently estimated <strong>${eta}</strong>.</p>
       <p>Your licence key${keys.length > 1 ? "s" : ""}, for your records — you'll need
          ${keys.length > 1 ? "them" : "it"} when the build arrives:</p>
       ${rows}
       <p style="margin-top:24px">Your founding price is locked: every update through 1.0 and the
          whole 1.x line is included, at what you paid today.</p>
       <p>If the date moves, you'll hear it from me. And you can have a full refund at any point
          before delivery — just reply to this email. No form, no questions.</p>`
    : `<p>Thanks for buying ${product.label}.</p>
       <p>Your licence key${keys.length > 1 ? "s" : ""}:</p>
       ${rows}
       <p style="margin-top:24px"><a href="https://throughlinetools.com/download">Download your apps</a></p>
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
      subject: preorder ? `Your ${product.label} pre-order` : `Your ${product.label} licence`,
      html: body
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

export { CATALOGUE }; // exported for the test harness

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
