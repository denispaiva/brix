#!/usr/bin/env node

import path from 'node:path';
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const command = args[0];
const subCommand = args[1];
const target = args[2];

if (command === 'tool' && subCommand === 'score') {
  if (!target) {
    console.error('❌ Error: Debes especificar la herramienta o paquete. Ejemplo: brix tool score zod');
    process.exit(1);
  }
  
  const evaluatorPath = path.resolve('vc/tooling/scripts/score-evaluator.js');
  
  try {
    execSync(`node "${evaluatorPath}" "${target}"`, { stdio: 'inherit' });
  } catch (error) {
    process.exit(1);
  }
} else {
  console.log(`
🔨 Brix CLI — Vibe Coding Governance OS (v0.1.0)

Comandos disponibles:
  brix tool score <pkg|repo>   Evalúa una herramienta mediante Gemini API y genera JSON
  brix idea                     Convierte notas informales en SPEC.md (incubación)
  brix graduate                 Prepara la extracción a repositorio independiente
  `);
}
