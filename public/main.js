/* ---------------------------------------------------------------------------
   main.js — wires config.js into the page. No dependencies.
--------------------------------------------------------------------------- */
(function () {
  "use strict";
  var cfg = window.SITE_CONFIG || {};

  /* ---------- 1. Test-mode banner ------------------------------------------ */
  var testbar = document.querySelector("[data-testbar]");
  if (testbar && cfg.testMode) testbar.hidden = false;

  /* ---------- 2. Prices ----------------------------------------------------
     Written from config so the page and your Stripe products only disagree in
     one place. [data-price] takes "$29"; [data-price-num] takes just "29",
     because the pricing cards render the currency symbol separately.         */
  document.querySelectorAll("[data-price]").forEach(function (el) {
    var v = cfg.prices && cfg.prices[el.getAttribute("data-price")];
    if (v) el.textContent = v;
  });
  // Delivery estimate, written from config so the page, the FAQ and the final
  // CTA can never disagree about the date you promised.
  document.querySelectorAll("[data-delivery]").forEach(function (el) {
    if (cfg.deliveryEstimate) el.textContent = cfg.deliveryEstimate;
  });

  document.querySelectorAll("[data-future]").forEach(function (el) {
    var v = cfg.futurePrices && cfg.futurePrices[el.getAttribute("data-future")];
    if (v) el.textContent = v;
  });
  document.querySelectorAll("[data-price-num]").forEach(function (el) {
    var v = cfg.prices && cfg.prices[el.getAttribute("data-price-num")];
    if (v) el.textContent = String(v).replace(/^[^0-9]+/, "");
  });

  /* ---------- 3. Checkout buttons -----------------------------------------
     Any element with data-buy="key" gets its href from cfg.checkout.
     Falls back to cfg.contactUrl when that product has no link yet, so an
     unconfigured button never sends someone to a dead URL.                   */
  // One source of truth for which link set is live, used by the buttons and
  // the audit below alike.
  var activeLinks = (cfg.testMode ? cfg.checkout : cfg.liveCheckout) || {};

  document.querySelectorAll("[data-buy]").forEach(function (el) {
    var key = el.getAttribute("data-buy");
    var url = activeLinks[key] || cfg.contactUrl || "#pricing";
    el.setAttribute("href", url);

    if (/^https?:/i.test(url)) el.setAttribute("rel", "noopener");

    el.addEventListener("click", function () {
      if (cfg.testMode) console.log("[checkout] " + key + " -> " + url);
      // Analytics hooks — fire for any provider. Replace with your own calls.
      if (typeof window.plausible === "function") window.plausible("checkout", { props: { product: key } });
      if (typeof window.gtag === "function") window.gtag("event", "begin_checkout", { item_id: key });
    });
  });

  /* ---------- 4. Config sanity checks --------------------------------------
     Cheap guards against the two mistakes that cost real money: shipping test
     links to production, and going live with buttons that were never wired.  */
  (function auditCheckout() {
    var isLocal = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname) || location.protocol === "file:";
    if (cfg.preorder && cfg.deliveryEstimate === cfg.DELIVERY_ESTIMATE_PLACEHOLDER) {
      console.error(
        "[config] deliveryEstimate is still the placeholder (\"" + cfg.deliveryEstimate +
        "\"). Set a real date before going live — a vague pre-order date is the main cause " +
        "of chargebacks."
      );
    }
    ["progression", "balance", "bundle"].forEach(function (key) {
      var url = activeLinks[key];
      if (!url) {
        console.warn("[config] No " + (cfg.testMode ? "test" : "LIVE") + " checkout link for '" + key +
                     "' — that button falls back to contactUrl.");
        return;
      }
      var isTestLink = /\/test_/.test(url);
      if (isTestLink && !cfg.testMode && !isLocal) {
        console.error("[config] '" + key + "' is a Stripe TEST link but testMode is false. " +
                      "Live buyers cannot pay you.");
      } else if (!isTestLink && cfg.testMode) {
        console.warn("[config] '" + key + "' is a LIVE link while testMode is true — clicking it " +
                     "takes real money.");
      }
    });
  })();

  /* ---------- 5. Social links --------------------------------------------- */
  document.querySelectorAll("[data-social]").forEach(function (el) {
    var url = cfg.social && cfg.social[el.getAttribute("data-social")];
    if (url) { el.href = url; el.rel = "noopener"; el.target = "_blank"; }
    else { el.remove(); }
  });

  /* ---------- 6. Email capture -------------------------------------------
     Shown only when an endpoint is configured, so the page never ships a
     form that silently drops addresses.                                     */
  var signup = document.querySelector("[data-signup]");
  if (signup && cfg.emailFormAction) {
    signup.action = cfg.emailFormAction;
    signup.method = "post";
    var input = signup.querySelector("input[type=email]");
    if (input && cfg.emailFieldName) input.name = cfg.emailFieldName;
    signup.hidden = false;
  }

  /* ---------- 7. Hero demo embed ------------------------------------------ */
  var slot = document.querySelector("[data-demo-slot]");
  if (slot && cfg.demoEmbedUrl) {
    slot.innerHTML = "";
    var frame = document.createElement("iframe");
    frame.src = cfg.demoEmbedUrl;
    frame.title = (cfg.productName || "Product") + " demo";
    frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture";
    frame.allowFullscreen = true;
    frame.loading = "lazy";
    slot.appendChild(frame);
  }

  /* ---------- 8. Sticky nav shadow ---------------------------------------- */
  var nav = document.getElementById("nav");
  var onScroll = function () { nav.classList.toggle("is-stuck", window.scrollY > 8); };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------- 9. Mobile menu ---------------------------------------------- */
  var toggle = document.querySelector(".nav__toggle");
  var menu = document.getElementById("nav-mobile");
  if (toggle && menu) {
    toggle.addEventListener("click", function () {
      var open = menu.hidden;
      menu.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
    });
    menu.addEventListener("click", function (e) {
      if (e.target.tagName === "A") { menu.hidden = true; toggle.setAttribute("aria-expanded", "false"); }
    });
  }

  /* ---------- 10. Reveal on scroll (skipped for reduced-motion) ------------- */
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var targets = document.querySelectorAll(".card, .duo__item, .tier, .status__col, .shot");
  if (!reduce && "IntersectionObserver" in window) {
    targets.forEach(function (el) { el.setAttribute("data-reveal", ""); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry, i) {
        if (!entry.isIntersecting) return;
        entry.target.style.transitionDelay = (i * 60) + "ms";
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.1 });
    targets.forEach(function (el) { io.observe(el); });
  }

  /* ---------- 11. Footer year ---------------------------------------------- */
  var year = document.querySelector("[data-year]");
  if (year) year.textContent = new Date().getFullYear();
})();
