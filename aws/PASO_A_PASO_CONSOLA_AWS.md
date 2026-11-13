# Guía Paso a Paso en la Consola de AWS (Free Tier)
**Proyecto Final: Cómputo en la Nube – UNICAES**  
**Arquitectura Serverless: DynamoDB + Lambda + API Gateway**

---

## 📌 Paso 1: Configurar AWS Budgets ($0.01 USD)
*Requisito obligatorio de la rúbrica (Norma 2).*

1. Entra a la consola de AWS: https://console.aws.amazon.com/
2. En la barra de búsqueda superior escribe **Budgets** y selecciona **AWS Budgets**.
3. Haz clic en el botón naranja **Create budget** (Crear presupuesto).
4. Elige **Cost budget (Recommended)** y haz clic en **Next**.
5. Configura los campos:
   - **Budget name:** `Alerta-FreeTier-Proyecto`
   - **Period:** `Monthly` (Mensual)
   - **Budget effective date:** `Recurring budget`
   - **Budgeting method:** `Fixed`
   - **Enter budgeted amount ($):** `0.01`
6. Haz clic en **Next**.
7. Configura la alerta:
   - Haz clic en **Add an alert threshold**.
   - En **Triggered based on**, elige **Actual**.
   - En **% of budgeted amount**, pon **100** (avisará si el gasto real llega a $0.01).
   - En **Email recipients**, pon tu correo institucional o personal.
8. Haz clic en **Next** hasta llegar al final y presiona **Create budget**.
9. 📸 *Toma una captura de pantalla donde se vea el presupuesto de $0.01 activo (Evidencia para el informe y la defensa).*

---

## 📌 Paso 2: Crear la Base de Datos en Amazon DynamoDB
1. En la barra de búsqueda de AWS escribe **DynamoDB** y entra al servicio.
2. Haz clic en el botón naranja **Create table** (Crear tabla).
3. Rellena los datos exactamente así:
   - **Table name:** `TelemetryReadings`
   - **Partition key:** `SensorId` (Tipo: **String**)
   - **Sort key:** `Timestamp` (Tipo: **String**)
   - **Table settings:** Elige **Customized settings** (Configuración personalizada):
     - En **Capacity mode**, selecciona **On-demand** (Bajo demanda, totalmente dentro del Free Tier).
4. Baja hasta el final y haz clic en **Create table**.
5. Espera unos 15 segundos hasta que el estado cambie a **Active** (Verde).

---

## 📌 Paso 3: Crear la Función en AWS Lambda
1. En la barra de búsqueda de AWS escribe **Lambda** y entra al servicio.
2. Haz clic en el botón naranja **Create function**.
3. Selecciona **Author from scratch** (Crear desde cero):
   - **Function name:** `iot-telemetry-processor`
   - **Runtime:** `Node.js 20.x` (o `Node.js 22.x`)
   - **Architecture:** `x86_64`
4. Haz clic en **Create function**.
5. **Asignar permisos para escribir en DynamoDB:**
   - En la página de la función, ve a la pestaña **Configuration** (Configuración) → Menú izquierdo **Permissions** (Permisos).
   - Haz clic sobre el enlace azul del **Role name** (te abrirá la consola de IAM).
   - En la consola de IAM, haz clic en **Add permissions** → **Attach policies**.
   - En el buscador de políticas escribe `AmazonDynamoDBFullAccess`, marca la casilla y presiona **Add permissions**.
   - *(Ya puedes cerrar esa pestaña de IAM y regresar a Lambda).*
6. **Pegar el código de la función:**
   - En Lambda, vuelve a la pestaña **Code** (Código).
   - En el editor de texto reemplaza todo el contenido del archivo `index.mjs` por el código que está en el archivo local:
     `aws/lambda/index.mjs` de este repositorio.
   - Haz clic en el botón azul **Deploy** para guardar y desplegar los cambios.

---

## 📌 Paso 4: Crear la API Pública en Amazon API Gateway
1. En la barra de búsqueda de AWS escribe **API Gateway** y entra al servicio.
2. Busca la tarjeta que dice **HTTP API** y haz clic en **Build** (Crear).
3. En el paso 1 (Create an API):
   - Haz clic en **Add integration** → Selecciona **Lambda**.
   - En **Lambda function**, busca y selecciona `iot-telemetry-processor`.
   - En **API name**, escribe `iot-telemetry-api`.
   - Haz clic en **Next**.
4. En el paso 2 (Configure routes):
   - En **Method**, selecciona **ANY** (o crea una ruta con **POST** y otra con **GET**).
   - En **Resource path**, escribe `/telemetry`.
   - En **Integration target**, asegúrate de que esté seleccionada `iot-telemetry-processor`.
   - Haz clic en **Next**.
5. En el paso 3 (Configure stages):
   - Deja el stage `$default` con **Auto-deploy: Enabled**.
   - Haz clic en **Next** y luego en **Create**.
6. **Activar CORS:**
   - En el menú izquierdo de API Gateway, haz clic en **CORS**.
   - Haz clic en **Configure**:
     - **Access-Control-Allow-Origin:** Pon `*` y haz clic en **Add**.
     - **Access-Control-Allow-Headers:** Escribe `content-type,x-api-key,authorization` y haz clic en **Add**.
     - **Access-Control-Allow-Methods:** Marca `GET`, `POST`, `OPTIONS`.
   - Haz clic en **Save**.
7. **Copiar tu URL pública:**
   - En el menú izquierdo ve a **Routes** o a la pantalla principal de la API.
   - Copia la **Invoke URL** (tiene un formato parecido a: `https://a1b2c3d4.execute-api.us-east-1.amazonaws.com`).

---

## 📌 Paso 5: Probar y Verificar en Vivo
Desde la terminal de tu computadora en la carpeta del proyecto, ejecuta:

```powershell
node aws/test-cloud-api.js https://TU-INVOKE-URL-AQUI.execute-api.us-east-1.amazonaws.com
```

### ¿Qué verás?
1. Se enviará una lectura normal y responderá con `Status HTTP: 201`.
2. Se enviará una lectura crítica (> 35 °C) que activará el estado de alerta.
3. Se realizará una petición `GET` que mostrará las lecturas guardadas directamente en DynamoDB.
4. Si vas a la consola de DynamoDB → **Tables** → `TelemetryReadings` → **Explore table items**, verás tus registros en vivo en la nube.
