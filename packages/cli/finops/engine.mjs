
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
