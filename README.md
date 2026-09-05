# Throughline — landing page

One page selling two desktop apps separately: **Throughline Progression** (node-graph campaign planner)
and **Throughline Balance** (curve/economy tuner), plus a discounted bundle. Static HTML/CSS/JS, no
build step, no dependencies, no framework.

```
public/           the deployed site — ONLY this directory is uploaded
  index.html      all copy and structure
  success.html    post-purchase page Stripe redirects to
  styles.css      design tokens at the top of :root — change those to rebrand
  config.js       checkout URLs, prices, test-mode flag   ← the only file you MUST edit
  main.js         wires config.js into the page
  assets/         favicon, screenshots, og-image
functions/        Stripe webhook -> licence keys -> email (one key per app)
scripts/          `npm test` — 22 fulfilment tests, no Stripe account needed
wrangler.jsonc    Pages config: output dir + KV binding
```

Everything outside `public/` stays private. That is deliberate and it is the *only* mechanism
that works: `.assetsignore` is a Workers Static Assets feature and `wrangler pages deploy`
ignores it, so a file's privacy depends entirely on it not being in the output directory.

## Run it locally

```bash
npm run dev
```

Then open http://localhost:8000

## Test the payment flow

```bash
npm test
```

Signs payloads exactly the way Stripe does and pushes them through the real webhook handler —
covers both apps, the bundle, forged signatures, test/live mix-ups, duplicate deliveries and
provider outages.
No Stripe account or network access required. See [STRIPE.md](STRIPE.md) for the live test-mode run.

## Going live: the checklist

1. **`config.js`** — paste your checkout URL(s) from your payment provider. See
   [PAYMENTS.md](PAYMENTS.md) to choose one, or [STRIPE.md](STRIPE.md) for the full Stripe walkthrough.
   Set `emailFormAction` to your newsletter endpoint, or leave it `null` to hide the signup form.
2. **`index.html`** — replace the copy. Also update the `<title>`, `<meta name="description">`,
   the Open Graph tags, `<link rel="canonical">`, and the JSON-LD price block.
3. **`styles.css`** — change `--accent`, `--accent-2` and the surface colours in `:root`.
4. **`assets/`** — add `screenshot.png` (16:9) and `og-image.png` (1200×630). Replace the
   placeholder inside `<div class="shot__body" data-demo-slot>` with your `<img>`, or set
   `demoEmbedUrl` in config to embed a YouTube/Vimeo demo instead.
5. **`success.html`** — update the copy, and set it as the post-payment redirect in your provider.
6. **Legal pages** — the footer links to Terms / Privacy / Licence are `#` stubs. Fill them before
   you take money; most payment providers require them.

## Deploying

**Cloudflare Pages** is the recommendation, and the repo is already set up for it: the webhook in
`functions/` is written to the Pages Functions convention, and licence storage uses Workers KV,
which is built in. No adapter, no second service, no code changes.

```bash
npx wrangler pages deploy --branch preview   # preview deployment
npx wrangler pages deploy                    # production (branch: main)
```

The Pages project (`throughline-site`) and both KV namespaces already exist and their ids are in
[`wrangler.jsonc`](wrangler.jsonc). Preview URL: <https://preview.throughline-site-ejs.pages.dev>

Set the secrets in the Cloudflare dashboard (Pages → your project → Settings → Variables and
Secrets), **encrypted**, never in this repo:

| Variable | Value |
| --- | --- |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` from Developers → Webhooks → your endpoint |
| `STRIPE_LIVEMODE` | `true` on production, `false` on any test deployment |
| `RESEND_API_KEY` | `re_…`, or swap `sendEmail()` for your provider |
| `FROM_EMAIL` | `Throughline <hello@yourdomain.com>` |

Set these separately for Production and Preview — that is the point of `STRIPE_LIVEMODE`, and the
webhook refuses events whose mode doesn't match.

There is no build command. If the dashboard asks, leave it empty and set the output directory to
`/`. [`.assetsignore`](.assetsignore) keeps the docs, `package.json` and `scripts/` out of the
deployed site.

### Other hosts

The site is plain static files, so anything serves it. What differs is the webhook and its storage:

| Host | Webhook | Licence storage |
| --- | --- | --- |
| **Cloudflare Pages** | Works as-is | Workers KV, built in |
| Netlify | One-line adapter (bottom of the webhook file) | Netlify Blobs |
| Vercel | One-line adapter | Vercel KV / Upstash, separate signup |
| GitHub Pages | ❌ static only | — host the webhook elsewhere |

## What's already handled

- Responsive down to 320px, mobile nav
- Keyboard accessible: skip link, visible focus rings, real `<details>` FAQ, labelled form
- `prefers-reduced-motion` respected (scroll animations disabled)
- SEO: meta description, Open Graph/Twitter cards, canonical, `SoftwareApplication` JSON-LD
- Analytics hooks in `main.js` fire on checkout clicks for Plausible or GA if either is present

## Sections in the page

Hero → social proof → features → how it works → pricing → testimonials → FAQ → final CTA → footer.

Delete any `<section>` you don't need; nothing depends on section order. If you have no customers
yet, cut the testimonials and the logo strip rather than inventing them — fake social proof is the
fastest way to lose a technical audience.
