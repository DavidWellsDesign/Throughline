/* ===========================================================================
   GET /api/download?key=<licence key>

   The licence key is the credential. It is ~59 bits of unguessable entropy,
   it is already in the buyer's inbox, and it maps to exactly one app — so a
   bundle buyer's two keys fetch two different builds with no extra state.

   Bindings:
     LICENCES   KV   — licence records, written by the Stripe webhook
     RELEASES   R2   — the build artifacts themselves
   Both are optional at runtime: a missing binding returns a clear 503 rather
   than a stack trace, so the endpoint can ship before the bucket exists.
=========================================================================== */

const CATALOGUE = {
  progression: "Throughline Progression",
  balance: "Throughline Balance"
};

export async function handleDownload(request, env) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return problem(405, "Method not allowed");
  }

  const key = normaliseKey(new URL(request.url).searchParams.get("key"));
  if (!key) {
    return problem(400, "Add your licence key to the link, or use the form at /download.");
  }

  if (!env.LICENCES) return problem(503, "Downloads aren't configured yet. Email hello@throughlinetools.com.");

  const raw = await env.LICENCES.get(`licence:${key}`);
  if (!raw) {
    // Same response for malformed and simply-unknown keys: there is nothing to
    // learn from the difference, and keys are unguessable anyway.
    return problem(404, "That licence key isn't one of ours. Check it against your receipt, or reply to that email and I'll sort it out.");
  }

  let licence;
  try { licence = JSON.parse(raw); }
  catch { return problem(500, "That licence record is corrupt. Please email hello@throughlinetools.com."); }

  // Forward-compatible with refund handling: nothing sets this yet, but when a
  // charge.refunded listener does, downloads stop without touching this file.
  if (licence.revoked) {
    return problem(403, "That licence was refunded, so it no longer includes downloads.");
  }

  const app = licence.app;
  if (!CATALOGUE[app]) return problem(500, `Licence names an unknown app "${app}".`);

  const manifestRaw = await env.LICENCES.get(`release:${app}`);
  if (!manifestRaw) {
    return problem(503, `${CATALOGUE[app]} hasn't been published for download yet. You'll get an email the moment it is.`);
  }
  const manifest = JSON.parse(manifestRaw);

  if (!env.RELEASES) return problem(503, "Downloads aren't configured yet. Email hello@throughlinetools.com.");

  const object = await env.RELEASES.get(manifest.object);
  if (!object) {
    // Manifest and bucket disagree — a publish that half-finished.
    console.error(`Manifest points at missing R2 object "${manifest.object}" for ${app}`);
    return problem(503, "That build is temporarily unavailable. Please try again shortly.");
  }

  // Count downloads so key-sharing is visible without blocking anyone. Only on
  // GET: the download page probes with HEAD first, and counting both would
  // double every figure and make the number useless for spotting abuse. Never
  // let bookkeeping fail the download itself.
  if (request.method === "GET") try {
    await env.LICENCES.put(`licence:${key}`, JSON.stringify({
      ...licence,
      downloads: (licence.downloads || 0) + 1,
      lastDownloadAt: new Date().toISOString()
    }));
  } catch (err) {
    console.error("Download counter failed for", key, err);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Content-Type", "application/x-apple-diskimage");
  headers.set("Content-Disposition", `attachment; filename="${manifest.filename}"`);
  headers.set("Cache-Control", "private, no-store");
  if (object.size) headers.set("Content-Length", String(object.size));

  return new Response(request.method === "HEAD" ? null : object.body, { status: 200, headers });
}

/** Accepts the key however the buyer pasted it: spaces, lowercase, no dashes. */
function normaliseKey(input) {
  if (!input) return null;
  const cleaned = input.toUpperCase().replace(/[^A-Z0-9-]/g, "");
  return /^[A-Z]{2}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(cleaned) ? cleaned : null;
}

function problem(status, message) {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }
  });
}

export const onRequestGet = ({ request, env }) => handleDownload(request, env);
export const onRequestHead = ({ request, env }) => handleDownload(request, env);
