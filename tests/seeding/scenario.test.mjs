// vc/brix/tests/seeding/scenario.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateScenario } from '../../packages/cli/seeding/lib/scenario.mjs';
import { minimalScenario, fakeDriverShape } from './helpers/scenarios.mjs';

test('acepta el escenario mínimo v2', () => {
  assert.deepEqual(validateScenario(minimalScenario()), {
    ok: true,
    errors: [],
  });
});

test('rechaza schemaVersion distinto de 2', () => {
  const r = validateScenario({ ...minimalScenario(), schemaVersion: 1 });
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /schemaVersion/);
});

test('un paso manual solo puede tener como actor una cuenta real o "accounts"', () => {
  const s = minimalScenario();
  s.steps.push({ actor: 'bots', op: 'manual', do: 'x' });
  assert.match(
    validateScenario(s).errors.join('\n'),
    /paso 3: manual exige una cuenta de accounts o "accounts"/,
  );
  s.steps[2] = {
    actor: 'accounts',
    op: 'manual',
    do: 'Votar',
    auto: { op: 'play' },
  };
  assert.equal(validateScenario(s).ok, true);
});

test('un paso automático no puede tener como actor una cuenta real', () => {
  const s = minimalScenario();
  s.steps.push({ actor: 'host', op: 'join' });
  assert.match(
    validateScenario(s).errors.join('\n'),
    /paso 3: la cuenta real "host" solo actúa en pasos manual/,
  );
});

test('entre bots y suplentes hay a lo sumo un host', () => {
  const s = minimalScenario();
  s.bots.push({ id: 'otro-host', kind: 'host', profile: 'steady' });
  assert.match(
    validateScenario(s).errors.join('\n'),
    /a lo sumo un host entre bots y suplentes/,
  );
});

test('con target autónomo, todo paso manual necesita auto y toda cuenta necesita standIn', () => {
  const s = minimalScenario();
  s.steps[0] = { actor: 'host', op: 'manual', do: 'Crear el evento' };
  const r = validateScenario(s, {
    driver: fakeDriverShape(),
    target: 'emulator',
  });
  assert.match(
    r.errors.join('\n'),
    /paso 1: manual sin auto no puede correr en el target autónomo "emulator"/,
  );
  const t = minimalScenario();
  delete t.accounts[0].standIn;
  assert.match(
    validateScenario(t, {
      driver: fakeDriverShape(),
      target: 'emulator',
    }).errors.join('\n'),
    /cuenta "host" sin standIn no puede correr en el target autónomo "emulator"/,
  );
});

test('auto.op tiene que poder ejecutarla el suplente de la cuenta', () => {
  const s = minimalScenario();
  s.steps[0].auto = { op: 'join' }; // host no puede join
  assert.match(
    validateScenario(s).errors.join('\n'),
    /paso 1: auto.op "join" no la puede ejecutar un host/,
  );
});

test('captures solo en pasos manual, y con target conducido exige resolve_code en el driver', () => {
  const s = minimalScenario();
  s.steps[1].captures = 'event_code';
  assert.match(
    validateScenario(s).errors.join('\n'),
    /paso 2: captures solo admite "event_code" en pasos manual/,
  );
  const d = fakeDriverShape();
  const caps = d.capabilities();
  d.capabilities = () => caps.filter((c) => c !== 'resolve_code');
  const u = minimalScenario();
  assert.match(
    validateScenario(u, { driver: d, target: 'dev-x' }).errors.join('\n'),
    /paso 1: captures exige que el driver implemente resolve_code/,
  );
});

test('rechaza ops que el driver no declara y targets que no tiene', () => {
  const s = minimalScenario();
  s.targets.push('staging');
  s.steps.push({ actor: 'bots', op: 'teleport' });
  const text = validateScenario(s, { driver: fakeDriverShape() }).errors.join(
    '\n',
  );
  assert.match(text, /op "teleport" no existe en el contrato/);
  assert.match(text, /target "staging" no lo declara el driver/);
});
