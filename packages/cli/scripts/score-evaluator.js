import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Directorio propio de este script (vc/brix/packages/cli/scripts/), no el
// cwd del proceso. La matriz viaja empaquetada junto al evaluador, así que
// se resuelve contra esta ruta para que funcione invocado desde cualquier
// directorio (global, npx, o subproceso de bin/brix.js).
const packageScriptsDir = fileURLToPath(new URL('.', import.meta.url));

const apiKey = process.env.GEMINI_API_KEY;
const targetTool = process.argv[2];

if (!apiKey) {
  console.error("❌ Error: GEMINI_API_KEY no está definida en el entorno.");
  process.exit(1);
}

if (!targetTool) {
  console.error("❌ Uso: node vc/brix/packages/cli/scripts/score-evaluator.js <nombre-del-paquete-o-repo>");
  process.exit(1);
}

const matrixPath = path.resolve(packageScriptsDir, '..', 'scoring', 'matrix.md');
if (!fs.existsSync(matrixPath)) {
  console.error(`❌ Error: No se encontró la matriz en ${matrixPath}`);
  process.exit(1);
}

const matrixContent = fs.readFileSync(matrixPath, 'utf8');

const prompt = `
Actúa como un Auditor de Arquitectura Senior para el ecosistema Vibe Coding (Brix).
Tu objetivo es evaluar la siguiente herramienta/librería: "${targetTool}".

Basándote estrictamente en los criterios descritos en esta Matriz de Scoring:
${matrixContent}

Devuelve ÚNICAMENTE un objeto JSON válido (sin bloques de código markdown, sin \`\`\`json) con la siguiente estructura exacta:
{
  "tool": "${targetTool}",
  "date": "${new Date().toISOString().split('T')[0]}",
  "score": {
    "vibeCodingFit": 0,
    "securityAndHealth": 0,
    "efficiencyDx": 0,
    "adoptionCurve": 0,
    "scopeAndValue": 0
  },
  "totalScore": 0,
  "verdict": "Aprobado | Sandbox | Rechazado",
  "scopeAnalysis": {
    "problemSolved": "Breve explicación",
    "overhead": "Impacto en CI / peso",
    "justification": "Razones frente a alternativas nativas"
  }
}
`;

async function evaluate() {
  console.log(`🔍 Evaluando "${targetTool}" usando Gemini API (gemini-3.6-flash)...`);
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP Error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    const jsonResult = JSON.parse(resultText);
    
    const outputDir = path.resolve('vc/brix/packages/cli/scoring/evaluations');
    fs.mkdirSync(outputDir, { recursive: true });

    const fileName = `${targetTool.replace(/[^a-zA-Z0-9_-]/g, '_')}.evaluation.json`;
    const outputPath = path.join(outputDir, fileName);

    fs.writeFileSync(outputPath, JSON.stringify(jsonResult, null, 2));

    console.log(`✅ Evaluación completada con éxito.`);
    console.log(`📊 Total Score: ${jsonResult.totalScore}/100 | Veredicto: ${jsonResult.verdict}`);
    console.log(`📄 Reporte guardado en: ${outputPath}`);

  } catch (error) {
    console.error("❌ Falló la evaluación:", error.message);
    process.exit(1);
  }
}

evaluate();
