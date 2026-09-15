import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolveRoots } from '../../packages/cli/scoring/engine.mjs';

/**
 * resolveRoots decide policyPath/toolingRoot/narrativeDocPath con la misma
 * disciplina que el resto del CLI (parametrización del layout, ver
 * docs/lifecycle/decoupling-brix.md): flag de línea de comandos > brix.config.json
 * del proyecto que invoca > default embebido en el paquete. Sin este orden, el motor
 * mudado a vc/brix/ no podría resolver la política real de blends (vc/tooling/
 * scoring-policy.json) sin volver a acoplarse a una ruta fija del monorepo.
 */

async function withTempCwd(t, setup) {
  const dir = await mkdtemp(path.join(tmpdir(), 'brix-scoring-roots-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  if (setup) await setup(dir);
  return dir;
}

test('resolveRoots: sin flag ni brix.config.json, usa la política embebida del paquete', async (t) => {
  const cwd = await withTempCwd(t);
  const roots = resolveRoots({}, { cwd });
  assert.equal(
    roots.policyPath,
    path.join(
      import.meta.dirname,
      '..',
      '..',
      'packages',
      'cli',
      'scoring',
      'default-scoring-policy.json',
    ),
  );
});

test('resolveRoots: brix.config.json del cwd fija policyPath relativo a ese cwd', async (t) => {
  const cwd = await withTempCwd(t, async (dir) => {
    await mkdir(path.join(dir, 'vc', 'tooling'), { recursive: true });
    await writeFile(
      path.join(dir, 'vc', 'tooling', 'scoring-policy.json'),
      '{}',
      'utf8',
    );
    await writeFile(
      path.join(dir, 'brix.config.json'),
      JSON.stringify({
        score: { policyPath: 'vc/tooling/scoring-policy.json' },
      }),
      'utf8',
    );
  });
  const roots = resolveRoots({}, { cwd });
  assert.equal(
    roots.policyPath,
    path.join(cwd, 'vc', 'tooling', 'scoring-policy.json'),
  );
});

test('resolveRoots: --policy en la línea de comandos gana sobre brix.config.json', async (t) => {
  const cwd = await withTempCwd(t, async (dir) => {
    await writeFile(
      path.join(dir, 'brix.config.json'),
      JSON.stringify({ score: { policyPath: 'from-config.json' } }),
      'utf8',
    );
  });
  const roots = resolveRoots({ policy: 'from-flag.json' }, { cwd });
  assert.equal(roots.policyPath, path.join(cwd, 'from-flag.json'));
});

test('resolveRoots: sin config, toolingRoot cae en el default embebido: el cwd mismo', async (t) => {
  const cwd = await withTempCwd(t);
  const roots = resolveRoots({}, { cwd });
  assert.equal(roots.toolingRoot, cwd);
});

test('resolveRoots: brix.config.json fija score.outputDir (el directorio que CONTIENE evaluations/) relativo al cwd', async (t) => {
  const cwd = await withTempCwd(t, async (dir) => {
    await writeFile(
      path.join(dir, 'brix.config.json'),
      JSON.stringify({ score: { outputDir: 'vc/tooling' } }),
      'utf8',
    );
  });
  const roots = resolveRoots({}, { cwd });
  assert.equal(roots.toolingRoot, path.join(cwd, 'vc', 'tooling'));
});

test('resolveRoots: sin narrativeDocPath en flags ni config, queda null (narrativa opcional fuera de blends)', async (t) => {
  const cwd = await withTempCwd(t);
  const roots = resolveRoots({}, { cwd });
  assert.equal(roots.narrativeDocPath, null);
});

test('resolveRoots: brix.config.json fija score.narrativeDocPath relativo al cwd', async (t) => {
  const cwd = await withTempCwd(t, async (dir) => {
    await writeFile(
      path.join(dir, 'brix.config.json'),
      JSON.stringify({
        score: { narrativeDocPath: 'vc/docs/tooling/evaluations.md' },
      }),
      'utf8',
    );
  });
  const roots = resolveRoots({}, { cwd });
  assert.equal(
    roots.narrativeDocPath,
    path.join(cwd, 'vc', 'docs', 'tooling', 'evaluations.md'),
  );
});
