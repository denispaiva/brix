// vc/brix/tests/seeding/clean.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  runScenario,
  cleanRun,
  listRuns,
} from '../../packages/cli/seeding/engine.mjs';
import { createDriver } from '../../packages/cli/seeding/lib/fake-driver.mjs';
import { fullScenario } from './helpers/scenarios.mjs';

const emuEnv = {
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
};

test('clean borra en orden inverso solo lo del manifiesto y lo anota; list lo refleja', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'brix-seed-'));
  const driver = createDriver({ target: 'emulator' });
  await runScenario({
    scenario: fullScenario(),
    scenarioHash: 'h',
    driver,
    target: 'emulator',
    seed: 1,
    manifestDir: dir,
    env: emuEnv,
    runId: 'seed-clean',
  });
  assert.equal(driver._db.events.size, 1);
  assert.equal(driver._db.users.size, 5);
  const m = await cleanRun({ runId: 'seed-clean', driver, manifestDir: dir });
  assert.equal(driver._db.events.size, 0);
  assert.equal(driver._db.users.size, 0);
  assert.equal(m.cleanup.failed.length, 0);
  assert.equal(
    m.cleanup.deleted[0],
    m.roots.at(-1).ref,
    'la primera borrada es la última creada',
  );
  const list = await listRuns(dir);
  assert.deepEqual(
    list.map((r) => [r.run_id, r.cleaned]),
    [['seed-clean', true]],
  );
});

test('clean con otro driver se niega', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'brix-seed-'));
  await runScenario({
    scenario: fullScenario(),
    scenarioHash: 'h',
    driver: createDriver({ target: 'emulator' }),
    target: 'emulator',
    seed: 1,
    manifestDir: dir,
    env: emuEnv,
    runId: 'seed-d',
  });
  const other = { ...createDriver({ target: 'emulator' }), name: 'otro' };
  await assert.rejects(
    cleanRun({ runId: 'seed-d', driver: other, manifestDir: dir }),
    /es del driver fake, no otro/,
  );
});

test('clean con otro target se niega y no sella la corrida como limpia', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'brix-seed-'));
  const driver = createDriver({ target: 'emulator' });
  await runScenario({
    scenario: fullScenario(),
    scenarioHash: 'h',
    driver,
    target: 'emulator',
    seed: 1,
    manifestDir: dir,
    env: emuEnv,
    runId: 'seed-t',
  });
  await assert.rejects(
    cleanRun({ runId: 'seed-t', driver, target: 'dev-x', manifestDir: dir }),
    /es del target emulator, no dev-x/,
  );
  assert.equal(driver._db.users.size, 5, 'no borró nada');
  const onDisk = JSON.parse(
    await readFile(path.join(dir, 'seed-t.json'), 'utf8'),
  );
  assert.equal(onDisk.cleaned_at, null);
});
