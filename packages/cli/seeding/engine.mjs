// vc/brix/packages/cli/seeding/engine.mjs
// Punto de entrada del motor de sembrado (registro de decisión 0007). Brix
// sabe de escenarios, actores, pasos, corridas y limpieza; el driver sabe del
// producto. Ver docs/superpowers/specs/2026-10-06-brix-seeding-capability-design.md.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  validateScenario,
  expandSteps,
  effectiveStep,
  resolvePath,
  ACCOUNTS_ACTOR,
} from './lib/scenario.mjs';
import { materializeBots, decide } from './lib/bots.mjs';
import { checkTarget } from './lib/guards.mjs';
import {
  newRunId,
  shortRunId,
  createManifest,
  addActor,
  addRoots,
  logStep,
  finish,
  manifestDir as defaultManifestDir,
  saveManifest,
  loadManifest,
  listManifests,
} from './lib/manifest.mjs';
import { assertDriver, loadDriver } from './lib/driver-contract.mjs';
import { parseFlags } from '../src/lib/args.js';

export {
  validateScenario,
  expandSteps,
  effectiveStep,
} from './lib/scenario.mjs';
export { runConformance } from './lib/conformance.mjs';
export { assertDriver, loadDriver };

export async function loadScenario(filePath) {
  const raw = await readFile(filePath, 'utf8');
  return {
    scenario: JSON.parse(raw),
    hash: createHash('sha256').update(raw).digest('hex').slice(0, 12),
  };
}

export function planRun({ scenario, driver, target, seed }) {
  assertDriver(driver);
  const v = validateScenario(scenario, { driver, target });
  if (!v.ok)
    throw new Error(
      `escenario inválido para ${target}:\n - ${v.errors.join('\n - ')}`,
    );
  const mode = driver.targets[target].mode;
  return {
    mode,
    bots: materializeBots(scenario, { mode }),
    steps: expandSteps(scenario).map((s) => effectiveStep(s, mode)),
    seed: seed ?? scenario.seed,
  };
}

export async function runScenario(opts) {
  const {
    scenario,
    scenarioHash,
    driver,
    target,
    env = process.env,
    io = defaultIo(),
    isTTY,
    cmdDir,
    keepGoing = false,
  } = opts;
  const manifestDir = opts.manifestDir ?? defaultManifestDir(env);
  const guard = checkTarget({ driver, target, env, isTTY, cmdDir });
  if (!guard.ok)
    throw new Error(
      `no se puede correr contra ${target}:\n - ${guard.errors.join('\n - ')}`,
    );
  const plan = planRun({ scenario, driver, target, seed: opts.seed });
  const missing = await driver.preflight();
  if (missing.length)
    throw new Error(`falta antes de sembrar:\n - ${missing.join('\n - ')}`);

  const runId = opts.runId ?? newRunId();
  const m = createManifest({
    runId,
    scenario,
    scenarioHash,
    driver: driver.name,
    target,
    mode: plan.mode,
    seed: plan.seed,
  });
  const save = () => saveManifest(m, manifestDir);
  const ctx = { runId, scenario, event: null, roundIndex: -1 };
  const actors = new Map();
  const joined = new Set();

  // Acuñar todos los actores (suplentes en autónomo, bots siempre) antes del primer paso.
  for (const bot of plan.bots) {
    const alias =
      bot.kind === 'host'
        ? `Host-${shortRunId(runId)}`
        : `Bot-${shortRunId(runId)}-${bot.index}`;
    let minted;
    try {
      minted = await driver.mint({
        kind: bot.kind,
        id: bot.id,
        alias,
        runId,
      });
    } catch (e) {
      // Lo ya acuñado quedó guardado tras cada mint: que `clean` pueda encontrarlo.
      finish(m, 'aborted');
      await save();
      throw new Error(`acuñando ${bot.id}: ${e.message}`, { cause: e });
    }
    const actor = { ...bot, uid: minted.uid, alias: minted.alias ?? alias };
    actors.set(bot.id, actor);
    addActor(m, {
      id: actor.id,
      group: actor.group,
      kind: actor.kind,
      uid: actor.uid,
      alias: actor.alias,
      profile: actor.profile,
      standInFor: actor.standInFor,
    });
    addRoots(m, minted.roots, 0);
    await save();
  }
  await save();

  const all = () => [...actors.values()];
  const hostActor = () => all().find((a) => a.kind === 'host');
  // `accounts` → todos los suplentes; id de grupo → sus miembros; id simple → ese actor.
  const groupOf = (id) =>
    id === ACCOUNTS_ACTOR
      ? all().filter((a) => a.standInFor)
      : actors.has(id)
        ? [actors.get(id)]
        : all().filter((a) => a.group === id);
  const readValue = async (key) => {
    const [what, field] = key.split('.');
    const value = await driver.read(what, { event: ctx.event });
    if (field === 'count') return Array.isArray(value) ? value.length : value;
    return field ? value?.[field] : value;
  };
  const checkExpect = async (expect) => {
    if (!expect || typeof expect !== 'object') return [];
    const fails = [];
    for (const [k, want] of Object.entries(expect)) {
      const got = await readValue(k);
      if (got !== want)
        fails.push(
          `${k}: esperado ${JSON.stringify(want)}, leído ${JSON.stringify(got)}`,
        );
    }
    return fails;
  };
  const callOp = async (name, actor, args, c = ctx) => {
    let r = await driver.op(name, actor, args, c);
    if (!r.ok) r = await driver.op(name, actor, args, c); // los callables son idempotentes por client_request_id
    return r;
  };
  const wait = async (fraction) => {
    if (!(opts.realtime || plan.mode === 'conducted')) return;
    const seconds = Math.min(
      fraction * (scenario.event.round_seconds ?? 30),
      opts.maxWait ?? scenario.event.round_seconds ?? 30,
    );
    await new Promise((r) => setTimeout(r, seconds * 1000));
  };

  let outcome = 'completed';
  let failures = 0;
  for (const step of plan.steps) {
    const started = Date.now();
    const entry = {
      n: step.n,
      op: step.op,
      actor: step.actor,
      ok: true,
      note: '',
    };
    try {
      if (step.op === 'manual') {
        const answer = await io.prompt(
          `paso ${step.n} · ${step.actor}: ${step.do}${step.expect ? ` → ${step.expect}` : ''}\nEnter cuando esté hecho, o "abort": `,
        );
        if (String(answer).trim() === 'abort') {
          entry.ok = false;
          entry.note = 'abandonado';
          outcome = 'partial';
          logStep(m, { ...entry, ms: Date.now() - started });
          break;
        }
        if (step.captures === 'event_code') {
          const code = String(await io.prompt('Código del evento: ')).trim();
          const r = await callOp('resolve_code', null, { code });
          if (!r.ok) throw new Error(`código ${code}: ${r.error}`);
          ctx.event = r.result.event;
          addRoots(m, r.roots, step.n);
        }
      } else if (step.op === 'assert' || step.op === 'read') {
        const fails = await checkExpect(step.expect);
        if (fails.length) throw new Error(fails.join('; '));
      } else if (step.op === 'play') {
        if (!step.manualOf || step.actor !== ACCOUNTS_ACTOR)
          ctx.roundIndex += 1; // una ronda = un `play` de bots; el de `accounts` es la misma ronda
        const labels =
          (await driver.read('labels', { event: ctx.event })) ?? [];
        const truth = await driver.truth(ctx.event, null);
        const notes = [];
        for (const g of groupOf(step.actor).filter((a) => a.plays)) {
          const choice = decide({
            profile: g.profile,
            seed: plan.seed,
            botIndex: g.index,
            roundIndex: ctx.roundIndex,
            labels,
            truth,
            after: g.after,
          });
          if (choice.degraded)
            m.degradations.push({
              step: step.n,
              actor: g.id,
              reason: `truth no disponible: ${choice.degraded}`,
            });
          if (choice.skipped) {
            notes.push(`${g.id}:skip`);
            continue;
          }
          await wait(choice.delayFraction);
          const r = await callOp('play', g, {}, { ...ctx, choice, truth });
          if (!r.ok) throw new Error(`${g.id}: ${r.error}`);
          notes.push(`${g.id}:${choice.label}/${choice.rating}`);
        }
        entry.note = notes.join(' ');
      } else {
        const list =
          step.op === 'join'
            ? groupOf(step.actor)
                .filter((a) => a.kind === 'guest' && !joined.has(a.uid))
                .slice(0, step.args?.count ?? Infinity)
            : ['create_event', 'host_transition', 'capture', 'reveal'].includes(
                  step.op,
                )
              ? [hostActor()]
              : groupOf(step.actor);
        const args = step.args?.$ref
          ? resolvePath(scenario, step.args.$ref)
          : (step.args ?? {});
        for (const actor of list) {
          const r = await callOp(step.op, actor, args);
          if (!r.ok) throw new Error(`${actor.id}: ${r.error}`);
          if (step.op === 'join') joined.add(actor.uid);
          if (step.op === 'create_event') ctx.event = r.result.event;
          addRoots(m, r.roots, step.n);
        }
        const fails = step.manualOf ? [] : await checkExpect(step.expect);
        if (fails.length) throw new Error(fails.join('; '));
      }
    } catch (e) {
      entry.ok = false;
      entry.note = e.message;
      logStep(m, { ...entry, ms: Date.now() - started });
      if (!keepGoing) {
        outcome = 'aborted';
        io.print(
          `paso ${step.n} falló: ${e.message}. Lo creado quedó en el manifiesto; brix seed clean --run ${runId} lo borra.`,
        );
        break;
      }
      failures += 1;
      await save();
      continue;
    }
    logStep(m, { ...entry, ms: Date.now() - started });
    await save();
  }
  if (outcome === 'completed' && failures > 0) outcome = 'partial';
  finish(m, outcome);
  await save();
  return m;
}

export async function cleanRun({
  runId,
  driver,
  manifestDir = defaultManifestDir(),
}) {
  const m = await loadManifest(runId, manifestDir);
  if (driver.name !== m.driver)
    throw new Error(
      `la corrida ${runId} es del driver ${m.driver}, no ${driver.name}`,
    );
  const r = await driver.delete([...m.roots].reverse(), m);
  m.cleaned_at = new Date().toISOString();
  m.cleanup = {
    deleted: r.deleted,
    failed: r.failed,
    orphans: r.orphans ?? [],
  };
  await saveManifest(m, manifestDir);
  return m;
}

export async function listRuns(manifestDir = defaultManifestDir()) {
  return (await listManifests(manifestDir)).map((m) => ({
    run_id: m.run_id,
    scenario: m.scenario.id,
    target: m.target,
    outcome: m.outcome,
    started_at: m.started_at,
    cleaned: Boolean(m.cleaned_at),
  }));
}

export async function runSeedCli(
  argv,
  {
    cwd = process.cwd(),
    env = process.env,
    stdout = console.log,
    stderr = console.error,
  } = {},
) {
  const { flags, positional } = parseFlags(argv);
  const [sub, file] = positional;
  const dir = defaultManifestDir(env);
  try {
    if (sub === 'list') {
      const runs = await listRuns(dir);
      if (!runs.length) stdout(`sin corridas en ${dir}`);
      for (const r of runs)
        stdout(
          `${r.run_id}  ${r.scenario}  ${r.target}  ${r.outcome ?? 'en curso'}  ${r.cleaned ? 'limpia' : 'sin limpiar'}  ${r.started_at}`,
        );
      return 0;
    }
    if (sub === 'clean') {
      if (!flags.run || !flags.driver || !flags.target)
        throw new Error(
          'uso: brix seed clean --run <id> --driver <ruta> --target <target>',
        );
      const mod = await loadDriver({
        name: 'cli',
        driverPath: flags.driver,
        cwd,
      });
      const driver = mod.createDriver({ target: flags.target, log: () => {} });
      const g = checkTarget({
        driver,
        target: flags.target,
        env,
        cmdDir: flags['cmd-dir'],
      });
      if (!g.ok)
        throw new Error(
          `no se puede limpiar en ${flags.target}:\n - ${g.errors.join('\n - ')}`,
        );
      const m = await cleanRun({ runId: flags.run, driver, manifestDir: dir });
      stdout(
        `corrida ${m.run_id}: borradas ${m.cleanup.deleted.length} raíces, ${m.cleanup.failed.length} fallidas`,
      );
      for (const f of m.cleanup.failed)
        stdout(`  no se pudo borrar ${f.ref}: ${f.error}`);
      return m.cleanup.failed.length ? 1 : 0;
    }
    if (sub !== 'run' && sub !== 'validate')
      throw new Error(
        'uso: brix seed run|validate <escenario> | clean --run <id> | list',
      );
    if (!file) throw new Error(`uso: brix seed ${sub} <escenario.json>`);
    const { scenario, hash } = await loadScenario(
      path.isAbsolute(file) ? file : path.join(cwd, file),
    );
    const target = flags.target;
    if (!flags.driver) {
      if (sub === 'validate') {
        const v = validateScenario(scenario);
        if (!v.ok)
          throw new Error(`escenario inválido:\n - ${v.errors.join('\n - ')}`);
        stdout('escenario válido (sin driver: solo esquema)');
        return 0;
      }
      throw new Error(
        'brix seed run necesita --driver <ruta> y --target <target>',
      );
    }
    const mod = await loadDriver({
      name: scenario.driver,
      driverPath: flags.driver,
      cwd,
    });
    const driver = mod.createDriver({
      target: target ?? 'emulator',
      log: (l) => stderr(`  ${l}`),
    });
    if (sub === 'validate') {
      const v = validateScenario(scenario, { driver, target });
      if (!v.ok)
        throw new Error(
          `escenario inválido${target ? ` para ${target}` : ''}:\n - ${v.errors.join('\n - ')}`,
        );
      stdout(`escenario válido${target ? ` para ${target}` : ''}`);
      return 0;
    }
    if (!target) throw new Error('brix seed run necesita --target <target>');
    const seed = flags.seed !== undefined ? Number(flags.seed) : undefined;
    if (flags['dry-run']) {
      const plan = planRun({ scenario, driver, target, seed });
      stdout(
        `modo ${plan.mode} · ${plan.bots.length} actores · ${plan.steps.length} pasos · semilla ${plan.seed}`,
      );
      for (const s of plan.steps)
        stdout(
          `  ${s.n}. ${s.actor} ${s.op}${s.manualOf ? ` (auto de: ${s.manualOf.do})` : s.do ? ` — ${s.do}` : ''}`,
        );
      return 0;
    }
    const m = await runScenario({
      scenario,
      scenarioHash: hash,
      driver,
      target,
      seed,
      manifestDir: dir,
      env,
      cmdDir: flags['cmd-dir'],
      keepGoing: Boolean(flags['keep-going']),
      realtime: Boolean(flags.realtime),
      maxWait:
        flags['max-wait'] !== undefined ? Number(flags['max-wait']) : undefined,
    });
    stdout(
      `run_id ${m.run_id} · ${m.outcome} · ${m.roots.length} raíces · manifiesto en ${dir}`,
    );
    return m.outcome === 'completed' ? 0 : 1;
  } catch (e) {
    stderr(`❌ ${e.message}`);
    return 1;
  }
}

function defaultIo() {
  return {
    print: (t) => console.log(t),
    prompt: async (text) => {
      const { createInterface } = await import('node:readline/promises');
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      try {
        return await rl.question(text);
      } finally {
        rl.close();
      }
    },
  };
}
