const http = require('http');
const https = require('https');

function parseJson(value, fallback) {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function postJson(urlString, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const transport = url.protocol === 'https:' ? https : http;
    const payload = JSON.stringify(data);

    const req = transport.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 500,
            body: raw
          });
        });
      }
    );

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

exports.handler = async (event) => {
  const incoming = event && event.body ? event.body : {};
  const body = typeof incoming === 'string' ? parseJson(incoming, {}) : incoming;
  const ticket = body.ticket || {};
  const userId = body.userId ?? ticket.userId ?? null;
  const message = body.message || `Ticket ${ticket.id ?? 'processed'} created successfully.`;
  const notificationEndpoint = process.env.NOTIFICATION_ENDPOINT || 'http://host.docker.internal:3004/notify';

  try {
    const response = await postJson(notificationEndpoint, {
      message,
      userId
    });

    return {
      statusCode: response.statusCode < 300 ? 200 : response.statusCode,
      body: JSON.stringify({
        ok: response.statusCode < 300,
        message,
        payload: body,
        notification: {
          statusCode: response.statusCode,
          body: parseJson(response.body, response.body)
        }
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        message: 'CloudCrafter notification callback failed.',
        error: error.message,
        payload: body
      })
    };
  }
};
