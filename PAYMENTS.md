# Taking payments for a game/software product

Fees and terms change — verify current rates on each provider's pricing page before you commit.

---

## The one decision that matters first: Merchant of Record

**Merchant of Record (MoR)** = whose name is legally on the sale.

- **You are the MoR** (Stripe, PayPal): you keep more of each sale, but *you* are liable for
  collecting and remitting sales tax / VAT / GST. EU VAT on digital goods applies from your
  **first euro of sales — there is no small-seller threshold** for non-EU sellers. Same story for
  UK VAT, and a growing list of US states, Norway, Australia, Japan, Canada, India.
- **They are the MoR** (Lemon Squeezy, Paddle, Gumroad, FastSpring, Polar): they sell the product
  *to your customer* and buy it *from you*. They handle every tax registration, filing and invoice.
  You get a single payout and one income line for your accounts. Costs roughly 2–5% more.

For a solo dev selling a $39 tool worldwide, an MoR is almost always the right trade. The extra ~3%
is cheaper than one VAT registration, and enormously cheaper than getting it wrong.

---

## Direct-from-your-own-site options

| Provider | Typical cost | MoR? | License keys | Notes |
|---|---|---|---|---|
| **Stripe** (Payment Links / Checkout) | ~2.9% + $0.30 | ❌ (Stripe Tax add-on ~+0.5%) | ❌ build it | Cheapest, most control. Best if you'll add subscriptions/seats later. You own tax compliance. |
| **Lemon Squeezy** | ~5% + $0.50 | ✅ | ✅ built in | Made for digital products. License key API, affiliates, discounts, file hosting. Acquired by Stripe in 2024, so the Stripe migration path is clean. |
| **Paddle** | ~5% + $0.50 | ✅ | ✅ | More SaaS/desktop-software oriented. Strong on subscriptions, renewals, dunning. Has an application/approval step. |
| **Polar** | ~4% + $0.40 | ✅ | ✅ | Newer, developer-focused, open source. Good API. Smaller/less battle-tested than the above. |
| **FastSpring** | ~5.9% + $0.95 | ✅ | ✅ | Long-established in desktop software. Heavier, more enterprise. |
| **Payhip** | 5% free tier, lower on paid plans | ✅ (EU VAT) | ✅ | Very cheap to start, simple, less polished. |
| **Gumroad** | ~10% flat | ✅ | ✅ | Zero setup, some built-in discovery among artists. Highest fee — fine for a first $1k, expensive at scale. |
| **PayPal alone** | ~3.5% + fixed | ❌ | ❌ | Don't. Digital-goods chargebacks go badly, and you still owe VAT. Offer it *inside* one of the above instead. |

**Whatever you pick, offer PayPal and local methods (iDEAL, Klarna, Alipay) as options.** For an
international game-dev audience, card-only checkout measurably loses sales.

---

## Marketplaces (they bring the audience, and take a cut for it)

You are describing an add-on for game designers, developers and artists — for that audience the
marketplace *is* the marketing channel, which is often worth more than the fee.

| Channel | Cut | Good for |
|---|---|---|
| **itch.io** | You set it — default 10%, can be 0% | Anything game-adjacent. Best-aligned platform for indies; pays out fast; great for tools and asset packs. |
| **Unity Asset Store** | ~30% | Unity add-ons. Big audience, slow review, you inherit their refund and update rules. |
| **Fab** (Epic, replaced Unreal Marketplace) | ~12% on Unreal-engine content | Unreal add-ons, 3D assets. Notably better split than Unity's. |
| **Blender Market** | ~30% | Blender add-ons, art tooling. Highly engaged niche. |
| **Steam** | 30% + $100 per app | Actual games only, not tools. Unmatched discovery. |
| **Mac App Store** | 15% (under $1M/yr) / 30% | Mac desktop apps. Required for some enterprise buyers. |
| **GitHub Sponsors / Ko-fi** | ~0–5% | Not a store — a tip jar for OSS-adjacent work. Useful supplement, not a business. |

---

## The setup I'd actually recommend

1. **Sell direct from this landing page via Lemon Squeezy** (or Paddle if you want subscriptions
   and don't mind the approval step). MoR-handled tax, license keys, and file delivery out of the
   box. Paste the checkout URL into `config.js` — that's the entire integration.
2. **Also list on itch.io** and the marketplace for whichever engine you target. Accept the cut;
   treat it as paid discovery. Link back to your own page from the store listing.
3. **Move to Stripe direct later** once you're doing enough volume that ~5% hurts more than a VAT
   accountant costs. Since Lemon Squeezy is Stripe-owned, that migration is not a rewrite.

## Things that will bite you

- **Chargebacks on digital goods.** Keep the receipt email, download logs, and IP. Offer refunds
  freely — a refund costs you the sale; a chargeback costs the sale plus a ~$15 fee plus your
  standing with the processor.
- **VAT invoices.** European business customers will ask for a proper VAT invoice with your number
  on it. MoR providers generate these; a raw Stripe integration does not.
- **Refund policy in writing.** Required by EU consumer law for digital goods, and it converts:
  the guarantee block on this page exists for that reason.
- **Sanctions/geo restrictions.** MoR providers block embargoed countries for you. On raw Stripe,
  that's your problem.
- **Price in USD, one price globally**, unless you plan to actually maintain regional pricing.
  Half-done regional pricing is worse than none.
