import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
test('Flujo local: autenticación, CRUD, telemetría, filtros, alarmas y persistencia',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'nodo-test-'));let child,base,cookie;
 async function launch(){child=spawn(process.execPath,['src/server.js'],{env:{...process.env,PORT:'0',DATA_DIR:dir,ADMIN_EMAIL:'test@local.test',ADMIN_PASSWORD:'TestPassword2026!',SIMULATOR_ENABLED:'false',IOT_API_KEY:'test-key'},stdio:['ignore','pipe','pipe']});base=await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('No inició el servidor')),10000);child.stdout.on('data',b=>{out+=b;const m=out.match(/http:\/\/127\.0\.0\.1:\d+/);if(m){clearTimeout(timer);resolve(m[0]);}});child.once('error',reject);child.once('exit',c=>{clearTimeout(timer);reject(Error('Salida '+c));});});}
 async function stop(){if(child?.exitCode===null){const done=new Promise(r=>child.once('exit',r));child.kill();await done;}}
 async function request(p,method='GET',data,auth=true,headers={}){const r=await fetch(base+'/api'+p,{method,headers:{...(auth&&cookie?{Cookie:cookie}:{}),'Content-Type':'application/json',...headers},body:data?JSON.stringify(data):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')};}
 async function login(){const r=await request('/login','POST',{email:'test@local.test',password:'TestPassword2026!'},false);assert.equal(r.status,200);cookie=r.cookie.split(';')[0];}
 try{await launch();assert.equal((await request('/devices')).status,401);assert.equal((await request('/login','POST',{email:'test@local.test',password:'wrong'},false)).status,401);await login();assert.equal((await request('/devices','POST',{name:'bad',location:'A',type:'invalid',threshold:1})).status,400);
 const created=await request('/devices','POST',{name:'Sensor prueba',location:'Laboratorio',type:'temperature',threshold:30});assert.equal(created.status,201);const id=created.data.id;
 const rule=await request('/rules','POST',{name:'Calor crítico',device_id:id,operator:'>',threshold:30});assert.equal(rule.status,201);
 assert.equal((await request('/telemetry','POST',{device_id:id,value:40},false,{'X-API-Key':'wrong'})).status,401);
 assert.equal((await request('/telemetry','POST',{device_id:id,value:40,timestamp:'2026-01-01T00:00:00Z'},false,{'X-API-Key':'test-key'})).status,201);
 assert.equal((await request('/telemetry','POST',{device_id:id,value:'no'})).status,400);
 let rows=await request('/readings?device_id='+id+'&from=2025-12-31&to=2026-01-02');assert.equal(rows.data.length,1);assert.equal(rows.data[0].value,40);
 const alert=(await request('/alerts')).data.find(a=>a.device_id===id);assert.ok(alert);await request('/alerts/'+alert.id,'PATCH',{});assert.equal((await request('/alerts')).data.find(a=>a.id===alert.id).acknowledged,1);
 await request('/rules/'+rule.data.id,'PATCH',{enabled:false,threshold:45});assert.equal((await request('/rules')).data.find(r=>r.id===rule.data.id).threshold,45);
 assert.equal((await request('/devices/'+id,'DELETE')).status,400);await request('/devices/'+id,'PATCH',{name:'Sensor editado'});
 await stop();await launch();await login();assert.equal((await request('/devices')).data.find(d=>d.id===id).name,'Sensor editado');assert.equal((await request('/readings?device_id='+id)).data.length,1);
 await request('/readings/'+rows.data[0].id,'DELETE');assert.equal((await request('/readings?device_id='+id)).data.length,0);
 await request('/devices/'+id,'PATCH',{enabled:false});assert.equal((await request('/telemetry','POST',{device_id:id,value:1})).status,400);assert.equal((await request('/devices/'+id,'DELETE')).status,200);assert.ok(!(await request('/rules')).data.some(r=>r.device_id===id));
 await request('/logout','POST');assert.equal((await request('/me')).status,401);
 }finally{await stop();rmSync(dir,{recursive:true,force:true});}
});
