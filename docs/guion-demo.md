# Guion de demostración

> Entorno **local de desarrollo**. Sustituye cada servicio de AWS por un equivalente
> offline (ver `docs/arquitectura.md`). El despliegue en AWS es la Fase A y no cambia
> la lógica de negocio.

## Preparación

Requiere Docker corriendo. `pnpm install` la primera vez.

**Todo en una consola** (rápido; `Ctrl+C` para todo):

```bash
pnpm local     # infra + espera DynamoDB + build shared + migrate + seed + dev
```

**Una consola por proceso** (para reiniciar uno sin tocar los demás):

```bash
pnpm local:setup   # preparación única; la consola queda libre
pnpm dev:api       # otra consola
pnpm dev:worker    # otra consola
pnpm dev:web       # otra consola
```

Al terminar: `pnpm infra:down`.

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
- Alternativa sin GPS: pestaña **Escribir dirección** → teclear "Parque La Familia" (o una calle)
  → elegir de la lista (con tipo y distancia a Quevedo). El nombre queda guardado en la solicitud.
- Toque 1: elegir **cultivo** (Maíz / Banano). Toque 2: ajustar **toneladas**.
- La **tarjeta de tarifa** se recalcula en vivo (distancia por carretera + precio).
- Toque 3: **Confirmar flete** → la solicitud queda PENDIENTE.
- Mailpit: llega "Solicitud recibida".

## 4. Alta de transportista y vehículo (admin) (45 s)

- El transportista **no se auto-registra**: iniciar como **admin@agroflete.ec** → `/a/flota`.
- "Dar de alta" (nombre, correo, celular) → cuenta confirmada + **contraseña temporal** (se
  muestra una vez y llega a Mailpit). Botón "Dar de baja / Reactivar" en la misma fila.
- "Agregar vehículo": elegir ese transportista, placa, tipo, capacidad y **zona** (debe coincidir
  con la del acopio de la solicitud; el diálogo de asignación indica "zona X, ≥ N t"). Queda
  DISPONIBLE. Desde la tabla se cambia zona/capacidad o se desactiva. Un transportista puede
  tener varios vehículos.
- El transportista sigue teniendo `/t/vehiculo` para alternar su propia disponibilidad.

## 5. Asignación (administrador) (45 s)

- Iniciar como **admin@agroflete.ec** → `/a/solicitudes`.
- En la solicitud recién creada, **Asignar** → el diálogo lista los vehículos compatibles
  (zona + capacidad). Elegir uno → **Confirmar asignación**.
- Efectos: la solicitud sale de la cola (pasa a ASIGNADA), el vehículo queda OCUPADO.
- Mailpit: "Se asignó un transportista a tu carga" (productor) y "Nuevo flete asignado"
  (transportista).
- En `/a/fletes` se ve el flete con **transportista y placa**; la lista se filtra por estado y se
  pagina. Al pulsar el **estado** se abre un detalle con el contacto del transportista, el vehículo,
  el historial y (si aplica) el motivo de cancelación/incidencia. Botón **"Reasignar"** (mientras
  no esté ENTREGADO): elige otro vehículo compatible → cancela el flete actual y crea uno nuevo.

## 6. Seguimiento del viaje (transportista) (1 min)

- Iniciar como transportista → `/t/fletes`.
- Avanzar el estado paso a paso: **Salir hacia el origen → Empezar a cargar → Salir hacia el
  acopio → Confirmar entrega**. Cada paso: correo al productor.
- Intentar un salto no permitido (botón inexistente) — la máquina de estados no lo ofrece; por
  API devolvería 409.
- Al pulsar **Cancelar** se pide el **motivo** (obligatorio para el transportista); queda en el
  historial del flete y se lo ve el admin en el detalle de `/a/fletes`.
- Al **Confirmar entrega**: la solicitud pasa a COMPLETADA y el vehículo vuelve a DISPONIBLE.
  Mailpit: "Carga entregada".

## 6b. Incidencia en ruta (opcional) (45 s)

- Con un flete en curso (EN_CAMINO_ORIGEN / CARGANDO / EN_RUTA), el transportista pulsa
  **Reportar incidencia**, describe el motivo y marca si el vehículo queda fuera de servicio.
- Efectos: el flete pasa a **INCIDENCIA** (terminal); la solicitud vuelve a la cola del admin
  marcada **"⚠ Reasignación por incidencia"** con el motivo; el vehículo queda INACTIVO (o
  DISPONIBLE según la casilla). Mailpit: "Incidencia con tu flete" al productor.
- El admin la reasigna a otro vehículo como una asignación normal.

## 7. Vista del productor: seguimiento en tiempo real (1 min)

- Iniciar como productor → `/p/solicitudes` → abrir el detalle de una carga con flete en curso
  (el seed trae `flete-2` EN_RUTA con recorrido). Se ve el **mapa**: la **ruta por carretera**
  (OSRM), el recorrido, la **geocerca del acopio**, el **camión** orientado al rumbo, y la barra de
  **km restantes / hora estimada de llegada / progreso / estado de señal**.
- En otra pestaña, como transportista de ese flete → `/t/fletes` → **Compartir ubicación** (o
  **Enviar en vivo**). El mapa del productor se actualiza solo (polling cada 15 s).
- **Sin moverse:** en una consola aparte, `pnpm simular-ruta <fleteId> --avanzar` — lleva el flete
  a EN_RUTA y va enviando posiciones a lo largo de la ruta; al entrar en la geocerca del acopio la
  **entrega se confirma automáticamente** (la vista del transportista y la del productor lo reflejan).
- Coordenadas fuera de Ecuador se rechazan (422); un flete ya ENTREGADO no admite ubicación.

## 8. Métricas y alertas de retraso (1 min)

- Iniciar como admin → `/a/metricas`: tiempo medio de asignación, % de espera > 6 h, fletes por
  estado, tarifa media, solicitudes pendientes, **alertas de retraso emitidas**.
- El seed incluye una solicitud PENDIENTE creada "hace 10 h": con `CRON_DEMO=1` el worker
  ejecuta `DetectarRetrasos` cada minuto y, si aún no se notificó, emite `RetrasoDetectado`
  (correo al productor). También puede provocarse manualmente creando una solicitud y
  adelantando el reloj del sistema.

## 5b. Emparejamiento automático (opcional) (45 s)

- Admin → `/a/ajustes`: el interruptor **Emparejamiento automático** viene activado.
- Como productor, crear una solicitud a un acopio cuya zona tenga un vehículo disponible con
  capacidad suficiente (p. ej. Quevedo Centro con el vehículo del seed). En ~2 s el worker la
  pasa sola a **ASIGNADA** — sin que el admin toque nada. El flete queda marcado **"auto"** en
  `/a/fletes` y el correo al productor dice "asignación automática".
- Apagar el interruptor y repetir: ahora la solicitud se queda PENDIENTE en la cola del admin.

## 8a. Inventario de acopios (1 min)

- Admin → `/a/inventario`: tablero por acopio con la cantidad de cada cultivo, sus umbrales y
  el estado (**BAJO** / **OK** / **ALTO**). El seed trae maíz "saturado" en Quevedo Centro
  (ALTO) y maíz bajo mínimo en San Camilo (BAJO).
- Confirmar una entrega (paso 6) suma sus toneladas al acopio destino automáticamente.
- **Gestionar** una fila → fijar umbrales, o registrar una **salida** (delta negativo + motivo)
  hacia la comercializadora. Si el movimiento cruza un umbral se emite `StockBajo` / `StockAlto`
  y llega un correo al admin (`ADMIN_EMAIL`).

## 8b. Catálogo de cultivos y perfil (opcional) (1 min)

- Admin → `/a/tarifas`: además de base/km, recargo y sinuosidad, gestiona el **catálogo de
  cultivos**. Añadir uno nuevo ("Cacao seco", factor 1.4, temporada mar–may) → **Guardar**.
- Volver al flujo del productor → el nuevo cultivo aparece en el selector de "Nueva solicitud"
  y la tarifa lo usa. Una solicitud con un cultivo fuera del catálogo se rechaza (422).
- Cualquier rol → **Mi perfil**: editar nombre/celular y cambiar la contraseña (pide la actual).

## 9. Cierre

- Recalcar: todo corre **sin AWS** (DynamoDB Local + Mailpit + servidor Express que invoca los
  mismos casos de uso que usará Lambda). La migración a la nube (Fase A) solo agrega
  adaptadores y despliega `infra/template.yaml`; la lógica de negocio no cambia.
