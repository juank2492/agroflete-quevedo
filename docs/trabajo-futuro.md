# Trabajo futuro (roadmap)

> Estos elementos **no están implementados** y **no dejan carpetas, archivos ni stubs** en el
> repositorio. Se documentan aquí, con nota de diseño, para sustentarlos como hoja de ruta en la
> defensa. Se promueven a una fase real de desarrollo **solo por decisión explícita**.

## 1. Módulo de inventario en centros de acopio — _candidato #1_

- **Datos:** ítems `ACOPIO#<id> / STOCK#<cultivo>` con `cantidadActual`, `umbralMinimo`, `umbralMaximo`.
- **Evento consumido:** `EntregaConfirmada` → suma `pesoTon` al stock del cultivo/acopio.
- **Evento emitido:** `StockBajo` / `StockAlto` al cruzar umbrales.
- **API:** `GET /acopios/:id/stock`.
- **UI:** tablero de acopios en el rol admin.

## 2. Emparejamiento automático por evento — _candidato #2_

- Regla sobre `SolicitudCreada` → caso de uso `EmparejarAutomatico` que busca en `gsi2`
  (`DISP#<zona>`) el vehículo compatible más cercano (capacidad ≥ peso) y crea el flete sin
  intervención del admin. Si no hay match, la solicitud queda `PENDIENTE` (comportamiento actual).

## 3. Tracking de ubicación del transportista

- `POST /fletes/:id/ubicacion` (transportista) → ítems `FLETE#<id> / TRACK#<ts>` con `lat/lon/velocidad`.
- El portal del productor consulta `GET /fletes/:id` (polling) y muestra la última posición.

## 4. Mapa liviano

- MapLibre GL + tiles de OpenStreetMap para dibujar origen, destino y última posición del flete.

## 5. PWA offline con cola de reintento

- Service Worker con estrategia de cola: si `POST /solicitudes` falla sin conexión, se guarda en
  IndexedDB y se reintenta al recuperar red (Background Sync).

## 6. Notificaciones SMS y push

- SNS SMS para alertas críticas; Web Push para el portal.

## 7. E2E automatizado

- Playwright cubriendo el guion de demo completo (registro → solicitud → asignación → entrega → alertas).
