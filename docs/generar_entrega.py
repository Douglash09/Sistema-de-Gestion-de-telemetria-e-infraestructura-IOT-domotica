"""Genera el informe de entrega a partir de evidencias comprobadas."""
from pathlib import Path
source=Path(__file__).with_name('generar_informe.py').read_text(encoding='utf-8')
setup=source.split("new('Sistema de gestión de telemetría IoT')")[0]
exec(setup.replace('Informe_preparacion_AWS.pdf','Informe_entrega_AWS.pdf').replace('Preparación y evidencias del despliegue AWS de DomotiX','Informe de entrega AWS de DomotiX'))

new('Sistema de gestión de telemetría IoT')
p('<b>Informe técnico de entrega en AWS</b>')
p('Universidad Católica de El Salvador<br/>Cómputo en la Nube · Grupo B<br/>Docente Ing. Herberth Contreras')
h('Resultado')
p('DomotiX está publicado en AWS. La pila domotix-dashboard finalizó en CREATE_COMPLETE. La prueba de integración aprobó 19 comprobaciones; la colección Postman ejecutada con Newman aprobó 17 solicitudes y 18 aserciones sin fallos. El panel consulta cada 5 segundos y el simulador genera lecturas con una cadencia aproximada de 5 segundos.')
h('Integrantes')
p('DOUGLA OMAR MENDEZ HERNANDEZ<br/>SAMUEL VLADIMIR GODOY AYALA<br/>RODRIGO ALEXANDER VALIENTE IBARRA<br/>KEVIN ALEJANDRO BURGOS BUSTILLO<br/>CLAUDIA MARISOL RAMOS SIERRA')
p('Los carnés no fueron proporcionados. La distribución de temas de la guía de defensa es una propuesta para ensayar; no certifica la autoría del código.',small)
h('Fechas de entrega y defensa')
p('Entrega en Moodle y congelamiento: antes de las 06:30 del sábado 21 de noviembre de 2026, hora de El Salvador. Preparación: 06:50–06:55. Defensa: 06:55–07:20. El equipo debe conservar la misma versión de código y nube después del cierre.')
p('Este informe reúne resultados técnicos comprobados y pendientes académicos. No acredita todavía el envío en Moodle, el ensayo individual ni aportes Git de cinco autores.')

new('Enlaces y acceso de prueba')
h('Dashboard público')
p('<link href="https://d2pcuv7vmsa2tj.cloudfront.net">https://d2pcuv7vmsa2tj.cloudfront.net</link>')
h('Credenciales de demostración')
p('Correo: douglas.mendez1@catolica.edu.sv<br/>Contraseña: Omar1010')
h('API y colección')
p('Base desde CloudFront:<br/><link href="https://d2pcuv7vmsa2tj.cloudfront.net/api">https://d2pcuv7vmsa2tj.cloudfront.net/api</link><br/>Base directa:<br/>https://enbhdlt7v3.execute-api.us-east-1.amazonaws.com/api')
p('Colección: aws/postman-dashboard.json. Importarla en Postman, usar la URL CloudFront sin /api en baseUrl y definir password como variable local. Ejecutar las solicitudes en orden; la colección retira sus propios registros temporales.')
h('Repositorio')
p('<link href="https://github.com/Douglash09/Sistema-de-Gestion-de-telemetria-e-infraestructura-IOT-domotica">Abrir repositorio de GitHub</link>')
p('Ruta de la colección en el repositorio:<br/>aws/postman-dashboard.json<br/>Guía de despliegue: aws/DESPLIEGUE_DASHBOARD.md<br/>Guía de defensa: docs/GUIA_DEFENSA.md')
h('Versión de los archivos')
manifest=json.loads((ROOT/'aws/build/manifest.json').read_text())
p('Huella SHA256 del frontend:<br/>'+manifest['frontendSha256'],small)
p('Huella SHA256 del backend:<br/>'+manifest['backendSha256'],small)
p('Código y evidencias publicados en el commit 6b2a4d408cdf442db07fc91009c5040b29f10fce. main y develop se verificaron en ese commit. Este informe actualizado puede corresponder a un commit documental posterior. Registrar la revisión final antes del congelamiento.',small)

new('Arquitectura y seguridad')
p('Navegador HTTPS → CloudFront → S3 privado para HTML, CSS y JavaScript. Para /api/*, CloudFront reenvía las peticiones sin caché a API Gateway HTTP, que invoca Lambda. Lambda consulta y modifica DynamoDB mediante un rol limitado a las dos tablas del proyecto.')
table([['Capa','Servicio y función'],['Frontend','S3 privado y CloudFront con HTTPS, OAC y cabeceras de seguridad.'],['API','API Gateway HTTP con límite de 10 peticiones por segundo y ráfagas de 20.'],['Lógica','Lambda Node.js 22, autenticación, CRUD y evaluación de reglas.'],['Lecturas','DynamoDB con SensorId como partición y Timestamp como ordenación. Timestamp contiene ISO UTC y un sufijo único.'],['Administración','Tabla DynamoDB separada con PK y SK para nodos, reglas, alertas, sesiones e intentos.'],['Simulación','EventBridge cada minuto; Lambda ejecuta 12 rondas espaciadas 5 segundos. Tiempo máximo 90 segundos.'],['Operación','CloudWatch Logs con retención de 7 días y presupuesto existente de US$0.01.']], [108,420])
p('Las sesiones duran 8 horas y usan cookie HttpOnly, Secure y SameSite Strict. DynamoDB conserva el hash del token; la contraseña se verifica con scrypt. Se limitan los intentos de acceso por IP y minuto. La interfaz usa el mismo origen que la API, sin CORS comodín.')
p('Las escrituras relacionadas usan transacciones y versiones. Las colisiones devuelven HTTP 409. El bucket bloquea acceso público y CloudFront lo lee mediante OAC. Los actuadores son estados de demostración, sin conexión con hardware físico.')

new('Diagrama de arquitectura AWS')
p('Flujo implementado en la pila domotix-dashboard. Las flechas representan peticiones HTTPS, invocaciones y acceso a los datos.')
def box(x,yy,w,hh,label):
 c.setFillColor(colors.HexColor('#f0f4f5'));c.setStrokeColor(colors.HexColor('#53666d'));c.roundRect(x,yy,w,hh,5,fill=1)
 q=Paragraph(label,ParagraphStyle('box',parent=small,alignment=1));_,height=q.wrap(w-12,hh);q.drawOn(c,x+6,yy+(hh-height)/2)
def arrow(x1,y1,x2,y2):
 import math
 c.setStrokeColor(colors.HexColor('#53666d'));c.line(x1,y1,x2,y2);a=math.atan2(y2-y1,x2-x1)
 for offset in [-.5,.5]:c.line(x2,y2,x2-7*math.cos(a+offset),y2-7*math.sin(a+offset))
box(190,592,230,39,'Navegador administrador HTTPS')
box(190,527,230,39,'CloudFront distribución HTTPS');arrow(305,592,305,566)
box(42,449,210,45,'S3 privado<br/>HTML CSS JS');arrow(245,527,147,494)
box(360,449,210,45,'API Gateway HTTP<br/>/api/* sin caché');arrow(365,527,465,494)
box(360,375,210,45,'Lambda dashboard<br/>CRUD autenticación y simulación');arrow(465,449,465,420)
box(42,375,210,45,'EventBridge cada minuto<br/>12 rondas cada 5 segundos');arrow(252,397,360,397)
box(42,287,252,54,'DynamoDB lecturas<br/>SensorId y Timestamp');arrow(420,375,220,341)
box(318,287,252,54,'DynamoDB administración<br/>PK y SK');arrow(485,375,455,341)
y=264
p('IAM de API: GetItem, Query, PutItem, UpdateItem y DeleteItem limitados a ambas tablas. Publicador: PutObject limitado al bucket. Ambos pueden escribir únicamente en sus grupos de registros.')
p('CloudFront firma acceso S3 mediante OAC. El bucket exige HTTPS y limita lectura a la distribución. CloudWatch retiene registros 7 días. AWS Budgets supervisa el consumo, con destinatario pendiente de verificación.')

new('Pruebas y comportamiento verificado')
table([['Prueba','Resultado y evidencia'],['Integración contra AWS','19 comprobaciones aprobadas. Archivo 20-pruebas-integracion.json.'],['Colección Postman con Newman','17 solicitudes y 18 aserciones aprobadas. Archivo 13-postman-resultados.json.'],['Interfaz pública','Acceso, alta de sensor, edición del nombre y umbral, creación de regla, alerta generada e inserción manual de 42.42 °C.'],['Limpieza de pruebas','Eliminación de lecturas y regla temporal y baja del nodo por API. Se comprobaron 6 nodos restantes. Archivo 19-limpieza-prueba-interfaz.json.'],['Cadencia','Se observaron intervalos de 5, 5, 4.997, 5.003, 5 y 5 segundos entre lecturas.'],['Pruebas locales','Tres pruebas aprobadas: flujo local, API AWS con almacén de prueba y sesiones vencidas con límite de intentos.']], [160,368])
p('La automatización del navegador se interrumpió al intentar eliminar una lectura desde la interfaz. El borrado completo está comprobado por API y Postman; todavía conviene ensayar manualmente ese botón en el navegador antes de la defensa.')
p('El histórico admite filtros por sensor y rango de fechas, con un máximo de 1000 lecturas. Las alertas visibles se limitan a 100. Los datos de lecturas y alertas expiran a los 7 días; las consultas excluyen los vencidos aunque TTL aún no los haya retirado físicamente.')
p('La baja de un nodo exige desactivarlo y conserva un marcador lógico. Sus relaciones dejan de mostrarse y no admite nuevas ingestas. Los metadatos retenidos no equivalen a un borrado físico inmediato. La pila conserva tabla y bucket si se elimina para proteger sus datos.')

new('Presupuesto y pendientes académicos')
p('La evidencia de Budgets muestra un presupuesto de US$0.01, costo real acumulado de US$0.93 y previsión de US$1.48. Free Tier muestra US$198.33 de créditos restantes y cobertura por créditos del plan gratuito. Estas capturas no demuestran un cobro a la tarjeta ni garantizan costo cero.')
p('<b>Pendiente:</b> la consola mostraba 0 de 1 correos del presupuesto verificados. La confirmación debe completarla quien tenga acceso al correo destinatario. No se accedió a su bandeja ni se confirmó el enlace. La cadencia de 5 segundos aumenta escrituras y tiempo de Lambda; revisar consumo actualizado antes de entregar.')
table([['Elemento Moodle','Estado'],['URL pública','Disponible y probada.'],['Repositorio main y develop','main y develop sincronizadas y publicadas en 6b2a4d4. El historial previo auditado contiene 17 commits de un solo autor; sigue pendiente acreditar aportes reales de los cinco integrantes.'],['API y Postman','URL y colección incluidas; ejecución real aprobada.'],['Arquitectura e IAM','Implementación descrita y esquema incluido en la guía técnica.'],['Budgets y Free Tier','Capturas incluidas; falta verificación de destinatario y revisión del consumo reciente.'],['Credenciales','Incluidas en este documento y README para la demostración.']], [140,388])
p('Cada integrante debe realizar y explicar sus aportes reales. No se fabricaron commits ni se alteraron autores. El equipo debe ensayar los 25 minutos y subir el PDF, la colección y los enlaces a Moodle antes del cierre. No se ha enviado ningún archivo a Moodle.')
p('Referencias oficiales: docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-lambda-function.html<br/>docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html',small)

evidence=[('12-despliegue-completo-salidas.png','Despliegue completado','CloudFormation muestra CREATE_COMPLETE y las salidas de la pila.'),('14-dashboard-publico.png','Dashboard público autenticado','Acceso desde el navegador a la URL CloudFront y simulación cada 5 segundos.'),('16-sensor-editado.png','Sensor editado en la interfaz','Sensor temporal en Laboratorio QA; nombre editado y umbral 34 °C.'),('04-presupuesto-detalle.png','Presupuesto y correo pendiente','Captura previa al despliegue completo: costo acumulado y 0/1 correos verificados.'),('06-free-tier-cuotas.png','Uso del plan gratuito','Captura previa al despliegue completo: cuotas y créditos de la cuenta.')]
for file,title,caption in evidence:
    new(title,True);p(caption,small)
    img=ImageReader(str(EVIDENCE/file));iw,ih=img.getSize();scale=min((W-84)/iw,(y-110)/ih)
    width,height=iw*scale,ih*scale;c.drawImage(img,(W-width)/2,y-height,width,height);y-=height+12
    p('Captura original '+file,small)
c.save();print(str(OUT))

