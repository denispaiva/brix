# Brix

CLI de gobernanza del ecosistema Vibe Coding. Audita tooling contra una matriz
de 100 puntos, convierte notas informales en specs ejecutables, gradúa
subcarpetas de un monorepo a repos independientes y genera el workflow de CI.

El nombre viene de los grados Brix: la medida del azúcar en el mosto que
anticipa la calidad del vino antes de la cosecha.

> **Este repositorio es un espejo de solo lectura.** La fuente de verdad de
> Brix es `vc/brix/` dentro del monorepo privado `denispaiva/blends`. Los
> cambios se hacen allá y llegan acá con `git subtree split`. Un commit hecho
> directamente en este repo hace que el próximo push del espejo sea rechazado,
> hasta descartarlo.

**Proyecto graduado el 2026-09-13.** El registro de la decisión está en
[`docs/decisions/0001-graduation.md`](docs/decisions/0001-graduation.md).

## Requisitos

- Node.js 24 o superior.
- `git`, para `brix graduate`.
- Una API key de Gemini en `GEMINI_API_KEY`, para `brix tool score` y `brix idea`.

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

## Instrumentos de la Fase 0

Viven en `scripts/`, fuera de los comandos del CLI, por la decisión D1 del
2026-09-13. Leen solo metadatos, corren en local y escriben series agregadas
en `data/`, que se versionan. El caché de la API queda en `.cache/`, que no.

### Minutos de GitHub Actions por rama

```bash
node scripts/actions-minutes.mjs --cycle 2026-09 --all-monitor-repos
```

Reconstruye la factura del ciclo como lo hace el monitor de escasez de
blends: lista las corridas creadas desde el primer día del ciclo, pide los
jobs de cada corrida terminada, y factura cada job redondeando hacia arriba
a minuto entero, con el multiplicador por sistema operativo que aplica
GitHub. Después imputa cada corrida a una rama:

| Corrida | Se imputa a |
|---|---|
| PR sobre una rama común | esa rama, entera |
| PR de un tren `tren/<fecha>` | sus vagones, 1/N cada uno, leídos de los mensajes `merge: vagón` de la punta del tren |
| Push a `main` tras mergear un tren | los mismos vagones, 1/N |
| Push a `main` tras mergear o hacer squash de un PR | la rama de ese PR |
| Corrida programada o disparada a mano | el cubo `workflow:<nombre>`, sin rama |

El reparto 1/N es la decisión D3: el costo de una entrega es por corrida,
no por tamaño, así que un vagón de un archivo y uno de veinte pagan lo mismo.

La serie va a `data/actions-minutes/<ciclo>.json`, con totales, minutos por
rama, minutos por día, cubos sin atribuir y la validación contra el monitor:
el total medido tiene que quedar a menos del 10 % de los minutos que el
monitor publica en `GH_SCARCITY_STATUS`. Sin `--all-monitor-repos` mide
solo el repo del remote, y avisa que el conjunto no es comparable.

Flags: `--cycle AAAA-MM`, `--repos a,b`, `--all-monitor-repos`, `--out <ruta>`.
Necesita `gh` autenticado y un clon donde existan las puntas de los trenes.
Una punta que el clon no tiene se imputa al nombre del tren, sin inventar
vagones. Las pruebas están en `scripts/tests/`.

## Estructura

```
scripts/
  actions-minutes.mjs          instrumento F1: minutos de Actions por rama
  tests/                       pruebas de los instrumentos
data/
  actions-minutes/             series versionadas por ciclo
packages/cli/
  bin/brix.js                  punto de entrada y orquestación de flags
  src/commands/                idea, graduate, ci
  src/lib/                     parser de flags y carga de configuración
  scripts/score-evaluator.js   evaluador contra la API de Gemini
  scoring/matrix.md            matriz de 100 puntos
```

## Origen

Brix se incuba dentro del monorepo `denispaiva/blends`, en `vc/brix/`. Este
repo se actualiza desde ahí con `git subtree split`, que conserva el historial.

## Licencia

MIT. Ver [LICENSE](LICENSE).
