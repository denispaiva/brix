#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { generateSpec } from '../src/commands/idea.js';
import { runGraduate } from '../src/commands/graduate.js';
import { generateCiWorkflow } from '../src/commands/ci.js';

// Directorio propio del binario (vc/brix/packages/cli/bin/), no el cwd del
// proceso que lo invoca. Los activos empaquetados con el CLI (el evaluador)
// se resuelven contra esta ruta para que `brix` funcione igual instalado
// globalmente, vía npx, o corrido desde cualquier directorio.
const packageBinDir = fileURLToPath(new URL('.', import.meta.url));

const args = process.argv.slice(2);
const command = args[0];
const subCommand = args[1];
const target = args[2];

if (command === 'tool' && subCommand === 'score') {
  if (!target) {
    console.error('❌ Error: Debes especificar el paquete. Ejemplo: brix tool score zod');
    process.exit(1);
  }
  const evaluatorPath = path.resolve(packageBinDir, '..', 'scripts', 'score-evaluator.js');
  try {
    execSync(`node "${evaluatorPath}" "${target}"`, { stdio: 'inherit' });
  } catch (error) {
    process.exit(1);
  }
} else if (command === 'idea') {
  const filePath = subCommand;
  await generateSpec(filePath);
} else if (command === 'graduate') {
  const pkgPath = subCommand || 'vc/brix';
  await runGraduate(pkgPath);
} else if (command === 'ci') {
  await generateCiWorkflow();
} else {
  console.log(`
🔨 Brix CLI — Vibe Coding Governance OS (v0.1.0)

Comandos disponibles:
  brix tool score <pkg>    Evalúa una herramienta mediante Gemini API y genera JSON
  brix idea <archivo.md>   Convierte notas informales en SPEC.md ejecutable
  brix graduate [path]     Extrae una subcarpeta mediante git subtree para su graduación
  brix ci                  Genera workflows optimizados de GitHub Actions (.github/workflows/ci.yml)
  `);
}
