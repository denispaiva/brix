// vc/brix/packages/cli/seeding/lib/manifest.mjs
// El manifiesto es la única memoria de una corrida: qué actores se acuñaron,
// qué raíces se crearon (para `clean`) y qué pasó en cada paso. Vive fuera
// del repo y nunca contiene tokens: saveManifest lo verifica antes de escribir.
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

const TOKEN_KEY = /token|secret|bearer|password|jwt/i;

export function newRunId(now = new Date(), rand = Math.random) {
  const iso = now.toISOString();
  const date = iso.slice(0, 10).replaceAll('-', '');
  const time = iso.slice(11, 19).replaceAll(':', '');
  const hex = Math.floor(rand() * 0x10000)
    .toString(16)
    .padStart(4, '0');
  return `seed-${date}-${time}-${hex}`;
}

export const shortRunId = (runId) => runId.slice(-4);

export function createManifest({
  runId,
  scenario,
  scenarioHash,
  driver,
  target,
  mode,
  seed,
}) {
  return {
    schemaVersion: 1,
    run_id: runId,
    scenario: { id: scenario.id, hash: scenarioHash },
    driver,
    target,
    mode,
    seed,
    started_at: new Date().toISOString(),
    finished_at: null,
    outcome: null,
    actors: [],
    roots: [],
    steps: [],
    degradations: [],
    cleaned_at: null,
    cleanup: null,
  };
}

export function addActor(m, actor) {
  m.actors.push(actor);
}
export function addRoots(m, roots, step) {
  for (const r of roots ?? []) m.roots.push({ ...r, step });
}
export function logStep(m, entry) {
  m.steps.push({ at: new Date().toISOString(), ...entry });
}
export function finish(m, outcome) {
  m.outcome = outcome;
  m.finished_at = new Date().toISOString();
}

export function assertNoTokens(value, trail = 'manifest') {
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertNoTokens(v, `${trail}[${i}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (TOKEN_KEY.test(k))
        throw new Error(
          `${trail}.${k}: el manifiesto no puede contener credenciales`,
        );
      assertNoTokens(v, `${trail}.${k}`);
    }
  }
}

export function manifestDir(env = process.env) {
  return (
    env.BRIX_SEED_DIR || path.join(env.HOME || homedir(), '.brix', 'seed-runs')
  );
}

export async function saveManifest(m, dir) {
  assertNoTokens(m);
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, `${m.run_id}.json`),
    JSON.stringify(m, null, 2) + '\n',
    'utf8',
  );
  return path.join(dir, `${m.run_id}.json`);
}

export async function loadManifest(runId, dir) {
  return JSON.parse(await readFile(path.join(dir, `${runId}.json`), 'utf8'));
}

export async function listManifests(dir) {
  let files = [];
  try {
    files = (await readdir(dir)).filter(
      (f) => f.startsWith('seed-') && f.endsWith('.json'),
    );
  } catch {
    return [];
  }
  const all = await Promise.all(
    files.map((f) => readFile(path.join(dir, f), 'utf8').then(JSON.parse)),
  );
  return all.sort((a, b) => (a.started_at < b.started_at ? 1 : -1));
}
