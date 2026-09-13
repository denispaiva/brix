import fs from 'node:fs';
import path from 'node:path';

export async function generateCiWorkflow(options = {}) {
  // El workflow se escribe en el repo donde se invoca brix: cwd-relativo por
  // diseño, igual que antes.
  const workflowDir = path.resolve('.github/workflows');
  const workflowPath = path.join(workflowDir, 'ci.yml');

  fs.mkdirSync(workflowDir, { recursive: true });

  const watchPaths = options.watchPaths?.length ? options.watchPaths : ['vc/**', 'ideas/**'];
  // Ruta al binario dentro del repo destino: en blends el paquete está
  // anidado en vc/brix/, en un repo graduado cuelga de la raíz.
  const entrypoint = options.entrypoint || 'vc/brix/packages/cli/bin/brix.js';

  const pathsBlock = watchPaths.map((glob) => `      - '${glob}'`).join('\n');

  const ciContent = `name: Brix Vibe Coding CI

on:
  push:
    branches: [ main, tooling/* ]
    paths:
${pathsBlock}
      - '.github/workflows/ci.yml'
  pull_request:
    branches: [ main ]
    paths:
${pathsBlock}

jobs:
  governance-audit:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js v26
        uses: actions/setup-node@v4
        with:
          node-version: 26

      - name: Verify Brix CLI Operational Status
        run: |
          node ${entrypoint}
`;

  fs.writeFileSync(workflowPath, ciContent);
  console.log(`⚙️ Workflow declarativo de CI generado exitosamente.`);
  console.log(`📄 Guardado en: ${workflowPath}`);
}
