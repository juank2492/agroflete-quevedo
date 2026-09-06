# Viabilidad económica — serverless vs. servidor 24/7

> Comparativa cualitativa y de orden de magnitud. Las cifras exactas se completan con el
> **AWS Pricing Calculator** durante la Fase A, con el tráfico real de la comercializadora.

## 1. Supuestos de carga (temporada vs. baja producción)

| Escenario        | Solicitudes/día | Peticiones API/mes (aprox.) |
| ---------------- | --------------: | --------------------------: |
| Baja producción  |            ~0–5 |                      ~5 000 |
| Operación normal |          ~20–40 |                     ~60 000 |
| Pico de cosecha  |        ~100–150 |                    ~300 000 |

Cada solicitud dispara ~6–10 invocaciones (estimación, creación, asignación, cambios de estado,
notificaciones).

## 2. Modelo tradicional (VPS / servidor dedicado siempre encendido)

| Concepto                                     | Costo mensual aprox.       |
| -------------------------------------------- | -------------------------- |
| VPS 2 vCPU / 4 GB (Ecuador o región cercana) | 20 – 40 USD                |
| Base de datos gestionada pequeña             | 15 – 30 USD                |
| Backups + monitoreo básico                   | 5 – 10 USD                 |
| **Total, pague o no pague uso**              | **~40 – 80 USD/mes fijos** |

El costo es **el mismo en temporada baja que en pico**; escalar el pico exige sobredimensionar
todo el año.

## 3. Modelo serverless (AWS, este proyecto)

| Servicio                          | Tarificación                                                      | Costo en baja producción             | Costo en pico de cosecha |
| --------------------------------- | ----------------------------------------------------------------- | ------------------------------------ | ------------------------ |
| Lambda (arm64, 512 MB, ~150 ms)   | Por invocación + GB-s; 1 M invocaciones y 400 000 GB-s gratis/mes | **~0 USD** (dentro de capa gratuita) | ~1 – 3 USD               |
| API Gateway HTTP API              | ~1.00 USD por millón de peticiones                                | ~0 USD                               | ~0.30 USD                |
| DynamoDB on-demand                | Por lectura/escritura; **$0 sin tráfico**                         | **0 USD**                            | ~1 – 4 USD               |
| EventBridge + SQS                 | Primer millón gratis; centavos por millón                         | ~0 USD                               | <1 USD                   |
| SES (correo)                      | ~0.10 USD por 1 000 correos                                       | ~0 USD                               | <1 USD                   |
| S3 + CloudFront (portal estático) | GB almacenados + transferencia                                    | <1 USD                               | ~1 – 2 USD               |
| CloudWatch (logs + dashboard)     | Por GB ingerido + dashboards                                      | ~1 – 3 USD                           | ~3 – 5 USD               |
| **Total estimado**                |                                                                   | **~1 – 5 USD/mes**                   | **~10 – 20 USD/mes**     |

## 4. Lectura

- **Inactividad = $0 de cómputo y datos.** El único costo casi-fijo es CloudWatch (logs), del
  orden de pocos dólares, y opcional.
- El gasto **sigue a la demanda**: se paga el pico de cosecha solo el mes del pico.
- No hay sobredimensionamiento ni administración de servidores; el escalado ante 100+ peticiones
  concurrentes es automático (validado en local: 100 conexiones, 0 errores, p99 < 30 ms — ver
  `reporte-metricas.md`).
- Para una comercializadora pequeña, pasar de **~40–80 USD/mes fijos** a **~1–5 USD/mes en
  temporada baja** es la diferencia entre que el proyecto sea sostenible o no.

## 5. Pendiente (Fase A)

Sustituir los rangos por el desglose exacto del AWS Pricing Calculator con: nº real de
invocaciones/mes, tamaño de payloads, retención de logs elegida y región final.
