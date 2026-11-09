import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { discoverLedgers } from '../../packages/cli/finops/engine.mjs';

// Layout de una instancia tipo: portfolio en vc/ y framework con costo compartido.
const OPTIONS = { portfolioDir: 'vc', excludeDirs: ['framework'] };

async function makeFixtureRepo(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'discover-ledgers-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'vc', 'finops'), { recursive: true });
  await writeFile(
    path.join(root, 'vc', 'finops', 'billing-ledger.json'),
    '{}',
    'utf8',
  );
  // proyecto A: tiene .roadmap.json Y finops/billing-ledger.json
  await mkdir(path.join(root, 'vc', 'proyecto-a', 'finops'), {
    recursive: true,
  });
  await writeFile(
    path.join(root, 'vc', 'proyecto-a', '.roadmap.json'),
    '{}',
    'utf8',
  );
  await writeFile(
    path.join(root, 'vc', 'proyecto-a', 'finops', 'billing-ledger.json'),
    '{}',
    'utf8',
  );
  // proyecto B: tiene .roadmap.json pero SIN finops/
  await mkdir(path.join(root, 'vc', 'proyecto-b'), { recursive: true });
  await writeFile(
    path.join(root, 'vc', 'proyecto-b', '.roadmap.json'),
    '{}',
    'utf8',
  );
  // vc/docs: NO es un proyecto (sin .roadmap.json) — no debe aparecer
  await mkdir(path.join(root, 'vc', 'docs'), { recursive: true });
  // vc/framework: TIENE .roadmap.json, pero se excluye siempre (su costo es el compartido)
  await mkdir(path.join(root, 'vc', 'framework'), { recursive: true });
  await writeFile(
    path.join(root, 'vc', 'framework', '.roadmap.json'),
    '{}',
    'utf8',
  );
  return root;
}

test('discoverLedgers: encuentra el ledger compartido de vc/finops/', async (t) => {
  const root = await makeFixtureRepo(t);
  const { shared } = await discoverLedgers(root, OPTIONS);
  assert.equal(shared, path.join(root, 'vc', 'finops', 'billing-ledger.json'));
});

test('discoverLedgers: un proyecto con finops/ aparece con su path', async (t) => {
  const root = await makeFixtureRepo(t);
  const { projects } = await discoverLedgers(root, OPTIONS);
  const a = projects.find((p) => p.project === 'proyecto-a');
  assert.equal(
    a.path,
    path.join(root, 'vc', 'proyecto-a', 'finops', 'billing-ledger.json'),
  );
});

test('discoverLedgers: un proyecto SIN finops/ aparece con path null', async (t) => {
  const root = await makeFixtureRepo(t);
  const { projects } = await discoverLedgers(root, OPTIONS);
  const b = projects.find((p) => p.project === 'proyecto-b');
  assert.equal(b.path, null);
});

test('discoverLedgers: vc/framework nunca aparece en projects (su costo es el ledger compartido)', async (t) => {
  const root = await makeFixtureRepo(t);
  const { projects } = await discoverLedgers(root, OPTIONS);
  assert.equal(
    projects.find((p) => p.project === 'framework'),
    undefined,
  );
});

test('discoverLedgers: vc/docs (sin .roadmap.json) no aparece en projects', async (t) => {
  const root = await makeFixtureRepo(t);
  const { projects } = await discoverLedgers(root, OPTIONS);
  assert.equal(
    projects.find((p) => p.project === 'docs'),
    undefined,
  );
});

test('discoverLedgers: sin portfolioDir falla con un mensaje que lo nombra', async (t) => {
  const root = await makeFixtureRepo(t);
  await assert.rejects(discoverLedgers(root), /portfolioDir/);
});

test('discoverLedgers: sin excludeDirs, framework con .roadmap.json cuenta como proyecto', async (t) => {
  const root = await makeFixtureRepo(t);
  const { projects } = await discoverLedgers(root, { portfolioDir: 'vc' });
  assert.ok(projects.find((p) => p.project === 'framework'));
});
