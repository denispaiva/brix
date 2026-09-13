import fs from 'node:fs';
import path from 'node:path';

// Nombres aceptados para el archivo de configuración del proyecto consumidor.
// Se busca en el cwd — la raíz del repo donde se invoca `brix` — no en el
// directorio del paquete: la configuración describe el layout del proyecto
// que usa el CLI, no el del CLI.
const CONFIG_FILENAMES = ['brix.config.json', '.brixrc.json'];

export function loadConfig(cwd = process.cwd()) {
  for (const name of CONFIG_FILENAMES) {
    const configPath = path.join(cwd, name);
    if (!fs.existsSync(configPath)) continue;

    try {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (error) {
      console.error(`⚠️  Ignorando ${name}: no es JSON válido (${error.message}).`);
      return {};
    }
  }

  return {};
}
