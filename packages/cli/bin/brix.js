#!/usr/bin/env node

import { generateSpec } from '../src/commands/idea.js';
import { runGraduate } from '../src/commands/graduate.js';
import { generateCiWorkflow } from '../src/commands/ci.js';
import { runScoreCli } from '../scoring/engine.mjs';
import { parseFlags } from '../src/lib/args.js';
import { loadConfig } from '../src/lib/config.js';

// Precedencia de opciones: flag de línea de comandos > brix.config.json del
// proyecto > default embebido en cada comando.
const { flags, positional } = parseFlags(process.argv.slice(2));
const [command, subCommand] = positional;
const config = loadConfig(process.cwd());

if (command === 'tool' && subCommand === 'score') {
  // Motor del Scoring Skill (registro de decisión 0003): reexports/decide, no un
  // solo paquete por línea de comandos — ya no invoca a Gemini como subproceso, sino
  // el mismo motor que /tool usa dentro de blends. `positional` corta en tres (comando,
  // subcomando, target) y descarta el resto; acá se necesita todo lo que sigue de
  // "score" tal cual (evaluate/decide y sus propios flags), así que se toma de
  // process.argv en crudo en vez de reusar `positional`/`flags`.
  const scoreArgv = process.argv.slice(2).slice(2);
  if (scoreArgv.length === 0) {
    console.error(
      '❌ Error: falta el subcomando. Ejemplo: brix tool score evaluate --input evidencia.json',
    );
    process.exit(1);
  }
  await runScoreCli(scoreArgv, { cwd: process.cwd() });
  if (process.exitCode) process.exit(process.exitCode);
} else if (command === 'idea') {
  await generateSpec(subCommand, {
    defaultInput: config.idea?.defaultInput,
    outDir: flags.outDir,
    org: flags.org || config.idea?.org,
  });
} else if (command === 'graduate') {
  await runGraduate(subCommand, {
    defaultPath: config.graduate?.defaultPath,
    branch: flags.branch || config.graduate?.branch,
    remote: flags.remote || config.graduate?.remote,
  });
} else if (command === 'ci') {
  await generateCiWorkflow({
    watchPaths: flags.watch ? flags.watch.split(',') : config.ci?.watchPaths,
    entrypoint: flags.entrypoint || config.ci?.entrypoint,
  });
} else if (command === 'seed') {
  // Motor de sembrado (registro 0007). Como `tool score`, toma la cola de argv
  // en crudo: sus flags son propios.
  const { runSeedCli } = await import('../seeding/engine.mjs');
  const code = await runSeedCli(process.argv.slice(2).slice(1), {
    cwd: process.cwd(),
  });
  if (code) process.exit(code);
} else {
  console.log(`
🔨 Brix CLI — Vibe Coding Governance OS (v0.1.0)

Comandos disponibles:
  brix tool score evaluate --input <archivo>   Evidencia → score, borrador pending
      --dry-run               Muestra el reporte sin escribir nada
      --offline                Nunca toca la red: reutiliza el snapshot de comunidad vigente
  brix tool score decide --id <candidato> --status <estado> --by "<nombre>"
      --rationale/--review-at/--accepted-risk   Según lo que el estado exija
      (score.policyPath/outputDir/narrativeDocPath en brix.config.json fijan dónde
       vive la política y dónde se escriben evaluaciones y narrativa; sin
       configurarlos, usa la política embebida del paquete y ./evaluations/)
  brix idea <archivo.md>   Convierte notas informales en SPEC.md ejecutable
      --outDir <dir>         Dónde escribir SPEC.md (default: junto al archivo de entrada)
      --org <cuenta>         Cuenta sugerida para el repo de graduación en la spec
  brix graduate [path]     Extrae una subcarpeta mediante git subtree para su graduación
      --branch <nombre>      Rama de export (default: graduation-export)
      --remote <git-url>     Repo destino que se sugiere en la instrucción de push
  brix ci                  Genera workflows de GitHub Actions (.github/workflows/ci.yml)
      --watch <globs>        Rutas que disparan el workflow, separadas por coma
      --entrypoint <path>    Ruta al binario de brix dentro del repo destino
  brix seed run <escenario> --target <target> --driver <ruta>   Siembra un escenario (emulador autónomo; dev conducido)
      --seed <n> --cmd-dir <dir> --keep-going --realtime --max-wait <s> --dry-run
  brix seed validate <escenario> [--target <target> --driver <ruta>]   Valida el escenario contra esquema y driver
  brix seed clean --run <id> --driver <ruta> --target <target>   Borra solo las raíces del manifiesto de esa corrida
  brix seed list           Lista las corridas de sembrado (BRIX_SEED_DIR o ~/.brix/seed-runs)

Configuración por proyecto: brix.config.json (o .brixrc.json) en la raíz del
repo donde se invoca brix. Los flags tienen precedencia sobre el archivo.
  `);
}
