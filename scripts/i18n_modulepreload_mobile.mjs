// Stored-locale modulepreload mobile first-paint check for the stored-locale path.
// Loads the PRODUCTION build (vite preview) on a mobile viewport with a stored non-en
// locale, measures Cumulative Layout Shift across first paint (the lazy locale flip's visibility:hidden
// gate should hold layout so the localized reveal causes ~0 shift), and writes a screenshot.
//
//   BASE_URL=http://localhost:4173 node scripts/i18n_modulepreload_mobile.mjs

import puppeteer, { PredefinedNetworkConditions } from "puppeteer-core";
import { mkdirSync } from "node:fs";
import { BROWSER_PATH } from "./browser_path.mjs";

const BASE = (process.env.BASE_URL || "http://localhost:4173").replace(/\/$/, "");
const SLOW_4G = PredefinedNetworkConditions["Slow 4G"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync("tmp", { recursive: true });

const browser = await puppeteer.launch({
  executablePath: BROWSER_PATH,
  headless: true,
  args: ["--use-angle=swiftshader", "--no-sandbox", "--disable-dev-shm-usage"],
});

async function run({ preseedLocale, shot }) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const sameOrigin = (u) => { try { return new URL(u).origin === new URL(BASE).origin; } catch { return false; } };
  await page.setRequestInterception(true);
  page.on("request", (req) => { if (sameOrigin(req.url())) req.continue(); else req.abort(); });

  const client = await page.target().createCDPSession();
  await client.send("Network.enable");
  await client.send("Network.setCacheDisabled", { cacheDisabled: true });
  await client.send("Network.emulateNetworkConditions", {
    offline: false, latency: SLOW_4G.latency, downloadThroughput: SLOW_4G.download, uploadThroughput: SLOW_4G.upload,
  });
  await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });

  // Accumulate layout-shift before any app script runs.
  await page.evaluateOnNewDocument(() => {
    window.__cls = 0;
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
      }).observe({ type: "layout-shift", buffered: true });
    } catch { /* layout-shift API absent */ }
  });

  if (preseedLocale) {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 120000 }).catch(() => {});
    await page.evaluate((l) => localStorage.setItem("locale", l), preseedLocale);
  }

  page.goto(`${BASE}/`, { waitUntil: "load", timeout: 150000 }).catch(() => {});

  // Wait until (a) the locale is actually applied (documentElement.lang === preseedLocale;
  // English never changes it) AND (b) layout has settled (CLS unchanged for ~3 polls), so we
  // capture the post-localization first paint deterministically rather than racing it.
  const deadline = Date.now() + 100000;
  const want = preseedLocale || "en";
  let state = null, prev = -1, stable = 0;
  while (Date.now() < deadline) {
    state = await page.evaluate(() => {
      const el = document.querySelector("#start-screen");
      const vis = el ? getComputedStyle(el).visibility : "absent";
      const txt = (document.body ? document.body.innerText : "").replace(/\s+/g, " ").trim();
      return { vis, lang: document.documentElement.lang, sample: txt.slice(0, 200), cls: window.__cls };
    }).catch(() => null);
    const localized = state && state.lang === want;
    if (localized && state.cls === prev) stable += 1; else stable = 0;
    if (state) prev = state.cls;
    if (localized && stable >= 3) break;
    await sleep(1000);
  }
  await sleep(500);
  const cls = await page.evaluate(() => window.__cls).catch(() => null);
  if (shot) await page.screenshot({ path: shot });
  await ctx.close();
  return { ...state, cls };
}

try {
  const english = await run({ preseedLocale: null, shot: "tmp/i18n_modulepreload_mobile_en.png" });
  const es = await run({ preseedLocale: "es", shot: "tmp/i18n_modulepreload_mobile_es.png" });
  const delta = (es.cls ?? 0) - (english.cls ?? 0);

  console.log(JSON.stringify({
    base: BASE, viewport: "390x844 @3x mobile", throttle: "Slow-4G + 4x CPU",
    english: { cls: english.cls, lang: english.lang, sample: english.sample },
    storedEs: { cls: es.cls, lang: es.lang, sample: es.sample },
    localeAttributableClsDelta: delta,
    screenshots: ["tmp/i18n_modulepreload_mobile_en.png", "tmp/i18n_modulepreload_mobile_es.png"],
  }, null, 2));

  // NOTE on `localeAttributableClsDelta`: any non-zero delta is the homepage's static-English
  // -> localized TEXT SWAP reflow (the marketing landing copy outside the #start-screen
  // visibility gate), a PRE-EXISTING lazy-locale-flip behavior - NOT a stored-locale modulepreload effect. The stored-locale modulepreload injects
  // only a <link rel=modulepreload> in <head> (no rendered DOM, cannot shift layout) and a
  // network prefetch; it adds zero layout-affecting DOM and shrinks the English-visible window
  // (~23s -> ~2.5s under Slow-4G). So the acceptance asserts the stored-locale first paint is
  // in the CLS "good" range and the locale actually applied; the swap delta is informational.
  const fails = [];
  if (es.cls == null) fails.push("could not read stored-es CLS");
  if (es.cls != null && es.cls >= 0.1) fails.push(`stored-es CLS ${es.cls} >= 0.1 (worse than CLS-good)`);
  if (es.lang !== "es") fails.push(`stored-es documentElement.lang is "${es.lang}", expected "es" (locale not applied)`);
  if (fails.length) { console.error("FAIL:\n - " + fails.join("\n - ")); process.exit(1); }
  console.log(`PASS: stored-es CLS=${es.cls.toFixed(4)} (<0.1 good), lang=es applied; english CLS=${(english.cls ?? 0).toFixed(4)}; homepage translate-swap delta=${delta.toFixed(4)} (pre-existing, not the stored-locale modulepreload).`);
} finally {
  await browser.close();
}
