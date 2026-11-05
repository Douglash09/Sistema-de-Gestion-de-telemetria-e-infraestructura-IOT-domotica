// Envío externo opcional. El servidor ya incluye un simulador cada cinco segundos.
if(!process.env.IOT_API_KEY||!process.env.SENSOR_ID){console.error('Configura IOT_API_KEY y SENSOR_ID en .env.');process.exit(1);}
const base=process.env.API_URL||'http://127.0.0.1:3000';
async function send(){try{const r=await fetch(`${base}/api/telemetry`,{method:'POST',headers:{'Content-Type':'application/json','X-API-Key':process.env.IOT_API_KEY},body:JSON.stringify({device_id:process.env.SENSOR_ID,value:23+Math.random()*14})});console.log(new Date().toISOString(),r.status,await r.text());}catch(e){console.error(e.message);}}
await send();setInterval(send,5000);
