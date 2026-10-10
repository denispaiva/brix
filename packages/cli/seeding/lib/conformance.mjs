// Lo que todo driver debe cumplir antes de que el runner lo use. Corre en
// memoria o con fetch simulado: nunca necesita red.
import { assertDriver } from './driver-contract.mjs';
import { assertNoTokens } from './manifest.mjs';

export async function runConformance(createDriver, { target }) {
  const failures = [];
  let driver;
  try {
    driver = assertDriver(createDriver({ target, log: () => {} }));
  } catch (e) {
    return { ok: false, failures: [e.message] };
  }

  for (const t of Object.keys(driver.targets))
    if (/prod/i.test(t))
      failures.push(
        `targets contiene "${t}": ningún target puede contener "prod"`,
      );
  for (const [t, decl] of Object.entries(driver.targets))
    if (!['autonomous', 'conducted'].includes(decl?.mode))
      failures.push(`target "${t}" sin mode autonomous|conducted`);
  const caps = driver.capabilities();
  for (const need of [
    'create_event',
    'join',
    'host_transition',
    'play',
    'resolve_code',
  ])
    if (!caps.includes(need))
      failures.push(`capabilities no incluye "${need}"`);

  const runId = 'seed-conformance';
  let host;
  try {
    host = await driver.mint({
      kind: 'host',
      id: 'host',
      alias: 'Host',
      runId,
    });
    try {
      assertNoTokens(host, 'mint');
    } catch (e) {
      failures.push(
        `mint devolvió una credencial (${e.message.split('.').pop().split(':')[0].trim()})`,
      );
    }
    if (!host?.uid) failures.push('mint no devolvió uid');
    if (!Array.isArray(host?.roots)) failures.push('mint no devolvió roots');
  } catch (e) {
    failures.push(`mint lanzó: ${e.message}`);
  }

  const actor = {
    id: 'host',
    kind: 'host',
    uid: host?.uid,
    alias: 'Host',
    profile: 'steady',
    index: 0,
    plays: true,
    standInFor: 'host',
  };
  let created;
  try {
    created = await driver.op(
      'create_event',
      actor,
      { participant_limit: 2, wine_count: 2, host_plays: true },
      { runId },
    );
    if (!created?.ok)
      failures.push(`create_event no devolvió ok: ${created?.error}`);
    if (!created?.roots?.some((r) => r.type === 'event'))
      failures.push('create_event no devolvió una raíz de tipo event');
  } catch (e) {
    failures.push(`create_event lanzó: ${e.message}`);
  }

  const manifest = {
    roots: [...(host?.roots ?? []), ...(created?.roots ?? [])],
  };
  try {
    const r = await driver.delete(
      [{ type: 'event', ref: 'events/no-esta-en-el-manifiesto' }],
      manifest,
    );
    if (r.deleted.length)
      failures.push('delete borró una ref que no está en el manifiesto');
    if (!r.failed.length)
      failures.push('delete no reportó la ref rechazada en failed');
  } catch (e) {
    failures.push(
      `delete lanzó con una ref fuera del manifiesto: ${e.message}`,
    );
  }
  try {
    const r = await driver.delete(manifest.roots, manifest);
    if (r.deleted.length !== manifest.roots.length)
      failures.push(
        `delete no borró todas las raíces del manifiesto (${r.deleted.length}/${manifest.roots.length})`,
      );
  } catch (e) {
    failures.push(`delete lanzó con las raíces del manifiesto: ${e.message}`);
  }

  return { ok: failures.length === 0, failures };
}
