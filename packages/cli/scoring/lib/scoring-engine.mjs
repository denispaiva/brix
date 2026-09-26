import {
  logNormalize,
  weightedAvailable,
  coveragePercent,
} from './normalize.mjs';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Factor de respaldo comunitario público: estrellas 40%, contribuidores 40%, forks 20%,
 * normalizados con la curva logarítmica contra las anclas de la política vigente.
 */
export function computeCommunityScore(counts, policy) {
  const { anchors, subfactorWeights } = policy.community;
  const entries = [
    {
      score: logNormalize(counts.stars, anchors.starsReference),
      weight: subfactorWeights.stars,
    },
    {
      score: logNormalize(counts.contributors, anchors.contributorsReference),
      weight: subfactorWeights.contributors,
    },
    {
      score: logNormalize(counts.forks, anchors.forksReference),
      weight: subfactorWeights.forks,
    },
  ];
  return {
    score: weightedAvailable(entries),
    coverage: coveragePercent(entries),
  };
}

/**
 * Agregación genérica de un conjunto de subfactores ya calificados (método metric o rubric,
 * eso lo decide quien produce `subfactorRecords`, no esta función) en un solo factor 0-100.
 *
 * Itera sobre el set COMPLETO de subfactores que la política define para este factor —
 * no sobre lo que `subfactorRecords` trae — así un subfactor simplemente ausente del array
 * de entrada se trata exactamente igual que uno marcado explícitamente `unavailable`: la
 * cobertura lo refleja, en vez de ignorarlo silenciosamente.
 */
export function computeFactorScore(subfactorRecords, policy, factorId) {
  const factorWeights = policy[factorId].subfactorWeights;
  const recordsById = new Map(
    subfactorRecords.map((record) => [record.id, record]),
  );
  const entries = Object.keys(factorWeights).map((id) => {
    const record = recordsById.get(id);
    const available = record != null && record.availability === 'available';
    return {
      score: available ? record.score : null,
      weight: factorWeights[id],
    };
  });
  return {
    score: weightedAvailable(entries),
    coverage: coveragePercent(entries),
  };
}

/**
 * Score global: combina los seis factores con los pesos 20/15/20/20/15/10.
 * `evidenceCoverage` es RECURSIVO: para cada factor usa la cobertura real de sus propios
 * subfactores (`factorResults[id].coverage`), no solo si el factor tiene score o no — así
 * un vacío de evidencia dentro de un factor sigue siendo visible en el número global, tal
 * como exige el diseño ("la redistribución no oculta el vacío porque se calcula
 * simultáneamente la cobertura").
 */
export function computeOverallScore(factorResults, policy) {
  const entries = Object.keys(policy.globalWeights).map((factorId) => {
    const result = factorResults[factorId];
    return {
      score: result ? result.score : null,
      weight: policy.globalWeights[factorId],
      coverage: result ? result.coverage : 0,
    };
  });
  const overallScore = weightedAvailable(
    entries.map((entry) => ({ score: entry.score, weight: entry.weight })),
  );
  const evidenceCoverage = entries.reduce(
    (total, entry) => total + entry.weight * entry.coverage,
    0,
  );
  return { overallScore, evidenceCoverage };
}

/**
 * Deriva `evidenceFreshness` y `evidenceConsistency` desde datos observables — desde
 * `formulaVersion` 1.6.0 el motor los calcula; ya no los autocalifica quien arma el
 * evidence input (ver diseño de integridad del scoring §3, y el spec original §Confianza
 * para las tablas). Pura, nunca lanza.
 *
 * `evidenceFreshness`: promedio ponderado (por `policy.globalWeights`, igual que
 * `evidenceCoverage`) de la frescura de cada fuente. Los cinco factores manuales se
 * califican siempre al evaluarse — edad ~0 respecto de `observedAt`, banda ≤7 días → 100.
 * `community` usa la edad real de `communitySnapshot.observedAt` cuando existe un
 * snapshot (más vieja si fue reutilizado); sin snapshot, `community` no aporta a la
 * mezcla — se redistribuye entre las cinco fuentes restantes, igual que un factor sin
 * evidencia se redistribuye en `computeOverallScore`.
 *
 * `evidenceConsistency`: 100 sin señales de degradación observables; 70 si
 * `contributorsState` no es "available" con un snapshot de comunidad disponible
 * (diferencia menor explicada), o si el snapshot en uso fue reutilizado (`reusedSnapshot`)
 * — ambas condiciones mapean al mismo valor "minor" de la política, sin apilarse. Un
 * conflicto de identidad no llega nunca a este cálculo: la evaluación queda `pending`
 * antes (ver runEvaluation).
 */
export function deriveConfidenceInputs(
  { observedAt, communitySnapshot, reusedSnapshot, contributorsState },
  policy,
  now,
) {
  const { freshnessBands, consistencyStates } = policy.confidenceDerivation;

  const bandScore = (ageDays) => {
    for (const band of freshnessBands) {
      if (ageDays <= band.maxDays) return band.score;
    }
    return 0; // más vieja que la última banda declarada — sin evidencia reciente
  };
  const ageDaysOf = (isoString) =>
    (now.getTime() - new Date(isoString).getTime()) / MS_PER_DAY;

  const freshnessEntries = Object.keys(policy.globalWeights).map((factorId) => {
    if (factorId !== 'community')
      return {
        score: bandScore(ageDaysOf(observedAt)),
        weight: policy.globalWeights[factorId],
      };
    if (!communitySnapshot)
      return { score: null, weight: policy.globalWeights[factorId] };
    return {
      score: bandScore(ageDaysOf(communitySnapshot.observedAt)),
      weight: policy.globalWeights[factorId],
    };
  });
  const evidenceFreshness = weightedAvailable(freshnessEntries);

  let evidenceConsistency = consistencyStates.clean;
  if (
    communitySnapshot &&
    contributorsState != null &&
    contributorsState !== 'available'
  ) {
    evidenceConsistency = Math.min(
      evidenceConsistency,
      consistencyStates.minor,
    );
  }
  if (reusedSnapshot) {
    evidenceConsistency = Math.min(
      evidenceConsistency,
      consistencyStates.minor,
    );
  }

  return { evidenceFreshness, evidenceConsistency };
}

/**
 * Confianza: mide la solidez de la evidencia, no la calidad del candidato.
 * Sus cuatro componentes siempre están disponibles al llegar acá (evidenceCoverage y
 * sourceReliability vienen del cómputo normal; evidenceFreshness y evidenceConsistency
 * desde formulaVersion 1.6.0 los deriva deriveConfidenceInputs, ya no los autodeclara
 * el evidence input), así que no necesita redistribución — es una suma ponderada directa.
 */
export function computeConfidenceScore(inputs, policy) {
  const w = policy.confidenceWeights;
  return (
    inputs.evidenceCoverage * w.evidenceCoverage +
    inputs.sourceReliability * w.sourceReliability +
    inputs.evidenceFreshness * w.evidenceFreshness +
    inputs.evidenceConsistency * w.evidenceConsistency
  );
}

/** Bandas de confianza: high >= 80, medium >= 50, si no low. Umbrales inclusivos. */
export function classifyConfidenceBand(confidenceScore, policy) {
  const { high, medium } = policy.confidenceBands;
  if (confidenceScore >= high) return 'high';
  if (confidenceScore >= medium) return 'medium';
  return 'low';
}
