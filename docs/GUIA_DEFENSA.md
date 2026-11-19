# Guía para la defensa de DomotiX

## Distribución sugerida de los 25 minutos

Los nombres siguen el orden proporcionado por el equipo. La asignación es una propuesta para ensayar, no una afirmación de quién escribió cada parte.

| Integrante | Tiempo | Tema y demostración |
| --- | --- | --- |
| DOUGLA OMAR MENDEZ HERNANDEZ | 5 min | Objetivo, dashboard, métricas y estados de actuadores de demostración. |
| SAMUEL VLADIMIR GODOY AYALA | 5 min | API REST, validación JSON, simulador e inserción de telemetría. |
| RODRIGO ALEXANDER VALIENTE IBARRA | 5 min | CloudFront, S3 privado, API Gateway, Lambda y CloudFormation. |
| KEVIN ALEJANDRO BURGOS BUSTILLO | 5 min | DynamoDB, claves SensorId y Timestamp, consultas, transacciones y retención. |
| CLAUDIA MARISOL RAMOS SIERRA | 5 min | Inicio de sesión, cookies, IAM, presupuesto y evidencias de costos. |

## Secuencia de demostración

1. Abrir la URL pública e iniciar sesión con la cuenta de prueba.
2. Registrar un sensor en una ubicación de prueba y crear su regla de alerta.
3. Insertar una lectura que supere el umbral. Mostrar la lectura, el valor del sensor y la alerta.
4. Editar el nombre y umbral del sensor; cambiar el estado de la regla y reconocer la alerta.
5. Filtrar el histórico por sensor y fechas. Eliminar la lectura de prueba.
6. Desactivar y eliminar el sensor; recargar y comprobar que ya no se muestra.
7. Mostrar arquitectura, tabla de lecturas y presupuesto. Explicar consumo real, cuotas y créditos.

Esta secuencia debe ensayarse en el despliegue real antes de la defensa. La colección Postman y la prueba automática complementan la demostración desde la interfaz.

## Preguntas para practicar

- ¿Por qué Lambda puede atender dos peticiones en instancias distintas y conservar la sesión? La sesión se guarda en DynamoDB, no en memoria de una función.
- ¿Por qué no está pública la tabla ni el bucket? El navegador accede a la API autenticada; Lambda usa un rol limitado. CloudFront lee el bucket mediante OAC.
- ¿Qué consulta usa el histórico? Query por SensorId y rango de Timestamp; no un Scan global de lecturas.
- ¿Cómo se evitan sobrescrituras simultáneas? Las operaciones relacionadas usan transacciones con condiciones sobre la versión de los registros.
- ¿Qué representa un actuador? Un estado de demostración persistente; todavía no existe conexión con equipo físico.
- ¿Por qué cambia el panel cada 5 segundos? Es la frecuencia de consulta en AWS; el simulador genera lecturas cada 5 segundos.
- ¿Una alerta de US$0.01 apaga los recursos? No. Budgets informa el consumo; se deben monitorear cuotas, créditos y recursos activos.
- ¿La baja elimina inmediatamente todos los datos? El nodo queda con un marcador de baja; sus datos dejan de aparecer y las lecturas y alertas expiran por TTL.

## Preparación y cierre

Preparación del equipo: 06:50–06:55 del 21 de noviembre de 2026. Defensa: 06:55–07:20. Todos deben dominar el flujo completo y explicar las limitaciones reales.

Antes de las 06:30 deben estar enviados el PDF y los seis elementos requeridos en Moodle, con el código y la nube coincidentes. Conservar el commit y manifiesto de la versión defendida. Las contribuciones del repositorio deben corresponder a trabajo real de cada integrante.
