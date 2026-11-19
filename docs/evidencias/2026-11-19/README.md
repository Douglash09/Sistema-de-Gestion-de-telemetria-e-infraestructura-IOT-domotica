# Evidencias de AWS — 19 de noviembre de 2026

Capturas reales de la consola durante una revisión de solo lectura. Documentan el estado previo a completar la migración; no acreditan todavía el CRUD completo en producción.

| Archivo | Contenido y uso en el documento |
| --- | --- |
| 01-consola-aws.png | Sesión de AWS y región Norte de Virginia. |
| 02-lambda-api-gateway.png | Función iot-telemetry-processor con desencadenador API Gateway. |
| 03-presupuesto-listado.png | Presupuesto Alerta-FreeTier-Proyecto de US$0.01; umbral superado. |
| 04-presupuesto-detalle.png | Costo real mostrado US$0.93; previsto US$1.48; 0/1 correos verificados. |
| 05-free-tier-resumen.png | Plan gratuito: la consola indica que sus costos se cubren con créditos. |
| 06-free-tier-cuotas.png | Ofertas gratuitas en uso; saldo mostrado de créditos US$198.33. |
| 07-dynamodb-tabla.png | Tabla TelemetryReadings existente. |
| 08-dynamodb-claves-capacidad.png | Claves SensorId y Timestamp; tabla activa, capacidad bajo demanda; recuento mostrado de 4 elementos. |
| 09-api-gateway-rutas.png | API iot-telemetry-api y recurso /telemetry. |
| 10-api-gateway-integracion.png | Integración con iot-telemetry-processor. |
| 11-s3-buckets.png | Listado de todas las regiones: no hay buckets de uso general. Evidencia de alojamiento S3 pendiente. |

## Hallazgos pendientes

- Verificar el correo destinatario del presupuesto. La consola muestra 0 de 1 verificados; no se accedió al correo ni se modificó la configuración.
- Identificar los servicios que originaron el costo acumulado. El costo mostrado en Budgets no equivale por sí solo a un cargo a la tarjeta: Free Tier muestra cobertura por créditos.
- Crear y comprobar el alojamiento del frontend. El listado S3 observado está vacío.
- Completar y probar autenticación y CRUD desde el dashboard desplegado; capturar crear, consultar, editar y eliminar registros de prueba.
- Capturar políticas IAM, distribución CloudFront, URL pública y resultados de Postman cuando se hayan verificado.
- Preparar el diagrama de arquitectura final, consistente con el despliegue real.

Estas imágenes incluyen identificadores de cuenta y recursos de AWS. Revisar su contenido antes de incluirlas en una entrega pública. No contienen contraseñas ni claves de acceso visibles.

Los importes y recursos corresponden al momento de la captura y pueden cambiar. Actualizar las evidencias antes de la entrega y del congelamiento de versión.
