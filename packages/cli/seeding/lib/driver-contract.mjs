// La interfaz que todo driver implementa. Brix no sabe de callables: el driver
// traduce estas operaciones a su backend y devuelve las raíces que creó.
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const REQUIRED_MEMBERS = [
  'name',
  'targets',
  'capabilities',
  'preflight',
  'mint',
  'op',
  'read',
  'truth',
  'delete',
];

export function assertDriver(driver) {
  const missing = REQUIRED_MEMBERS.filter((m) => !(m in (driver ?? {})));
  if (missing.length)
    throw new Error(
      `el driver no cumple el contrato; faltan: ${missing.join(', ')}`,
    );
  for (const fn of [
    'capabilities',
    'preflight',
    'mint',
    'op',
    'read',
    'truth',
    'delete',
  ]) {
    if (typeof driver[fn] !== 'function')
      throw new Error(
        `el driver no cumple el contrato: ${fn} no es una función`,
      );
  }
  if (!driver.targets || typeof driver.targets !== 'object')
    throw new Error(
      'el driver no cumple el contrato: targets debe ser un objeto',
    );
  return driver;
}

export async function loadDriver({ name, driverPath, cwd = process.cwd() }) {
  if (!driverPath) {
    throw new Error(
      `no sé dónde vive el driver "${name}": pasá --driver <ruta> (por ejemplo --driver tools/gate-kit/driver.mjs desde vc/teyst/)`,
    );
  }
  const abs = path.isAbsolute(driverPath)
    ? driverPath
    : path.join(cwd, driverPath);
  const mod = await import(pathToFileURL(abs).href);
  if (typeof mod.createDriver !== 'function')
    throw new Error(`${driverPath} no exporta createDriver`);
  return mod;
}
