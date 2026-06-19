import http from 'node:http';
import { BASE_URL } from './config.mjs';

function parseUrl(urlPath) {
  const u = new URL(urlPath, BASE_URL);
  return {
    hostname: u.hostname,
    port: Number(u.port || 80),
    path: u.pathname + u.search,
  };
}

export function httpRequest(method, urlPath, { body, headers = {} } = {}) {
  const { hostname, port, path: reqPath } = parseUrl(urlPath);
  return new Promise((resolve, reject) => {
    const payload = body != null ? JSON.stringify(body) : null;
    const opts = {
      hostname,
      port,
      path: reqPath,
      method,
      headers: {
        ...(payload
          ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
          : {}),
        ...headers,
      },
    };
    const req = http.request(opts, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        let parsed = raw;
        try {
          parsed = JSON.parse(raw);
        } catch {
          /* keep raw */
        }
        resolve({
          status: res.statusCode ?? 0,
          body: parsed,
          raw,
          headers: res.headers,
        });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

export const get = (path, headers) => httpRequest('GET', path, { headers });
export const post = (path, body, headers) => httpRequest('POST', path, { body, headers });

export function cookieFromResponse(res) {
  const set = res.headers['set-cookie'] || [];
  const hit = set.find((c) => c.startsWith('BW_SID='));
  return hit ? hit.split(';')[0] : '';
}

export function parseDataManager(body) {
  if (body && body.d) {
    try {
      return JSON.parse(body.d);
    } catch {
      return body.d;
    }
  }
  return body;
}

export function dmPairs(...pairs) {
  const data = [];
  for (let i = 0; i < pairs.length; i += 2) {
    data.push({ name: pairs[i], value: String(pairs[i + 1]) });
  }
  return data;
}
