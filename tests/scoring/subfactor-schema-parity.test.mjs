import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { validateSubfactorRecord } from '../../packages/cli/scoring/lib/subfactor-contract.mjs';

// Paridad entre el schema del contrato de subfactor y su espejo manual
// (lib/subfactor-contract.mjs), que es el que usa el motor. Brix no tiene
// dependencias, así que en vez de un validador genérico de JSON Schema este test
// evalúa solo las keywords que el schema usa hoy. Una keyword nueva hace fallar
// el test a propósito: hay que soportarla acá y reflejarla en el espejo.

const SCHEMA_PATH = path.join(
  import.meta.dirname,
  '..',
  '..',
  'packages',
  'cli',
  'scoring',
  'subfactor-evidence.schema.json',
);
const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));

const SUPPORTED_KEYWORDS = new Set([
  '$schema',
  '$comment',
  'title',
  'type',
  'required',
  'properties',
  'enum',
  'const',
  'minimum',
  'maximum',
  'minLength',
  'items',
  'minItems',
  'allOf',
  'if',
  'then',
]);

function jsonType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function schemaAccepts(node, value) {
  for (const keyword of Object.keys(node)) {
    if (!SUPPORTED_KEYWORDS.has(keyword))
      throw new Error(
        `keyword no soportada por el test de paridad: ${keyword}`,
      );
  }
  if (node.type && ![node.type].flat().includes(jsonType(value))) return false;
  if (node.enum && !node.enum.includes(value)) return false;
  if ('const' in node && node.const !== value) return false;
  if (typeof value === 'string' && value.length < (node.minLength ?? 0))
    return false;
  if (typeof value === 'number') {
    if (node.minimum !== undefined && value < node.minimum) return false;
    if (node.maximum !== undefined && value > node.maximum) return false;
  }
  if (Array.isArray(value)) {
    if (value.length < (node.minItems ?? 0)) return false;
    if (node.items && !value.every((item) => schemaAccepts(node.items, item)))
      return false;
  }
  if (jsonType(value) === 'object') {
    for (const key of node.required ?? []) if (!(key in value)) return false;
    for (const [key, child] of Object.entries(node.properties ?? {}))
      if (key in value && !schemaAccepts(child, value[key])) return false;
  }
  for (const child of node.allOf ?? [])
    if (!schemaAccepts(child, value)) return false;
  if (node.if && schemaAccepts(node.if, value) && node.then)
    return schemaAccepts(node.then, value);
  return true;
}

// Valores por propiedad: uno válido, los bordes y los inválidos que alguna vez
// separaron al schema del espejo. ABSENT deja la propiedad fuera del registro.
const ABSENT = Symbol('absent');
const DIMENSIONS = {
  id: ['a', '', ABSENT, 5],
  availability: ['available', 'unavailable', 'x', ABSENT],
  score: [ABSENT, null, 0, 100, -1, 101, '50'],
  method: [ABSENT, 'metric', 'rubric', 'x'],
  rationale: [ABSENT, 'r', ''],
  evidenceRefs: [ABSENT, ['e'], [], [5]],
  assessor: [ABSENT, { type: 'human' }, null, { type: 'x' }, { version: 1 }],
};

function* records(keys = Object.keys(DIMENSIONS), partial = {}) {
  if (keys.length === 0) {
    yield partial;
    return;
  }
  const [key, ...rest] = keys;
  for (const value of DIMENSIONS[key])
    yield* records(
      rest,
      value === ABSENT ? partial : { ...partial, [key]: value },
    );
}

test('el schema y el espejo aceptan y rechazan exactamente los mismos registros', () => {
  const divergences = [];
  let total = 0;
  for (const record of records()) {
    total += 1;
    const bySchema = schemaAccepts(schema, record);
    const { valid, errors } = validateSubfactorRecord(record, 'factor');
    if (bySchema !== valid)
      divergences.push(
        `${JSON.stringify(record)}: schema ${bySchema ? 'acepta' : 'rechaza'}, espejo ${valid ? 'acepta' : 'rechaza'} (${errors.join('; ')})`,
      );
  }
  assert.ok(total > 20000, `la matriz quedó chica: ${total} registros`);
  assert.deepEqual(divergences.slice(0, 10), [], `${divergences.length} divergencias`);
});

test('un registro unavailable sin method es válido (regresión de la Tarea 9 del precursor)', () => {
  const record = { id: 'x', availability: 'unavailable' };
  assert.equal(schemaAccepts(schema, record), true);
  assert.equal(validateSubfactorRecord(record, 'f').valid, true);
});

test('rubric exige rationale, evidenceRefs y assessor aun si el subfactor es unavailable', () => {
  const record = { id: 'x', availability: 'unavailable', method: 'rubric' };
  assert.equal(schemaAccepts(schema, record), false);
  const { errors } = validateSubfactorRecord(record, 'f');
  assert.ok(errors.some((error) => error.includes('rubric exige rationale')));
  assert.ok(errors.some((error) => error.includes('rubric exige evidenceRefs')));
  assert.ok(errors.some((error) => error.includes('rubric exige assessor')));
});

test('el evaluador del test rechaza keywords que no soporta', () => {
  assert.throws(
    () => schemaAccepts({ pattern: '^a' }, 'a'),
    /keyword no soportada/,
  );
});
