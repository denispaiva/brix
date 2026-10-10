// vc/brix/tests/seeding/engine.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runScenario, planRun } from '../../packages/cli/seeding/engine.mjs';
import { createDriver } from '../../packages/cli/seeding/lib/fake-driver.mjs';
import { fullScenario } from './helpers/scenarios.mjs';

const emuEnv = {
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
};
const tmp = () => mkdtemp(path.join(tmpdir(), 'brix-seed-'));

test('planRun devuelve modo, actores (suplentes primero) y pasos expandidos', () => {
  const plan = planRun({
    scenario: fullScenario(),
    driver: createDriver({ target: 'emulator' }),
    target: 'emulator',
    seed: 5,
  });
  assert.equal(plan.mode, 'autonomous');
  assert.deepEqual(
    plan.bots.map((b) => b.id),
    ['host', 'registered_google', 'bots-1', 'bots-2', 'bots-3'],
  );
  assert.ok(plan.steps.length > 10);
  assert.equal(plan.seed, 5);
});

test('planRun lanza si el escenario no es válido para el target', () => {
  const s = fullScenario();
  delete s.steps[0].auto;
  assert.throws(
    () =>
      planRun({
        scenario: s,
        driver: createDriver({ target: 'emulator' }),
        target: 'emulator',
        seed: 1,
      }),
    /paso 1: manual sin auto/,
  );
});

test('corre la degustación completa en autónomo: evento closed, cinco puntajes, podio con variedad y manifiesto sin tokens', async () => {
  const dir = await tmp();
  const driver = createDriver({ target: 'emulator' });
  const m = await runScenario({
    scenario: fullScenario(),
    scenarioHash: 'h',
    driver,
    target: 'emulator',
    seed: 11,
    manifestDir: dir,
    env: emuEnv,
    runId: 'seed-test',
  });
  assert.ok(
    m.steps.every((s) => s.ok),
    m.steps
      .filter((s) => !s.ok)
      .map((s) => `${s.n}: ${s.note}`)
      .join('; '),
  );
  assert.equal(m.outcome, 'completed');
  assert.equal(m.actors.length, 5);
  const eventRef = m.roots.find((r) => r.type === 'event').ref;
  assert.equal(
    (await driver.read('event', { event: eventRef })).status,
    'closed',
  );
  const scores = await driver.read('scores', { event: eventRef });
  assert.equal(scores.length, 5);
  assert.ok(
    new Set(scores.map((s) => s.score)).size >= 2,
    'el podio tiene al menos dos puntajes distintos',
  );
  const saved = JSON.parse(
    await readFile(path.join(dir, 'seed-test.json'), 'utf8'),
  );
  assert.equal(saved.run_id, 'seed-test');
  assert.equal(JSON.stringify(saved).includes('Token'), false);
});

test('la misma semilla reproduce la misma bitácora de decisiones', async () => {
  const run = async () => {
    const m = await runScenario({
      scenario: fullScenario(),
      scenarioHash: 'h',
      driver: createDriver({ target: 'emulator' }),
      target: 'emulator',
      seed: 3,
      manifestDir: await tmp(),
      env: emuEnv,
      runId: 'seed-x',
    });
    return m.steps.filter((s) => s.op === 'play').map((s) => s.note);
  };
  assert.deepEqual(await run(), await run());
});

const silentIo = { print: () => {}, prompt: async () => '' };
const withFailingAssert = () => {
  const s = fullScenario();
  s.steps.splice(2, 0, {
    actor: 'runner',
    op: 'assert',
    expect: { 'event.status': 'closed' },
  });
  return s;
};

test('un expect fallido aborta y deja el manifiesto con lo creado', async () => {
  const dir = await tmp();
  const m = await runScenario({
    scenario: withFailingAssert(),
    scenarioHash: 'h',
    driver: createDriver({ target: 'emulator' }),
    target: 'emulator',
    seed: 1,
    manifestDir: dir,
    env: emuEnv,
    io: silentIo,
    runId: 'seed-abort',
  });
  assert.equal(m.outcome, 'aborted');
  assert.ok(
    m.roots.some((r) => r.type === 'event'),
    'el evento creado antes del assert quedó en el manifiesto',
  );
  const last = m.steps.at(-1);
  assert.equal(last.ok, false);
  assert.equal(last.op, 'assert');
  const saved = JSON.parse(
    await readFile(path.join(dir, 'seed-abort.json'), 'utf8'),
  );
  assert.equal(saved.outcome, 'aborted');
});

test('con keepGoing un paso fallido no corta la corrida y cierra como partial', async () => {
  const dir = await tmp();
  const m = await runScenario({
    scenario: withFailingAssert(),
    scenarioHash: 'h',
    driver: createDriver({ target: 'emulator' }),
    target: 'emulator',
    seed: 1,
    manifestDir: dir,
    env: emuEnv,
    io: silentIo,
    keepGoing: true,
    runId: 'seed-keep',
  });
  assert.equal(m.outcome, 'partial');
  const failedAt = m.steps.findIndex((s) => !s.ok);
  assert.ok(failedAt >= 0, 'hay un paso fallido');
  assert.ok(
    m.steps.length > failedAt + 1,
    'la corrida siguió después del paso fallido',
  );
  const saved = JSON.parse(
    await readFile(path.join(dir, 'seed-keep.json'), 'utf8'),
  );
  assert.equal(saved.outcome, 'partial');
});

test('si un mint falla a mitad, el manifiesto en disco queda aborted con lo ya acuñado', async () => {
  const dir = await tmp();
  const driver = createDriver({ target: 'emulator' });
  const realMint = driver.mint.bind(driver);
  let calls = 0;
  driver.mint = async (a) => {
    calls += 1;
    if (calls === 2) throw new Error('cupo agotado');
    return realMint(a);
  };
  await assert.rejects(
    runScenario({
      scenario: fullScenario(),
      scenarioHash: 'h',
      driver,
      target: 'emulator',
      seed: 1,
      manifestDir: dir,
      env: emuEnv,
      io: silentIo,
      runId: 'seed-mint',
    }),
    /acuñando .*cupo agotado/,
  );
  const saved = JSON.parse(
    await readFile(path.join(dir, 'seed-mint.json'), 'utf8'),
  );
  assert.equal(saved.outcome, 'aborted');
  assert.equal(saved.actors.length, 1);
  assert.ok(saved.roots.some((r) => r.type === 'auth_user'));
});

test('en conducido, los pasos manuales esperan el prompt, captures pide el código y abort cierra como partial', async () => {
  const prompts = [];
  const answers = ['', 'ABCD', 'abort'];
  const io = {
    print: () => {},
    prompt: async (t) => {
      prompts.push(t);
      return answers[prompts.length - 1];
    },
  };
  const driver = createDriver({ target: 'dev-x' });
  const m = await runScenario({
    scenario: fullScenario(),
    scenarioHash: 'h',
    driver,
    target: 'dev-x',
    seed: 1,
    manifestDir: await tmp(),
    env: {},
    io,
    isTTY: true,
    maxWait: 0,
    runId: 'seed-c',
  });
  assert.equal(m.outcome, 'partial');
  assert.match(prompts[0], /Crear el evento/);
  assert.match(prompts[1], /Código del evento/);
  assert.equal(
    m.actors.length,
    3,
    'en conducido no hay suplentes: solo los 3 bots',
  );
  assert.equal(await driver.read('participants', { event: 'events/ABCD' }), 0);
});
