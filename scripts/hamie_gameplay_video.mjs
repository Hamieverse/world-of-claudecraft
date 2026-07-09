// Records a gameplay video of the Hamie hero model (?hamie preview): wave at the
// camera, run north through Eastbrook with jumps, fight a forest wolf, dance,
// cheer, and a closing 360 orbit. Writes tmp/hamie-gameplay.webm.
// Needs npm run dev; override the port with GAME_URL=http://localhost:5175.
// VARIANT=poly records the low-poly variant (?hamie=poly). SOFT_GL=1 forces
// SwiftShader (CI); by default the real GPU renders, which looks far better.
import { mkdirSync } from 'node:fs';

import puppeteer from 'puppeteer-core';

import { BROWSER_PATH } from './browser_path.mjs';
import { enterOfflineGame } from './enter_offline_game.mjs';

const GAME_URL = process.env.GAME_URL ?? 'http://localhost:5173';
const HAMIE_PARAM = process.env.VARIANT === 'poly' ? 'hamie=poly' : 'hamie';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync('tmp', { recursive: true });
const browser = await puppeteer.launch({
  executablePath: BROWSER_PATH,
  headless: 'new',
  protocolTimeout: 300000,
  args: [
    '--window-size=1280,720',
    ...(process.env.SOFT_GL ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : []),
  ],
  defaultViewport: { width: 1280, height: 720 },
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${GAME_URL}/?${HAMIE_PARAM}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
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

// Clean frame: drop the tutorial toast.
await page.evaluate(() => {
  for (const b of document.querySelectorAll('button')) {
    if (b.textContent.trim() === 'Skip Tutorial') b.click();
  }
});

// God-mode drip (offline sim): top hp up so the wolf cannot cut the shoot short.
await page.evaluate(() => {
  window.__hamieGod = setInterval(() => {
    const p = window.__game?.sim?.player;
    if (p && !p.dead) p.hp = p.maxHp;
  }, 500);
});

// Opening mark south of town, facing north up the road.
await page.evaluate(() => {
  const g = window.__game;
  g.sim.player.pos.x = 0;
  g.sim.player.pos.z = -40;
  g.sim.player.facing = 0;
  g.input.camYaw = 0;
});
await sleep(900);

const recorder = await page.screencast({ path: 'tmp/hamie-gameplay.webm' });

// 1) Face the camera and wave hello.
await page.evaluate(() => {
  window.__game.input.camYaw = Math.PI;
});
await sleep(1400);
await page.keyboard.press('Enter');
await sleep(300);
await page.keyboard.type('/wave', { delay: 40 });
await page.keyboard.press('Enter');
await sleep(2800);

// 2) Camera behind, run north through town with two jumps.
await page.evaluate(() => {
  window.__game.input.camYaw = 0;
});
await sleep(600);
await page.keyboard.down('w');
await sleep(2200);
await page.keyboard.press('Space');
await sleep(1600);
await page.keyboard.press('Space');
await sleep(2400);
await page.keyboard.up('w');
await sleep(500);

// 3) Hop to the wolf meadow north of town and pick the nearest live level-1 wolf.
const wolf = await page.evaluate(() => {
  const g = window.__game;
  const ents = [...g.sim.entities.values()];
  const p = g.sim.player;
  p.pos.x = 2;
  p.pos.z = 44;
  const w = ents
    .filter((e) => e.kind === 'mob' && e.templateId === 'forest_wolf' && !e.dead && e.level === 1)
    .map((e) => ({ id: e.id, x: e.pos.x, z: e.pos.z, d: (e.pos.x - 2) ** 2 + (e.pos.z - 44) ** 2 }))
    .sort((a, b) => a.d - b.d)[0];
  if (w) {
    p.targetId = w.id;
    p.facing = Math.atan2(w.x - p.pos.x, w.z - p.pos.z);
    g.input.camYaw = p.facing + Math.PI * 0.12; // slight side angle for the fight
  }
  return w ?? null;
});
console.log('wolf target:', JSON.stringify(wolf));
await sleep(900);

// 4) Fight: close distance with W taps, keep slot-1 ability + auto-attack going.
let killed = false;
for (let i = 0; i < 30; i++) {
  const st = await page.evaluate(() => {
    const g = window.__game;
    const t = g.sim.entities.get(g.sim.player.targetId);
    if (!t || t.dead) return { done: true };
    const dx = t.pos.x - g.sim.player.pos.x;
    const dz = t.pos.z - g.sim.player.pos.z;
    g.sim.player.facing = Math.atan2(dx, dz);
    return { done: false, dist: Math.hypot(dx, dz), hp: t.hp };
  });
  if (st.done) {
    killed = true;
    break;
  }
  if (st.dist > 2.5) {
    await page.keyboard.down('w');
    await sleep(Math.min(900, st.dist * 130));
    await page.keyboard.up('w');
  }
  await page.keyboard.press('1');
  await sleep(650);
}
console.log('wolf killed:', killed);
await sleep(1500);

// 5) Step out of the pack's aggro range (wolves leash), then celebrate:
//    dance, then cheer, facing the camera in the open.
await page.evaluate(() => {
  const g = window.__game;
  g.sim.player.pos.x = 2;
  g.sim.player.pos.z = 24;
  g.sim.player.targetId = null;
  g.sim.player.facing = Math.PI;
  g.input.camYaw = 0;
});
await sleep(1200);
await page.keyboard.press('Enter');
await sleep(300);
await page.keyboard.type('/dance', { delay: 40 });
await page.keyboard.press('Enter');
await sleep(3800);
await page.keyboard.press('Enter');
await sleep(300);
await page.keyboard.type('/cheer', { delay: 40 });
await page.keyboard.press('Enter');
await sleep(3000);

// 6) Slow 360 orbit for the closing shot.
await page.evaluate(() => {
  const start = window.__game.input.camYaw;
  let t = 0;
  window.__hamieOrbit = setInterval(() => {
    t += 0.05;
    window.__game.input.camYaw = start + t * (Math.PI / 3.2);
  }, 50);
});
await sleep(6800);
await page.evaluate(() => clearInterval(window.__hamieOrbit));

await recorder.stop();
await page.evaluate(() => clearInterval(window.__hamieGod));
console.log('video: tmp/hamie-gameplay.webm');
console.log(errors.length ? `ERRORS: ${errors.join('; ')}` : 'no page errors');
await browser.close();
