# Trabajo futuro (roadmap)

> Estos elementos **no están implementados** y **no dejan carpetas, archivos ni stubs** en el
> repositorio. Se documentan aquí, con nota de diseño, para sustentarlos como hoja de ruta en la
> defensa. Se promueven a una fase real de desarrollo **solo por decisión explícita**.

> ✅ **Implementado (roadmap #1 promovido):** _Módulo de inventario en centros de acopio_.
> Ítems `ACOPIO#<id> / STOCK#<clave-cultivo>`; `EntregaConfirmada` (enriquecida) → subscriber
> `actualizar-stock`; eventos `StockBajo` / `StockAlto` → correo al admin; API
> `GET /admin/inventario`, `PUT/POST /acopios/:id/stock/:cultivo(/ajuste)`; tablero `/a/inventario`.
> Ver SRS RF-7 y `diagrama-eventos.md`.

> ✅ **Implementado (roadmap #2 promovido):** _Emparejamiento automático por evento_.
> Subscriber `emparejar-automatico` sobre `SolicitudCreada` → caso de uso `emparejarAutomatico`
> (vehículo disponible de la zona con menor capacidad suficiente) → reutiliza `asignarFlete` con
> `auto: true`. Interruptor persistido (`AJUSTE#OPERACION`, `autoEmparejar`) que el admin activa
> desde `/a/ajustes`. Ver SRS RF-4.5.

> ✅ **Implementado (roadmap #3+#4 fusionados + seguimiento enriquecido):** _Seguimiento del flete
> en tiempo real_ (tracking + mapa + ruta vial + geocerca). El transportista comparte ubicación
> (`POST /fletes/:id/ubicacion`, una vez o en vivo con `watchPosition`); se guarda
> `FLETE#<id> / TRACK#<ts>` y `flete.ultimaUbicacion`. Al asignar, `RoutingPort` traza la ruta por
> carretera (OSRM, con respaldo por recta) y se guarda en el flete. El productor ve un **mapa**
> (Leaflet, lazy, ~38 KB gzip) con la ruta vial, el rastro, la geocerca del acopio y un ícono de
> camión orientado al rumbo, más km restantes / ETA / progreso / estado de señal (util puro
> `tracking.util.ts`). Al entrar el vehículo en la geocerca (`GEOCERCA_ACOPIO_M`) con el flete
> `EN_RUTA`, la entrega se confirma sola (reusa `cambiarEstadoFlete`). El productor puede fijar el
> origen por dirección (`GET /geo/buscar` → `GeocodingPort` Photon/Nominatim). Script
> `pnpm simular-ruta <fleteId> --avanzar` para probar el viaje sin moverse. Dependencias externas
> en runtime (gratuitas, sin clave): tiles OSM, OSRM demo, Photon/Nominatim (ver `arquitectura.md`).
> Ver SRS RF-3.6, RF-5.7, RF-5.8.

## 1. PWA offline con cola de reintento

- Service Worker con estrategia de cola: si `POST /solicitudes` falla sin conexión, se guarda en
  IndexedDB y se reintenta al recuperar red (Background Sync).

## 2. Notificaciones SMS y push

- SNS SMS para alertas críticas; Web Push para el portal.

## 3. E2E automatizado

- Playwright cubriendo el guion de demo completo (registro → solicitud → asignación → entrega → alertas).
