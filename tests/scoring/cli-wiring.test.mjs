import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const execFileAsync = promisify(execFile);

const BIN_PATH = path.join(
  import.meta.dirname,
  '..',
  '..',
  'packages',
  'cli',
  'bin',
  'brix.js',
);

const POLICY = {
  formulaVersion: '1.6.0',
  globalWeights: {
    community: 0,
    maintenance: 0,
    security: 0,
    fit: 1,
    engineering: 0,
    sustainability: 0,
  },
  community: {
    anchors: { starsReference: 1, contributorsReference: 1, forksReference: 1 },
    subfactorWeights: { stars: 1, contributors: 0, forks: 0 },
  },
  maintenance: { subfactorWeights: { activityRecency: 1 } },
  security: { subfactorWeights: { vulnerabilityStatus: 1 } },
  fit: { subfactorWeights: { capabilityGapCoverage: 1 } },
  engineering: { subfactorWeights: { automatedVerification: 1 } },
  sustainability: { subfactorWeights: { costPredictability: 1 } },
  confidenceWeights: {
    evidenceCoverage: 1,
    sourceReliability: 0,
    evidenceFreshness: 0,
    evidenceConsistency: 0,
  },
  confidenceDerivation: {
    freshnessBands: [{ maxDays: 180, score: 100 }],
    consistencyStates: { clean: 100, minor: 70 },
  },
  confidenceBands: { high: 80, medium: 50 },
  recommendationThresholds: { advance: 75, advanceWithReservations: 60 },
  review: { ordinaryDays: 90, earlyReviewDays: 30 },
  risk: { flagLevels: {} },
};

const EVIDENCE = {
  candidate: { id: 'cli-wiring-fixture', type: 'library', evaluatedRef: 'v1' },
  factors: {
    maintenance: [],
    security: [],
    fit: [
      {
        id: 'capabilityGapCoverage',
        availability: 'available',
        score: 90,
        method: 'metric',
      },
    ],
    engineering: [],
    sustainability: [],
  },
  confidenceInputs: { sourceReliability: 90 },
  riskFlags: {},
};

/**
 * `brix tool score` es la única superficie de bin/brix.js que este archivo cubre —
 * idea/graduate/ci ya tienen sus propios tests de comando. Lo que se prueba acá es
 * la CADENA completa (proceso real, no la función importada): bin/brix.js recibe
 * `tool score evaluate/decide`, reenvía el resto del argv al motor mudado
 * (vc/brix/packages/cli/scoring/engine.mjs) sin pasar por `parseFlags`/`positional`
 * (que corta en tres posicionales y descartaría el resto), y ese motor respeta el
 * `brix.config.json` del cwd de invocación — la garantía real de portabilidad que el
 * registro 0003 promete.
 */
async function makeTempProject(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'brix-cli-wiring-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(
    path.join(dir, 'scoring-policy.json'),
    JSON.stringify(POLICY),
    'utf8',
  );
  await writeFile(
    path.join(dir, 'brix.config.json'),
    JSON.stringify({ score: { policyPath: 'scoring-policy.json' } }),
    'utf8',
  );
  await writeFile(
    path.join(dir, 'evidencia.json'),
    JSON.stringify(EVIDENCE),
    'utf8',
  );
  return dir;
}

test('brix tool score evaluate --dry-run: reenvía a evaluate y respeta el brix.config.json del cwd', async (t) => {
  const dir = await makeTempProject(t);
  const { stdout } = await execFileAsync(
    'node',
    [
      BIN_PATH,
      'tool',
      'score',
      'evaluate',
      '--input',
      'evidencia.json',
      '--dry-run',
    ],
    { cwd: dir },
  );
  assert.match(stdout, /cli-wiring-fixture/);
  assert.match(stdout, /dry-run: no se escribió nada/);
});

test('brix tool score evaluate (sin --dry-run) escribe el registro donde brix.config.json lo declara', async (t) => {
  const dir = await makeTempProject(t);
  await execFileAsync(
    'node',
    [BIN_PATH, 'tool', 'score', 'evaluate', '--input', 'evidencia.json'],
    { cwd: dir },
  );
  const { readFile } = await import('node:fs/promises');
  const raw = await readFile(
    path.join(dir, 'evaluations', 'cli-wiring-fixture.evaluation.json'),
    'utf8',
  );
  const record = JSON.parse(raw);
  assert.equal(record.candidate.id, 'cli-wiring-fixture');
  assert.equal(record.status, 'decision_pending');
});

test('brix tool score decide, tras un evaluate previo, deja la decisión registrada', async (t) => {
  const dir = await makeTempProject(t);
  await execFileAsync(
    'node',
    [BIN_PATH, 'tool', 'score', 'evaluate', '--input', 'evidencia.json'],
    { cwd: dir },
  );

  const { stdout } = await execFileAsync(
    'node',
    [
      BIN_PATH,
      'tool',
      'score',
      'decide',
      '--id',
      'cli-wiring-fixture',
      '--status',
      'approved',
      '--by',
      'Test',
    ],
    { cwd: dir },
  );
  assert.match(stdout, /cli-wiring-fixture.*approved/s);

  const { readFile } = await import('node:fs/promises');
  const raw = await readFile(
    path.join(dir, 'evaluations', 'cli-wiring-fixture.evaluation.json'),
    'utf8',
  );
  const record = JSON.parse(raw);
  assert.equal(record.status, 'approved');
  assert.equal(record.humanDecision.decidedBy, 'Test');
});

test('brix tool score evaluate sin brix.config.json (espejo standalone): usa la política embebida del paquete', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'brix-cli-wiring-standalone-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(
    path.join(dir, 'evidencia.json'),
    JSON.stringify(EVIDENCE),
    'utf8',
  );
  // Sin brix.config.json en absoluto: ni policyPath ni outputDir declarados. Debe
  // resolver contra default-scoring-policy.json del paquete y escribir en
  // <dir>/evaluations/, sin tocar nada de vc/tooling/ de este repo.
  const { stdout } = await execFileAsync(
    'node',
    [BIN_PATH, 'tool', 'score', 'evaluate', '--input', 'evidencia.json'],
    { cwd: dir },
  );
  assert.match(stdout, /cli-wiring-fixture/);
  const { readFile } = await import('node:fs/promises');
  const raw = await readFile(
    path.join(dir, 'evaluations', 'cli-wiring-fixture.evaluation.json'),
    'utf8',
  );
  assert.equal(JSON.parse(raw).candidate.id, 'cli-wiring-fixture');
});

test('brix tool score sin subcomando sale con error y código distinto de 0', async (t) => {
  const dir = await makeTempProject(t);
  await assert.rejects(
    execFileAsync('node', [BIN_PATH, 'tool', 'score'], { cwd: dir }),
    /Error/,
  );
});
