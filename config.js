/* ---------------------------------------------------------------------------
   SITE CONFIG — the only file you must edit to go live.
   Read at runtime by main.js.
--------------------------------------------------------------------------- */
window.SITE_CONFIG = {
  // TODO: placeholder studio name — find/replace "Playfield" across
  // index.html + success.html when you pick the real one.
  siteName: "Playfield",

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
     CHECKOUT LINKS — one per thing you sell.
     Paste the Stripe Payment Link URL for each. Leave "" and the button falls
     back to `contactUrl`, so an unconfigured button never silently 404s.
     See STRIPE.md for how to create these.
  ------------------------------------------------------------------------- */
  checkout: {
    progression: "", // Game Progression, standalone
    balance: "",     // Game Balance, standalone
    bundle: ""       // both apps, discounted
  },

  // Prices shown on the page. Keep these in step with the Stripe products —
  // nothing verifies that they match, and a mismatch at checkout kills trust.
  prices: {
    progression: "$29",
    balance: "$29",
    bundle: "$49"
  },

  // Used when a checkout link is empty.
  contactUrl: "mailto:hello@example.com?subject=Playfield",

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
