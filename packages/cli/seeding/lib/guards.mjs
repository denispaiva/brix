// vc/brix/packages/cli/seeding/lib/guards.mjs
// Lo que ningún nivel baja: sin producción, coherencia entorno/target (como
// ingest.ts de Melquisedec) y modo conducido solo con una persona delante.

export const EMULATOR_VARS = [
  'FIRESTORE_EMULATOR_HOST',
  'FIREBASE_AUTH_EMULATOR_HOST',
];

export function checkTarget({
  driver,
  target,
  env = process.env,
  isTTY = Boolean(process.stdin.isTTY),
  cmdDir,
}) {
  const errors = [];
  if (/prod/i.test(target)) {
    return {
      ok: false,
      mode: null,
      errors: [`target "${target}": ningún target puede contener "prod"`],
    };
  }
  const decl = driver?.targets?.[target];
  if (!decl)
    return {
      ok: false,
      mode: null,
      errors: [
        `target "${target}" no lo declara el driver (${Object.keys(driver?.targets ?? {}).join(', ') || 'ninguno'})`,
      ],
    };
  const { mode } = decl;
  const defined = EMULATOR_VARS.filter((v) => env[v]);
  if (mode === 'autonomous') {
    for (const v of EMULATOR_VARS)
      if (!env[v])
        errors.push(
          `${v} no está definida: el target autónomo "${target}" solo corre dentro de firebase emulators:exec`,
        );
  } else {
    for (const v of defined)
      errors.push(
        `${v}=${env[v]} está definida; con --target ${target} escribiría en el emulador creyendo escribir en la nube. Quitala del entorno.`,
      );
    if (!isTTY && !cmdDir)
      errors.push(
        'el modo conducido exige una terminal interactiva o --cmd-dir <dir>: una persona tiene que lanzarlo',
      );
  }
  return { ok: errors.length === 0, mode, errors };
}
