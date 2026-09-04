/* ---------------------------------------------------------------------------
   SITE CONFIG — the only file you must edit to go live.
   Everything here is read at runtime by main.js.
--------------------------------------------------------------------------- */
window.SITE_CONFIG = {
  // Shown in the browser tab / share cards is set in index.html <head>.
  productName: "Nightfall",

  /* -------------------------------------------------------------------------
     CHECKOUT LINKS
     Paste the hosted checkout / buy URL from your payment provider.
     Examples:
       Stripe Payment Link : https://buy.stripe.com/abc123
       Lemon Squeezy       : https://yourstore.lemonsqueezy.com/checkout/buy/UUID
       Paddle             : https://pay.paddle.io/hsc_xxx
       Gumroad            : https://yourname.gumroad.com/l/slug
       itch.io            : https://yourname.itch.io/your-game
     Leave a value as null to make that tier's button open the contact link.
  ------------------------------------------------------------------------- */
  checkout: {
    indie:  "https://example.com/checkout/indie",
    pro:    "https://example.com/checkout/pro",
    studio: null // null => falls back to `contactUrl`
  },

  // Used when a checkout link is null (e.g. "Contact sales" / custom license).
  contactUrl: "mailto:hello@example.com?subject=Studio%20license",

  /* -------------------------------------------------------------------------
     EMAIL CAPTURE
     Any provider that accepts a plain POST form works. Paste the form action:
       ConvertKit / Kit : https://app.kit.com/forms/XXXX/subscriptions
       Buttondown       : https://buttondown.email/api/emails/embed-subscribe/USER
       Mailchimp        : https://YOURLIST.us1.list-manage.com/subscribe/post?u=..&id=..
       Formspree        : https://formspree.io/f/XXXX
     Set to null to hide the signup form entirely.
  ------------------------------------------------------------------------- */
  emailFormAction: null,
  emailFieldName: "email", // Mailchimp uses "EMAIL"

  // Optional: swap the demo video/embed in the hero. null => static preview.
  demoEmbedUrl: null,

  social: {
    x:      "https://x.com/yourhandle",
    discord:"https://discord.gg/yourinvite",
    github: "https://github.com/yourhandle",
    itch:   "https://yourname.itch.io"
  }
};
