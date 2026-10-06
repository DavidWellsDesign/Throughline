/* ---------------------------------------------------------------------------
   Tests for GET /api/download — the licence gate on the build artifacts.
   No Cloudflare, no R2, no network: KV and R2 are both faked.
--------------------------------------------------------------------------- */
import { handleDownload } from "../functions/api/download.js";

let pass = 0, fail = 0;

function makeEnv({ licences = {}, releases = {}, objects = {}, noKv = false, noR2 = false } = {}) {
  const kv = new Map(Object.entries(licences));
  for (const [k, v] of Object.entries(releases)) kv.set(`release:${k}`, JSON.stringify(v));
  const env = {};
  if (!noKv) env.LICENCES = {
    get: async k => kv.get(k) ?? null,
    put: async (k, v) => void kv.set(k, v)
  };
  if (!noR2) env.RELEASES = {
    get: async name => objects[name]
      ? { body: objects[name], size: objects[name].length, writeHttpMetadata() {} }
      : null
  };
  return { env, kv };
}

const LICENCE = JSON.stringify({ app: "progression", sku: "progression", tier: "founder",
                                 email: "buyer@example.com", issuedAt: "2026-01-01T00:00:00Z" });
const RELEASE = { version: "0.1.0", object: "progression/tp-0.1.0.dmg",
                  filename: "Throughline Progression 0.1.0.dmg" };

const get = (qs, env, method = "GET") =>
  handleDownload(new Request("https://throughlinetools.com/api/download" + qs, { method }), env);

async function check(name, fn) {
  const realError = console.error;
  const captured = [];
  console.error = (...a) => captured.push(a.map(String).join(" "));
  let ok = false, detail = "";
  try { ok = await fn(); } catch (e) { detail = ` — threw: ${e.message}`; }
  finally { console.error = realError; }
  if (ok) { pass++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  else { fail++; console.log(`  \x1b[31m✗ ${name}${detail}\x1b[0m`);
         captured.forEach(l => console.log(`      ${l.split("\n")[0]}`)); }
}

console.log("\nHappy path");

await check("a valid key streams its app's build with a filename", async () => {
  const { env } = makeEnv({ licences: { "licence:GP-AAAA-BBBB-CCCC": LICENCE },
                            releases: { progression: RELEASE },
                            objects: { "progression/tp-0.1.0.dmg": "DMGBYTES" } });
  const res = await get("?key=GP-AAAA-BBBB-CCCC", env);
  return res.status === 200 &&
         res.headers.get("Content-Disposition").includes("Throughline Progression 0.1.0.dmg") &&
         (await res.text()) === "DMGBYTES";
});

await check("a key is accepted lowercase, spaced, however it was pasted", async () => {
  const { env } = makeEnv({ licences: { "licence:GP-AAAA-BBBB-CCCC": LICENCE },
                            releases: { progression: RELEASE },
                            objects: { "progression/tp-0.1.0.dmg": "DMGBYTES" } });
  return (await get("?key=%20gp-aaaa-bbbb-cccc%20", env)).status === 200;
});

await check("each key fetches only its own app, so a bundle gets two builds", async () => {
  const bal = JSON.stringify({ app: "balance", sku: "bundle", email: "b@e.com" });
  const { env } = makeEnv({
    licences: { "licence:GP-AAAA-BBBB-CCCC": LICENCE, "licence:GB-DDDD-EEEE-FFFF": bal },
    releases: { progression: RELEASE,
                balance: { version: "0.1.0", object: "balance/tb.dmg", filename: "Throughline Balance.dmg" } },
    objects: { "progression/tp-0.1.0.dmg": "PROG", "balance/tb.dmg": "BAL" } });
  const a = await (await get("?key=GP-AAAA-BBBB-CCCC", env)).text();
  const b = await (await get("?key=GB-DDDD-EEEE-FFFF", env)).text();
  return a === "PROG" && b === "BAL";
});

await check("downloads are counted without blocking anyone", async () => {
  const { env, kv } = makeEnv({ licences: { "licence:GP-AAAA-BBBB-CCCC": LICENCE },
                                releases: { progression: RELEASE },
                                objects: { "progression/tp-0.1.0.dmg": "X" } });
  await get("?key=GP-AAAA-BBBB-CCCC", env);
  await get("?key=GP-AAAA-BBBB-CCCC", env);
  const rec = JSON.parse(kv.get("licence:GP-AAAA-BBBB-CCCC"));
  return rec.downloads === 2 && !!rec.lastDownloadAt;
});

await check("HEAD validates but does not count as a download", async () => {
  const { env, kv } = makeEnv({ licences: { "licence:GP-AAAA-BBBB-CCCC": LICENCE },
                                releases: { progression: RELEASE },
                                objects: { "progression/tp-0.1.0.dmg": "X" } });
  await get("?key=GP-AAAA-BBBB-CCCC", env, "HEAD");   // the page's probe
  await get("?key=GP-AAAA-BBBB-CCCC", env);           // the actual download
  return JSON.parse(kv.get("licence:GP-AAAA-BBBB-CCCC")).downloads === 1;
});

await check("HEAD validates without sending the body", async () => {
  const { env } = makeEnv({ licences: { "licence:GP-AAAA-BBBB-CCCC": LICENCE },
                            releases: { progression: RELEASE },
                            objects: { "progression/tp-0.1.0.dmg": "DMGBYTES" } });
  const res = await get("?key=GP-AAAA-BBBB-CCCC", env, "HEAD");
  return res.status === 200 && (await res.text()) === "";
});

console.log("\nRefused");

await check("an unknown key gets 404, not a hint", async () => {
  const { env } = makeEnv({ releases: { progression: RELEASE } });
  const res = await get("?key=GP-ZZZZ-ZZZZ-ZZZZ", env);
  return res.status === 404 && !(await res.text()).toLowerCase().includes("format");
});

await check("a malformed key is indistinguishable from an unknown one", async () => {
  const { env } = makeEnv({ releases: { progression: RELEASE } });
  const bad = await get("?key=not-a-key", env);
  const unknown = await get("?key=GP-ZZZZ-ZZZZ-ZZZZ", env);
  return bad.status === 400 || (bad.status === unknown.status);
});

await check("no key at all explains where to find one", async () => {
  const { env } = makeEnv();
  const res = await get("", env);
  return res.status === 400 && (await res.text()).includes("/download");
});

await check("a refunded licence is refused", async () => {
  const revoked = JSON.stringify({ ...JSON.parse(LICENCE), revoked: true });
  const { env } = makeEnv({ licences: { "licence:GP-AAAA-BBBB-CCCC": revoked },
                            releases: { progression: RELEASE },
                            objects: { "progression/tp-0.1.0.dmg": "X" } });
  const res = await get("?key=GP-AAAA-BBBB-CCCC", env);
  return res.status === 403 && (await res.text()).toLowerCase().includes("refund");
});

await check("POST is refused", async () => {
  const { env } = makeEnv();
  return (await get("?key=GP-AAAA-BBBB-CCCC", env, "POST")).status === 405;
});

console.log("\nNot ready yet");

await check("a valid key before any build is published says so, kindly", async () => {
  const { env } = makeEnv({ licences: { "licence:GP-AAAA-BBBB-CCCC": LICENCE } });
  const res = await get("?key=GP-AAAA-BBBB-CCCC", env);
  const body = await res.text();
  return res.status === 503 && /hasn't been published/.test(body) && /email/.test(body);
});

await check("a missing R2 binding degrades instead of throwing", async () => {
  const { env } = makeEnv({ licences: { "licence:GP-AAAA-BBBB-CCCC": LICENCE },
                            releases: { progression: RELEASE }, noR2: true });
  return (await get("?key=GP-AAAA-BBBB-CCCC", env)).status === 503;
});

await check("a manifest pointing at a missing object fails safe", async () => {
  const { env } = makeEnv({ licences: { "licence:GP-AAAA-BBBB-CCCC": LICENCE },
                            releases: { progression: RELEASE }, objects: {} });
  return (await get("?key=GP-AAAA-BBBB-CCCC", env)).status === 503;
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
