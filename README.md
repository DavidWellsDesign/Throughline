# Landing page template

A single-page product landing page for a paid game/software tool. No build step, no dependencies,
no framework — three files you can host anywhere static.

```
index.html    all copy and structure
styles.css    design tokens at the top of :root — change those to rebrand
config.js     checkout URLs, email endpoint, social links   ← the only file you MUST edit
main.js       wires config.js into the page
assets/       favicon, screenshots, og-image
```

## Run it locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000

## Going live: the checklist

1. **`config.js`** — paste your checkout URL(s) from your payment provider (see [PAYMENTS.md](PAYMENTS.md)).
   Set `emailFormAction` to your newsletter endpoint, or leave it `null` to hide the signup form.
2. **`index.html`** — replace the copy. Also update the `<title>`, `<meta name="description">`,
   the Open Graph tags, `<link rel="canonical">`, and the JSON-LD price block.
3. **`styles.css`** — change `--accent`, `--accent-2` and the surface colours in `:root`.
4. **`assets/`** — add `screenshot.png` (16:9) and `og-image.png` (1200×630). Replace the
   placeholder inside `<div class="shot__body" data-demo-slot>` with your `<img>`, or set
   `demoEmbedUrl` in config to embed a YouTube/Vimeo demo instead.
5. **Legal pages** — the footer links to Terms / Privacy / Licence are `#` stubs. Fill them before
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
