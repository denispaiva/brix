import fs from 'node:fs';
import path from 'node:path';

const apiKey = process.env.GEMINI_API_KEY;

export const GEMINI_MODEL = 'gemini-3.8-flash';

// La clave viaja en el encabezado y no en la URL: una URL con ?key= queda en
// logs, en historiales y en mensajes de error de proxies.
export function buildGeminiRequest(key, prompt) {
  return {
    url: `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key,
      },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    },
  };
}

export function buildPrompt(notesContent, graduationTarget) {
  return `
Actúa como Arquitecto Principal de Software para el ecosistema Vibe Coding (Brix).
Transforma las siguientes notas informales de un proyecto en una especificación ejecutable (SPEC.md) formal.

Notas del proyecto:
${notesContent}

Esto es una idea, no un proyecto graduado: la especificación responde "¿vale la pena?", no "¿cómo se hace?". No propongas tecnologías, lenguajes, frameworks, proveedores ni arquitectura: esa decisión se toma después de graduar. Si las notas ya nombran una tecnología, repítela como dato de entrada sin validarla ni ampliarla.

Devuelve ÚNICAMENTE el contenido del archivo SPEC.md en formato Markdown con las siguientes secciones:
1. # Visión y Alcance
2. ## Criterios de Aceptación (Checklist)
3. ## Restricciones y Riesgos de Viabilidad (costo, datos, dependencias externas, aspectos legales; solo lo que podría matar la idea)
4. ## Preguntas Asesinas Pendientes (lo que falta responder antes del gate de graduación; no inventes respuestas)
5. ## Estrategia de Graduación (${graduationTarget})
`;
}

export async function generateSpec(inputFile, options = {}) {
  if (!apiKey) {
    console.error('❌ Error: GEMINI_API_KEY no está definida.');
    process.exit(1);
  }

  // Precedencia: argumento posicional > idea.defaultInput del config > default.
  const rawPath = inputFile || options.defaultInput || 'ideas/draft.md';
  const resolvedPath = path.resolve(rawPath);

  if (!fs.existsSync(resolvedPath)) {
    console.error(
      `❌ Error: No se encontró el archivo de notas en ${resolvedPath}`,
    );
    process.exit(1);
  }

  const notesContent = fs.readFileSync(resolvedPath, 'utf8');

  // La cuenta destino identifica a un usuario concreto: se toma del config o
  // del flag --org, nunca embebida en el prompt.
  const graduationTarget = options.org
    ? `Nombre de repo sugerido bajo ${options.org}/`
    : 'Nombre de repo sugerido';

  const prompt = buildPrompt(notesContent, graduationTarget);

  console.log(`💡 Convirtiendo "${rawPath}" en SPEC.md usando Gemini API...`);

  const { url, init } = buildGeminiRequest(apiKey, prompt);

  try {
    const response = await fetch(url, init);

    if (!response.ok) {
      throw new Error(
        `HTTP Error ${response.status}: ${await response.text()}`,
      );
    }

    const data = await response.json();
    const specText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    // Sin --outDir, SPEC.md se escribe junto al archivo de notas de entrada.
    const outputDir = options.outDir
      ? path.resolve(options.outDir)
      : path.dirname(resolvedPath);
    const outputPath = path.join(outputDir, 'SPEC.md');

    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(outputPath, specText);

    console.log(`✅ Especificación generada con éxito.`);
    console.log(`📄 Guardado en: ${outputPath}`);
  } catch (error) {
    console.error('❌ Falló la generación de la spec:', error.message);
    process.exit(1);
  }
}
