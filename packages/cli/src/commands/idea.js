import fs from 'node:fs';
import path from 'node:path';

const apiKey = process.env.GEMINI_API_KEY;

export async function generateSpec(inputFile) {
  if (!apiKey) {
    console.error("❌ Error: GEMINI_API_KEY no está definida.");
    process.exit(1);
  }

  const rawPath = inputFile || 'ideas/draft.md';
  const resolvedPath = path.resolve(rawPath);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`❌ Error: No se encontró el archivo de notas en ${resolvedPath}`);
    process.exit(1);
  }

  const notesContent = fs.readFileSync(resolvedPath, 'utf8');

  const prompt = `
Actúa como Arquitecto Principal de Software para el ecosistema Vibe Coding (Brix).
Transforma las siguientes notas informales de un proyecto en una especificación ejecutable (SPEC.md) formal.

Notas del proyecto:
${notesContent}

Devuelve ÚNICAMENTE el contenido del archivo SPEC.md en formato Markdown con las siguientes secciones:
1. # Visión y Alcance
2. ## Criterios de Aceptación (Checklist)
3. ## Arquitectura y Stack Tecnológico
4. ## Estrategia de Graduación (Nombre de repo sugerido en denispaiva/)
`;

  console.log(`💡 Convirtiendo "${rawPath}" en SPEC.md usando Gemini API...`);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    const specText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    const outputDir = path.dirname(resolvedPath);
    const outputPath = path.join(outputDir, 'SPEC.md');

    fs.writeFileSync(outputPath, specText);

    console.log(`✅ Especificación generada con éxito.`);
    console.log(`📄 Guardado en: ${outputPath}`);

  } catch (error) {
    console.error("❌ Falló la generación de la spec:", error.message);
    process.exit(1);
  }
}
