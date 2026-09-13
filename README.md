# Brix

CLI de gobernanza del ecosistema Vibe Coding. Audita tooling contra una matriz
de 100 puntos, convierte notas informales en specs ejecutables, gradúa
subcarpetas de un monorepo a repos independientes y genera el workflow de CI.

El nombre viene de los grados Brix: la medida del azúcar en el mosto que
anticipa la calidad del vino antes de la cosecha.

## Requisitos

- Node.js 26 o superior.
- `git`, para `brix graduate`.
- Una API key de Gemini en `GEMINI_API_KEY`, para `brix tool score` y `brix idea`.

## Instalación

```bash
npm install --global @denispaiva/brix-cli
```

O sin instalar, desde un clon de este repo:

```bash
node packages/cli/bin/brix.js
```

## Comandos

| Comando | Qué hace |
|---|---|
| `brix tool score <pkg>` | Evalúa una herramienta con Gemini contra la matriz y escribe un JSON con puntaje y veredicto. |
| `brix idea <archivo.md>` | Convierte notas informales en un `SPEC.md` ejecutable. |
| `brix graduate [path]` | Extrae una subcarpeta con `git subtree split` a una rama lista para empujar a un repo nuevo. |
| `brix ci` | Genera `.github/workflows/ci.yml`. |

### Flags

| Comando | Flag | Efecto |
|---|---|---|
| `tool score` | `--outDir <dir>` | Dónde escribir el JSON de la evaluación. |
| `idea` | `--outDir <dir>` | Dónde escribir `SPEC.md`. Por defecto, junto al archivo de entrada. |
| `idea` | `--org <cuenta>` | Cuenta sugerida para el repo de graduación dentro de la spec. |
| `graduate` | `--branch <nombre>` | Rama de export. Por defecto, `graduation-export`. |
| `graduate` | `--remote <git-url>` | Repo destino que aparece en la instrucción de push. |
| `ci` | `--watch <globs>` | Rutas que disparan el workflow, separadas por coma. |
| `ci` | `--entrypoint <path>` | Ruta al binario de brix dentro del repo destino. |

Los flags aceptan tanto `--flag valor` como `--flag=valor`.

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
    "outputDir": "evaluations"
  }
}
```

`graduate` no tiene carpeta ni remote por defecto: los dos identifican datos
propios de cada repo. Sin carpeta, el comando falla con una indicación; sin
remote, imprime el push con el destino a completar.

## La matriz de scoring

La matriz vive en [`packages/cli/scoring/matrix.md`](packages/cli/scoring/matrix.md)
y viaja empaquetada con el CLI. Pondera cinco criterios sobre 100 puntos y
define tres veredictos:

| Puntaje | Veredicto |
|---|---|
| 80 o más | Aprobado |
| 50 a 79 | Sandbox |
| Menos de 50 | Rechazado |

Las evaluaciones que genera `tool score` son registros de gobernanza del
proyecto que invoca al CLI, no del paquete. Se escriben relativas al
directorio de trabajo y conviene commitearlas.

## Estructura

```
packages/cli/
  bin/brix.js                  punto de entrada y orquestación de flags
  src/commands/                idea, graduate, ci
  src/lib/                     parser de flags y carga de configuración
  scripts/score-evaluator.js   evaluador contra la API de Gemini
  scoring/matrix.md            matriz de 100 puntos
```

## Origen

Brix se incubó dentro del monorepo `denispaiva/blends` y se graduó a este repo
por `git subtree split`, conservando su historial.

## Licencia

MIT. Ver [LICENSE](LICENSE).
