# Brix

CLI de gobernanza del ecosistema Vibe Coding. Audita tooling con el motor del
Scoring Skill, convierte notas informales en specs ejecutables, gradúa
subcarpetas de un monorepo a repos independientes y genera el workflow de CI.

El nombre viene de los grados Brix: la medida del azúcar en el mosto que
anticipa la calidad del vino antes de la cosecha.

Repositorio canónico de Brix desde el 2026-11-09 (VCX-D056); ver [Origen](#origen). **Proyecto graduado el 2026-09-13.** El registro de la decisión está en
[`docs/decisions/0001-graduation.md`](docs/decisions/0001-graduation.md).

## Misión

Proveer capacidades e instrumentos técnicos reutilizables que ejecuten operaciones con entradas, permisos y resultados verificables.

## Visión

Que proyectos y equipos puedan adoptar capacidades de ingeniería de forma independiente, con beneficio demostrable, interfaces estables y configuración explícita, tanto dentro como fuera de Blends.

## Destinatarios y alcance

Se dirige a desarrolladores, agentes, proyectos y orquestadores. El alcance conceptual incluye scoring y evaluación de herramientas, medición, generación de especificaciones y scaffolding, motores de FinOps, validación y siembra de escenarios, diseño y operaciones Git. La disponibilidad real de cada capacidad debe verificarse en su implementación; esta lista no declara todas como implementadas.

**Entradas previstas:** solicitudes, datos, configuración y permisos explícitos, junto con drivers cuando una capacidad los requiera.

**Resultados previstos:** resultados estructurados, diagnósticos, errores y evidencia reproducible con límites claros.

Brix no prescribe el proceso de gobierno de un equipo ni adopta decisiones en su nombre. No presupone un Cellar, busca rutas históricas de Blends o accede a implementaciones privadas ajenas. Los drivers que conocen un backend particular pertenecen al producto consumidor.

Brix es el núcleo de capacidades técnicas de VCX, según VCX-D029. La denominación «kernel» queda reservada al núcleo de gobierno del sistema existente, conforme a la [arquitectura](https://github.com/denispaiva/vcx/blob/main/docs/architecture/overview.md#fronteras-y-contexto). El código específico de cada producto y de cada proyecto vive en su propio repositorio; Brix provee capacidades y no aloja ese código.

## Capacidades objetivo y skills

La [capacidad de preparación de ideas](docs/idea-intake.md) documenta el requisito `/idea <texto o archivo>`: aplicar una plantilla, invocar preguntas asesinas y producir un Markdown revisable. Aún no está implementada y no equivale al generador de especificaciones `brix idea` del sistema existente.

Las [interfaces de comandos](docs/commands.md) fijan `brix idea` = `/idea` y `brix council` = `/council`, con ayuda para completar parámetros. Son capacidades objetivo compartidas entre CLI y conversación; Blends coordina su uso dentro del recorrido. Las skills propias viven en `.agents/skills/`, la carpeta del estándar abierto que Codex descubre; `.claude/skills` es un symlink de directorio a esa carpeta para Claude Code, que no lee `.agents/skills`. Se descubren solo desde este directorio, y otro consumidor las copia con su procedencia, según VCX-D033.

La [capacidad de arquitectura de referencia](docs/reference-architecture.md) documenta el modelo propuesto que alimentará FinOps después del ingreso de la idea. Su interfaz está por implementar; el motor de ledger existente no demuestra generación automática de arquitectura o estimaciones.

Para trabajar en el repositorio: leer este documento y [AGENTS.md](AGENTS.md). Las decisiones de Brix están en [docs/decisions](docs/decisions/README.md).

## Requisitos

- Node.js 24 o superior.
- `git`, para `brix graduate`.
- Una API key de Gemini en `GEMINI_API_KEY`, para `brix idea`. `brix tool score` no la necesita — usa el motor del Scoring Skill, no Gemini.

## Instalación

Brix no se publica en npm. Se usa desde un clon de este repo:

```bash
node packages/cli/bin/brix.js
```

Para tener el comando `brix` disponible en cualquier directorio, instalalo
desde el clon:

```bash
npm install --global ./packages/cli
```

## Comandos

| Comando                                                                     | Qué hace                                                                                     |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `brix tool score evaluate --input <archivo>`                                | Evidencia real → score, borrador `pending`.                                                  |
| `brix tool score decide --id <candidato> --status <estado> --by "<nombre>"` | Registra la decisión humana sobre una evaluación pendiente.                                  |
| `brix idea <archivo.md>`                                                    | Convierte notas informales en un `SPEC.md` ejecutable.                                       |
| `brix graduate [path]`                                                      | Extrae una subcarpeta con `git subtree split` a una rama lista para empujar a un repo nuevo. |
| `brix ci`                                                                   | Genera `.github/workflows/ci.yml`.                                                           |
| `brix finops validate --portfolio <dir>`                                    | Valida el ledger FinOps compartido y el de cada proyecto del portfolio, y suma sus totales.  |
| `brix finops validate <ledger.json>`                                        | Valida un solo ledger FinOps.                                                                |
| `brix seed run <escenario> --target <target> --driver <ruta>`               | Siembra un escenario (emulador autónomo; dev conducido) y deja un manifiesto de la corrida.  |
| `brix seed validate <escenario> [--target <target> --driver <ruta>]`        | Valida el escenario contra el esquema y, con driver, contra el contrato del target.          |
| `brix seed clean --run <id> --driver <ruta> --target <target>`              | Borra solo las raíces del manifiesto de esa corrida.                                         |
| `brix seed list`                                                            | Lista las corridas de sembrado (`BRIX_SEED_DIR` o `~/.brix/seed-runs`).                      |

### Flags

| Comando               | Flag                                          | Efecto                                                               |
| --------------------- | --------------------------------------------- | -------------------------------------------------------------------- |
| `tool score evaluate` | `--input <archivo>`                           | Archivo de evidencia a evaluar (obligatorio).                        |
| `tool score evaluate` | `--dry-run`                                   | Muestra el reporte sin escribir nada.                                |
| `tool score evaluate` | `--offline`                                   | Nunca toca la red: reutiliza el snapshot de comunidad vigente.       |
| `tool score decide`   | `--id / --status / --by`                      | Candidato, veredicto y quién decide (los tres obligatorios).         |
| `tool score decide`   | `--rationale / --review-at / --accepted-risk` | Según lo que el estado exija.                                        |
| `tool score *`        | `--policy / --output-dir / --narrative-doc`   | Sobrescriben lo que `brix.config.json` declare para esta invocación. |
| `idea`                | `--outDir <dir>`                              | Dónde escribir `SPEC.md`. Por defecto, junto al archivo de entrada.  |
| `idea`                | `--org <cuenta>`                              | Cuenta sugerida para el repo de graduación dentro de la spec.        |
| `finops validate`     | `--portfolio <dir>`                           | Carpeta del portfolio. Sin el flag, `finops.portfolioDir` de `brix.config.json`. |
| `finops validate`     | `--exclude <a,b>`                             | Carpetas con `.roadmap.json` cuyo costo ya está en el ledger compartido. |
| `finops validate`     | `--shared`                                    | Con un solo ledger: exige los providers obligatorios del compartido. |
| `graduate`            | `--branch <nombre>`                           | Rama de export. Por defecto, `graduation-export`.                    |
| `graduate`            | `--remote <git-url>`                          | Repo destino que aparece en la instrucción de push.                  |
| `ci`                  | `--watch <globs>`                             | Rutas que disparan el workflow, separadas por coma.                  |
| `ci`                  | `--entrypoint <path>`                         | Ruta al binario de brix dentro del repo destino.                     |
| `seed run`            | `--target <target>` / `--driver <ruta>`       | Target declarado por el driver y módulo del driver (obligatorios).   |
| `seed run`            | `--seed <n>`                                  | Semilla de los bots; por defecto, la del escenario.                  |
| `seed run`            | `--cmd-dir <dir>`                             | Permite el modo conducido sin terminal interactiva.                  |
| `seed run`            | `--keep-going`                                | Un paso fallido no aborta: la corrida termina `partial`.             |
| `seed run`            | `--realtime`                                  | Respeta las esperas de ronda también en modo autónomo.               |
| `seed run`            | `--max-wait <s>`                              | Tope en segundos de cada espera de ronda.                            |
| `seed run`            | `--dry-run`                                   | Imprime el plan (modo, actores, pasos) sin acuñar nada.              |

Los flags aceptan tanto `--flag valor` como `--flag=valor`.

`brix seed` no sabe de ningún producto: necesita `--driver <ruta>` al módulo que implementa el contrato (`vc/teyst/tools/gate-kit/driver.mjs` para Teyst). Los manifiestos quedan en `$BRIX_SEED_DIR` o `~/.brix/seed-runs/`, nunca en el repo.

## Configuración

Cada proyecto que usa Brix puede declarar su layout en un `brix.config.json`
(o `.brixrc.json`) en su raíz. Brix lo busca en el directorio desde donde se
invoca, no en el directorio del paquete.

Las opciones se resuelven en este orden: flag de línea de comandos, después
`brix.config.json`, después el default embebido en el comando.

```json
{
  "idea": {
    "defaultInput": "ideas/draft.md",
    "org": "tu-cuenta"
  },
  "graduate": {
    "defaultPath": "packages/mi-lib",
    "branch": "graduation-export",
    "remote": "git@github.com:tu-cuenta/mi-lib.git"
  },
  "ci": {
    "watchPaths": ["packages/**"],
    "entrypoint": "packages/cli/bin/brix.js"
  },
  "score": {
    "outputDir": ".",
    "policyPath": "mi-politica-de-scoring.json",
    "narrativeDocPath": "docs/evaluaciones.md"
  }
}
```

`graduate` no tiene carpeta ni remote por defecto: los dos identifican datos
propios de cada repo. Sin carpeta, el comando falla con una indicación; sin
remote, imprime el push con el destino a completar.

`score.outputDir` es el directorio que CONTIENE la carpeta `evaluations/`
(no la carpeta misma) — sin declararlo, cae en el propio directorio de
invocación. `score.narrativeDocPath` es opcional: sin declararlo, `evaluate`
y `decide` simplemente se saltean la actualización de doc narrativo.

## El motor de scoring

`brix tool score` usa el mismo motor del Scoring Skill que blends —
`packages/cli/scoring/engine.mjs` — con seis factores ponderados
(comunidad, mantenimiento, seguridad, encaje, ingeniería, sostenibilidad),
una banda de confianza por evidencia disponible y una recomendación base
(`advance` / `advance_with_reservations` / `do_not_advance`). Los pesos y
umbrales vienen de una política JSON: `score.policyPath` en
`brix.config.json` para apuntar a la propia, o
[`packages/cli/scoring/default-scoring-policy.json`](packages/cli/scoring/default-scoring-policy.json)
como default embebido si no se declara ninguna.

`evaluate` nunca inventa un puntaje: lee un archivo de evidencia con
subfactores ya calificados por quien evalúa (con `rationale` y
`evidenceRefs` cuando el método es `rubric`), calcula el score y deja el
registro en `pending` — la decisión de avanzar, sandboxear o descartar la
toma un humano con `decide`. Las evaluaciones que genera `tool score` son
registros de gobernanza del proyecto que invoca al CLI, no del paquete. Se
escriben relativas al directorio de trabajo (o a `score.outputDir`) y
conviene commitearlas.

## Instrumentos de la Fase 0

Los instrumentos de medición de la Fase 0 (minutos de Actions, ventana de contexto y atención del PO por rama, e historia del KPI de entrega) miden un portfolio concreto y escriben sus series en él. Por eso quedaron en la instancia que los usa y no forman parte de este repositorio (VCX-D056, decisión del 2026-11-09).

## Estructura

```
packages/cli/
  bin/brix.js                  punto de entrada y orquestación de flags
  src/commands/                idea, graduate, ci
  src/lib/                     parser de flags y carga de configuración
  scoring/                     motor de scoring de tooling y su política
  finops/                      validación y agregación de billing ledgers
  seeding/                     motor de escenarios de datos de prueba
tests/                         pruebas de los motores y del cableado del CLI
docs/decisions/                registros de decisión de Brix
```

## Origen

Brix se incubó dentro del monorepo privado `denispaiva/blends`, en `vc/brix/`. Este repositorio es su fuente canónica desde la extracción: conserva el historial de esa carpeta, filtrado por rutas y con autoría reescrita, desde el commit `4742bb99`. Las referencias a documentos del monorepo quedan como texto con su procedencia.

## Licencia

MIT. Ver [LICENSE](LICENSE).
