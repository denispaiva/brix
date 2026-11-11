/**
 * Espejo manual de ../subfactor-evidence.schema.json (draft-07), sin dependencias.
 * Cualquier cambio al schema debe reflejarse acá y viceversa: el test de paridad
 * tests/scoring/subfactor-schema-parity.test.mjs evalúa el schema y este espejo
 * sobre la misma matriz de registros y rompe si alguno acepta lo que el otro
 * rechaza.
 */
const AVAILABILITY = ['available', 'unavailable'];
const METHODS = ['metric', 'rubric'];
const ASSESSOR_TYPES = ['model', 'human'];

const isNonEmptyString = (value) =>
  typeof value === 'string' && value.length > 0;
const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export function validateSubfactorRecord(record, factorId) {
  const errors = [];
  const label = `${factorId}.${record?.id ?? '?'}`;
  if (!isPlainObject(record)) {
    errors.push(`${label}: el registro debe ser un objeto`);
    return { valid: false, errors };
  }

  // Cada propiedad presente se valida siempre, no solo dentro de los
  // condicionales de availability y method.
  if (!isNonEmptyString(record.id)) errors.push(`${label}: falta id`);
  if (!AVAILABILITY.includes(record.availability))
    errors.push(`${label}: availability inválida (${record.availability})`);
  if ('score' in record && record.score !== null) {
    if (
      typeof record.score !== 'number' ||
      record.score < 0 ||
      record.score > 100
    ) {
      errors.push(
        `${label}: score debe ser un número entre 0 y 100 (recibido: ${record.score})`,
      );
    }
  }
  if ('method' in record && !METHODS.includes(record.method))
    errors.push(`${label}: method debe ser metric o rubric`);
  if ('rationale' in record && !isNonEmptyString(record.rationale))
    errors.push(`${label}: rationale debe ser un texto no vacío`);
  if ('evidenceRefs' in record) {
    const refs = record.evidenceRefs;
    if (
      !Array.isArray(refs) ||
      refs.length === 0 ||
      !refs.every((ref) => typeof ref === 'string')
    )
      errors.push(
        `${label}: evidenceRefs debe ser una lista de textos con al menos una referencia`,
      );
  }
  if ('assessor' in record) {
    const assessor = record.assessor;
    if (
      !isPlainObject(assessor) ||
      ('type' in assessor && !ASSESSOR_TYPES.includes(assessor.type)) ||
      ('version' in assessor && typeof assessor.version !== 'string') ||
      ('promptVersion' in assessor && typeof assessor.promptVersion !== 'string')
    )
      errors.push(
        `${label}: assessor debe ser un objeto con type model o human y version/promptVersion de texto`,
      );
  }

  // Condicionales del schema (allOf/if/then).
  if (record.availability === 'available') {
    if (typeof record.score !== 'number')
      errors.push(`${label}: available exige score numérico`);
    if (!('method' in record)) errors.push(`${label}: available exige method`);
  }
  if (record.method === 'rubric') {
    if (!('rationale' in record)) errors.push(`${label}: rubric exige rationale`);
    if (!('evidenceRefs' in record))
      errors.push(
        `${label}: rubric exige evidenceRefs con al menos una referencia`,
      );
    if (!('assessor' in record)) errors.push(`${label}: rubric exige assessor`);
  }
  return { valid: errors.length === 0, errors };
}
