// vc/brix/tests/seeding/bots.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PROFILES,
  mulberry32,
  hashSeed,
  materializeBots,
  decide,
  RATING_SCALE,
} from '../../packages/cli/seeding/lib/bots.mjs';
import { minimalScenario, fullScenario } from './helpers/scenarios.mjs';

test('mulberry32 es determinista y queda en [0,1)', () => {
  const a = mulberry32(42),
    b = mulberry32(42);
  const xs = Array.from({ length: 5 }, () => a());
  assert.deepEqual(
    xs,
    Array.from({ length: 5 }, () => b()),
  );
  for (const x of xs) assert.ok(x >= 0 && x < 1);
});

test('hashSeed separa bots y rondas', () => {
  assert.notEqual(hashSeed(1, 0, 0), hashSeed(1, 1, 0));
  assert.notEqual(hashSeed(1, 0, 0), hashSeed(1, 0, 1));
  assert.equal(hashSeed(7, 2, 3), hashSeed(7, 2, 3));
});

test('la misma semilla produce la misma secuencia de decisiones; otra semilla, otra', () => {
  const labels = ['a', 'b', 'c', 'd'];
  const run = (seed) =>
    [0, 1, 2].map((r) =>
      decide({
        profile: 'steady',
        seed,
        botIndex: 0,
        roundIndex: r,
        labels,
        truth: 'b',
      }),
    );
  assert.deepEqual(run(1), run(1));
  assert.notDeepEqual(run(1), run(2));
});

test('expert acierta más que novice sobre muchas rondas', () => {
  const labels = ['a', 'b', 'c', 'd'];
  const hits = (profile) =>
    Array.from({ length: 400 }, (_, r) =>
      decide({
        profile,
        seed: 3,
        botIndex: 0,
        roundIndex: r,
        labels,
        truth: 'c',
      }),
    ).filter((d) => d.label === 'c').length;
  assert.ok(hits('expert') > 320, `expert ${hits('expert')}`);
  assert.ok(hits('novice') < 180, `novice ${hits('novice')}`);
});

test('sin truth degrada a random y lo marca', () => {
  const d = decide({
    profile: 'expert',
    seed: 1,
    botIndex: 0,
    roundIndex: 0,
    labels: ['a', 'b'],
    truth: null,
  });
  assert.equal(d.degraded, 'random');
  assert.ok(['a', 'b'].includes(d.label));
});

test('quitter deja de votar desde la ronda after', () => {
  const base = {
    profile: 'quitter',
    seed: 1,
    botIndex: 0,
    labels: ['a', 'b'],
    truth: 'a',
    after: 3,
  };
  assert.equal(decide({ ...base, roundIndex: 1 }).skipped, false);
  assert.equal(decide({ ...base, roundIndex: 2 }).skipped, true);
});

test('materializeBots pone los suplentes primero solo en autónomo, expande count y asigna mixed en orden', () => {
  const auto = materializeBots(minimalScenario(), { mode: 'autonomous' });
  assert.deepEqual(
    auto.map((b) => [b.id, b.kind, b.profile]),
    [
      ['host', 'host', 'steady'],
      ['bots-1', 'guest', 'expert'],
      ['bots-2', 'guest', 'steady'],
    ],
  );
  assert.equal(auto[0].standInFor, 'host');
  assert.equal(auto[0].plays, true);
  assert.deepEqual(
    auto.map((b) => b.index),
    [0, 1, 2],
  );
  const cond = materializeBots(minimalScenario(), { mode: 'conducted' });
  assert.deepEqual(
    cond.map((b) => b.id),
    ['bots-1', 'bots-2'],
  );
  const full = materializeBots(fullScenario(), { mode: 'autonomous' });
  assert.deepEqual(
    full.map((b) => b.id),
    ['host', 'registered_google', 'bots-1', 'bots-2', 'bots-3'],
  );
});

test('todas las PROFILES declaran rangos coherentes', () => {
  for (const [name, p] of Object.entries(PROFILES)) {
    if (name === 'mixed') continue;
    assert.ok(p.hit === null || (p.hit >= 0 && p.hit <= 1), name);
    assert.ok(
      p.rating[0] <= p.rating[1] && p.rating[0] >= 1 && p.rating[1] <= 10,
      name,
    );
    assert.ok(p.delay[0] <= p.delay[1] && p.delay[1] <= 1, name);
  }
});

test('la decisión de un bot declara la escala de su rating, para que el driver la convierta', () => {
  assert.equal(RATING_SCALE, 10);
  for (const profile of ['expert', 'novice', 'random']) {
    const d = decide({
      profile,
      seed: 7,
      botIndex: 0,
      roundIndex: 0,
      labels: ['a', 'b'],
      truth: 'a',
    });
    assert.equal(d.ratingScale, RATING_SCALE, profile);
    assert.ok(d.rating >= 1 && d.rating <= RATING_SCALE, profile);
  }
});
