import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Fecha de expiración/revisión: 90 días ordinario, 30 días si la confianza es "low".
 * Solo "low" usa el plazo corto — "medium" y "high" comparten el plazo ordinario.
 */
export function computeExpiresAt(observedAtIso, confidenceBand, policy) {
  const days = confidenceBand === "low" ? policy.review.earlyReviewDays : policy.review.ordinaryDays;
  const observedAt = new Date(observedAtIso);
  return new Date(observedAt.getTime() + days * MS_PER_DAY).toISOString();
}

const REQUIRED_FIELDS_BY_STATUS = {
  approved: ["decidedBy", "decidedAt"],
  approved_with_exception: ["decidedBy", "decidedAt", "rationale", "reviewAt"],
  rejected: ["decidedBy", "decidedAt", "rationale"],
  deferred: ["decidedBy", "rationale", "reviewAt"],
};
const VALID_STATUSES = new Set(["pending", "approved", "approved_with_exception", "rejected", "deferred"]);

/**
 * Valida los campos obligatorios por estado de decisión humana, exactamente como los
 * exige el diseño aprobado (regla 4 del ciclo de vida). Nunca lanza — devuelve un
 * veredicto con la lista de errores, para que quien llama decida cómo mostrarlos.
 */
export function validateHumanDecision(decision) {
  if (!VALID_STATUSES.has(decision.status)) {
    return { valid: false, errors: [`status inválido: ${decision.status}`] };
  }
  if (decision.status === "pending") return { valid: true, errors: [] };

  const errors = [];
  for (const field of REQUIRED_FIELDS_BY_STATUS[decision.status]) {
    if (decision[field] == null) errors.push(`${decision.status} requiere ${field}`);
  }
  if (decision.status === "approved_with_exception" && decision.acceptedRisk !== true) {
    errors.push("approved_with_exception requiere acceptedRisk: true");
  }
  return { valid: errors.length === 0, errors };
}

const STATUS_MAP = {
  approved: "approved",
  approved_with_exception: "approved_with_exception",
  rejected: "rejected",
  deferred: "deferred",
  pending: "decision_pending",
};

const LEVEL_ORDER = ["low", "medium", "high", "critical"];

/**
 * Valida y adjunta una decisión humana a una evaluación existente. Siempre calcula
 * evaluation.expiresAt automáticamente según la confianza (no es decisión del humano).
 * El reviewAt viene explícitamente en la decisión (garantizado por validateHumanDecision
 * cuando el estado lo requiere), y se usa tal cual sin recalcular. Una decisión inválida
 * no modifica la evaluación — el registro nunca queda a medio escribir.
 *
 * Después de validar la decisión de forma aislada, aplica el gate de riesgo: un candidato
 * con riskLevel en o por encima de policy.risk.decisionGate.requiresExceptionAtOrAbove no
 * puede quedar "approved" liso — debe pasar por approved_with_exception (que ya exige
 * acceptedRisk, rationale y reviewAt). El gate vive acá y no en validateHumanDecision
 * porque necesita el riskLevel de la evaluación, no solo la decisión aislada. rejected y
 * deferred nunca se gatean — rechazar o posponer un candidato riesgoso siempre es válido.
 * Una política sin decisionGate (histórica) no gatea nada: compatibilidad hacia atrás.
 */
export function recordHumanDecision(evaluation, decision, policy) {
  const validation = validateHumanDecision(decision);
  if (!validation.valid) return { valid: false, errors: validation.errors };

  const gateLevel = policy.risk?.decisionGate?.requiresExceptionAtOrAbove;
  if (
    gateLevel != null &&
    decision.status === "approved" &&
    LEVEL_ORDER.indexOf(evaluation.riskLevel) >= LEVEL_ORDER.indexOf(gateLevel)
  ) {
    return {
      valid: false,
      errors: [`riesgo ${evaluation.riskLevel}: "approved" no es válido — usar approved_with_exception (exige acceptedRisk, rationale y reviewAt)`],
    };
  }

  const expiresAt = computeExpiresAt(evaluation.observedAt, evaluation.confidence, policy);
  return {
    valid: true,
    errors: [],
    evaluation: {
      ...evaluation,
      status: STATUS_MAP[decision.status],
      expiresAt,
      humanDecision: { ...decision },
    },
  };
}

/**
 * candidateId se usa directamente como componente de ruta de archivo — debe ser seguro
 * (sin `/`, sin `..`, sin caracteres que puedan escapar rootDir). Los ids reales del
 * inventario de Blends son siempre alfanuméricos con guiones (p. ej. "gitleaks",
 * "trail-of-bits-security"), así que esta restricción no excluye ningún caso real.
 */
function assertSafeCandidateId(candidateId) {
  if (!/^[a-zA-Z0-9_-]+$/.test(candidateId)) {
    throw new Error(`candidateId contiene caracteres no seguros para una ruta de archivo: ${candidateId}`);
  }
}

export function evaluationFilePath(rootDir, candidateId) {
  assertSafeCandidateId(candidateId);
  return path.join(rootDir, "evaluations", `${candidateId}.evaluation.json`);
}

/**
 * Ruta del evidence input vigente de un candidato — el archivo `--input` completo
 * (subfactores, rationales, evidenceRefs, confidenceInputs, riskFlags) que sustenta el
 * score. Vive junto a `<id>.evaluation.json`, no dentro de él, porque `decide` reescribe
 * la evaluación sin tocar el evidence input (ver writeEvaluationRecord).
 */
export function evidenceInputFilePath(rootDir, candidateId) {
  assertSafeCandidateId(candidateId);
  return path.join(rootDir, "evaluations", `${candidateId}.evidence.json`);
}

/**
 * evaluation-id: combina el observedAt saneado y el evaluatedRef saneado (para que las
 * carpetas de history/ sigan ordenando cronológicamente a simple vista, como antes) con
 * un hash corto del contenido COMPLETO del registro. Antes se armaba solo con
 * observedAt+evaluatedRef, así que dos estados distintos de una misma evaluación
 * (por ejemplo un borrador y la decisión que lo reemplaza, que decide preserva con el
 * mismo observedAt a propósito) podían colisionar bajo el mismo nombre de archivo —
 * exactamente el flujo real evaluate -> decide -> evaluate otra vez. Ahora colisiona
 * solo cuando el CONTENIDO es literalmente idéntico, que es la garantía real que un
 * histórico inmutable debe dar (dos snapshots distintos nunca comparten nombre; dos
 * snapshots idénticos siguen fallando ruidosamente, sin cambios en esa protección).
 */
export function evaluationId(record) {
  const safeObservedAt = record.observedAt.replace(/[:.]/g, "-");
  const safeRef = record.candidate.evaluatedRef.replace(/[^a-zA-Z0-9._-]/g, "-");
  const digest = crypto.createHash("sha256").update(JSON.stringify(record)).digest("hex").slice(0, 8);
  return `${safeObservedAt}_${safeRef}_${digest}`;
}

/**
 * Archiva la evaluación vigente (si existe) antes de que se reemplace, junto con su
 * evidence input vigente (si existe) — el par viaja a history/ bajo el MISMO
 * evaluationId, derivado del registro (no del input), así quedan vinculados por nombre.
 * El evidence input es opcional: las evaluaciones de backfill anteriores a este par no
 * tienen uno, y su ausencia es un hecho histórico, no una falla — se archiva solo el
 * registro, sin lanzar. history/ es inmutable.
 */
export async function archiveExistingEvaluation(rootDir, candidateId) {
  const currentPath = evaluationFilePath(rootDir, candidateId);
  let existing;
  try {
    existing = JSON.parse(await readFile(currentPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return { archived: false };
    throw error;
  }
  const id = evaluationId(existing);
  const historyDir = path.join(rootDir, "evaluations", "history", candidateId);
  await mkdir(historyDir, { recursive: true });
  const historyPath = path.join(historyDir, `${id}.evaluation.json`);
  try {
    await writeFile(historyPath, JSON.stringify(existing, null, 2) + "\n", { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new Error(
        `No se puede archivar la evaluación: ya existe una entrada en history/ con el mismo evaluationId (${id}) — el histórico es inmutable, nunca se sobrescribe.`
      );
    }
    throw error;
  }

  let existingEvidenceInput;
  try {
    existingEvidenceInput = JSON.parse(await readFile(evidenceInputFilePath(rootDir, candidateId), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return { archived: true, historyPath };
    throw error;
  }
  const evidenceHistoryPath = path.join(historyDir, `${id}.evidence.json`);
  try {
    await writeFile(evidenceHistoryPath, JSON.stringify(existingEvidenceInput, null, 2) + "\n", { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new Error(
        `No se puede archivar el evidence input: ya existe una entrada en history/ con el mismo evaluationId (${id}) — el histórico es inmutable, nunca se sobrescribe.`
      );
    }
    throw error;
  }
  return { archived: true, historyPath, evidenceHistoryPath };
}

/**
 * Archiva la versión vigente (si hay) y escribe la nueva evaluación como la vigente.
 * `options.evidenceInput`, si viene, se persiste como el evidence input vigente del
 * candidato (junto al registro) — el insumo completo detrás del score, recomputable y
 * auditable. `decide` llama sin `options.evidenceInput`: la decisión no regenera
 * evidencia, el input vigente queda intacto.
 */
export async function writeEvaluationRecord(rootDir, evaluationRecord, options = {}) {
  await archiveExistingEvaluation(rootDir, evaluationRecord.candidate.id);
  const evaluationsDir = path.join(rootDir, "evaluations");
  await mkdir(evaluationsDir, { recursive: true });
  const filePath = evaluationFilePath(rootDir, evaluationRecord.candidate.id);
  await writeFile(filePath, JSON.stringify(evaluationRecord, null, 2) + "\n", "utf8");
  if (options.evidenceInput != null) {
    await writeFile(
      evidenceInputFilePath(rootDir, evaluationRecord.candidate.id),
      JSON.stringify(options.evidenceInput, null, 2) + "\n",
      "utf8"
    );
  }
  return { filePath };
}
