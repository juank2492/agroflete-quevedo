# Despliegue de Agroflete Quevedo en AWS

Guía para `us-east-1` (N. Virginia), sin dominio comprado, con SMTP propio y pagos simulados. Se conserva el entorno local y se crea un entorno de producción independiente.

> Estado del proyecto: el código ya contiene handlers separados para AWS y conserva los entrypoints locales. `infra/template.yaml` define la infraestructura completa. Seguir esta guía crea recursos con costo en la cuenta AWS; revisar el conjunto de cambios antes de confirmarlo.

## 1. Qué se utilizará

| Parte                | En local                    | En AWS                                                |
| -------------------- | --------------------------- | ----------------------------------------------------- |
| Interfaz Angular     | Servidor de desarrollo      | S3 privado y CloudFront                               |
| API                  | Express en el equipo        | API Gateway HTTP API y Lambda                         |
| Datos                | DynamoDB Local en Docker    | DynamoDB, tabla independiente `AgrofleteTable-prod`   |
| Eventos internos     | Worker con intervalos       | Procesamiento de outbox con DynamoDB Streams y Lambda |
| Revisión de retrasos | Cron del worker             | EventBridge Scheduler y Lambda                        |
| Correo               | Configuración local/Mailpit | Proveedor SMTP real existente                         |
| Notificaciones push  | Configuración local         | Claves VAPID estables y acceso HTTPS                  |
| Pagos                | Simulación                  | La misma simulación, sin cobrar dinero                |
| Secretos             | `.env.local`                | AWS Secrets Manager                                   |
| Registros y alertas  | Consola                     | CloudWatch                                            |

La dirección pública será similar a `https://d123example.cloudfront.net`. AWS proporciona ese nombre y HTTPS: **no se entra mediante una IP fija**. No hace falta comprar dominio, configurar Route 53 ni emitir un certificado para un dominio propio.

El navegador accederá a la API mediante `https://d123example.cloudfront.net/api/...`. CloudFront enviará esas peticiones a API Gateway. Se mantiene la autenticación JWT de la aplicación; no se requiere incorporar Cognito.

## 2. Implementación preparada y revisiones obligatorias

Los siguientes puntos ya están implementados. Sirven para entender qué se desplegará y qué debe comprobarse antes de abrir el sistema a usuarios.

### 2.1. Adaptar la API a Lambda

- `api/src/entrypoints/lambda/api.ts` adapta toda la aplicación Express a API Gateway HTTP API sin ejecutar `listen()`.
- Las rutas raíz y proxy de SAM envían todos los métodos a la misma API, conservando validaciones, JWT y permisos por rol.
- SAM empaqueta los handlers TypeScript con esbuild e incluye `@agroflete/shared` y las dependencias de ejecución.
- Las funciones usan `nodejs24.x` y `arm64`. Confirmar que el runtime siga soportado en la [tabla oficial de runtimes](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html) antes de desplegar.

### 2.2. Separar configuración local y producción

La configuración conserva sus valores locales, pero en producción cambia su comportamiento:

- Cargar `.env.local` solo en desarrollo y excluirlo del paquete de despliegue.
- En producción, usar el endpoint normal de DynamoDB y las credenciales temporales del rol de Lambda mediante la cadena de credenciales del SDK. No configurar credenciales `local` ni claves permanentes en Lambda.
- El cliente ignora `DYNAMO_ENDPOINT` y las credenciales locales cuando `NODE_ENV=production`.
- Validar al arrancar que los secretos y valores de producción estén presentes; fallar ante configuraciones locales o un JWT de desarrollo.
- Cada handler carga el secreto antes de crear el contexto y lo reutiliza durante la vida de la instancia Lambda.
- No registrar contraseñas, tokens JWT, códigos de confirmación, datos de tarjetas ni el contenido completo del secreto.

Lambda obtiene sus permisos del [rol de ejecución](https://docs.aws.amazon.com/lambda/latest/dg/lambda-intro-execution-role.html). La plantilla ya concede a cada función acceso de lectura únicamente al secreto indicado en `AppSecretArn`, siguiendo la [integración con Secrets Manager](https://docs.aws.amazon.com/lambda/latest/dg/with-secrets-manager.html).

### 2.3. Sustituir el worker permanente

El worker con intervalos se conserva únicamente para local. En AWS se sustituye por:

1. Mantener el outbox persistente de la aplicación y habilitar Streams en la tabla con las imágenes necesarias.
2. Crear un consumidor Lambda que procese los registros de outbox correspondientes al evento recibido. Filtrar inserciones de outbox según las claves reales; no invocar el dispatcher completo por cada modificación de cualquier entidad.
3. Evitar bucles: actualizar el estado del outbox no debe disparar de nuevo el procesamiento inicial.
4. Hacer idempotentes los efectos por evento y suscriptor. Un reintento no debe duplicar asignaciones, movimientos o notificaciones internas. Para SMTP, contemplar que un fallo después de enviar puede producir un correo repetido.
5. Implementar reintentos, reporte de fallos parciales, límite de antigüedad y destino de errores. No capturar un error y devolver éxito si el evento necesita reintentarse.
6. Configurar una cola de errores y una recuperación documentada desde el outbox durable. Un mensaje de error debe permitir localizar y reprocesar el evento, sin depender de que el registro original siga en Streams.
7. Crear una función separada para detectar retrasos y una programación `rate(15 minutes)`, sin ventana flexible. Asignar al Scheduler permiso para invocar esa función y configurar sus reintentos y destino de errores.
8. Probar fallos de SMTP y eventos repetidos antes de habilitar el flujo para usuarios.

Streams con Lambda entrega eventos **al menos una vez**; no garantiza ejecución única. Véase [procesamiento con DynamoDB y Lambda](https://docs.aws.amazon.com/lambda/latest/dg/with-ddb.html). La programación requiere su propia configuración y permisos: [EventBridge Scheduler con Lambda](https://docs.aws.amazon.com/lambda/latest/dg/with-eventbridge-scheduler.html).

La plantilla retiró el bus y la cola sin consumidores. Utiliza una cola de errores para Streams, recuperación del outbox cada cinco minutos y otra cola para Scheduler.

### 2.4. Completar la infraestructura y el acceso web

Gestionar los recursos con `infra/template.yaml` para poder repetir y actualizar el despliegue. No crear manualmente otros recursos con los mismos nombres.

- DynamoDB: conservar PK/SK y los seis índices `gsi1` a `gsi6` que usan los repositorios; capacidad bajo demanda, recuperación a un momento dado y protección contra eliminación. Añadir políticas de retención de CloudFormation para eliminación y reemplazo.
- S3: bucket exclusivo para Angular, bloqueo de acceso público, cifrado y versionado. Usar el endpoint normal de S3, no el de alojamiento web público.
- CloudFront: origen S3 privado mediante OAC y política de bucket limitada a la distribución. Configurar HTTPS y certificado predeterminado de CloudFront. Véase [acceso privado con OAC](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html).
- API Gateway: HTTP API, etapa `prod`, integración Lambda, límites de solicitudes y registros de acceso sin datos sensibles.
- Permisos mínimos: API sobre la tabla e índices necesarios; consumidor sobre Streams, tabla y destino de errores; Scheduler sobre su función; lectura del secreto solo para las funciones que lo necesitan; permisos de logs correspondientes. No usar `AdministratorAccess` como rol de ejecución.
- Mantener inicialmente las funciones fuera de una VPC propia: usan servicios públicos, SMTP y servicios de mapas. Si se añade una VPC, diseñar salida a Internet; una subred pública no proporciona por sí sola Internet a Lambda. Véase [salida a Internet de Lambda en VPC](https://docs.aws.amazon.com/lambda/latest/dg/configuration-vpc-internet.html).
- Añadir grupos de logs con retención, alarmas, destinos de errores y los outputs de la sección 6.

Configuración de comportamientos de CloudFront:

| Comportamiento | Origen y configuración                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------- |
| Predeterminado | S3 privado; raíz `index.html`; caché de archivos estáticos                                                    |
| `/api/*`       | API Gateway; HTTPS al origen; todos los métodos HTTP; caché deshabilitada; reenviar autorización y parámetros |
| `/api`         | Manejo explícito coherente con la API, sin enviarlo al fallback de Angular                                    |

Para la API usar `CachingDisabled` y la política de solicitudes al origen `AllViewerExceptHostHeader`, prevista para API Gateway. No reenviar el `Host` de CloudFront como host del origen. Referencia: [políticas administradas de solicitudes al origen](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-managed-origin-request-policies.html).

El frontend de producción usa `apiUrl: '/api'` y Express monta sus rutas desde `/`. La CloudFront Function `FnQuitarPrefijoApi` elimina `/api` exactamente una vez:

`Navegador /api/salud → origen API Gateway /prod/salud → ruta Express /salud`.

`FnSpaRewrite` reescribe a `/index.html` únicamente las navegaciones sin extensión del comportamiento del frontend. No altera respuestas de API ni archivos estáticos ausentes.

El navegador y la API comparten el origen de CloudFront. Express mantiene `WEB_ORIGIN` para respuestas CORS, pero CORS no sustituye a la autenticación. La URL final debe configurarse sin barra final después del primer despliegue.

### 2.5. Datos iniciales y servicios externos

- El comando `pnpm --filter @agroflete/scripts bootstrap:prod` crea sin sobrescribir el administrador, los acopios, las tarifas y los ajustes. La sección 8 explica su uso.
- No ejecutar el seed de demostración sobre producción: contiene usuarios/datos de prueba y puede sobrescribir registros conocidos. Crear el administrador con contraseña fuerte y hash compatible con la aplicación, sin publicar un endpoint abierto de creación de administradores.
- No migrar automáticamente la base local. Cualquier importación de datos reales requiere una revisión separada, copia de seguridad y aprobación.
- Revisar la disponibilidad, límites y condiciones de los proveedores de mapas, teselas, geocodificación y rutas usados por el código. El endpoint público de OSRM configurado actualmente no debe asumirse como un servicio contratado con disponibilidad garantizada. Si el volumen exige otro proveedor o alojamiento, decidirlo antes de abrir el servicio.
- El service worker usa `/api/acopios`, que es información pública. No añadir respuestas privadas a esa caché; verificar separación por sesión de datos y operaciones offline.
- Mostrar claramente que los pagos son simulados, también en la versión publicada. No solicitar tarjetas reales ni realizar transferencias reales para probar depósitos.

## 3. Preparar acceso a AWS y herramientas

1. En la consola AWS seleccionar **N. Virginia (`us-east-1`)**. CloudFront se administra como servicio global.
2. Usar una identidad de trabajo con MFA; no trabajar con la cuenta raíz. Necesita permisos de despliegue para CloudFormation/SAM, IAM y los servicios de esta guía. Los permisos de quien despliega son distintos de los roles de Lambda.
3. En Billing, crear un presupuesto y alertas al correo del responsable. Elegir el importe según el presupuesto disponible; una alerta no impone un límite de gasto. No asumir que todo queda cubierto por la capa gratuita.
4. Instalar Git, una versión de Node compatible con el proyecto y el runtime elegido, pnpm según `packageManager` del repositorio, AWS CLI v2 y AWS SAM CLI. Docker solo es necesario para el entorno local o builds SAM que utilicen contenedores.
5. Configurar un perfil de AWS llamado `agroflete-prod`. Si la cuenta usa IAM Identity Center, utilizar `aws configure sso --profile agroflete-prod` y `aws sso login --profile agroflete-prod`. Si ya dispone de otro mecanismo de credenciales, usarlo con un perfil identificado; no crear claves permanentes por comodidad ni pegarlas en el repositorio.

Los comandos siguientes se ejecutan en una terminal desde la raíz del proyecto. No requieren modificar las variables permanentes de Windows.

```powershell
aws --version
sam --version
node --version
pnpm --version
aws sts get-caller-identity --profile agroflete-prod --region us-east-1
```

Verificar que `Account` es la cuenta correcta antes de cualquier escritura. Si la consola conserva variables AWS de pruebas locales, abrir una sesión limpia y comprobar de nuevo la identidad; no usar credenciales `local` para desplegar. No añadir `--endpoint-url` de DynamoDB Local a comandos de producción.

## 4. Crear el secreto de producción

En AWS, abrir **Secrets Manager → Store a new secret → Other type of secret**. Introducir los pares clave/valor, seleccionar `us-east-1` y guardar como `agroflete/prod/app`. Puede utilizarse inicialmente la clave administrada del servicio; una clave propia requiere permisos KMS adicionales.

Copiar únicamente los valores SMTP pertinentes desde el `.env.local` privado. No subir ese archivo completo, ni pegar secretos en este documento, Git, parámetros de comandos o capturas. Crear valores independientes para JWT y VAPID.

| Clave del secreto   | Configuración                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| `JWT_SECRET`        | Secreto aleatorio nuevo de alta entropía, mínimo 32 bytes; nunca el valor de desarrollo          |
| `SMTP_HOST`         | Host del proveedor real                                                                          |
| `SMTP_PORT`         | Puerto indicado por el proveedor                                                                 |
| `SMTP_USER`         | Usuario SMTP real, si el proveedor lo requiere                                                   |
| `SMTP_PASS`         | Contraseña SMTP o contraseña de aplicación                                                       |
| `SMTP_SECURE`       | `true` normalmente para TLS en 465; `false` normalmente para STARTTLS en 587, según el proveedor |
| `SMTP_FROM`         | Remitente autorizado por el proveedor; no usar `agroflete.local`                                 |
| `VAPID_PUBLIC_KEY`  | Clave pública del par de producción                                                              |
| `VAPID_PRIVATE_KEY` | Clave privada del mismo par; nunca enviarla al navegador                                         |
| `VAPID_SUBJECT`     | Contacto válido, por ejemplo `mailto:correo-del-responsable`                                     |

Generar las claves VAPID con una herramienta compatible con la biblioteca `web-push` del proyecto y guardarlas de forma segura. Mantener el mismo par entre despliegues; cambiarlo puede requerir nuevas suscripciones.

Copiar el ARN del secreto: se usará como referencia, no su contenido. No activar una rotación automática sin implementar cómo se actualizan y consumen las credenciales. Rotar JWT invalida sesiones existentes.

No se requiere Amazon SES si se mantiene el SMTP existente. Confirmar con ese proveedor que permite conexiones desde AWS, el remitente configurado y el volumen esperado. No desactivar validaciones TLS para solucionar errores.

## 5. Configuración no secreta de producción

La plantilla suministra estas variables a las funciones y los handlers leen el secreto indicado por `APP_SECRET_ARN`.

| Variable                            | Valor / criterio                                                            |
| ----------------------------------- | --------------------------------------------------------------------------- |
| `NODE_ENV`                          | `production`                                                                |
| `TABLE_NAME`                        | Referencia a `AgrofleteTable-prod` creada por el stack                      |
| `WEB_ORIGIN`                        | URL HTTPS final de CloudFront, sin barra final                              |
| `LOG_LEVEL`                         | `info`, sin registrar datos sensibles                                       |
| `JWT_EXPIRES_IN`                    | `8h` si se conserva la duración actual                                      |
| `CONF_CODE_TTL_MINUTES`             | `15` si se conserva el comportamiento actual                                |
| `ADMIN_EMAIL`                       | Correo real del responsable; no crea por sí solo el usuario administrador   |
| `PAGO_OBLIGATORIO`                  | `1`: exige el estado de pago del flujo, aunque el pago siga siendo simulado |
| `RETRASO_UMBRAL_HORAS`              | `6`, si se conserva la regla actual                                         |
| `OSRM_URL`                          | Endpoint aprobado para el uso previsto                                      |
| `GEOCERCA_ACOPIO_M`                 | `300`, si se conserva la regla actual                                       |
| `GEO_CENTRO_LAT` / `GEO_CENTRO_LON` | `-1.03` / `-79.46`, si se mantiene la cobertura local                       |
| `GEO_RADIO_KM`                      | `90`, si se mantiene la cobertura actual                                    |

`AWS_REGION` y las credenciales temporales las proporciona Lambda. No definir manualmente `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` ni `AWS_SESSION_TOKEN`. No configurar `DYNAMO_ENDPOINT` local. `API_PORT`, `OUTBOX_POLL_MS` y `CRON_DEMO` dejan de dirigir la ejecución serverless: los handlers y Scheduler sustituyen esos mecanismos.

El frontend solo recibe valores públicos, como `/api` y la clave pública VAPID mediante el mecanismo previsto por la app. Ninguna contraseña SMTP, clave privada VAPID o secreto JWT debe formar parte del build Angular.

## 6. Validar y desplegar la infraestructura

### 6.1. Comprobación previa

Ejecutar:

```powershell
pnpm install --frozen-lockfile
pnpm build:shared
pnpm typecheck
pnpm lint
pnpm test
pnpm test:web
pnpm --filter web build
sam validate --lint --template-file infra/template.yaml --region us-east-1 --profile agroflete-prod
sam build --template-file infra/template.yaml
```

Las pruebas que usan DynamoDB deben ejecutarse contra el entorno local de pruebas, nunca contra producción. Comprobar que no se han omitido pruebas de integración por ausencia de DynamoDB Local. Las pruebas web requieren Chrome/Chromium. No continuar ante errores de build, rutas faltantes o pruebas fallidas.

Verificar que `.aws-sam/build/template.yaml` y sus artefactos contienen los tres handlers y sus dependencias, sin archivos `.env.local`. Referencia: [construcción con SAM](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-building.html).

### 6.2. Parámetros y salidas de la plantilla

La plantilla recibe `Etapa`, `WebOrigin`, `AppSecretArn`, `AdminEmail` y `LogRetentionDays`.

Entrega `FrontendBucketName`, `DistributionId`, `FrontendUrl`, `ApiUrl`, `TablaNombre` y las URL de ambas colas de errores.

### 6.3. Primer despliegue

```powershell
sam deploy --guided --template-file .aws-sam/build/template.yaml --profile agroflete-prod --region us-east-1
```

Responder al asistente:

- Stack Name: `agroflete-prod`.
- AWS Region: `us-east-1`.
- Etapa: `prod`.
- WebOrigin inicial: `https://example.invalid`, únicamente para crear los recursos antes de conocer el dominio de CloudFront. No abrir todavía la app a usuarios.
- AppSecretArn: ARN del secreto creado, nunca su contenido.
- AdminEmail: el mismo correo que tendrá el administrador inicial y recibirá alarmas.
- LogRetentionDays: `30`, salvo que exista otra política aprobada.
- Confirm changes before deploy: sí.
- Allow SAM CLI IAM role creation: sí, tras revisar los roles y permisos mínimos.
- Disable rollback: no; conservar rollback ante fallos.
- Save arguments to configuration file: sí. Revisar que el archivo solo contenga referencias/configuración, nunca contraseñas.

SAM puede advertir que la API no tiene un autorizador de API Gateway. Solo aceptar si se ha comprobado que la autenticación y los roles están protegidos por la aplicación, y que las rutas públicas son las previstas. No eliminar autenticación para superar el aviso.

Revisar el conjunto de cambios: recursos esperados, ninguna eliminación/recreación de datos existentes y ningún permiso excesivo. SAM puede crear almacenamiento auxiliar para artefactos; no confundirlo con el bucket de Angular. Véase [despliegue con SAM](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/using-sam-cli-deploy.html).

En **CloudFormation → agroflete-prod → Events**, esperar `CREATE_COMPLETE`. Si falla, revisar el primer error relevante; no eliminar la tabla para reintentar.

### 6.4. Registrar URL y actualizar el origen permitido

```powershell
aws cloudformation describe-stacks --stack-name agroflete-prod --query "Stacks[0].Outputs" --output table --profile agroflete-prod --region us-east-1
```

Guardar `FrontendUrl`, `FrontendBucketName`, `DistributionId`, `ApiUrl` y `TablaNombre`. Actualizar `WebOrigin` con `FrontendUrl` ejecutando de nuevo `sam deploy --guided` con las mismas opciones; conservar `Etapa=prod`, el ARN y cualquier otro parámetro. Esto evita depender del dominio de una distribución todavía no creada.

Esperar `UPDATE_COMPLETE` y que CloudFront indique `Deployed`. Verificar que no queda `localhost` ni `example.invalid` en la configuración efectiva de producción.

## 7. Publicar Angular

1. Compilar con `pnpm --filter web build`.
2. Confirmar la carpeta de salida indicada por Angular. Normalmente será `web/dist/web/browser`; la carpeta que se sube es la que contiene `index.html`, `ngsw.json` y los bundles, no su directorio padre.
3. Sustituir los marcadores del ejemplo por los outputs reales. No ejecutar el ejemplo con los marcadores sin reemplazar.

```powershell
$frontendBuild = "web/dist/web/browser"
$frontendBucket = "REEMPLAZAR_CON_FrontendBucketName"
$distributionId = "REEMPLAZAR_CON_DistributionId"
Test-Path "$frontendBuild/index.html"
aws s3 sync "$frontendBuild" "s3://$frontendBucket" --exclude "index.html" --exclude "ngsw.json" --cache-control "no-cache" --profile agroflete-prod --region us-east-1
aws s3 cp "$frontendBuild/index.html" "s3://$frontendBucket/index.html" --cache-control "no-cache" --content-type "text/html" --profile agroflete-prod --region us-east-1
aws s3 cp "$frontendBuild/ngsw.json" "s3://$frontendBucket/ngsw.json" --cache-control "no-cache" --content-type "application/json" --profile agroflete-prod --region us-east-1
aws cloudfront create-invalidation --distribution-id "$distributionId" --paths "/*" --profile agroflete-prod
```

Si `Test-Path` devuelve `False`, detenerse y corregir la carpeta. Tras cada comando AWS, comprobar que terminó correctamente; no publicar los archivos de control si falló la subida de assets. Esperar la invalidación antes de verificar la nueva versión.

Esta publicación inicial usa revalidación para todos los archivos por sencillez. La política de caché del comportamiento S3 debe respetarla, con TTL mínimo cero. Posteriormente pueden darse tiempos largos solo a assets con hash, manteniendo revalidación para `index.html`, `ngsw.json`, scripts del service worker y manifiestos.

No usar `--delete` indiscriminadamente: clientes con un service worker anterior pueden necesitar bundles antiguos. Guardar los artefactos de cada versión y definir una limpieza posterior con periodo de conservación. El bucket debe seguir siendo privado después de publicar.

## 8. Inicializar y comprobar antes de abrir a usuarios

No usar `pnpm local:setup`, `pnpm db:seed` ni migraciones con `--reset` sobre AWS. El stack ya crea la tabla y no necesita importar la base local.

1. Copiar `infra/bootstrap-prod.example.json` como `infra/bootstrap-prod.local.json`.
2. Cambiar el correo, nombre, teléfono y todos los acopios por los datos reales. El archivo local está ignorado por Git. El correo debe ser el mismo `AdminEmail` entregado a SAM.
3. Obtener `TablaNombre` de los outputs del stack y comprobar una vez más la identidad AWS.
4. Ejecutar el bootstrap. La contraseña se guarda solo en la consola actual y se elimina al terminar:

```powershell
Copy-Item infra/bootstrap-prod.example.json infra/bootstrap-prod.local.json
# Editar infra/bootstrap-prod.local.json antes de continuar.

$env:AWS_PROFILE = "agroflete-prod"
$env:AWS_REGION = "us-east-1"
$env:TABLE_NAME = "AgrofleteTable-prod"
$env:CONFIRM_PRODUCTION = $env:TABLE_NAME
$env:ADMIN_PASSWORD = Read-Host "Contraseña fuerte del administrador" -MaskInput

aws sts get-caller-identity --profile agroflete-prod --region us-east-1
pnpm --filter @agroflete/scripts bootstrap:prod

Remove-Item Env:ADMIN_PASSWORD
Remove-Item Env:CONFIRM_PRODUCTION
Remove-Item Env:TABLE_NAME
Remove-Item Env:AWS_REGION
Remove-Item Env:AWS_PROFILE
```

El comando exige una tabla terminada en `-prod`, confirmación exacta, contraseña de al menos 12 caracteres y credenciales AWS reales. Es idempotente: crea los datos ausentes sin reemplazar administrador, tarifas, ajustes o acopios existentes. Guardar la contraseña en un gestor seguro y eliminar `infra/bootstrap-prod.local.json` cuando ya no se necesite.

Lista de aceptación:

- [ ] `https://DOMINIO-CLOUDFRONT/api/salud` devuelve la respuesta de salud de la API, no HTML de Angular.
- [ ] La interfaz abre por HTTPS y recargar una ruta interna no produce 403/404.
- [ ] El bucket no permite acceso público directo y la consola del navegador no muestra llamadas a localhost.
- [ ] Registro, confirmación por correo, inicio/cierre de sesión y expiración de sesión funcionan.
- [ ] Un usuario sin sesión recibe rechazo en rutas privadas; cada rol solo accede a sus operaciones y datos. Comprobar también el endpoint directo de API Gateway.
- [ ] El administrador inicial puede entrar y no existen credenciales de demostración habilitadas.
- [ ] Se crea una solicitud, se calcula tarifa, se asigna transporte y se completa el flujo con datos de prueba controlados.
- [ ] El pago simulado permite probar éxito/rechazo con datos ficticios; la interfaz no promete un cobro real. La revisión de depósitos tampoco implica verificación bancaria real.
- [ ] Los eventos del outbox se procesan y reintentar uno no duplica efectos de negocio.
- [ ] SMTP entrega a una dirección real controlada; comprobar remitente, spam, errores y límites del proveedor.
- [ ] Push funciona en un navegador compatible tras conceder permiso; denegar permiso no rompe la aplicación.
- [ ] GPS, mapas, rutas y geocercas funcionan mediante HTTPS en un teléfono real.
- [ ] El service worker se actualiza y el modo offline no mezcla datos ni solicitudes de distintas sesiones.
- [ ] Scheduler está habilitado, ejecuta su Lambda y aplica el umbral de retraso previsto.
- [ ] Los fallos terminan en el destino de errores previsto y existe una forma probada de recuperarlos.
- [ ] Logs y respuestas no filtran secretos, datos sensibles ni trazas internas innecesarias.
- [ ] La tabla tiene recuperación habilitada y se ha comprobado cómo restaurarla.

No considerar terminado el despliegue porque `/salud` responda: también deben funcionar los procesos asíncronos, el correo y los permisos.

## 9. Operación, copias y actualizaciones

La plantilla crea alarmas para errores de Lambda, respuestas 5xx, throttling de DynamoDB, antigüedad de Streams y mensajes en ambas colas de errores. Confirmar el correo de suscripción SNS que AWS enviará a `AdminEmail`; sin esa confirmación no llegarán alertas. Revisar los umbrales según el tráfico real y provocar una alerta controlada para comprobar la entrega.

Definir retención de logs, por ejemplo 30 días como punto de partida a aprobar según necesidades de soporte y privacidad. Revisar el dashboard existente: sus métricas deben corresponder a los recursos realmente desplegados. Revisar también el gasto en Billing, incluyendo CloudFront, logs, secretos y copias.

Para actualizar:

1. Conservar artefactos y configuración de la versión anterior sin incluir secretos.
2. Probar localmente y repetir validación/build. Desplegar primero una API compatible con el frontend anterior.
3. Revisar el conjunto de cambios de SAM, especialmente reemplazos de tabla, índices y cambios de permisos.
4. Desplegar backend, publicar frontend como en la sección 7 y verificar la lista de aceptación pertinente.
5. Si falla la aplicación, redeplegar los artefactos anteriores compatibles. Para Angular, restaurar el conjunto de archivos de esa versión, incluido `ngsw.json`, e invalidar CloudFront; restaurar solo `index.html` no basta.

Una restauración de DynamoDB crea otra tabla: requiere validar los datos, índices y Streams, y actualizar referencias/permisos antes del cambio. Practicar la recuperación sin reemplazar la tabla activa. No borrar el stack como mecanismo de rollback ni asumir que deshacer código revierte escrituras de datos.

El flujo CI actual no publica automáticamente en AWS. La primera publicación puede ser manual siguiendo esta guía; una automatización posterior debe usar identidad federada/OIDC y permisos acotados, sin claves AWS permanentes en Git.

## 10. Problemas habituales

| Síntoma                                        | Revisar                                                                                   |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Lambda intenta conectar con `localhost:8010`   | Configuración local todavía activa en el cliente DynamoDB                                 |
| Credenciales inválidas o acceso denegado       | Rol, permisos de tabla/índices/secreto y ausencia de credenciales locales explícitas      |
| Error de handler o módulo no encontrado        | Handler exportado, artefacto SAM y dependencias del workspace                             |
| `/api/...` devuelve HTML o 404                 | Comportamiento CloudFront, eliminación única de `/api`, etapa `/prod` y registro de rutas |
| Login funciona pero otras llamadas reciben 401 | Reenvío de `Authorization`, token y configuración JWT                                     |
| Error CORS                                     | `WEB_ORIGIN` definitivo y configuración del HTTP API/middleware                           |
| SMTP falla                                     | Host, puerto, TLS, remitente autorizado, credenciales, límites y salida a Internet        |
| Solicitud guardada pero no llega notificación  | Streams, filtro outbox, consumidor, permisos, estado por suscriptor y cola de errores     |
| No se detectan retrasos                        | Scheduler, rol de invocación, función y umbral configurado                                |
| Push no llega                                  | HTTPS, permiso, suscripción vigente y consistencia de claves VAPID                        |
| Sigue apareciendo una versión anterior         | Publicación completa, caché, invalidación y actualización del service worker              |

El resultado esperado es una app accesible por la URL HTTPS de CloudFront, con datos independientes en AWS, correo SMTP real y pagos explícitamente simulados. Los recursos y credenciales locales permanecen en el equipo.
