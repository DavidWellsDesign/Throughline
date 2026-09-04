/* ---------------------------------------------------------------------------
   main.js — wires config.js into the page. No dependencies.
--------------------------------------------------------------------------- */
(function () {
  "use strict";
  var cfg = window.SITE_CONFIG || {};

  /* ---------- 1. Checkout buttons -----------------------------------------
     Any element with data-buy="tierKey" gets its href from cfg.checkout.
     Falls back to cfg.contactUrl when the tier has no link (e.g. "Studio").  */
  document.querySelectorAll("[data-buy]").forEach(function (el) {
    var key = el.getAttribute("data-buy");
    var url = (cfg.checkout && cfg.checkout[key]) || cfg.contactUrl || "#pricing";
    el.setAttribute("href", url);

    // External hosted checkouts open in a new tab; mailto/anchors stay put.
    if (/^https?:/i.test(url)) {
      el.setAttribute("rel", "noopener");
      // Uncomment if you prefer the checkout in a new tab:
      // el.setAttribute("target", "_blank");
    }

    el.addEventListener("click", function () {
      // Analytics hook — fires for any provider. Replace with your own call.
      if (typeof window.plausible === "function") window.plausible("checkout", { props: { tier: key } });
      if (typeof window.gtag === "function") window.gtag("event", "begin_checkout", { item_id: key });
    });
  });

  /* ---------- 2. Social links --------------------------------------------- */
  document.querySelectorAll("[data-social]").forEach(function (el) {
    var url = cfg.social && cfg.social[el.getAttribute("data-social")];
    if (url) { el.href = url; el.rel = "noopener"; el.target = "_blank"; }
    else { el.remove(); }
  });

  /* ---------- 3. Email capture -------------------------------------------
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

  /* ---------- 4. Hero demo embed ------------------------------------------ */
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

  /* ---------- 5. Sticky nav shadow ---------------------------------------- */
  var nav = document.getElementById("nav");
  var onScroll = function () { nav.classList.toggle("is-stuck", window.scrollY > 8); };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------- 6. Mobile menu ---------------------------------------------- */
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

  /* ---------- 7. Reveal on scroll (skipped for reduced-motion) ------------- */
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var targets = document.querySelectorAll(".card, .step, .tier, .quote, .shot");
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

  /* ---------- 8. Footer year ---------------------------------------------- */
  var year = document.querySelector("[data-year]");
  if (year) year.textContent = new Date().getFullYear();
})();
