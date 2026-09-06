/* ---------------------------------------------------------------------------
   End-to-end test of the Stripe fulfilment webhook — no Stripe account needed.

   Signs payloads with a real HMAC in Stripe's exact Stripe-Signature format,
   pushes them through the actual handler, and asserts on what comes out: the
   right licence keys, the right email, and the right behaviour when things go
   wrong. Run with:  npm test
--------------------------------------------------------------------------- */
import crypto from "node:crypto";
import { handleStripeWebhook, CATALOGUE } from "../functions/api/stripe-webhook.js";

const SECRET = "whsec_localtestsecret";
let pass = 0, fail = 0;

/* ------------------------------------------------------------- utilities */
function sign(payload, secret = SECRET, t = Math.floor(Date.now() / 1000)) {
  const mac = crypto.createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  return `t=${t},v1=${mac}`;
}

function sessionEvent({ id, product, email = "buyer@example.com", status = "paid", amount = 1900, livemode = false }) {
  return JSON.stringify({
    id,
    type: "checkout.session.completed",
    livemode,
    data: {
      object: {
        id: `cs_test_${id}`,
        payment_status: status,
        amount_total: amount,
        currency: "usd",
        customer_details: { email },
        metadata: product ? { product } : {}
      }
    }
  });
}

function makeEnv() {
  const kv = new Map();
  const sent = [];
  return {
    kv, sent,
    env: {
      STRIPE_WEBHOOK_SECRET: SECRET,
      RESEND_API_KEY: "re_test",
      FROM_EMAIL: "Throughline <hello@example.com>",
      LICENCES: {
        get: async k => kv.get(k) ?? null,
        put: async (k, v) => void kv.set(k, v)
      }
    },
    install() {
      globalThis.fetch = async (url, opts) => {
        sent.push({ url, body: JSON.parse(opts.body) });
        return { ok: true, status: 200, text: async () => "" };
      };
    }
  };
}

const post = (body, sig) =>
  new Request("https://example.com/api/stripe-webhook", {
    method: "POST", body, headers: sig ? { "stripe-signature": sig } : {}
  });

async function check(name, fn) {
  // Several tests deliberately drive the handler down its failure paths, where
  // it logs. Capture that noise and only replay it if the test actually fails.
  const realError = console.error;
  const captured = [];
  console.error = (...args) => captured.push(args.map(String).join(" "));

  let ok = false, detail = "";
  try { ok = await fn(); }
  catch (err) { detail = ` — threw: ${err.message}`; }
  finally { console.error = realError; }

  if (ok) { pass++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  else {
    fail++;
    console.log(`  \x1b[31m✗ ${name}${detail}\x1b[0m`);
    captured.forEach(line => console.log(`      ${line.split("\n")[0]}`));
  }
}

/* ------------------------------------------------------------- the tests */
console.log("\nFulfilment — what the buyer gets");

for (const [sku, product] of Object.entries(CATALOGUE)) {
  await check(`"${sku}" issues ${product.apps.length} key(s) and emails them`, async () => {
    const h = makeEnv(); h.install();
    const body = sessionEvent({ id: `evt_${sku}`, product: sku });
    const res = await handleStripeWebhook(post(body, sign(body)), h.env);
    if (res.status !== 200 || h.sent.length !== 1) return false;

    const stored = [...h.kv.keys()].filter(k => k.startsWith("licence:"));
    if (stored.length !== product.apps.length) return false;

    // Every app in the SKU must appear as its own key, with the right prefix.
    const prefixes = { progression: "GP", balance: "GB" };
    return product.apps.every(app =>
      stored.some(k => k.startsWith(`licence:${prefixes[app]}-`)) &&
      h.sent[0].body.html.includes(CATALOGUE[app].label)
    );
  });
}

await check("bundle stores both keys against the buyer's email", async () => {
  const h = makeEnv(); h.install();
  const body = sessionEvent({ id: "evt_bundle_idx", product: "bundle", amount: 4900 });
  await handleStripeWebhook(post(body, sign(body)), h.env);
  const index = JSON.parse(h.kv.get("email:buyer@example.com"));
  return index.length === 2 &&
         index.some(e => e.app === "progression") &&
         index.some(e => e.app === "balance");
});

await check("licence keys are unique across purchases", async () => {
  const seen = new Set();
  for (let i = 0; i < 25; i++) {
    const h = makeEnv(); h.install();
    const body = sessionEvent({ id: `evt_uniq_${i}`, product: "progression" });
    await handleStripeWebhook(post(body, sign(body)), h.env);
    for (const k of h.kv.keys()) if (k.startsWith("licence:")) {
      if (seen.has(k)) return false;
      seen.add(k);
    }
  }
  return seen.size === 25;
});

console.log("\nSecurity — what a forged request gets");

await check("tampered payload is rejected (400)", async () => {
  const h = makeEnv(); h.install();
  const body = sessionEvent({ id: "evt_tamper", product: "progression" });
  const sig = sign(body);
  const swapped = body.replace('"progression"', '"bundle"'); // try to upgrade the order
  const res = await handleStripeWebhook(post(swapped, sig), h.env);
  return res.status === 400 && h.sent.length === 0;
});

await check("wrong signing secret is rejected (400)", async () => {
  const h = makeEnv(); h.install();
  const body = sessionEvent({ id: "evt_wrongsecret", product: "bundle" });
  const res = await handleStripeWebhook(post(body, sign(body, "whsec_attacker")), h.env);
  return res.status === 400 && h.sent.length === 0;
});

await check("missing signature header is rejected (400)", async () => {
  const h = makeEnv(); h.install();
  const body = sessionEvent({ id: "evt_nosig", product: "balance" });
  return (await handleStripeWebhook(post(body, null), h.env)).status === 400;
});

await check("replayed old event is rejected (400)", async () => {
  const h = makeEnv(); h.install();
  const body = sessionEvent({ id: "evt_stale", product: "balance" });
  const old = sign(body, SECRET, Math.floor(Date.now() / 1000) - 600);
  return (await handleStripeWebhook(post(body, old), h.env)).status === 400;
});

await check("signing-secret rotation: either valid v1 is accepted", async () => {
  const h = makeEnv(); h.install();
  const body = sessionEvent({ id: "evt_rotate", product: "progression" });
  const t = Math.floor(Date.now() / 1000);
  const oldMac = crypto.createHmac("sha256", "whsec_previous").update(`${t}.${body}`).digest("hex");
  const newMac = crypto.createHmac("sha256", SECRET).update(`${t}.${body}`).digest("hex");
  const res = await handleStripeWebhook(post(body, `t=${t},v1=${oldMac},v1=${newMac}`), h.env);
  return res.status === 200;
});

console.log("\nPre-order receipts");

await check("pre-order receipt promises no download and states the date", async () => {
  const h = makeEnv(); h.install();
  h.env.PREORDER = "true";
  h.env.DELIVERY_ESTIMATE = "Q2 2027";
  const body = sessionEvent({ id: "evt_preorder", product: "bundle" });
  await handleStripeWebhook(post(body, sign(body)), h.env);
  const { subject, html } = h.sent[0].body;
  return /pre-order/i.test(subject)
      && html.includes("Q2 2027")
      && /order confirmation, not a delivery/i.test(html)
      && !/\/download/.test(html);            // the broken-promise link must be absent
});

await check("pre-order receipt still carries both bundle keys", async () => {
  const h = makeEnv(); h.install();
  h.env.PREORDER = "true";
  const body = sessionEvent({ id: "evt_preorder_keys", product: "bundle" });
  await handleStripeWebhook(post(body, sign(body)), h.env);
  const html = h.sent[0].body.html;
  return (html.match(/GP-[A-Z2-9]{4}/) && html.match(/GB-[A-Z2-9]{4}/)) !== null
      && html.includes(CATALOGUE.progression.label)
      && html.includes(CATALOGUE.balance.label);
});

await check("released mode still sends a download link", async () => {
  const h = makeEnv(); h.install();          // PREORDER unset
  const body = sessionEvent({ id: "evt_released", product: "progression" });
  await handleStripeWebhook(post(body, sign(body)), h.env);
  const { subject, html } = h.sent[0].body;
  return /licence/i.test(subject) && /\/download/.test(html)
      && !/order confirmation, not a delivery/i.test(html);
});

await check("missing DELIVERY_ESTIMATE degrades to a phrase, not 'undefined'", async () => {
  const h = makeEnv(); h.install();
  h.env.PREORDER = "true";                    // no DELIVERY_ESTIMATE
  const body = sessionEvent({ id: "evt_nodate", product: "balance" });
  await handleStripeWebhook(post(body, sign(body)), h.env);
  return !/undefined/.test(h.sent[0].body.html);
});

console.log("\nTest/live separation");

await check("test event is refused on a live-configured endpoint (400)", async () => {
  const h = makeEnv(); h.install();
  h.env.STRIPE_LIVEMODE = "true";
  const body = sessionEvent({ id: "evt_testonlive", product: "bundle", livemode: false });
  const res = await handleStripeWebhook(post(body, sign(body)), h.env);
  return res.status === 400 && h.sent.length === 0;
});

await check("live event is refused on a test-configured endpoint (400)", async () => {
  const h = makeEnv(); h.install();
  h.env.STRIPE_LIVEMODE = "false";
  const body = sessionEvent({ id: "evt_liveontest", product: "bundle", livemode: true });
  const res = await handleStripeWebhook(post(body, sign(body)), h.env);
  return res.status === 400 && h.sent.length === 0;
});

await check("matching livemode is fulfilled normally", async () => {
  const h = makeEnv(); h.install();
  h.env.STRIPE_LIVEMODE = "true";
  const body = sessionEvent({ id: "evt_livematch", product: "progression", livemode: true });
  const res = await handleStripeWebhook(post(body, sign(body)), h.env);
  return res.status === 200 && h.sent.length === 1;
});

await check("guard is inert when STRIPE_LIVEMODE is unset", async () => {
  const h = makeEnv(); h.install();               // no STRIPE_LIVEMODE
  const body = sessionEvent({ id: "evt_noguard", product: "balance", livemode: true });
  const res = await handleStripeWebhook(post(body, sign(body)), h.env);
  return res.status === 200 && h.sent.length === 1;
});

console.log("\nDelivery guarantees — Stripe retries and edge cases");

await check("same event delivered twice issues only one set of keys", async () => {
  const h = makeEnv(); h.install();
  const body = sessionEvent({ id: "evt_dupe", product: "bundle" });
  const sig = sign(body);
  await handleStripeWebhook(post(body, sig), h.env);
  const res = await handleStripeWebhook(post(body, sig), h.env);
  return res.status === 200 && h.sent.length === 1;
});

await check("unpaid session ships nothing", async () => {
  const h = makeEnv(); h.install();
  const body = sessionEvent({ id: "evt_unpaid", product: "bundle", status: "unpaid" });
  const res = await handleStripeWebhook(post(body, sign(body)), h.env);
  return res.status === 200 && h.sent.length === 0 && h.kv.size === 1; // event marker only
});

await check("unknown SKU fails loudly (500) rather than shipping nothing", async () => {
  const h = makeEnv(); h.install();
  const body = sessionEvent({ id: "evt_badsku", product: "not_a_product" });
  const res = await handleStripeWebhook(post(body, sign(body)), h.env);
  return res.status === 500 && h.sent.length === 0;
});

await check("missing metadata without a secret key fails loudly (500)", async () => {
  const h = makeEnv(); h.install();
  const body = sessionEvent({ id: "evt_nometa", product: null });
  return (await handleStripeWebhook(post(body, sign(body)), h.env)).status === 500;
});

await check("email outage returns 500 so Stripe retries, and no dedupe marker is left", async () => {
  const h = makeEnv();
  globalThis.fetch = async () => ({ ok: false, status: 503, text: async () => "unavailable" });
  const body = sessionEvent({ id: "evt_mailfail", product: "progression" });
  const res = await handleStripeWebhook(post(body, sign(body)), h.env);
  return res.status === 500 && !h.kv.has("event:evt_mailfail");
});

await check("retry after an outage succeeds and delivers", async () => {
  const h = makeEnv();
  globalThis.fetch = async () => ({ ok: false, status: 503, text: async () => "unavailable" });
  const body = sessionEvent({ id: "evt_recover", product: "balance" });
  const sig = sign(body);
  await handleStripeWebhook(post(body, sig), h.env);   // fails
  h.install();                                          // provider recovers
  const res = await handleStripeWebhook(post(body, sig), h.env);
  return res.status === 200 && h.sent.length === 1;
});

await check("unrelated event types are acknowledged and ignored", async () => {
  const h = makeEnv(); h.install();
  const body = JSON.stringify({ id: "evt_other", type: "payment_intent.created", data: { object: {} } });
  const res = await handleStripeWebhook(post(body, sign(body)), h.env);
  return res.status === 200 && h.sent.length === 0;
});

await check("GET is refused (405)", async () => {
  const h = makeEnv(); h.install();
  const res = await handleStripeWebhook(new Request("https://example.com/api/stripe-webhook"), h.env);
  return res.status === 405;
});

/* --------------------------------------------------------------- summary */
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
