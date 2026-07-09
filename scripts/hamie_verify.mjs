// Verifies the ?hamie preview: enters the offline world, confirms the Hamie rig
// is the live player model, and screenshots it from several camera angles.
// Needs npm run dev; override the port with GAME_URL=http://localhost:5175
import { mkdirSync } from 'node:fs';

import puppeteer from 'puppeteer-core';

import { BROWSER_PATH } from './browser_path.mjs';
import { enterOfflineGame } from './enter_offline_game.mjs';

const GAME_URL = process.env.GAME_URL ?? 'http://localhost:5173';

mkdirSync('tmp', { recursive: true });
const browser = await puppeteer.launch({
  executablePath: BROWSER_PATH,
  headless: 'new',
  args: ['--window-size=1280,720', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  defaultViewport: { width: 1280, height: 720 },
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
// domcontentloaded, not networkidle0: a cold Vite dev server transforms modules
// on demand and never goes network-idle; enterOfflineGame waits for the UI.
await page.goto(`${GAME_URL}/?hamie`, { waitUntil: 'domcontentloaded', timeout: 120000 });
// The Play button is static HTML; its handler binds when the app boots. Poll-click
// until the class select actually opens, then let enterOfflineGame drive the rest.
await page.waitForFunction(
  () => {
    const sel = document.querySelector('#offline-select');
    if (sel && sel.offsetParent !== null) return true;
    document.querySelector('#btn-offline')?.click();
    return false;
  },
  { polling: 500, timeout: 120000 },
);
await enterOfflineGame(page, { charClass: 'warrior', charName: 'Hamie' });

// Confirm the player's view really is the Hamie rig (node names survive cloning).
const modelCheck = await page.evaluate(() => {
  const g = window.__game;
  const view = g.renderer.views?.get?.(g.sim.player.id);
  let foundRig = false;
  const root = view?.group ?? g.renderer.scene;
  root.traverse?.((o) => {
    if (o.name === 'Hamie_rig') foundRig = true;
  });
  return { foundRig, playerId: g.sim.player.id };
});
console.log('Hamie_rig in player view:', modelCheck.foundRig ? 'OK' : 'FAIL');

// Quiet flat spot, then orbit the camera for angle shots.
await page.evaluate(() => {
  const g = window.__game;
  g.sim.player.pos.x = 0;
  g.sim.player.pos.z = -40;
  g.sim.player.facing = 0;
  g.input.camYaw = 0;
});
await new Promise((r) => setTimeout(r, 600));

const angles = [
  ['back', 0],
  ['side', Math.PI / 2],
  ['front', Math.PI],
];
for (const [label, yaw] of angles) {
  await page.evaluate((y) => {
    window.__game.input.camYaw = y;
  }, yaw);
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: `tmp/hamie-${label}.png` });
  console.log(`shot: tmp/hamie-${label}.png`);
}

// One running shot to eyeball the Walk/Run clip hookup.
await page.evaluate(() => {
  window.__game.input.camYaw = Math.PI * 0.85;
});
await page.keyboard.down('w');
await new Promise((r) => setTimeout(r, 900));
await page.screenshot({ path: 'tmp/hamie-running.png' });
await page.keyboard.up('w');
console.log('shot: tmp/hamie-running.png');

console.log(errors.length ? `ERRORS: ${errors.join('; ')}` : 'no page errors');
await browser.close();
