#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { generateSpec } from '../src/commands/idea.js';
import { runGraduate } from '../src/commands/graduate.js';
import { generateCiWorkflow } from '../src/commands/ci.js';
import { parseFlags } from '../src/lib/args.js';
import { loadConfig } from '../src/lib/config.js';

// Directorio propio del binario (vc/brix/packages/cli/bin/), no el cwd del
// proceso que lo invoca. Los activos empaquetados con el CLI (el evaluador)
// se resuelven contra esta ruta para que `brix` funcione igual instalado
// globalmente, vía npx, o corrido desde cualquier directorio.
const packageBinDir = fileURLToPath(new URL('.', import.meta.url));

// Precedencia de opciones: flag de línea de comandos > brix.config.json del
// proyecto > default embebido en cada comando.
const { flags, positional } = parseFlags(process.argv.slice(2));
const [command, subCommand, target] = positional;
const config = loadConfig(process.cwd());

if (command === 'tool' && subCommand === 'score') {
  if (!target) {
    console.error('❌ Error: Debes especificar el paquete. Ejemplo: brix tool score zod');
    process.exit(1);
  }
  const evaluatorPath = path.resolve(packageBinDir, '..', 'scripts', 'score-evaluator.js');
  // El evaluador corre como subproceso y lee su propia configuración; solo se
  // le reenvían los flags explícitos de esta invocación.
  const forwarded = flags.outDir ? ` --outDir "${flags.outDir}"` : '';
  try {
    execSync(`node "${evaluatorPath}" "${target}"${forwarded}`, { stdio: 'inherit' });
  } catch (error) {
    process.exit(1);
  }
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
} else {
  console.log(`
🔨 Brix CLI — Vibe Coding Governance OS (v0.1.0)

Comandos disponibles:
  brix tool score <pkg>    Evalúa una herramienta mediante Gemini API y genera JSON
      --outDir <dir>         Dónde escribir el JSON de la evaluación
  brix idea <archivo.md>   Convierte notas informales en SPEC.md ejecutable
      --outDir <dir>         Dónde escribir SPEC.md (default: junto al archivo de entrada)
      --org <cuenta>         Cuenta sugerida para el repo de graduación en la spec
  brix graduate [path]     Extrae una subcarpeta mediante git subtree para su graduación
      --branch <nombre>      Rama de export (default: graduation-export)
      --remote <git-url>     Repo destino que se sugiere en la instrucción de push
  brix ci                  Genera workflows de GitHub Actions (.github/workflows/ci.yml)
      --watch <globs>        Rutas que disparan el workflow, separadas por coma
      --entrypoint <path>    Ruta al binario de brix dentro del repo destino

Configuración por proyecto: brix.config.json (o .brixrc.json) en la raíz del
repo donde se invoca brix. Los flags tienen precedencia sobre el archivo.
  `);
}
