// Validador del escenario v2. Refleja a mano scenario.schema.json: el CLI de
// Brix no tiene dependencias y no las suma por esto. Los mensajes citan el
// número de paso (1-based, antes de expandir `repeat`).

export const MODES = ['autonomous', 'conducted'];
export const PROFILE_NAMES = [
  'expert',
  'steady',
  'novice',
  'random',
  'slow',
  'quitter',
  'mixed',
];
export const ACCOUNTS_ACTOR = 'accounts';

// Qué actores admite cada operación del contrato v1. `any-bot`: cualquier bot
// o suplente que juegue (un anfitrión con host_plays vota como los demás).
export const OPS = {
  mint: { actors: 'guest' },
  create_event: { actors: 'host' },
  join: { actors: 'guest' },
  host_transition: { actors: 'host' },
  play: { actors: 'any-bot' },
  capture: { actors: 'host' },
  reveal: { actors: 'host' },
  resolve_code: { actors: 'runner' },
  read: { actors: 'runner' },
  assert: { actors: 'runner' },
  manual: { actors: 'manual' },
};

const HOST_ACTIONS = [
  'start',
  'open_round',
  'close_round',
  'extend_phase',
  'end_rectification',
  'resolve',
  'close',
];

export const standInKind = (account) =>
  String(account.role).startsWith('host') ? 'host' : 'guest';
const kindAllows = (allowed, kind) => allowed === 'any-bot' || allowed === kind;

export function validateScenario(scenario, { driver, target } = {}) {
  const errors = [];
  const err = (m) => errors.push(m);
  if (!scenario || typeof scenario !== 'object')
    return { ok: false, errors: ['el escenario no es un objeto'] };

  if (scenario.schemaVersion !== 2)
    err(
      `schemaVersion debe ser 2 (es ${JSON.stringify(scenario.schemaVersion)})`,
    );
  for (const k of ['id', 'title', 'driver'])
    if (typeof scenario[k] !== 'string' || !scenario[k])
      err(`${k} debe ser un string no vacío`);
  if (!Array.isArray(scenario.targets) || scenario.targets.length === 0)
    err('targets debe ser una lista no vacía');
  for (const t of scenario.targets ?? [])
    if (/prod/i.test(t))
      err(`target "${t}": ningún target puede contener "prod"`);
  if (!Number.isInteger(scenario.seed)) err('seed debe ser un entero');
  if (!['manifest', 'none'].includes(scenario.cleanup))
    err('cleanup debe ser manifest o none');
  if (!scenario.event || typeof scenario.event !== 'object')
    err('event debe ser un objeto');

  const targetMode =
    driver && target ? driver.targets?.[target]?.mode : undefined;
  if (driver) {
    for (const t of scenario.targets ?? [])
      if (!driver.targets?.[t]) err(`target "${t}" no lo declara el driver`);
    if (target && !scenario.targets?.includes(target))
      err(`el escenario no admite el target "${target}"`);
  }
  const caps = driver ? new Set(driver.capabilities()) : null;

  const accounts = new Map();
  let hosts = 0;
  for (const a of scenario.accounts ?? []) {
    if (!a?.id || !a?.role) {
      err('cada cuenta de accounts necesita id y role');
      continue;
    }
    if (a.standIn && !PROFILE_NAMES.includes(a.standIn.profile))
      err(
        `cuenta "${a.id}": standIn.profile "${a.standIn?.profile}" no existe`,
      );
    if (!a.standIn && targetMode === 'autonomous')
      err(
        `cuenta "${a.id}" sin standIn no puede correr en el target autónomo "${target}"`,
      );
    if (standInKind(a) === 'host') hosts += 1;
    accounts.set(a.id, a);
  }
  const bots = new Map();
  for (const b of scenario.bots ?? []) {
    if (!b?.id) {
      err('cada bot necesita id');
      continue;
    }
    if (!['host', 'guest'].includes(b.kind))
      err(`bot "${b.id}": kind debe ser host o guest`);
    if (!PROFILE_NAMES.includes(b.profile))
      err(
        `bot "${b.id}": profile "${b.profile}" no existe (${PROFILE_NAMES.join(', ')})`,
      );
    if (b.count !== undefined && (!Number.isInteger(b.count) || b.count < 1))
      err(`bot "${b.id}": count debe ser un entero ≥ 1`);
    if (b.kind === 'host') hosts += b.count ?? 1;
    for (const ref of b.joinAfter ?? [])
      if (!accounts.has(ref))
        err(`bot "${b.id}": joinAfter cita "${ref}", que no está en accounts`);
    bots.set(b.id, b);
  }
  if (hosts > 1) err('a lo sumo un host entre bots y suplentes');

  // Kind con el que actúa un actor en un paso automático o en un `auto`.
  const kindOf = (actorId) => {
    if (actorId === ACCOUNTS_ACTOR) return 'any-bot';
    if (bots.has(actorId)) return bots.get(actorId).kind;
    if (accounts.has(actorId)) return standInKind(accounts.get(actorId));
    return null;
  };

  const checkStep = (step, n) => {
    if (!OPS[step.op]) {
      err(`paso ${n}: op "${step.op}" no existe en el contrato`);
      return;
    }
    if (
      caps &&
      !['manual', 'assert', 'read'].includes(step.op) &&
      !caps.has(step.op)
    )
      err(`paso ${n}: el driver no implementa la op "${step.op}"`);
    if (
      step.captures !== undefined &&
      (step.op !== 'manual' || step.captures !== 'event_code')
    )
      err(`paso ${n}: captures solo admite "event_code" en pasos manual`);
    const allowed = OPS[step.op].actors;
    if (allowed === 'manual') {
      if (step.actor !== ACCOUNTS_ACTOR && !accounts.has(step.actor))
        err(
          `paso ${n}: manual exige una cuenta de accounts o "accounts" (actor "${step.actor}")`,
        );
      if (
        step.captures &&
        caps &&
        targetMode === 'conducted' &&
        !caps.has('resolve_code')
      )
        err(`paso ${n}: captures exige que el driver implemente resolve_code`);
      if (step.auto) {
        const who = step.auto.actor ?? step.actor;
        const kind = kindOf(who);
        if (!kind)
          err(`paso ${n}: auto.actor "${who}" no es un bot ni una cuenta`);
        else if (!OPS[step.auto.op])
          err(`paso ${n}: auto.op "${step.auto.op}" no existe en el contrato`);
        else if (
          OPS[step.auto.op].actors === 'runner' ||
          OPS[step.auto.op].actors === 'manual'
        )
          err(
            `paso ${n}: auto.op "${step.auto.op}" no es una operación de actor`,
          );
        else if (
          kind !== 'any-bot' &&
          !kindAllows(OPS[step.auto.op].actors, kind)
        )
          err(
            `paso ${n}: auto.op "${step.auto.op}" no la puede ejecutar un ${kind}`,
          );
        else if (kind === 'any-bot' && OPS[step.auto.op].actors !== 'any-bot')
          err(
            `paso ${n}: con actor "accounts" solo cabe una op para cualquier bot (play)`,
          );
        if (caps && OPS[step.auto.op] && !caps.has(step.auto.op))
          err(
            `paso ${n}: el driver no implementa la op "${step.auto.op}" de auto`,
          );
      } else if (targetMode === 'autonomous') {
        err(
          `paso ${n}: manual sin auto no puede correr en el target autónomo "${target}"`,
        );
      }
      return;
    }
    if (accounts.has(step.actor) || step.actor === ACCOUNTS_ACTOR) {
      err(
        `paso ${n}: la cuenta real "${step.actor}" solo actúa en pasos manual`,
      );
      return;
    }
    if (allowed === 'runner') {
      if (step.actor !== 'runner')
        err(`paso ${n}: la op "${step.op}" la ejecuta el actor runner`);
      return;
    }
    const b = bots.get(step.actor);
    if (!b) {
      err(`paso ${n}: actor "${step.actor}" no es un bot`);
      return;
    }
    if (!kindAllows(allowed, b.kind))
      err(
        `paso ${n}: la op "${step.op}" exige un bot ${allowed}; "${b.id}" es ${b.kind}`,
      );
    if (
      step.op === 'host_transition' &&
      !HOST_ACTIONS.includes(step.args?.action)
    )
      err(
        `paso ${n}: host_transition.args.action debe ser uno de ${HOST_ACTIONS.join(', ')}`,
      );
  };

  if (!Array.isArray(scenario.steps) || scenario.steps.length === 0)
    err('steps debe ser una lista no vacía');
  (scenario.steps ?? []).forEach((step, i) => {
    const n = i + 1;
    if (step.repeat) {
      const { over, as, steps } = step.repeat;
      if (
        typeof over !== 'string' ||
        typeof as !== 'string' ||
        !Array.isArray(steps)
      ) {
        err(`paso ${n}: repeat necesita over, as y steps`);
        return;
      }
      if (!Array.isArray(resolvePath(scenario, over)))
        err(
          `paso ${n}: repeat.over "${over}" no apunta a una lista del escenario`,
        );
      steps.forEach((s, j) => checkStep(s, `${n}.${j + 1}`));
      return;
    }
    checkStep(step, n);
  });

  return { ok: errors.length === 0, errors };
}

export function resolvePath(obj, dotted) {
  return dotted
    .split('.')
    .reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
}
