// vc/brix/tests/seeding/driver-contract.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertDriver,
  loadDriver,
} from '../../packages/cli/seeding/lib/driver-contract.mjs';
import { createDriver } from '../../packages/cli/seeding/lib/fake-driver.mjs';
import { runConformance } from '../../packages/cli/seeding/lib/conformance.mjs';

test('assertDriver lista lo que falta', () => {
  assert.throws(
    () => assertDriver({ name: 'x' }),
    /faltan: targets, capabilities, preflight, mint, op, read, truth, delete/,
  );
  assert.doesNotThrow(() => assertDriver(createDriver({ target: 'emulator' })));
});

test('loadDriver exige --driver cuando no hay ruta', async () => {
  await assert.rejects(
    loadDriver({ name: 'teyst', cwd: '/' }),
    /--driver <ruta>/,
  );
});

test('el driver falso pasa la conformidad', async () => {
  assert.deepEqual(await runConformance(createDriver, { target: 'emulator' }), {
    ok: true,
    failures: [],
  });
});

test('la conformidad rechaza un driver que filtra tokens en mint', async () => {
  const leaky = (opts) => {
    const d = createDriver(opts);
    const mint = d.mint;
    d.mint = async (a) => ({ ...(await mint(a)), idToken: 'x' });
    return d;
  };
  assert.match(
    (await runConformance(leaky, { target: 'emulator' })).failures.join('\n'),
    /mint devolvió una credencial \(idToken\)/,
  );
});

test('la conformidad rechaza targets con prod y delete fuera del manifiesto', async () => {
  const prod = (opts) => {
    const d = createDriver(opts);
    d.targets = { ...d.targets, 'prod-x': { mode: 'conducted' } };
    return d;
  };
  assert.match(
    (await runConformance(prod, { target: 'emulator' })).failures.join('\n'),
    /targets contiene "prod-x"/,
  );
  const sloppy = (opts) => {
    const d = createDriver(opts);
    d.delete = async (roots) => ({
      deleted: roots.map((r) => r.ref),
      failed: [],
    });
    return d;
  };
  assert.match(
    (await runConformance(sloppy, { target: 'emulator' })).failures.join('\n'),
    /delete borró una ref que no está en el manifiesto/,
  );
});

test('el driver falso: el anfitrión que juega es participante y resolve_code simula un evento creado por una persona', async () => {
  const d = createDriver({ target: 'dev-x' });
  const host = await d.mint({
    kind: 'host',
    id: 'host',
    alias: 'H',
    runId: 'r',
  });
  const created = await d.op(
    'create_event',
    { ...host, kind: 'host', id: 'host' },
    { participant_limit: 5, wine_count: 4, host_plays: true },
    { runId: 'r' },
  );
  assert.equal(
    await d.read('participants', { event: created.result.event }),
    1,
  );
  const resolved = await d.op(
    'resolve_code',
    null,
    { code: 'ABCD' },
    { runId: 'r' },
  );
  assert.equal(resolved.result.event, 'events/ABCD');
  assert.equal(await d.read('participants', { event: 'events/ABCD' }), 0);
});

test('el driver falso: el código de un evento creado lo reconoce resolve_code', async () => {
  const d = createDriver({ target: 'emulator' });
  const host = await d.mint({
    kind: 'host',
    id: 'host',
    alias: 'H',
    runId: 'r',
  });
  const created = await d.op(
    'create_event',
    { ...host, kind: 'host', id: 'host' },
    { participant_limit: 5, wine_count: 4 },
    { runId: 'r' },
  );
  const resolved = await d.op(
    'resolve_code',
    null,
    { code: created.result.code },
    { runId: 'r' },
  );
  assert.equal(resolved.result.event, created.result.event);
  assert.equal(d._db.events.size, 1);
});
