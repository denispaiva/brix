// vc/brix/tests/finops/cli-wiring.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const WRAPPER_PATH = path.join(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'tools',
  'validate-billing-ledger.mjs',
);

// Nota: el envoltorio resuelve repoRoot desde su PROPIA ubicación (import.meta.dirname),
// no desde cwd — así que estas pruebas validan un archivo puntual pasado como argumento,
// contra el repo real, no un árbol temporal completo. El caso "portfolio sin argumento"
// se prueba en Task 6 sobre el repo real ya migrado.

test('validate-billing-ledger.mjs con un archivo puntual: ledger válido sale 0', async () => {
  const dir = await mkdtempDir();
  const ledgerPath = path.join(dir, 'billing-ledger.json');
  await writeFile(ledgerPath, JSON.stringify(minimalValidLedger()), 'utf8');
  const { stdout } = await execFileAsync('node', [WRAPPER_PATH, ledgerPath]);
  assert.match(stdout, /Billing ledger válido/);
});

test('validate-billing-ledger.mjs con un archivo puntual: ledger inválido sale con error listado', async () => {
  const dir = await mkdtempDir();
  const ledgerPath = path.join(dir, 'billing-ledger.json');
  const ledger = minimalValidLedger();
  ledger.currency = 'ARS';
  await writeFile(ledgerPath, JSON.stringify(ledger), 'utf8');
  await assert.rejects(
    execFileAsync('node', [WRAPPER_PATH, ledgerPath]),
    /currency debe ser USD/,
  );
});

function minimalValidLedger() {
  return {
    schemaVersion: '1.5.0',
    frameworkVersion: '1.73.0',
    period: '2026-09',
    currency: 'USD',
    owner: 'Test',
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
  };
}

async function mkdtempDir() {
  const dir = await mkdtemp(
    path.join(tmpdir(), 'validate-billing-ledger-cli-'),
  );
  return dir;
}
