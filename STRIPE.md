# Integrating Stripe

## Short version

For a static landing page selling one digital product, the site-side integration is **one URL**.
Create a Payment Link in the Stripe Dashboard, paste it into [`config.js`](config.js), done:

```js
checkout: {
  indie: "https://buy.stripe.com/aBc123",
  pro:   "https://buy.stripe.com/dEf456",
  studio: null
}
```

Every `data-buy` button on the page picks it up. No backend, no keys in the frontend, no npm.

The actual work is **fulfilment** — getting the buyer their licence key and download. That's what
[`functions/api/stripe-webhook.js`](functions/api/stripe-webhook.js) handles.

---

## On Stripe's managed-payments / merchant-of-record direction

Stripe has been moving into merchant-of-record territory (they acquired Lemon Squeezy in 2024).
**I can't confirm the current product name, pricing, or availability in your country from here —
check your dashboard, since this moves fast.**

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

## Step 1 — Create the Payment Link

Dashboard → **Product catalogue** → *Add product*: name, price ($39), **One-off**. Repeat per tier.

Then **Payment Links** → *Create*, select the product, and set:

- **After payment → Redirect to your site**: `https://yourdomain.com/success.html`
  (append `?session_id={CHECKOUT_SESSION_ID}` if you later want to look the order up)
- **Allow promotion codes** — on, so you can run launch discounts without new links
- **Collect tax automatically** — on, once Stripe Tax is set up (Step 3)
- Email is collected automatically; you need it for fulfilment

Copy the URL into `config.js`.

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
3. mints a licence key, stores it in KV with a reverse index by email (for support)
4. emails it via Resend — swap `sendEmail()` for Postmark/SendGrid, it's one `fetch`
5. returns 500 on transient failure so Stripe retries with backoff

**Register it:** Developers → **Webhooks** → *Add endpoint* →
`https://yourdomain.com/api/stripe-webhook`, event `checkout.session.completed`. Copy the signing
secret.

**Set secrets** (Cloudflare Pages → Settings → Environment variables, encrypted — never commit them):

```
STRIPE_WEBHOOK_SECRET=whsec_...
RESEND_API_KEY=re_...
FROM_EMAIL=Nightfall <hello@yourdomain.com>
```

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

## Step 6 — Test before you take real money

Toggle the dashboard to **Test mode** and use the test-mode Payment Link. Card `4242 4242 4242 4242`,
any future expiry, any CVC.

```bash
stripe listen --forward-to localhost:8788/api/stripe-webhook
stripe trigger checkout.session.completed
```

`stripe listen` prints a *different* signing secret for local use — put that in your local env, not
the dashboard one. Confirm: the email arrives, the key is stored, and firing the same event twice
produces exactly one email.

---

## Go-live checklist

- [ ] Live-mode Payment Links in `config.js` (test links start `buy.stripe.com/test_`)
- [ ] Webhook registered against the **live** endpoint, with the live signing secret
- [ ] Stripe Tax enabled and origin address set
- [ ] Terms, Privacy and Licence pages written — the footer links are `#` stubs, and Stripe expects
      real ones on an account taking payments
- [ ] Refund policy stated publicly (it's on the page already, keep it true)
- [ ] A real end-to-end purchase in live mode with your own card, then refund it
- [ ] Statement descriptor set to something buyers will recognise — a mystery line on a card
      statement is a chargeback waiting to happen

## When to graduate from Payment Links

Payment Links stop being enough when you need to set price or metadata at click time — regional
pricing, seat counts, referral attribution, upsells. At that point add a small serverless endpoint
that calls `POST /v1/checkout/sessions` and redirects to the returned `url`, and point the buttons
at your endpoint instead. The webhook you already deployed doesn't change.
