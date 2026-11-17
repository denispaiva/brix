import { test } from 'node:test';
import assert from 'node:assert/strict';

import { runEvaluation } from '../../packages/cli/scoring/engine.mjs';

/**
 * Comunidad no disponible. Con el cupo anónimo de la API de GitHub agotado y sin
 * snapshot para reutilizar, el motor dejaba community en null sin ninguna marca: el
 * puntaje y la recomendación cambiaban en silencio. Ahora deja una nota y, con
 * `requireCommunity` (lo que hace el CLI salvo --offline o --allow-missing-community),
 * falla. El collector recibe un fetch inyectado: estas pruebas no tocan la red.
 */

const POLICY = {
  formulaVersion: '1.6.0',
  globalWeights: {
    community: 0.5,
    maintenance: 0,
    security: 0,
    fit: 0.5,
    engineering: 0,
    sustainability: 0,
  },
  community: {
    anchors: { starsReference: 1, contributorsReference: 1, forksReference: 1 },
    subfactorWeights: { stars: 1, contributors: 0, forks: 0 },
  },
  maintenance: { subfactorWeights: { activityRecency: 1 } },
  security: { subfactorWeights: { vulnerabilityStatus: 1 } },
  fit: { subfactorWeights: { capabilityGapCoverage: 1 } },
  engineering: { subfactorWeights: { automatedVerification: 1 } },
  sustainability: { subfactorWeights: { costPredictability: 1 } },
  confidenceWeights: {
    evidenceCoverage: 1,
    sourceReliability: 0,
    evidenceFreshness: 0,
    evidenceConsistency: 0,
  },
  confidenceDerivation: {
    freshnessBands: [{ maxDays: 180, score: 100 }],
    consistencyStates: { clean: 100, minor: 70 },
  },
  confidenceBands: { high: 80, medium: 50 },
  recommendationThresholds: { advance: 75, advanceWithReservations: 60 },
  review: { ordinaryDays: 90, earlyReviewDays: 30 },
  risk: { flagLevels: {} },
};

const NOW = new Date('2026-11-17T00:00:00Z');

function evidence(sourceUrl = 'https://github.com/acme/tool') {
  return {
    candidate: {
      id: 'community-fixture',
      type: 'skill',
      sourceUrl,
      evaluatedRef: 'v1',
    },
    factors: {
      maintenance: [],
      security: [],
      fit: [
        {
          id: 'capabilityGapCoverage',
          availability: 'available',
          score: 80,
          method: 'metric',
        },
      ],
      engineering: [],
      sustainability: [],
    },
    confidenceInputs: { sourceReliability: 90 },
    riskFlags: {},
  };
}

const rateLimited = async () =>
  new Response('{}', {
    status: 403,
    headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '0' },
  });

const notFound = async () => new Response('{}', { status: 404 });

const available = async (url) =>
  url.includes('/contributors')
    ? new Response(JSON.stringify([{}, {}]), { status: 200 })
    : new Response(
        JSON.stringify({
          full_name: 'acme/tool',
          stargazers_count: 10,
          forks_count: 2,
        }),
        { status: 200 },
      );

const options = (fetchImpl, extra = {}) => ({
  now: NOW,
  fetchImpl,
  token: null,
  ...extra,
});

test('con requireCommunity, un collector rate_limited sin snapshot para reutilizar falla', async () => {
  await assert.rejects(
    runEvaluation(
      evidence(),
      POLICY,
      options(rateLimited, { requireCommunity: true }),
    ),
    /comunidad no disponible.*rate_limited.*--allow-missing-community/s,
  );
});

test('con requireCommunity, un repositorio inexistente (not_found) también falla', async () => {
  await assert.rejects(
    runEvaluation(
      evidence(),
      POLICY,
      options(notFound, { requireCommunity: true }),
    ),
    /not_found/,
  );
});

test('sin requireCommunity, community queda unavailable pero con nota', async () => {
  const record = await runEvaluation(evidence(), POLICY, options(rateLimited));
  assert.equal(record.factorScores.community, null);
  assert.match(record.communityEvidenceNote, /rate_limited/);
  assert.match(record.communityEvidenceNote, /queda unavailable/);
});

test('con requireCommunity, un snapshot vigente reutilizado evita el fallo', async () => {
  const currentEvidenceInput = {
    communitySnapshot: {
      state: 'available',
      counts: { stars: 10, forks: 2, contributors: 2 },
      contributorsState: 'available',
      sourceUrl: 'https://github.com/acme/tool',
      observedAt: '2026-11-01T00:00:00.000Z',
    },
  };
  const record = await runEvaluation(
    evidence(),
    POLICY,
    options(rateLimited, { requireCommunity: true, currentEvidenceInput }),
  );
  assert.notEqual(record.factorScores.community, null);
  assert.match(record.communityEvidenceNote, /reutilizado/);
});

test('con requireCommunity, una fuente que no es de GitHub no exige comunidad', async () => {
  const record = await runEvaluation(
    evidence('https://example.com/tool'),
    POLICY,
    options(rateLimited, { requireCommunity: true }),
  );
  assert.equal(record.factorScores.community, null);
  assert.equal(record.communityEvidenceNote, null);
});

test('con requireCommunity y el collector disponible, community tiene puntaje', async () => {
  const record = await runEvaluation(
    evidence(),
    POLICY,
    options(available, { requireCommunity: true }),
  );
  assert.notEqual(record.factorScores.community, null);
  assert.equal(record.communityEvidenceNote, null);
});
