# Greybox — landing page

One page selling two desktop apps separately: **Greybox Progression** (node-graph campaign planner)
and **Greybox Balance** (curve/economy tuner), plus a discounted bundle. Static HTML/CSS/JS, no
build step, no dependencies, no framework.

```
index.html    all copy and structure
success.html  post-purchase page your provider redirects to
styles.css    design tokens at the top of :root — change those to rebrand
config.js     checkout URLs, prices, test-mode flag         ← the only file you MUST edit
main.js       wires config.js into the page
assets/       favicon, screenshots, og-image
functions/    Stripe webhook -> licence keys -> email (one key per app)
scripts/      `npm test` — 18 end-to-end fulfilment tests, no Stripe account needed
```

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
covers both apps, the bundle, forged signatures, duplicate deliveries and provider outages.
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

Any static host works. Zero-config options:

- **Cloudflare Pages** — `npx wrangler pages deploy .`
- **Netlify** — drag the folder onto app.netlify.com, or `npx netlify deploy --prod`
- **Vercel** — `npx vercel --prod`
- **GitHub Pages** — push to a repo, enable Pages on the branch root

All four are free at this scale and give you HTTPS and a custom domain.

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
