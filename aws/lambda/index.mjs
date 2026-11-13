import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || 'TelemetryReadings';

// Cabeceras estándar para permitir CORS desde cualquier origen (S3, localhost, etc.)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-API-Key,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
};

export const handler = async (event) => {
  console.log('Evento recibido:', JSON.stringify(event));

  // Manejo de preflight CORS (OPTIONS)
  if (event.requestContext?.http?.method === 'OPTIONS' || event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: ''
    };
  }

  const method = event.requestContext?.http?.method || event.httpMethod || 'POST';

  try {
    // 1. ENDPOINT POST: Ingesta de Telemetría IoT
    if (method === 'POST') {
      let body = {};
      if (typeof event.body === 'string') {
        body = JSON.parse(event.body || '{}');
      } else if (event.body) {
        body = event.body;
      }

      const { device_id, value, type, location, threshold } = body;

      if (!device_id || value === undefined) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'device_id y value son requeridos' })
        };
      }

      const numValue = Number(value);
      const timestamp = body.timestamp || new Date().toISOString();
      const numThreshold = threshold !== undefined ? Number(threshold) : 35.0;

      // Validación de regla de alarma
      const isAlert = numValue > numThreshold;

      const item = {
        SensorId: String(device_id),
        Timestamp: timestamp,
        Value: numValue,
        Type: type || 'temperature',
        Location: location || 'Planta General',
        Threshold: numThreshold,
        IsAlert: isAlert,
        Status: isAlert ? 'ALERTA_SUPERADA' : 'NORMAL'
      };

      // Guardar registro Time-Series en DynamoDB
      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: item
      }));

      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({
          message: 'Telemetría procesada y almacenada en DynamoDB exitosamente',
          data: item
        })
      };
    }

    // 2. ENDPOINT GET: Consultar lecturas recientes
    if (method === 'GET') {
      const response = await docClient.send(new ScanCommand({
        TableName: TABLE_NAME,
        Limit: 50
      }));

      // Ordenar por timestamp descendente
      const items = (response.Items || []).sort((a, b) => 
        new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime()
      );

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(items)
      };
    }

    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Método no permitido' })
    };

  } catch (error) {
    console.error('Error procesando solicitud:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Error interno en AWS Lambda',
        details: error.message
      })
    };
  }
};
