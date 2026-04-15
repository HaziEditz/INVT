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

// ─── In-memory job store ──────────────────────────────────────────────────────
let nextJobId = 937300;
function newJobId() { return nextJobId++; }

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

// Demo job times generated relative to server start so they stay current
const _now = new Date();

// ASAP job: booking time = now (dispatch immediately), picking time = +8 mins
const _asapBook = new Date(_now);
const _asapPick = new Date(_now.getTime() + 8 * 60000);

// Pre-booked job: 5 days from now at 08:35, picking = 08:45
const _preBook = new Date(_now.getTime() + 5 * 24 * 3600000);
_preBook.setHours(8, 35, 0, 0);
const _prePick = new Date(_preBook.getTime() + 10 * 60000);

const jobStore = [
  {
    Id: 937195,
    AccountId: '', VehicleNo: null, CallSign: null, useremail: null, usertype: null,
    webstatus: '0', Name: 'Jane Doe', PhoneNo: '021 555 4321',
    BookingDateTime: fmtDT(_asapBook),
    Pickingtime: fmtDT(_asapPick),
    Recieve_payment: '', DispatchTimebefore: '0',
    VehicleId: 0, DriverId: 0, DispatcherName: 'safinah mohammed',
    Nextstop: '0', nextstopdata: '', Passengers: 1, passengername: 'Jane Doe',
    PickLatLng: '-46.4220233,168.3513913', DropLatLng: '-46.4070668,168.3474998',
    Bags: 1, WheelChairs: 0, VehiclesReguired: 1,
    Acc_job_id: '', Account_id: '',
    PickAddress: '156 Crinan Street, Appleby, Invercargill',
    DropAddress: 'Invercargill Airport, 106 Airport Ave, Invercargill',
    EntitiesDetails: '', U_id: null,
    BookingSource: 'Dispatch Console', BookingStatus: 'Pending',
    VehicleType: 'Sedan', EstimatedDistance: '4.2', EstimatedTime: '10',
    TarriffType: 'Standard',
  },
  {
    Id: 937163,
    AccountId: '', VehicleNo: null, CallSign: null, useremail: null, usertype: null,
    webstatus: '0', Name: 'Robert Smith', PhoneNo: '021 123 4567',
    BookingDateTime: fmtDT(_preBook),
    Pickingtime: fmtDT(_prePick),
    Recieve_payment: '', DispatchTimebefore: '10',
    VehicleId: 0, DriverId: 0, DispatcherName: 'safinah mohammed',
    Nextstop: '0', nextstopdata: '', Passengers: 2, passengername: 'Robert Smith',
    PickLatLng: '-46.4227508,168.3767375', DropLatLng: '0,0',
    Bags: 0, WheelChairs: 0, VehiclesReguired: 1,
    Acc_job_id: '', Account_id: '',
    PickAddress: '105 Centre Street, Heidelberg, Invercargill',
    DropAddress: '', EntitiesDetails: '', U_id: null,
    BookingSource: 'Dispatch Console', BookingStatus: 'Pending',
    VehicleType: 'Not Specified', EstimatedDistance: '0', EstimatedTime: '0',
    TarriffType: 'Automatic',
  },
];

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
  const offered = dt1.filter(j => j.BookingStatus === 'Offered');
  return {
    dt1,
    dt2: [{ AssignedCount: 0 }],
    dt3: [{ ActiveCount: 0 }],
    dt4: [{ UnAssignedCount: pending.length }],
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

      } else if (action === '[CancelUnAssignedJobStatusFromJobList]') {
        const bookingId = parseInt(param('BookingId')) || 0;
        const idx = jobStore.findIndex(j => j.Id === bookingId);
        if (idx !== -1) jobStore.splice(idx, 1);
        console.log(`200: POST ${urlPath} [action=${action}] -> removed job #${bookingId}`);
        successD(res, 'Operation Successfully Performed');

      } else if (action === '[AssignJobStatusFromJobList]' || action === '[UnAssignJobStatusFromJobList]') {
        const bookingId = parseInt(param('BookingId')) || 0;
        const job = jobStore.find(j => j.Id === bookingId);
        if (job) {
          const driverId  = parseInt(param('reternVehicleid') || '0') || 0;
          if (action === '[AssignJobStatusFromJobList]') {
            job.BookingStatus = 'Offered';
            job.DriverId = driverId;
          } else {
            job.BookingStatus = 'Pending';
            job.DriverId = 0;
            job.VehicleId = 0;
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
        console.log(`200: POST ${urlPath} [action=${action}] -> ${ZONE_DRIVERS.length} drivers`);
        arrayD(res, ZONE_DRIVERS);

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
