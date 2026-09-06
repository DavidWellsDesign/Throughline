# Integrating Stripe

## Short version

Three things are for sale — Game Progression, Game Balance, and the bundle — so you create three
Stripe Payment Links and paste them into [`config.js`](config.js):

```js
testMode: true,
checkout: {
  progression: "https://buy.stripe.com/test_eVq9AVa510KefFV3fc4Rq00",
  balance:     "https://buy.stripe.com/test_14AdRbelhfF851h2b84Rq01",
  bundle:      "https://buy.stripe.com/test_5kQ14pgtp3WqgJZdTQ4Rq02"
}
```

Those three sandbox links already exist and are wired up — see "What's already set up" below.

Every `data-buy` button on the page picks them up. No backend, no keys in the frontend.

The one thing you **must** get right: set **`metadata.product`** on each Payment Link to
`progression`, `balance` or `bundle`. That is how the webhook knows which app(s) to issue keys
for. It's covered in Step 1.

The actual work is **fulfilment** — getting the buyer their licence keys and download. That's
[`functions/api/stripe-webhook.js`](functions/api/stripe-webhook.js), and it already handles the
bundle issuing two keys.

---

## Testing payments today, without touching Stripe

Before you create a single link, you can prove the fulfilment logic works:

```bash
npm test
```

That signs payloads with a real HMAC in Stripe's exact `Stripe-Signature` format and pushes them
through the actual handler. 18 checks: each SKU issues the right number of keys with the right
prefixes, the bundle indexes both against the buyer's email, forged and replayed signatures are
refused, a duplicate delivery doesn't double-issue, and an email-provider outage returns 500 so
Stripe retries rather than silently swallowing the order.

It needs no Stripe account, no API key and no network. Run it after any change to the webhook.

---

## What's already set up (sandbox / test mode)

Created in the **David Wells sandbox** account — nothing was touched in live mode.

| SKU           | Product                           | Price | Product ID            | Price ID                         |
| ------------- | --------------------------------- | ----- | --------------------- | -------------------------------- |
| `progression` | Throughline Progression           | $19   | `prod_VCaOzrtsb40e9x` | `price_1UCBDoQeBWmfPHBfNLrwdEIW`  |
| `balance`     | Throughline Balance               | $19   | `prod_VCaOCtDarhoPmi` | `price_1UCBDxQeBWmfPHBfbY60aD1f`  |
| `bundle`      | Throughline Progression + Balance | $29   | `prod_VCaOVXpLKMxHJi` | `price_1UCBE6QeBWmfPHBfLbsxnBSh`  |

All three have `metadata.product` set, promotion codes enabled, statement descriptor `THROUGHLINE`,
and redirect after payment to:

```
https://throughlinetools.com/success.html?session_id={CHECKOUT_SESSION_ID}
```

That redirect only resolves once `throughlinetools.com` is attached to the Pages project as a
custom domain (dashboard → Pages → throughline-site → Custom domains). Until then a test purchase
completes and charges nothing, but lands on a dead page. The `*.pages.dev` URLs keep working
either way.

Payment Link ids, for updating the redirect later:

| SKU | Payment Link id |
| --- | --- |
| `progression` | `plink_1UCBEUQeBWmfPHBff5aVNlNl` |
| `balance` | `plink_1UCBEdQeBWmfPHBfhbvTdhxN` |
| `bundle` | `plink_1UCBEmQeBWmfPHBf8dV6Upvw` |

---

## On Stripe's managed-payments / merchant-of-record direction

**Update:** this is now live enough to appear in the API. Payment Links accept a
`managed_payments.enabled` boolean, documented as "Stripe's merchant of record solution". Your
three sandbox links currently have it **disabled** — I left it off because turning it on changes
who is legally selling and what the fee is, which is your call, not mine.

I still can't see the pricing or your country's eligibility from here — check the dashboard. But
the plan you described works: flip `managed_payments.enabled` to `true` on the links when you want
it, and nothing else about the integration changes.

What matters for your decision is this: **the integration is identical either way.** MoR is an
account-level setting about who is legally selling and who remits tax. Your page still points at a
hosted Stripe checkout URL; your webhook still receives `checkout.session.completed`. If you build
it now as below and switch MoR on later, you change a setting, not code.

So your plan is sound. One correction to the premise, though, since it affects *when* you act:

> "by the time there's any chance of me needing to pay tax"

There's no revenue threshold for EU or UK VAT on digital goods sold to consumers — it applies from
your first sale, not after some floor. In practice, the risk at low volume is small and plenty of
solo devs accept it knowingly. But the cheap insurance is to **turn on Stripe Tax from day one**
(~0.5% per transaction): it charges the correct rate at checkout and tracks your exposure per
jurisdiction, so if you do register later you aren't reconstructing two years of sales by hand.
Stripe Tax calculates and reports; it does not file returns for you. MoR does.

**Fee reality check:** the headline 2.9% + $0.30 is for domestic cards. International cards add
~1.5% and currency conversion ~1%. For a tool sold worldwide, budget an effective **~4%**. That
narrows the gap with a 5% MoR more than the headline suggests.

---

## Step 1 — Create three products and three Payment Links

Put the dashboard in **Test mode** first (toggle, top right). Everything below is repeated for
real in live mode once you're happy.

Dashboard → **Product catalogue** → *Add product*, three times:

| Product name                  | Price | `metadata.product` |
| ----------------------------- | ----- | ------------------ |
| Throughline Progression           | $19   | `progression`      |
| Throughline Balance               | $19   | `balance`          |
| Throughline Progression + Balance | $29   | `bundle`           |

Then **Payment Links** → *Create* for each one, and set:

- **Metadata** → add `product` = `progression` / `balance` / `bundle`.
  **This is the bit that matters.** The webhook reads it to decide which licence keys to issue;
  without it fulfilment fails loudly (by design — better a 500 and a retry than a wrong key).
- **After payment → Redirect to your site**: `https://throughlinetools.com/success.html`
- **Allow promotion codes** — on, so you can run a launch discount without new links
- **Collect tax automatically** — on, once Stripe Tax is set up (Step 3)
- Email is collected automatically; you need it for fulfilment

Copy the three URLs into `config.js` and leave `testMode: true`. A test link contains `/test_`,
which is also what the page's console audit checks for — it warns you if test links are still in
place with `testMode: false`, or if a live link is sitting behind `testMode: true`.

## Step 2 — The success page

[`success.html`](success.html) is already in the repo and styled to match. It deliberately says
"check your email" rather than showing the licence key: the webhook may not have fired yet when
the browser lands there, so rendering the key inline is a race you'd lose intermittently.

## Step 3 — Turn on Stripe Tax

Settings → **Tax**. Set your origin address and product tax category (digital goods /
*Software as a service* or *Downloadable software*, depending on how you deliver). Add tax
registrations as you acquire them. Stripe then charges the right rate per buyer automatically.

## Step 4 — Deploy the fulfilment webhook

[`functions/api/stripe-webhook.js`](functions/api/stripe-webhook.js) is dependency-free and runs as-is
on Cloudflare Pages Functions (adapters for Vercel Edge, Netlify Edge and Node are in a comment at
the bottom of the file). It:

1. verifies the Stripe signature with Web Crypto, rejecting stale or tampered payloads
2. de-duplicates by event ID, so a Stripe retry can't issue a second licence
3. reads `metadata.product`, mints one licence key **per app** (so the bundle yields two,
   prefixed `GP-` and `GB-`), and stores them in KV with a reverse index by email for support
4. emails it via Resend — swap `sendEmail()` for Postmark/SendGrid, it's one `fetch`
5. returns 500 on transient failure so Stripe retries with backoff

**Register it:** Developers → **Webhooks** → *Add endpoint* →
`https://throughlinetools.com/api/stripe-webhook`, event `checkout.session.completed`. Copy the signing
secret.

**Set secrets** (Cloudflare Pages → Settings → Environment variables, encrypted — never commit them):

```
STRIPE_WEBHOOK_SECRET=whsec_...
RESEND_API_KEY=re_...
FROM_EMAIL=Throughline <hello@throughlinetools.com>
```

Also set **`STRIPE_LIVEMODE`** — `true` on production, `false` on any test deployment. The webhook
asserts each event's mode matches, so a sandbox purchase can never mint a real licence if you ever
paste the wrong signing secret into the wrong environment.

`STRIPE_SECRET_KEY` is optional. It's only used by a fallback that looks up line items when a
session arrives with no `metadata.product` — useful if you ever create a link and forget.

And bind a KV namespace called `LICENCES`. The code degrades gracefully without it — you just lose
idempotency and the licence record, so don't ship without it.

## Step 5 — Delivering the actual file

Pick one:

- **Cloudflare R2 / S3 presigned URL** — put the build in a private bucket, generate a URL with a
  24-hour expiry inside the webhook, and email that link. Best default.
- **Private GitHub release** — email a token; simple if you're already publishing releases there.
- **itch.io download key** — if you also list there, generate a key via their API and let itch
  handle hosting, patching and the launcher.

Don't email the file as an attachment (size limits, spam filters) and don't put it at a guessable
public URL.

## Step 6 — The live test-mode run

`npm test` proves the logic. This proves the wiring: real Stripe, real checkout, real webhook.

Install the CLI (it isn't on this machine yet):

```bash
brew install stripe/stripe-cli/stripe
```

Then log in and forward events to your local function:

```bash
stripe login
stripe listen --forward-to localhost:8788/api/stripe-webhook
```

`stripe listen` prints a **different** signing secret starting `whsec_` — put that one in your
local env, not the dashboard's. Or skip local entirely — the links point at <https://throughlinetools.com>, so you can open the
site and buy something once the custom domain is attached. To iterate locally instead:

```bash
npx wrangler pages dev
```

Open the page, click a buy button, and pay with test card **4242 4242 4242 4242**, any future
expiry, any CVC, any postcode.

What to confirm:

- [ ] The test-mode banner is visible on the page
- [ ] The webhook secrets are set on the deployment (otherwise every event 400s)
- [ ] Checkout shows the right product name and price
- [ ] You land on `success.html`
- [ ] `stripe listen` logs `checkout.session.completed` and a **200** from your endpoint
- [ ] The licence email arrives, and a **bundle purchase contains two keys**
- [ ] Re-send the same event from the Stripe dashboard — you get **no second email**

Firing an event without paying, for a quick loop:

```bash
stripe trigger checkout.session.completed
```

Note that a triggered event carries Stripe's own fixture data with no `metadata.product`, so the
webhook will return 500 — that's the guard working, not a bug. Use a real test checkout to
exercise fulfilment end to end.

---

## Pre-order mode

The apps aren't released, so the site sells pre-orders. Three things must agree, or a buyer can
truthfully say they were misled — which is how a dispute becomes a lost dispute:

| Where | What it must say |
| --- | --- |
| The page | `preorder: true` and `deliveryEstimate` in `public/config.js` |
| The Stripe checkout | Each product's **description** opens with `PRE-ORDER — not yet released` and states the same date |
| The receipt email | `PREORDER=true` and `DELIVERY_ESTIMATE` env vars on the deployment |

`DELIVERY_ESTIMATE` and `config.js`'s `deliveryEstimate` are separate values that must be kept in
step by hand. Nothing enforces it — if you change one, change the other and the Stripe product
descriptions too.

**Refund policy is deliberately wider than usual:** full refund at any point before delivery, plus
30 days after. That's the honest trade for taking money ahead of the work, and it is much cheaper
than a chargeback (which costs the sale, a ~$15 fee, and counts against your dispute ratio).

**When you ship**, every buyer is already recorded. The KV `email:` index maps each buyer's address
to their licence keys:

```bash
npx wrangler kv key list --namespace-id 7e3241f188384d40aeb88778926f0a92 --prefix email:
```

## Going live: test and live are separate accounts

Nothing carries over. Your sandbox (`acct_1UC9EAQeBWmfPHBf`) and live account
(`acct_1UC9DuHUl30CqJha`) have independent product catalogues, Payment Links, webhook endpoints and
signing secrets. Going live means creating all of it a second time:

1. Three products with the same `metadata.product` values (`progression`, `balance`, `bundle`)
2. Three Payment Links, redirecting to your **real domain**, not `localhost:8000`
3. A live webhook endpoint, whose signing secret is different from the sandbox one
4. `STRIPE_LIVEMODE=true` on the production deployment

Test-mode data is also disposable — sandboxes can be reset or deleted, so don't keep anything you
care about there.

## Go-live checklist

- [ ] `testMode: false` in `config.js`
- [ ] Live-mode Payment Links in all three `checkout` slots (test links contain `/test_`)
- [ ] Redirect URL changed from the `*.pages.dev` preview to your real domain
- [ ] `metadata.product` set on all three **live** links — it does not carry over from test mode
- [ ] Webhook registered against the **live** endpoint, with the live signing secret
- [ ] Stripe Tax enabled and origin address set
- [ ] Terms, Privacy and Licence pages written — the footer links are `#` stubs, and Stripe expects
      real ones on an account taking payments
- [ ] Refund policy stated publicly (it's on the page already, keep it true)
- [ ] A real end-to-end purchase in live mode with your own card, then refund it
- [ ] Statement descriptor set to something buyers will recognise — a mystery line on a card
      statement is a chargeback waiting to happen
- [ ] `npm test` passing against the final webhook
- [ ] `STRIPE_LIVEMODE=true` set on production, `false` on any preview deployment
- [ ] `deliveryEstimate` in `config.js` is a real date, not the `Q2 2027` placeholder
- [ ] `PREORDER=true` and `DELIVERY_ESTIMATE` set on the deployment, matching `config.js`
- [ ] Live product descriptions carry the `PRE-ORDER — not yet released` prefix and the same date
- [ ] Terms and Refunds pages written, and they state the pre-order terms

## When to graduate from Payment Links

Payment Links stop being enough when you need to set price or metadata at click time — regional
pricing, seat counts, referral attribution, upsells. At that point add a small serverless endpoint
that calls `POST /v1/checkout/sessions` and redirects to the returned `url`, and point the buttons
at your endpoint instead. The webhook you already deployed doesn't change.
