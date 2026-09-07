# Especificación de Requerimientos de Software (base IEEE 830) — reducida

Plataforma web serverless para la optimización de fletes agrícolas en Quevedo.

## 1. Introducción

### 1.1 Propósito

Definir los requerimientos funcionales y no funcionales del ecosistema (portal web + backend
por funciones) que reemplaza la coordinación informal de fletes agrícolas por un canal
centralizado con tarifas transparentes y seguimiento en tiempo real.

### 1.2 Alcance

Actores: **productor**, **transportista**, **administrador** (despachador de la comercializadora o
cooperativa; asigna los fletes, no es un marketplace). Cultivos: **catálogo administrable** (maíz y
banano por defecto; el admin puede dar de alta arroz, cacao, etc.). Zona: cantón Quevedo y
parroquias cercanas. Fuera de alcance (roadmap, ver `trabajo-futuro.md`): PWA offline, SMS/push.

### 1.3 Definiciones

- **FaaS / serverless**: funciones que se ejecutan por evento; costo cero en inactividad.
- **Solicitud de flete**: petición del productor para mover una carga a un centro de acopio.
- **Flete**: viaje asignado a un vehículo para atender una solicitud.

## 2. Descripción general

- **Interfaz web** Angular PWA, Mobile-First, objetivo ≤ 3 toques para confirmar un flete.
- **Backend** por casos de uso puros, expuestos vía HTTP; mensajería asíncrona por eventos de
  dominio (outbox → worker en local; EventBridge + SQS en AWS).
- **Persistencia** NoSQL (DynamoDB single-table); on-demand ⇒ $0 en inactividad.

## 3. Requerimientos funcionales

### RF-1 Identidad y sesión

| ID     | Requerimiento                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RF-1.1 | El auto-registro público está limitado al rol **productor** (correo, nombre, celular EC, contraseña ≥ 8 con mayúscula y dígito). Los **transportistas** los da de alta el administrador desde `/a/flota` (cuenta creada ya CONFIRMADA), no se auto-registran.                                                                                                                                                                                                                 |
| RF-1.2 | El auto-registro envía un código de 6 dígitos por correo y exige confirmarlo (vigencia 15 min) antes de permitir iniciar sesión.                                                                                                                                                                                                                                                                                                                                              |
| RF-1.6 | El administrador gestiona la **flota**: alta de transportistas (contraseña temporal generada por el sistema, mostrada una vez y enviada por correo — evento `TransportistaCreado`), **baja/reactivación** (la baja bloquea el login y deja sus vehículos INACTIVO; no se permite con un vehículo OCUPADO), alta de vehículos a nombre de un transportista (uno puede tener varios), y edición de zona / capacidad / disponibilidad de cualquier vehículo (no de uno OCUPADO). |
| RF-1.3 | El sistema autentica con correo/contraseña y emite un token con el rol del usuario.                                                                                                                                                                                                                                                                                                                                                                                           |
| RF-1.4 | El sistema expone el perfil del usuario autenticado.                                                                                                                                                                                                                                                                                                                                                                                                                          |
| RF-1.5 | El usuario edita sus datos personales (nombre, celular) y cambia su contraseña (exige la actual). Correo y rol son inmutables.                                                                                                                                                                                                                                                                                                                                                |

### RF-2 Módulo de Tarifas y Despacho

| ID     | Requerimiento                                                                                                                                                              |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RF-2.1 | El sistema calcula automáticamente la tarifa = tarifa_base/km × distancia_vial × factor_por_cultivo × (1 + recargo_si_temporada).                                          |
| RF-2.2 | La distancia vial se estima como distancia geodésica (Haversine) × factor de sinuosidad.                                                                                   |
| RF-2.3 | El administrador edita las reglas globales (base/km, recargo, sinuosidad) y el **catálogo de cultivos**: alta/baja de cultivos con su nombre, factor y meses de temporada. |
| RF-2.4 | El productor obtiene una **estimación** de tarifa antes de confirmar la solicitud.                                                                                         |
| RF-2.5 | El sistema publica el catálogo de centros de acopio (nombre, coordenadas, zona).                                                                                           |
| RF-2.6 | El sistema publica el catálogo de cultivos vigente (`GET /cultivos`) para el selector del productor. Una solicitud con un cultivo fuera del catálogo se rechaza.           |

### RF-3 Solicitudes (productor)

| ID     | Requerimiento                                                                                                                                                                                                                               |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RF-3.1 | El productor crea una solicitud indicando origen (GPS o coordenadas), acopio destino, cultivo y toneladas; queda en estado PENDIENTE y emite `SolicitudCreada`.                                                                             |
| RF-3.2 | El flujo de creación se completa en ≤ 3 toques (cultivo, toneladas, confirmar) con el acopio más cercano preseleccionado.                                                                                                                   |
| RF-3.3 | El productor consulta sus solicitudes y el detalle de cada una, incluida la línea de tiempo del flete cuando existe.                                                                                                                        |
| RF-3.6 | El productor puede fijar el punto de recogida **escribiendo una dirección** (buscador con sesgo a la zona de Quevedo, `GET /geo/buscar`); el texto elegido se guarda como `origenNombre` y se muestra al transportista y en el seguimiento. |

### RF-4 Vehículos y asignación

| ID     | Requerimiento                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RF-4.1 | El transportista registra vehículos (placa EC, tipo, capacidad, zona); nacen DISPONIBLE.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| RF-4.2 | El transportista alterna la disponibilidad de un vehículo (DISPONIBLE ↔ INACTIVO); no puede tocar uno OCUPADO.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| RF-4.3 | El administrador ve la cola de solicitudes PENDIENTE y, por cada una, la lista de vehículos compatibles (misma zona, capacidad ≥ peso).                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| RF-4.4 | El administrador asigna un flete: se crea el FLETE (estado ASIGNADO), el vehículo pasa a OCUPADO, la solicitud a ASIGNADA y se emite `FleteAsignado`. Guardas de concurrencia evitan doble asignación.                                                                                                                                                                                                                                                                                                                                                                                                    |
| RF-4.5 | **Emparejamiento automático:** si el administrador lo tiene activado (`/a/ajustes`), al crearse una solicitud el sistema la asigna al vehículo disponible de su zona con menor capacidad suficiente (subscriber sobre `SolicitudCreada`, reutiliza RF-4.4 con marca `auto`). Si no hay vehículo o hubo asignación manual concurrente, la solicitud queda PENDIENTE.                                                                                                                                                                                                                                       |
| RF-4.6 | El panel de fletes del administrador muestra el **transportista y la placa** de cada flete y quién lo asignó (manual o automático); el estado es un botón que abre un **detalle** con los datos de contacto del transportista, el vehículo, el historial y el motivo de cancelación/incidencia. Un flete no entregado puede **reasignarse** a otro vehículo compatible: se cancela el flete actual (libera el vehículo) y se crea uno nuevo con el vehículo elegido, validando zona y capacidad antes de tocar nada. Las listas del panel se filtran por estado y se paginan (componentes reutilizables). |

### RF-5 Monitoreo, estados y alertas

| ID      | Requerimiento                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RF-5.1  | El transportista (o el admin) avanza el estado del flete respetando la máquina ASIGNADO → EN_CAMINO_ORIGEN → CARGANDO → EN_RUTA → ENTREGADO (con ramas CANCELADO e INCIDENCIA); transiciones inválidas se rechazan.                                                                                                                                                                                                                                                                                                          |
| RF-5.2  | Al ENTREGADO: la solicitud pasa a COMPLETADA, el vehículo se libera y se emite `EntregaConfirmada`.                                                                                                                                                                                                                                                                                                                                                                                                                          |
| RF-5.3  | Al CANCELADO: el vehículo se libera y la solicitud vuelve a PENDIENTE. Si quien cancela es el **transportista**, debe indicar el **motivo** (se guarda en el flete y en su historial, y viaja en `EstadoFleteCambiado` al correo del productor).                                                                                                                                                                                                                                                                             |
| RF-5.3b | El transportista (o el admin) reporta una **incidencia en ruta** (motivo + si el vehículo queda fuera de servicio): el flete pasa a INCIDENCIA, la solicitud vuelve a la cola marcada para reasignar, el vehículo queda INACTIVO o DISPONIBLE, y se emite `IncidenciaEnRuta` (correo al productor).                                                                                                                                                                                                                          |
| RF-5.7  | **Seguimiento en tiempo real:** el transportista comparte su ubicación durante el viaje (una vez o en vivo). El sistema guarda cada punto (`FLETE#<id>/TRACK#<ts>`) y `flete.ultimaUbicacion`; solo se admite con el flete en curso y coordenadas dentro de Ecuador. El productor consulta `GET /fletes/:id` y `GET /fletes/:id/ruta` (polling 15 s) y ve un mapa con la ruta por carretera, el recorrido, la geocerca del acopio, un ícono de camión orientado al rumbo, y km restantes / ETA / progreso / estado de señal. |
| RF-5.8  | **Ruta y geocerca:** al asignar el flete se traza la ruta por carretera origen→acopio (`RoutingPort`; recta de respaldo si el servicio falla) y se guarda en el flete. Cuando el vehículo entra en la geocerca del acopio (`GEOCERCA_ACOPIO_M`, 300 m) con el flete `EN_RUTA`, el sistema confirma la entrega automáticamente (mismos efectos que RF-5.2).                                                                                                                                                                   |
| RF-5.4  | Cada cambio de estado emite `EstadoFleteCambiado` y dispara notificación por correo al productor.                                                                                                                                                                                                                                                                                                                                                                                                                            |
| RF-5.5  | Una tarea programada emite `RetrasoDetectado` para solicitudes PENDIENTE con más de 6 h sin asignar (una sola vez por solicitud).                                                                                                                                                                                                                                                                                                                                                                                            |
| RF-5.6  | El administrador consulta métricas operativas: tiempo medio de asignación, % de espera > 6 h, fletes por estado, tarifa media, pendientes, retrasos emitidos.                                                                                                                                                                                                                                                                                                                                                                |

### RF-6 Notificaciones

| ID     | Requerimiento                                                                                                                                                                                        |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RF-6.1 | El sistema envía correos por: código de confirmación, solicitud recibida, asignación (productor y transportista), cambio de estado, entrega, retraso detectado, incidencia en ruta, stock bajo/alto. |
| RF-6.2 | El envío es asíncrono (no bloquea la operación) e idempotente por evento/suscriptor.                                                                                                                 |

### RF-7 Inventario de centros de acopio

| ID     | Requerimiento                                                                                                                                               |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RF-7.1 | Al confirmar una entrega, el sistema suma las toneladas de esa carga al stock del acopio y cultivo correspondientes (subscriber sobre `EntregaConfirmada`). |
| RF-7.2 | El administrador registra salidas o correcciones de stock (delta con signo + motivo); el stock nunca baja de 0.                                             |
| RF-7.3 | El administrador fija por acopio y cultivo los umbrales `mínimo` y `máximo`.                                                                                |
| RF-7.4 | Cuando un movimiento hace que el stock cruce un umbral (cambia de estado), el sistema emite `StockBajo` o `StockAlto` y avisa por correo al administrador.  |
| RF-7.5 | El administrador consulta un tablero (`GET /admin/inventario`) con, por acopio, cada cultivo: cantidad actual, umbrales y estado (`BAJO` / `OK` / `ALTO`).  |

## 4. Requerimientos no funcionales

| ID     | Categoría         | Requerimiento                                                                                                                                           |
| ------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RNF-1  | Rendimiento       | 100 peticiones concurrentes sin errores; p99 < 30 ms en local.                                                                                          |
| RNF-2  | Arranque          | Código empaquetado y minificado para reducir el arranque en frío (≈ 2.7× más rápido que transpilar al vuelo).                                           |
| RNF-3  | Costo             | Persistencia y cómputo bajo demanda: $0 de infraestructura en inactividad.                                                                              |
| RNF-4  | Desacople         | Un fallo en un módulo (p. ej. asignación) no impide operar el portal ni el resto de funciones; la mensajería es asíncrona con reintentos y DLQ.         |
| RNF-5  | Seguridad         | Autenticación por token con rol; autorización por recurso (dueño/rol); contraseñas con hash bcrypt; validación de entrada con esquemas en cada handler. |
| RNF-6  | Usabilidad        | Mobile-First; confirmar un flete en ≤ 3 toques; objetivo Lighthouse móvil ≥ 90.                                                                         |
| RNF-7  | Conectividad      | Respuestas JSON compactas; portal servible como sitio estático + Service Worker para app-shell.                                                         |
| RNF-8  | Portabilidad      | La lógica de negocio no depende del framework HTTP ni del proveedor cloud; los adaptadores (persistencia, auth, eventos, correo) son intercambiables.   |
| RNF-9  | Infra como código | La infraestructura AWS se define en `infra/template.yaml` (SAM).                                                                                        |
| RNF-10 | Observabilidad    | Métricas y logs; en AWS, panel de CloudWatch con Init Duration, memoria y latencia de API Gateway.                                                      |
