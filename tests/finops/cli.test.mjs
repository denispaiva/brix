import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runFinopsCli } from '../../packages/cli/finops/engine.mjs';

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

// Ledger de proyecto sin costo propio: válido con requireCoreProviders false.
function emptyLedger(overrides = {}) {
  return {
    schemaVersion: '1.6.0',
    frameworkVersion: '1.104.0',
    period: '2026-11',
    currency: 'USD',
    owner: 'Equipo',
    items: [],
    allocations: [],
    sources: [],
    summary: {
      totalBudgetUsd: 0,
      totalForecastUsd: 0,
      totalActualUsd: 0,
      monthlyFixedCommitmentUsd: 0,
      annualizedFixedCommitmentUsd: 0,
      cloudBillingForecastUsd: 0,
      cloudBillingActualUsd: 0,
      pendingInputCount: 0,
      unreconciledItemCount: 0,
      status: 'pass',
    },
    controls: {
      separateFixedAndUsage: true,
      actualsRequireInvoiceEvidence: true,
      allocationRequired: true,
      providerReviewCadence: 'monthly',
      humanApprovalForCommitments: true,
      cloudBillingAlertUsd: 10,
      budgetGuardrailUsd: 1,
    },
    ...overrides,
  };
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value), 'utf8');
}

// Portfolio en port/: el ledger compartido y un proyecto con su ledger.
async function makeRepo(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'finops-cli-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeJson(path.join(root, 'port', 'proyecto', '.roadmap.json'), {});
  await writeJson(
    path.join(root, 'port', 'proyecto', 'finops', 'billing-ledger.json'),
    emptyLedger(),
  );
  return root;
}

function capture() {
  const out = [];
  const err = [];
  return {
    out,
    err,
    io: { stdout: (line) => out.push(line), stderr: (line) => err.push(line) },
  };
}

test('sin subcomando validate devuelve 2 y muestra el uso', async () => {
  const { err, io } = capture();
  assert.equal(await runFinopsCli([], io), 2);
  assert.match(err.join('\n'), /brix finops validate/);
});

test('un ledger de proyecto válido devuelve 0', async (t) => {
  const root = await makeRepo(t);
  const { out, io } = capture();
  const code = await runFinopsCli(
    ['validate', 'port/proyecto/finops/billing-ledger.json'],
    { cwd: root, ...io },
  );
  assert.equal(code, 0);
  assert.match(out.join('\n'), /Billing ledger válido/);
});

test('--shared exige los providers obligatorios: el mismo ledger vacío falla', async (t) => {
  const root = await makeRepo(t);
  const { err, io } = capture();
  const code = await runFinopsCli(
    ['validate', 'port/proyecto/finops/billing-ledger.json', '--shared'],
    { cwd: root, ...io },
  );
  assert.equal(code, 1);
  assert.match(err.join('\n'), /Billing ledger inválido/);
});

test('un ledger que no se puede leer devuelve 2', async (t) => {
  const root = await makeRepo(t);
  const { err, io } = capture();
  const code = await runFinopsCli(['validate', 'no-existe.json'], {
    cwd: root,
    ...io,
  });
  assert.equal(code, 2);
  assert.match(err.join('\n'), /No se pudo leer no-existe\.json/);
});

test('el portfolio sin ledger compartido es inválido y lo nombra', async (t) => {
  const root = await makeRepo(t);
  const { err, io } = capture();
  const code = await runFinopsCli(['validate', '--portfolio', 'port'], {
    cwd: root,
    ...io,
  });
  assert.equal(code, 1);
  assert.match(err.join('\n'), /port\/finops\/billing-ledger\.json: no existe/);
});

test('sin --portfolio toma finops.portfolioDir y excludeDirs de la config', async (t) => {
  const root = await makeRepo(t);
  // Un proyecto sin ledger rompería la validación si no se excluyera.
  await writeJson(path.join(root, 'port', 'sin-ledger', '.roadmap.json'), {});
  const { err, io } = capture();
  const code = await runFinopsCli(['validate'], {
    cwd: root,
    config: { finops: { portfolioDir: 'port', excludeDirs: ['sin-ledger'] } },
    ...io,
  });
  assert.equal(code, 1);
  const message = err.join('\n');
  assert.match(message, /port\/finops\/billing-ledger\.json: no existe/);
  assert.doesNotMatch(message, /sin-ledger/);
});

test('sin --portfolio ni config devuelve 2 y dice qué falta', async (t) => {
  const root = await makeRepo(t);
  const { err, io } = capture();
  assert.equal(await runFinopsCli(['validate'], { cwd: root, ...io }), 2);
  assert.match(err.join('\n'), /Falta la carpeta del portfolio/);
});

test('el binario expone brix finops validate', async (t) => {
  const root = await makeRepo(t);
  const { stdout } = await execFileAsync(
    process.execPath,
    [BIN_PATH, 'finops', 'validate', 'port/proyecto/finops/billing-ledger.json'],
    { cwd: root },
  );
  assert.match(stdout, /Billing ledger válido/);
  await assert.rejects(
    execFileAsync(process.execPath, [BIN_PATH, 'finops', 'validate'], {
      cwd: root,
    }),
    (error) => error.code === 2,
  );
});
