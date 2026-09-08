# AgroFlete Quevedo

Plataforma web serverless para la optimización de fletes agrícolas en Quevedo.
Proyecto Integrador — Ingeniería en Software, UNIANDES.

Monorepo pnpm: `web/` (Angular PWA), `api/` (backend hexagonal), `shared/` (DTOs `zod`),
`scripts/` (infra + seed), `infra/` (AWS SAM), `docs/`.

---

## 1. Requisitos

| Herramienta      | Verificar (ya instalado)                      | Instalar                                                                                                                               |
| ---------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Node.js** ≥ 20 | `node --version`                              | <https://nodejs.org> (versión LTS) o `nvm`                                                                                             |
| **pnpm** ≥ 11    | `pnpm --version`                              | `npm install -g pnpm` &nbsp;(o `corepack enable`)                                                                                      |
| **Docker**       | `docker --version` y `docker compose version` | Windows/macOS: **Docker Desktop** <https://www.docker.com/products/docker-desktop/> · Linux: `curl -fsSL https://get.docker.com \| sh` |
| **Git**          | `git --version`                               | <https://git-scm.com/downloads>                                                                                                        |

- Abre **Docker Desktop** y espera a que diga _Running_ antes de seguir.
- Se necesita **internet** solo para el mapa del seguimiento (tiles OSM, OSRM, Photon/Nominatim; gratis, sin clave). Todo lo demás funciona offline.

---

## 2. Instalar

```bash
git clone https://github.com/juank2492/agroflete-quevedo.git
cd agroflete-quevedo
pnpm install
```

(Opcional) para usar un SMTP real en vez de Mailpit: `cp .env.example .env.local` y edita los `SMTP_*`.
Sin `.env.local` todo usa valores por defecto locales.

---

## 3. Arrancar

### Opción A — un solo comando

```bash
pnpm local
```

Levanta Docker (DynamoDB + Mailpit), compila `shared/`, crea la tabla, siembra datos y deja
**api + worker + web** en la misma consola. `Ctrl+C` para los tres a la vez.

### Opción B — una consola por proceso

```bash
pnpm local:setup   # infra + tabla + seed (la consola queda libre al terminar)

pnpm dev:api       # API      :3000   (otra consola)
pnpm dev:worker    # worker (eventos + cron)   (otra consola)
pnpm dev:web       # portal   :4200   (otra consola)
```

### URLs

| Servicio         | URL                           |
| ---------------- | ----------------------------- |
| Portal           | <http://localhost:4200>       |
| API (salud)      | <http://localhost:3000/salud> |
| Correo (Mailpit) | <http://localhost:8025>       |

### Usuarios de demo — contraseña `Agroflete2026`

| Rol           | Correo                  |
| ------------- | ----------------------- |
| Administrador | `admin@agroflete.ec`    |
| Productor     | `productor@demo.ec`     |
| Transportista | `transportista@demo.ec` |

### Al terminar

```bash
pnpm infra:down    # apaga los contenedores (los datos son en memoria; se recrean con local:setup)
```

---

## 4. Comandos

| Comando                                 | Qué hace                                         |
| --------------------------------------- | ------------------------------------------------ |
| `pnpm dev`                              | api + worker + web juntos (sin volver a sembrar) |
| `pnpm db:seed`                          | recarga los datos de demo                        |
| `pnpm test`                             | pruebas del backend (Jest + DynamoDB Local)      |
| `pnpm test:web`                         | pruebas del portal (Karma/ChromeHeadless)        |
| `pnpm lint` · `pnpm format`             | calidad de código                                |
| `pnpm simular-ruta <fleteId> --avanzar` | simula el viaje de un flete sin moverte          |
| `pnpm infra:logs`                       | logs de los contenedores                         |

---

## 5. Documentación (`docs/`)

| Archivo                  | Contenido                                                |
| ------------------------ | -------------------------------------------------------- |
| `guion-demo.md`          | Recorrido paso a paso para la defensa                    |
| `arquitectura.md`        | Puertos/adaptadores, local ↔ AWS, checklist de migración |
| `SRS-IEEE830.md`         | Requerimientos (base IEEE 830)                           |
| `matriz-trazabilidad.md` | Ítem de encuesta → RF → componente → prueba              |
| `diagrama-eventos.md`    | Eventos de dominio y flujo outbox → worker               |
| `trabajo-futuro.md`      | Roadmap y lo ya promovido                                |
| `despliegue-aws.md`      | Runbook Fase A (pendiente)                               |

---

## 6. Subir a AWS

Se hace en una fase aparte, sin tocar `api/src/core`: se añaden adaptadores de nube y se
despliega `infra/template.yaml`. Checklist de qué cambia (auth, eventos, correo, etc.) en
`docs/arquitectura.md` → _Fase A_.
