const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5000;
const HOST = '0.0.0.0';
const ROOT = path.join(__dirname, 'taxitime.co.nz', 'Dispatchthree');

const mimeTypes = {
  '.html': 'text/html',
  '.aspx': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
};

function resolveFilePath(urlPath) {
  const candidates = [
    path.join(ROOT, urlPath),
    path.join(ROOT, urlPath + '.html'),
    path.join(ROOT, urlPath, 'Default.aspx'),
    path.join(ROOT, urlPath, 'index.html'),
  ];
  for (const candidate of candidates) {
    try {
      const stat = fs.statSync(candidate);
      if (stat.isFile()) return candidate;
    } catch (e) {}
  }
  return null;
}

const SILENT_OK_PATTERNS = [
  '/cdn-cgi/',
  '/%7B%7B',
  '/{{',
];

// Actions that should return empty arrays (no live data in demo)
const EMPTY_ARRAY_ACTIONS = [
  'RetrieveAlarms',
  'AllAlarms',
  'RetrieveAlarts',
  'RetrieveAlerts',
  'GetAlarms',
  'GetAlerts',
];

// Actions that are write operations — return a success message
const WRITE_ACTIONS = [
  'DataProcessor',
  'DataProcessor1',
  'InsertAlarm',
  'UpdateAlarm',
  'UpdateAlarts',
  'UpdateAlerts',
  'storeemergency',
  'UpdateNotificationFlag',
];

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache',
  'Access-Control-Allow-Origin': '*',
};

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => resolve(body));
    req.on('error', () => resolve(''));
  });
}

const server = http.createServer(async (req, res) => {
  let urlPath = req.url.split('?')[0];

  if (urlPath === '/' || urlPath === '') {
    urlPath = '/Default.aspx';
  }

  if (SILENT_OK_PATTERNS.some(p => urlPath.startsWith(p))) {
    res.writeHead(200, JSON_HEADERS);
    res.end('{}');
    return;
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // For POST requests to data endpoints, route by action
  if (req.method === 'POST' && urlPath.includes('/DataManager/Data.aspx/')) {
    const body = await readBody(req);
    let action = '';
    try {
      const parsed = JSON.parse(body);
      action = (parsed.action || '').toString();
    } catch (e) {}

    // Alarm/alert queries — return empty so modal never auto-opens
    if (EMPTY_ARRAY_ACTIONS.includes(action)) {
      console.log(`200: POST ${urlPath} [action=${action}] -> []`);
      res.writeHead(200, JSON_HEADERS);
      res.end('{"d":"[]"}');
      return;
    }

    // Write operations — return success acknowledgement
    if (
      urlPath.includes('/DataProcessor') ||
      WRITE_ACTIONS.includes(action)
    ) {
      const successMsg = action === 'InsertAlarm'
        ? 'Alarm Saved Successfully'
        : action.startsWith('Update')
          ? 'Operation Successfully Performed'
          : action === 'storeemergency'
            ? 'Emergency Stored'
            : 'Operation Successfully Performed';
      console.log(`200: POST ${urlPath} [action=${action}] -> "${successMsg}"`);
      res.writeHead(200, JSON_HEADERS);
      res.end(JSON.stringify({ d: successMsg }));
      return;
    }
  }

  const filePath = resolveFilePath(urlPath);

  if (!filePath) {
    // Silently ignore missing secondary data endpoints
    if (req.method === 'POST' && urlPath.includes('/DataManager/')) {
      res.writeHead(200, JSON_HEADERS);
      res.end('{"d":"[]"}');
      return;
    }
    console.log(`404: ${req.method} ${urlPath}`);
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end(`404 Not Found: ${urlPath}`);
    return;
  }

  console.log(`200: ${req.method} ${urlPath} -> ${filePath.replace(ROOT, '')}`);

  const ext = path.extname(filePath).toLowerCase();
  const isPost = req.method === 'POST';
  const contentType = isPost ? 'application/json' : (mimeTypes[ext] || 'application/octet-stream');

  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*',
  });

  fs.createReadStream(filePath).pipe(res);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Killing existing process and retrying...`);
    const { execSync } = require('child_process');
    try { execSync(`fuser -k ${PORT}/tcp`); } catch (e) {}
    setTimeout(() => {
      server.close();
      server.listen(PORT, HOST, () => {
        console.log(`Serving ${ROOT} at http://${HOST}:${PORT}`);
      });
    }, 1000);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Serving ${ROOT} at http://${HOST}:${PORT}`);
});
