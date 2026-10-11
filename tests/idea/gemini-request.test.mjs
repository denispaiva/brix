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
