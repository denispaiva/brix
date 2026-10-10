// vc/brix/packages/cli/seeding/lib/bots.mjs
// Perfiles deterministas (D-5). El PRNG es mulberry32 sobre un hash de
// (semilla, actor, ronda): la misma semilla reproduce la misma corrida; otra
// semilla cambia podio y tiempos. `hit` es la probabilidad de acertar la
// etiqueta cuando el driver pudo leer la verdad; sin verdad se degrada a
// random y se anota. Los suplentes de las cuentas reales son bots más.
import { ACCOUNTS_ACTOR, standInKind } from './scenario.mjs';

export const PROFILES = {
  expert: { hit: 0.9, rating: [8, 10], delay: [0.1, 0.3] },
  steady: { hit: 0.6, rating: [6, 8], delay: [0.3, 0.6] },
  novice: { hit: 0.3, rating: [4, 9], delay: [0.4, 0.9] },
  random: { hit: null, rating: [1, 10], delay: [0, 1] },
  slow: { hit: 0.5, rating: [5, 8], delay: [0.85, 1.0] },
  quitter: { hit: 0.5, rating: [5, 8], delay: [0.3, 0.6], after: 3 },
  mixed: { order: ['expert', 'steady', 'novice', 'random', 'slow'] },
};

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(seed, botIndex, roundIndex) {
  let h = (seed >>> 0) ^ 0x9e3779b9;
  for (const x of [botIndex, roundIndex]) {
    h = Math.imul(h ^ (x >>> 0), 0x85ebca6b) >>> 0;
    h = (h ^ (h >>> 13)) >>> 0;
  }
  return h >>> 0;
}

export function materializeBots(scenario, { mode }) {
  const out = [];
  let index = 0;
  if (mode === 'autonomous') {
    for (const a of scenario.accounts ?? []) {
      if (!a.standIn) continue;
      out.push({
        group: ACCOUNTS_ACTOR,
        id: a.id,
        index,
        kind: standInKind(a),
        profile: a.standIn.profile,
        plays: /player/.test(a.role),
        standInFor: a.id,
        after: PROFILES[a.standIn.profile]?.after,
        joinAfter: [],
      });
      index += 1;
    }
  }
  for (const group of scenario.bots ?? []) {
    const count = group.count ?? 1;
    const profiles =
      group.profile === 'mixed'
        ? Array.from(
            { length: count },
            (_, i) => PROFILES.mixed.order[i % PROFILES.mixed.order.length],
          )
        : Array(count).fill(group.profile);
    for (let i = 0; i < count; i += 1) {
      out.push({
        group: group.id,
        id: count === 1 ? group.id : `${group.id}-${i + 1}`,
        index,
        kind: group.kind,
        profile: profiles[i],
        plays: true,
        standInFor: null,
        after: group.after ?? PROFILES[profiles[i]]?.after,
        joinAfter: group.joinAfter ?? [],
      });
      index += 1;
    }
  }
  return out;
}

export function decide({
  profile,
  seed,
  botIndex,
  roundIndex,
  labels,
  truth,
  after,
}) {
  const p = PROFILES[profile];
  if (!p || profile === 'mixed')
    throw new Error(`perfil desconocido: ${profile}`);
  const rnd = mulberry32(hashSeed(seed, botIndex, roundIndex));
  const skipped = after !== undefined && roundIndex + 1 >= after;
  const pick = (range) =>
    range[0] + Math.floor(rnd() * (range[1] - range[0] + 1));
  const between = (range) => range[0] + rnd() * (range[1] - range[0]);
  let degraded = null;
  let label;
  if (p.hit === null || truth == null || !labels.includes(truth)) {
    if (p.hit !== null) degraded = 'random';
    label = labels[Math.floor(rnd() * labels.length)];
  } else if (rnd() < p.hit) {
    label = truth;
  } else {
    const wrong = labels.filter((l) => l !== truth);
    label = wrong.length ? wrong[Math.floor(rnd() * wrong.length)] : truth;
  }
  return {
    label,
    rating: pick(p.rating),
    delayFraction: Number(between(p.delay).toFixed(3)),
    skipped,
    degraded,
  };
}
