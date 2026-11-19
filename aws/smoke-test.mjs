// Prueba end-to-end contra la URL HTTPS de CloudFront. Solo elimina sus propios datos de prueba.
import { writeFileSync, mkdirSync } from 'node:fs';
const base=process.argv[2]?.replace(/\/$/,'');
if(!base?.startsWith('https://') || !process.env.ADMIN_PASSWORD) throw Error('Uso: node --env-file=.env aws/smoke-test.mjs https://dominio-cloudfront. Se requiere ADMIN_PASSWORD.');
const email=process.env.CLOUD_ADMIN_EMAIL || 'douglas.mendez1@catolica.edu.sv';
let cookie='',deviceId,ruleId;const checks=[];
async function request(path,method='GET',data,expected=200,authenticated=true){
  const response=await fetch(base+'/api'+path,{method,headers:{'Content-Type':'application/json',...(authenticated&&cookie?{Cookie:cookie}:{})},body:data===undefined?undefined:JSON.stringify(data)});
  const body=await response.json();
  if(response.status!==expected)throw Error(`${method} ${path}: HTTP ${response.status}; ${body.error || 'respuesta inesperada'}`);
  if(path==='/login'&&response.ok)cookie=response.headers.get('set-cookie')?.split(';')[0]||'';
  checks.push({operation:method+' '+path,status:response.status,at:new Date().toISOString()});return body;
}
try{
  await request('/devices','GET',undefined,401,false);
  await request('/login','POST',{email,password:process.env.ADMIN_PASSWORD});
  await request('/me');
  const d=await request('/devices','POST',{name:'Prueba defensa '+Date.now(),location:'QA temporal',type:'temperature',threshold:30},201);deviceId=d.id;
  const r=await request('/rules','POST',{device_id:deviceId,name:'Alerta QA',operator:'>',threshold:30},201);ruleId=r.id;
  const reading=await request('/telemetry','POST',{device_id:deviceId,value:42},201);
  const rows=await request('/readings?device_id='+deviceId);if(!rows.some(r=>r.id===reading.id&&r.value===42))throw Error('La lectura no persistió');
  await request('/devices/'+deviceId,'PATCH',{name:'Prueba QA editada'});
  const devices=await request('/devices');if(devices.find(d=>d.id===deviceId)?.name!=='Prueba QA editada')throw Error('La edición no persistió');
  const alarms=await request('/alerts'),alarm=alarms.find(a=>a.device_id===deviceId&&!a.acknowledged);if(!alarm)throw Error('No se generó alerta');
  await request('/alerts/'+alarm.id,'PATCH',{});
  await request('/rules/'+ruleId,'PATCH',{enabled:false,threshold:50});
  await request('/readings/'+reading.id,'DELETE');
  if((await request('/readings?device_id='+deviceId)).some(r=>r.id===reading.id))throw Error('La lectura no se eliminó');
  await request('/rules/'+ruleId,'DELETE');ruleId=null;
  await request('/devices/'+deviceId,'PATCH',{enabled:false});
  await request('/devices/'+deviceId,'DELETE');deviceId=null;
  await request('/logout','POST');await request('/me','GET',undefined,401);
  mkdirSync('aws/build',{recursive:true});writeFileSync('aws/build/smoke-result.json',JSON.stringify({base,passed:true,checks},null,2));
  console.log(`PASS: ${checks.length} comprobaciones en AWS. Evidencia: aws/build/smoke-result.json`);
}catch(error){
  console.error(error.message);
  if(deviceId&&cookie){try{if(ruleId)await request('/rules/'+ruleId,'DELETE');await request('/devices/'+deviceId,'PATCH',{enabled:false});await request('/devices/'+deviceId,'DELETE');}catch{console.error('Revisar y retirar manualmente el dispositivo temporal:',deviceId);}}
  process.exitCode=1;
}
