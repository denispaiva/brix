# @denispaiva/brix-cli

CLI de gobernanza del ecosistema Vibe Coding: scoring de tooling contra una
matriz de 100 puntos, specs ejecutables, graduación por `git subtree` y
scaffolding de CI.

Brix no se publica en npm. Desde un clon del repositorio:

```bash
npm install --global ./packages/cli
brix
```

Requiere Node.js 26 o superior. `brix tool score` y `brix idea` necesitan una
API key de Gemini en `GEMINI_API_KEY`.

La documentación completa, con flags, configuración por proyecto y la matriz
de scoring, está en el [README del repositorio](https://github.com/denispaiva/brix#readme).

Licencia MIT.
