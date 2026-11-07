# DomotiX IoT · Gestión de Telemetría e Infraestructura IoT Domótica

**Universidad Católica de El Salvador (UNICAES)**  
**Facultad de Ingeniería y Arquitectura**  
**Cátedra:** Cómputo en la Nube – Grupo B  
**Docente:** Ing. Herberth Contreras  
**Ciclo Académico:** 2026  

---

## 👥 Reparto de Roles del Equipo (5 Integrantes)

| Rol | Integrante | Responsabilidad Principal |
| :--- | :--- | :--- |
| **Desarrollador 1** | Frontend Core | Panel en tiempo real para visualización de métricas de sensores y control switch para actuadores. |
| **Desarrollador 2** | Backend & Mock IoT Data | Script simulador de envío de telemetría IoT y servidor de APIs REST. |
| **Desarrollador 3** | Cloud Serverless Lead | Arquitectura e integración en AWS (API Gateway + AWS Lambda). |
| **Desarrollador 4** | Database Architect | Optimización de consultas en base de datos tipo Time-Series (SQLite / DynamoDB). |
| **Desarrollador 5** | Security & Auth | Gestión de autenticación de administradores (`scrypt`, sesiones seguras) y aislamiento de `.env`. |

---

## 🎨 Prototipo Interactivo en Figma (Laboratorio 2)

El diseño UI/UX y flujo completo de interacción para la plataforma web administrativa se encuentra en Figma:
- **Enlace al Prototipo en Figma:** `[Pega aquí el enlace de tu proyecto de Figma]`
- **Flujos modelados:** Autenticación administrativa, panel de control en tiempo real, administración de nodos (CRUD), consulta histórica con filtros temporales y configuración de alertas de sobrecalentamiento/fallo.

---

## 🌿 Estrategia de Ramas en Git (Git Flow)

Siguiendo los lineamientos de la rúbrica oficial de la cátedra:
- `main`: Rama de producción y entregas estables.
- `develop`: Rama principal de integración y desarrollo.
- `feature/...`: Ramas individuales por funcionalidad para cada uno de los integrantes del equipo:
  - `feature/frontend-core` (Desarrollador 1)
  - `feature/backend-api-simulator` (Desarrollador 2)
  - `feature/cloud-serverless` (Desarrollador 3)
  - `feature/database-timeseries` (Desarrollador 4)
  - `feature/security-auth` (Desarrollador 5)

---

## 🚀 Inicio Rápido (Entorno Local)

### 1. Requisitos
- **Node.js 22.13 o superior** (sin dependencias externas pesadas).

### 2. Configuración de Variables de Entorno
Copia la plantilla de variables antes del primer arranque:
```powershell
Copy-Item .env.example .env
```

### 3. Ejecutar el Servidor
```powershell
npm.cmd start
# o directamente:
node --env-file-if-exists=.env src/server.js
```
Abre en tu navegador: **http://127.0.0.1:3000**

**Credenciales iniciales:**
- **Correo:** `admin@local.test`
- **Contraseña:** `CambiaEstaClave2026!`

---

## 📡 Pruebas de API (Postman y Thunder Client)

El repositorio incluye colecciones completas listas para importar y probar los procesos CRUD:

1. **Postman:** Archivo `postman_collection.json`.
   - Abre Postman → **Import** → Selecciona `postman_collection.json`.
   - Ejecuta primero `POST Iniciar Sesión (Login)` para almacenar la cookie de sesión automáticamente.
   - Prueba las peticiones de Nodos, Telemetría, Histórico y Reglas.

2. **Thunder Client (Extensión de VS Code):** Archivo `thunder-collection.json`.
   - En la pestaña de Thunder Client en VS Code → **Collections** → **Import** → `thunder-collection.json`.

---

## ⚙️ Estructura del Proyecto

```text
├── public/                 # Frontend: HTML semántico, CSS responsivo y lógica JS
│   ├── index.html          # Vista unificada (Login + Dashboard + Modales)
│   ├── styles.css          # Estilos modernos y adaptables
│   └── app.js              # Cliente reactivo con Server-Sent Events (SSE)
├── src/                    # Backend modular en Node.js
│   ├── server.js           # Servidor HTTP nativo, endpoints REST, SQLite y auth
│   └── simulator.js        # Script de simulación autónoma de telemetría IoT
├── tests/                  # Suite de pruebas automatizadas
│   └── api.test.js         # Pruebas integrales de API, persistencia y seguridad
├── postman_collection.json # Colección de pruebas para Postman (v2.1.0)
├── thunder-collection.json # Colección de pruebas para Thunder Client (VS Code)
├── preparar-windows.ps1    # Script de automatización de entorno para Windows
├── .env.example            # Plantilla de variables de entorno (sin credenciales)
└── .gitignore              # Exclusión de credenciales, node_modules y base de datos
```

---

## ☁️ Integración en la Nube (AWS Free Tier - Hoja de Ruta Fase 2)

Para la entrega y defensa final (Parcial del 21 de noviembre), la solución se desplegará en la nube bajo la **Opción A (Arquitectura Serverless)**:
- **Frontend:** Amazon S3 (Hosting estático) + Amazon CloudFront (CDN).
- **Backend / API:** Amazon API Gateway + AWS Lambda (Node.js).
- **Base de Datos:** Amazon DynamoDB (NoSQL Time-Series con `SensorId` como Partition Key y `Timestamp` como Sort Key).
- **Presupuesto:** AWS Budgets configurado con alerta de $0.01 USD para control de costos.
