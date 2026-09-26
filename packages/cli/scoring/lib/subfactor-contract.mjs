/**
 * Espejo manual de vc/docs/standards/subfactor-evidence.schema.json (draft-07).
 * Cualquier cambio al schema debe reflejarse acá y viceversa — el test de paridad
 * de subfactor-evidence.schema.test.mjs rompe si divergen.
 */
export function validateSubfactorRecord(record, factorId) {
  const errors = [];
  const label = `${factorId}.${record?.id ?? '?'}`;
  if (typeof record?.id !== 'string' || record.id.length === 0)
    errors.push(`${label}: falta id`);
  if (!['available', 'unavailable'].includes(record?.availability))
    errors.push(`${label}: availability inválida (${record?.availability})`);
  if (record?.availability === 'available') {
    if (
      typeof record.score !== 'number' ||
      record.score < 0 ||
      record.score > 100
    ) {
      errors.push(
        `${label}: score debe ser un número entre 0 y 100 (recibido: ${record.score})`,
      );
    }
    if (!['metric', 'rubric'].includes(record.method))
      errors.push(`${label}: method debe ser metric o rubric`);
  }
  if (record?.method === 'rubric') {
    if (typeof record.rationale !== 'string' || record.rationale.length === 0)
      errors.push(`${label}: rubric exige rationale`);
    if (!Array.isArray(record.evidenceRefs) || record.evidenceRefs.length === 0)
      errors.push(
        `${label}: rubric exige evidenceRefs con al menos una referencia`,
      );
    if (record.assessor == null || typeof record.assessor !== 'object')
      errors.push(`${label}: rubric exige assessor`);
  }
  return { valid: errors.length === 0, errors };
}
