# Arquitectura

## Principio: local ahora, AWS después

La lógica de negocio (`api/src/core`) no conoce ni Express ni AWS. Solo depende de **puertos**
(interfaces en `core/ports`). Los **adaptadores** y **entrypoints** son intercambiables:

| Puerto             | Adaptador local                  | Adaptador AWS (Fase A)          |
| ------------------ | -------------------------------- | ------------------------------- |
| Repositorios       | DynamoDB Local (Docker, offline) | DynamoDB on-demand              |
| `TokenService`     | JWT HS256 propio                 | Cognito (JWKS)                  |
| `PasswordHasher`   | bcryptjs                         | (n/a con Cognito)               |
| `EventBus`         | outbox en tabla + worker         | EventBridge + SQS               |
| `Notifier`         | SMTP → Mailpit                   | SES                             |
| Entrypoint HTTP    | Express (`http-express`)         | API Gateway + Lambda (`lambda`) |
| Tareas programadas | `node-cron` en el worker         | EventBridge Scheduler           |

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
              └─ node-cron ──> DetectarRetrasos
```

## Diagrama de código

Ver `api/src/` — capas `core/` (domain + application + ports), `adapters/`, `entrypoints/`.
Regla de dependencias: `application` → solo `ports` + `domain`. `core` nunca importa `adapters`
ni SDK de AWS.
