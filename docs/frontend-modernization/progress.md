# Frontend Modernization v0.16.0: Progress

Live status of the 30-phase restart packet on `feature/frontend-modernization-v016`
(off `release/v0.16.0`, `e31eb05d`). Update at the end of every phase (state.md STEP 6).
The packet was DEEP-REVIEWED and RESTRUCTURED 2026-06-24 (18 -> 30 phases via sub-letter splits);
the OLD -> NEW map, locked decisions, and validation matrix are in `state.md`.
Full per-phase scope/acceptance: each `phase-NN-*.md`; line numbers in `v016-recon-and-packet.md`.

## Status table

| Phase | Title | Layer | Status | Notes / deferrals |
|---|---|---|---|---|
| P0 | Foundation gates (CSS-corpus + UI-purity guard + perf/visual/mobile baseline) | gates | done | css_corpus.test.ts (47 index + 45 play 10-dash sections, corpus = inline UNION src/styles, teeth-proven) + architecture.test.ts UI_PURE_CORES (15 src/ui cores) + RENDER_PURE_CORES (cast_bar); tsc clean, npm test 3899 pass, biome clean, all 3 negative proofs fired+reverted. Baselines: perf-baseline-v016.md (DESKTOP frameP95 250ms / inputIntentToFrameP95 652.7ms / hudHotDomSkipRate 0.962 on M4 Max swiftshader; MOBILE deferred to P17a - portrait 390x844 + undismissed preflight, landscape-only d16a), visual-baseline-v016.md (theme/tab_target/loot_roll/mmo_controls; no diff harness exists), mobile-baseline-v016.md (4 PASS / 2 RED: button_size+joystick_size don't dismiss #mobile-preflight - pre-existing harness gap; only 2 of 6 truly assert; no portrait #rotate-device assertion - all for P4b) |
| P1 | CSS A: Lightning flip + tokens + base + CSS-import seam | css | done | Lightning flip (css.transformer + cssMinify = lightningcss) with targets via browserslistToTargets fed by a zero-dep .browserslistrc parser (Chrome>=120/FF>=121/Safari>=17.2/iOS>=17.2), NO browserslist npm dep (vanilla-only); dead css.postcss removed. src/styles/index.css barrel declares one @layer order (tokens,base,layout,components,hud,hud.mobile,shell,index.extra,play.extra), imported ONCE from src/main.ts (covers BOTH game entries; not admin/guide). tokens.css (index 186-269) + base.css (270-618) verbatim (tokens byte-identical, base differs only by biome cosmetic leading-zero); --range-fill stays the slider inline var(--range-fill,0%) fallback (NOT :root); cursor url()s absolutized to /ui/cursors/. GOTCHA: global Lightning flip hard-errors on play.html's inline relative cursor url() (custom-property ambiguity) -> 3-line absolutize survival fix (NOT the deferred P4 extraction); admin/guide had none. biome.json src/styles/** override (noImportantStyles + noDescendingSpecificity off, verbatim legacy CSS). client_shell: 3 relocated-rule assertions repointed to base.css. 3 commits b9fe99b2/0a120e9f/0892c250 (local, not pushed). tsc clean, full vitest 3906 pass / 8 skip, build x4 + manifest + i18n modulepreload green, qa-checklist no BLOCKING |
| P2 | CSS B1: in-world HUD chrome | css | pending | ULTRACODE; full section map incl Fiesta HUD 2303 + tooltip block |
| P3 | CSS B2: modal + feature windows | css | pending | ULTRACODE; Slice D ranges fixed (arena 1846, market 1900, options 1973, theme 2040, emote 2108) |
| P4a | CSS C-1: shell + char-select -> shell.css | css | pending | ULTRACODE; shell.css is NEW in V16 |
| P4b | CSS C-2: mobile-touch + per-entry .extra; empty both inline blocks | css | pending | ULTRACODE; --keyboard-inset/svh are FB-only (out of scope here); wire mobile E2E gate |
| P5 | ui_effects_profile resolver (src/game, 5-axis) + applier | effects | pending | BLOCKING-fixed: defines EFFECTS_QUALITY_LOW_CUTOFF, gfx.ts imports it; reduced-motion MQL + 180ms debounce + diff-guard |
| P6 | PainterHost (two facets) seam + pilot | seam | pending | BLOCKING-fixed: presentation dep-bag + write-elision facet (4 writers as closures); delve proves split not write-path; inline the acceptance checklist |
| P7a | Cold-window: talents | windows | pending | interactive (mutable talentStage); +WCAG +no-magic +ClientWorld parity |
| P7b | Cold-window: social + bags | windows | pending | ULTRACODE; social repaints on 500ms divider (event delegation / attach-once) |
| P8a | Cold-window: options | windows | pending | full 9-sub-panel dispatch matrix; +WCAG +no-magic |
| P8b | Cold-window: market + char | windows | pending | ULTRACODE; char skin-event Math.random stays on painter; 3D preview scoped; market loading/empty/error |
| P9a | Cold-window canvas: map + arena | windows | pending | preserve hud.update() mediumHud call site + 250ms cadence; canvas-token policy |
| P9b | Cold-window DOM: questlog + spellbook + leaderboard | windows | pending | the one IWorld painter fix (paged leaderboard); loading/empty/error/clamp states |
| P10a | Per-frame: xp + swing leak-fix + elided-writer extension | per-frame | pending | ULTRACODE; lands setStyleProp/toggleClass; skip-rate IMPROVES; PERF GATE |
| P10b | Per-frame: unit_frame FAMILY (player instance) | per-frame | pending | ULTRACODE; descriptor validated against FULL target field set; group-role a11y; PERF GATE |
| P11a | Per-frame: cast bars | per-frame | pending | ULTRACODE; eat/drink discriminator (i18n-free core in src/render/cast_bar.ts); PERF GATE |
| P11b | Per-frame: target frame (unit_frame instance) | per-frame | pending | ULTRACODE; portrait change-gate, combo pips, instance-cached absorb; PERF GATE |
| P11c | Per-frame: party frames (keyed pool) | per-frame | pending | ULTRACODE; innerHTML-wipe -> keyed pool; listeners-once; PERF GATE |
| P12a | Per-frame: action bar + allocation-budget spike | per-frame | pending | ULTRACODE; multi-bar descriptor; aria-label elision keeps t(); resolves the alloc proxy; PERF GATE |
| P12b | Per-frame: auras keyed pool + minimap canvas | per-frame | pending | ULTRACODE; tooltip closure reads live record; discriminated Marker union; canvas-token policy; PERF GATE |
| P13a | Per-frame: FCT core + per-frame driver | per-frame | pending | ULTRACODE; core determinism (injected jitter); driver folded into hud.update via adapter |
| P13b | Per-frame: FCT pooled painter + migration + gate | per-frame | pending | ULTRACODE; getUiScale; class-token colors; 7 sites + showSelfNote (main.ts:1727); bounded-AoE gate |
| P14a | Per-element graphics tiering | tiering | pending | tier knobs read static preset only; STEP 0 checks P13b exposed cap/TTL/crit knobs |
| P14b | Nameplate extraction | tiering | pending | nameplate_view core + painter (real Three/DOM extraction); tier-driven interval; mobile 1/15 floor |
| P15a | Accessibility infra | a11y | pending | NEW; ONE focus manager (full ~15-caller set), skip links, live regions (named cadence), forced-colors, print |
| P15b | Accessibility audit + tooling | a11y | pending | NEW; chrome-wide axe + keyboard E2E (opt-in browser suite); per-window fixes; mobile target-size pass |
| P16 | Standards codification into CLAUDE.md | standards | pending | NEW; docs-only; reconcile WCAG 2.1->2.2 + keep 40px floor; src/styles Repo-map row; faithfulness review |
| P17a | Harness floor (test-only) | close | pending | client_shell re-author + standing hud_perf_budget + UI_PURE_CORES completeness sweep + first all-together perf run |
| P17b | Bundle + lazy-load + cross-engine + close | close | pending | bundle-budget gate + selective lazy-load (a11y loading state) + mobile-Safari/WebKit E2E + axe CI + final exit |

Legend: pending / in-progress / complete / complete+QA.

## Layer gates (the de-risk ordering)

1. Gates + CSS + effects + cold-window seam (P0-P9b) restore the proven FB architecture on v0.16.0.
2. Per-frame extraction (P10a-P13b) only starts once the seam (P6) and gates (P0) are green; P10a
   lands the elided-writer extension and P10b the parameterized unit_frame family that P11a/b/c reuse.
3. Per-element tiering (P14a) only starts once every hot element is a core+painter (P10a-P13b);
   P14b formalizes nameplates.
4. Accessibility (P15a infra, P15b audit) consolidates + audits a11y once every component exists
   (per-window/per-control a11y is built in during P7a-P14b via the MANDATORY WINDOW/CONTROL gate).
5. Standards codification (P16) writes the proven, guard-backed contracts into the CLAUDE.md files.
6. Close (P17a harness floor, then P17b bundle + lazy-load + cross-engine E2E) re-authors the
   harness, makes the per-frame budget standing, and runs the final CI/perf exit gate.

## Per-phase deliverable checklists

Each phase's acceptance criteria live in its `phase-NN-*.md` STEP 5. This section accumulates the
ACTUAL outcome (files added, deferrals, commits, QA verdict) as phases complete. Empty until P0
starts.

- P0: _not started_
- P1: DONE (committed locally, not pushed: b9fe99b2 build flip / 0a120e9f barrel+seam / 0892c250 extract tokens+base). Files added: .browserslistrc, scripts/browserslist_targets.mjs (+ .d.mts + tests/browserslist_targets.test.ts), src/styles/{index,tokens,base}.css. Lightning targets via browserslistToTargets(zero-dep .browserslistrc parser) keep the build vanilla (no browserslist/caniuse-lite dep). @layer order declared once in index.css; barrel imported once from src/main.ts so both game entries (index.html + play.html, shared bootstrap) get tokens+base; admin/guide use their own entries (decision 18). tokens+base moved verbatim (tokens byte-identical; base differs only by biome cosmetic leading-zero on one cubic-bezier). --range-fill stays the slider inline var(--range-fill,0%) fallback (never :root); theme.ts --color-* and resizer --app-vw/--app-vh stay overridable :root defaults. SURVIVAL FIX: play.html's 3 inline cursor url()s absolutized './ui/cursors/' -> '/ui/cursors/' because Lightning rejects relative url() in a custom property (build-survival, NOT the deferred extraction). biome.json src/styles/** override disables noImportantStyles + noDescendingSpecificity (verbatim load-bearing !important + source order). client_shell: 3 relocated-rule assertions (base #ui, html/body touch-action, body.game-active) repointed to base.css. DEFERRED to P4: play.html token/base extraction + reconciliation (its block diverges, 327 vs 433 lines). QA (qa-checklist): no BLOCKING / no SHOULD-FIX; cascade-neutral ground-truthed (base sat entirely above all HUD CSS; the few real overlaps resolve to identical values). Validation: tsc clean, vitest 3906 pass / 8 skip, build all 4 entries + manifest + i18n modulepreload, biome ci green. backdrop-filter survival = N/A in P1 (0 in tokens/base/built chunk; HUD backdrop-filters move in P2).
- P2: _not started_
- P3: _not started_
- P4a: _not started_
- P4b: _not started_
- P5: _not started_
- P6: _not started_
- P7a: _not started_
- P7b: _not started_
- P8a: _not started_
- P8b: _not started_
- P9a: _not started_
- P9b: _not started_
- P10a: _not started_
- P10b: _not started_
- P11a: _not started_
- P11b: _not started_
- P11c: _not started_
- P12a: _not started_
- P12b: _not started_
- P13a: _not started_
- P13b: _not started_
- P14a: _not started_
- P14b: _not started_
- P15a: _not started_
- P15b: _not started_
- P16: _not started_
- P17a: _not started_
- P17b: _not started_

## Open items / carry-forward
- The allocation-budget Node-proxy spike (recon open-decision 4) is pulled forward into P12a so the
  downstream per-frame phases inherit a decided proxy (fallback = perf_tour frameP95 + longtasks).
- iOS real-device pass for the mobile-landscape CSS (carried from FB's Phase 5) remains a manual
  deliverable that cannot run in CI; P4b wires the automatable mobile E2E scripts as the CI proxy.
- The first all-together perf_tour run lands in P17a; if it surfaces cumulative drift, the recovery
  is re-opening the offending per-frame phase (tagged at its green gate), never relaxing the budget.
- admin.html / guide.html CSS is SURVIVAL-only this packet (decision 18); not extracted.
