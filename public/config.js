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
  testMode: false,

  /* -------------------------------------------------------------------------
     PRE-ORDER MODE
     The apps aren't released yet, so buyers are paying now and receiving the
     software later. This flag drives every "you are pre-ordering" notice on
     the page, the success page and the receipt email.

     `deliveryEstimate` is the date promised to buyers. It must stay in step
     with the DELIVERY_ESTIMATE env var on the deployment AND the three Stripe
     product descriptions — nothing enforces that, so change all three together.
     Keep it conservative: shipping early delights, shipping late disputes.
  ------------------------------------------------------------------------- */
  preorder: true,
  deliveryEstimate: "Q1 2027",
  DELIVERY_ESTIMATE_PLACEHOLDER: "Q2 2027", // audit compares against this

  /* -------------------------------------------------------------------------
     CHECKOUT LINKS — one per thing you sell.
     Paste the Stripe Payment Link URL for each. Leave "" and the button falls
     back to `contactUrl`, so an unconfigured button never silently 404s.
     See STRIPE.md for how to create these.
  ------------------------------------------------------------------------- */
  // Sandbox links — used while testMode is true. No real money moves.
  checkout: {
    progression: "https://buy.stripe.com/test_eVq9AVa510KefFV3fc4Rq00",
    balance:     "https://buy.stripe.com/test_14AdRbelhfF851h2b84Rq01",
    bundle:      "https://buy.stripe.com/test_5kQ14pgtp3WqgJZdTQ4Rq02"
  },

  // Live links — used the moment testMode flips to false. These take REAL
  // money. Both sets live here so going live is one boolean, not three
  // copy-pastes at the worst possible moment; main.js warns if the set in use
  // doesn't match the mode.
  liveCheckout: {
    progression: "https://buy.stripe.com/4gMdR9dK0bRX68nbJNbsc02",
    balance:     "https://buy.stripe.com/eVq6oHeO47BHfIXeVZbsc00",
    bundle:      "https://buy.stripe.com/9B63cv6hycW154jdRVbsc01"
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

  /* -------------------------------------------------------------------------
     LEGAL IDENTITY
     UK and EU distance-selling rules require a trader to identify themselves
     to consumers: a real name and a real postal address, not just an email.
     These fill in across terms.html, privacy.html and refunds.html.
     ⚠ You MUST replace all three before taking real money.
  ------------------------------------------------------------------------- */
  legal: {
    entityName: "[YOUR NAME OR COMPANY NAME]",
    address: "[YOUR POSTAL ADDRESS]",
    email: "hello@throughlinetools.com",
    jurisdiction: "England and Wales"
  },

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
