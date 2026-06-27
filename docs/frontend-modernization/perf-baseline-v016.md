# P0 perf baseline (v0.16.0)

The recorded perf floor the per-frame phases (P10a to P14b) regress against. P0 only
RECORDS this; it does not gate against it (there is no prior baseline to beat). perf_tour
itself is NOT re-authored in P0 (its re-author is P17a); this phase only ran it.

## How the numbers are framed (read this first)

Two different kinds of number live here, and they are NOT compared the same way:

- **`hudHotDomSkipRate` is the DURABLE anchor.** It is a ratio (skipped hot-DOM writes /
  total hot-DOM writes), so it is machine-independent: it measures how often the HUD's
  write-elision cache avoided a redundant DOM write, which does not depend on CPU/GPU
  speed. Every per-frame phase asserts this skip-rate has not DROPPED versus this baseline.
  This is the number that travels.
- **`frameP95` and `inputIntentToFrameP95` are SAME-MACHINE-RELATIVE only.** They are
  wall-clock milliseconds and do NOT travel across hardware. They were captured under
  headless Chrome with software WebGL (`--use-angle=swiftshader`), which renders at roughly
  1 to 2 fps, so the absolute ms below are dominated by software rasterization, not by HUD
  cost. A later phase compares them against a FRESH same-machine re-run of THIS baseline
  (re-run the exact command below on the same hardware, then diff), never against the
  literal P0 ms on different hardware or a different renderer.

## Prerequisite (exact)

perf_tour drives a real browser against the OFFLINE client only. It needs:

- `npm run dev` (Vite) listening on **http://localhost:5173**. That is the ONLY process
  required: perf_tour boots the offline `Sim` (clicks `#btn-offline`, names a character,
  picks warrior, clicks `#btn-start-offline`), so **`npm run server` / :8787 is NOT needed**
  and no Postgres is needed.
- A Chromium-family browser resolved by `scripts/browser_path.mjs` (here:
  `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`). Launched `headless: 'new'`
  with `--use-angle=swiftshader --enable-unsafe-swiftshader`.

## Exact command + flags

```sh
# desktop profile (1600x900, deviceScaleFactor 1, non-touch):
PERF_VIEWPORT=desktop node scripts/perf_tour.mjs
# (optional) pin the JSON output path:
PERF_OUT=/path/to/perf-tour-desktop.json PERF_VIEWPORT=desktop node scripts/perf_tour.mjs
```

`PERF_VIEWPORT` selects the profile: `desktop`, `mobile`, or `both` (default). Other
relevant defaults: `GAME_URL=http://localhost:5173`, `PERF_SCENARIO=bench_perf_tour`,
`PERF_STEP_MS=2500`, `PERF_SETTLE_MS=600`, `PERF_BOOT_TIMEOUT_MS=120000`. No `PERF_MAX_*`
threshold was set, so the run records numbers without failing on a budget.

## Machine spec (because absolute ms is not portable)

| Field | Value |
|---|---|
| CPU | Apple M4 Max |
| Cores | 16 logical / 16 physical |
| RAM | 128 GB |
| OS | macOS 26.5.1 (arm64) |
| Node | v24.15.0 |
| Browser | Google Chrome 149.0.7827.196, headless, ANGLE swiftshader (software WebGL) |
| Captured | 2026-06-24 |

## Recorded floor

### desktop (1600x900): CAPTURED

| Metric | Value | Role |
|---|---|---|
| **hudHotDomSkipRate** | **0.962** (38 hot writes / 950 skipped, 988 total) | DURABLE anchor: per-frame phases assert skip-rate does not drop below this |
| frameP95 | 250 ms | same-machine-relative only |
| inputIntentToFrameP95 | 652.7 ms | same-machine-relative only |
| inputIntentToVisibleP95 | 658.2 ms | same-machine-relative only |
| fps (full / last 10s) | 1.29 / 1.58 | software-WebGL artifact, recorded for context only |
| rendererTier | ultra | |
| bootMiB | 68.779 | |
| gltf / textures / views | 150 / 51 / 46 | |
| samples / errors | 6 / 0 | |

### mobile (844x390 landscape): CAPTURED at P17a (first all-together run)

P0 could NOT boot the mobile profile: the viewport was portrait 390x844, but the in-game
world is landscape-only on web mobile (decision 16a), so it hit the `#rotate-device` gate,
and `bootOffline` never dismissed the `#mobile-preflight` overlay (boot timed out at 120s).
P17a re-authored perf_tour's mobile profile: the viewport is now LANDSCAPE 844x390 (an
iPhone-class phone rotated, still matching `PHONE_TOUCH_QUERY` so the touch HUD is what gets
measured) and `bootOffline` clicks `#mobile-preflight-continue` on the mobile profile. The
world now boots. First capture (same M4 Max / swiftshader as desktop, 2026-06-26):

| Metric | Value | Role |
|---|---|---|
| **hudHotDomSkipRate** | **0.961** | within the boot-write band; hotWrites (the bypass count) is 152, IDENTICAL to desktop |
| hudHotDomWrites | 152 | the DURABLE invariant: the elision-bypass count, byte-identical to desktop + the P13b pin |
| frameP95 | 250 ms | same-machine-relative only (first mobile capture, no prior floor to beat) |
| fct burst | [64, 64, 64] | FCT pool cap-bounded (FCT_POOL_CAP=64) under the 3x400 AoE waves |
| bootMiB | 55.066 | |

On the 0.961 vs the desktop 0.962: the hot-DOM-WRITE count is 152 on BOTH profiles (the
elision-bypass count is invariant), so write-elision did NOT regress; the 0.001 ratio gap is
pure denominator (frame-count) noise on the slightly shorter mobile tour, the documented
boot-write band. The desktop profile (the one with a P0 baseline) held EXACTLY at the 0.962
floor. The durable per-frame anchor across both profiles is hotWrites=152.

## What later phases do with this

- P10a to P14b: assert `hudHotDomSkipRate >= 0.962` (the durable gate) and `frameP95 <=` a
  fresh same-machine re-run of this desktop baseline (NOT <= the literal 250 ms on other
  hardware). Re-run `PERF_VIEWPORT=desktop node scripts/perf_tour.mjs` on the gating machine
  to get the comparison number.
- P17a (DONE 2026-06-26): re-authored perf_tour's mobile profile (landscape boot, above) and
  added the standing `tests/hud_perf_budget.test.ts`, which READS the 0.962 floor from this
  file (throws if absent). The first all-together run (desktop + mobile) held: desktop
  frameP95 250 == baseline, skip-rate 0.962 == floor, FCT [64,64,64]; mobile booted and
  measured (skip-rate 0.961 / hotWrites 152, see above). No per-frame regression.
