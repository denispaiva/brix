import { readdir, access, readFile } from 'node:fs/promises';
import path from 'node:path';

function nearlyEqual(first, second, tolerance = 0.01) {
  return Math.abs(Number(first) - Number(second)) <= tolerance;
}

function sum(items, field) {
  return items.reduce((total, item) => total + Number(item[field] ?? 0), 0);
}

const SUPPORTED_PROVIDERS = new Set([
  'firebase', 'cloudflare', 'anthropic', 'openai', 'moonshot', 'namecheap',
  'google-workspace', 'google-one', 'google-play', 'apple', 'github', 'expo',
  'google-gemini',
]);

/**
 * Motor del Scoring... no, del ledger FinOps — validación estructural pura, sin I/O.
 * Mudado desde vc/tools/validate-billing-ledger.mjs por decisión del PO (registro 0004,
 * vc/brix/docs/decisions/). requireCoreProviders gatea SOLO el bloque de providers
 * obligatorios (firebase/cloudflare/anthropic/openai): true para el ledger compartido de
 * blends, false (default) para el ledger de un proyecto, que no tiene mínimo de providers.
 */
export function validateLedger(ledger, options = {}) {
  const requireCoreProviders = options.requireCoreProviders ?? false;
  const errors = [];
  const report = (message) => errors.push(message);

  if (ledger.schemaVersion !== '1.5.0')
    report('El billing ledger debe usar schemaVersion 1.5.0.');
  if (
    ledger.workbookUrl !== undefined &&
    !/^https:\/\/docs\.google\.com\/spreadsheets\//.test(ledger.workbookUrl)
  ) {
    report('workbookUrl debe apuntar a una hoja de Google Sheets (https://docs.google.com/spreadsheets/...).');
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ledger.period ?? ''))
    report('period debe usar YYYY-MM.');
  if (ledger.currency !== 'USD') report('currency debe ser USD.');
  if (!ledger.owner) report('owner es obligatorio.');

  const items = Array.isArray(ledger.items) ? ledger.items : [];
  const allocations = Array.isArray(ledger.allocations) ? ledger.allocations : [];
  const sources = Array.isArray(ledger.sources) ? ledger.sources : [];
  const itemMap = new Map();
  const sourceMap = new Map();

  for (const source of sources) {
    if (!source.id || sourceMap.has(source.id))
      report(`Source ID ausente o duplicado: ${source.id}.`);
    sourceMap.set(source.id, source);
    if (!/^https:\/\//.test(source.url ?? ''))
      report(`${source.id}: la fuente debe usar HTTPS.`);
    if (Number.isNaN(Date.parse(source.checkedAt)) || !source.claim)
      report(`${source.id}: checkedAt y claim son obligatorios.`);
  }

  for (const item of items) {
    if (!item.id || itemMap.has(item.id))
      report(`Billing ID ausente o duplicado: ${item.id}.`);
    itemMap.set(item.id, item);
    if (!SUPPORTED_PROVIDERS.has(item.provider))
      report(`${item.id}: provider no soportado.`);
    if (!new Set(['fixed-subscription', 'usage-based', 'one-time']).has(item.billingModel))
      report(`${item.id}: billingModel inválido.`);
    if (!new Set(['agents', 'cloud', 'tooling', 'external']).has(item.costPool))
      report(`${item.id}: costPool inválido.`);
    for (const field of ['quantity', 'unitPriceUsd', 'budgetUsd', 'forecastUsd', 'actualUsd']) {
      if (!(Number(item[field]) >= 0)) report(`${item.id}.${field} debe ser no negativo.`);
    }
    if (!(Number(item.quantity) > 0)) report(`${item.id}.quantity debe ser positivo.`);
    if (!new Set(['pending', 'verified']).has(item.inputStatus))
      report(`${item.id}: inputStatus inválido.`);
    if (!new Set(['pending', 'reconciled', 'disputed']).has(item.reconciliationStatus))
      report(`${item.id}: reconciliationStatus inválido.`);
    const source = sourceMap.get(item.sourceRef);
    if (!source) report(`${item.id}: sourceRef ${item.sourceRef} no existe.`);
    if (source && source.provider !== item.provider)
      report(`${item.id}: sourceRef pertenece a otro provider.`);
    if (item.billingModel === 'fixed-subscription' && item.inputStatus === 'verified') {
      const expectedForecast = Number(item.quantity) * Number(item.unitPriceUsd);
      if (!nearlyEqual(item.forecastUsd, expectedForecast))
        report(`${item.id}: forecastUsd debe reconciliar quantity × unitPriceUsd (${expectedForecast}).`);
    }
    if (Number(item.actualUsd) > 0 && (item.reconciliationStatus !== 'reconciled' || !item.invoiceEvidence)) {
      report(`${item.id}: un actual positivo requiere reconciliationStatus reconciled e invoiceEvidence.`);
    }
    if (item.reconciliationStatus === 'reconciled' && !item.invoiceEvidence)
      report(`${item.id}: reconciled requiere invoiceEvidence.`);
  }

  if (requireCoreProviders) {
    for (const provider of ['firebase', 'cloudflare', 'anthropic', 'openai']) {
      if (!items.some((item) => item.provider === provider))
        report(`Falta el provider obligatorio ${provider}.`);
    }
    if (!items.some((item) => item.provider === 'firebase' && item.billingModel === 'usage-based'))
      report('Firebase debe registrarse como usage-based.');
    if (!items.some((item) => item.provider === 'cloudflare' && item.billingModel === 'fixed-subscription'))
      report('Cloudflare requiere una línea separada para plan y add-ons.');
    if (!items.some((item) => item.provider === 'cloudflare' && item.billingModel === 'usage-based'))
      report('Cloudflare requiere una línea separada para usage y overages.');
    for (const provider of ['anthropic', 'openai']) {
      if (!items.some((item) => item.provider === provider && item.billingModel === 'fixed-subscription'))
        report(`${provider} debe registrarse como fixed-subscription.`);
    }
  }

  const allocationIds = new Set();
  const allocationByItem = new Map();
  for (const allocation of allocations) {
    if (!allocation.id || allocationIds.has(allocation.id))
      report(`Allocation ID ausente o duplicado: ${allocation.id}.`);
    allocationIds.add(allocation.id);
    if (!itemMap.has(allocation.billingItemId))
      report(`${allocation.id}: billingItemId ${allocation.billingItemId} no existe.`);
    if (!(Number(allocation.allocationPercent) > 0 && Number(allocation.allocationPercent) <= 100))
      report(`${allocation.id}: allocationPercent debe estar entre 0 y 100.`);
    for (const field of ['project', 'environment', 'owner', 'costCenter', 'version']) {
      if (!allocation[field]) report(`${allocation.id}.${field} es obligatorio.`);
    }
    allocationByItem.set(
      allocation.billingItemId,
      (allocationByItem.get(allocation.billingItemId) ?? 0) + Number(allocation.allocationPercent ?? 0),
    );
  }
  for (const item of items) {
    if (!nearlyEqual(allocationByItem.get(item.id), 100))
      report(`${item.id}: las allocations deben sumar 100%.`);
  }

  const totalBudgetUsd = sum(items, 'budgetUsd');
  const totalForecastUsd = sum(items, 'forecastUsd');
  const totalActualUsd = sum(items, 'actualUsd');
  const monthlyFixedCommitmentUsd = items
    .filter((item) => item.billingModel === 'fixed-subscription')
    .reduce((total, item) => total + Number(item.forecastUsd ?? 0), 0);
  const annualizedFixedCommitmentUsd = monthlyFixedCommitmentUsd * 12;
  const cloudProviders = new Set(['firebase', 'cloudflare']);
  const cloudItems = items.filter((item) => cloudProviders.has(item.provider));
  const cloudBillingForecastUsd = sum(cloudItems, 'forecastUsd');
  const cloudBillingActualUsd = sum(cloudItems, 'actualUsd');
  const cloudBillingAlertUsd = Number(ledger.controls?.cloudBillingAlertUsd);
  const cloudAlert = cloudBillingActualUsd > cloudBillingAlertUsd || cloudBillingForecastUsd > cloudBillingAlertUsd;
  const pendingInputCount = items.filter((item) => item.inputStatus === 'pending').length;
  const unreconciledItemCount = items.filter((item) => item.reconciliationStatus !== 'reconciled').length;
  const overBudget = items.some((item) => Number(item.actualUsd) > Number(item.budgetUsd));
  const expectedStatus = overBudget
    ? 'blocked'
    : cloudAlert || pendingInputCount > 0 || unreconciledItemCount > 0
      ? 'attention'
      : 'pass';
  const expectedSummary = {
    totalBudgetUsd, totalForecastUsd, totalActualUsd, monthlyFixedCommitmentUsd,
    annualizedFixedCommitmentUsd, cloudBillingForecastUsd, cloudBillingActualUsd,
    pendingInputCount, unreconciledItemCount,
  };
  for (const [field, expected] of Object.entries(expectedSummary)) {
    if (!nearlyEqual(ledger.summary?.[field], expected))
      report(`summary.${field} debe ser ${expected}.`);
  }
  if (ledger.summary?.status !== expectedStatus)
    report(`summary.status debe ser ${expectedStatus}.`);

  for (const field of ['separateFixedAndUsage', 'actualsRequireInvoiceEvidence', 'allocationRequired', 'humanApprovalForCommitments']) {
    if (ledger.controls?.[field] !== true) report(`controls.${field} debe estar habilitado.`);
  }
  if (ledger.controls?.providerReviewCadence !== 'monthly')
    report('controls.providerReviewCadence debe ser monthly.');
  if (!(cloudBillingAlertUsd > 0))
    report('controls.cloudBillingAlertUsd debe ser un umbral positivo en USD.');
  if (!(Number(ledger.controls?.budgetGuardrailUsd) > 0))
    report('controls.budgetGuardrailUsd debe declarar el budget guardrail por cuenta de billing en USD.');

  return {
    errors,
    summary: { ...expectedSummary, status: expectedStatus, cloudAlert, cloudBillingAlertUsd },
  };
}

const STATUS_RANK = { pass: 0, attention: 1, blocked: 2 };
const NUMERIC_SUMMARY_FIELDS = [
  'totalBudgetUsd', 'totalForecastUsd', 'totalActualUsd',
  'monthlyFixedCommitmentUsd', 'annualizedFixedCommitmentUsd',
  'cloudBillingForecastUsd', 'cloudBillingActualUsd',
  'pendingInputCount', 'unreconciledItemCount',
];

/**
 * Suma los summary de todos los ledgers descubiertos y toma el status más severo.
 * Pura: no vuelve a mirar items ni allocations — cada ledger ya validó su propia
 * consistencia interna en validateLedger.
 */
export function aggregatePortfolio(entries) {
  const summary = {};
  for (const field of NUMERIC_SUMMARY_FIELDS) {
    summary[field] = entries.reduce((total, entry) => total + Number(entry.summary[field] ?? 0), 0);
  }
  let status = 'pass';
  for (const entry of entries) {
    if (STATUS_RANK[entry.summary.status] > STATUS_RANK[status]) status = entry.summary.status;
  }
  return { summary, status };
}

const NON_PROJECT_DIRS = new Set(['docs', 'finops', 'tooling', 'tools', 'framework']);

async function pathExists(candidate) {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}

/**
 * Descubre el ledger compartido de blends y el de cada proyecto bajo vc/*.
 * Un proyecto es un directorio con `.roadmap.json` propio. vc/framework SÍ tiene
 * .roadmap.json pero se excluye siempre — su costo ya es el ledger compartido
 * (ver registro 0004). vc/docs, vc/finops, vc/tooling, vc/tools no tienen
 * .roadmap.json, así que ya quedan afuera por ese criterio.
 */
export async function discoverLedgers(cwd) {
  const vcDir = path.join(cwd, 'vc');
  const shared = path.join(vcDir, 'finops', 'billing-ledger.json');
  const sharedExists = await pathExists(shared);

  const entries = await readdir(vcDir, { withFileTypes: true });
  const projects = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (NON_PROJECT_DIRS.has(entry.name)) continue;
    const roadmapPath = path.join(vcDir, entry.name, '.roadmap.json');
    if (!(await pathExists(roadmapPath))) continue;
    const ledgerPath = path.join(vcDir, entry.name, 'finops', 'billing-ledger.json');
    projects.push({
      project: entry.name,
      path: (await pathExists(ledgerPath)) ? ledgerPath : null,
    });
  }

  return { shared: sharedExists ? shared : null, projects };
}

/**
 * Orquesta discoverLedgers + validateLedger + aggregatePortfolio sobre el repo real.
 * El ledger compartido (vc/finops/) valida con requireCoreProviders: true; cualquier
 * ledger de proyecto, con false. Un proyecto sin finops/billing-ledger.json es un
 * error de validación, no se saltea.
 */
export async function runPortfolioValidation(cwd) {
  const { shared, projects } = await discoverLedgers(cwd);
  const errors = [];
  const validated = [];

  if (!shared) {
    errors.push('vc/finops/billing-ledger.json: no existe — el ledger compartido es obligatorio.');
  } else {
    const label = path.relative(cwd, shared);
    const ledger = JSON.parse(await readFile(shared, 'utf8'));
    const { errors: ledgerErrors, summary } = validateLedger(ledger, { requireCoreProviders: true });
    for (const error of ledgerErrors) errors.push(`${label}: ${error}`);
    validated.push({ label, summary });
  }

  for (const { project, path: ledgerPath } of projects) {
    if (!ledgerPath) {
      errors.push(`vc/${project}/finops/billing-ledger.json: falta — todo proyecto necesita su carpeta finops/.`);
      continue;
    }
    const label = path.relative(cwd, ledgerPath);
    const ledger = JSON.parse(await readFile(ledgerPath, 'utf8'));
    const { errors: ledgerErrors, summary } = validateLedger(ledger, { requireCoreProviders: false });
    for (const error of ledgerErrors) errors.push(`${label}: ${error}`);
    validated.push({ label, summary });
  }

  const { summary, status } = aggregatePortfolio(validated);
  return { errors, summary, status };
}
