import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const data=process.env.DATA_DIR || path.join(root,'data'); mkdirSync(data,{recursive:true});
const db=new DatabaseSync(path.join(data,'telemetry.sqlite')); db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(email TEXT PRIMARY KEY,salt TEXT,hash TEXT);
CREATE TABLE IF NOT EXISTS devices(id TEXT PRIMARY KEY,name TEXT,location TEXT,type TEXT,unit TEXT,threshold REAL,enabled INTEGER DEFAULT 1,state INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS readings(id INTEGER PRIMARY KEY,device_id TEXT REFERENCES devices(id) ON DELETE CASCADE,timestamp TEXT,value REAL);
CREATE INDEX IF NOT EXISTS idx_readings_sensor_time ON readings(device_id,timestamp);
CREATE INDEX IF NOT EXISTS idx_readings_time ON readings(timestamp);
CREATE TABLE IF NOT EXISTS rules(id TEXT PRIMARY KEY,device_id TEXT REFERENCES devices(id) ON DELETE CASCADE,name TEXT,operator TEXT,threshold REAL,enabled INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS alerts(id INTEGER PRIMARY KEY,device_id TEXT REFERENCES devices(id) ON DELETE CASCADE,rule_id TEXT,timestamp TEXT,message TEXT,acknowledged INTEGER DEFAULT 0);`);
const defaultPass = process.env.ADMIN_PASSWORD || 'CambiaEstaClave2026!';
const usersList = [process.env.ADMIN_EMAIL || 'admin@local.test', 'douglas.mendez1@catolica.edu.sv'];
for(const u of usersList){
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(defaultPass, salt, 64).toString('hex');
  if(!db.prepare('SELECT email FROM users WHERE email=?').get(u)) {
    db.prepare('INSERT INTO users VALUES(?,?,?)').run(u, salt, hash);
  } else {
    db.prepare('UPDATE users SET salt=?, hash=? WHERE email=?').run(salt, hash, u);
  }
}
const units={temperature:'°C',humidity:'%',energy:'kW',actuator:''};
if(!db.prepare('SELECT id FROM devices LIMIT 1').get()) {
 const seeds=[['Temperatura ambiente','Sala principal','temperature',32],['Humedad relativa','Sala principal','humidity',75],['Consumo eléctrico','Planta baja','energy',4],['Temperatura exterior','Terraza','temperature',35],['Iluminación principal','Sala principal','actuator',0],['Ventilación','Sala principal','actuator',0]];
 for(const [name,location,type,threshold] of seeds) {const id=randomUUID(); db.prepare('INSERT INTO devices(id,name,location,type,unit,threshold) VALUES(?,?,?,?,?,?)').run(id,name,location,type,units[type],threshold); if(type!=='actuator'){db.prepare('INSERT INTO rules VALUES(?,?,?,?,?,1)').run(randomUUID(),id,`Umbral de ${name.toLowerCase()}`,'>',threshold); for(let i=59;i>=0;i--) db.prepare('INSERT INTO readings(device_id,timestamp,value) VALUES(?,?,?)').run(id,new Date(Date.now()-i*60000).toISOString(),Number((type==='humidity'?48+Math.random()*10:type==='energy'?1+Math.random()*1.7:23+Math.random()*6).toFixed(2)));}}
}
const sessions=new Map(), attempts=new Map(), clients=new Set();
const apiKey=process.env.IOT_API_KEY || randomBytes(32).toString('hex');
function emit(){for(const client of clients)client.write('data: update\n\n');}
function fail(message,status=400){throw Object.assign(new Error(message),{status});}
function str(v,label){if(typeof v!=='string'||!v.trim()||v.length>120)fail(`${label}: escribe entre 1 y 120 caracteres`);return v.trim();}
function num(v){if(v===null||v===''||!Number.isFinite(Number(v)))fail('Valor numérico inválido');return Number(v);}
function device(id){const d=db.prepare('SELECT * FROM devices WHERE id=?').get(id);if(!d)fail('Dispositivo no encontrado',404);return d;}
function insertReading(b){const d=device(b.device_id); if(d.type==='actuator'||!d.enabled)fail('El sensor está inactivo o es un actuador');const value=num(b.value);const timestamp=b.timestamp?new Date(b.timestamp):new Date();if(Number.isNaN(timestamp.getTime())||timestamp.getTime()>Date.now()+60000)fail('Fecha inválida o futura');db.prepare('INSERT INTO readings(device_id,timestamp,value) VALUES(?,?,?)').run(d.id,timestamp.toISOString(),value); for(const r of db.prepare('SELECT * FROM rules WHERE device_id=? AND enabled=1').all(d.id)){if(r.operator==='>'?value>r.threshold:value<r.threshold){const recent=db.prepare('SELECT id FROM alerts WHERE rule_id=? AND acknowledged=0 LIMIT 1').get(r.id);if(!recent)db.prepare('INSERT INTO alerts(device_id,rule_id,timestamp,message) VALUES(?,?,?,?)').run(d.id,r.id,timestamp.toISOString(),`${r.name}: ${value} ${d.unit} (${r.operator} ${r.threshold})`);}} emit();}
async function body(req){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>16384)fail('Petición demasiado grande',413);}try{return JSON.parse(raw||'{}');}catch{fail('JSON inválido');}}
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
function authenticated(req){const token=req.headers.cookie?.match(/(?:^|;\s*)session=([^;]+)/)?.[1];const s=sessions.get(token);if(!s||s.expires<Date.now()){sessions.delete(token);fail('Inicia sesión para continuar',401);}return token;}
const server=http.createServer(async(req,res)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','same-origin');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'");try{const url=new URL(req.url,'http://localhost');const p=url.pathname,method=req.method;
 if(p.startsWith('/api/')){
 if(!['GET','HEAD'].includes(method)&&req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)fail('Origen no permitido',403);
 if(p==='/api/login'&&method==='POST'){const key=req.socket.remoteAddress; const a=attempts.get(key)||{count:0,until:Date.now()+60000};if(a.until<Date.now()){a.count=0;a.until=Date.now()+60000;}attempts.set(key,a);if(++a.count>10)fail('Demasiados intentos. Espera un minuto.',429);const b=await body(req);if(typeof b.password!=='string'||b.password.length>256)fail('Credenciales incorrectas',401);const u=db.prepare('SELECT * FROM users WHERE email=?').get(String(b.email));if(!u||!timingSafeEqual(scryptSync(b.password,u.salt,64),Buffer.from(u.hash,'hex')))fail('Credenciales incorrectas',401);a.count=0;const token=randomBytes(32).toString('hex');sessions.set(token,{email:u.email,expires:Date.now()+8*3600000});res.setHeader('Set-Cookie',`session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`);return send(res,200,{email:u.email});}
 if(p==='/api/telemetry'&&method==='POST'&&req.headers['x-api-key']===apiKey){insertReading(await body(req));return send(res,201,{ok:true});}
 const token=authenticated(req);
 if(p==='/api/me')return send(res,200,{email:sessions.get(token).email});
 if(p==='/api/logout'&&method==='POST'){sessions.delete(token);res.setHeader('Set-Cookie','session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return send(res,200,{ok:true});}
 if(p==='/api/events'){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});res.write('data: connected\n\n');clients.add(res);const heartbeat=setInterval(()=>{if(!sessions.has(token)||sessions.get(token).expires<Date.now())res.end();else res.write(': heartbeat\n\n');},15000);req.on('close',()=>{clients.delete(res);clearInterval(heartbeat);});return;}
 if(p==='/api/devices'&&method==='GET')return send(res,200,db.prepare(`SELECT d.*, (SELECT value FROM readings WHERE device_id=d.id ORDER BY timestamp DESC,id DESC LIMIT 1) value,(SELECT timestamp FROM readings WHERE device_id=d.id ORDER BY timestamp DESC,id DESC LIMIT 1) last_seen FROM devices d ORDER BY d.type,d.name`).all());
 if(p==='/api/devices'&&method==='POST'){const b=await body(req);if(!Object.hasOwn(units,b.type))fail('Tipo inválido');const id=randomUUID();db.prepare('INSERT INTO devices(id,name,location,type,unit,threshold) VALUES(?,?,?,?,?,?)').run(id,str(b.name,'Nombre'),str(b.location,'Ubicación'),b.type,units[b.type],num(b.threshold));emit();return send(res,201,{id});}
 const dm=p.match(/^\/api\/devices\/([^/]+)$/);if(dm){const d=device(dm[1]);if(method==='DELETE'){if(d.enabled)fail('Desactiva el nodo antes de eliminarlo');db.prepare('DELETE FROM devices WHERE id=?').run(d.id);emit();return send(res,200,{ok:true});}if(method==='PATCH'){const b=await body(req);const enabled=b.enabled===undefined?d.enabled:Number(Boolean(b.enabled));db.prepare('UPDATE devices SET name=?,location=?,threshold=?,enabled=?,state=? WHERE id=?').run(b.name===undefined?d.name:str(b.name,'Nombre'),b.location===undefined?d.location:str(b.location,'Ubicación'),b.threshold===undefined?d.threshold:num(b.threshold),enabled,b.state===undefined?d.state:Number(Boolean(b.state)),d.id);emit();return send(res,200,{ok:true});}}
 if(p==='/api/telemetry'&&method==='POST'){insertReading(await body(req));return send(res,201,{ok:true});}
 if(p==='/api/readings'&&method==='GET'){let sql='SELECT r.*,d.name,d.unit FROM readings r JOIN devices d ON d.id=r.device_id WHERE 1=1',args=[];for(const [param,clause] of [['device_id','r.device_id = ?'],['from','r.timestamp >= ?'],['to','r.timestamp <= ?']]){let v=url.searchParams.get(param);if(v){if(param!=='device_id'){const dt=new Date(v);if(Number.isNaN(dt.getTime()))fail('Filtro de fecha inválido');v=dt.toISOString();}sql+=' AND '+clause;args.push(v);}}return send(res,200,db.prepare(sql+' ORDER BY r.timestamp DESC,r.id DESC LIMIT 1000').all(...args));}
 const rm=p.match(/^\/api\/readings\/(\d+)$/);if(rm&&method==='DELETE'){db.prepare('DELETE FROM readings WHERE id=?').run(Number(rm[1]));emit();return send(res,200,{ok:true});}
 if(p==='/api/rules'&&method==='GET')return send(res,200,db.prepare('SELECT r.*,d.name device_name,d.unit FROM rules r JOIN devices d ON d.id=r.device_id').all());
 if(p==='/api/rules'&&method==='POST'){const b=await body(req);if(device(b.device_id).type==='actuator')fail('Selecciona un sensor');if(!['>','<'].includes(b.operator))fail('Operador inválido');const id=randomUUID();db.prepare('INSERT INTO rules VALUES(?,?,?,?,?,1)').run(id,b.device_id,str(b.name,'Nombre'),b.operator,num(b.threshold));emit();return send(res,201,{id});}
 const rule=p.match(/^\/api\/rules\/([^/]+)$/);if(rule){const r=db.prepare('SELECT * FROM rules WHERE id=?').get(rule[1]);if(!r)fail('Regla no encontrada',404);if(method==='DELETE'){db.prepare('DELETE FROM rules WHERE id=?').run(r.id);emit();return send(res,200,{ok:true});}if(method==='PATCH'){const b=await body(req);if(b.operator!==undefined&&!['>','<'].includes(b.operator))fail('Operador inválido');db.prepare('UPDATE rules SET name=?,operator=?,threshold=?,enabled=? WHERE id=?').run(b.name===undefined?r.name:str(b.name,'Nombre'),b.operator||r.operator,b.threshold===undefined?r.threshold:num(b.threshold),b.enabled===undefined?r.enabled:Number(Boolean(b.enabled)),r.id);emit();return send(res,200,{ok:true});}}
 if(p==='/api/alerts'&&method==='GET')return send(res,200,db.prepare('SELECT a.*,d.name device_name FROM alerts a JOIN devices d ON d.id=a.device_id ORDER BY a.timestamp DESC LIMIT 100').all());
 const am=p.match(/^\/api\/alerts\/(\d+)$/);if(am&&method==='PATCH'){db.prepare('UPDATE alerts SET acknowledged=1 WHERE id=?').run(Number(am[1]));emit();return send(res,200,{ok:true});}
 fail('Ruta no encontrada',404);
 }const files={'/':'index.html','/app.js':'app.js','/styles.css':'styles.css'};if(!files[p])fail('No encontrado',404);res.writeHead(200,{'Content-Type':p.endsWith('.js')?'text/javascript; charset=utf-8':p.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8'});res.end(readFileSync(path.join(root,'public',files[p])));
 }catch(e){if(!res.headersSent)send(res,e.status||500,{error:e.status?e.message:'Error interno del servidor'});else res.end();if(!e.status)console.error(e);}});
const host=process.env.HOST||'127.0.0.1',port=Number(process.env.PORT||3000);
server.listen(port,host,()=>console.log(`Sistema IoT local: http://${host}:${server.address().port}`));
server.on('error',e=>{console.error(e.message);process.exit(1);});
if(process.env.SIMULATOR_ENABLED!=='false')setInterval(async()=>{for(const d of db.prepare("SELECT * FROM devices WHERE type!='actuator' AND enabled=1").all()){const value=Number((d.type==='humidity'?45+Math.random()*25:d.type==='energy'?0.8+Math.random()*3.6:23+Math.random()*12).toFixed(2));try{await fetch(`http://${host==='0.0.0.0'?'127.0.0.1':host}:${server.address().port}/api/telemetry`,{method:'POST',headers:{'Content-Type':'application/json','X-API-Key':apiKey},body:JSON.stringify({device_id:d.id,value})});}catch(e){console.error('Simulador:',e.message);}}},5000).unref();
