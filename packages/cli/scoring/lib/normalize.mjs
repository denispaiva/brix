/**
 * Normalización logarítmica 0-100 contra un ancla de referencia.
 * `value: null` significa "sin evidencia disponible" y se propaga como null,
 * nunca como 0 — la ausencia de dato no es una calificación negativa.
 */
export function logNormalize(value, reference) {
  if (value == null) return null;
  if (value < 0) throw new RangeError(`value no puede ser negativo: ${value}`);
  if (!(reference > 0))
    throw new RangeError(`reference debe ser positivo: ${reference}`);
  return Math.min(100, (100 * Math.log(1 + value)) / Math.log(1 + reference));
}

/**
 * Promedio ponderado solo sobre las entradas disponibles (score != null).
 * Si ninguna está disponible, devuelve null — nunca inventa un cero.
 */
export function weightedAvailable(entries) {
  const available = entries.filter((entry) => entry.score != null);
  if (available.length === 0) return null;
  const weightSum = available.reduce((total, entry) => total + entry.weight, 0);
  const scoreSum = available.reduce(
    (total, entry) => total + entry.score * entry.weight,
    0,
  );
  return scoreSum / weightSum;
}

/**
 * Porcentaje del peso total que efectivamente tiene evidencia disponible.
 */
export function coveragePercent(entries) {
  const totalWeight = entries.reduce((total, entry) => total + entry.weight, 0);
  const availableWeight = entries
    .filter((entry) => entry.score != null)
    .reduce((total, entry) => total + entry.weight, 0);
  return (availableWeight / totalWeight) * 100;
}
