import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

export async function runGraduate(targetPkg, options = {}) {
  // La carpeta a graduar es siempre específica del repo donde se invoca: no
  // hay default universal razonable, así que se exige explícita (argumento
  // posicional o graduate.defaultPath en brix.config.json).
  const resolvedTargetPkg = targetPkg || options.defaultPath;
  if (!resolvedTargetPkg) {
    console.error('❌ Error: Falta la carpeta a graduar.');
    console.error(
      '   Pasala como argumento (brix graduate <path>) o declarala',
    );
    console.error('   en graduate.defaultPath dentro de brix.config.json.');
    process.exit(1);
  }

  console.log(
    `🎓 Iniciando protocolo de graduación para "${resolvedTargetPkg}"...`,
  );

  const fullPath = path.resolve(resolvedTargetPkg);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Error: El directorio ${resolvedTargetPkg} no existe.`);
    process.exit(1);
  }

  const branchName = options.branch || 'graduation-export';
  // El repo destino identifica a una cuenta concreta: no se embebe ninguno
  // como default. Sin remote configurado, se informa el push sin destino.
  const remote = options.remote;

  try {
    console.log(
      `📦 Creando subtree split de '${resolvedTargetPkg}' en la rama '${branchName}'...`,
    );
    execSync(
      `git subtree split --prefix=${resolvedTargetPkg} -b ${branchName}`,
      { stdio: 'inherit' },
    );

    console.log(`✅ Subtree split generado exitosamente.`);
    if (remote) {
      console.log(`🚀 Para transferir al repo destino ejecuta:`);
      console.log(`   git push ${remote} ${branchName}:main`);
    } else {
      console.log(`🚀 Para transferir a un repo independiente ejecuta:`);
      console.log(`   git push <git-url-destino> ${branchName}:main`);
      console.log(
        `   (fijá el destino con --remote o con graduate.remote en brix.config.json)`,
      );
    }
  } catch (err) {
    console.error(`❌ Falló la graduación: ${err.message}`);
    process.exit(1);
  }
}
