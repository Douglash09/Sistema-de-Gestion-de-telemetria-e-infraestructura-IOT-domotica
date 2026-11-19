"""Informe reproducible de preparación; actualizar estado tras validar el despliegue."""
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.lib import colors
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import json

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs'/'Informe_preparacion_AWS.pdf'
EVIDENCE=ROOT/'docs'/'evidencias'/'2026-11-19'
pdfmetrics.registerFont(TTFont('ArialDoc',r'C:\Windows\Fonts\arial.ttf'))
pdfmetrics.registerFont(TTFont('ArialDocBold',r'C:\Windows\Fonts\arialbd.ttf'))
pdfmetrics.registerFontFamily('ArialDoc',normal='ArialDoc',bold='ArialDocBold')
style=ParagraphStyle('Body',fontName='ArialDoc',fontSize=11,leading=16,spaceAfter=10,textColor=colors.black)
small=ParagraphStyle('Small',parent=style,fontSize=9,leading=12)
c=canvas.Canvas(str(OUT),pagesize=letter)
c.setTitle('Preparación y evidencias del despliegue AWS de DomotiX')
c.setAuthor('Equipo del proyecto DomotiX UNICAES')
page=0;y=0;W,H=letter
def new(title,wide=False):
    global page,y,W,H
    if page:c.showPage()
    page+=1;W,H=landscape(letter) if wide else letter;c.setPageSize((W,H))
    c.setFillColor(colors.black);c.setFont('ArialDocBold',17);c.drawString(42,H-48,title)
    c.setFont('ArialDoc',9);c.drawString(42,24,'DomotiX IoT | UNICAES | 19 de noviembre de 2026')
    c.drawRightString(W-42,24,str(page));y=H-78
def p(text,st=style):
    global y
    q=Paragraph(text,st);_,h=q.wrap(W-84,H);q.drawOn(c,42,y-h);y-=h+10
    if y<45:raise RuntimeError('Texto excede la página '+str(page))
def h(text):
    global y
    y-=6;c.setFont('ArialDocBold',12);c.drawString(42,y,text);y-=22
def table(rows,widths):
    global y
    cells=[[Paragraph(escape(str(v)),small) for v in row] for row in rows]
    t=Table(cells,colWidths=widths,repeatRows=1)
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e5edf2')),('GRID',(0,0),(-1,-1),.5,colors.HexColor('#D9D9D9')),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8),('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8)]))
    _,height=t.wrap(W-84,H);t.drawOn(c,42,y-height);y-=height+16
    if y<45:raise RuntimeError('Tabla excede la página '+str(page))

new('Sistema de gestión de telemetría IoT')
p('<b>Preparación y evidencias del despliegue en AWS</b>')
p('Universidad Católica de El Salvador<br/>Materia Cómputo en la Nube · Grupo B<br/>Docente Ing. Herberth Contreras')
h('Estado de este documento')
p('Borrador técnico de avance. El backend completo, la adaptación del frontend y la plantilla de infraestructura están preparados. Las pruebas automatizadas locales pasan. La creación de la pila fue autorizada por el responsable. Para continuar es necesario restablecer la sesión de AWS y validar el CRUD contra AWS real.')
p('Las capturas anexas corresponden a los recursos existentes antes de completar la migración. No constituyen evidencia de que el dashboard nuevo esté publicado ni de que su CRUD funcione en producción.')
h('Equipo y defensa')
p('Integrantes proporcionados por el responsable:<br/>DOUGLA OMAR MENDEZ HERNANDEZ<br/>SAMUEL VLADIMIR GODOY AYALA<br/>RODRIGO ALEXANDER VALIENTE IBARRA<br/>KEVIN ALEJANDRO BURGOS BUSTILLO<br/>CLAUDIA MARISOL RAMOS SIERRA')
p('Carnés y asignación individual de roles pendientes de confirmar.',small)
p('Defensa: sábado 21 de noviembre de 2026, de 06:55 a 07:20. Preparación: 06:50 a 06:55. Entrega y congelamiento de código: antes de las 06:30 del mismo día, hora de El Salvador.')
h('Objetivo y alcance')
p('Supervisar sensores de temperatura, humedad y consumo eléctrico, gestionar actuadores de demostración, consultar históricos y atender alertas. La fase local utiliza Node.js y SQLite; la fase AWS preparada utiliza CloudFront, S3, API Gateway, Lambda y DynamoDB.')

new('Arquitectura preparada para AWS')
p('Diseño incluido en la plantilla de CloudFormation. Se verificará su creación y operación antes de presentarlo como arquitectura desplegada.')
# Diagrama vectorial con lectura de arriba hacia abajo.
def box(x,yy,w,hh,label):
    c.setFillColor(colors.HexColor('#f0f4f5'));c.setStrokeColor(colors.HexColor('#53666d'));c.roundRect(x,yy,w,hh,5,fill=1)
    q=Paragraph(label,ParagraphStyle('box',parent=small,alignment=1));_,height=q.wrap(w-12,hh);q.drawOn(c,x+6,yy+(hh-height)/2)
def arrow(x1,y1,x2,y2):
    c.setStrokeColor(colors.HexColor('#53666d'));c.line(x1,y1,x2,y2)
    import math
    a=math.atan2(y2-y1,x2-x1)
    for offset in [-.5,.5]:c.line(x2,y2,x2-7*math.cos(a+offset),y2-7*math.sin(a+offset))
box(190,592,230,39,'Administrador · navegador HTTPS')
box(190,527,230,39,'CloudFront · mismo origen para web y API');arrow(305,592,305,566)
box(42,449,210,45,'S3 privado<br/>HTML CSS y JavaScript');arrow(245,527,147,494)
box(360,449,210,45,'API Gateway HTTP<br/>/api/* sin caché');arrow(365,527,465,494)
box(360,375,210,45,'Lambda dashboard<br/>Autenticación y operaciones CRUD');arrow(465,449,465,420)
box(42,375,210,45,'EventBridge<br/>Simulador cada 5 segundos');arrow(252,397,360,397)
box(42,287,252,54,'DynamoDB lecturas<br/>SensorId y Timestamp');arrow(420,375,220,341)
box(318,287,252,54,'DynamoDB administración<br/>Dispositivos reglas alertas y sesiones');arrow(485,375,455,341)
y=264
p('Las funciones usan roles IAM limitados a los recursos de esta pila. CloudWatch conserva registros durante 7 días. El presupuesto existente de US$0.01 se mantiene como alerta de consumo.')
p('El bucket no es público: CloudFront accede mediante OAC y firma SigV4. El navegador usa cookies seguras sobre HTTPS; la API no habilita acceso CORS desde cualquier origen.')
p('Los recursos anteriores iot-telemetry-processor y TelemetryReadings se conservan. No se ha realizado una importación de sus registros a la pila nueva.',small)

new('Funcionalidad y pruebas realizadas')
table([['Requisito','Implementación preparada'],['Nodos y sensores','Alta, consulta por ubicación, edición de umbrales, activación y baja lógica de nodos desactivados.'],['Histórico','Ingesta JSON, consulta por sensor y rango de fechas, eliminación de lecturas de prueba.'],['Reglas y alertas','Creación, edición, activación de reglas y reconocimiento de alertas; evita duplicar alertas abiertas.'],['Autenticación','Hash scrypt, cookie HttpOnly Secure SameSite Strict y sesiones persistentes de 8 horas.'],['Simulación','Evento cada 5 segundos en AWS; actualización del panel cada 5 segundos mientras esté visible.']], [120,408])
p('<b>Resultado comprobado:</b> tres pruebas automatizadas aprobadas con npm test: flujo local completo, flujo de API AWS con almacén de prueba y expiración de sesiones con límite de intentos.')
p('La prueba local comprueba que una contraseña existente no cambie al reiniciar con otra variable de entorno. La prueba AWS comprueba persistencia de sesión entre instancias, CRUD, validación numérica, filtros, alertas y bloqueo de orígenes ajenos.')
p('<b>Límite de la verificación:</b> el almacén usado por las pruebas AWS es de memoria. Todavía falta ejecutar la prueba contra DynamoDB y la URL pública reales. aws/smoke-test.mjs está preparado para esa validación y aws/postman-dashboard.json contiene 17 solicitudes de defensa.')
h('Retención y concurrencia')
p('Lecturas y alertas expiran a los 7 días; las consultas excluyen datos vencidos. Las escrituras relacionadas usan transacciones y versiones. La eliminación de nodos conserva un marcador y oculta sus relaciones; no es un borrado físico inmediato.')

new('Lista de entrega y pendientes')
table([['Elemento exigido en Moodle','Estado comprobado'],['URL pública AWS','Pendiente de crear y validar la pila domotix-dashboard.'],['Repositorio y ramas','Repositorio existente; falta revisión final de main, develop y aportes reales de cinco integrantes.'],['API y Postman','Colección AWS preparada. URL definitiva y prueba real pendientes.'],['Diagrama AWS e IAM','Diseño preparado en este informe; falta confirmar despliegue real.'],['Budgets y Free Tier','Capturas guardadas. Presupuesto US$0.01; destinatario 0/1 verificado.'],['Credenciales de prueba','Cuenta compartida local verificada. Login público pendiente; incluir contraseña de demostración en entrega final privada.']], [160,368])
h('Hallazgos de facturación')
p('Budgets muestra US$0.93 de costo real acumulado y US$1.48 previsto. Free Tier indica que los costos del plan gratuito se cubren con créditos y muestra US$198.33 restantes. Estos datos no demuestran un cobro a tarjeta. Falta identificar el servicio que originó el consumo y verificar el correo destinatario del presupuesto.')
h('Próximos pasos de validación')
p('Restablecer la sesión de AWS; crear la pila autorizada; esperar CREATE_COMPLETE; abrir DashboardUrl; comprobar login y CRUD; guardar capturas; completar carnés y enlaces; registrar commit y hashes; revisar el documento definitivo antes del congelamiento.')
p('Repositorio: github.com/Douglash09/Sistema-de-Gestion-de-telemetria-e-infraestructura-IOT-domotica',small)
p('Referencias: docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-lambda-function.html<br/>docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html',small)

captions=[
('01-consola-aws.png','Consola de AWS','Cuenta y región observadas durante la revisión.'),
('02-lambda-api-gateway.png','Lambda existente','iot-telemetry-processor con desencadenador API Gateway. Corresponde a la integración anterior.'),
('03-presupuesto-listado.png','Presupuesto configurado','Alerta-FreeTier-Proyecto tiene un importe de US$0.01 y aparece con el umbral superado.'),
('04-presupuesto-detalle.png','Costo acumulado y destinatario','Costo real US$0.93; previsto US$1.48. El destinatario de correo figura como 0/1 verificado.'),
('05-free-tier-resumen.png','Plan gratuito y créditos','La consola indica cobertura por créditos durante el plan gratuito.'),
('06-free-tier-cuotas.png','Uso y saldo de créditos','Saldo de créditos mostrado: US$198.33. La tabla presenta ofertas gratuitas en uso.'),
('07-dynamodb-tabla.png','Tabla DynamoDB existente','TelemetryReadings corresponde a la implementación anterior y se conserva.'),
('08-dynamodb-claves-capacidad.png','Claves y capacidad de DynamoDB','SensorId y Timestamp; tabla activa bajo demanda. El recuento mostrado es de cuatro elementos.'),
('09-api-gateway-rutas.png','Ruta de telemetría existente','Recurso /telemetry en iot-telemetry-api. No acredita las rutas CRUD del dashboard nuevo.'),
('10-api-gateway-integracion.png','Integración existente con Lambda','API Gateway tiene una integración con iot-telemetry-processor.'),
('11-s3-buckets.png','Alojamiento antes de la migración','El listado mostraba cero buckets antes de cargar la plantilla CloudFormation. No representa el estado posterior a esa carga.')]
for file,title,caption in captions:
    new(title,True)
    p(caption,small)
    img=ImageReader(str(EVIDENCE/file));iw,ih=img.getSize();width=W-84;height=width*ih/iw
    c.drawImage(img,42,y-height,width,height)
    y-=height+14
    p('Evidencia '+file+' · Captura original del 19 de noviembre de 2026.',small)
c.save()
print(str(OUT))
