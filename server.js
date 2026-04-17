const http = require('http');
const https = require('https');
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

// ─── In-memory job store ──────────────────────────────────────────────────────
let nextJobId = 937300;
function newJobId() { return nextJobId++; }

// ─── In-memory message store ──────────────────────────────────────────────────
let nextMsgId = 100;
const messageStore = [];

function buildDriverChatList() {
  return ZONE_DRIVERS.map(d => {
    const did = String(d.driverid || d.VehicleId || '');
    const unread = messageStore.filter(m => String(m.SenderId) === did && !m.IsRead).length;
    return { Id: d.driverid || d.VehicleId, UserFName: d.drivername.split(' ')[0], UserLName: d.drivername.split(' ').slice(1).join(' '), Count: unread, PlayerId: '' };
  });
}

// ─── Closed job store (historical demo data) ──────────────────────────────────
// Closed job demo records — dates are kept within the past 7 days so they
// survive the client-side "DateFrom = today" filter in the ClosedJobs search.
function _closedDate(daysAgo, time) {
  const d = new Date(); d.setDate(d.getDate() - daysAgo);
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), dd = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd} ${time}.`;
}
const closedJobStore = [
  { Id: 937100, BookingDateTime: _closedDate(0, '09:00:00'), JobCompleteTime: _closedDate(0, '09:28:00'), PickAddress: '12 Dee St, Invercargill', DropAddress: 'Invercargill Hospital, Kew Rd', Name: 'Alice Brown', PhoneNo: '021 400 1001', VehicleNo: 'T201', UserFName: 'Michael', UserLName: 'Johnson', BookingSource: 'App', BookingStatus: 'Dispatched', DriverId: 101, VehicleId: 201 },
  { Id: 937101, BookingDateTime: _closedDate(0, '11:15:00'), JobCompleteTime: _closedDate(0, '11:47:00'), PickAddress: '88 Tay St, Invercargill', DropAddress: 'Invercargill Airport', Name: 'Brian Clark', PhoneNo: '021 400 1002', VehicleNo: 'T202', UserFName: 'Sarah', UserLName: 'Wilson', BookingSource: 'Dispatch Console', BookingStatus: 'Dispatched', DriverId: 102, VehicleId: 202 },
  { Id: 937102, BookingDateTime: _closedDate(1, '13:30:00'), JobCompleteTime: '', PickAddress: '5 Don St, Invercargill', DropAddress: 'Waikiwi Mall', Name: 'Carol Evans', PhoneNo: '021 400 1003', VehicleNo: 'T203', UserFName: 'David', UserLName: 'Thompson', BookingSource: 'Phone', BookingStatus: 'Cancel', DriverId: 103, VehicleId: 203 },
  { Id: 937103, BookingDateTime: _closedDate(1, '07:45:00'), JobCompleteTime: _closedDate(1, '08:05:00'), PickAddress: '200 Elles Rd, Invercargill', DropAddress: '14 Yarrow St, Invercargill', Name: 'Daniel Ford', PhoneNo: '021 400 1004', VehicleNo: 'T204', UserFName: 'Emma', UserLName: 'Davies', BookingSource: 'App', BookingStatus: 'Dispatched', DriverId: 104, VehicleId: 204 },
  { Id: 937104, BookingDateTime: _closedDate(2, '16:00:00'), JobCompleteTime: '', PickAddress: '3 Leven St, Invercargill', DropAddress: 'Queens Park, Invercargill', Name: 'Eve Green', PhoneNo: '021 400 1005', VehicleNo: 'T205', UserFName: 'James', UserLName: 'Brown', BookingSource: 'Dispatch Console', BookingStatus: 'No Show', DriverId: 105, VehicleId: 205 },
  { Id: 937105, BookingDateTime: _closedDate(2, '10:00:00'), JobCompleteTime: _closedDate(2, '10:22:00'), PickAddress: 'Invercargill Airport', DropAddress: '56 Gala St, Invercargill', Name: 'Frank Harris', PhoneNo: '021 400 1006', VehicleNo: 'T201', UserFName: 'Michael', UserLName: 'Johnson', BookingSource: 'App', BookingStatus: 'Dispatched', DriverId: 101, VehicleId: 201 },
];

function calcJobMins(bookingDateTimeStr) {
  const bdt = new Date(bookingDateTimeStr.replace(/\.$/, '').trim());
  const now = new Date();
  return Math.round((bdt - now) / 60000);
}

// Add UI-friendly field aliases to a job object so Angular ng-repeat bindings work
// (template uses BookingDate, BookingTime, PassengerId, TarriffType, bookingidx)
function enrichSearchResult(j) {
  const rawDT = (j.BookingDateTime || '').replace(/\.$/, '').trim();
  const [datePart = '', timePart = ''] = rawDT.split(' ');
  return {
    ...j,
    bookingidx:   j.Id,
    BookingDate:  datePart,
    BookingTime:  timePart,
    PassengerId:  j.Name || j.PassengerId || '',
    TarriffType:  j.TarriffType || j.BookingSource || '',
  };
}

// Format a Date object as the "YYYY-MM-DD HH:MM:SS." string the client expects
function fmtDT(dt) {
  const pad = n => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:00.`;
}

// Live job store — starts empty; jobs are created through the dispatch UI
const jobStore = [];

// Live drivers come exclusively from Firebase (online/1216).
// This array is kept as an empty structure so dependent code paths don't crash.
const ZONE_DRIVERS = [];

// Build full job-list DataSelector response
function buildJobListResponse(jobs) {
  // Terminal statuses — jobs in these states are done and must NOT appear in the dispatcher queue
  const TERMINAL = new Set(['Dispatched', 'Done', 'Cancel', 'Cancelled', 'Closed', 'Completed', 'No Show', 'NoShow', 'Reject']);
  const activeJobs = jobs.filter(j => !TERMINAL.has(j.BookingStatus));
  const dt1 = activeJobs.map(j => ({ ...j, JobMins: calcJobMins(j.BookingDateTime) }));
  const pending = dt1.filter(j => j.BookingStatus === 'Pending');
  return {
    dt1,
    dt2: [{ AssignedCount: activeJobs.filter(j => j.BookingStatus === 'Assigned').length }],
    dt3: [{ ActiveCount: activeJobs.filter(j => j.BookingStatus === 'Active' || j.BookingStatus === 'Picking').length }],
    dt4: [{ UnAssignedCount: pending.length }],
    dt5: [{ PublicKey: '' }],
  };
}

// Build delivery (DY tab) response — mirrors buildJobListResponse with deUnAssignedCount
function buildDeliveryResponse(jobs) {
  const deliveryJobs = jobs.filter(j => j.BookingType === 'Delivery' || j.BookingSource === 'Delivery App');
  const dt1 = deliveryJobs.map(j => ({ ...j, JobMins: calcJobMins(j.BookingDateTime) }));
  return {
    dt1,
    dt2: [{ AssignedCount: 0 }],
    dt3: [{ ActiveCount: 0 }],
    dt4: [{ deUnAssignedCount: dt1.length }],
    dt5: [{ PublicKey: '' }],
  };
}

function buildAssignedResponse(jobs) {
  const assigned = jobs.filter(j => j.BookingStatus === 'Assigned' || j.BookingStatus === 'Offered');
  const dt1 = assigned.map(j => ({ ...j, JobMins: calcJobMins(j.BookingDateTime) }));
  return {
    dt1,
    dt2: [{ AssignedCount: dt1.length }],
    dt3: [{ ActiveCount: 0 }],
    dt4: [{ UnAssignedCount: jobStore.filter(j => j.BookingStatus === 'Pending').length }],
    dt5: [{ PublicKey: '' }],
  };
}

// ─── Real-backend proxy ───────────────────────────────────────────────────────
// Forwards DataManager AJAX calls to the live taxitime.co.nz ASP.NET backend,
// including cookie passthrough so ASP.NET sessions work end-to-end.
const REAL_BACKEND_HOST = 'taxitime.co.nz';
const REAL_BACKEND_PREFIX = '/Dispatchthree';

// Server-side session cache: once any request successfully authenticates with the
// production backend, store the resulting ASP.NET session cookie here.  Subsequent
// proxy requests merge this cookie in, so every browser tab benefits from a single
// successful login without needing its own session cookie.
let _cachedProductionCookies = '';

// Merge a Set-Cookie header value into the cached cookie jar (key=value pairs only)
function _cacheCookiesFromHeader(rawCookies) {
  if (!rawCookies) return;
  const cookies = Array.isArray(rawCookies) ? rawCookies : [rawCookies];
  const jar = {};
  // Seed jar with already-cached values
  _cachedProductionCookies.split(';').forEach(pair => {
    const [k, v] = pair.trim().split('=');
    if (k) jar[k.trim()] = (v || '').trim();
  });
  // Overlay new cookies from response
  cookies.forEach(c => {
    const kv = c.split(';')[0].trim();
    const [k, v] = kv.split('=');
    if (k) jar[k.trim()] = (v || '').trim();
  });
  _cachedProductionCookies = Object.entries(jar).map(([k,v]) => `${k}=${v}`).join('; ');
  console.log(`[proxy] updated server-side session cookie (${Object.keys(jar).length} keys)`);
}

// Strip domain/SameSite attrs and return browser-safe Set-Cookie strings
function _sanitiseCookiesForBrowser(rawCookies) {
  if (!rawCookies) return [];
  const cookies = Array.isArray(rawCookies) ? rawCookies : [rawCookies];
  return cookies.map(c =>
    c.replace(/;\s*domain=[^;,]*/gi, '').replace(/;\s*samesite=[^;,]*/gi, '')
  );
}

function proxyToRealBackend(urlPath, method, body, incomingCookies) {
  return new Promise((resolve, reject) => {
    const targetPath = REAL_BACKEND_PREFIX + urlPath;
    const bodyBuf    = Buffer.from(body || '');

    // Merge browser cookies with the server-side cached production session cookie
    // so requests succeed even when the browser's own session cookie is missing.
    const mergedCookies = (() => {
      const jar = {};
      const add = str => (str || '').split(';').forEach(pair => {
        const [k, v] = pair.trim().split('=');
        if (k && k.trim()) jar[k.trim()] = (v || '').trim();
      });
      add(_cachedProductionCookies);  // cached first (lower priority)
      add(incomingCookies);           // browser cookie overrides
      return Object.entries(jar).map(([k,v]) => `${k}=${v}`).join('; ');
    })();

    const options = {
      hostname: REAL_BACKEND_HOST,
      port: 443,
      path: targetPath,
      method: method,
      headers: {
        'Content-Type':   'application/json; charset=utf-8',
        'Content-Length': bodyBuf.length,
        'Cookie':         mergedCookies,
        'User-Agent':     'Mozilla/5.0 (compatible; TaxiTimeDispatch/1.0)',
        'Accept':         'application/json, text/javascript, */*',
        'Origin':         'https://taxitime.co.nz',
        'Referer':        'https://taxitime.co.nz/Dispatchthree/',
      },
      timeout: 8000,
    };

    const proxyReq = https.request(options, (proxyRes) => {
      const chunks = [];
      proxyRes.on('data', c => chunks.push(c));
      proxyRes.on('end', () => {
        resolve({
          statusCode: proxyRes.statusCode,
          headers:    proxyRes.headers,
          body:       Buffer.concat(chunks).toString('utf8'),
        });
      });
    });

    proxyReq.on('timeout', () => { proxyReq.destroy(); reject(new Error('proxy timeout')); });
    proxyReq.on('error',   reject);
    if (bodyBuf.length) proxyReq.write(bodyBuf);
    proxyReq.end();
  });
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache',
  'Access-Control-Allow-Origin': '*',
};

function jsonReply(res, obj) {
  res.writeHead(200, JSON_HEADERS);
  res.end(JSON.stringify(obj));
}

function successD(res, msg) {
  jsonReply(res, { d: msg });
}

function arrayD(res, arr) {
  jsonReply(res, { d: JSON.stringify(arr) });
}

function objectD(res, obj) {
  jsonReply(res, { d: JSON.stringify(obj) });
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => resolve(body));
    req.on('error', () => resolve(''));
  });
}

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

const SILENT_OK_PATTERNS = ['/cdn-cgi/', '/%7B%7B', '/{{'];

// ─── Request handler ──────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/' || urlPath === '') urlPath = '/Default.aspx';

  if (SILENT_OK_PATTERNS.some(p => urlPath.startsWith(p))) {
    res.writeHead(200, JSON_HEADERS);
    res.end('{}');
    return;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // ── DataManager POST routing ────────────────────────────────────────────────
  if (req.method === 'POST' && urlPath.includes('/DataManager/')) {
    const body = await readBody(req);
    let parsed = {};
    try { parsed = JSON.parse(body); } catch (e) {}
    const action = (parsed.action || '').toString();
    const dataArr = Array.isArray(parsed.data) ? parsed.data : [];

    // Helper: find a param value by name (case-insensitive)
    function param(name) {
      const n = name.toLowerCase();
      const found = dataArr.find(p => (p.name || '').toLowerCase() === n);
      return found ? (found.value !== undefined ? found.value : found.Value) : undefined;
    }

    // ── Proxy to real taxitime.co.nz backend ───────────────────────────────
    // Actions that are custom additions to this demo — real backend won't know them,
    // so skip the proxy and go straight to local mock handlers for these.
    const LOCAL_ONLY_ACTIONS = new Set([
      '[UnAssignedJobsv3]', '[deviUnAssignedJobsv2]', '[VehicleInfov2]',
      '[AssignJobStatusFromJobListv2]',
      '[changeriddestatusforoffer]', '[DriverStatusChanged]',
      '[MessageInsert]', '[DriverMessageInsert]', '[BroadcastMessage]',
      '[GroupMessage]', '[DeleteMessage]',
      '[KickDriver]', '[DispatcherKickUsers]', '[UpdateQueueNo]',
    ]);

    if (!LOCAL_ONLY_ACTIONS.has(action)) {
      try {
        const proxied = await proxyToRealBackend(
          urlPath, req.method, body, req.headers['cookie'] || ''
        );
        const bodyText = (proxied.body || '').trim();
        const isSessionExpired = bodyText.includes('Session is experied') || bodyText.includes('Session is expired');

        // Always cache any Set-Cookie headers the production backend sends back
        // (even for failed/non-JSON responses) so the session stays alive.
        if (proxied.headers['set-cookie'] && !isSessionExpired) {
          _cacheCookiesFromHeader(proxied.headers['set-cookie']);
        }

        // Special case: LoginSelector — just forward the cookies and return success.
        // The production login endpoint may return a plain string or non-JSON body;
        // we don't care about the body — we just need the session cookie set.
        if (action === 'LoginSelector' && proxied.statusCode === 200 && !isSessionExpired) {
          const replyHeaders = {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Origin': '*',
          };
          const sanitised = _sanitiseCookiesForBrowser(proxied.headers['set-cookie']);
          if (sanitised.length) replyHeaders['Set-Cookie'] = sanitised;
          res.writeHead(200, replyHeaders);
          res.end(JSON.stringify({ d: 'Login OK' }));
          console.log(`200: PROXY→REAL LoginSelector — session cookie acquired`);
          return;
        }

        // For all other actions: use proxy response only if it is valid JSON and
        // not a session-expired message (which would cause an infinite logout loop).
        if (proxied.statusCode === 200 && !isSessionExpired && (bodyText.startsWith('{') || bodyText.startsWith('['))) {
          const replyHeaders = {
            'Content-Type': proxied.headers['content-type'] || 'application/json',
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Origin': '*',
          };
          // Forward sanitised cookies (domain stripped) so browser stores them
          const sanitised = _sanitiseCookiesForBrowser(proxied.headers['set-cookie']);
          if (sanitised.length) replyHeaders['Set-Cookie'] = sanitised;
          res.writeHead(200, replyHeaders);
          res.end(proxied.body);
          console.log(`200: PROXY→REAL ${urlPath} [action=${action}] (${bodyText.length} bytes)`);
          return;
        }
        if (isSessionExpired) {
          console.log(`proxy ${action}: real backend has no session → falling back to mock`);
        } else {
          console.log(`proxy ${action}: status=${proxied.statusCode}, falling back to mock`);
        }
      } catch (proxyErr) {
        console.log(`proxy ${action}: ${proxyErr.message} — falling back to mock`);
      }
    }

    // ── /DataSelectorRide — booking write operations ────────────────────────
    if (urlPath.includes('/DataSelectorRide')) {
      if (action === 'InsertBookingv4') {
        const newId = newJobId();
        const pickAddr = param('PickLocation') || param('PickAddress') || 'Unknown pickup';
        const dropAddr = param('DropLocation') || param('DropAddress') || '';
        const pickLatLng = param('PickLatLng') || '-46.4120,168.3538';
        const dropLatLng = param('DropLatLng') || '0,0';
        const bookingDT = param('BookingDateTime') || (() => {
          const now = new Date();
          return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:00.`;
        })();
        const pickingDT = param('PickingDateTime') || bookingDT;
        const vehicleType = param('VehicleType') || 'Not Specified';
        const driverId  = parseInt(param('DId') || '0') || 0;
        const vehicleId = parseInt(param('VId') || '0') || 0;
        const passengers = parseInt(param('PassengersNo') || '1') || 1;
        const name = param('Name') || '';
        const phone = param('PassengerId') || '';
        const dispatchBefore = parseInt(param('DispatchBefore') || '10') || 10;
        const bookingType = param('Bookingtype') || 'Normal Ride';
        const quenumber = param('quenumber') || 0;

        const bookstatus = driverId > 0 ? 'Offered' : (driverId === -1 ? 'No One' : 'Pending');
        const newJob = {
          Id: newId, AccountId: '', VehicleNo: null, CallSign: null,
          useremail: null, usertype: null, webstatus: '0',
          Name: name, PhoneNo: phone,
          BookingDateTime: bookingDT,
          Pickingtime: pickingDT,
          Recieve_payment: param('Recieve_payment') || '',
          DispatchTimebefore: String(dispatchBefore),
          VehicleId: vehicleId, DriverId: driverId,
          DispatcherName: 'safinah mohammed',
          Nextstop: '0', nextstopdata: '', Passengers: passengers, passengername: '',
          PickLatLng: pickLatLng, DropLatLng: dropLatLng,
          Bags: 0, WheelChairs: 0, VehiclesReguired: 1,
          Acc_job_id: '', Account_id: '',
          PickAddress: pickAddr, DropAddress: dropAddr,
          EntitiesDetails: '', U_id: null,
          BookingSource: 'Dispatch Console',
          BookingStatus: bookstatus,
          VehicleType: vehicleType,
          EstimatedDistance: '0', EstimatedTime: '0',
          TarriffType: 'Automatic',
        };
        jobStore.push(newJob);
        console.log(`200: POST ${urlPath} [action=InsertBookingv4] -> created job #${newId}`);
        arrayD(res, [{ Result: 'Booking Information Successfully Submitted', BookingStatus: bookstatus, BookingId: newId }]);
      } else {
        // UpdateBooking, etc.
        console.log(`200: POST ${urlPath} [action=${action}] -> OK`);
        successD(res, 'Operation Successfully Performed');
      }
      return;
    }

    // ── /DataProcessor — all write operations ──────────────────────────────
    if (urlPath.includes('/DataProcessor')) {
      if (action === '[ProcUpdateJobv6]') {
        const jobId = parseInt(param('Id')) || 0;
        const job = jobStore.find(j => j.Id === jobId);
        if (job) {
          const driverId  = parseInt(param('DId') || '0') || 0;
          const vehicleId = parseInt(param('VId') || '0') || 0;
          if (param('PickLocation')) job.PickAddress = param('PickLocation');
          if (param('DropLocation')) job.DropAddress = param('DropLocation');
          if (param('PickLatLng'))   job.PickLatLng  = param('PickLatLng');
          if (param('DropLatLng'))   job.DropLatLng  = param('DropLatLng');
          if (param('Name'))         job.Name        = param('Name');
          if (param('PassengerId'))  job.PhoneNo     = param('PassengerId');
          if (param('PassengersNo')) job.Passengers  = parseInt(param('PassengersNo'));
          if (param('VehicleType'))  job.VehicleType = param('VehicleType');
          job.VehicleId = vehicleId;
          job.DriverId  = driverId;
          job.BookingStatus = driverId > 0 ? 'Offered' : 'Pending';
        }
        console.log(`200: POST ${urlPath} [action=${action}] -> "Booking Details Update Successfully"`);
        successD(res, 'Booking Details Update Successfully');

      } else if (action === '[checkjobstatus]') {
        // Gate check before dispatching — return 'true' (job is free to dispatch)
        // so the frontend proceeds with [AssignJobStatusFromJobListv2]
        const bookingId = parseInt(param('bookingsID') || param('BookingId') || '0') || 0;
        const alreadyOffered = bookingId > 0 && jobStore.some(j => j.Id === bookingId && j.BookingStatus === 'Offered');
        console.log(`200: POST ${urlPath} [action=${action}] -> job #${bookingId} alreadyOffered=${alreadyOffered}`);
        jsonReply(res, { d: alreadyOffered ? 'false' : 'true' });

      } else if (action === '[CancelUnAssignedJobStatusFromJobList]') {
        const bookingId = parseInt(param('BookingId')) || 0;
        const idx = jobStore.findIndex(j => j.Id === bookingId);
        if (idx !== -1) jobStore.splice(idx, 1);
        console.log(`200: POST ${urlPath} [action=${action}] -> removed job #${bookingId}`);
        successD(res, 'Operation Successfully Performed');

      } else if (action === '[AssignJobStatusFromJobList]' || action === '[AssignJobStatusFromJobListv2]' || action === '[UnAssignJobStatusFromJobList]') {
        const bookingId = parseInt(param('BookingId')) || 0;
        const job = jobStore.find(j => j.Id === bookingId);
        if (job) {
          const driverId = parseInt(param('reternVehicleid') || param('VehicleId') || '0') || 0;
          if (action === '[AssignJobStatusFromJobList]' || action === '[AssignJobStatusFromJobListv2]') {
            // Set directly to 'Assigned' (not 'Offered') so the job immediately
            // appears in the Assigned (blue) section and is NOT reset to Unreached
            // by the 20-second Firebase joback timeout (which has no real driver to respond).
            job.BookingStatus = 'Assigned';
            job.DriverId = driverId;
            if (driverId > 0) job.VehicleId = driverId;
            // Update demo driver status to Picking so driver card turns blue
            const zd = ZONE_DRIVERS.find(d => d.driverid === driverId || d.VehicleId === driverId);
            if (zd) {
              zd.vehiclestatus = 'Picking';
              zd.JobphoneNo = job.PhoneNo || '';
              zd.jobpickup  = job.PickAddress || '';
              zd.jobdropoff = job.DropAddress || '';
              zd.jobCount   = 1;
            }
          } else {
            // Unassign — restore demo driver to Available
            const prevDriverId = job.DriverId || 0;
            job.BookingStatus = 'Pending';
            job.DriverId = 0;
            job.VehicleId = 0;
            const zd = ZONE_DRIVERS.find(d => d.driverid === prevDriverId || d.VehicleId === prevDriverId);
            if (zd) {
              zd.vehiclestatus = 'Available';
              zd.JobphoneNo = '';
              zd.jobpickup  = '';
              zd.jobdropoff = '';
              zd.jobCount   = 0;
            }
          }
        }
        console.log(`200: POST ${urlPath} [action=${action}] -> "Operation Successfully Performed"`);
        successD(res, 'Operation Successfully Performed');

      } else if (action === 'InsertAlarm') {
        successD(res, 'Alarm Saved Successfully');
      } else if (action === 'UpdateAlarm' || action === 'UpdateAlarts' || action === 'UpdateAlerts') {
        successD(res, 'Operation Successfully Performed');
      } else if (action === 'storeemergency') {
        successD(res, 'Emergency Stored');

      } else if (action === 'ACC_Approval_add') {
        console.log(`200: POST ${urlPath} [action=${action}] -> ACC approval saved`);
        successD(res, 'Approval successfully Saved');

      } else if (action === 'ACC_Approval_update') {
        console.log(`200: POST ${urlPath} [action=${action}] -> ACC approval updated`);
        successD(res, 'Approval successfully update');

      } else if (action === 'Client_ACC_ADD') {
        console.log(`200: POST ${urlPath} [action=${action}] -> ACC client added`);
        successD(res, 'Client successfully Saved');

      } else if (action === 'Manager_ACC_ADD') {
        console.log(`200: POST ${urlPath} [action=${action}] -> ACC manager added`);
        successD(res, 'Manager successfully Saved');

      } else if (action === 'checkmanagername' || action === 'checkmanageremail' || action === 'checkmanagerphone' || action === 'checkpassengernumber') {
        console.log(`200: POST ${urlPath} [action=${action}] -> remote validation ok`);
        jsonReply(res, { d: 'true' });

      } else if (action === '[storeemergency]') {
        console.log(`200: POST ${urlPath} [action=${action}] -> emergency stored`);
        successD(res, 'Emergency Stored');

      } else if (action === '[MessageInsert]') {
        const receiverId = (param('RecieverId') || param('ReceiverId') || '').trim();
        const message    = param('Message') || '';
        const dateTime   = param('DateTime') || '';
        const datePart   = dateTime.substring(0, 10) || new Date().toISOString().substring(0, 10);
        const timePart   = dateTime.substring(11) || '';
        if (message.trim() && receiverId) {
          const msg = { Id: nextMsgId++, SenderId: 'Dispatcher', ReceiverId: receiverId, SenderName: 'Dispatcher', Message: message, Date: datePart, Time: timePart, IsRead: true };
          messageStore.push(msg);
          console.log(`200: POST ${urlPath} [action=${action}] -> message saved to driver #${receiverId}`);
        }
        successD(res, 'Message Saved');

      } else if (action === '[DriverMessageInsert]') {
        // Incoming message FROM a driver → dispatcher (sent via Firebase, stored here for history)
        const senderId  = (param('SenderId') || '').trim();
        const message   = param('Message') || '';
        const dateTime  = param('DateTime') || '';
        const datePart  = dateTime.substring(0, 10) || new Date().toISOString().substring(0, 10);
        const timePart  = dateTime.substring(11) || '';
        const driver    = ZONE_DRIVERS.find(d => String(d.driverid) === senderId || String(d.VehicleId) === senderId) || { drivername: 'Driver ' + senderId };
        if (message.trim()) {
          const msg = { Id: nextMsgId++, SenderId: senderId, ReceiverId: 'Dispatcher', SenderName: driver.drivername || ('Driver ' + senderId), Message: message, Date: datePart, Time: timePart, IsRead: false };
          messageStore.push(msg);
          console.log(`200: POST ${urlPath} [action=${action}] -> message stored from driver #${senderId}`);
        }
        successD(res, 'Message stored');

      } else if (action === '[BroadcastMessage]') {
        const message  = param('Message') || '';
        const dateTime = param('DateTime') || '';
        const datePart = dateTime.substring(0, 10) || new Date().toISOString().substring(0, 10);
        const timePart = dateTime.substring(11) || '';
        if (message.trim()) {
          ZONE_DRIVERS.forEach(d => {
            messageStore.push({ Id: nextMsgId++, SenderId: 0, ReceiverId: d.driverid, SenderName: 'Dispatcher (Broadcast)', Message: message, Date: datePart, Time: timePart, IsRead: true });
          });
          console.log(`200: POST ${urlPath} [action=${action}] -> broadcast to ${ZONE_DRIVERS.length} drivers`);
        }
        successD(res, 'Broadcast sent successfully');

      } else if (action === '[GroupMessage]') {
        const message   = param('Message') || '';
        const zone      = (param('Zone') || '').toLowerCase();
        const vtype     = (param('VehicleType') || '').toLowerCase();
        const dateTime  = param('DateTime') || '';
        const datePart  = dateTime.substring(0, 10) || new Date().toISOString().substring(0, 10);
        const timePart  = dateTime.substring(11) || '';
        let targets = [...ZONE_DRIVERS];
        if (zone) targets = targets.filter(d => d.zonename.toLowerCase().includes(zone));
        if (vtype) targets = targets.filter(d => d.vehicletype.toLowerCase().includes(vtype));
        if (message.trim()) {
          targets.forEach(d => {
            messageStore.push({ Id: nextMsgId++, SenderId: 0, ReceiverId: d.driverid, SenderName: 'Dispatcher (Group)', Message: message, Date: datePart, Time: timePart, IsRead: true });
          });
          console.log(`200: POST ${urlPath} [action=${action}] -> group message to ${targets.length} drivers`);
        }
        successD(res, `Group message sent to ${targets.length} drivers`);

      } else if (action === '[DeleteMessage]') {
        const msgId = parseInt(param('Id') || '0') || 0;
        const idx = messageStore.findIndex(m => m.Id === msgId);
        if (idx !== -1) messageStore.splice(idx, 1);
        console.log(`200: POST ${urlPath} [action=${action}] -> deleted message #${msgId}`);
        successD(res, 'Message Deleted');

      } else if (action === '[KickDriver]') {
        const driverId  = param('DriverId') || '';
        const vehicleId = param('VehicleId') || '';
        // Remove driver from demo roster so they disappear from the dispatch board
        const beforeLen = ZONE_DRIVERS.length;
        for (let i = ZONE_DRIVERS.length - 1; i >= 0; i--) {
          if (String(ZONE_DRIVERS[i].driverid) === driverId || String(ZONE_DRIVERS[i].VehicleId) === vehicleId) {
            ZONE_DRIVERS.splice(i, 1);
          }
        }
        console.log(`200: POST ${urlPath} [action=[KickDriver]] -> driver ${driverId} kicked (removed ${beforeLen - ZONE_DRIVERS.length} entries)`);
        successD(res, 'Operation Successfully Performed');

      } else if (action === '[DispatcherKickUsers]') {
        const driverId  = param('DriverId') || '';
        const vehicleId = param('VehicleId') || '';
        // Suspend: remove driver from demo roster (same effect as kick for demo)
        const beforeLen2 = ZONE_DRIVERS.length;
        for (let i = ZONE_DRIVERS.length - 1; i >= 0; i--) {
          if (String(ZONE_DRIVERS[i].driverid) === driverId || String(ZONE_DRIVERS[i].VehicleId) === vehicleId) {
            ZONE_DRIVERS.splice(i, 1);
          }
        }
        console.log(`200: POST ${urlPath} [action=[DispatcherKickUsers]] -> driver ${driverId} suspended (removed ${beforeLen2 - ZONE_DRIVERS.length} entries)`);
        successD(res, 'Operation Successfully Performed');

      } else if (action === '[UpdateQueueNo]') {
        const vehicleId = param('VehicleId') || '';
        const queueNo   = parseInt(param('QueueNo') || '1') || 1;
        const driver = ZONE_DRIVERS.find(d => String(d.VehicleId) === vehicleId);
        if (driver) {
          driver.QueueNo = queueNo;
          console.log(`200: POST ${urlPath} [action=[UpdateQueueNo]] -> vehicle ${vehicleId} queue → ${queueNo}`);
        } else {
          console.log(`200: POST ${urlPath} [action=[UpdateQueueNo]] -> vehicle ${vehicleId} not found (no-op)`);
        }
        successD(res, 'Operation Successfully Performed');

      } else {
        console.log(`200: POST ${urlPath} [action=${action}] -> "Operation Successfully Performed"`);
        successD(res, 'Operation Successfully Performed');
      }
      return;
    }

    // ── /DataSelectorLess — read operations ───────────────────────────────
    if (urlPath.includes('/DataSelectorLess')) {
      if (action === 'RetrieveAlarms' || action === 'AllAlarms' || action === 'RetrieveAlarts' || action === 'RetrieveAlerts' || action === 'GetAlarms' || action === 'GetAlerts') {
        console.log(`200: POST ${urlPath} [action=${action}] -> []`);
        jsonReply(res, { d: '[]' });
      } else if (action === '[ZonesListUpdate]') {
        // Real driver zone data comes from Firebase (driverdatarealx).
        // This fallback is only hit when Firebase has no live drivers,
        // so return empty — no cars online means no zone queue entries.
        console.log(`200: POST ${urlPath} [action=${action}] -> 0 drivers (Firebase is source of truth)`);
        arrayD(res, []);

      } else if (action === '[payment_percentage]') {
        // Payment percentage and per-transaction charge — return zeros (no surcharges)
        console.log(`200: POST ${urlPath} [action=${action}] -> 0%`);
        arrayD(res, [{ paymentpercent: 0, chargepertra: 0 }]);

      } else if (action === 'DispatchEstimation') {
        // Return tariff pricing so trip cost can be calculated in the booking form.
        const TARIFFS = {
          1:  { StartPrice: 3.50, DistanceRate: 2.20, CurrencyName: 'NZD' },
          2:  { StartPrice: 5.00, DistanceRate: 2.50, CurrencyName: 'NZD' },
          3:  { StartPrice: 4.50, DistanceRate: 2.40, CurrencyName: 'NZD' },
          '-1': { StartPrice: 0,  DistanceRate: 0,    CurrencyName: 'NZD' },
        };
        const tid = String(param('TariffId') || '1');
        const tariff = TARIFFS[tid] || TARIFFS['1'];
        console.log(`200: POST ${urlPath} [action=${action}] -> tariff id ${tid}`);
        arrayD(res, [tariff]);

      } else if (action === '[ActiveJobsv3]') {
        const active = jobStore.filter(j => j.BookingStatus === 'Active' || j.BookingStatus === 'Picking');
        console.log(`200: POST ${urlPath} [action=${action}] -> ${active.length} active`);
        arrayD(res, active);

      // ── Search actions ───────────────────────────────────────────────────────
      // Helper: add UI-friendly aliases so Angular ng-repeat bindings work
      } else if (action === '[SearchById]') {
        const searchId = parseInt(param('Id') || param('id') || '0') || 0;
        const statusFilter = (param('JobStatus') || 'All').toLowerCase();
        const allJobs = [...jobStore, ...closedJobStore];
        let results = searchId > 0 ? allJobs.filter(j => j.Id === searchId) : allJobs;
        if (statusFilter !== 'all' && statusFilter !== '') {
          results = results.filter(j => (j.BookingStatus || '').toLowerCase() === statusFilter);
        }
        results = results.map(enrichSearchResult);
        console.log(`200: POST ${urlPath} [action=${action}] -> ${results.length} results`);
        arrayD(res, results);

      } else if (action === '[SearchJobByName]') {
        const searchName = (param('Id') || '').toLowerCase();
        const statusFilter = (param('JobStatus') || 'All').toLowerCase();
        const allJobs = [...jobStore, ...closedJobStore];
        let results = searchName ? allJobs.filter(j => (j.Name || '').toLowerCase().includes(searchName)) : allJobs;
        if (statusFilter !== 'all' && statusFilter !== '') {
          results = results.filter(j => (j.BookingStatus || '').toLowerCase() === statusFilter);
        }
        results = results.map(enrichSearchResult);
        console.log(`200: POST ${urlPath} [action=${action}] -> ${results.length} results`);
        arrayD(res, results);

      } else if (action === '[SearchByPhoneNo]') {
        const searchPhone = (param('Id') || '').replace(/\s/g, '');
        const statusFilter = (param('JobStatus') || 'All').toLowerCase();
        const allJobs = [...jobStore, ...closedJobStore];
        let results = searchPhone ? allJobs.filter(j => (j.PhoneNo || '').replace(/\s/g, '').includes(searchPhone)) : allJobs;
        if (statusFilter !== 'all' && statusFilter !== '') {
          results = results.filter(j => (j.BookingStatus || '').toLowerCase() === statusFilter);
        }
        results = results.map(enrichSearchResult);
        console.log(`200: POST ${urlPath} [action=${action}] -> ${results.length} results`);
        arrayD(res, results);

      } else if (action === '[SearchByAfterDate]') {
        const dateStr = param('Id') || '';
        const statusFilter = (param('JobStatus') || 'All').toLowerCase();
        const allJobs = [...jobStore, ...closedJobStore];
        let results = dateStr ? allJobs.filter(j => {
          const jDate = (j.BookingDateTime || '').substring(0, 10);
          return jDate >= dateStr;
        }) : allJobs;
        if (statusFilter !== 'all' && statusFilter !== '') {
          results = results.filter(j => (j.BookingStatus || '').toLowerCase() === statusFilter);
        }
        results = results.map(enrichSearchResult);
        console.log(`200: POST ${urlPath} [action=${action}] -> ${results.length} results`);
        arrayD(res, results);

      } else if (action === '[SearchByBeforeDate]') {
        const dateStr = param('Id') || '';
        const statusFilter = (param('JobStatus') || 'All').toLowerCase();
        const allJobs = [...jobStore, ...closedJobStore];
        let results = dateStr ? allJobs.filter(j => {
          const jDate = (j.BookingDateTime || '').substring(0, 10);
          return jDate <= dateStr;
        }) : allJobs;
        if (statusFilter !== 'all' && statusFilter !== '') {
          results = results.filter(j => (j.BookingStatus || '').toLowerCase() === statusFilter);
        }
        results = results.map(enrichSearchResult);
        console.log(`200: POST ${urlPath} [action=${action}] -> ${results.length} results`);
        arrayD(res, results);

      } else if (action === 'SearchJobDateBetween') {
        const fromStr = param('From') || '';
        const toStr   = param('To') || '';
        const statusFilter = (param('JobStatus') || 'All').toLowerCase();
        const allJobs = [...jobStore, ...closedJobStore];
        let results = allJobs.filter(j => {
          const jDate = (j.BookingDateTime || '').substring(0, 10);
          const afterFrom = !fromStr || jDate >= fromStr;
          const beforeTo  = !toStr   || jDate <= toStr;
          return afterFrom && beforeTo;
        });
        if (statusFilter !== 'all' && statusFilter !== '') {
          results = results.filter(j => (j.BookingStatus || '').toLowerCase() === statusFilter);
        }
        results = results.map(enrichSearchResult);
        console.log(`200: POST ${urlPath} [action=${action}] -> ${results.length} results`);
        arrayD(res, results);

      } else if (action === 'JobDetails') {
        const jobId = parseInt(param('Id') || '0') || 0;
        const allJobs = [...jobStore, ...closedJobStore];
        const job = allJobs.find(j => j.Id === jobId);
        const result = job ? [{ ...job, bookingidx: job.Id, Route: '', JobMins: calcJobMins(job.BookingDateTime) }] : [];
        console.log(`200: POST ${urlPath} [action=${action}] -> job #${jobId}`);
        arrayD(res, result);

      // ── Messaging read actions ───────────────────────────────────────────────
      } else if (action === '[RetrieveMessages]') {
        const chatList = buildDriverChatList();
        console.log(`200: POST ${urlPath} [action=${action}] -> ${chatList.length} drivers`);
        arrayD(res, chatList);

      } else if (action === '[DispatcherUnReadMessages]') {
        const driverId = (param('Id') || '').trim();
        const unread = messageStore.filter(m => String(m.SenderId) === driverId && !m.IsRead);
        unread.forEach(m => { m.IsRead = true; });
        const mapped = unread.map(m => ({
          Id: m.Id, SenderID: m.SenderId, User: m.SenderName,
          Message: m.Message, Date: m.Date, Time: m.Time,
        }));
        console.log(`200: POST ${urlPath} [action=${action}] -> ${mapped.length} unread from driver #${driverId}`);
        arrayD(res, mapped);

      // ── ACC / Accident Claim handlers ──────────────────────────────────────
      } else if (action === 'Manager_ACC_GET') {
        const demoManagers = [
          { id: 1, manager_name: 'ACC Head Office', manager_branch_code: 'ACC001', manager_email: 'head@acc.co.nz' },
          { id: 2, manager_name: 'Southland Branch', manager_branch_code: 'ACC002', manager_email: 'south@acc.co.nz' },
          { id: 3, manager_name: 'Otago Branch',    manager_branch_code: 'ACC003', manager_email: 'otago@acc.co.nz' },
        ];
        console.log(`200: POST ${urlPath} [action=${action}] -> ${demoManagers.length} ACC managers`);
        arrayD(res, demoManagers);

      } else if (action === 'Client_ACC_GET') {
        const managerId = parseInt(param('manager_id') || '0') || 0;
        const demoClients = [
          { id: 1, client_name: 'John Smith',   manager_id: 1, phone: '021 111 0001', address: '12 Main St, Invercargill' },
          { id: 2, client_name: 'Mary Johnson', manager_id: 1, phone: '021 111 0002', address: '45 Tay St, Invercargill'  },
          { id: 3, client_name: 'Paul Davis',   manager_id: 2, phone: '021 111 0003', address: '78 Dee St, Invercargill'  },
        ];
        const filtered = managerId ? demoClients.filter(c => c.manager_id === managerId) : demoClients;
        console.log(`200: POST ${urlPath} [action=${action}] -> ${filtered.length} ACC clients`);
        arrayD(res, filtered);

      } else if (action === 'Client_ACC_ALL') {
        const demoClients = [
          { id: 1, client_name: 'John Smith',   manager_id: 1, manager_name: 'ACC Head Office', phone: '021 111 0001', address: '12 Main St, Invercargill' },
          { id: 2, client_name: 'Mary Johnson', manager_id: 1, manager_name: 'ACC Head Office', phone: '021 111 0002', address: '45 Tay St, Invercargill'  },
          { id: 3, client_name: 'Paul Davis',   manager_id: 2, manager_name: 'Southland Branch', phone: '021 111 0003', address: '78 Dee St, Invercargill'  },
        ];
        console.log(`200: POST ${urlPath} [action=${action}] -> ${demoClients.length} all ACC clients`);
        arrayD(res, demoClients);

      } else if (action === 'Approve_ACC_GET') {
        const clientId = parseInt(param('client_id') || param('id') || '0') || 0;
        const demoApprovals = [
          { id: 1, acc_id: 'ACC-2026-001', client_id: 1, client_name: 'John Smith',  manager_name: 'ACC Head Office', manager_email: 'head@acc.co.nz', manager_phone: '03 214 0001', client_phone: '021 111 0001', registration_date: '2025-01-15', claim_number: 'CLM001', purchase_order_number: 'PO-001', client_services_code: 'SVC-01', trip_from_date: '2026-04-01', trip_to_date: '2026-06-30', trip_status: 'Round Trip', trip_days_approved: 30, trip_days_left: 22, trip_description: 'Post-surgery transport to physiotherapy' },
          { id: 2, acc_id: 'ACC-2026-002', client_id: 2, client_name: 'Mary Johnson', manager_name: 'ACC Head Office', manager_email: 'head@acc.co.nz', manager_phone: '03 214 0001', client_phone: '021 111 0002', registration_date: '2025-02-20', claim_number: 'CLM002', purchase_order_number: 'PO-002', client_services_code: 'SVC-02', trip_from_date: '2026-03-15', trip_to_date: '2026-05-15', trip_status: 'One Way', trip_days_approved: 20, trip_days_left: 5,  trip_description: 'Transport to outpatient appointments' },
        ];
        const filtered = (clientId && clientId > 0) ? demoApprovals.filter(a => a.id === clientId || a.client_id === clientId) : demoApprovals;
        console.log(`200: POST ${urlPath} [action=${action}] -> ${filtered.length} approvals`);
        arrayD(res, filtered);

      } else if (action === 'ACC_All_approval') {
        const demoApprovals = [
          { id: 1, acc_id: 'ACC-2026-001', client_name: 'John Smith',  manager_name: 'ACC Head Office', claim_number: 'CLM001', trip_from_date: '2026-04-01', trip_to_date: '2026-06-30', trip_days_approved: 30, trip_days_left: 22, trip_description: 'Post-surgery transport to physiotherapy' },
          { id: 2, acc_id: 'ACC-2026-002', client_name: 'Mary Johnson', manager_name: 'ACC Head Office', claim_number: 'CLM002', trip_from_date: '2026-03-15', trip_to_date: '2026-05-15', trip_days_approved: 20, trip_days_left: 5,  trip_description: 'Transport to outpatient appointments' },
        ];
        console.log(`200: POST ${urlPath} [action=${action}] -> ${demoApprovals.length} all approvals`);
        arrayD(res, demoApprovals);

      } else {
        const filePath = resolveFilePath(urlPath);
        if (filePath) {
          console.log(`200: POST ${urlPath} -> ${filePath.replace(ROOT, '')}`);
          res.writeHead(200, JSON_HEADERS);
          fs.createReadStream(filePath).pipe(res);
        } else {
          console.log(`200: POST ${urlPath} [action=${action}] -> []`);
          jsonReply(res, { d: '[]' });
        }
      }
      return;
    }

    // ── /DataSelector — read operations with action routing ───────────────
    if (urlPath.includes('/DataSelector') && !urlPath.includes('/DataSelectorLess') && !urlPath.includes('/DataSelectorRide')) {
      if (action === 'RetrieveAlarms' || action === 'AllAlarms' || action === 'RetrieveAlarts' || action === 'RetrieveAlerts' || action === 'GetAlarms' || action === 'GetAlerts') {
        console.log(`200: POST ${urlPath} [action=${action}] -> []`);
        jsonReply(res, { d: '[]' });

      } else if (action === '[Editjobv4]') {
        const idParam = param('Id');
        const jobId = idParam !== undefined ? parseInt(idParam) : 0;
        let job = jobStore.find(j => j.Id === jobId);
        if (!job) job = jobStore[0];
        const jobWithMins = job ? { ...job, JobMins: calcJobMins(job.BookingDateTime) } : null;
        const resp = {
          dt1: jobWithMins ? [jobWithMins] : [],
          dt2: [{ AssignedCount: 0 }],
          dt3: [{ ActiveCount: 0 }],
          dt4: [{ UnAssignedCount: jobStore.length }],
          dt5: [{ PublicKey: '' }],
        };
        console.log(`200: POST ${urlPath} [action=${action}] -> job #${jobId}`);
        objectD(res, resp);

      } else if (action === '[checkjobstatusv2]') {
        // Return empty dt1 so dispatch goes straight through without "taking job from driver" error
        console.log(`200: POST ${urlPath} [action=${action}] -> empty dt1`);
        objectD(res, { dt1: [], dt2: [], dt3: [], dt4: [], dt5: [] });

      } else if (action === '[AssignedJobsv2]') {
        console.log(`200: POST ${urlPath} [action=${action}] -> assigned jobs`);
        objectD(res, buildAssignedResponse(jobStore));

      } else if (action === 'AutoDispatchVehiclesallride') {
        // Return empty for auto-dispatch — no Firebase drivers available
        console.log(`200: POST ${urlPath} [action=${action}] -> empty`);
        objectD(res, { dt1: [], dt2: [], dt3: [], dt4: [], dt5: [] });

      } else if (action === 'ZoneCoordinates') {
        // Return an NZ-wide bounding polygon so any NZ address passes zone validation.
        // The front-end checks if the pickup lat/lng is inside at least one zone polygon.
        const zoneData = {
          dt1: [{ ZoneId: 1, ZoneName: 'New Zealand', No: 4 }],
          dt2: [
            { Lat: -34.0, Lng: 166.3 },
            { Lat: -47.4, Lng: 166.3 },
            { Lat: -47.4, Lng: 178.6 },
            { Lat: -34.0, Lng: 178.6 },
          ],
        };
        console.log(`200: POST ${urlPath} [action=${action}] -> NZ zone polygon`);
        objectD(res, zoneData);

      } else if (action === '[DispatcherSettings]') {
        // Return company settings, vehicle types (dt3), tariff list (dt4).
        const settings = {
          dt1: [{
            CompanyName: 'Taxi Time',
            DirectBookingIsAllowed: '1',
            JobAllowedToAssignToaDriver: '1',
            AutoDispatch: '0',
            EditZoneQueue: '1',
            DispatcherKickUsers: '1',
            DispatchShows: '1',
            ColorJobs: '1',
            DispatchAlerts: '0',
            DispatchSounds: '1',
            RespectShiftEnd: '0',
            Radius: '50',
          }],
          dt2: [],
          dt3: [
            { Id: 1, VehicleName: 'Sedan' },
            { Id: 2, VehicleName: 'SUV' },
            { Id: 3, VehicleName: 'Van' },
            { Id: 4, VehicleName: 'Wheelchair' },
          ],
          dt4: [
            { Id: 1, TariffName: 'Standard',  StartPrice: 3.50, DistanceRate: 2.20, CurrencyName: 'NZD' },
            { Id: 2, TariffName: 'Airport',   StartPrice: 5.00, DistanceRate: 2.50, CurrencyName: 'NZD' },
            { Id: 3, TariffName: 'Evening',   StartPrice: 4.50, DistanceRate: 2.40, CurrencyName: 'NZD' },
            { Id: -1, TariffName: 'Custom',   StartPrice: 0,    DistanceRate: 0,    CurrencyName: 'NZD' },
          ],
          dt5: [{ PublicKey: '' }],
        };
        console.log(`200: POST ${urlPath} [action=${action}] -> dispatcher settings`);
        objectD(res, settings);

      } else if (action === 'VehiclesStatus') {
        const busyCount  = ZONE_DRIVERS.filter(d => d.vehiclestatus === 'Busy').length;
        const freeCount  = ZONE_DRIVERS.filter(d => d.vehiclestatus === 'Available').length;
        const awayCount  = ZONE_DRIVERS.filter(d => d.vehiclestatus === 'Away').length;
        const vehicleStatus = {
          dt1: [{ All: ZONE_DRIVERS.length }],
          dt2: [{ Busy: busyCount }],
          dt3: [{ Free: freeCount }],
          dt4: [{ Picking: ZONE_DRIVERS.filter(d => d.vehiclestatus === 'Picking').length }],
          dt5: [{ Away: awayCount }],
        };
        console.log(`200: POST ${urlPath} [action=${action}] -> ${ZONE_DRIVERS.length} vehicles`);
        objectD(res, vehicleStatus);

      } else if (action === 'JobsCount') {
        const _TERM = new Set(['Dispatched', 'Done', 'Cancel', 'Cancelled', 'Closed', 'Completed', 'No Show', 'NoShow', 'Reject']);
        const closedCount  = [...jobStore, ...closedJobStore].filter(j => _TERM.has(j.BookingStatus)).length;
        const cancelCount  = [...jobStore, ...closedJobStore].filter(j => j.BookingStatus === 'Cancelled' || j.BookingStatus === 'Cancel').length;
        const noShowCount  = [...jobStore, ...closedJobStore].filter(j => j.BookingStatus === 'No Show' || j.BookingStatus === 'NoShow').length;
        const jobCounts = {
          dt1: [{ ClosedCount: closedCount }],
          dt2: [{ CancelledCount: cancelCount }],
          dt3: [{ NoShownCount: noShowCount }],
          dt4: [{ AllCount: jobStore.length }],
        };
        console.log(`200: POST ${urlPath} [action=${action}] -> job counts`);
        objectD(res, jobCounts);

      } else if (action === 'ClosedJobs') {
        const statusFilter = (param('BookingStatus') || '').toLowerCase();
        const fromDate = param('FromDate') || param('FromDate ') || '';
        const toDate   = param('ToDate') || '';
        const driverFilter  = parseInt(param('DriverId') || '0') || 0;
        const vehicleFilter = parseInt(param('VehicleId') || param('VehicleId ') || '0') || 0;
        // Terminal statuses — include these from the live jobStore as well as the static store
        const TERMINAL = new Set(['Dispatched', 'Done', 'Cancel', 'Cancelled', 'Closed', 'Completed', 'No Show', 'NoShow', 'Reject']);
        const liveTerminal = jobStore.filter(j => TERMINAL.has(j.BookingStatus));
        let jobs = [...closedJobStore, ...liveTerminal];
        if (statusFilter && statusFilter !== 'all') {
          jobs = jobs.filter(j => (j.BookingStatus || '').toLowerCase() === statusFilter);
        }
        if (fromDate) {
          jobs = jobs.filter(j => (j.BookingDateTime || '').substring(0, 10) >= fromDate);
        }
        if (toDate) {
          jobs = jobs.filter(j => (j.BookingDateTime || '').substring(0, 10) <= toDate);
        }
        if (driverFilter > 0) {
          jobs = jobs.filter(j => j.DriverId === driverFilter);
        }
        if (vehicleFilter > 0) {
          jobs = jobs.filter(j => j.VehicleId === vehicleFilter);
        }
        // Build driver/vehicle lists from the actual job results for the filter dropdowns
        const seenDrivers = new Map(), seenVehicles = new Map();
        jobs.forEach(j => {
          if (j.DriverId && !seenDrivers.has(j.DriverId)) {
            seenDrivers.set(j.DriverId, { Id: j.DriverId, DriveName: (j.UserFName || '') + ' ' + (j.UserLName || '') });
          }
          if (j.VehicleId && !seenVehicles.has(j.VehicleId)) {
            seenVehicles.set(j.VehicleId, { Id: j.VehicleId, VehicleNo: j.VehicleNo || String(j.VehicleId) });
          }
        });
        const dt2 = [...seenDrivers.values()];
        const dt3 = [...seenVehicles.values()];
        console.log(`200: POST ${urlPath} [action=${action}] -> ${jobs.length} closed jobs (${liveTerminal.length} live)`);
        objectD(res, { dt1: jobs, dt2, dt3 });

      } else if (action === '[VehicleInfov2]') {
        const vehicleId = parseInt(param('Id') || param('id') || '0') || 0;
        // Look up driver in ZONE_DRIVERS (demo) or from jobStore assigned driver
        const zd = ZONE_DRIVERS.find(d => d.VehicleId === vehicleId || d.driverid === vehicleId);
        const assignedJob = jobStore.find(j => j.VehicleId === vehicleId || j.DriverId === vehicleId);
        const dt1 = zd ? [{
          DriverId: zd.driverid,
          Lat:  '-46.4227',
          Lng:  '168.3767',
          PlayerId: '',
          VehicleName: zd.vehicletype,
          CallSign: zd.vehiclenumber,
          VehicleNo: zd.vehiclenumber,
          BookingId: assignedJob ? assignedJob.Id : '',
          UserFName: zd.drivername.split(' ')[0] || '',
          UserLName: zd.drivername.split(' ').slice(1).join(' ') || '',
          VehicleImage: '',
        }] : [];
        const dt2 = assignedJob ? [{
          BookingStatus:      assignedJob.BookingStatus,
          BookingDateTime:    assignedJob.BookingDateTime,
          PassengerId:        assignedJob.Name || assignedJob.passengername || '',
          PickAddress:        assignedJob.PickAddress || '',
          DropAddress:        assignedJob.DropAddress || '',
          Passengers:         assignedJob.Passengers || 1,
          Bags:               assignedJob.Bags || 0,
          WheelChairs:        assignedJob.WheelChairs || 0,
          EstimatedDistance:  assignedJob.EstimatedDistance || '0',
          EstimatedTime:      assignedJob.EstimatedTime || '0',
        }] : [];
        console.log(`200: POST ${urlPath} [action=${action}] -> vehicle #${vehicleId} (${dt1.length ? zd.drivername : 'not found'}), ${dt2.length} job(s)`);
        objectD(res, { dt1, dt2, dt3: [], dt4: [], dt5: [] });

      } else if (action === 'AutoDispatchVehiclesv2') {
        // Return available drivers in the requested zone
        const zoneId = parseInt(param('ZoneId') || '0') || 0;
        const avail = ZONE_DRIVERS.filter(d => d.vehiclestatus === 'Available' && (!zoneId || d.zoneid === zoneId));
        const dt2 = avail.map(d => ({
          VehicleId: d.VehicleId, driverid: d.driverid, drivername: d.drivername,
          vehiclenumber: d.vehiclenumber, vehicletype: d.vehicletype,
          zoneid: d.zoneid, zonename: d.zonename, zonequeue: d.zonequeue,
          PlayerId: '',
        }));
        console.log(`200: POST ${urlPath} [action=${action}] -> ${dt2.length} available drivers`);
        objectD(res, { dt1: [], dt2, dt3: [], dt4: [], dt5: [] });

      } else if (action === 'checkriddestatusforautodispatch' || action === 'checkriddestatusforoffer') {
        // Return offered/pending jobs so convertstatus() can update their state
        const bookingId = parseInt(param('bookingid') || '0') || 0;
        const job = bookingId > 0 ? jobStore.find(j => j.Id === bookingId) : null;
        const eligible = job && (job.BookingStatus === 'Offered' || job.BookingStatus === 'Pending') ? [job] : [];
        console.log(`200: POST ${urlPath} [action=${action}] -> ${eligible.length} eligible (status=${job ? job.BookingStatus : 'none'})`);
        objectD(res, { dt1: eligible, dt2: [], dt3: [], dt4: [], dt5: [] });

      } else if (action === '[changeriddestatusforoffer]') {
        // Update a job's booking status (e.g. mark as Unreached after failed dispatch)
        const bookingId = parseInt(param('bookingid') || '0') || 0;
        const newStatus = param('ridestatus') || '';
        const job = jobStore.find(j => j.Id === bookingId);
        if (job && newStatus) {
          job.BookingStatus = newStatus;
          // Only release (reset) the driver when the job is being cancelled/unassigned.
          // 'Assigned' means the driver accepted — keep them Busy until they complete the ride.
          const releaseStatuses = new Set(['Unreached', 'Pending', 'Cancelled', 'Unassigned', 'NoShow', 'No Show']);
          if (releaseStatuses.has(newStatus)) {
            const zd = ZONE_DRIVERS.find(d => d.driverid === job.DriverId || d.VehicleId === job.DriverId);
            if (zd) { zd.vehiclestatus = 'Available'; zd.JobphoneNo = ''; zd.jobpickup = ''; zd.jobdropoff = ''; zd.jobCount = 0; }
          }
        }
        console.log(`200: POST ${urlPath} [action=${action}] -> job #${bookingId} status=${newStatus || 'unchanged'}`);
        objectD(res, { dt1: [], dt2: [], dt3: [], dt4: [], dt5: [] });

      } else if (action === '[DriverStatusChanged]') {
        // Auto-transition job status when a driver's Firebase vehiclestatus changes.
        // Any non-terminal → Busy   : job → Active   (driver picked up passenger / started meter)
        // Active            → Available: job → Completed (ride finished)
        const driverId  = (param('driverid') || '').trim();
        const newStatus = (param('newstatus') || '').trim();
        const TERMINAL = new Set(['Dispatched','Done','Cancel','Cancelled','Closed','Completed','No Show','NoShow','Reject','Active']);
        if (driverId && newStatus) {
          const driverJobs = jobStore.filter(j =>
            String(j.DriverId) === String(driverId) || String(j.VehicleId) === String(driverId)
          );
          driverJobs.forEach(function(job) {
            const prev = job.BookingStatus;
            if (newStatus === 'Busy' && !TERMINAL.has(job.BookingStatus)) {
              // Driver went red (Busy) = passenger picked up / meter started.
              // Promote ANY non-terminal, non-active job to Active regardless of
              // whether the dispatch went through 'Offered' or 'Assigned' first.
              job.BookingStatus = 'Active';
              console.log(`  [DriverStatusChanged] Job #${job.Id} (was ${prev}) -> Active (driver ${driverId} went Busy)`);
            } else if (newStatus === 'Picking' && (job.BookingStatus === 'Offered' || job.BookingStatus === 'Pending')) {
              // Driver went blue (Picking / Roger) = accepted the job and is en route.
              job.BookingStatus = 'Assigned';
              console.log(`  [DriverStatusChanged] Job #${job.Id} (was ${prev}) -> Assigned (driver ${driverId} went Picking)`);
            } else if (newStatus === 'Available' && job.BookingStatus === 'Active') {
              job.BookingStatus = 'Completed';
              console.log(`  [DriverStatusChanged] Job #${job.Id} -> Completed (driver ${driverId} went Available)`);
            }
          });
        }
        console.log(`200: POST ${urlPath} [action=${action}] -> driverId=${driverId} newStatus=${newStatus}`);
        objectD(res, { dt1: [], dt2: [], dt3: [], dt4: [], dt5: [] });

      } else if (action === '[UnAssignedJobsv3]') {
        const resp = buildJobListResponse(jobStore);
        console.log(`200: POST ${urlPath} [action=${action}] -> ${jobStore.length} jobs (${resp.dt4[0].UnAssignedCount} unassigned)`);
        objectD(res, resp);

      } else if (action === '[deviUnAssignedJobsv2]') {
        const resp = buildDeliveryResponse(jobStore);
        console.log(`200: POST ${urlPath} [action=${action}] -> ${resp.dt1.length} delivery jobs`);
        objectD(res, resp);

      } else if (action === '[DispatcherConversation]') {
        const driverId = (param('Id') || '').trim();
        const dt1 = [{ PlayerId: '' }];
        const convo = messageStore.filter(m => String(m.SenderId) === driverId || String(m.ReceiverId) === driverId);
        convo.forEach(m => { if (String(m.SenderId) === driverId) m.IsRead = true; });
        const dt2 = convo.map(m => ({
          Id: m.Id, SenderID: m.SenderId, User: m.SenderName,
          Message: m.Message, Date: m.Date, Time: m.Time,
        }));
        console.log(`200: POST ${urlPath} [action=${action}] -> ${dt2.length} messages for driver #${driverId}`);
        objectD(res, { dt1, dt2 });

      } else {
        // Default: return live job list from in-memory store
        const allJobs = buildJobListResponse(jobStore);
        console.log(`200: POST ${urlPath} [action=${action || 'default'}] -> ${jobStore.length} jobs`);
        objectD(res, allJobs);
      }
      return;
    }

    // ── LoginSelector — dispatcher authentication ──────────────────────────
    if (urlPath.includes('/LoginSelector')) {
      const username = param('Username') || param('Email') || param('UserEmail') || '';
      const password = param('Password') || param('Pass') || '';
      if (!username.trim()) {
        console.log(`200: POST ${urlPath} [LoginSelector] -> missing credentials`);
        successD(res, 'Please enter your username and password.');
        return;
      }

      // ── Try to authenticate against the real taxitime.co.nz backend ──────
      // If successful, the ASP.NET session cookie is forwarded to the browser
      // so that all subsequent proxy calls carry a valid session and return
      // real production data (jobs, messages, drivers, etc.).
      if (password && password !== 'mock') {
        try {
          const proxied = await proxyToRealBackend(
            urlPath, req.method, body, req.headers['cookie'] || ''
          );
          const bodyText = (proxied.body || '').trim();
          const isSessionError = bodyText.includes('Session is experied') || bodyText.includes('Session is expired');
          if (proxied.statusCode === 200 && !isSessionError && (bodyText.startsWith('{') || bodyText.startsWith('['))) {
            // Real backend accepted the credentials — forward its session cookies
            const replyHeaders = {
              'Content-Type': proxied.headers['content-type'] || 'application/json',
              'Cache-Control': 'no-cache',
              'Access-Control-Allow-Origin': '*',
            };
            if (proxied.headers['set-cookie']) {
              const rawCookies = proxied.headers['set-cookie'];
              const cookies = Array.isArray(rawCookies) ? rawCookies : [rawCookies];
              replyHeaders['Set-Cookie'] = cookies.map(c =>
                c.replace(/;\s*domain=[^;,]*/gi, '').replace(/;\s*samesite=[^;,]*/gi, '')
              );
            }
            console.log(`200: LoginSelector → REAL backend auth OK for "${username}"`);
            res.writeHead(200, replyHeaders);
            res.end(proxied.body);
            return;
          }
          console.log(`LoginSelector: real backend rejected credentials for "${username}" (status=${proxied.statusCode}) — using mock session`);
        } catch (e) {
          console.log(`LoginSelector: real backend unreachable (${e.message}) — using mock session`);
        }
      }

      // ── Fallback: mock session (Firebase-only users or real backend down) ─
      console.log(`200: POST ${urlPath} [LoginSelector] -> mock session for "${username}"`);
      arrayD(res, [{
        Id: 1051,
        UserFName: username.split('@')[0] || 'Dispatcher',
        UserLName: '',
        UserEmail: username,
        CompanyId: 1216,
        Country: 'NZ',
        Role: 'Dispatcher',
        UserStatus: 'Active',
      }]);
      return;
    }

    // ── Logout ──────────────────────────────────────────────────────────────
    if (urlPath.includes('/DispatcherLogin.aspx/Logout')) {
      console.log(`200: POST ${urlPath} -> logout OK`);
      jsonReply(res, { d: 'DispatcherLogin.aspx' });
      return;
    }

    // ── Account / access request (Stripe-ready) ─────────────────────────────
    if (urlPath.includes('/DispatcherLogin.aspx/AccountRequest')) {
      let reqBody = {};
      try { reqBody = JSON.parse(body); } catch (e) {}
      const reqName    = reqBody.name    || param('name')    || '';
      const reqEmail   = reqBody.email   || param('email')   || '';
      const reqPhone   = reqBody.phone   || param('phone')   || '';
      const reqCompany = reqBody.company || param('company') || '';
      const reqRole    = reqBody.role    || param('role')    || 'Dispatcher';
      console.log(`200: POST ${urlPath} -> access request from "${reqEmail}" (${reqName})`);
      jsonReply(res, { d: 'Request received. Our team will contact you within 1 business day.', stripe_ready: true });
      return;
    }

    // ── GeneralSelector — vehicle types, zones, etc. ───────────────────────
    if (urlPath.includes('/GeneralSelector')) {
      if (action === 'VehicleTypes' || action === '[VehicleTypes]') {
        const types = [
          { Id: 1, VehicleName: 'Sedan' }, { Id: 2, VehicleName: 'SUV' },
          { Id: 3, VehicleName: 'Van'   }, { Id: 4, VehicleName: 'Wheelchair' },
        ];
        console.log(`200: POST ${urlPath} [action=${action}] -> ${types.length} vehicle types`);
        arrayD(res, types);
      } else {
        console.log(`200: POST ${urlPath} [action=${action}] (GeneralSelector) -> []`);
        jsonReply(res, { d: '[]' });
      }
      return;
    }

    // ── Other DataManager requests ──────────────────────────────────────────
    const filePath = resolveFilePath(urlPath);
    if (filePath) {
      console.log(`200: POST ${urlPath} -> ${filePath.replace(ROOT, '')}`);
      res.writeHead(200, JSON_HEADERS);
      fs.createReadStream(filePath).pipe(res);
      return;
    }
    console.log(`200: POST ${urlPath} [action=${action}] -> silent []`);
    jsonReply(res, { d: '[]' });
    return;
  }

  // ── Static file serving ─────────────────────────────────────────────────────
  const filePath = resolveFilePath(urlPath);
  if (!filePath) {
    console.log(`404: ${req.method} ${urlPath}`);
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end(`404 Not Found: ${urlPath}`);
    return;
  }

  console.log(`200: ${req.method} ${urlPath} -> ${filePath.replace(ROOT, '')}`);
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    'Content-Type': mimeTypes[ext] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*',
  });
  fs.createReadStream(filePath).pipe(res);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is in use. Killing existing process and retrying...`);
    const { execSync } = require('child_process');
    try { execSync(`fuser -k ${PORT}/tcp`); } catch (e) {}
    setTimeout(() => {
      server.close();
      server.listen(PORT, HOST, () => console.log(`Serving ${ROOT} at http://${HOST}:${PORT}`));
    }, 1000);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Serving ${ROOT} at http://${HOST}:${PORT}`);
});
