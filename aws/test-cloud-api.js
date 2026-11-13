// Script para probar el endpoint público de AWS API Gateway
// Uso: node aws/test-cloud-api.js https://tu-api-id.execute-api.us-east-1.amazonaws.com

const apiUrl = process.argv[2] || process.env.AWS_API_URL;

if (!apiUrl) {
  console.error('\n⚠️ Debes proporcionar la URL de tu API Gateway.');
  console.error('Ejemplo: node aws/test-cloud-api.js https://xyz.execute-api.us-east-1.amazonaws.com\n');
  process.exit(1);
}

const cleanBaseUrl = apiUrl.replace(/\/+$/, '');
const endpoint = cleanBaseUrl.endsWith('/telemetry') ? cleanBaseUrl : `${cleanBaseUrl}/telemetry`;

console.log(`\n🚀 Conectando con AWS API Gateway: ${endpoint}`);

async function runTest() {
  try {
    // 1. Enviar una lectura normal
    console.log('\n--- 1. Enviando lectura normal de temperatura (26.5 °C) ---');
    const normalPayload = {
      device_id: 'sensor-zona-a',
      type: 'temperature',
      location: 'Sala de Servidores',
      value: 26.5,
      threshold: 35.0,
      timestamp: new Date().toISOString()
    };

    const res1 = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalPayload)
    });

    console.log(`Status HTTP: ${res1.status}`);
    const data1 = await res1.json();
    console.log('Respuesta Lambda / DynamoDB:', data1);

    // 2. Enviar una lectura crítica para disparar alerta
    console.log('\n--- 2. Enviando lectura CRÍTICA (41.2 °C > 35 °C) ---');
    const alertPayload = {
      device_id: 'sensor-zona-a',
      type: 'temperature',
      location: 'Sala de Servidores',
      value: 41.2,
      threshold: 35.0,
      timestamp: new Date().toISOString()
    };

    const res2 = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alertPayload)
    });

    console.log(`Status HTTP: ${res2.status}`);
    const data2 = await res2.json();
    console.log('Respuesta Lambda / DynamoDB:', data2);

    // 3. Consultar lecturas guardadas (GET)
    console.log('\n--- 3. Consultando lecturas guardadas en DynamoDB (GET) ---');
    const res3 = await fetch(endpoint, { method: 'GET' });
    console.log(`Status HTTP: ${res3.status}`);
    const items = await res3.json();
    console.log(`Total de lecturas recuperadas de la nube: ${items.length}`);
    if (items.length > 0) {
      console.log('Última lectura en DynamoDB:', items[0]);
    }

    console.log('\n✅ ¡Prueba en la nube exitosa! Los datos están guardándose en Amazon DynamoDB.\n');

  } catch (error) {
    console.error('\n❌ Error probando el endpoint de AWS:', error.message);
  }
}

runTest();
