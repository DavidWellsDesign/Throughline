/* ---------------------------------------------------------------------------
   SITE CONFIG — the only file you must edit to go live.
   Read at runtime by main.js.
--------------------------------------------------------------------------- */
window.SITE_CONFIG = {
  siteName: "Throughline",

  /* -------------------------------------------------------------------------
     TEST MODE
     true  → shows a banner on the page and logs checkout clicks to the console,
             so you can walk the whole flow without taking real money.
     Set to false (and swap in live links below) when you're ready to sell.
     A Stripe TEST payment link looks like  https://buy.stripe.com/test_xxxx
     A LIVE one looks like                  https://buy.stripe.com/xxxx
  ------------------------------------------------------------------------- */
  testMode: true,

  /* -------------------------------------------------------------------------
     PRE-ORDER MODE
     The apps aren't released yet, so buyers are paying now and receiving the
     software later. This flag drives every "you are pre-ordering" notice on
     the page, the success page and the receipt email.

     ⚠ TODO: `deliveryEstimate` below is a PLACEHOLDER. Set your real estimate
     before going live — a vague or missing date is the single biggest driver
     of chargebacks on pre-orders, and main.js will warn until you change it.
     Keep it conservative: shipping early delights, shipping late disputes.
  ------------------------------------------------------------------------- */
  preorder: true,
  deliveryEstimate: "Q2 2027",
  DELIVERY_ESTIMATE_PLACEHOLDER: "Q2 2027", // audit compares against this

  /* -------------------------------------------------------------------------
     CHECKOUT LINKS — one per thing you sell.
     Paste the Stripe Payment Link URL for each. Leave "" and the button falls
     back to `contactUrl`, so an unconfigured button never silently 404s.
     See STRIPE.md for how to create these.
  ------------------------------------------------------------------------- */
  checkout: {
    // Stripe SANDBOX links (test mode). Swap for live ones before launch —
    // and remember metadata.product does NOT carry over from test to live.
    progression: "https://buy.stripe.com/test_eVq9AVa510KefFV3fc4Rq00",
    balance:     "https://buy.stripe.com/test_14AdRbelhfF851h2b84Rq01",
    bundle:      "https://buy.stripe.com/test_5kQ14pgtp3WqgJZdTQ4Rq02"
  },

  // Prices shown on the page. Keep these in step with the Stripe products —
  // nothing verifies that they match, and a mismatch at checkout kills trust.
  prices: {
    progression: "$19",
    balance: "$19",
    bundle: "$29"
  },

  // The published 1.0 price. Shown on the page as the "goes up to" figure —
  // saying it out loud is what makes the early-access price a reason to buy now.
  futurePrices: {
    progression: "$39",
    balance: "$39",
    bundle: "$59"
  },

  // Used when a checkout link is empty.
  contactUrl: "mailto:hello@throughlinetools.com?subject=Throughline",

  // Where Stripe sends buyers after payment. Set this as the redirect in the
  // Payment Link itself; it's listed here for reference. See STRIPE.md.
  successUrl: "/success.html",

  /* -------------------------------------------------------------------------
     EMAIL CAPTURE — any provider that accepts a plain POST form.
       Kit/ConvertKit : https://app.kit.com/forms/XXXX/subscriptions
       Buttondown     : https://buttondown.email/api/emails/embed-subscribe/USER
       Formspree      : https://formspree.io/f/XXXX
     Leave null to hide the signup form entirely.
  ------------------------------------------------------------------------- */
  emailFormAction: null,
  emailFieldName: "email",

  // Optional: a demo video in the hero. null => the static preview slot.
  demoEmbedUrl: null,

  social: {
    x: "",
    discord: "",
    github: "",
    itch: ""
  }
};
