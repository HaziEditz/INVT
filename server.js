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
const messageStore = [
  { Id: 1, SenderId: 101, ReceiverId: 0, SenderName: 'Michael Johnson', Message: 'Dispatcher, I\'m heading to Tay St pickup now.', Date: '2026-04-15', Time: '08:22 am', IsRead: true },
  { Id: 2, SenderId: 0,   ReceiverId: 101, SenderName: 'Dispatcher',    Message: 'Thanks Michael, job #937190 is yours — confirm when on scene.', Date: '2026-04-15', Time: '08:23 am', IsRead: true },
  { Id: 3, SenderId: 102, ReceiverId: 0, SenderName: 'Sarah Wilson',    Message: 'Available in Central. Waiting for next job.', Date: '2026-04-15', Time: '09:01 am', IsRead: false },
  { Id: 4, SenderId: 103, ReceiverId: 0, SenderName: 'David Thompson',  Message: 'Running 5 mins late on the airport run.', Date: '2026-04-15', Time: '09:15 am', IsRead: false },
];

function buildDriverChatList() {
  return ZONE_DRIVERS.map(d => {
    const unread = messageStore.filter(m => m.SenderId === d.driverid && !m.IsRead).length;
    return { Id: d.driverid, UserFName: d.drivername.split(' ')[0], UserLName: d.drivername.split(' ').slice(1).join(' '), Count: unread, PlayerId: '' };
  });
}

// ─── Closed job store (historical demo data) ──────────────────────────────────
const closedJobStore = [
  { Id: 937100, BookingDateTime: '2026-04-14 09:00:00.', JobCompleteTime: '2026-04-14 09:28:00.', PickAddress: '12 Dee St, Invercargill', DropAddress: 'Invercargill Hospital, Kew Rd', Name: 'Alice Brown', PhoneNo: '021 400 1001', VehicleNo: '201', UserFName: 'Michael', UserLName: 'Johnson', BookingSource: 'App', BookingStatus: 'Dispatched', DriverId: 101, VehicleId: 201 },
  { Id: 937101, BookingDateTime: '2026-04-14 11:15:00.', JobCompleteTime: '2026-04-14 11:47:00.', PickAddress: '88 Tay St, Invercargill', DropAddress: 'Invercargill Airport', Name: 'Brian Clark', PhoneNo: '021 400 1002', VehicleNo: '202', UserFName: 'Sarah', UserLName: 'Wilson', BookingSource: 'Dispatch Console', BookingStatus: 'Dispatched', DriverId: 102, VehicleId: 202 },
  { Id: 937102, BookingDateTime: '2026-04-14 13:30:00.', JobCompleteTime: '', PickAddress: '5 Don St, Invercargill', DropAddress: 'Waikiwi Mall', Name: 'Carol Evans', PhoneNo: '021 400 1003', VehicleNo: '203', UserFName: 'David', UserLName: 'Thompson', BookingSource: 'Phone', BookingStatus: 'Cancel', DriverId: 103, VehicleId: 203 },
  { Id: 937103, BookingDateTime: '2026-04-13 07:45:00.', JobCompleteTime: '2026-04-13 08:05:00.', PickAddress: '200 Elles Rd, Invercargill', DropAddress: '14 Yarrow St, Invercargill', Name: 'Daniel Ford', PhoneNo: '021 400 1004', VehicleNo: '204', UserFName: 'Emma', UserLName: 'Davies', BookingSource: 'App', BookingStatus: 'Dispatched', DriverId: 104, VehicleId: 204 },
  { Id: 937104, BookingDateTime: '2026-04-13 16:00:00.', JobCompleteTime: '', PickAddress: '3 Leven St, Invercargill', DropAddress: 'Queens Park, Invercargill', Name: 'Eve Green', PhoneNo: '021 400 1005', VehicleNo: '205', UserFName: 'James', UserLName: 'Brown', BookingSource: 'Dispatch Console', BookingStatus: 'No Show', DriverId: 105, VehicleId: 205 },
  { Id: 937105, BookingDateTime: '2026-04-12 10:00:00.', JobCompleteTime: '2026-04-12 10:22:00.', PickAddress: 'Invercargill Airport', DropAddress: '56 Gala St, Invercargill', Name: 'Frank Harris', PhoneNo: '021 400 1006', VehicleNo: '201', UserFName: 'Michael', UserLName: 'Johnson', BookingSource: 'App', BookingStatus: 'Dispatched', DriverId: 101, VehicleId: 201 },
];

function calcJobMins(bookingDateTimeStr) {
  const bdt = new Date(bookingDateTimeStr.replace(/\.$/, '').trim());
  const now = new Date();
  return Math.round((bdt - now) / 60000);
}

// Format a Date object as the "YYYY-MM-DD HH:MM:SS." string the client expects
function fmtDT(dt) {
  const pad = n => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:00.`;
}

// Live job store — starts empty; jobs are created through the dispatch UI
const jobStore = [];

// Demo drivers for zone queue display
const ZONE_DRIVERS = [
  { driverid: 101, drivername: 'Michael Johnson', vehiclenumber: '201', vehicletype: 'Sedan', vehiclestatus: 'Available', zonename: 'Central Invercargill', zoneid: 1, zonequeue: 1, VehicleId: 201, time: '', jobCount: 0, JobphoneNo: '', jobpickup: '', jobdropoff: '' },
  { driverid: 102, drivername: 'Sarah Wilson',    vehiclenumber: '202', vehicletype: 'Sedan', vehiclestatus: 'Available', zonename: 'Central Invercargill', zoneid: 1, zonequeue: 2, VehicleId: 202, time: '', jobCount: 0, JobphoneNo: '', jobpickup: '', jobdropoff: '' },
  { driverid: 103, drivername: 'David Thompson',  vehiclenumber: '203', vehicletype: 'SUV',   vehiclestatus: 'Available', zonename: 'Appleby',              zoneid: 2, zonequeue: 1, VehicleId: 203, time: '', jobCount: 0, JobphoneNo: '', jobpickup: '', jobdropoff: '' },
  { driverid: 104, drivername: 'Emma Davies',     vehiclenumber: '204', vehicletype: 'Sedan', vehiclestatus: 'Available', zonename: 'Appleby',              zoneid: 2, zonequeue: 2, VehicleId: 204, time: '', jobCount: 0, JobphoneNo: '', jobpickup: '', jobdropoff: '' },
  { driverid: 105, drivername: 'James Brown',     vehiclenumber: '205', vehicletype: 'Van',   vehiclestatus: 'Busy',      zonename: 'Waikiwi',              zoneid: 3, zonequeue: 1, VehicleId: 205, time: '', jobCount: 1, JobphoneNo: '021 555 1234', jobpickup: 'Elles Rd', jobdropoff: 'Don St' },
];

// Build full job-list DataSelector response
function buildJobListResponse(jobs) {
  const dt1 = jobs.map(j => ({ ...j, JobMins: calcJobMins(j.BookingDateTime) }));
  const pending = dt1.filter(j => j.BookingStatus !== 'Offered' && j.BookingStatus !== 'Assigned');
  return {
    dt1,
    dt2: [{ AssignedCount: jobs.filter(j => j.BookingStatus === 'Assigned').length }],
    dt3: [{ ActiveCount: jobs.filter(j => j.BookingStatus === 'Active' || j.BookingStatus === 'Picking').length }],
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

function proxyToRealBackend(urlPath, method, body, incomingCookies) {
  return new Promise((resolve, reject) => {
    const targetPath = REAL_BACKEND_PREFIX + urlPath;
    const bodyBuf    = Buffer.from(body || '');

    const options = {
      hostname: REAL_BACKEND_HOST,
      port: 443,
      path: targetPath,
      method: method,
      headers: {
        'Content-Type':   'application/json; charset=utf-8',
        'Content-Length': bodyBuf.length,
        'Cookie':         incomingCookies || '',
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
      '[AssignJobStatusFromJobListv2]', '[DispatcherConversation]',
      '[changeriddestatusforoffer]',
      '[MessageInsert]', '[DriverMessageInsert]', '[BroadcastMessage]',
      '[GroupMessage]', '[DeleteMessage]', '[RetrieveMessages]',
      '[DispatcherUnReadMessages]',
    ]);

    if (!LOCAL_ONLY_ACTIONS.has(action)) {
      try {
        const proxied = await proxyToRealBackend(
          urlPath, req.method, body, req.headers['cookie'] || ''
        );
        const bodyText = (proxied.body || '').trim();
        // Only use proxy response if it is valid JSON AND is not a session-expired
        // redirect (which would cause an infinite logout loop for demo users).
        const isSessionExpired = bodyText.includes('Session is experied') || bodyText.includes('Session is expired');
        if (proxied.statusCode === 200 && !isSessionExpired && (bodyText.startsWith('{') || bodyText.startsWith('['))) {
          const replyHeaders = {
            'Content-Type': proxied.headers['content-type'] || 'application/json',
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Origin': '*',
          };
          // Forward session cookies — strip the domain attribute so they are
          // scoped to our proxy host (replit.dev) rather than taxitime.co.nz,
          // which allows subsequent requests to carry the ASP.NET session.
          if (proxied.headers['set-cookie']) {
            const rawCookies = proxied.headers['set-cookie'];
            const cookies = Array.isArray(rawCookies) ? rawCookies : [rawCookies];
            replyHeaders['Set-Cookie'] = cookies.map(c =>
              c.replace(/;\s*domain=[^;,]*/gi, '').replace(/;\s*samesite=[^;,]*/gi, '')
            );
          }
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

        const bookstatus = driverId > 0 ? 'Offered' : 'Pending';
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
            job.BookingStatus = 'Offered';
            job.DriverId = driverId;
            if (driverId > 0) job.VehicleId = driverId;
            // Update demo driver status to Busy so driver card turns red
            const zd = ZONE_DRIVERS.find(d => d.driverid === driverId || d.VehicleId === driverId);
            if (zd) {
              zd.vehiclestatus = 'Busy';
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

      } else if (action === '[MessageInsert]') {
        const receiverId = parseInt(param('RecieverId') || param('ReceiverId') || '0') || 0;
        const message    = param('Message') || '';
        const dateTime   = param('DateTime') || '';
        const datePart   = dateTime.substring(0, 10) || new Date().toISOString().substring(0, 10);
        const timePart   = dateTime.substring(11) || '';
        if (message.trim()) {
          const msg = { Id: nextMsgId++, SenderId: 0, ReceiverId: receiverId, SenderName: 'Dispatcher', Message: message, Date: datePart, Time: timePart, IsRead: true };
          messageStore.push(msg);
          console.log(`200: POST ${urlPath} [action=${action}] -> message saved to driver #${receiverId}`);
        }
        successD(res, 'Message sent successfully');

      } else if (action === '[DriverMessageInsert]') {
        // Incoming message FROM a driver → dispatcher (sent via Firebase, stored here for history)
        const senderId  = parseInt(param('SenderId') || '0') || 0;
        const message   = param('Message') || '';
        const dateTime  = param('DateTime') || '';
        const datePart  = dateTime.substring(0, 10) || new Date().toISOString().substring(0, 10);
        const timePart  = dateTime.substring(11) || '';
        const driver    = ZONE_DRIVERS.find(d => d.driverid === senderId) || { drivername: 'Driver ' + senderId };
        if (message.trim()) {
          const msg = { Id: nextMsgId++, SenderId: senderId, ReceiverId: 0, SenderName: driver.drivername, Message: message, Date: datePart, Time: timePart, IsRead: false };
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
      } else if (action === '[SearchById]') {
        const searchId = parseInt(param('Id') || param('id') || '0') || 0;
        const statusFilter = (param('JobStatus') || 'All').toLowerCase();
        const allJobs = [...jobStore, ...closedJobStore];
        let results = searchId > 0 ? allJobs.filter(j => j.Id === searchId) : allJobs;
        if (statusFilter !== 'all' && statusFilter !== '') {
          results = results.filter(j => (j.BookingStatus || '').toLowerCase() === statusFilter);
        }
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
        console.log(`200: POST ${urlPath} [action=${action}] -> ${results.length} results`);
        arrayD(res, results);

      } else if (action === 'JobDetails') {
        const jobId = parseInt(param('Id') || '0') || 0;
        const allJobs = [...jobStore, ...closedJobStore];
        const job = allJobs.find(j => j.Id === jobId);
        const result = job ? [{ ...job, Route: '', JobMins: calcJobMins(job.BookingDateTime) }] : [];
        console.log(`200: POST ${urlPath} [action=${action}] -> job #${jobId}`);
        arrayD(res, result);

      // ── Messaging read actions ───────────────────────────────────────────────
      } else if (action === '[RetrieveMessages]') {
        const chatList = buildDriverChatList();
        console.log(`200: POST ${urlPath} [action=${action}] -> ${chatList.length} drivers`);
        arrayD(res, chatList);

      } else if (action === '[DispatcherUnReadMessages]') {
        const driverId = parseInt(param('Id') || '0') || 0;
        const unread = messageStore.filter(m => m.SenderId === driverId && !m.IsRead);
        unread.forEach(m => { m.IsRead = true; });
        const mapped = unread.map(m => ({
          Id: m.Id, SenderID: m.SenderId, User: m.SenderName,
          Message: m.Message, Date: m.Date, Time: m.Time,
        }));
        console.log(`200: POST ${urlPath} [action=${action}] -> ${mapped.length} unread from driver #${driverId}`);
        arrayD(res, mapped);

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
          dt4: [{ Picking: 0 }],
          dt5: [{ Away: awayCount }],
        };
        console.log(`200: POST ${urlPath} [action=${action}] -> ${ZONE_DRIVERS.length} vehicles`);
        objectD(res, vehicleStatus);

      } else if (action === 'JobsCount') {
        const closedCount  = jobStore.filter(j => j.BookingStatus === 'Closed' || j.BookingStatus === 'Completed').length;
        const cancelCount  = jobStore.filter(j => j.BookingStatus === 'Cancelled').length;
        const noShowCount  = jobStore.filter(j => j.BookingStatus === 'No Show').length;
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
        let jobs = [...closedJobStore];
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
        const dt2 = ZONE_DRIVERS.map(d => ({ Id: d.driverid, DriveName: d.drivername }));
        const dt3 = ZONE_DRIVERS.map(d => ({ Id: d.VehicleId, VehicleNo: d.vehiclenumber }));
        console.log(`200: POST ${urlPath} [action=${action}] -> ${jobs.length} closed jobs`);
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
        // Return pending/unassigned jobs that need dispatch
        const bookingId = parseInt(param('bookingid') || '0') || 0;
        const job = bookingId > 0 ? jobStore.find(j => j.Id === bookingId) : null;
        const eligible = job && (job.BookingStatus === 'Pending') ? [job] : [];
        console.log(`200: POST ${urlPath} [action=${action}] -> ${eligible.length} eligible`);
        objectD(res, { dt1: eligible, dt2: [], dt3: [], dt4: [], dt5: [] });

      } else if (action === '[changeriddestatusforoffer]') {
        // Update a job's booking status (e.g. mark as Unreached after failed dispatch)
        const bookingId = parseInt(param('bookingid') || '0') || 0;
        const newStatus = param('ridestatus') || '';
        const job = jobStore.find(j => j.Id === bookingId);
        if (job && newStatus) {
          job.BookingStatus = newStatus;
          // Restore demo driver if reverting to non-offered status
          if (newStatus !== 'Offered') {
            const zd = ZONE_DRIVERS.find(d => d.driverid === job.DriverId || d.VehicleId === job.DriverId);
            if (zd) { zd.vehiclestatus = 'Available'; zd.JobphoneNo = ''; zd.jobpickup = ''; zd.jobdropoff = ''; zd.jobCount = 0; }
          }
        }
        console.log(`200: POST ${urlPath} [action=${action}] -> job #${bookingId} status=${newStatus || 'unchanged'}`);
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
        const driverId = parseInt(param('Id') || '0') || 0;
        const dt1 = [{ PlayerId: '' }];
        const convo = messageStore.filter(m => m.SenderId === driverId || m.ReceiverId === driverId);
        convo.forEach(m => { if (m.SenderId === driverId) m.IsRead = true; });
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
      if (!username.trim() || !password.trim()) {
        console.log(`200: POST ${urlPath} [LoginSelector] -> missing credentials`);
        successD(res, 'Please enter your username and password.');
        return;
      }
      // Demo: accept any non-empty credentials and return dispatcher session data
      console.log(`200: POST ${urlPath} [LoginSelector] -> login OK for "${username}"`);
      arrayD(res, [{
        Id: 1051,
        UserFName: 'Safinah Mohammed',
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

    // ── Other DataManager requests (GeneralSelector, etc.) ─────────────────
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
