# Diagrama de eventos (event storming)

## Eventos de dominio y sus productores/consumidores

| Evento                     | Lo produce                             | Lo consume                                                                         |
| -------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------- |
| `UsuarioRegistrado`        | `RegistrarUsuario`                     | `Notificar` → correo con código                                                    |
| `ReglasTarifaActualizadas` | `ActualizarReglasTarifa`               | (auditoría; sin efecto en L1–L6)                                                   |
| `SolicitudCreada`          | `CrearSolicitud`                       | `Notificar` → "solicitud recibida" al productor · _(roadmap: EmparejarAutomatico)_ |
| `FleteAsignado`            | `AsignarFlete`                         | `Notificar` → productor + transportista                                            |
| `EstadoFleteCambiado`      | `CambiarEstadoFlete` (salvo ENTREGADO) | `Notificar` → productor                                                            |
| `EntregaConfirmada`        | `CambiarEstadoFlete` (ENTREGADO)       | `Notificar` → productor · _(roadmap: ActualizarStock)_                             |
| `RetrasoDetectado`         | `DetectarRetrasos` (cron)              | `Notificar` → productor                                                            |

## Flujo local

```
Caso de uso ── ctx.events.publish(tipo, payload)
                     │  (valida payload con el esquema del evento)
                     ▼
        OUTBOX#<ulid> / EVENTO   (estado PENDIENTE, en la misma tabla)
                     │
     worker: setInterval(procesarOutbox, OUTBOX_POLL_MS)
                     │  por cada pendiente:
                     ├─ para cada suscriptor cuyos `tipos` incluyan el evento
                     │     y que no esté en `procesadoPor`:  sub.handle(ev, ctx)
                     │        éxito  → marcarSuscriptor(id, nombre)
                     │        fallo  → registrarIntento(id)  (se reintenta en el próximo tick)
                     └─ si todos los suscriptores relevantes terminaron → marcarProcesado(id)
                                                                           (sale del índice de pendientes)

worker: node-cron  ── '*/15 * * * *'  (o '*/1' con CRON_DEMO=1)
                     └─ DetectarRetrasos → RetrasoDetectado
```

## Equivalencia en AWS (Fase A)

| Local                                  | AWS                                                               |
| -------------------------------------- | ----------------------------------------------------------------- |
| `ctx.events.publish` → tabla `OUTBOX#` | `EventBus` publica a **EventBridge** (bus `agroflete-bus`)        |
| worker `procesarOutbox` (polling)      | Regla de EventBridge → **SQS** → Lambda consumidora (con **DLQ**) |
| `node-cron` `DetectarRetrasos`         | **EventBridge Scheduler** → Lambda `DetectarRetrasos`             |
| `Notifier` SMTP → Mailpit              | **SES** (correo)                                                  |

El desacople se mantiene: si la Lambda de notificación falla, el mensaje vuelve a la cola
(reintentos) y termina en la DLQ; el resto del sistema sigue operando.
