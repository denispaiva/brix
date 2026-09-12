#!/usr/bin/env node

import path from 'node:path';
import { execSync } from 'node:child_process';
import { generateSpec } from '../src/commands/idea.js';

const args = process.argv.slice(2);
const command = args[0];
const subCommand = args[1];
const target = args[2];

if (command === 'tool' && subCommand === 'score') {
  if (!target) {
    console.error('❌ Error: Debes especificar el paquete. Ejemplo: brix tool score zod');
    process.exit(1);
  }
  const evaluatorPath = path.resolve('vc/tooling/scripts/score-evaluator.js');
  try {
    execSync(`node "${evaluatorPath}" "${target}"`, { stdio: 'inherit' });
  } catch (error) {
    process.exit(1);
  }
} else if (command === 'idea') {
  const filePath = subCommand;
  await generateSpec(filePath);
} else {
  console.log(`
🔨 Brix CLI — Vibe Coding Governance OS (v0.1.0)

Comandos disponibles:
  brix tool score <pkg>    Evalúa una herramienta mediante Gemini API y genera JSON
  brix idea <archivo.md>   Convierte notas informales en SPEC.md ejecutable
  brix graduate            Prepara la extracción a repositorio independiente
  `);
}
