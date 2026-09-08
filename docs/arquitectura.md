# Arquitectura

## Principio: local ahora, AWS después

La lógica de negocio (`api/src/core`) no conoce ni Express ni AWS. Solo depende de **puertos**
(interfaces en `core/ports`). Los **adaptadores** y **entrypoints** son intercambiables:

| Puerto             | Adaptador local                  | Adaptador AWS (Fase A)           |
| ------------------ | -------------------------------- | -------------------------------- |
| Repositorios       | DynamoDB Local (Docker, offline) | DynamoDB on-demand               |
| `TokenService`     | JWT HS256 propio                 | Cognito (JWKS)                   |
| `PasswordHasher`   | bcryptjs                         | (n/a con Cognito)                |
| `EventBus`         | outbox en tabla + worker         | EventBridge + SQS                |
| `Notifier`         | SMTP → Mailpit                   | SES                              |
| `PushSender`       | `web-push` + claves VAPID        | igual (`web-push` desde Lambda)  |
| `RoutingPort`      | OSRM (servidor demo público)     | OSRM propio / Mapbox / Valhalla  |
| `GeocodingPort`    | Photon + respaldo Nominatim      | proveedor con clave (MapTiler…)  |
| Entrypoint HTTP    | Express (`http-express`)         | API Gateway + Lambda (`lambda`)  |
| Tareas programadas | `node-cron` en el worker         | EventBridge Scheduler            |
| Cola offline web   | IndexedDB + reenvío en `online`  | + Service Worker Background Sync |

## Componentes locales

```
Angular PWA (ng serve :4200)
   │ HTTP JSON + JWT
   ▼
Express API (:3000) ── casos de uso ──> DynamoDB Local (:8000)
                          │
                          ├─ escribe eventos ─> OUTBOX# en la tabla
                          ▼
Worker (node) ── polling outbox ──> Notificar ──> SMTP ──> Mailpit (:8025)
              ├─ actualizar-stock ─> inventario del acopio (EntregaConfirmada)
              ├─ emparejar-automatico ─> asigna la solicitud nueva si procede (SolicitudCreada)
              └─ node-cron ──> DetectarRetrasos
```

## Módulo de inventario (roadmap #1, ya integrado)

`ACOPIO#<id> / STOCK#<clave-cultivo>` guarda `{ cantidadActual, umbralMinimo, umbralMaximo }`.
La cantidad sube sola con `EntregaConfirmada` (subscriber `actualizar-stock`) y baja con ajustes
manuales del admin. `core/domain/inventario.ts` decide el estado (`BAJO`/`OK`/`ALTO`) y qué
evento emitir al cruzar un umbral; `core/application/inventario/*` orquesta y persiste.

## Emparejamiento automático (roadmap #2, ya integrado)

Subscriber `emparejar-automatico` sobre `SolicitudCreada`: si `AJUSTE#OPERACION.autoEmparejar`
está activo, `emparejarAutomatico` elige el vehículo disponible de la zona con menor capacidad
suficiente y **reutiliza `asignarFlete`** (con `auto: true`), heredando sus guardas de
concurrencia. Si no hay match o el admin asignó a mano en el intervalo, no hace nada. El
interruptor se controla desde `/a/ajustes` (`GET`/`PUT /admin/ajustes`).

## Seguimiento del flete (roadmap #3+#4, ya integrado)

**Trazado de la ruta.** Al asignar (`asignarFlete`) se llama a `RoutingPort.calcularRuta` una sola
vez y se guarda en el flete (`rutaVial`, `distanciaVialKm`, `duracionEstimadaMin`,
`rutaAproximada`). El adaptador local usa el servidor de demo de OSRM; si no responde, devuelve una
recta con `aproximada: true` y **no bloquea** la asignación. Para fletes sin `rutaVial` (datos
sembrados o asignados antes de esta función) el frontend la pide bajo demanda a `GET /geo/ruta`.

**Reporte de posición.** `POST /fletes/:id/ubicacion` (transportista dueño o admin, flete en curso)
→ `agregarTrack` (`FLETE#<id> / TRACK#<ts>`) + `flete.ultimaUbicacion`. `GET /fletes/:id/ruta`
devuelve el rastro ordenado.

**Geocerca de entrega.** Si el flete va `EN_RUTA` y el punto reportado cae dentro de
`GEOCERCA_ACOPIO_M` (300 m, `shared/src/geo.ts`) del acopio, `registrarUbicacion` **reusa
`cambiarEstadoFlete(…, 'ENTREGADO')`** (con todos sus efectos: solicitud COMPLETADA, vehículo
liberado, evento `EntregaConfirmada`). La respuesta incluye `entregaDetectada`. Esto cubre el caso
"el transportista se olvida de marcar la entrega".

**Punto de recogida por dirección.** El productor puede fijar el origen escribiendo una dirección:
`GET /geo/buscar?q=` → `buscarLugares` → `GeocodingPort`. El texto se guarda como `origenNombre` en
la solicitud y se denormaliza al flete.

**Frontend.** `MapaFleteComponent` (Leaflet, `import()` dinámico, chunk ~38 KB gzip) pinta ruta
vial, rastro, geocerca y un ícono de camión orientado al rumbo. La matemática del viaje
(km restantes sobre la ruta, ETA, progreso, estado de señal) vive en el util puro
`web/src/app/shared/tracking.util.ts`, con pruebas, y la reusan la vista del productor y la del
transportista. `BuscadorLugarComponent` es el _typeahead_ reutilizable de direcciones.

> **Dependencias externas en runtime** (todas gratuitas y sin clave; requieren internet, sin SLA):
> _tiles_ raster de `tile.openstreetmap.org`, rutas de `router.project-osrm.org` (OSRM demo),
> geocodificación de `photon.komoot.io` con respaldo `nominatim.openstreetmap.org`. La **tarifa
> sigue calculándose con Haversine × factor de sinuosidad** — OSRM solo dibuja y estima el viaje.
> En AWS cada uno se sustituye por su adaptador con clave sin tocar `core/`.

## Diagrama de código

Ver `api/src/` — capas `core/` (domain + application + ports), `adapters/`, `entrypoints/`.
Regla de dependencias: `application` → solo `ports` + `domain`. `core` nunca importa `adapters`
ni SDK de AWS.

## Modelo de roles — coordinación centralizada

El sistema modela una **empresa de transporte / cooperativa que despacha**, no un
_marketplace_:

- **admin** = despachador. Configura tarifas y catálogo de cultivos, **da de alta a los
  transportistas y su flota** (`/a/flota`), ve la cola de solicitudes y **asigna** cada carga a
  un vehículo compatible.
- **transportista** = operador de uno o más vehículos. **No se auto-registra**: lo crea el admin,
  porque es personal de la cooperativa y hay que poder verificarlo. Recibe fletes asignados,
  avanza su estado y puede **reportar incidencias en ruta**. No navega ni postula a fletes abiertos.
- **productor** = **único rol con auto-registro** (portal público + código por correo). Publica la
  carga y sigue el viaje.

Una "bolsa de fletes" con postulación del transportista es un modelo de negocio distinto y queda
fuera de alcance (ver `docs/trabajo-futuro.md` si se decide incorporarlo).

## Máquina de estados del flete

`ASIGNADO → EN_CAMINO_ORIGEN → CARGANDO → EN_RUTA → ENTREGADO`. Desde cualquier estado no
terminal se puede `CANCELADO`. Desde EN_CAMINO_ORIGEN / CARGANDO / EN_RUTA se puede `INCIDENCIA`
(terminal para ese flete; la solicitud vuelve a PENDIENTE y a la cola del admin). Fuente única:
`shared/src/domain.ts` (`TRANSICIONES_FLETE`), compartida por backend (validación) y frontend
(botones).

## Fase A — checklist de migración a AWS

Se hace en una fase separada, **cuando el sistema local esté 100 % verde**. No se toca `core/`:
solo se añaden adaptadores/entrypoints y se despliega `infra/template.yaml`. Cada fila es algo
que hoy está resuelto de forma **provisional para local** y hay que cambiar.

| Provisional (local)                                                | Definitivo (AWS)                                                                                                                                    |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| JWT propio HS256 (`JWT_SECRET`), sin refresh                       | **Cognito** User Pool + grupos; verificación por JWKS; trigger post-confirmación crea `USUARIO#/PERFIL`                                             |
| Outbox en la tabla + worker con `setInterval` (polling)            | `EventBus` publica a **EventBridge**; consumidores = **Lambdas** con **SQS** + **DLQ** (la tabla `OUTBOX#` queda como respaldo/idempotencia)        |
| `node-cron` en el worker (`DetectarRetrasos`, `CRON_DEMO`)         | **EventBridge Scheduler** → Lambda `DetectarRetrasos`                                                                                               |
| Express (`entrypoints/http-express`)                               | **API Gateway HTTP API** + `entrypoints/lambda` (mismo `Router`, mapper `APIGatewayProxyEventV2 → HttpRequest`), un handler "lambdalith" por módulo |
| Correo por SMTP/Mailpit (`nodemailer`)                             | **SES** (mismo `Notifier`)                                                                                                                          |
| Tabla creada por `scripts/db:migrate`                              | **CloudFormation / SAM** (`infra/template.yaml`; PAY_PER_REQUEST + PITR)                                                                            |
| Frontend por `ng serve`                                            | Build estático en **S3 + CloudFront** (OAC); `aws s3 sync` + invalidación                                                                           |
| CORS fijo a `http://localhost:4200`                                | Origen del dominio real, por parámetro SAM                                                                                                          |
| Config por `.env.local` / `env.ts`                                 | Parámetros SAM + **SSM Parameter Store / Secrets Manager** (JWT/VAPID/SMTP)                                                                         |
| DynamoDB Local: endpoint + credenciales dummy                      | Rol IAM de la Lambda; sin endpoint override                                                                                                         |
| OSRM demo, Photon/Nominatim públicos (sin SLA)                     | Auto-hospedar o proveedor con clave (documentado como limitación; para la defensa se mantienen)                                                     |
| **Pago simulado** (pasarela por paridad de dígito; sin cobro real) | Integración real (Stripe/PayPhone/Kushki) detrás de la misma forma de `pago`                                                                        |
| `PushSender` con `web-push` desde el worker Node                   | `web-push` desde una Lambda (mismo puerto); claves VAPID en Secrets                                                                                 |
| Cola offline: reenvío solo con la pestaña abierta                  | + **Background Sync** del Service Worker (la idempotencia ya está lista)                                                                            |
| CI: lint + tests + `sam validate` (sin deploy)                     | Workflows `deploy-api` (`sam deploy`) y `deploy-web` con rol **OIDC**                                                                               |

Post-deploy: re-ejecutar la carga (k6) contra API Gateway, capturar el **cold start real** del
CloudWatch Dashboard y completar `docs/reporte-metricas.md` y `docs/costos.md`. Runbook paso a
paso en `docs/despliegue-aws.md` (se escribe en esa fase).
