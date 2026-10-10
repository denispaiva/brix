// Driver en memoria: referencia del contrato, base de los tests del runner y
// del driver espía de la conformidad. Modela lo mínimo de una cata: evento,
// participantes, rondas con una etiqueta correcta, votos y puntajes.
export function createDriver({ target = 'emulator', log = () => {} } = {}) {
  const db = { events: new Map(), users: new Map() };
  let seq = 0;
  const nextId = (p) => `${p}-${(seq += 1)}`;
  const ev = (ref) =>
    db.events.get(ref) ??
    (() => {
      throw new Error(`evento ${ref} no existe`);
    })();
  const newEvent = (ref, { host, limit, wineCount, hostPlays }) => ({
    ref,
    status: 'lobby',
    host,
    limit,
    participants: hostPlays && host ? [host] : [],
    labels: Array.from({ length: wineCount }, (_, i) => `label-${i + 1}`),
    rounds: [],
    current: null,
    scores: new Map(),
    source_type: target === 'emulator' ? 'seed' : 'real',
  });

  return {
    name: 'fake',
    targets: {
      emulator: { mode: 'autonomous' },
      'dev-x': { mode: 'conducted' },
    },
    capabilities: () => [
      'mint',
      'create_event',
      'join',
      'host_transition',
      'play',
      'capture',
      'reveal',
      'resolve_code',
      'read',
      'assert',
    ],
    async preflight() {
      return [];
    },
    async mint({ kind, id, alias, runId }) {
      const uid = kind === 'host' ? `${runId}-host` : nextId(`${runId}-guest`);
      db.users.set(uid, { uid, alias, kind, id });
      return { uid, alias, roots: [{ type: 'auth_user', ref: uid }] };
    },
    async op(name, actor, args, ctx) {
      log(`${name} ${actor?.id ?? ''}`);
      switch (name) {
        case 'create_event': {
          const id = nextId('e');
          const ref = `events/${id}`;
          db.events.set(
            ref,
            newEvent(ref, {
              host: actor.uid,
              limit: args.participant_limit ?? 10,
              wineCount: args.wine_count ?? 3,
              hostPlays: Boolean(args.host_plays),
            }),
          );
          return {
            ok: true,
            result: { event: ref, code: id },
            roots: [{ type: 'event', ref }],
          };
        }
        case 'resolve_code': {
          // Modo conducido: el evento lo creó una persona; acá lo simulamos vacío.
          const ref = `events/${args.code}`;
          if (!db.events.has(ref))
            db.events.set(
              ref,
              newEvent(ref, {
                host: 'human',
                limit: 10,
                wineCount: 4,
                hostPlays: false,
              }),
            );
          return { ok: true, result: { event: ref }, roots: [] };
        }
        case 'join': {
          const e = ev(ctx.event);
          if (e.participants.length >= e.limit)
            return { ok: false, error: 'cupo lleno', roots: [] };
          e.participants.push(actor.uid);
          return { ok: true, result: { participant_id: actor.uid }, roots: [] };
        }
        case 'host_transition': {
          const e = ev(ctx.event);
          const a = args.action;
          if (a === 'start') e.status = 'label_preview';
          else if (a === 'open_round') {
            const r = {
              id: nextId('r'),
              identifier: args.identifier,
              truth: e.labels[e.rounds.length % e.labels.length],
              votes: new Map(),
            };
            e.rounds.push(r);
            e.current = r;
            e.status = 'round_active';
          } else if (a === 'close_round') {
            e.current = null;
            e.status =
              e.rounds.length >= e.labels.length
                ? 'rectification'
                : 'intermission';
          } else if (a === 'end_rectification') e.status = 'reveal_capture';
          else if (a === 'resolve') {
            e.status = 'reveal';
            for (const p of e.participants)
              e.scores.set(
                p,
                e.rounds.filter((r) => r.votes.get(p)?.label === r.truth)
                  .length * 10,
              );
          } else if (a === 'close') e.status = 'closed';
          return { ok: true, result: { status: e.status }, roots: [] };
        }
        case 'play': {
          const e = ev(ctx.event);
          if (!e.current)
            return { ok: false, error: 'no hay ronda abierta', roots: [] };
          if (!e.participants.includes(actor.uid))
            return {
              ok: false,
              error: `${actor.id} no es participante`,
              roots: [],
            };
          e.current.votes.set(actor.uid, {
            label: ctx.choice.label,
            rating: ctx.choice.rating,
          });
          return { ok: true, result: ctx.choice, roots: [] };
        }
        case 'capture':
        case 'reveal':
          return { ok: true, result: {}, roots: [] };
        default:
          return { ok: false, error: `op desconocida ${name}`, roots: [] };
      }
    },
    async read(what, args) {
      const e = db.events.get(args.event);
      if (!e) return null;
      if (what === 'event')
        return { status: e.status, participant_count: e.participants.length };
      if (what === 'participants') return e.participants.length;
      if (what === 'labels') return e.labels;
      if (what === 'rounds') return e.rounds.map((r) => r.id);
      if (what === 'scores')
        return [...e.scores.entries()].map(([participant_id, score]) => ({
          participant_id,
          score,
        }));
      return null;
    },
    async truth(eventRef, roundRef) {
      const e = db.events.get(eventRef);
      const r = e?.rounds.find((x) => x.id === roundRef) ?? e?.current;
      return r?.truth ?? null;
    },
    async delete(roots, manifest) {
      const allowed = new Set((manifest?.roots ?? []).map((r) => r.ref));
      const deleted = [],
        failed = [];
      for (const r of roots) {
        if (!allowed.has(r.ref)) {
          failed.push({ ref: r.ref, error: 'ref fuera del manifiesto' });
          continue;
        }
        if (r.type === 'event') db.events.delete(r.ref);
        else db.users.delete(r.ref);
        deleted.push(r.ref);
      }
      return { deleted, failed };
    },
    _db: db,
  };
}
