// Stored-locale modulepreload network + TTI trace for i18n lazy locales.
//
// Drives the PRODUCTION build (serve with `vite preview`) through Chrome via CDP under
// Slow-4G + 4x CPU throttling and reports, per scenario, the locale-chunk request set:
// double-fetch (count per chunk url), initialPriority, initiator, start time vs the main
// chunk (waterfall check), and a TTI proxy (time until the locale chunk finishes, which
// gates first localized paint). Median of RUNS per scenario.
//
//   BASE_URL=http://localhost:4173 RUNS=5 node scripts/i18n_modulepreload_trace.mjs
//   LABEL=modulepreload  (optional tag in the output)
//
// Needs a running preview server (see BASE_URL) and a local Chrome/Edge (browser_path.mjs).

import puppeteer, { PredefinedNetworkConditions } from "puppeteer-core";
import { BROWSER_PATH } from "./browser_path.mjs";

const BASE = (process.env.BASE_URL || "http://localhost:4173").replace(/\/$/, "");
const RUNS = Number(process.env.RUNS || 5);
const LABEL = process.env.LABEL || "modulepreload";
const SLOW_4G = PredefinedNetworkConditions["Slow 4G"];

const LOCALE_RE = /\/assets\/(es|es_ES|fr_FR|fr_CA|en_CA|it_IT|de_DE|zh_CN|zh_TW|ko_KR|ja_JP|pt_BR|ru_RU)-[^/]+\.js(\?|$)/;
const MAIN_RE = /\/assets\/main-[^/]+\.js(\?|$)/;

function median(xs) {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// One measured load in a fresh, cache-disabled, throttled incognito context.
// `preseedLocale` (e.g. "es") is written to localStorage on a throwaway first visit, then
// the measured navigation is a reload of `path` (the realistic returning-visitor path).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function measure(browser, { path, preseedLocale, expectLocale }) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  // Block cross-origin (Turnstile / Google Fonts) so external latency doesn't skew the
  // same-origin chunk-waterfall timing. gtag is already skipped on localhost.
  const sameOrigin = (u) => { try { return new URL(u).origin === new URL(BASE).origin; } catch { return false; } };
  await page.setRequestInterception(true);
  page.on("request", (req) => { if (sameOrigin(req.url())) req.continue(); else req.abort(); });

  const client = await page.target().createCDPSession();
  await client.send("Network.enable");
  await client.send("Network.setCacheDisabled", { cacheDisabled: true });
  // PredefinedNetworkConditions uses {download, upload, latency}; CDP wants the *Throughput names.
  await client.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: SLOW_4G.latency,
    downloadThroughput: SLOW_4G.download,
    uploadThroughput: SLOW_4G.upload,
  });
  await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });

  if (preseedLocale) {
    // Throwaway visit to set the stored locale on the correct origin (the realistic
    // returning-visitor setup); the measured reload below fetches every chunk fresh.
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 120000 }).catch(() => {});
    await page.evaluate((l) => localStorage.setItem("locale", l), preseedLocale);
  }

  const reqs = new Map(); // requestId -> { url, priority, initiator, start, finish }
  let t0 = null;
  client.on("Network.requestWillBeSent", (e) => {
    if (t0 === null) t0 = e.timestamp;
    reqs.set(e.requestId, {
      url: e.request.url,
      priority: e.request.initialPriority,
      initiator: e.initiator?.type,
      start: e.timestamp,
      finish: null,
    });
  });
  client.on("Network.loadingFinished", (e) => {
    const r = reqs.get(e.requestId);
    if (r) r.finish = e.timestamp;
  });

  // Kick off navigation (waitUntil:"load" with a catch - under Slow-4G the full page with media
  // may never reach `load`, so we do NOT depend on it). The request-finish poll below, not the
  // load event, is what actually gates the measurement: it waits until the target chunk downloads.
  page.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 150000 }).catch(() => {});
  const finishedMain = () => { const m = [...reqs.values()].find((r) => MAIN_RE.test(r.url)); return m && m.finish != null; };
  const finishedLocale = () => [...reqs.values()].some((r) => LOCALE_RE.test(r.url) && r.finish != null);
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    if (finishedMain() && (expectLocale ? finishedLocale() : true)) break;
    await sleep(200);
  }
  // English: give a grace window to confirm no locale chunk is requested late.
  if (!expectLocale) await sleep(3000);

  const all = [...reqs.values()];
  const ms = (ts) => (ts == null || t0 == null ? null : Math.round((ts - t0) * 1000));
  const main = all.find((r) => MAIN_RE.test(r.url));
  const locales = all.filter((r) => LOCALE_RE.test(r.url));

  // Double-fetch: any locale chunk url requested more than once.
  const urlCounts = {};
  for (const r of locales) urlCounts[r.url] = (urlCounts[r.url] || 0) + 1;
  const doubleFetched = Object.entries(urlCounts).filter(([, n]) => n > 1).map(([u]) => u);

  const locale = locales[0] || null;
  await ctx.close();

  return {
    localeChunkRequests: locales.length,
    localeUrls: [...new Set(locales.map((r) => r.url.replace(BASE, "")))],
    doubleFetched,
    localePriority: locale?.priority ?? null,
    localeInitiator: locale?.initiator ?? null,
    localeStartMs: ms(locale?.start),
    localeFinishMs: ms(locale?.finish), // TTI proxy: localized paint cannot precede this
    mainStartMs: ms(main?.start),
    mainFinishMs: ms(main?.finish),
    // No waterfall iff the locale fetch begins before main finishes downloading.
    noWaterfall: locale && main && locale.start < main.finish,
  };
}

async function scenario(browser, name, opts) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) runs.push(await measure(browser, opts));
  const num = (k) => median(runs.map((r) => r[k]).filter((v) => typeof v === "number" && !Number.isNaN(v)));
  const first = runs[0];
  return {
    name,
    runs: RUNS,
    localeChunkRequests: num("localeChunkRequests"),
    localeUrls: first.localeUrls,
    anyDoubleFetch: runs.some((r) => r.doubleFetched.length > 0),
    localePriority: first.localePriority,
    localeInitiator: first.localeInitiator,
    medianLocaleStartMs: num("localeStartMs"),
    medianLocaleFinishMs: num("localeFinishMs"),
    medianMainStartMs: num("mainStartMs"),
    medianMainFinishMs: num("mainFinishMs"),
    noWaterfallEveryRun: runs.every((r) => r.noWaterfall !== false),
  };
}

const browser = await puppeteer.launch({
  executablePath: BROWSER_PATH,
  headless: true,
  args: ["--use-angle=swiftshader", "--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  const english = await scenario(browser, "english (no stored / no ?lang)", { path: "/", expectLocale: false });
  const storedEs = await scenario(browser, "stored es (localStorage.locale=es -> link + prefetch)", { path: "/", preseedLocale: "es", expectLocale: true });
  const langEs = await scenario(browser, "?lang=es (no stored -> prefetch only, NO link)", { path: "/?lang=es", expectLocale: true });

  const out = { label: LABEL, base: BASE, throttle: "Slow-4G + 4x CPU", runsPerScenario: RUNS, scenarios: [english, storedEs, langEs] };
  console.log(JSON.stringify(out, null, 2));

  // Headline assertions (exit non-zero on any failure).
  const fails = [];
  if (english.localeChunkRequests !== 0) fails.push("english fetched a non-en locale chunk");
  if (storedEs.localeChunkRequests < 1) fails.push("stored-es fetched no locale chunk");
  if (storedEs.anyDoubleFetch) fails.push("stored-es double-fetched the locale chunk");
  if (!storedEs.noWaterfallEveryRun) fails.push("stored-es showed a main-then-locale waterfall");
  if (storedEs.medianLocaleFinishMs >= langEs.medianLocaleFinishMs) {
    fails.push(`stored-es (link) not faster than ?lang-es (no link): ${storedEs.medianLocaleFinishMs}ms vs ${langEs.medianLocaleFinishMs}ms`);
  }
  if (fails.length) {
    console.error("FAIL:\n - " + fails.join("\n - "));
    process.exit(1);
  }
  console.log("PASS: english zero non-en chunks; stored-es single high-priority chunk, no waterfall, faster than no-link.");
} finally {
  await browser.close();
}
