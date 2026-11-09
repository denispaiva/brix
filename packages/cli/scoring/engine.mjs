import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { loadConfig } from '../src/lib/config.js';
import { collectGithubCommunityEvidence } from './lib/collectors/github.mjs';
import {
  computeCommunityScore,
  computeFactorScore,
  computeOverallScore,
  computeConfidenceScore,
  classifyConfidenceBand,
  deriveConfidenceInputs,
} from './lib/scoring-engine.mjs';
import { classifyRisk } from './lib/risk-analyzer.mjs';
import { computeBaselineRecommendation } from './lib/baseline-recommender.mjs';
import {
  computeExpiresAt,
  recordHumanDecision,
  writeEvaluationRecord,
  evidenceInputFilePath,
  evaluationFilePath,
} from './lib/decision-registry.mjs';
import { validateSubfactorRecord } from './lib/subfactor-contract.mjs';

// Motor del Scoring Skill — mudado acá desde vc/tools/ por decisión del PO (registro
// 0003, vc/brix/docs/decisions/). vc/tools/evaluate-tooling.mjs pasa a ser un
// envoltorio delgado que reexporta lo de acá; vc/tools/validate-tooling.mjs, la
// política canónica (vc/tooling/scoring-policy.json) y las evaluaciones
// (vc/tooling/evaluations/) NO se mudaron — siguen siendo datos del framework, ajenos
// a este paquete.

const NON_COMMUNITY_FACTORS = [
  'maintenance',
  'security',
  'fit',
  'engineering',
  'sustainability',
];
const REQUIRED_CONFIDENCE_INPUTS = ['sourceReliability'];
// Desde formulaVersion 1.6.0 el motor deriva estos dos (deriveConfidenceInputs, diseño
// §3) — un evidence input nuevo que los declare es un error, no un valor ignorado.
const DERIVED_CONFIDENCE_INPUTS = ['evidenceFreshness', 'evidenceConsistency'];

/**
 * Lee y valida la forma estructural del archivo de evidencia. A diferencia de las
 * funciones de librería (que nunca lanzan), esta sí lanza con mensaje claro — es
 * validación de entrada de CLI, no un contrato reusable por otro módulo.
 *
 * `communitySnapshot`, si el autor lo incluye, se acepta sin validar — es un campo que
 * el CLI escribe y reemplaza siempre en `runEvaluation` (diseño §2), nunca una entrada
 * que el autor deba llenar correctamente. No exigirlo ni validar su forma acá evita
 * que un intento manual de completarlo rompa la carga del archivo.
 */
export async function loadEvidenceInput(filePath) {
  let raw;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch (error) {
    throw new Error(
      `no se pudo leer el archivo de evidencia "${filePath}": ${error.message}`,
    );
  }

  let input;
  try {
    input = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `el archivo de evidencia "${filePath}" no es JSON válido: ${error.message}`,
    );
  }

  if (!input.candidate?.id)
    throw new Error(`el archivo de evidencia no tiene candidate.id`);
  if (!input.candidate?.type)
    throw new Error(`el archivo de evidencia no tiene candidate.type`);
  if (!input.candidate?.evaluatedRef)
    throw new Error(`el archivo de evidencia no tiene candidate.evaluatedRef`);
  if (!input.factors || typeof input.factors !== 'object') {
    throw new Error(`el archivo de evidencia no tiene factors`);
  }
  for (const factorId of NON_COMMUNITY_FACTORS) {
    if (!Array.isArray(input.factors[factorId])) {
      throw new Error(
        `el archivo de evidencia no tiene factors.${factorId} (debe ser un array de subfactores)`,
      );
    }
  }
  if (!input.confidenceInputs || typeof input.confidenceInputs !== 'object') {
    throw new Error(`el archivo de evidencia no tiene confidenceInputs`);
  }
  if (!input.riskFlags || typeof input.riskFlags !== 'object') {
    throw new Error(`el archivo de evidencia no tiene riskFlags`);
  }

  const contractErrors = [];
  for (const factorId of NON_COMMUNITY_FACTORS) {
    for (const record of input.factors[factorId]) {
      const { errors } = validateSubfactorRecord(record, factorId);
      contractErrors.push(...errors);
    }
  }
  // sourceReliability es obligatoria, no solo válida-si-está-presente: si falta,
  // llega como undefined a computeConfidenceScore, produce NaN, degrada la banda de
  // confianza a "low" en silencio y JSON.stringify serializa el NaN como null al persistir
  // — todo sin ningún error visible para quien arma el archivo de evidencia.
  for (const key of REQUIRED_CONFIDENCE_INPUTS) {
    if (!(key in input.confidenceInputs)) {
      contractErrors.push(`confidenceInputs.${key}: falta`);
    }
  }
  for (const key of DERIVED_CONFIDENCE_INPUTS) {
    if (key in input.confidenceInputs) {
      contractErrors.push(
        `confidenceInputs.${key}: ya no se declara — desde formulaVersion 1.6.0 el motor lo deriva (deriveConfidenceInputs); eliminar esta clave del archivo de evidencia`,
      );
    }
  }
  for (const [key, value] of Object.entries(input.confidenceInputs)) {
    if (typeof value !== 'number' || value < 0 || value > 100) {
      contractErrors.push(
        `confidenceInputs.${key}: debe ser un número entre 0 y 100 (recibido: ${value})`,
      );
    }
  }
  for (const [key, value] of Object.entries(input.riskFlags)) {
    if (typeof value !== 'boolean') {
      contractErrors.push(
        `riskFlags.${key}: debe ser booleano (recibido: ${value})`,
      );
    }
  }
  if (contractErrors.length > 0) {
    throw new Error(
      `el archivo de evidencia no cumple el contrato de subfactores: ${contractErrors.join('; ')}`,
    );
  }

  return input;
}

/**
 * Un conflicto de identidad del repositorio (la URL declarada resuelve a OTRO owner/repo
 * en GitHub) deja la evaluación en "pending", no decidible — evaluar sobre una fuente no
 * confirmada es evaluar otra cosa. No se computa ningún factor, ni siquiera los
 * manuales: el registro es real y archivable (conserva candidate/observedAt/
 * formulaVersion/evidenceInputRef), pero no tiene scores. Ver diseño §1.
 */
function buildConflictingPendingRecord(
  input,
  policy,
  observedAt,
  evidence,
  refs,
) {
  return {
    candidate: { ...input.candidate },
    observedAt,
    overallScore: null,
    factorScores: null,
    formulaVersion: policy.formulaVersion,
    baselineRecommendation: 'insufficient_evidence',
    status: 'pending',
    pendingReason: {
      kind: 'source_identity_conflict',
      expectedFullName: evidence.expectedFullName,
      actualFullName: evidence.actualFullName,
      detail:
        'La identidad del repositorio no coincide con la declarada; resolver la procedencia antes de evaluar.',
    },
    evidenceInputRef: refs.evidenceInputRef,
  };
}

const SNAPSHOT_MAX_AGE_DAYS = 180;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Arma el bloque `communitySnapshot` que el CLI persiste en el evidence input — nunca lo
 * escribe el autor. Ver diseño §2.
 */
function buildCommunitySnapshot(sourceUrl, evidence) {
  return {
    state: evidence.state,
    counts: evidence.counts,
    contributorsState: evidence.contributorsState,
    raw: evidence.raw,
    sourceUrl,
    observedAt: evidence.observedAt,
  };
}

/**
 * Snapshot vigente reutilizable: el evidence input actualmente persistido para este
 * candidato (si existe) trae un `communitySnapshot` con `state: "available"` y una edad,
 * respecto de `now`, de a lo sumo `SNAPSHOT_MAX_AGE_DAYS`. Devuelve null si no hay uno
 * elegible — nunca lanza, `currentEvidenceInput` puede ser null (primera evaluación).
 */
function findReusableSnapshot(currentEvidenceInput, now) {
  const snapshot = currentEvidenceInput?.communitySnapshot;
  if (!snapshot || snapshot.state !== 'available') return null;
  const ageDays =
    (now.getTime() - new Date(snapshot.observedAt).getTime()) / MS_PER_DAY;
  if (!(ageDays <= SNAPSHOT_MAX_AGE_DAYS)) return null;
  return snapshot;
}

function isoDateOnly(isoString) {
  return isoString.slice(0, 10);
}

/**
 * Referencias legibles por humanos (`evidenceInputRef`, `sourceEvidence`) que se
 * persisten DENTRO del registro de evaluación. Antes de mudar el motor eran un literal
 * fijo `vc/tooling/evaluations/<id>...` porque el motor vivía en blends y esa era la
 * única ubicación posible. Mudado a vc/brix/, ya no hay una única ubicación: se
 * derivan de `toolingRoot` relativa al cwd de invocación, así el registro sigue
 * siendo legible tanto corriendo dentro de blends (da "vc/tooling/evaluations/...",
 * igual que antes) como en el espejo standalone (da lo que ese layout use).
 */
function buildEvaluationRefs(toolingRoot, candidateId, cwd) {
  const relRoot = path.relative(cwd, toolingRoot);
  const relDir = relRoot ? `${relRoot}/evaluations` : 'evaluations';
  return {
    evidenceInputRef: `${relDir}/${candidateId}.evidence.json`,
    sourceEvidence: `../../docs/tooling/evaluations.md#${candidateId}`,
  };
}

/**
 * Orquesta collector + scoring-engine + risk-analyzer + baseline-recommender para un
 * candidato y arma el borrador de evaluación en estado "decision_pending" — sin
 * ningún I/O propio de escritura (solo el fetch inyectable del collector). Nunca
 * escribe nada en disco; eso es responsabilidad de quien llame (Tarea 5).
 *
 * Snapshot del factor community (diseño §2): `options.communitySnapshot`, si viene,
 * se usa tal cual sin tocar red (reproducibilidad: recomputar un evidence input
 * archivado). Si no viene y `options.offline` es true, nunca se toca la red: se
 * reutiliza el snapshot vigente elegible de `options.currentEvidenceInput` o community
 * queda unavailable. En el camino normal (con red), un collector `rate_limited` o
 * `unavailable` también intenta ese mismo reuso antes de rendirse. El snapshot resuelto
 * (fresco o reutilizado) se escribe en `input.communitySnapshot` — reemplazando lo que el
 * autor del evidence input haya puesto ahí — para que el caller lo persista tal cual.
 *
 * `options.refs`, si viene, son las referencias legibles (buildEvaluationRefs) que se
 * persisten en el registro; por defecto, las mismas que buildEvaluationRefs da
 * cuando la carpeta de tooling es el directorio de invocación.
 */
export async function runEvaluation(input, policy, options = {}) {
  const now = options.now ?? new Date();
  const observedAt = now.toISOString();
  const refs = options.refs ?? {
    evidenceInputRef: `evaluations/${input.candidate.id}.evidence.json`,
    sourceEvidence: `../../docs/tooling/evaluations.md#${input.candidate.id}`,
  };

  let community = { score: null, coverage: 0 };
  let communityEvidenceNote = null;
  // Solo se completa cuando community de verdad recibió score de un snapshot (no cuando
  // resolvedSnapshot queda null o con un state que no es "available") — así freshness y
  // consistency nunca contradicen a factorScores.community.
  let scoredCommunitySnapshot = null;

  if (input.candidate.sourceUrl) {
    let resolvedSnapshot = null;

    if (options.communitySnapshot) {
      resolvedSnapshot = options.communitySnapshot;
    } else if (options.offline) {
      resolvedSnapshot = findReusableSnapshot(
        options.currentEvidenceInput,
        now,
      );
      if (resolvedSnapshot) {
        communityEvidenceNote = `Comunidad: snapshot del ${isoDateOnly(resolvedSnapshot.observedAt)} reutilizado (--offline).`;
      } else {
        communityEvidenceNote =
          'Comunidad: --offline sin snapshot vigente elegible; queda unavailable.';
      }
    } else {
      // El collector recibe `clock` atado a `now` por defecto: así un snapshot fresco
      // siempre comparte observedAt con la propia evaluación, y solo un snapshot
      // REUTILIZADO conserva deliberadamente una fecha más vieja — la señal que distingue
      // ambos casos en el reporte, sin necesitar un campo booleano aparte.
      const evidence = await collectGithubCommunityEvidence(
        input.candidate.sourceUrl,
        {
          ...options,
          clock: options.clock ?? (() => observedAt),
        },
      );
      if (evidence.state === 'conflicting') {
        return buildConflictingPendingRecord(
          input,
          policy,
          observedAt,
          evidence,
          refs,
        );
      }
      if (evidence.state === 'available') {
        resolvedSnapshot = buildCommunitySnapshot(
          input.candidate.sourceUrl,
          evidence,
        );
      } else if (
        evidence.state === 'rate_limited' ||
        evidence.state === 'unavailable'
      ) {
        resolvedSnapshot = findReusableSnapshot(
          options.currentEvidenceInput,
          now,
        );
        if (resolvedSnapshot) {
          communityEvidenceNote = `Comunidad: snapshot del ${isoDateOnly(resolvedSnapshot.observedAt)} reutilizado por rate limit o indisponibilidad del collector.`;
        }
      }
    }

    if (resolvedSnapshot) {
      // require-atomic-updates es falso positivo acá: la regla no puede probar que no
      // hay reentrada, pero acá no la hay. `input` es un objeto fresco por invocación
      // (armado en loadEvidenceInput desde el archivo de evidencia); el único caller
      // real, runEvaluateCommand, invoca runEvaluation una sola vez por proceso de CLI
      // (guardado por `if (import.meta.filename === process.argv[1])`) y espera su
      // `await` completo antes de tocar `input` de nuevo — ningún otro código de este
      // archivo, ni de ningún caller en el repo, muta `input.communitySnapshot` mientras
      // el `await collectGithubCommunityEvidence(...)` de arriba está en vuelo. Los
      // tests que reutilizan un mismo objeto fixture (EVIDENCE_INPUT en
      // tests/evidence-input-persistence.test.mjs) lo hacen en llamadas secuenciales
      // (node:test corre los test() de un archivo uno por uno, no concurrentes) y ese
      // fixture tiene candidate.sourceUrl: null, así que ni siquiera entra a este bloque.
      // Analizado a fondo para la adopción de D-#10 (formato big-bang + veredicto del
      // hallazgo, 2026-08-23) — no suprimir sin repetir este análisis.
      // eslint-disable-next-line require-atomic-updates -- ver análisis arriba
      input.communitySnapshot = resolvedSnapshot;
      if (resolvedSnapshot.state === 'available') {
        community = computeCommunityScore(resolvedSnapshot.counts, policy);
        scoredCommunitySnapshot = resolvedSnapshot;
      }
    } else {
      delete input.communitySnapshot;
    }
  }

  const factorResults = { community };
  for (const factorId of NON_COMMUNITY_FACTORS) {
    factorResults[factorId] = computeFactorScore(
      input.factors[factorId],
      policy,
      factorId,
    );
  }

  const { overallScore, evidenceCoverage } = computeOverallScore(
    factorResults,
    policy,
  );
  // Un snapshot cuyo observedAt difiere del de esta evaluación es, por construcción, uno
  // reutilizado (el camino fresco ata el clock del collector a este mismo observedAt —
  // ver más arriba); así se reproduce fielmente el reuso original al recomputar desde
  // un evidence input archivado, sin necesitar rastrear un booleano aparte.
  const wasSnapshotReused = scoredCommunitySnapshot
    ? scoredCommunitySnapshot.observedAt !== observedAt
    : false;
  const derivedConfidenceInputs = deriveConfidenceInputs(
    {
      observedAt,
      communitySnapshot: scoredCommunitySnapshot,
      reusedSnapshot: wasSnapshotReused,
      contributorsState: scoredCommunitySnapshot?.contributorsState ?? null,
    },
    policy,
    now,
  );
  const confidenceScore = computeConfidenceScore(
    {
      evidenceCoverage,
      sourceReliability: input.confidenceInputs.sourceReliability,
      ...derivedConfidenceInputs,
    },
    policy,
  );
  const confidence = classifyConfidenceBand(confidenceScore, policy);
  const riskLevel = classifyRisk(input.riskFlags, policy);
  const baselineRecommendation = computeBaselineRecommendation(
    overallScore,
    confidence,
    policy,
  );
  const expiresAt = computeExpiresAt(observedAt, confidence, policy);

  const factorScores = {};
  for (const factorId of Object.keys(factorResults))
    factorScores[factorId] = factorResults[factorId].score;

  return {
    candidate: { ...input.candidate },
    observedAt,
    overallScore,
    evidenceCoverage,
    factorScores,
    formulaVersion: policy.formulaVersion,
    confidenceScore,
    confidence,
    riskLevel,
    baselineRecommendation,
    status: 'decision_pending',
    sourceEvidence: refs.sourceEvidence,
    evidenceInputRef: refs.evidenceInputRef,
    expiresAt,
    communityEvidenceNote,
  };
}

const RISK_FLAG_LABELS = {
  scopedLocalReadOnly: 'solo lectura local con alcance acotado',
  localWriteReversible: 'escritura local reversible',
  newLocalDependencies: 'nuevas dependencias locales',
  networkAccess: 'acceso a red',
  credentialsAccess: 'acceso a credenciales',
  sensitiveDataAccess: 'acceso a datos sensibles',
  remoteWrite: 'escritura remota',
  broadScope: 'alcance amplio',
  destructiveActions: 'acciones destructivas',
  elevatedPrivileges: 'privilegios elevados',
  irreversibleExternalPublication: 'publicación externa irreversible',
  knownCriticalVulnerability: 'vulnerabilidad crítica conocida',
};

const STRENGTH_THRESHOLD = 85;
const CONCERN_THRESHOLD = 40;

/**
 * Filtro mecánico sobre los subfactores ya puntuados por el agente en el archivo de
 * evidencia (nunca sobre community, que no tiene rationale por subfactor — ver diseño
 * §5). No genera texto nuevo: solo selecciona y formatea lo que ya está escrito.
 */
function extractStrengthsAndConcerns(evidenceInput) {
  const strengths = [];
  const concerns = [];
  for (const factorId of NON_COMMUNITY_FACTORS) {
    for (const record of evidenceInput.factors[factorId] ?? []) {
      const label = `${factorId}.${record.id}`;
      if (record.availability !== 'available') {
        concerns.push(
          `${label} — sin evidencia disponible (${record.availability})`,
        );
        continue;
      }
      if (record.score >= STRENGTH_THRESHOLD)
        strengths.push(`${label} (${record.score}) — ${record.rationale}`);
      else if (record.score <= CONCERN_THRESHOLD)
        concerns.push(`${label} (${record.score}) — ${record.rationale}`);
    }
  }
  return { strengths, concerns };
}

/**
 * Bloque de reporte para una evaluación "pending" por conflicto de identidad — sin
 * scores que mostrar (no se computaron), muestra las dos identidades y cómo resolverlo.
 */
function renderPendingConflictReport(evaluationRecord) {
  const c = evaluationRecord.candidate;
  const reason = evaluationRecord.pendingReason;
  const lines = [
    '═'.repeat(63),
    `  EVALUACIÓN DE TOOLING · ${c.id} (${c.type})`,
    c.sourceUrl
      ? `  ${c.sourceUrl.replace(/^https?:\/\//, '')} · evaluado ${evaluationRecord.observedAt.slice(0, 10)}`
      : `  sin sourceUrl · evaluado ${evaluationRecord.observedAt.slice(0, 10)}`,
    '═'.repeat(63),
    '',
    '  ⚠ CONFLICTO DE IDENTIDAD — evaluación en pending, no decidible',
    '',
    `  Identidad esperada     ${reason.expectedFullName}`,
    `  Identidad encontrada   ${reason.actualFullName}`,
    '',
    `  ${reason.detail}`,
    '',
    '  ── ¿Qué hacer? ─────────────────────────────────────',
    '  1. Corregir sourceUrl o evaluatedRef en el evidence input',
    '  2. Re-evaluar con: brix tool score evaluate --input <archivo> (o evaluate-tooling.mjs evaluate dentro de blends)',
    '═'.repeat(63),
  ];
  return lines.join('\n');
}

/** Reporte human-friendly para terminal — pura, no escribe nada, no imprime nada. */
export function renderReport(evaluationRecord, evidenceInput) {
  if (evaluationRecord.status === 'pending')
    return renderPendingConflictReport(evaluationRecord);

  const c = evaluationRecord.candidate;
  const { strengths, concerns } = extractStrengthsAndConcerns(evidenceInput);
  const activeRiskFlags = Object.keys(evidenceInput.riskFlags).filter(
    (name) => evidenceInput.riskFlags[name],
  );

  const lines = [
    '═'.repeat(63),
    `  EVALUACIÓN DE TOOLING · ${c.id} (${c.type})`,
    c.sourceUrl
      ? `  ${c.sourceUrl.replace(/^https?:\/\//, '')} · evaluado ${evaluationRecord.observedAt.slice(0, 10)}`
      : `  sin sourceUrl · evaluado ${evaluationRecord.observedAt.slice(0, 10)}`,
    '═'.repeat(63),
    '',
    `  SCORE GENERAL         ${evaluationRecord.overallScore.toFixed(1)} / 100`,
    `  CONFIANZA             ${evaluationRecord.confidence} (${evaluationRecord.confidenceScore.toFixed(0)})`,
    `  NIVEL DE RIESGO        ${evaluationRecord.riskLevel}`,
    `  RECOMENDACIÓN BASE     ${evaluationRecord.baselineRecommendation}`,
    '',
    ...(evaluationRecord.communityEvidenceNote
      ? [`  ⓘ ${evaluationRecord.communityEvidenceNote}`, '']
      : []),
    '  ── Por factor ──────────────────────────────────────',
    ...Object.keys(evaluationRecord.factorScores).map((factorId) => {
      const score = evaluationRecord.factorScores[factorId];
      return `  ${factorId.padEnd(16)} ${score == null ? 'unavailable' : score.toFixed(1)}`;
    }),
    '',
    '  ── Riesgo, por ─────────────────────────────────────',
    ...(activeRiskFlags.length
      ? activeRiskFlags.map(
          (name) => `  • ${name} (${RISK_FLAG_LABELS[name] ?? name})`,
        )
      : ['  (sin señales de riesgo marcadas)']),
    '',
    `  ── Fortalezas (subfactores ≥${STRENGTH_THRESHOLD}) ────────────────────`,
    ...(strengths.length ? strengths.map((s) => `  • ${s}`) : ['  (ninguna)']),
    '',
    `  ── Preocupaciones (subfactores ≤${CONCERN_THRESHOLD} o sin evidencia) ─`,
    ...(concerns.length ? concerns.map((s) => `  • ${s}`) : ['  (ninguna)']),
    '',
    '  ── ¿Qué hacer? ─────────────────────────────────────',
    '  1. CONTINUAR   → activarla (con o sin reservas)',
    '  2. HOLDEAR     → dejarla pendiente, revisar más adelante',
    '  3. DESCARTAR   → no avanzar',
    '═'.repeat(63),
  ];
  return lines.join('\n');
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Bloque "### Decisión": pendiente si no hay decisión todavía, o el resumen si ya la hay. */
export function renderDecisionSubsection(decision) {
  if (!decision) return '_Pendiente de decisión humana._';
  const lines = [
    `**${decision.status}**`,
    '',
    `Decidido por ${decision.decidedBy} el ${decision.decidedAt}.`,
  ];
  if (decision.rationale) lines.push('', decision.rationale);
  if (decision.reviewAt) lines.push('', `Revisión: ${decision.reviewAt}.`);
  return lines.join('\n');
}

/**
 * Sección narrativa completa de un candidato para el doc narrativo (por defecto
 * vc/docs/tooling/evaluations.md dentro de blends). Se genera siempre en su totalidad
 * en `evaluate` (borrador nuevo o re-evaluación) — `decide` después solo toca el
 * bloque ### Decisión vía updateNarrativeDecisionSection, porque para entonces
 * evidenceInput (con el detalle por subfactor) ya no está disponible: lo único que
 * persiste es evaluationRecord.
 */
export function buildNarrativeSection(evidenceInput, evaluationRecord) {
  const { strengths, concerns } = extractStrengthsAndConcerns(evidenceInput);
  const lines = [
    `## ${evaluationRecord.candidate.id}`,
    '',
    `Evaluado: ${evaluationRecord.observedAt.slice(0, 10)} · Score general: **${evaluationRecord.overallScore.toFixed(1)}** · Confianza: **${evaluationRecord.confidence}** · Riesgo: **${evaluationRecord.riskLevel}** · Recomendación base: **${evaluationRecord.baselineRecommendation}**`,
    '',
    '**Fortalezas:** ' +
      (strengths.length ? strengths.join('; ') : 'ninguna registrada.'),
    '',
    '**Preocupaciones:** ' +
      (concerns.length ? concerns.join('; ') : 'ninguna registrada.'),
    '',
    '### Decisión',
    '',
    renderDecisionSubsection(evaluationRecord.humanDecision ?? null),
    '',
  ];
  return lines.join('\n');
}

/**
 * Inserta o reemplaza la sección `## <candidateId>` de un doc markdown. Pura, sin I/O.
 * Sin el flag "m": con "m", `$` matchea antes de CUALQUIER salto de línea (no solo el
 * final real del documento), así que el cuantificador perezoso se detiene en la primera
 * línea en blanco dentro de la sección y deja basura de la sección vieja sin reemplazar.
 * El prefijo `(^|\n)` reemplaza el rol de `^`/"m" para encontrar el heading en medio del doc.
 */
export function upsertNarrativeSection(
  markdownContent,
  candidateId,
  newSectionMarkdown,
) {
  const headingRe = new RegExp(
    `(^|\\n)## ${escapeRegExp(candidateId)}\\n[\\s\\S]*?(?=\\n## |$)`,
  );
  if (headingRe.test(markdownContent)) {
    return markdownContent.replace(
      headingRe,
      (_match, prefix) => prefix + newSectionMarkdown.trimEnd() + '\n',
    );
  }
  const separator = markdownContent.endsWith('\n\n')
    ? '---\n\n'
    : markdownContent.endsWith('\n')
      ? '\n---\n\n'
      : '\n\n---\n\n';
  return markdownContent + separator + newSectionMarkdown.trimEnd() + '\n';
}

/**
 * Reemplaza el bloque ### Decisión dentro de la sección `## <candidateId>` si ya existe;
 * si la sección existe pero todavía no tiene ese bloque (por ejemplo las entradas
 * migradas antes de que esta convención existiera, escritas como prosa libre) se lo
 * agrega al final de la sección en vez de fallar. Solo lanza si la sección
 * `## <candidateId>` no existe en absoluto, que sigue siendo un error real (decidir
 * sobre un candidato sin ninguna entrada narrativa). Misma razón que en
 * upsertNarrativeSection para evitar el flag "m": si el contenido de la decisión
 * anterior tuviera una línea en blanco interna, `$` con "m" la confundiría con el final
 * de la sección. El tramo entre el heading y `### Decisión` usa `(?:(?!\n## )[\s\S])*?`
 * en vez de `[\s\S]*?` a secas — sin ese límite, la búsqueda podía atravesar el heading
 * `## ` de OTRO candidato para encontrar el primer `### Decisión` que apareciera más
 * adelante en el doc, y terminaba escribiendo la decisión de un candidato adentro de la
 * sección de otro (corrupción silenciosa cross-candidato, sin lanzar ningún error).
 */
export function updateNarrativeDecisionSection(
  markdownContent,
  candidateId,
  decisionSubsectionMarkdown,
) {
  const withDecisionBlockRe = new RegExp(
    `(^|\\n)(## ${escapeRegExp(candidateId)}\\n(?:(?!\\n## )[\\s\\S])*?### Decisión\\n\\n)[\\s\\S]*?(?=\\n## |$)`,
  );
  if (withDecisionBlockRe.test(markdownContent)) {
    return markdownContent.replace(
      withDecisionBlockRe,
      (match, prefix, headingPart, offset, fullString) => {
        // La convención real del doc (ver comentario de arriba de la función) es que TODA
        // sección no-última termina en "---" antes del próximo "## ". El lookahead
        // "(?=\n## |$)" de arriba consume TODO el contenido viejo hasta ahí, "---" incluido,
        // y antes este código solo reinsertaba prefix+headingPart+bloque nuevo — el separador
        // desaparecía sin dejar rastro (bug real que corrompió en silencio 3 secciones de
        // este mismo doc antes de detectarse). No basta con "preservar" el --- viejo: si el
        // doc YA está corrompido (el --- ya se perdió en una corrida anterior con el código
        // roto), no queda nada que preservar y un fix que solo copia el separador viejo deja
        // el daño sin reparar. Por eso reconstruimos la convención desde la posición
        // estructural en vez de desde el contenido: si después de esta sección viene otro
        // heading "## " en el doc, el separador va sí o sí — la lazy quantifier de arriba
        // solo llega hasta el final real de fullString (sin flag "m", "$" es el final
        // absoluto) cuando esta es la ÚLTIMA sección, así que offset+match.length ==
        // fullString.length es exactamente esa condición.
        const isLastSection = offset + match.length >= fullString.length;
        const separator = isLastSection ? '\n' : '\n\n---\n';
        return `${prefix}${headingPart}${decisionSubsectionMarkdown.trimEnd()}${separator}`;
      },
    );
  }

  const sectionOnlyRe = new RegExp(
    `(^|\\n)(## ${escapeRegExp(candidateId)}\\n[\\s\\S]*?)(?=\\n## |$)`,
  );
  if (sectionOnlyRe.test(markdownContent)) {
    return markdownContent.replace(
      sectionOnlyRe,
      (match, prefix, section, offset, fullString) => {
        const trimmedSection = section.trimEnd();
        // Si la sección ya termina en un separador "---" (como todas las secciones migradas
        // reales), el bloque nuevo va ANTES del separador — si no, el "---" que debe separar
        // esta sección de la siguiente queda atrapado adentro de esta, antes del bloque. Si
        // NO lo tiene pero esta no es la última sección del doc, lo agregamos igual: la
        // convención exige separador en toda sección no-última (ver comentario estructural en
        // la rama withDecisionBlockRe de arriba), y una sección sin él es daño ya hecho, no un
        // caso legítimo de "sección sin separador por diseño".
        const isLastSection = offset + match.length >= fullString.length;
        const separatorMatch = trimmedSection.match(/\n{1,2}---$/);
        const body = separatorMatch
          ? trimmedSection.slice(0, separatorMatch.index).trimEnd()
          : trimmedSection;
        const trailer = isLastSection ? '\n' : '\n\n---\n';
        return `${prefix}${body}\n\n### Decisión\n\n${decisionSubsectionMarkdown.trimEnd()}${trailer}`;
      },
    );
  }

  throw new Error(
    `no se encontró la sección "## ${candidateId}" en el doc narrativo`,
  );
}

/** Parseo mínimo de flags `--nombre valor` / `--nombre` (booleano). Sin dependencias externas. */
export function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const name = token.slice(2);
    const next = argv[i + 1];
    if (next != null && !next.startsWith('--')) {
      flags[name] = next;
      i++;
    } else {
      flags[name] = true;
    }
  }
  return flags;
}

/**
 * Resuelve policyPath/toolingRoot/narrativeDocPath con la misma disciplina que el
 * resto del CLI de Brix (parametrización del layout, docs/lifecycle/decoupling-brix.md
 * commit `da5e013`): flag de línea de comandos > `brix.config.json` del proyecto que
 * invoca (bajo `score.*`, resuelto relativo a `cwd`) > default embebido en el paquete.
 *
 * El default embebido de `policyPath` es `default-scoring-policy.json`, una copia
 * congelada de la política vigente al mudar el motor (registro 0003) — permite que
 * `brix tool score` dé un resultado, aunque desactualizado, corriendo standalone en el
 * espejo sin `vc/tooling/scoring-policy.json` a la vista. Dentro de blends, el
 * `brix.config.json` de la raíz fija `score.policyPath` a la política real, así que el
 * embebido nunca se usa ahí. El default de `toolingRoot` es el cwd de invocación mismo
 * (las evaluaciones quedan en `<cwd>/evaluations/`). `narrativeDocPath` NO tiene default embebido: la
 * convención de doc narrativo es de blends, no del motor — sin configurarla, `evaluate`
 * y `decide` simplemente se saltean ese paso (ver runEvaluateCommand/runDecideCommand).
 */
export function resolveRoots(flags, { cwd = process.cwd() } = {}) {
  const config = loadConfig(cwd);
  const score = config.score ?? {};

  const policyPath = flags.policy
    ? path.resolve(cwd, flags.policy)
    : score.policyPath
      ? path.resolve(cwd, score.policyPath)
      : path.join(import.meta.dirname, 'default-scoring-policy.json');

  // `toolingRoot`: el directorio que CONTIENE `evaluations/` (mismo contrato que
  // decision-registry.mjs — evaluationFilePath/evidenceInputFilePath le agregan
  // "evaluations" ellas mismas). No es "la carpeta de evaluaciones" directamente:
  // `score.outputDir` en brix.config.json declara ese contenedor, no el destino final.
  const toolingRoot = flags['output-dir']
    ? path.resolve(cwd, flags['output-dir'])
    : score.outputDir
      ? path.resolve(cwd, score.outputDir)
      : cwd;

  const narrativeDocPath = flags['narrative-doc']
    ? path.resolve(cwd, flags['narrative-doc'])
    : score.narrativeDocPath
      ? path.resolve(cwd, score.narrativeDocPath)
      : null;

  return { cwd, policyPath, toolingRoot, narrativeDocPath };
}

/**
 * Lee un registro de evaluación existente por candidateId — reemplazo self-contained
 * de `loadEvaluationFile` (vc/tools/validate-tooling.mjs), que quedó en vc/tools/ y no
 * se muda acá. A diferencia de esa función (que valida un `assessmentRef` con el
 * literal fijo `vc/tooling/evaluations/`), esta resuelve la ruta desde
 * `toolingRoot` ya resuelta por `resolveRoots` — funciona igual dentro de blends y
 * en el espejo standalone.
 */
async function loadEvaluationRecord(toolingRoot, candidateId) {
  try {
    const raw = await readFile(
      evaluationFilePath(toolingRoot, candidateId),
      'utf8',
    );
    return { found: true, evaluation: JSON.parse(raw) };
  } catch (error) {
    return { found: false, error: error.message };
  }
}

export async function runEvaluateCommand(argv, { cwd } = {}) {
  const flags = parseFlags(argv);
  if (!flags.input) {
    console.error('evaluate: falta --input <archivo>');
    process.exitCode = 1;
    return;
  }
  const { toolingRoot, narrativeDocPath, policyPath } = resolveRoots(flags, {
    cwd,
  });

  try {
    const policy = JSON.parse(await readFile(policyPath, 'utf8'));
    const input = await loadEvidenceInput(flags.input);
    const now = flags.now ? new Date(flags.now) : new Date();

    // Evidence input VIGENTE (si existe) de este candidato — la fuente del snapshot de
    // comunidad a reutilizar ante rate limit/indisponibilidad o --offline. Su ausencia
    // (primera evaluación del candidato) es normal, no un error: sin snapshot para
    // reutilizar, community queda unavailable, como siempre.
    let currentEvidenceInput = null;
    try {
      currentEvidenceInput = JSON.parse(
        await readFile(
          evidenceInputFilePath(toolingRoot, input.candidate.id),
          'utf8',
        ),
      );
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    const refs = buildEvaluationRefs(
      toolingRoot,
      input.candidate.id,
      resolveRoots(flags, { cwd }).cwd,
    );
    const record = await runEvaluation(input, policy, {
      now,
      offline: Boolean(flags.offline),
      currentEvidenceInput,
      refs,
    });
    const report = renderReport(record, input);

    if (flags['dry-run']) {
      console.log(report);
      console.log('\n(dry-run: no se escribió nada)');
      return;
    }

    await writeEvaluationRecord(toolingRoot, record, { evidenceInput: input });

    if (narrativeDocPath) {
      let narrative;
      try {
        narrative = await readFile(narrativeDocPath, 'utf8');
      } catch {
        narrative = '# Evaluaciones de tooling\n';
      }
      const section = buildNarrativeSection(input, record);
      await writeFile(
        narrativeDocPath,
        upsertNarrativeSection(narrative, record.candidate.id, section),
        'utf8',
      );
    }

    console.log(report);
    console.log(
      `\nBorrador guardado en pending: ${refs.evidenceInputRef.replace(/\.evidence\.json$/, '.evaluation.json')}`,
    );
  } catch (error) {
    console.error(`evaluate: ${error.message}`);
    process.exitCode = 1;
  }
}

/** Arma el objeto decisión desde los flags del CLI. decidedAt por defecto es `now`. */
export function buildDecisionFromArgs(flags, now = new Date()) {
  const decision = {
    status: flags.status,
    decidedBy: flags.by,
    decidedAt: flags['decided-at'] ?? now.toISOString(),
  };
  if (flags.rationale) decision.rationale = flags.rationale;
  if (flags['review-at']) decision.reviewAt = flags['review-at'];
  if (flags['accepted-risk']) decision.acceptedRisk = true;
  return decision;
}

export async function runDecideCommand(argv, { cwd } = {}) {
  const flags = parseFlags(argv);
  if (!flags.id) {
    console.error('decide: falta --id <candidateId>');
    process.exitCode = 1;
    return;
  }
  if (!flags.status) {
    console.error(
      'decide: falta --status <approved|approved_with_exception|rejected|deferred>',
    );
    process.exitCode = 1;
    return;
  }
  if (!flags.by) {
    console.error('decide: falta --by "<nombre>"');
    process.exitCode = 1;
    return;
  }

  const { toolingRoot, narrativeDocPath, policyPath } = resolveRoots(flags, {
    cwd,
  });

  try {
    const policy = JSON.parse(await readFile(policyPath, 'utf8'));

    const result = await loadEvaluationRecord(toolingRoot, flags.id);
    if (!result.found) {
      console.error(
        `decide: no se encontró una evaluación pendiente para "${flags.id}" (${result.error})`,
      );
      process.exitCode = 1;
      return;
    }
    if (result.evaluation.status === 'pending') {
      console.error(
        'decide: la evaluación está pending por conflicto de identidad; no es decidible — resolver la procedencia y re-evaluar',
      );
      process.exitCode = 1;
      return;
    }

    const decision = buildDecisionFromArgs(flags);
    const outcome = recordHumanDecision(result.evaluation, decision, policy);
    if (!outcome.valid) {
      console.error(`decide: decisión inválida — ${outcome.errors.join('; ')}`);
      process.exitCode = 1;
      return;
    }

    // Calculamos el contenido narrativo nuevo ANTES de escribir nada — si
    // updateNarrativeDecisionSection lanza (candidato sin ninguna sección narrativa), el
    // evaluation.json todavía no se tocó, en vez de quedar a medio decidir. Sin
    // narrativeDocPath configurado (fuera de blends), este paso entero se saltea.
    let updatedNarrative = null;
    if (narrativeDocPath) {
      let narrative;
      try {
        narrative = await readFile(narrativeDocPath, 'utf8');
      } catch {
        narrative = '# Evaluaciones de tooling\n';
      }
      const subsection = renderDecisionSubsection(
        outcome.evaluation.humanDecision,
      );
      updatedNarrative = updateNarrativeDecisionSection(
        narrative,
        flags.id,
        subsection,
      );
    }

    await writeEvaluationRecord(toolingRoot, outcome.evaluation);
    if (narrativeDocPath)
      await writeFile(narrativeDocPath, updatedNarrative, 'utf8');

    console.log(
      `decide: "${flags.id}" → ${outcome.evaluation.status} (vence ${outcome.evaluation.expiresAt}).`,
    );
  } catch (error) {
    console.error(`decide: ${error.message}`);
    process.exitCode = 1;
  }
}

/** Punto de entrada de CLI que tanto brix.js (`brix tool score`) como el envoltorio
 * vc/tools/evaluate-tooling.mjs invocan, con el mismo despacho `evaluate`/`decide`. */
export async function runScoreCli(argv, { cwd } = {}) {
  const [command, ...rest] = argv;
  if (command === 'evaluate') return runEvaluateCommand(rest, { cwd });
  if (command === 'decide') return runDecideCommand(rest, { cwd });
  console.error(
    `tool score: comando desconocido "${command ?? ''}". Comandos disponibles: evaluate, decide.`,
  );
  process.exitCode = 1;
}
