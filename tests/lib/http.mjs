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

/** Default per-request timeout — hung server must fail fast, not block for tens of minutes. */
export const DEFAULT_HTTP_TIMEOUT_MS = 30_000;

export function httpRequest(method, urlPath, { body, headers = {}, timeoutMs = DEFAULT_HTTP_TIMEOUT_MS } = {}) {
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
    if (timeoutMs > 0) {
      req.setTimeout(timeoutMs, () => {
        req.destroy(new Error(`HTTP ${method} ${urlPath} timed out after ${timeoutMs}ms`));
      });
    }
    if (payload) req.write(payload);
    req.end();
  });
}

export const get = (path, headers, opts = {}) =>
  httpRequest('GET', path, { headers, timeoutMs: opts.timeoutMs });
export const post = (path, body, headers, opts = {}) =>
  httpRequest('POST', path, { body, headers, timeoutMs: opts.timeoutMs });

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
