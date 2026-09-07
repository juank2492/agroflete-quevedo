# AgroFlete Quevedo

Plataforma web serverless para la optimización de fletes agrícolas en Quevedo.
Proyecto Integrador — Ingeniería en Software, UNIANDES.

## Estrategia

1. **Todo funciona primero en local, sin usar AWS.** Cada servicio de nube se reemplaza por un
   equivalente local offline (ver `docs/arquitectura.md`).
2. Cuando el sistema completo esté probado en local, se ejecuta la **Fase A** de migración a AWS
   (guía en `docs/despliegue-aws.md`).

## Estructura

| Carpeta    | Qué es                                                                           |
| ---------- | -------------------------------------------------------------------------------- |
| `web/`     | Portal Angular (PWA, Tailwind + DaisyUI)                                         |
| `api/`     | Backend: `core/` (dominio + casos de uso + puertos), `adapters/`, `entrypoints/` |
| `shared/`  | DTOs y validaciones `zod` compartidas web ↔ api                                  |
| `scripts/` | `migrate`, `seed`, `load`                                                        |
| `infra/`   | `template.yaml` (AWS SAM) — se despliega en la Fase A                            |
| `docs/`    | SRS, arquitectura, trazabilidad, guion de demo, trabajo futuro                   |

## Requisitos

- Node.js 20+ (probado con 20/22; funciona con 26 pese al aviso de Angular)
- **pnpm 11+** (`npm i -g pnpm`). El repo fija la versión en `packageManager`.
- Docker accesible desde el CLI (sirve el daemon de WSL vía puente). `pnpm infra:up`
  usa `docker compose` si el plugin está disponible y cae a `docker run` si no.
- **Internet** para el seguimiento del flete: tiles de OpenStreetMap, rutas de OSRM (servidor de
  demo) y geocodificación de Photon/Nominatim. Todos gratuitos y sin clave. Son las únicas
  llamadas a servicios externos; el resto (y el cálculo de tarifa) funciona offline.

## Puesta en marcha (local)

Requiere Docker corriendo. `pnpm install` la primera vez.

### Opción A — una sola consola

```bash
pnpm local     # infra + espera DynamoDB + build shared + migrate + seed + dev
```

`pnpm dev` deja api + worker + web en la misma terminal con prefijos de color.
`Ctrl+C` los para **los tres a la vez**. Rápido para arrancar; malo si quieres
reiniciar solo uno.

### Opción B — una consola por proceso

Preparación (una vez; la consola queda libre al terminar):

```bash
pnpm local:setup   # infra + espera DynamoDB + build shared + migrate + seed
```

Luego, una terminal para cada proceso (independientes: `Ctrl+C` en una no toca las otras):

```bash
pnpm dev:api       # API      :3000
pnpm dev:worker    # worker (outbox + cron de retrasos)
pnpm dev:web       # portal   :4200
pnpm dev:shared    # (opcional) recompila shared/ en watch si lo vas a editar
```

### Al terminar

```bash
pnpm infra:down    # apaga los contenedores
```

- Portal: http://localhost:4200
- API: http://localhost:3000/salud
- Bandeja de correo (Mailpit): http://localhost:8025
- DynamoDB Local: http://localhost:8010 (`-inMemory`: al bajar el contenedor se pierde;
  `pnpm local:setup` recrea y re-siembra)

> `pnpm infra:up` es equivalente a `docker compose up -d`. Sin el plugin `compose`,
> el mismo comando recrea los contenedores con `docker run`.

## Scripts útiles

| Comando                                         | Acción                                                          |
| ----------------------------------------------- | --------------------------------------------------------------- |
| `pnpm local`                                    | Todo en una consola: setup + api/worker/web (Ctrl+C para todo)  |
| `pnpm local:setup`                              | infra + espera DynamoDB + build shared + migrate + seed         |
| `pnpm dev`                                      | api + worker + web juntos en una consola                        |
| `pnpm dev:api` / `:worker` / `:web` / `:shared` | Un proceso por consola (independientes)                         |
| `pnpm test`                                     | Pruebas del backend (Jest; integración usa DynamoDB Local)      |
| `pnpm test:cov`                                 | Pruebas del backend con cobertura de `api/src/core`             |
| `pnpm test:web`                                 | Pruebas del portal (Karma/Jasmine, ChromeHeadless)              |
| `pnpm simular-ruta <fleteId> --avanzar`         | Simula el viaje de un flete (prueba el seguimiento sin moverse) |
| `pnpm test:load`                                | Carga con autocannon (100 conexiones)                           |
| `pnpm test:coldstart`                           | Compara arranque: `tsx` vs. bundle `esbuild --minify`           |
| `pnpm lint` / `pnpm format`                     | Calidad de código                                               |
| `pnpm infra:down`                               | Detiene los contenedores                                        |

## Documentación (`docs/`)

| Archivo                  | Contenido                                                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `arquitectura.md`        | Puertos/adaptadores, equivalencias local ↔ AWS                                                                          |
| `diagrama-eventos.md`    | Event storming y flujo outbox → worker                                                                                  |
| `SRS-IEEE830.md`         | Requerimientos funcionales y no funcionales (base IEEE 830)                                                             |
| `matriz-trazabilidad.md` | Ítem de encuesta → RF → componente → prueba                                                                             |
| `reporte-metricas.md`    | Carga 100 concurrentes + arranque (local)                                                                               |
| `costos.md`              | Serverless vs. servidor 24/7                                                                                            |
| `guion-demo.md`          | Guion paso a paso para la defensa                                                                                       |
| `trabajo-futuro.md`      | Roadmap: hecho (inventario, emparejamiento auto, seguimiento + ruta + geocerca); pendiente (PWA offline, SMS/push, E2E) |
| `despliegue-aws.md`      | Runbook de la Fase A (pendiente)                                                                                        |
