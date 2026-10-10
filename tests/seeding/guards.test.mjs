// vc/brix/tests/seeding/guards.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkTarget } from '../../packages/cli/seeding/lib/guards.mjs';

const driver = {
  targets: { emulator: { mode: 'autonomous' }, 'dev-x': { mode: 'conducted' } },
};
const emuEnv = {
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
};

test('emulator con variables definidas pasa', () => {
  assert.deepEqual(checkTarget({ driver, target: 'emulator', env: emuEnv }), {
    ok: true,
    mode: 'autonomous',
    errors: [],
  });
});
test('emulator sin variables falla y dice cuál', () => {
  const r = checkTarget({ driver, target: 'emulator', env: {} });
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /FIRESTORE_EMULATOR_HOST/);
  assert.match(r.errors.join('\n'), /FIREBASE_AUTH_EMULATOR_HOST/);
});
test('dev-x con variables de emulador definidas falla: escribiría en el emulador creyendo escribir en la nube', () => {
  const r = checkTarget({ driver, target: 'dev-x', env: emuEnv, isTTY: true });
  assert.match(r.errors.join('\n'), /creyendo escribir en la nube/);
});
test('dev-x sin TTY ni cmdDir falla', () => {
  const r = checkTarget({ driver, target: 'dev-x', env: {}, isTTY: false });
  assert.match(
    r.errors.join('\n'),
    /modo conducido exige una terminal interactiva o --cmd-dir/,
  );
});
test('dev-x con TTY pasa; con cmdDir también', () => {
  assert.equal(
    checkTarget({ driver, target: 'dev-x', env: {}, isTTY: true }).ok,
    true,
  );
  assert.equal(
    checkTarget({
      driver,
      target: 'dev-x',
      env: {},
      isTTY: false,
      cmdDir: '/tmp/x',
    }).ok,
    true,
  );
});
test('target que el driver no declara falla; target con prod falla aunque el driver lo declare', () => {
  assert.match(
    checkTarget({ driver, target: 'staging', env: {} }).errors[0],
    /no lo declara el driver/,
  );
  const bad = { targets: { 'prod-x': { mode: 'conducted' } } };
  assert.match(
    checkTarget({ driver: bad, target: 'prod-x', env: {}, isTTY: true })
      .errors[0],
    /ningún target puede contener "prod"/,
  );
});
