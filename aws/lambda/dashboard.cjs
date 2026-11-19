// API del dashboard. El adaptador DynamoDB se carga únicamente en Lambda.
const { randomUUID, randomBytes, createHash, scryptSync, timingSafeEqual } = require('node:crypto');
const units = { temperature: '°C', humidity: '%', energy: 'kW', actuator: '' };
const digest = value => createHash('sha256').update(value).digest('hex');
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
function text(value, label = 'Texto') {
  if (typeof value !== 'string' || !value.trim() || value.length > 120) fail(`${label}: escribe entre 1 y 120 caracteres`);
  return value.trim();
}
function number(value) {
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '' || !Number.isFinite(Number(value))) fail('Valor numérico inválido');
  return Number(value);
}
function flag(value) {
  if (![true, false, 0, 1].includes(value)) fail('Indicador inválido');
  return Number(Boolean(value));
}
const publicItem = ({ PK, SK, version, expires, deleted, ...item }) => item;
const item = (PK, SK, data) => ({ ...data, PK, SK, version: 1 });
const change = (old, data) => ({ ...old, ...data, version: old.version + 1 });
const put = (next, old) => ({ next, expected: old?.version });

function createApp(store, config) {
  const now = config.now || Date.now;
  const seconds = () => Math.floor(now() / 1000);
  const cookie = (token, age = 28800) => `session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${age}`;
  async function device(id) {
    const d = await store.get('DEVICE', id);
    if (!d || d.deleted) fail('Dispositivo no encontrado', 404);
    return d;
  }
  async function catalog() { return (await store.list('DEVICE')).filter(d => !d.deleted); }
  async function readings(d, query = {}, limit = 1000) {
    const rows = await store.list(`READING#${d.id}`, { from: query.from, to: query.to && query.to + '~', reverse: true, limit });
    return rows.filter(r => r.expires > seconds()).map(r => ({ ...publicItem(r), name: d.name, unit: d.unit }));
  }
  async function ingest(b) {
    const d = await device(b.device_id);
    if (!d.enabled || d.type === 'actuator') fail('El sensor está inactivo o es un actuador');
    const value = number(b.value);
    const date = b.timestamp ? new Date(b.timestamp) : new Date(now());
    if (!Number.isFinite(date.getTime()) || date.getTime() > now() + 60000 || date.getTime() < now() - 7 * 86400000) fail('La fecha debe estar dentro de los últimos 7 días');
    const timestamp = date.toISOString(), key = timestamp + '#' + randomUUID();
    const id = Buffer.from(JSON.stringify([d.id, key])).toString('base64url');
    const writes = [put(item(`READING#${d.id}`, key, { id, device_id: d.id, value, timestamp, expires: Math.floor(date.getTime()/1000) + 7*86400 }))];
    writes.push(put(change(d, !d.last_seen || timestamp >= d.last_seen ? { value, last_seen: timestamp } : {}), d));
    for (const r of (await store.list('RULE')).filter(r => r.device_id === d.id && r.enabled)) {
      if (!(r.operator === '>' ? value > r.threshold : value < r.threshold)) continue;
      const previous = r.open_alert ? await store.get('ALERT', r.open_alert) : null;
      if (previous && !previous.acknowledged && previous.expires > seconds()) continue;
      const alertId = randomUUID();
      writes.push(put(change(r, { open_alert: alertId }), r));
      writes.push(put(item('ALERT', alertId, { id: alertId, device_id: d.id, rule_id: r.id, timestamp,
        message: `${r.name}: ${value} ${d.unit} (${r.operator} ${r.threshold})`, acknowledged: 0, expires: seconds() + 7*86400 })));
    }
    if (writes.length > 100) fail('Demasiadas reglas por sensor');
    await store.commit(writes);
    return { ok: true, id };
  }
  async function dispatch(event) {
    if (event.source === 'domotix.simulator') {
      const started = now();
      const sleep = config.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
      for (let tick = 0; tick < (config.simulationTicks || 12); tick++) {
      if (tick) await sleep(Math.max(0, started + tick * 5000 - now()));
      for (const d of await catalog()) {
        if (!d.enabled || d.type === 'actuator') continue;
        const value = Number((d.type === 'humidity' ? 45 + Math.random()*30 : d.type === 'energy' ? 1 + Math.random()*4 : 23 + Math.random()*14).toFixed(2));
        try { await ingest({ device_id: d.id, value }); } catch (e) { if (e.status !== 409) throw e; }
      }
      }
      return { statusCode: 200, body: '{"ok":true}' };
    }
    const headers = Object.fromEntries(Object.entries(event.headers || {}).map(([k,v]) => [k.toLowerCase(), v]));
    const method = event.requestContext?.http?.method || event.httpMethod;
    const path = event.rawPath || event.path;
    const query = event.queryStringParameters || {};
    const response = (status, data, cookies) => ({ statusCode: status,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
      ...(cookies ? { cookies } : {}), body: JSON.stringify(data) });
    const body = () => {
      const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString() : (event.body || '{}');
      if (Buffer.byteLength(raw) > 16384) fail('Petición demasiado grande', 413);
      try { const b = JSON.parse(raw); if (!b || Array.isArray(b) || typeof b !== 'object') fail('JSON inválido'); return b; }
      catch { fail('JSON inválido'); }
    };
    // CloudFront reenvía las cookies al mismo origen. No se habilita CORS comodín.
    if (!['GET','HEAD'].includes(method) && headers.origin && headers.origin !== config.origin) fail('Origen no permitido', 403);
    if (path === '/api/login' && method === 'POST') {
      const b = body(), ip = event.requestContext?.http?.sourceIp || 'unknown';
      const key = digest(ip) + ':' + Math.floor(seconds()/60);
      await store.attempt(key, seconds()+120);
      if (typeof b.password !== 'string' || b.password.length > 256 || String(b.email).toLowerCase() !== config.email.toLowerCase()) fail('Credenciales incorrectas', 401);
      const hash = scryptSync(b.password, config.salt, 64);
      if (!timingSafeEqual(hash, Buffer.from(config.hash, 'hex'))) fail('Credenciales incorrectas', 401);
      if (!await store.get('META', 'initialized')) {
        const seeds = [ ['Temperatura ambiente','Sala principal','temperature',32], ['Humedad relativa','Sala principal','humidity',75],
          ['Consumo eléctrico','Planta baja','energy',4], ['Temperatura exterior','Terraza','temperature',35],
          ['Iluminación principal','Sala principal','actuator',0], ['Ventilación','Sala principal','actuator',0] ];
        const writes = [put(item('META','initialized',{}))];
        for (const [index, [name, location, type, threshold]] of seeds.entries()) {
          const id = `demo-${index+1}`;
          writes.push(put(item('DEVICE',id,{ id,name,location,type,unit:units[type],threshold,enabled:1,state:0 })));
          if (type !== 'actuator') writes.push(put(item('RULE',id,{ id,device_id:id,name:`Umbral de ${name}`,operator:'>',threshold,enabled:1 })));
        }
        try { await store.commit(writes); } catch(e) { if (!await store.get('META','initialized')) throw e; }
      }
      const token = randomBytes(32).toString('hex');
      await store.commit([put(item('SESSION', digest(token), { email: config.email, expires: seconds()+28800 }))]);
      return response(200, { email: config.email }, [cookie(token)]);
    }
    const rawCookie = (event.cookies || [headers.cookie || '']).join('; ');
    const token = rawCookie.match(/(?:^|;\s*)session=([a-f0-9]{64})(?:;|$)/)?.[1];
    const session = token ? await store.get('SESSION', digest(token)) : null;
    const sensorAuth = path === '/api/telemetry' && method === 'POST' && config.ingestKey &&
      headers['x-api-key'] && timingSafeEqual(Buffer.from(digest(headers['x-api-key'])), Buffer.from(digest(config.ingestKey)));
    if (!sensorAuth && (!session || session.expires <= seconds())) fail('Inicia sesión para continuar', 401);
    if (path === '/api/me' && method === 'GET') return response(200, { email: session.email, mode: 'aws', refreshMs: 5000 });
    if (path === '/api/logout' && method === 'POST') {
      await store.remove('SESSION', digest(token)); return response(200, { ok: true }, [cookie('', 0)]);
    }
    if (path === '/api/devices' && method === 'GET') {
      const result = [];
      for (const d of await catalog()) {
        const latest = (await readings(d, {}, 1))[0];
        result.push({ ...publicItem(d), value: latest?.value ?? null, last_seen: latest?.timestamp ?? null });
      }
      return response(200, result.sort((a,b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name)));
    }
    if (path === '/api/devices' && method === 'POST') {
      const b = body(); if (!Object.hasOwn(units, b.type)) fail('Tipo inválido');
      if ((await catalog()).length >= 30) fail('Límite de demostración: 30 dispositivos');
      const id = randomUUID();
      await store.commit([put(item('DEVICE', id, { id, name: text(b.name), location: text(b.location), type: b.type, unit: units[b.type], threshold: number(b.threshold), enabled: 1, state: 0 }))]);
      return response(201, { id });
    }
    const dm = path?.match(/^\/api\/devices\/([^/]+)$/);
    if (dm && ['PATCH','DELETE'].includes(method)) {
      const d = await device(dm[1]);
      if (method === 'DELETE') {
        if (d.enabled) fail('Desactiva el nodo antes de eliminarlo');
        // Tombstone impide que una ingesta simultánea recree el nodo eliminado.
        await store.commit([put(change(d, { deleted: true }), d)]);
      } else {
        const b = body(), next = {};
        for (const key of ['name','location']) if (b[key] !== undefined) next[key] = text(b[key]);
        if (b.threshold !== undefined) next.threshold = number(b.threshold);
        for (const key of ['enabled','state']) if (b[key] !== undefined) next[key] = flag(b[key]);
        await store.commit([put(change(d, next), d)]);
      }
      return response(200, { ok: true });
    }
    if (path === '/api/telemetry' && method === 'POST') return response(201, await ingest(body()));
    if (path === '/api/readings' && method === 'GET') {
      const filters = {};
      for (const key of ['from','to']) if (query[key]) { const date = new Date(query[key]); if (!Number.isFinite(date.getTime())) fail('Filtro de fecha inválido'); filters[key] = date.toISOString(); }
      if (filters.from && filters.to && filters.from > filters.to) fail('Rango de fechas inválido');
      const all = await catalog(), rows = [];
      for (const d of all.filter(d => !query.device_id || d.id === query.device_id)) rows.push(...await readings(d, filters));
      return response(200, rows.sort((a,b) => b.timestamp.localeCompare(a.timestamp)).slice(0,1000));
    }
    const reading = path?.match(/^\/api\/readings\/([A-Za-z0-9_-]+)$/);
    if (reading && method === 'DELETE') {
      let key; try { key = JSON.parse(Buffer.from(reading[1], 'base64url').toString()); } catch { fail('Lectura inválida'); }
      if (!Array.isArray(key) || key.length !== 2 || !key.every(v => typeof v === 'string')) fail('Lectura inválida');
      await device(key[0]); await store.remove(`READING#${key[0]}`, key[1]); return response(200, { ok: true });
    }
    if (path === '/api/rules' && method === 'GET') {
      const ds = await catalog();
      return response(200, (await store.list('RULE')).filter(r => ds.some(d => d.id === r.device_id)).map(r => { const d = ds.find(d => d.id === r.device_id); return { ...publicItem(r), device_name: d.name, unit: d.unit }; }));
    }
    if (path === '/api/rules' && method === 'POST') {
      const b = body(), d = await device(b.device_id);
      if (d.type === 'actuator') fail('Selecciona un sensor');
      if (!['>','<'].includes(b.operator)) fail('Operador inválido');
      if ((await store.list('RULE')).filter(r => r.device_id === d.id).length >= 20) fail('Límite de 20 reglas por sensor');
      const id = randomUUID();
      await store.commit([put(change(d, {}), d), put(item('RULE', id, { id, device_id: d.id, name: text(b.name), operator: b.operator, threshold: number(b.threshold), enabled: 1 }))]);
      return response(201, { id });
    }
    const rule = path?.match(/^\/api\/rules\/([^/]+)$/);
    if (rule && ['PATCH','DELETE'].includes(method)) {
      const r = await store.get('RULE', rule[1]); if (!r) fail('Regla no encontrada', 404);
      await device(r.device_id);
      if (method === 'DELETE') await store.remove('RULE', r.id, r.version);
      else {
        const b = body(), next = {};
        if (b.name !== undefined) next.name = text(b.name);
        if (b.operator !== undefined) { if (!['>','<'].includes(b.operator)) fail('Operador inválido'); next.operator = b.operator; }
        if (b.threshold !== undefined) next.threshold = number(b.threshold);
        if (b.enabled !== undefined) next.enabled = flag(b.enabled);
        await store.commit([put(change(r, next), r)]);
      }
      return response(200, { ok: true });
    }
    if (path === '/api/alerts' && method === 'GET') {
      const ds = await catalog();
      return response(200, (await store.list('ALERT')).filter(a => a.expires > seconds() && ds.some(d => d.id === a.device_id)).sort((a,b) => b.timestamp.localeCompare(a.timestamp)).slice(0,100).map(a => ({ ...publicItem(a), device_name: ds.find(d => d.id === a.device_id).name })));
    }
    const alert = path?.match(/^\/api\/alerts\/([^/]+)$/);
    if (alert && method === 'PATCH') {
      const a = await store.get('ALERT', alert[1]); if (!a) fail('Alerta no encontrada', 404);
      await device(a.device_id); await store.commit([put(change(a, { acknowledged: 1 }), a)]);
      return response(200, { ok: true });
    }
    fail('Ruta no encontrada', 404);
  }
  return async event => {
    try { return await dispatch(event); }
    catch (e) {
      const conflict = ['ConditionalCheckFailedException','TransactionCanceledException'].includes(e.name);
      const status = e.status || (conflict ? 409 : 500);
      if (status === 500) console.error('API failure', e.name); // Nunca registrar credenciales ni eventos completos.
      return { statusCode: status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify({ error: e.status ? e.message : conflict ? 'Otro proceso actualizó el registro. Vuelve a intentar.' : 'Error interno del servidor' }) };
    }
  };
}

function dynamoStore(table, readingsTable) {
  const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
  const { DynamoDBDocumentClient, GetCommand, QueryCommand, TransactWriteCommand, DeleteCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
  const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } });
  const isReading = PK => PK.startsWith('READING#');
  const tableFor = PK => isReading(PK) ? readingsTable : table;
  const keyFor = (PK, SK) => isReading(PK) ? { SensorId: PK.slice(8), Timestamp: SK } : { PK, SK };
  const encode = row => { if (!isReading(row.PK)) return row; const {PK,SK,...rest}=row; return {...rest,...keyFor(PK,SK)}; };
  const decode = row => row?.SensorId ? { ...row, PK:'READING#'+row.SensorId, SK:row.Timestamp } : row;
  return {
    async get(PK, SK) { return decode((await db.send(new GetCommand({ TableName: tableFor(PK), Key: keyFor(PK, SK), ConsistentRead: true }))).Item); },
    async list(PK, { from, to, reverse = false, limit } = {}) {
      const result = []; let cursor;
      do {
        const values = { ':pk': isReading(PK) ? PK.slice(8) : PK }; let expression = '#pk = :pk';
        const names = { '#pk': isReading(PK) ? 'SensorId' : 'PK' }; if(from || to) names['#sk']=isReading(PK)?'Timestamp':'SK';
        if (from || to) { values[':from'] = from || ''; values[':to'] = to || '~'; expression += ' AND #sk BETWEEN :from AND :to'; }
        const page = await db.send(new QueryCommand({ TableName: tableFor(PK), KeyConditionExpression: expression, ExpressionAttributeValues: values, ExpressionAttributeNames: names,
          ConsistentRead: true, ScanIndexForward: !reverse, ExclusiveStartKey: cursor, ...(limit ? { Limit: limit-result.length } : {}) }));
        result.push(...(page.Items || []).map(decode)); cursor = page.LastEvaluatedKey;
        if (!limit && result.length > 10000) fail('Demasiados registros para esta consulta', 413);
      } while (cursor && (!limit || result.length < limit));
      return result;
    },
    async commit(writes) {
      await db.send(new TransactWriteCommand({ TransactItems: writes.map(({ next, expected }) => ({ Put: { TableName: tableFor(next.PK), Item: encode(next),
        ConditionExpression: expected === undefined ? (isReading(next.PK) ? 'attribute_not_exists(SensorId)' : 'attribute_not_exists(PK)') : '#v = :v',
        ...(expected === undefined ? {} : { ExpressionAttributeNames: { '#v': 'version' }, ExpressionAttributeValues: { ':v': expected } }) } })) }));
    },
    async remove(PK, SK, version) {
      await db.send(new DeleteCommand({ TableName: tableFor(PK), Key: keyFor(PK, SK), ...(version === undefined ? {} : {
        ConditionExpression: '#v = :v', ExpressionAttributeNames: { '#v': 'version' }, ExpressionAttributeValues: { ':v': version } }) }));
    },
    async attempt(SK, expires) {
      const result = await db.send(new UpdateCommand({ TableName: table, Key: { PK: 'ATTEMPT', SK },
        UpdateExpression: 'SET #ttl = :expires ADD #n :one', ExpressionAttributeNames: { '#n': 'count', '#ttl': 'expires' }, ExpressionAttributeValues: { ':expires': expires, ':one': 1 }, ReturnValues: 'UPDATED_NEW' }));
      if (result.Attributes.count > 10) fail('Demasiados intentos. Espera un minuto.', 429);
    }
  };
}
let app;
exports.handler = async event => {
  app ||= createApp(dynamoStore(process.env.TABLE_NAME, process.env.READINGS_TABLE), { email: process.env.ADMIN_EMAIL, salt: process.env.ADMIN_SALT,
    hash: process.env.ADMIN_HASH, origin: process.env.APP_ORIGIN, ingestKey: process.env.IOT_API_KEY });
  return app(event);
};
exports.createApp = createApp;
