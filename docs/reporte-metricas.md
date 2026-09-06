# Reporte de métricas — entorno local

> El **cold start real** (Init Duration) y la latencia de API Gateway solo pueden medirse
> tras el despliegue en AWS (Fase A). Aquí se registran las mediciones locales que sirven
> de base de comparación y sustentan el relato de optimización de arranque del documento.

## 1. Prueba de carga — 100 peticiones concurrentes

Escenario del documento ("carga base 100 peticiones simultáneas"). Herramienta: `autocannon`.
Ejecución: `pnpm test:load --url <endpoint> --duration 15`. API local (Express + DynamoDB Local).

| Endpoint       | Tipo                         | req/s (media) |   p50 | p97.5 |   p99 | Errores / timeouts |
| -------------- | ---------------------------- | ------------: | ----: | ----: | ----: | -----------------: |
| `GET /salud`   | sin acceso a datos           |        ~6 437 | 15 ms | 20 ms | 26 ms |              0 / 0 |
| `GET /acopios` | lectura sobre DynamoDB Local |        ~6 810 | 14 ms | 17 ms | 19 ms |              0 / 0 |

- El backend sostiene 100 conexiones concurrentes sin errores ni timeouts, con latencia p99 < 30 ms.
- La lectura contra la base no degrada la latencia frente al endpoint trivial (partición pequeña,
  consulta por índice, sin _scan_).
- Máquina de referencia: Windows 11, Node 26, Docker vía WSL.

## 2. Arranque del servicio — bundle vs. transpilación al vuelo

`pnpm test:coldstart` mide el tiempo desde el _spawn_ del proceso hasta que el servidor
imprime "escuchando" (5 rondas, se reporta media y mínimo).

| Variante                                                     |   Media |  Mínimo |
| ------------------------------------------------------------ | ------: | ------: |
| `tsx` (transpila el TypeScript en cada arranque)             | ~743 ms | ~723 ms |
| Bundle `esbuild --bundle --minify` (un solo archivo, 1.2 MB) | ~269 ms | ~260 ms |

- Empaquetar y minimizar el código reduce el tiempo hasta "listo" **~2.7×**.
- Esto es la contraparte local de la recomendación del documento (Node.js + poda de
  dependencias) para mitigar el arranque en frío en FaaS.
- El bundle se genera con `pnpm --filter @agroflete/api build:bundle` → `api/dist-bundle/server.mjs`.

## 3. Memoria

`process.memoryUsage()` del servidor en reposo tras el arranque: RSS ≈ 90–120 MB.
En Lambda esto se traduce en un `MemorySize` cómodo de 256–512 MB (a confirmar con
`Max Memory Used` del panel de CloudWatch en la Fase A).

## 4. Pendiente en AWS (Fase A)

- Init Duration (cold start) real de cada Lambda desde el CloudWatch Dashboard.
- Latencia p50/p95 de API Gateway.
- Re-ejecutar la carga (k6/autocannon) contra la URL de API Gateway.
