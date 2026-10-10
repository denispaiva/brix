// vc/brix/tests/seeding/manifest.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  newRunId,
  createManifest,
  addActor,
  addRoots,
  logStep,
  finish,
  assertNoTokens,
  manifestDir,
  saveManifest,
  loadManifest,
  listManifests,
} from '../../packages/cli/seeding/lib/manifest.mjs';

test('newRunId tiene la forma seed-YYYYMMDD-HHMMSS-xxxx', () => {
  const id = newRunId(new Date('2026-10-06T16:28:05Z'), () => 0.5);
  assert.match(id, /^seed-20261006-162805-[0-9a-f]{4}$/);
});

test('el manifiesto acumula actores, raíces y bitácora, y el desenlace cierra', () => {
  const m = createManifest({
    runId: 'seed-1',
    scenario: { id: 'x' },
    scenarioHash: 'abc',
    driver: 'fake',
    target: 'emulator',
    mode: 'autonomous',
    seed: 7,
  });
  addActor(m, {
    id: 'host',
    kind: 'host',
    uid: 'seed-1-host',
    alias: 'Host',
    profile: 'steady',
  });
  addRoots(
    m,
    [
      { type: 'event', ref: 'events/e1' },
      { type: 'auth_user', ref: 'seed-1-host' },
    ],
    1,
  );
  logStep(m, { n: 1, op: 'create_event', actor: 'host', ok: true, ms: 12 });
  finish(m, 'completed');
  assert.equal(m.roots.length, 2);
  assert.equal(m.roots[0].step, 1);
  assert.equal(m.steps[0].op, 'create_event');
  assert.equal(m.outcome, 'completed');
  assert.ok(m.finished_at);
});

test('assertNoTokens rechaza cualquier clave que huela a credencial, en profundidad', () => {
  assert.throws(
    () => assertNoTokens({ actors: [{ uid: 'u', idToken: 'x' }] }),
    /idToken/,
  );
  assert.throws(
    () => assertNoTokens({ a: { b: { refresh_token: 'x' } } }),
    /refresh_token/,
  );
  assert.doesNotThrow(() =>
    assertNoTokens({ actors: [{ uid: 'u', alias: 'Bot-1' }] }),
  );
});

test('manifestDir prefiere BRIX_SEED_DIR y cae a ~/.brix/seed-runs', () => {
  assert.equal(manifestDir({ BRIX_SEED_DIR: '/x/y' }), '/x/y');
  assert.match(
    manifestDir({ HOME: '/home/u' }),
    /\/home\/u\/\.brix\/seed-runs$/,
  );
});

test('save, load y list van y vuelven del disco, ordenados por inicio descendente', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'brix-seed-'));
  const a = createManifest({
    runId: 'seed-a',
    scenario: { id: 'x' },
    scenarioHash: '1',
    driver: 'fake',
    target: 'emulator',
    mode: 'autonomous',
    seed: 1,
  });
  a.started_at = '2026-10-06T10:00:00Z';
  const b = { ...a, run_id: 'seed-b', started_at: '2026-10-06T11:00:00Z' };
  await saveManifest(a, dir);
  await saveManifest(b, dir);
  assert.equal((await loadManifest('seed-a', dir)).run_id, 'seed-a');
  assert.deepEqual(
    (await listManifests(dir)).map((m) => m.run_id),
    ['seed-b', 'seed-a'],
  );
});

test('saveManifest se niega si hay tokens', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'brix-seed-'));
  const m = createManifest({
    runId: 'seed-t',
    scenario: { id: 'x' },
    scenarioHash: '1',
    driver: 'fake',
    target: 'emulator',
    mode: 'autonomous',
    seed: 1,
  });
  m.actors.push({ uid: 'u', idToken: 'nope' });
  await assert.rejects(saveManifest(m, dir), /idToken/);
});

const baseManifest = (runId) =>
  createManifest({
    runId,
    scenario: { id: 'x' },
    scenarioHash: '1',
    driver: 'fake',
    target: 'emulator',
    mode: 'autonomous',
    seed: 1,
  });

test('listManifests sobre un directorio inexistente devuelve []', async () => {
  const dir = path.join(
    await mkdtemp(path.join(tmpdir(), 'brix-seed-')),
    'no-existe',
  );
  assert.deepEqual(await listManifests(dir), []);
});

test('listManifests nombra el archivo ilegible en vez de leerlo como vacío', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'brix-seed-'));
  await saveManifest(baseManifest('seed-ok'), dir);
  await writeFile(path.join(dir, 'seed-bad.json'), '{', 'utf8');
  await assert.rejects(
    listManifests(dir),
    /manifiesto ilegible: seed-bad\.json/,
  );
});

test('saveManifest escribe de forma atómica: queda el .json y ningún .tmp', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'brix-seed-'));
  await saveManifest(baseManifest('seed-atomic'), dir);
  assert.deepEqual(await readdir(dir), ['seed-atomic.json']);
});
