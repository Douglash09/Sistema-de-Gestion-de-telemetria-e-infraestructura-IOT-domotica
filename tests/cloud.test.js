import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scryptSync } from 'node:crypto';
import cloud from '../aws/lambda/dashboard.cjs';

class MemoryStore {
  rows = new Map(); attempts = new Map();
  key(pk, sk) { return JSON.stringify([pk,sk]); }
  async get(pk,sk) { return structuredClone(this.rows.get(this.key(pk,sk))); }
  async list(pk,{from,to,reverse,limit}={}) {
    let rows = [...this.rows.values()].filter(r => r.PK===pk && (!from || r.SK>=from) && (!to || r.SK<=to)).sort((a,b)=>a.SK.localeCompare(b.SK));
    if(reverse) rows.reverse(); if(limit) rows=rows.slice(0,limit); return structuredClone(rows);
  }
  async commit(writes) {
    for (const w of writes) {
      const old=this.rows.get(this.key(w.next.PK,w.next.SK));
      if(old?.version!==w.expected) throw Object.assign(Error('conflict'),{name:'TransactionCanceledException'});
    }
    for(const w of writes)this.rows.set(this.key(w.next.PK,w.next.SK),structuredClone(w.next));
  }
  async remove(pk,sk,version) {
    const old=this.rows.get(this.key(pk,sk));
    if(version!==undefined&&old?.version!==version)throw Object.assign(Error(),{name:'ConditionalCheckFailedException'});
    this.rows.delete(this.key(pk,sk));
  }
  async attempt(key) { const count=(this.attempts.get(key)||0)+1;this.attempts.set(key,count);if(count>10)throw Object.assign(Error('limit'),{status:429}); }
}

test('AWS: sesión persistente, CRUD, alertas, filtros, bajas y validación', async()=>{
  const store=new MemoryStore(), password='Only-A-Test-2026!', config={email:'test@example.test',salt:'test-salt',hash:scryptSync(password,'test-salt',64).toString('hex'),origin:'https://demo.example.test',now:()=>Date.parse('2026-11-19T12:00:00Z')};
  let app=cloud.createApp(store,config), cookies;
  async function request(path,method='GET',data,extra={}) {
    const [rawPath,qs='']=path.split('?');
    const result=await app({rawPath,queryStringParameters:Object.fromEntries(new URLSearchParams(qs)),requestContext:{http:{method,sourceIp:'127.0.0.1'}},cookies,body:JSON.stringify(data),...extra});
    return { ...result,data:JSON.parse(result.body) };
  }
  assert.equal((await request('/api/devices')).statusCode,401);
  assert.equal((await request('/api/login','POST',{email:config.email,password:'wrong'})).statusCode,401);
  const login=await request('/api/login','POST',{email:config.email,password});
  assert.equal(login.statusCode,200);assert.match(login.cookies[0],/HttpOnly; Secure; SameSite=Strict/);cookies=login.cookies.map(c=>c.split(';')[0]);
  app=cloud.createApp(store,config); // Otra instancia Lambda conserva la sesión.
  assert.equal((await request('/api/me')).data.mode,'aws');
  assert.equal((await request('/api/devices')).data.length,6);
  assert.equal((await request('/api/devices','POST',{}, {headers:{origin:'https://attacker.test'}})).statusCode,403);
  const created=await request('/api/devices','POST',{name:'Sensor prueba',location:'Lab',type:'temperature',threshold:30});assert.equal(created.statusCode,201);
  const id=created.data.id;
  const rule=await request('/api/rules','POST',{device_id:id,name:'Calor',operator:'>',threshold:30});assert.equal(rule.statusCode,201);
  for(const value of [true,null,'',{},'abc'])assert.equal((await request('/api/telemetry','POST',{device_id:id,value})).statusCode,400);
  const first=await request('/api/telemetry','POST',{device_id:id,value:40});assert.equal(first.statusCode,201);
  assert.equal((await request('/api/telemetry','POST',{device_id:id,value:41})).statusCode,201);
  let alarms=(await request('/api/alerts')).data.filter(a=>a.device_id===id);assert.equal(alarms.length,1);
  await request('/api/alerts/'+alarms[0].id,'PATCH',{});
  await request('/api/telemetry','POST',{device_id:id,value:42});
  alarms=(await request('/api/alerts')).data.filter(a=>a.device_id===id);assert.equal(alarms.length,2);
  assert.equal((await request('/api/readings?device_id='+id+'&from=2026-11-19&to=2026-11-20')).data.length,3);
  assert.equal((await request('/api/readings?from=invalid')).statusCode,400);
  assert.equal((await request('/api/readings?device_id='+id+'&to=2026-11-18')).data.length,0);
  await request('/api/readings/'+first.data.id,'DELETE');assert.equal((await request('/api/readings?device_id='+id)).data.length,2);
  await request('/api/devices/'+id,'PATCH',{name:'Editado'});assert.equal((await request('/api/devices')).data.find(d=>d.id===id).name,'Editado');
  await request('/api/rules/'+rule.data.id,'PATCH',{threshold:50,enabled:false});assert.equal((await request('/api/rules')).data.find(r=>r.id===rule.data.id).threshold,50);
  assert.equal((await request('/api/devices/'+id,'DELETE')).statusCode,400);
  await request('/api/devices/'+id,'PATCH',{enabled:false});assert.equal((await request('/api/telemetry','POST',{device_id:id,value:40})).statusCode,400);
  assert.equal((await request('/api/devices/'+id,'DELETE')).statusCode,200);
  assert.ok(!(await request('/api/devices')).data.some(d=>d.id===id));assert.ok(!(await request('/api/rules')).data.some(r=>r.device_id===id));assert.ok(!(await request('/api/alerts')).data.some(a=>a.device_id===id));
  assert.equal((await request('/api/telemetry','POST',{device_id:id,value:40})).statusCode,404);
  await request('/api/logout','POST');assert.equal((await request('/api/me')).statusCode,401);
});

test('AWS: sesiones vencidas y límite de intentos', async()=>{
  const store=new MemoryStore();let time=Date.now();
  const config={email:'test@example.test',salt:'salt',hash:scryptSync('password','salt',64).toString('hex'),now:()=>time};
  const app=cloud.createApp(store,config);
  const event={rawPath:'/api/login',requestContext:{http:{method:'POST',sourceIp:'1'}},body:JSON.stringify({email:config.email,password:'password'})};
  const login=await app(event);time+=28801*1000;
  assert.equal((await app({rawPath:'/api/me',requestContext:{http:{method:'GET'}},cookies:login.cookies.map(c=>c.split(';')[0])})).statusCode,401);
  event.body=JSON.stringify({email:config.email,password:'wrong'});
  for(let i=0;i<10;i++)assert.equal((await app(event)).statusCode,401);
  assert.equal((await app(event)).statusCode,429);
});
