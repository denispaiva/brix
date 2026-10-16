import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGeminiRequest,
  GEMINI_MODEL,
} from '../../packages/cli/src/commands/idea.js';

test('la clave viaja en el encabezado y nunca en la URL', () => {
  const { url, init } = buildGeminiRequest('clave-de-prueba', 'hola');
  assert.equal(init.headers['x-goog-api-key'], 'clave-de-prueba');
  assert.ok(!url.includes('clave-de-prueba'));
  assert.ok(!url.includes('key='));
});

test('usa el modelo recomendado y no el de segunda línea', () => {
  const { url } = buildGeminiRequest('k', 'hola');
  assert.equal(GEMINI_MODEL, 'gemini-3.8-flash');
  assert.ok(url.includes(`/models/${GEMINI_MODEL}:generateContent`));
});

test('el cuerpo lleva el prompt tal cual', () => {
  const { init } = buildGeminiRequest('k', 'notas del proyecto');
  assert.deepEqual(JSON.parse(init.body), {
    contents: [{ parts: [{ text: 'notas del proyecto' }] }],
  });
});

test('el prompt incluye las notas y no pide ni propone tecnología', async () => {
  const { buildPrompt } =
    await import('../../packages/cli/src/commands/idea.js');
  const prompt = buildPrompt('quiero una app de catas', 'Nombre de repo');
  assert.ok(prompt.includes('quiero una app de catas'));
  assert.ok(prompt.includes('No propongas tecnologías'));
  assert.ok(!prompt.includes('Arquitectura y Stack'));
  assert.ok(!prompt.includes('Firebase'));
  assert.ok(prompt.includes('## Restricciones y Riesgos de Viabilidad'));
  assert.ok(prompt.includes('## Preguntas Asesinas Pendientes'));
  assert.ok(prompt.includes('## Estrategia de Graduación (Nombre de repo)'));
});

const respuesta = (status) => ({ status, ok: status >= 200 && status < 300 });

function simular(estados, opts = {}) {
  const llamadas = [];
  const esperas = [];
  const fetchImpl = async () => {
    llamadas.push(1);
    return respuesta(estados[Math.min(llamadas.length, estados.length) - 1]);
  };
  const sleep = async (ms) => {
    esperas.push(ms);
  };
  return { llamadas, esperas, opts: { fetchImpl, sleep, ...opts } };
}

test('reintenta un 503 con espera creciente y termina en 200', async () => {
  const { fetchWithRetry } =
    await import('../../packages/cli/src/commands/idea.js');
  const s = simular([503, 503, 200]);
  const r = await fetchWithRetry('u', {}, s.opts);
  assert.equal(r.status, 200);
  assert.equal(s.llamadas.length, 3);
  assert.deepEqual(s.esperas, [2000, 4000]);
});

test('reintenta un 429', async () => {
  const { fetchWithRetry } =
    await import('../../packages/cli/src/commands/idea.js');
  const s = simular([429, 200]);
  const r = await fetchWithRetry('u', {}, s.opts);
  assert.equal(r.status, 200);
  assert.equal(s.llamadas.length, 2);
});

test('no reintenta errores que no son transitorios', async () => {
  const { fetchWithRetry } =
    await import('../../packages/cli/src/commands/idea.js');
  for (const estado of [400, 403, 404]) {
    const s = simular([estado]);
    const r = await fetchWithRetry('u', {}, s.opts);
    assert.equal(r.status, estado);
    assert.equal(s.llamadas.length, 1);
    assert.deepEqual(s.esperas, []);
  }
});

test('al agotar los reintentos devuelve la última respuesta', async () => {
  const { fetchWithRetry } =
    await import('../../packages/cli/src/commands/idea.js');
  const s = simular([503], { retries: 2 });
  const r = await fetchWithRetry('u', {}, s.opts);
  assert.equal(r.status, 503);
  assert.equal(s.llamadas.length, 3);
  assert.deepEqual(s.esperas, [2000, 4000]);
});

test('avisa cada reintento por onRetry', async () => {
  const { fetchWithRetry } =
    await import('../../packages/cli/src/commands/idea.js');
  const avisos = [];
  const s = simular([503, 200], { onRetry: (a) => avisos.push(a) });
  await fetchWithRetry('u', {}, s.opts);
  assert.deepEqual(avisos, [
    { attempt: 1, retries: 3, status: 503, delayMs: 2000 },
  ]);
});
