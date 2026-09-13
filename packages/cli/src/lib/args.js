// Parser mínimo de flags, sin dependencias externas: separa `--flag valor` /
// `--flag=valor` de los argumentos posicionales. Se usa en bin/brix.js y en
// script(s) invocados como subproceso (score-evaluator.js) para que ambos
// entiendan la misma sintaxis de flags sin duplicar lógica.
export function parseFlags(argv) {
  const flags = {};
  const positional = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }

    const eqIndex = arg.indexOf('=');
    if (eqIndex !== -1) {
      flags[arg.slice(2, eqIndex)] = arg.slice(eqIndex + 1);
      continue;
    }

    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      flags[key] = next;
      i++;
    } else {
      flags[key] = true;
    }
  }

  return { flags, positional };
}
