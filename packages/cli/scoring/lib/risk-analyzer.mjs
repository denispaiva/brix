const LEVEL_ORDER = ['low', 'medium', 'high', 'critical'];

/**
 * Clasifica el riesgo por el MAYOR impacto aplicable entre las señales marcadas true —
 * nunca por promedio, nunca por conteo. Sin ninguna señal elevada, el resultado es "low":
 * a diferencia de un subfactor de evidencia, la ausencia de capacidades declaradas es un
 * hecho real (no una ausencia de dato), y "low" es exactamente esa definición en el diseño.
 *
 * Una clave en `flags` que no existe en `policy.risk.flagLevels` lanza — un typo en el
 * nombre de una señal de riesgo real (p. ej. "netwrokAccess" en vez de "networkAccess")
 * no debe perderse en silencio y devolver un falso "low" tranquilizador. Decisión humana
 * registrada el 2026-08-08 tras la revisión final de esta etapa.
 */
export function classifyRisk(flags, policy) {
  const flagLevels = policy.risk.flagLevels;

  const unknownFlags = Object.keys(flags).filter(
    (name) => !(name in flagLevels),
  );
  if (unknownFlags.length > 0) {
    throw new Error(
      `classifyRisk: señal(es) de riesgo desconocida(s): ${unknownFlags.join(', ')}`,
    );
  }

  let maxLevel = 'low';
  for (const flagName of Object.keys(flagLevels)) {
    if (!flags[flagName]) continue;
    const level = flagLevels[flagName];
    if (LEVEL_ORDER.indexOf(level) > LEVEL_ORDER.indexOf(maxLevel))
      maxLevel = level;
  }
  return maxLevel;
}
