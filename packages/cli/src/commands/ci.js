import fs from 'node:fs';
import path from 'node:path';

export async function generateCiWorkflow() {
  const workflowDir = path.resolve('.github/workflows');
  const workflowPath = path.join(workflowDir, 'ci.yml');

  fs.mkdirSync(workflowDir, { recursive: true });

  const ciContent = `name: Brix Vibe Coding CI

on:
  push:
    branches: [ main, tooling/* ]
    paths:
      - 'vc/**'
      - 'ideas/**'
      - '.github/workflows/ci.yml'
  pull_request:
    branches: [ main ]
    paths:
      - 'vc/**'
      - 'ideas/**'

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
          node vc/brix/packages/cli/bin/brix.js
`;

  fs.writeFileSync(workflowPath, ciContent);
  console.log(`⚙️ Workflow declarativo de CI generado exitosamente.`);
  console.log(`📄 Guardado en: ${workflowPath}`);
}
