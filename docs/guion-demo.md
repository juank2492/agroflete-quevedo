# Guion de demostración

> Entorno **local de desarrollo**. Sustituye cada servicio de AWS por un equivalente
> offline (ver `docs/arquitectura.md`). El despliegue en AWS es la Fase A y no cambia
> la lógica de negocio.

## Preparación

Una sola terminal, un solo comando (requiere Docker corriendo):

```bash
pnpm install
pnpm local     # infra + migrate + seed + api :3000 + worker + web :4200
```

`pnpm local` deja los tres procesos (api, worker, web) en la misma consola con
prefijos de color. `Ctrl+C` los detiene los tres. Al terminar la sesión:
`pnpm infra:down` apaga los contenedores.

Si la infra ya está levantada y sembrada, basta `pnpm dev`.

Pestañas abiertas: `http://localhost:4200` (portal) y `http://localhost:8025` (bandeja de correo Mailpit).

Usuarios de demo (contraseña **Agroflete2026**):

| Rol           | Correo                  |
| ------------- | ----------------------- |
| Administrador | `admin@agroflete.ec`    |
| Productor     | `productor@demo.ec`     |
| Transportista | `transportista@demo.ec` |

## 1. Portal público (30 s)

- Abrir `/`. Mostrar hero, "cómo funciona" (3 pasos), la franja de estadísticas del diagnóstico
  (72.5% informal, hasta 12 h de espera, 25% de margen a intermediarios, $0 en inactividad).

## 2. Alta de un productor y confirmación por correo (1 min)

- `Crear cuenta` → rol **Productor**, completar el formulario, enviar.
- Ir a Mailpit (`:8025`): abrir el correo "Tu código de confirmación", copiar el código.
- Volver al portal, pantalla **Confirmar correo**, pegar el código → cuenta activada.
- Iniciar sesión.

## 3. Nueva solicitud en ≤ 3 toques (1 min)

- El portal pide la ubicación del navegador (aceptar) → fija el origen y **preselecciona el
  centro de acopio más cercano**.
- Toque 1: elegir **cultivo** (Maíz / Banano). Toque 2: ajustar **toneladas**.
- La **tarjeta de tarifa** se recalcula en vivo (distancia por carretera + precio).
- Toque 3: **Confirmar flete** → la solicitud queda PENDIENTE.
- Mailpit: llega "Solicitud recibida".

## 4. Registro de vehículo (transportista) (45 s)

- Cerrar sesión, iniciar como **transportista@demo.ec** (o crear uno nuevo y confirmarlo).
- `/t/vehiculo`: registrar un vehículo en la **misma zona** de la solicitud, con **capacidad ≥
  toneladas**. Queda DISPONIBLE.

## 5. Asignación (administrador) (45 s)

- Iniciar como **admin@agroflete.ec** → `/a/solicitudes`.
- En la solicitud recién creada, **Asignar** → el diálogo lista los vehículos compatibles
  (zona + capacidad). Elegir uno → **Confirmar asignación**.
- Efectos: la solicitud sale de la cola (pasa a ASIGNADA), el vehículo queda OCUPADO.
- Mailpit: "Se asignó un transportista a tu carga" (productor) y "Nuevo flete asignado"
  (transportista).

## 6. Seguimiento del viaje (transportista) (1 min)

- Iniciar como transportista → `/t/fletes`.
- Avanzar el estado paso a paso: **Salir hacia el origen → Empezar a cargar → Salir hacia el
  acopio → Confirmar entrega**. Cada paso: correo al productor.
- Intentar un salto no permitido (botón inexistente) — la máquina de estados no lo ofrece; por
  API devolvería 409.
- Al **Confirmar entrega**: la solicitud pasa a COMPLETADA y el vehículo vuelve a DISPONIBLE.
  Mailpit: "Carga entregada".

## 7. Vista del productor (30 s)

- Iniciar como productor → `/p/solicitudes` → abrir el detalle: se ve la **línea de tiempo del
  flete** completa.

## 8. Métricas y alertas de retraso (1 min)

- Iniciar como admin → `/a/metricas`: tiempo medio de asignación, % de espera > 6 h, fletes por
  estado, tarifa media, solicitudes pendientes, **alertas de retraso emitidas**.
- El seed incluye una solicitud PENDIENTE creada "hace 10 h": con `CRON_DEMO=1` el worker
  ejecuta `DetectarRetrasos` cada minuto y, si aún no se notificó, emite `RetrasoDetectado`
  (correo al productor). También puede provocarse manualmente creando una solicitud y
  adelantando el reloj del sistema.

## 9. Cierre

- Recalcar: todo corre **sin AWS** (DynamoDB Local + Mailpit + servidor Express que invoca los
  mismos casos de uso que usará Lambda). La migración a la nube (Fase A) solo agrega
  adaptadores y despliega `infra/template.yaml`; la lógica de negocio no cambia.
