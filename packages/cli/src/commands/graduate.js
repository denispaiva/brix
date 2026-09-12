import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

export async function runGraduate(targetPkg = 'vc/brix') {
  console.log(`🎓 Iniciando protocolo de graduación para "${targetPkg}"...`);

  const fullPath = path.resolve(targetPkg);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Error: El directorio ${targetPkg} no existe.`);
    process.exit(1);
  }

  const branchName = 'graduation-export';

  try {
    console.log(`📦 Creando subtree split de '${targetPkg}' en la rama '${branchName}'...`);
    execSync(`git subtree split --prefix=${targetPkg} -b ${branchName}`, { stdio: 'inherit' });

    console.log(`✅ Subtree split generado exitosamente.`);
    console.log(`🚀 Para transferir a tu repo independiente en denispaiva/brix ejecuta:`);
    console.log(`   git push git@github.com:denispaiva/brix.git ${branchName}:main`);
  } catch (err) {
    console.error(`❌ Falló la graduación: ${err.message}`);
    process.exit(1);
  }
}
