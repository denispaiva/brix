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
