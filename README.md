# NODO · Gestión de telemetría e infraestructura IoT

Implementación de la **fase 1 local** del Proyecto 2 de Cómputo en la Nube. Dashboard de sensores de temperatura, humedad y consumo eléctrico, con control de actuadores, API, simulación y almacenamiento persistente. Interfaz en español, adaptable a móviles y escritorio.

## Abrir y ejecutar en Visual Studio Code

1. Abre esta carpeta con **Archivo → Abrir carpeta**.
2. Necesitas **Node.js 22.13 o superior** (en este equipo se verificó con 22.19). No requiere instalar paquetes ni extensiones.
3. Abre **Terminal → Nueva terminal** y ejecuta:

   ```powershell
   npm start
   ```

   Si PowerShell bloquea `npm.ps1`, usa `npm.cmd start` o directamente:

   ```powershell
   node --env-file=.env src/server.js
   ```

4. Abre **http://127.0.0.1:3000**.
5. Acceso inicial de este entorno local:
   - Correo: `admin@local.test`
   - Contraseña: `CambiaEstaClave2026!`
6. Para detener el servidor, presiona **Ctrl+C** en la terminal. Para depurarlo, usa **F5 → Iniciar sistema IoT**.

Node puede mostrar un aviso de que SQLite es experimental. No impide ejecutar la aplicación. Si el puerto está ocupado, detén el servidor anterior o cambia `PORT` en `.env`.

## Funciones

- **Vista general:** métricas, gráfica por sensor, estado de conexión, control de actuadores y actividad reciente. Los datos en vivo se reciben mediante Server-Sent Events.
- **Dispositivos:** crear nodos, filtrar por ubicación, editar nombre y umbral, activar o desactivar. Solo se pueden eliminar nodos desactivados; la eliminación también elimina sus lecturas, reglas y alertas.
- **Historial:** inserción manual de lecturas por API desde la interfaz, filtros por sensor y fechas, exportación CSV y eliminación individual de datos de prueba. Muestra hasta 1,000 resultados recientes.
- **Reglas y alertas:** crear condiciones mayor o menor que un límite, editar valores, activar o desactivar reglas, eliminarlas y marcar alertas como atendidas. Una regla no crea otra alerta mientras tenga una pendiente. Atender una alerta permite que una lectura posterior vuelva a generarla.
- **Autenticación:** administrador, contraseñas con scrypt y sal aleatoria, cookie HttpOnly y SameSite, sesiones de ocho horas y límite de intentos. Los cambios están protegidos por sesión o clave del simulador.
- **Persistencia:** SQLite con claves foráneas e índice compuesto por sensor y timestamp. Las lecturas incluyen timestamp UTC e identificador único. Los datos sobreviven al reinicio.

El umbral del dispositivo es un valor de referencia editable. Las reglas de alarma son independientes: edítalas en **Reglas y alertas** para cambiar las condiciones que generan eventos.

## Simulación

En el primer inicio se crean cuatro sensores, dos actuadores, reglas iniciales y una hora de lecturas de muestra. El simulador integrado envía datos JSON a `/api/telemetry` cada cinco segundos. Solo simula sensores habilitados. Los actuadores guardan el estado solicitado; no controlan hardware físico.

Para detener la generación automática, cambia `SIMULATOR_ENABLED=false` en `.env` y reinicia. También hay un simulador externo:

```dotenv
IOT_API_KEY=una-clave-larga-y-aleatoria
SENSOR_ID=identificador-del-sensor
API_URL=http://127.0.0.1:3000
```

Configura la misma clave en el servidor, deshabilita el simulador integrado si no quieres duplicar datos, reinicia y ejecuta `npm run simulate` en otra terminal. Obtén el ID del sensor en la respuesta de `/api/devices` desde una sesión autenticada. La clave no se entrega al navegador.

## Estructura

```text
public/           Interfaz HTML, CSS y JavaScript
src/server.js     Servidor HTTP, API, autenticación, SQLite y simulador integrado
src/simulator.js  Simulador independiente opcional
tests/            Prueba integral de la API y persistencia
.vscode/          Configuración para depurar con F5
.env.example      Plantilla de variables, sin secretos reales
data/             Base local autogenerada, excluida de Git
```

`.env` está excluido de Git. En otra computadora, copia `.env.example` a `.env` y configura tus propias credenciales **antes del primer arranque**. El usuario solo se crea al inicializar una base vacía; cambiar `ADMIN_PASSWORD` después no cambia la contraseña ya almacenada. Si omites la contraseña al crear una base, el servidor genera una y la muestra una sola vez en su terminal. Las sesiones se pierden al reiniciar.

El servidor escucha solo en `127.0.0.1` por defecto. La autenticación HTTP está pensada para esta fase local. Antes de publicar, la fase 2 deberá incorporar HTTPS, gestión de secretos, sesiones compartidas y políticas de acceso adecuadas.

## API local

Todas las rutas requieren sesión, salvo el inicio de sesión y la entrada de telemetría con `X-API-Key` válida.

| Método | Ruta | Uso |
|---|---|---|
| POST | `/api/login` | `{email,password}` |
| GET / POST | `/api/me`, `/api/logout` | Sesión actual / salir |
| GET / POST | `/api/devices` | Listar / crear nodo |
| PATCH / DELETE | `/api/devices/:id` | Actualizar / eliminar nodo inactivo |
| POST | `/api/telemetry` | `{device_id,value,timestamp?}` |
| GET | `/api/readings?device_id=...&from=...&to=...` | Consultar historial |
| DELETE | `/api/readings/:id` | Eliminar lectura de prueba |
| GET / POST | `/api/rules` | Listar / crear regla |
| PATCH / DELETE | `/api/rules/:id` | Actualizar / eliminar regla |
| GET | `/api/alerts` | Últimas 100 alertas |
| PATCH | `/api/alerts/:id` | Marcar como atendida |
| GET | `/api/events` | Actualizaciones SSE |

Crear nodo: `{name,location,type,threshold}`, con tipo `temperature`, `humidity`, `energy` o `actuator`. Crear regla: `{name,device_id,operator,threshold}`, con operador `>` o `<`. Los filtros de fecha aceptan ISO 8601; las fechas de la interfaz se convierten de la zona horaria del navegador a UTC.

## Validación

```powershell
npm test
```

La prueba ejecuta un servidor aislado con una base temporal. Verifica acceso no autorizado, credenciales, validación, CRUD, entrada con clave de simulador, filtros, alarmas, reconocimiento de eventos, persistencia tras reiniciar y eliminación en cascada.

## Fase 2: pendiente

No se ha creado ni desplegado infraestructura AWS. El documento propone API Gateway para el endpoint HTTP, Lambda para procesar lecturas y DynamoDB con `SensorId` como partición y `Timestamp` como ordenación. La migración requerirá adaptar almacenamiento, autenticación, ejecución del simulador y actualizaciones en vivo; esta entrega conserva esas responsabilidades en el equipo local.
