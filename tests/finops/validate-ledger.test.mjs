import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateLedger } from '../../packages/cli/finops/engine.mjs';

function fullLedger(overrides = {}) {
  return {
    schemaVersion: '1.6.0',
    frameworkVersion: '1.72.0',
    period: '2026-09',
    currency: 'USD',
    owner: 'Denis Paiva',
    items: [
      {
        id: 'anthropic-x',
        provider: 'anthropic',
        service: 'Claude',
        costPool: 'agents',
        billingModel: 'fixed-subscription',
        plan: 'Max',
        quantity: 1,
        unitPriceUsd: 200,
        budgetUsd: 200,
        forecastUsd: 200,
        actualUsd: 0,
        inputStatus: 'verified',
        reconciliationStatus: 'pending',
        sourceRef: 'SRC-01',
        invoiceEvidence: null,
      },
      {
        id: 'openai-x',
        provider: 'openai',
        service: 'ChatGPT',
        costPool: 'agents',
        billingModel: 'fixed-subscription',
        plan: 'Plus',
        quantity: 1,
        unitPriceUsd: 20,
        budgetUsd: 20,
        forecastUsd: 20,
        actualUsd: 0,
        inputStatus: 'verified',
        reconciliationStatus: 'pending',
        sourceRef: 'SRC-02',
        invoiceEvidence: null,
      },
      {
        id: 'firebase-x',
        provider: 'firebase',
        service: 'Firebase',
        costPool: 'cloud',
        billingModel: 'usage-based',
        plan: 'Blaze',
        quantity: 1,
        unitPriceUsd: 0,
        budgetUsd: 0,
        forecastUsd: 0,
        actualUsd: 0,
        inputStatus: 'verified',
        reconciliationStatus: 'pending',
        sourceRef: 'SRC-03',
        invoiceEvidence: null,
      },
      {
        id: 'cloudflare-plan-x',
        provider: 'cloudflare',
        service: 'Cloudflare plan',
        costPool: 'cloud',
        billingModel: 'fixed-subscription',
        plan: 'Free',
        quantity: 1,
        unitPriceUsd: 0,
        budgetUsd: 0,
        forecastUsd: 0,
        actualUsd: 0,
        inputStatus: 'verified',
        reconciliationStatus: 'pending',
        sourceRef: 'SRC-04',
        invoiceEvidence: null,
      },
      {
        id: 'cloudflare-usage-x',
        provider: 'cloudflare',
        service: 'Cloudflare usage',
        costPool: 'cloud',
        billingModel: 'usage-based',
        plan: 'pay-as-you-go',
        quantity: 1,
        unitPriceUsd: 0,
        budgetUsd: 0,
        forecastUsd: 0,
        actualUsd: 0,
        inputStatus: 'verified',
        reconciliationStatus: 'pending',
        sourceRef: 'SRC-05',
        invoiceEvidence: null,
      },
    ],
    allocations: [
      {
        id: 'a1',
        billingItemId: 'anthropic-x',
        project: 'p',
        environment: 'shared',
        owner: 'o',
        costCenter: 'c',
        version: 'v',
        allocationPercent: 100,
      },
      {
        id: 'a2',
        billingItemId: 'openai-x',
        project: 'p',
        environment: 'shared',
        owner: 'o',
        costCenter: 'c',
        version: 'v',
        allocationPercent: 100,
      },
      {
        id: 'a3',
        billingItemId: 'firebase-x',
        project: 'p',
        environment: 'shared',
        owner: 'o',
        costCenter: 'c',
        version: 'v',
        allocationPercent: 100,
      },
      {
        id: 'a4',
        billingItemId: 'cloudflare-plan-x',
        project: 'p',
        environment: 'shared',
        owner: 'o',
        costCenter: 'c',
        version: 'v',
        allocationPercent: 100,
      },
      {
        id: 'a5',
        billingItemId: 'cloudflare-usage-x',
        project: 'p',
        environment: 'shared',
        owner: 'o',
        costCenter: 'c',
        version: 'v',
        allocationPercent: 100,
      },
    ],
    sources: [
      {
        id: 'SRC-01',
        provider: 'anthropic',
        url: 'https://anthropic.com/pricing',
        checkedAt: '2026-09-01',
        claim: 'Max plan USD 200/mes',
      },
      {
        id: 'SRC-02',
        provider: 'openai',
        url: 'https://openai.com/pricing',
        checkedAt: '2026-09-01',
        claim: 'Plus USD 20/mes',
      },
      {
        id: 'SRC-03',
        provider: 'firebase',
        url: 'https://firebase.google.com/pricing',
        checkedAt: '2026-09-01',
        claim: 'Blaze usage-based',
      },
      {
        id: 'SRC-04',
        provider: 'cloudflare',
        url: 'https://cloudflare.com/plans',
        checkedAt: '2026-09-01',
        claim: 'Free plan',
      },
      {
        id: 'SRC-05',
        provider: 'cloudflare',
        url: 'https://cloudflare.com/plans',
        checkedAt: '2026-09-01',
        claim: 'usage pay-as-you-go',
      },
    ],
    summary: {
      totalBudgetUsd: 220,
      totalForecastUsd: 220,
      totalActualUsd: 0,
      monthlyFixedCommitmentUsd: 220,
      annualizedFixedCommitmentUsd: 2640,
      cloudBillingForecastUsd: 0,
      cloudBillingActualUsd: 0,
      pendingInputCount: 0,
      unreconciledItemCount: 5,
      status: 'attention',
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

test('validateLedger: ledger completo con requireCoreProviders true no reporta errores', () => {
  const { errors } = validateLedger(fullLedger(), {
    requireCoreProviders: true,
  });
  assert.deepEqual(errors, []);
});

test('validateLedger: sin anthropic y requireCoreProviders true, reporta el provider faltante', () => {
  const ledger = fullLedger();
  ledger.items = ledger.items.filter((item) => item.provider !== 'anthropic');
  ledger.allocations = ledger.allocations.filter(
    (a) => a.billingItemId !== 'anthropic-x',
  );
  const { errors } = validateLedger(ledger, { requireCoreProviders: true });
  assert.ok(
    errors.some((e) => e.includes('Falta el provider obligatorio anthropic')),
  );
});

test('validateLedger: sin anthropic y requireCoreProviders false (default), NO reporta el provider faltante', () => {
  const ledger = fullLedger();
  ledger.items = ledger.items.filter((item) => item.provider !== 'anthropic');
  ledger.allocations = ledger.allocations.filter(
    (a) => a.billingItemId !== 'anthropic-x',
  );
  ledger.summary = {
    ...ledger.summary,
    totalBudgetUsd: 20,
    totalForecastUsd: 20,
    monthlyFixedCommitmentUsd: 20,
    annualizedFixedCommitmentUsd: 240,
    unreconciledItemCount: 4,
  };
  const { errors } = validateLedger(ledger, { requireCoreProviders: false });
  assert.ok(!errors.some((e) => e.includes('provider obligatorio')));
});

test('validateLedger: ledger vacío (items: [], allocations: [], sources: []) con requireCoreProviders false es válido', () => {
  const ledger = fullLedger({
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
  });
  const { errors } = validateLedger(ledger, { requireCoreProviders: false });
  assert.deepEqual(errors, []);
});

test('validateLedger: allocations que no suman 100% para un ítem reportan error, con o sin requireCoreProviders', () => {
  const ledger = fullLedger();
  ledger.allocations[0].allocationPercent = 50;
  const { errors } = validateLedger(ledger, { requireCoreProviders: true });
  assert.ok(errors.some((e) => e.includes('deben sumar 100%')));
});

test('validateLedger: summary calculado no coincide con el declarado, reporta el campo específico', () => {
  const ledger = fullLedger();
  ledger.summary.totalBudgetUsd = 999;
  const { errors } = validateLedger(ledger, { requireCoreProviders: true });
  assert.ok(
    errors.some((e) => e.includes('summary.totalBudgetUsd debe ser 220')),
  );
});
