// vc/brix/tests/seeding/cli-wiring.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fullScenario } from './helpers/scenarios.mjs';

const execFileAsync = promisify(execFile);
const BRIX = path.join(
  import.meta.dirname,
  '..',
  '..',
  'packages',
  'cli',
  'bin',
  'brix.js',
);
const FAKE = path.join(
  import.meta.dirname,
  '..',
  '..',
  'packages',
  'cli',
  'seeding',
  'lib',
  'fake-driver.mjs',
);
const emuEnv = {
  ...process.env,
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
};

async function scenarioFile() {
  const dir = await mkdtemp(path.join(tmpdir(), 'brix-seed-cli-'));
  const file = path.join(dir, 'full.json');
  await writeFile(file, JSON.stringify(fullScenario()), 'utf8');
  return { dir, file };
}

test('el help lista los cuatro subcomandos de seed', async () => {
  const { stdout } = await execFileAsync('node', [BRIX]);
  for (const line of [
    'brix seed run',
    'brix seed validate',
    'brix seed clean',
    'brix seed list',
  ])
    assert.match(stdout, new RegExp(line));
});

test('seed validate con driver sale 0 y sin driver también (valida solo el esquema)', async () => {
  const { file } = await scenarioFile();
  const a = await execFileAsync('node', [
    BRIX,
    'seed',
    'validate',
    file,
    '--driver',
    FAKE,
    '--target',
    'emulator',
  ]);
  assert.match(a.stdout, /escenario válido/);
  const b = await execFileAsync('node', [BRIX, 'seed', 'validate', file]);
  assert.match(b.stdout, /escenario válido \(sin driver: solo esquema\)/);
});

test('seed run --dry-run no acuña nada y muestra el plan', async () => {
  const { file } = await scenarioFile();
  const { stdout } = await execFileAsync(
    'node',
    [
      BRIX,
      'seed',
      'run',
      file,
      '--target',
      'emulator',
      '--driver',
      FAKE,
      '--dry-run',
    ],
    { env: emuEnv },
  );
  assert.match(stdout, /modo autonomous/);
  assert.match(stdout, /5 actores/);
});

test('seed run contra el falso completa, list lo muestra y clean lo borra', async () => {
  const { dir, file } = await scenarioFile();
  const env = { ...emuEnv, BRIX_SEED_DIR: dir };
  const run = await execFileAsync(
    'node',
    [
      BRIX,
      'seed',
      'run',
      file,
      '--target',
      'emulator',
      '--driver',
      FAKE,
      '--seed',
      '9',
    ],
    { env },
  );
  const runId = run.stdout.match(/run_id (seed-[\w-]+)/)[1];
  assert.match(run.stdout, /completed/);
  const list = await execFileAsync('node', [BRIX, 'seed', 'list'], { env });
  assert.match(list.stdout, new RegExp(runId));
  const clean = await execFileAsync(
    'node',
    [
      BRIX,
      'seed',
      'clean',
      '--run',
      runId,
      '--driver',
      FAKE,
      '--target',
      'emulator',
    ],
    { env },
  );
  assert.match(clean.stdout, /borradas \d+ raíces, 0 fallidas/);
});

test('seed run contra un target no declarado sale 1 con el motivo', async () => {
  const { file } = await scenarioFile();
  await assert.rejects(
    execFileAsync('node', [
      BRIX,
      'seed',
      'run',
      file,
      '--target',
      'prod-x',
      '--driver',
      FAKE,
    ]),
    /ningún target puede contener "prod"/,
  );
});

test('seed clean contra un target prod sale 1 con el motivo', async () => {
  await assert.rejects(
    execFileAsync('node', [
      BRIX,
      'seed',
      'clean',
      '--run',
      'seed-x',
      '--driver',
      FAKE,
      '--target',
      'prod-x',
    ]),
    (err) => {
      assert.equal(err.code, 1);
      assert.match(err.stderr, /ningún target puede contener "prod"/);
      return true;
    },
  );
});
