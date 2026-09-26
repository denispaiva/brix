// vc/brix/tests/finops/aggregate-portfolio.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregatePortfolio } from '../../packages/cli/finops/engine.mjs';

function summary(overrides) {
  return {
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
    ...overrides,
  };
}

test('aggregatePortfolio: suma los campos numéricos de todos los ledgers', () => {
  const { summary: agg } = aggregatePortfolio([
    { label: 'blends', summary: summary({ totalBudgetUsd: 100 }) },
    { label: 'teyst', summary: summary({ totalBudgetUsd: 50 }) },
  ]);
  assert.equal(agg.totalBudgetUsd, 150);
});

test('aggregatePortfolio: status agregado es pass si todos son pass', () => {
  const { status } = aggregatePortfolio([
    { label: 'blends', summary: summary({ status: 'pass' }) },
    { label: 'teyst', summary: summary({ status: 'pass' }) },
  ]);
  assert.equal(status, 'pass');
});

test('aggregatePortfolio: status agregado es attention si alguno es attention y ninguno blocked', () => {
  const { status } = aggregatePortfolio([
    { label: 'blends', summary: summary({ status: 'pass' }) },
    { label: 'teyst', summary: summary({ status: 'attention' }) },
  ]);
  assert.equal(status, 'attention');
});

test('aggregatePortfolio: status agregado es blocked si alguno es blocked, sin importar el resto', () => {
  const { status } = aggregatePortfolio([
    { label: 'blends', summary: summary({ status: 'attention' }) },
    { label: 'teyst', summary: summary({ status: 'blocked' }) },
  ]);
  assert.equal(status, 'blocked');
});

test('aggregatePortfolio: sin ledgers, status pass y todo en cero', () => {
  const { summary: agg, status } = aggregatePortfolio([]);
  assert.equal(status, 'pass');
  assert.equal(agg.totalBudgetUsd, 0);
});

test('aggregatePortfolio: alerts junta el label de cada entry con cloudAlert', () => {
  const { summary: agg } = aggregatePortfolio([
    {
      label: 'vc/finops/billing-ledger.json',
      summary: summary({ cloudAlert: true }),
    },
    {
      label: 'vc/teyst/finops/billing-ledger.json',
      summary: summary({ cloudAlert: false }),
    },
  ]);
  assert.deepEqual(agg.alerts, ['vc/finops/billing-ledger.json']);
});

test('aggregatePortfolio: alerts vacío si ningún ledger dispara cloudAlert', () => {
  const { summary: agg } = aggregatePortfolio([
    { label: 'blends', summary: summary({ cloudAlert: false }) },
    { label: 'teyst', summary: summary({ cloudAlert: false }) },
  ]);
  assert.deepEqual(agg.alerts, []);
});
