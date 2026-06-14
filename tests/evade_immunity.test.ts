// A wild mob retreating home after a leash break (aiState 'evade') has dropped
// its hate table and will not fight back. It must be immune to damage while it
// resets, otherwise a player can chip it down — or kill it outright — for a
// risk-free kill, which also breaks the classic reset contract.
import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim/sim';
import { dist2d } from '../src/sim/types';
import type { Entity } from '../src/sim/types';

function makeSim() {
  return new Sim({ seed: 42, playerClass: 'warrior', autoEquip: true });
}

function nearestMob(sim: Sim): Entity {
  let best: Entity | null = null;
  let bestD = Infinity;
  for (const e of sim.entities.values()) {
    if (e.kind !== 'mob' || e.dead || e.ownerId !== null) continue;
    const d = dist2d(sim.player.pos, e.pos);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best!;
}

function hit(sim: Sim, source: Entity, target: Entity, amount: number) {
  (sim as any).dealDamage(source, target, amount, false, 'physical', null, 'hit', true);
}

describe('evading mobs are immune while resetting', () => {
  it('takes no damage and gains no threat from a hit while evading', () => {
    const sim = makeSim();
    const wolf = nearestMob(sim);
    wolf.maxHp = 5000;
    wolf.hp = 5000;
    wolf.aiState = 'evade';
    wolf.threat.clear();

    hit(sim, sim.player, wolf, 1000);

    expect(wolf.hp).toBe(5000);
    expect(wolf.threat.size).toBe(0);
    expect(wolf.dead).toBe(false);
  });

  it('cannot be killed while evading', () => {
    const sim = makeSim();
    const wolf = nearestMob(sim);
    wolf.maxHp = 50;
    wolf.hp = 50;
    wolf.aiState = 'evade';

    hit(sim, sim.player, wolf, 99999);

    expect(wolf.dead).toBe(false);
    expect(wolf.hp).toBe(50);
  });

  it('still takes damage normally once it is fighting again', () => {
    const sim = makeSim();
    const wolf = nearestMob(sim);
    wolf.maxHp = 5000;
    wolf.hp = 5000;
    wolf.aiState = 'attack';
    wolf.threat.clear();

    hit(sim, sim.player, wolf, 100);

    expect(wolf.hp).toBe(4900);
    expect(wolf.threat.get(sim.playerId)).toBeCloseTo(100, 5);
  });
});
