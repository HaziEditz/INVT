# BookaWaka — Driver Dispatch & Job Assignment Flow
## Complete Reference: A to Z

**Stack:** Node.js (`server.js`) · AngularJS + jQuery (`Default.aspx`) · Firebase Realtime Database  
**Company ID (example):** `620611` · **Firebase project:** `taxilatest`

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Job State Machine](#2-job-state-machine)
3. [Firebase Path Contract](#3-firebase-path-contract)
4. [Server-Side API Reference](#4-server-side-api-reference)
5. [Frontend Function Reference](#5-frontend-function-reference)
6. [Auto-Dispatch Loop (A→Z)](#6-auto-dispatch-loop-az)
7. [Manual Dispatch Flow (A→Z)](#7-manual-dispatch-flow-az)
8. [Driver Acceptance / Rejection Flow](#8-driver-acceptance--rejection-flow)
9. [Busy Driver Pre-Queue Flow](#9-busy-driver-pre-queue-flow)
10. [Job Completion Flow](#10-job-completion-flow)
11. [Cancellation & Recall Flows](#11-cancellation--recall-flows)
12. [Driver Status Heartbeat Flow](#12-driver-status-heartbeat-flow)
13. [Dedup & Lock System](#13-dedup--lock-system)
14. [Queue Position System](#14-queue-position-system)
15. [Web Booking Auto-Dispatch Gate](#15-web-booking-auto-dispatch-gate)
16. [Key Data Structures](#16-key-data-structures)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────┐
│              DISPATCH CONSOLE                    │
│           (Default.aspx — browser)              │
│                                                  │
│  AngularJS scope        Global JS functions      │
│  ─────────────          ────────────────────     │
│  $scope.driverdatarealx smartAutoDispatch()      │
│  $scope.unassignedjob_list acknowledgemethodx()  │
│  $scope.data1 (assigned) resolveAfter2Secondsx() │
│  $scope.data2 (active)   _resolveAcceptance()    │
│                          writeJobDetailsToFB()   │
│                          _bwWriteAssignmentToFB()│
└────────────┬───────────────────┬────────────────┘
             │ HTTP POST          │ Firebase SDK
             │ DataManager/...   │ (bi-directional)
             ▼                   ▼
┌─────────────────────┐  ┌─────────────────────────┐
│    server.js        │  │  Firebase Realtime DB    │
│    (Node.js)        │  │  (taxilatest project)    │
│                     │  │                          │
│  In-memory:         │  │  online/{cid}/{veh}/     │
│  jobStore[]         │  │  notification/{drvId}    │
│  closedJobStore[]   │  │  joback/{bookId}/{drvId} │
│  ZONE_DRIVERS[]     │  │  jobs/{cid}/{veh}/{drv}  │
│                     │  │  pendingjobs/{cid}/{id}  │
│  Persisted:         │  │  allbookings/{cid}/{id}  │
│  .data/jobstore.json│  │  completedJobs/{cid}/{id}│
│  .data/closedjob... │  │  driverEarnings/...      │
│  .data/zone_assign. │  │  jobDetails/{cid}/{id}   │
└─────────────────────┘  └─────────────────────────┘
             ▲
             │ Firebase heartbeat
             │ (DriverStatusChanged)
┌─────────────────────┐
│    DRIVER APP       │
│  (Android/iOS)      │
│                     │
│  Writes to:         │
│  online/{cid}/{veh}/│
│  joback/{bid}/{drv} │
│  jobs/{cid}/{veh}/. │
└─────────────────────┘
```

**All HTTP calls** go through two URL patterns:
- `POST /DataManager/Data.aspx/DataSelector` — read-heavy queries
- `POST /DataManager/Data.aspx/DataProcessor` — mutations

Request body shape:
```json
{ "data": [{ "name": "fieldName", "Value": "value" }], "action": "[ActionName]" }
```

---

## 2. Job State Machine

```
                    ┌─────────────┐
   Web booking ─→  │  Scheduled  │  (pre-book; NotifyDispatchAt not yet fired)
                    └──────┬──────┘
                           │ NotifyDispatchAt timer fires
                           ▼
  New booking ──→  ┌─────────────┐
  Hail/manual ──→  │   Pending   │◄──────────────────────────────┐
                    └──────┬──────┘                               │
                           │ smartAutoDispatch picks driver        │
                           │ OR dispatcher drags to driver         │
                           ▼                                       │
                    ┌─────────────┐   Server blocks duplicate    │
                    │   Offered   │   offers; 27s timeout fires  │
                    └──────┬──────┘──── Timeout/Reject ──────────┘
                           │ Driver accepts
                           ▼
                    ┌─────────────┐
                    │  Assigned   │◄── [AssignJobStatusFromJobList]
                    └──────┬──────┘    (manual dispatcher assign)
                           │ Driver goes Busy (picks up)
                           ▼
                    ┌─────────────┐
                    │   Active    │  (trip in progress)
                    └──────┬──────┘
                           │ Driver goes Available
                           ▼
                    ┌─────────────┐
                    │  Completed  │──→ closedJobStore, completedJobs FB
                    └─────────────┘

Special states:
  Queued   — Busy driver accepted pre-queue; auto-assigns when they go Available
  Picking  — Driver at pickup location (intermediate, treated like Assigned)
  Unreached — No response in 27s; immediately converted to Pending for re-dispatch
  No One   — Dispatcher flagged "no driver found"; excluded from auto-dispatch
  Cancelled — Terminal; moved to closedJobStore
```

---

## 3. Firebase Path Contract

| Path | Written by | Read by | Purpose |
|---|---|---|---|
| `online/{cid}/{vehicleId}/` | Driver app | Dispatch console (child_added/child_changed) | Driver presence, GPS, status |
| `online/{cid}/{vehicleId}/current` | Driver app | Dispatch console | Full driver record (vehiclestatus, jobId, lat, lng…) |
| `online/{cid}/{vehicleId}/vehiclestatus` | Dispatch console | Driver app | Status override at assignment |
| `online/{cid}/{vehicleId}/current/jobId` | Dispatch console | Driver app | Job ID stamped at assignment for app restart |
| `notification/{sqlDriverId}` | Dispatch console | Driver app | Job offer payload (triggers popup) |
| `joback/{bookingId}/{sqlDriverId}` | Dispatch console (pre-seed) + Driver app (accept/reject) | `resolveAfter2Secondsx()` | Accept/reject handshake |
| `jobs/{cid}/{vehicleId}/{sqlDriverId}` | Dispatch console + Driver app | Both | New app: offer + acceptance handshake |
| `jobDetails/{cid}/{bookingId}` | Dispatch console | Driver app (on restart) | Job detail lookup |
| `pendingjobs/{cid}/{bookingId}` | Stripe webhook, `/api/payment/confirm`, Dispatch | SA portal, Passenger app | Job status + payment info |
| `allbookings/{cid}/{bookingId}` | Dispatch console (assignment + completion) | SA portal | Booking lifecycle |
| `completedJobs/{cid}/{tripId}` | Dispatch console (at completion) | SA-MasterReport | Trip record for reporting |
| `driverEarnings/taxi/{cid}/{driverId}` | Dispatch console (at completion) | SA-TaxiDriverPay | Driver earnings |
| `autodisp/{driverId}` | Legacy auto-dispatch | Old driver app | Legacy offer path (kept for backward compat) |
| `chat/{driverId}` | Dispatch console | Driver app | Away notification |
| `joback/{bookingId}/{driverId}` | Dispatch console | `resolveAfter2Secondsx` listener | Pre-seed: `{jobstatus:'Offer',status:'Sent'}` |

### Notification payload written at offer time

```js
// Written to: /notification/{sqlDriverId}
// Also to:    /jobDetails/{cid}/{bookingId}
// Also to:    /jobs/{cid}/{vehicleId}/{sqlDriverId}
{
  type:           'job_offer',
  bookingid:      '6206112605076,Offered,1212,DISPUSR,Dispatcher',
  content:        'You have offered new Job please view details',  // OMIT for silent (Busy) offer
  joboffer:       '6206112605076',
  jobpickup:      '120 Esk Street, Invercargill',
  jobdropoff:     'Southland Hospital',
  JobphoneNo:     '021000111',
  jobname:        'Jane Doe',
  jobbags:        '0',
  jobpassengers:  '1',
  jobvehicletype: 'Sedan',
  jobinfo:        '',
  jobFare:        '18.50',
  jobCount:       1,
  jobServiceType: 'taxi',
  jobBookingSrc:  'Dispatcher',
  vehicleId:      'TAXI02',
  companyId:      '620611',
  // TM jobs only:
  extras: {
    tmVoucherNo: 'TM-123456',
    tmPassengerName: 'Jane Doe',
    tmSubsidy: 12,
    tmPassengerPays: 3,
    tmPaymentMethod: 'cash'
  }
}
```

### Driver acceptance written by driver app

```js
// joback/{bookingId}/{sqlDriverId}
{ jobstatus: 'Assigned', discription: 'Ride Status successfully Updated to Assigned' }
// OR (new driver app):
// jobs/{cid}/{vehicleId}/{sqlDriverId}
{ Status: 'DriverAccepted', BookingId: '6206112605076' }
```

---

## 4. Server-Side API Reference

### `server.js` — In-memory stores

```js
// Live jobs — any non-terminal status
let jobStore = [];          // persisted to .data/jobstore.json

// Completed/cancelled jobs
let closedJobStore = [];    // persisted to .data/closedjobstore.json

// Online drivers (from Firebase heartbeats)
let ZONE_DRIVERS = [];      // persisted partially to .data/zone_assignments.json
```

### `buildJobListResponse(jobs)` — shared job list builder

Returns `{ dt1, dt2, dt3, dt4, dt5, dt6 }`:
- **dt1** — Unassigned/Pending tab jobs (Pending, Scheduled, Offered, Reject, Unreached, No One + orphaned Assigned)
- **dt2** — `[{ AssignedCount }]`
- **dt3** — `[{ ActiveCount }]`
- **dt4** — `[{ UnAssignedCount }]`
- **dt5** — `[{ PublicKey: STRIPE_PK }]`
- **dt6** — Active jobs array (for active tab)

### `action = 'AutoDispatchVehiclesallride'`

**Called by:** `smartAutoDispatch()` every 10 seconds  
**URL:** `DataManager/Data.aspx/DataSelector`

**Server logic:**
1. **Stale-offer watchdog** — resets any job stuck in `Offered` for >2 minutes back to `Pending`
2. **Orphan watchdog** — resets any `Assigned` job with `DriverId=0` back to `Pending`
3. **Filter** — returns only `Pending` jobs within their dispatch window
4. **Dispatch window check** — withholds pre-books until `now >= Pickingtime - DispatchTimebefore minutes`
5. **Priority sort** — ASAP jobs first, then pre-books by window-open time ascending

**Response `dt1` fields per job:**
```js
{
  Id, ZoneId, VehicleType, Passengers, PickLatLng,
  serviceType,       // 'taxi' | 'food' | 'freight'
  BookingSource,     // 'Website' | 'Dispatcher' | 'passenger' | 'Hail'
  paymentStatus,     // 'paid' | '' — used by BUG-7 gate on client
  prepaid,           // boolean
  DispatchTimebefore,
  BookingDateTime
}
```

---

### `action = '[changeriddestatusforoffer]'`

**Called by:** `acknowledgemethodx()`, `convertstatus()`, `convertstatus1()`  
**URL:** `DataManager/Data.aspx/DataProcessor`

**Params:** `bookingid`, `ridestatus`, `returnreason`, `driverid`

**Server logic (guards in order):**

1. **Duplicate offer guard** — if job already `Offered` to a different driver → `{ blocked: true }`
2. **Per-driver double-offer guard** — if driver already has another job `Offered` → `{ blocked: true }`
3. **Downgrade guard** — if job already `Assigned/Active/Picking` and new status is a downgrade + reason is timeout → `{ blocked: true }`
4. **Queued guard** — if job is `Queued`, only `[RecallQueuedJob]` / `[PromoteQueuedToAssigned]` may change it → `{ blocked: true }`
5. **Driver post-accept cancel** — if driver explicitly rejected an Assigned/Picking job → close as Cancelled (Picking) or return to Pending (Assigned)
6. **Dispatcher recall flag** — if `returnreason` contains "manually unassigned" → `markDispatcherRecalled(jobId)` so `[DriverStatusChanged]` won't misread subsequent Available heartbeat
7. **Unreached** → immediately maps to `Pending` so job is re-dispatchable
8. **Timestamps** — stamps `OfferedAt`, `AcceptedAt`, `PickingAt` on first transition
9. **Driver home state** — saves driver's zone + queue before dispatching (`saveDriverHomeState`)
10. **Driver release** — on Unreached/Pending/Cancelled: driver goes `Away` (timeout/reject) or `Available` (dispatcher cancel); `calcRestoredQueue` restores position
11. `saveJobStore()`

**Response:** `{ dt1:[], ..., newQueueNo, blocked?, driverCancelled?, driverRecalled? }`

---

### `action = '[AssignJobStatusFromJobList]'` / `'[AssignJobStatusFromJobListv2]'`

**Called by:** Dispatcher drag-drop assignment, `_resolveAcceptance()` (Available path)  
**URL:** `DataManager/Data.aspx/DataProcessor`

**Params:** `BookingId`, `reternVehicleid` (driverId), `VehicleId`

**Server logic:**
1. Sets job to `Assigned`, stamps `AcceptedAt`
2. Saves driver's home zone/queue (`saveDriverHomeState`)
3. Stamps vehicle number and driver name on job from `ZONE_DRIVERS`
4. Sets driver to `Picking` in `ZONE_DRIVERS`, stamps `JobphoneNo`, `jobpickup`, `jobdropoff`
5. For rental jobs: patches Firebase `rentalTaxiRequests/{key}` → `confirmed`
6. `[v2]` version also fire-and-forgets to the real taxitime.co.nz backend (legacy sync)
7. `saveJobStore()`

**Unassign variant `[UnAssignJobStatusFromJobList]`:**
- Sets job back to `Pending`, clears `DriverId`
- Restores driver to `Available` with `calcRestoredQueue` position

---

### `action = '[DriverStatusChanged]'`

**Called by:** Driver app heartbeat (every ~10s) + dispatch console (for testing)  
**URL:** `DataManager/Data.aspx/DataProcessor`

**Params:** `driverid`, `newstatus`, `vehiclenumber`, `drivername`, `lat`, `lng`, `zonename`, `zoneid`, `zoneonly`

**Key transitions per newStatus:**

| newStatus | Job transition | Driver transition |
|---|---|---|
| `Assigned` | Non-terminal job → `Assigned` | Stays in ZONE_DRIVERS |
| `Busy` | Assigned/Offered/Picking job → `Active` (one only) | `Picking` in ZONE_DRIVERS |
| `Busy` (no live job) | Creates Hail job in jobStore | `Busy` in ZONE_DRIVERS |
| `Picking` | Offered/Assigned job → `Assigned` | Stays |
| `Available` (after Active) | Active job → `Completed`; builds `_dscCompletedJob`; patches allbookings | `Available` + recalc queue |
| `Available` (after Assigned, no crash) | Assigned job → `Pending` (driver recall) | `Available` + recalc queue |
| `Available` (after Picking) | Picking job → `Cancelled` | `Available` + recalc queue |

**Completion path detail (`Available` after `Active`):**
```js
job.BookingStatus = 'Completed';
job.JobCompleteTime = new Date().toISOString();
jobStore.splice(idx, 1);
closedJobStore.push(job);
saveJobStore(); saveClosedJobStore();
_patchRentalComplete(job);       // patches rentalTaxiRequests if rental

// Build _dscCompletedJob — returned in response for client Firebase write
const _cjPayMethod = (
  job.PaymentType || job.paymentType ||
  job.PaymentMethod || job.paymentMethod || 'cash'
).toLowerCase();

_dscCompletedJob = {
  tripId, bookingId, companyId, driverId, driverName,
  vehicleId, vehicleNo, fare,
  paymentType:    _cjPayMethod,
  paymentMethod:  _cjPayMethod,
  paymentStatus:  job.paymentStatus || '',
  stripeChargeId: job.stripeChargeId || null,
  completedAt, status: 'Completed', source: 'dispatch',
  pickup, dropoff, distanceKm,
  // TM fields if applicable:
  tmSubsidy, tmSubsidyHoist, tmPassengerPays, totalCouncilPays, councilId
};

// Server-side allbookings patch (§108d)
firebaseDbPatch(`allbookings/${cid}/${jobId}`, {
  Status: 'Completed',
  paymentMethod: _cjPayMethod,
  PaymentMethod: _cjPayMethod,
  completedAt: job.JobCompleteTime,
  paymentStatus: ..., stripeChargeId: ...
}, serverToken);
```

**Response:** `{ ..., completedJob: _dscCompletedJob|null, driverCancelled:|null, driverRecalled:|null, reconnectJob:|null, newQueueNo, zoneOnly }`

---

### `action = '[QueueJob]'`

**Called by:** `_resolveAcceptance()` when driver is Busy  
Sets job to `Queued`, links driver. When driver later goes `Available` in `[DriverStatusChanged]`, `[PromoteQueuedToAssigned]` fires automatically.

---

### `action = '[RecallQueuedJob]'`

**Called by:** Queued-recall watcher in `_resolveAcceptance()` when driver releases queued job  
Returns job to `Pending`/`No One`, clears driver link, restores driver to Available.

---

### `action = '[BwForceDriver]'`

**Used for testing.** Forces a driver into `ZONE_DRIVERS` as Available without needing the driver app.

```
GET /DataManager/Data.aspx/DataProcessor
params: driverid=1212&vehiclenumber=TAXI02&drivername=John+Smith
        &vehicletype=Sedan&lat=-46.413&lng=168.354&zonename=Invercargill
        &online=true
```

---

## 5. Frontend Function Reference

### `getSqlDriverId(anyId)` — ID resolver

Resolves any driver identifier (VehicleId, Firebase PlayerId, SQL driverid, vehiclenumber) to the **SQL driverid** — the key the driver app listens on at `/notification/{driverid}`.

```js
// Called before every Firebase write to ensure correct path
var sqlId = getSqlDriverId(best.VehicleId);
```

---

### `writeJobDetailsToFirebase(driverId, vehicleId, bookingId, details)`

**THE canonical offer write function.** Replaces all legacy `writeNewPost` calls.

Writes to three paths atomically:
1. `/notification/{driverId}` — triggers driver app popup (full payload with `content` field)
2. `/jobDetails/{cid}/{bookingId}` — standalone lookup for app restart
3. Does NOT touch `online/` — writing there triggers spurious status events

**Silent (Busy pre-queue) variant:** payload omits the `content` field → badge-only, no popup.

```js
writeJobDetailsToFirebase(driverId, vehicleId, bookingId, {
  pickup:      'Address',
  dropoff:     'Address',
  phone:       '021...',
  name:        'Jane Doe',
  bags:        0,
  passengers:  1,
  vehicleType: 'Sedan',
  rideinfo:    '',
  fare:        18.50,
  serviceType: 'taxi',
  bookingSource: 'Dispatcher',
  status:      'Offered',
  source:      'Dispatcher',
  // TM extras:
  tmVoucherNo: '...',
  tmSubsidy: 12, tmPassengerPays: 3
});
```

---

### `sendJobToDriver(driverId, vehicleId, bookingId, status, uId)`

Unified wrapper that:
1. Applies the service-type guard (`_bwCanDriverDoService`)
2. Looks up full job details from Angular scope (all job lists)
3. Falls back to AJAX `JobDetails` fetch if not in scope
4. Calls `writeJobDetailsToFirebase`

---

### `FnCancelRide(DriverId, BookingId)`

Sends job-cancel notification to driver via Firebase:
- Writes `{ bookingid: 'ID,Job Cancel,...', content: 'Passenger Cancel' }` to `/notification/{DriverId}`
- Scans `jobs/{cid}` for matching `BookingId` → sets `Status: 'Cancelled'`

---

### `FnNotifyDriverAway(DriverId, reason)`

Writes Away message to `/notification/{id}` and `/chat/{id}`:
- `reason='reject'` → "You are now Away — you rejected the job."
- `reason='timeout'` → "You are now Away — job not accepted in time."

---

### `_bwWriteAssignmentToFirebase(bookingId, driverId, vehicleId)`

Called when driver accepts (Available path in `_resolveAcceptance`):
1. `pendingjobs/{cid}/{bookingId}` → `{ Status:'Assigned', AssignedDriver, AssignedAt }`
2. `allbookings/{cid}/{bookingId}` → same patch
3. `online/{cid}/{vehicleId}` → `{ vehiclestatus:'Assigned' }`
4. `online/{cid}/{vehicleId}/current` → `{ jobId, currentJobId, vehiclestatus:'Assigned' }`
5. `jobs/{cid}/{bookingId}` → `{ status:'assigned', driverId, vehicleId, AssignedAt }`

---

### `acknowledgemethodx(vehicle, driverId, bookId, status)` — async

**The core offer orchestrator.** Called by `smartAutoDispatch` and manual dispatch buttons.

Flow:
```
1. Dedup check — _activeOfferIds[bookId] set? → skip (already offering)
2. Lock driver — _activeOfferDrivers[driverId] = bookId

3. Busy pre-queue path (if _driverQueueMap[driverId] === bookId):
   ├─ Verify driver is actually still Busy (race guard)
   ├─ Write joback/{bookId}/{driverId} = {jobstatus:'Offer',status:'Sent'}
   ├─ Write SILENT payload to /notification/{driverId} (no content field)
   ├─ Write /jobDetails/{bookId}
   └─ _watchBusyDriverAcceptance(vehicle, driverId, bookId) → return

4. Normal (Available) path:
   ├─ POST [changeriddestatusforoffer] ridestatus=Offered
   │   └─ If blocked → release locks, return
   ├─ Add driverId to _triedDriversForJob[bookId]
   ├─ Save in-flight offer to localStorage (orphan cleanup on reload)
   ├─ Pre-seed joback/{bookId}/{driverId} = {jobstatus:'Offer',status:'Sent'}
   ├─ writeJobDetailsToFirebase (full payload with content → popup)
   └─ await resolveAfter2Secondsx(vehicle, driverId, bookId, status)
      └─ On return: release _activeOfferIds, _activeOfferDrivers
         Kick _sadTrigger (re-run smartAutoDispatch immediately)
```

---

### `resolveAfter2Secondsx(vehicle, driverId, bookId, status)` — async/Promise

**27-second Firebase watcher** for driver accept/reject.

Sets up two concurrent listeners:
1. `joback/{bookId}/{driverId}` — legacy driver app path
2. `jobs/{cid}/{vehicle}/{driverId}` — new driver app path

**On accept** (`jobstatus=Assigned` or `Status=DriverAccepted`):
- Remove listeners, clean up joback, remove DOM card (`#Divo{bookId}`)
- `_resolveAcceptance(bookId, driverId)` — assign or queue

**On reject** (`jobstatus=Reject`):
- Write `Away` to Firebase `online/{cid}/{vehicle}` and `online/{cid}/{vehicle}/current`
- `FnNotifyDriverAway(driverId, 'reject')`
- Update Angular scope driver to `Away` immediately
- `convertstatus(bookId, 'Pending', driverId, 'Driver Rejected')`
- `_immediateJobPending(bookId)`

**On app-in-background** (`discription='job reached but will not be displayed'`):
- `convertstatus(bookId, 'Pending', driverId, $message)` — no Away lock

**27-second timeout** (via `checkingjobz` / `checkingjob`):
- `convertstatus1(vehicle, bookId, 'Unreached', driverId, 'No Response')`
- Server guard: if job already Assigned (race) → `blocked:true`, client skips toast/Away-lock

---

### `_resolveAcceptance(bookingId, driverId, _mustQueue)`

Called when driver accepts. Determines whether to **assign immediately** or **queue** (Busy driver).

```
If driver is Busy (or _mustQueue=true):
  → POST [QueueJob] { bookingid, driverid }
  → Server: job.BookingStatus = 'Queued'
  → Toast: "Pre-Queued — assigns when driver finishes trip"
  → Arm queued-recall watcher on joback/{bookId}/{driverId}
     (if driver later releases: POST [RecallQueuedJob])

If driver is Available:
  → POST [AssignJobStatusFromJobList] { BookingId, VehicleId/reternVehicleid }
  → _bwWriteAssignmentToFirebase(bookingId, driverId, vehicleId)
  → getjobs() + AssignedJobs() scope refresh
```

---

### `_watchBusyDriverAcceptance(vehicle, driverId, bookId)`

**Silent Busy-driver pre-queue watcher.** No timeout, no Away write, no popup.

Watches `joback/{bookId}/{driverId}` AND `jobs/{cid}/{vehicle}/{driverId}`.

- **Accept** → `_resolveAcceptance(bookId, driverId, true)` (mustQueue=true)
- **Reject** → clear `_driverQueueMap[driverId]`, kick `_sadTrigger`
- **15-second retry check** — if Available drivers exist, release to them; otherwise keep watching
- **External kill-switch** at `_busyWatcherCleanupMap[bookId]` — called by Available-transition handler when driver finishes trip without accepting

---

### `_immediateJobPending(jobId)`

Optimistic UI — immediately moves job from `Offered` → `Pending` in all Angular scope lists without waiting for AJAX round-trip. Clears offer locks, kicks `_sadTrigger`.

---

### `convertstatus(id, status, driverId, reason)` / `convertstatus1(vehicle, id, status, driverId, reason)`

Both call `POST [changeriddestatusforoffer]`. `convertstatus1` first checks current job status with `checkriddestatusforoffer` to guard against race-condition downgrades (job already Assigned before timeout AJAX arrives).

---

### `smartAutoDispatch()` — async, runs every 10 seconds

```js
async function smartAutoDispatch() {
  if (_sad_running) return;  // reentrance guard
  _sad_running = true;
  try {
    // 1. Fetch pending jobs from server
    var result = await Selector([{name:'CurrentDateTime', Value: dateStr}],
                                'AutoDispatchVehiclesallride');
    var pendingJobs = result.dt1;

    // 2. BUG-7 gate: skip unpaid web bookings
    pendingJobs = pendingJobs.filter(pj => {
      if (BookingSource !== 'website') return true;
      return pj.paymentStatus === 'paid' || pj.prepaid;
    });

    // 3. BUG-2 gate: skip pre-books outside dispatch window (client-side check)
    pendingJobs = pendingJobs.filter(pj => {
      var windowOpensMs = pickupMs - DispatchTimebefore * 60000;
      return Date.now() >= windowOpensMs;
    });

    // 4. Stale-lock recovery: clear _activeOfferIds if server says job is Pending
    pendingJobs.forEach(pj => {
      if (_activeOfferIds[pj.Id] && serverSaysPending) delete _activeOfferIds[pj.Id];
    });

    var _claimedThisCycle = {};

    for (var jobIdx = 0; jobIdx < pendingJobs.length; jobIdx++) {
      var job = pendingJobs[jobIdx];
      if (_activeOfferIds[job.Id]) continue;          // already offering
      if (_activeBusyWatcherJobs[job.Id]) continue;   // busy-watcher active

      // 5. Filter eligible drivers for this job
      var available = driverdatarealx.filter(d =>
        d.vehiclestatus === 'Available' &&
        !_claimedThisCycle[d.driverid] &&
        !_activeOfferDrivers[d.driverid] &&
        d.companyId === SomeSession2 &&
        _bwCanDriverDoService(d.driverid, job.serviceType) &&
        _triedDriversForJob[job.Id].indexOf(d.driverid) === -1
      );

      // 6. Busy pre-queue: if no Available drivers, try a Busy one
      if (!available.length) {
        var busyDriver = driverdatarealx.find(d =>
          d.vehiclestatus === 'Busy' &&
          !_driverQueueMap[d.driverid] &&
          !_activeOfferIds[job.Id]
        );
        if (busyDriver) {
          _driverQueueMap[busyDriver.driverid] = job.Id;
          acknowledgemethodx(busyDriver.VehicleId, busyDriver.driverid, job.Id, 'Pending');
        }
        continue;
      }

      // 7. Pick best driver: zone-queue sorted, then distance tie-break
      available.sort((a, b) => {
        var qa = a.zonequeue || 999, qb = b.zonequeue || 999;
        if (qa !== qb) return qa - qb;
        return distance(pickLat, pickLng, a.lat, a.lng) - distance(pickLat, pickLng, b.lat, b.lng);
      });

      var best = available[0];
      _claimedThisCycle[best.driverid] = true;
      _triedDriversForJob[job.Id].push(best.driverid);

      // 8. Send offer
      acknowledgemethodx(best.VehicleId, best.driverid, job.Id, 'Pending');
    }
  } finally { _sad_running = false; }
}

_sadTrigger = smartAutoDispatch;
setInterval(smartAutoDispatch, 10000);
```

---

## 6. Auto-Dispatch Loop (A→Z)

```
Every 10 seconds (or immediately via _sadTrigger):

A. smartAutoDispatch() fires
B. POST AutoDispatchVehiclesallride → server returns Pending jobs
   ├── Server runs stale-offer watchdog (resets Offered>2min → Pending)
   └── Server runs orphan watchdog (Assigned+DriverId=0 → Pending)
C. Client applies BUG-7 gate (skip unpaid web bookings)
D. Client applies BUG-2 gate (skip pre-books not yet in window)
E. For each pending job:
   F. Skip if _activeOfferIds[jobId] set (offer already in flight)
   G. Skip if _activeBusyWatcherJobs[jobId] set (Busy watcher running)
   H. Build eligible driver list:
      - vehiclestatus === 'Available'
      - Not claimed this cycle
      - Not already offering another job
      - Same companyId
      - Can do job's serviceType
      - Not in _triedDriversForJob[jobId] (rejected/timed-out already)
   I. If no Available drivers → try Busy pre-queue (see §9)
   J. Sort by zonequeue ASC, then distance to pickup ASC
   K. Pick best driver (sorted[0])
   L. acknowledgemethodx(vehicleId, driverId, jobId, 'Pending')
      M. Set _activeOfferIds[jobId] = true (dedup lock)
      N. Set _activeOfferDrivers[driverId] = jobId (per-driver lock)
      O. POST [changeriddestatusforoffer] ridestatus=Offered
         ├── Server double-offer guard (blocked? → release locks, done)
         └── Server stamps job.BookingStatus = 'Offered', offeredAt = Date.now()
      P. Pre-seed joback/{jobId}/{driverId} = {jobstatus:'Offer', status:'Sent'}
      Q. writeJobDetailsToFirebase → /notification/{driverId} (with content → popup)
                                   → /jobDetails/{cid}/{jobId}
      R. await resolveAfter2Secondsx (27s Firebase watcher):
         ├── Driver accepts → _resolveAcceptance → [AssignJobStatusFromJobList]
         │                                        → _bwWriteAssignmentToFirebase
         └── Driver rejects/timeout → convertstatus(Pending) → job back to U-A tab
      S. Release _activeOfferIds, _activeOfferDrivers
      T. setTimeout(_sadTrigger, 400) — immediately re-run for next job
```

---

## 7. Manual Dispatch Flow (A→Z)

Dispatcher drags a job card onto a driver row in the zone table:

```
A. Dispatcher clicks/drags job → driver in UI
B. [checkjobstatus] gate check — is job still free to dispatch?
   └── Server: returns 'true' if not already Offered/Assigned
C. [AssignJobStatusFromJobListv2] POST
   ├── Server: job.BookingStatus = 'Assigned', stamps DriverId, VehicleId
   ├── Server: saveDriverHomeState(driverId, zdEntry)
   ├── Server: zd.vehiclestatus = 'Picking' (driver marked busy)
   └── Server: fire-and-forget sync to legacy taxitime.co.nz backend
D. sendJobToDriver(driverId, vehicleId, bookingId, 'Assigned', uId)
   └── writeJobDetailsToFirebase → /notification/{driverId} (popup)
E. _bwWriteAssignmentToFirebase(bookingId, driverId, vehicleId)
   ├── pendingjobs/{cid}/{bookingId} → { Status:'Assigned', AssignedDriver }
   ├── allbookings/{cid}/{bookingId} → same
   ├── online/{cid}/{vehicleId} → { vehiclestatus:'Assigned' }
   ├── online/{cid}/{vehicleId}/current → { jobId, currentJobId, vehiclestatus }
   └── jobs/{cid}/{bookingId} → { status:'assigned', driverId, vehicleId }
F. getjobs() + AssignedJobs() scope refresh → job appears in Assigned tab
```

---

## 8. Driver Acceptance / Rejection Flow

### Accept path

```
Driver app writes to Firebase:
  joback/{bookId}/{driverId} = { jobstatus: 'Assigned', discription: '... Assigned' }
  OR jobs/{cid}/{vehicleId}/{driverId} = { Status: 'DriverAccepted', BookingId: '...' }

resolveAfter2Secondsx listener fires:
  settled = true
  joback node removed
  #Divo{bookId} DOM card removed
  _resolveAcceptance(bookId, driverId)

  If driver is Available:
    POST [AssignJobStatusFromJobList] { BookingId, VehicleId }
    _bwWriteAssignmentToFirebase (Firebase write-back)
    getjobs() + AssignedJobs() refresh

  If driver is Busy (Queued path — see §9):
    POST [QueueJob] { bookingid, driverid }
    Arm queued-recall watcher

Release locks:
  delete _activeOfferIds[bookId]
  delete _activeOfferDrivers[driverId]
  setTimeout(_sadTrigger, 400)
```

### Reject path

```
Driver app writes to Firebase:
  joback/{bookId}/{driverId} = { jobstatus: 'Reject', discription: '... Reject' }

resolveAfter2Secondsx listener fires:
  joback node removed
  /notification/{driverId} removed
  jobs/{cid}/{vehicle}/{driverId} → { vehiclestatus: 'Away' }
  online/{cid}/{vehicle} → { vehiclestatus: 'Away' }
  online/{cid}/{vehicle}/current → { vehiclestatus: 'Away' }
  FnNotifyDriverAway(driverId, 'reject')
  Angular scope: driver.vehiclestatus = 'Away' (immediate)
  _immediateJobPending(bookId) → job → Pending in UI
  convertstatus(bookId, 'Pending', driverId, 'Driver Rejected')
    → POST [changeriddestatusforoffer] ridestatus=Pending
    → Server: job.BookingStatus = 'Pending', driver → Away in ZONE_DRIVERS
  getjobs() refresh
```

### 27-second timeout path

```
checkingjob(bookId, driverId, settleCallback) fires after 27s:
  joback removed, DOM card removed, /notification removed
  convertstatus1(vehicle, bookId, 'Unreached', driverId, 'No Response'):
    1. checkriddestatusforoffer — is job still Pending/Offered?
       If already Assigned (race) → skip entirely (no toast, no Away-lock)
    2. POST [changeriddestatusforoffer] ridestatus=Unreached returnreason='No Response'
       Server maps Unreached → Pending immediately (no holding state)
       If blocked (race) → log only
    3. POST [DriverStatusChanged] newstatus=Away (away-lock the driver)
    4. Toast: "Driver did not respond. Job returned to queue."
  _immediateJobPending(bookId) → job → Pending in UI
  setTimeout(_sadTrigger, 400) → re-offer to next driver immediately
```

---

## 9. Busy Driver Pre-Queue Flow

When no Available drivers exist and a Pending job needs dispatch:

```
A. smartAutoDispatch: no Available drivers found for job #X
B. Find a Busy driver without an existing queue entry:
   busyDriver = driverdatarealx.find(d => d.vehiclestatus === 'Busy' && !_driverQueueMap[d.driverid])
C. Set _driverQueueMap[driverId] = jobId
D. acknowledgemethodx(vehicleId, driverId, jobId, 'Pending')
   → _isBusyPreQueue = true (driverQueueMap entry found)
   → Verify driver still Busy (race guard)
   → Write joback/{jobId}/{driverId} = {jobstatus:'Offer', status:'Sent'}
   → Write SILENT notification (no 'content' field — badge only, no popup)
   → _watchBusyDriverAcceptance(vehicle, driverId, jobId)
      Watches joback + jobs Firebase paths
      15s retry: if Available driver exists, release to them
      Kill-switch: changedata(Busy→Available) can cancel this watcher

E. Driver accepts pre-queue offer:
   joback/{jobId}/{driverId} = { jobstatus:'Assigned' }
   OR jobs/{cid}/{vehicle}/{driverId} = { Status:'DriverAccepted' }
   → _wbAccept() → _resolveAcceptance(jobId, driverId, mustQueue=true)
   → POST [QueueJob] → server: job.BookingStatus = 'Queued', linked to driver

F. Driver finishes current Hail → goes Available:
   [DriverStatusChanged] newstatus=Available
   Server: finds job in state='Queued' for this driver
   → Server: job.BookingStatus = 'Assigned' (auto-promote)
   OR: client-side changedata handler kills _busyWatcherCleanupMap watcher
       then re-offers job normally with popup

G. Queued-recall watcher (armed after [QueueJob] success):
   Watches joback/{jobId}/{driverId}
   If driver releases from queue → POST [RecallQueuedJob]
   → job returns to Pending, driver → Available
```

---

## 10. Job Completion Flow

```
A. Driver finishes trip → Driver app writes:
   online/{cid}/{vehicleId}/vehiclestatus = 'Available' (heartbeat)

B. [DriverStatusChanged] newstatus=Available fires on server:
   Finds Active job for this driver
   job.BookingStatus = 'Completed'
   job.JobCompleteTime = new Date().toISOString()
   Move job from jobStore → closedJobStore
   saveJobStore(), saveClosedJobStore()

C. Server builds _dscCompletedJob:
   paymentType/paymentMethod resolved from:
     job.PaymentType || job.paymentType ||
     job.PaymentMethod || job.paymentMethod || 'cash'
   Includes: fare, driverId, vehicleId, pickup, dropoff, distanceKm,
             paymentStatus, stripeChargeId, TM fields if applicable

D. Server patches allbookings/{cid}/{jobId} (§108d):
   { Status:'Completed', paymentMethod, PaymentMethod, completedAt, paymentStatus, stripeChargeId }

E. Server returns: { completedJob: _dscCompletedJob }

F. Dispatch console client receives _dscCompletedJob:

   F1. Write completedJobs/{cid}/{tripId}:
   {
     bookingId, companyId, fare,
     paymentType:   _cj.paymentType || _cj.paymentMethod || 'cash',
     paymentMethod: _cj.paymentMethod || paymentType,
     paymentStatus: _cj.paymentStatus,   // 'paid' for web bookings
     stripeChargeId: _cj.stripeChargeId, // if Stripe
     completedAt, status:'Completed', source:'dispatch',
     driverId, vehicleId, pickupAddress, dropAddress, distanceKm,
     // TM fields if applicable
   }

   F2. driverEarnings guard:
   Query completedJobs/{cid} orderByChild('bookingId') equalTo(bookingId)
   → If only 1 record (ours) → increment driverEarnings/taxi/{cid}/{driverId}
   → If >1 records (driver app also wrote) → skip (prevent double-count)

   F3. driverEarnings update:
   driverEarnings/taxi/{cid}/{driverId} → {
     totalEarned:   existing + fare,
     pendingAmount: existing + fare,
     tripCount:     existing + 1,
     updatedAt:     Date.now()
   }

G. UI refreshes: getjobs(), ActiveJobsdata() remove completed job from Active tab
H. Driver → Available in zone table, recalculated queue position
```

---

## 11. Cancellation & Recall Flows

### Dispatcher cancels unassigned job

```
Button → POST [CancelUnAssignedJobStatusFromJobList] { BookingId }
Server: job.BookingStatus = 'Cancelled'
        job → closedJobStore
        saveJobStore(), saveClosedJobStore()
        If rental: patches rentalTaxiRequests/{key} → 'cancelled'
UI: getjobs() removes job from U-A tab
```

### Dispatcher manually unassigns driver (Recall button in Assigned tab)

```
FnCancelRide(driverId, bookingId) → Firebase cancel notification to driver
POST [changeriddestatusforoffer] {
  bookingid: jobId,
  ridestatus: 'Pending',
  returnreason: 'Manually Unassigned',
  driverid: 0
}
Server: markDispatcherRecalled(jobId) — prevents Available heartbeat being treated as driver cancel
        job.BookingStatus = 'Pending', DriverId cleared
        driver → Available, queue restored
UI: AssignedJobs(), getjobs() refresh
setTimeout(_sadTrigger, 700) — re-offer immediately
```

### Driver cancels after accepting (from driver app)

```
Driver app writes: joback/{jobId}/{driverId} = { jobstatus:'Reject', discription:'... Reject' }
resolveAfter2Secondsx detects isExplicitReject=true, isAccepted=true
→ POST [changeriddestatusforoffer] ridestatus=Pending returnreason='Driver Recalled'
Server (isDriverPostAcceptCancel path):
  If Picking: job → Cancelled, closedJobStore (passenger no-show at pickup)
  If Assigned: job → Pending, DriverId=-2 (returned to queue for re-dispatch)
UI: toast "Driver recalled" / "Driver cancelled at pickup"
    getjobs(), AssignedJobs() refresh
    _sadTrigger (re-offer immediately)
```

---

## 12. Driver Status Heartbeat Flow

Driver app sends heartbeat to `/DataManager/Data.aspx/DataProcessor` with `[DriverStatusChanged]`.

```
Dispatcher console Firebase listeners (child_added, child_changed):
  Path: online/{cid}/{vehicleId}
  OR:   online/{cid}/{vehicleId}/current (new driver app)

On each event:
  1. Merge vehicleId/driverid from node top-level OR from 'current' child
  2. POST [DriverStatusChanged] {
       driverid, newstatus, vehiclenumber, drivername,
       lat, lng, zonename, zoneid
     }
  3. Server updates ZONE_DRIVERS entry
  4. If Available → deferred screen update (await server confirmation)
     If Busy/Picking/Assigned → immediate screen update
  5. If completedJob returned → write completedJobs + driverEarnings to Firebase
  6. If driverRecalled returned → toast + clear offer locks + _sadTrigger
  7. If driverCancelled returned → toast + remove job card
  8. If reconnectJob returned → restore driver's job card (crash recovery)
  9. zonetablez() — rebuild zone queue display
```

---

## 13. Dedup & Lock System

| Lock | Variable | Set when | Cleared when |
|---|---|---|---|
| Job-level offer lock | `_activeOfferIds[jobId]` | `acknowledgemethodx` called | Driver accepts/rejects, timeout, `_immediateJobPending` |
| Driver-level offer lock | `_activeOfferDrivers[driverId]` | `acknowledgemethodx` called | Same as above |
| Tried-driver record | `_triedDriversForJob[jobId][driverId]` | Offer sent | Dispatcher releases job (No One), job cancelled, driver recalled |
| Busy pre-queue claim | `_driverQueueMap[driverId]` = jobId | Busy driver offered silently | Driver accepts+queues, driver rejects, `_wbExternalCancel` |
| Active Busy watcher | `_activeBusyWatcherJobs[jobId]` | `_watchBusyDriverAcceptance` starts | Watcher cleaned up |
| Busy watcher kill-switch | `_busyWatcherCleanupMap[jobId]` | Same | Watcher cancelled externally |
| Queued-job recall watcher | `_queuedJobWatchers[jobId]` | `[QueueJob]` success | Driver releases queued job |
| Single-run guard | `_sad_running` | `smartAutoDispatch` starts | `finally` block |
| In-flight offers (localStorage) | `_bwInFlightOffers` | Offer sent | Driver accepts (orphan cleanup on reload) |
| Server away-lock | `AWAY_LOCKS[driverId]` | `[changeriddestatusforoffer]` timeout | `clearAwayLock` on next Available |
| Server dispatcher-recall flag | `DISPATCHER_RECALLED[jobId]` | `markDispatcherRecalled` | `consumeDispatcherRecalled` on [DriverStatusChanged] Available |
| Server driver-home state | `DRIVER_HOME_STATE[driverId]` | Offer sent | `clearDriverHomeState` on Available |
| Server reconnect-pending | `RECONNECT_PENDING[driverId]` | Driver away (crash pattern) | `consumeDriverReconnectPending` on Available |

---

## 14. Queue Position System

### `calcRestoredQueue(driverId, currentZone)` — server-side

When a driver becomes Available after a job:

```js
function calcRestoredQueue(driverId, currentZone) {
  const mem = getDriverHomeState(driverId);  // saved before offer was sent
  if (!mem) return (max existing queue position) + 1;  // new driver

  if (currentZone === mem.homeZone) {
    // Same zone: reward with their pre-offer queue position
    // (capped at end of current queue to handle concurrent changes)
    return Math.min(mem.homeQueuePos, nextQueueInZone(currentZone, driverId));
  } else {
    // Different zone: new zone → pole position (queue=1)
    return 1;
  }
}
```

**Client-side zone detection** — uses `google.maps.geometry.poly.containsLocation`:
```js
function _getZoneForLatLng(lat, lng) {
  // Checks each zone polygon loaded via ZoneCoordinates
  // Returns { zoneId, zoneName } if inside a zone
}
```

GPS-detected zone change is sent with every `[DriverStatusChanged]` heartbeat, updating `ZONE_DRIVERS[].zonename` server-side.

---

## 15. Web Booking Auto-Dispatch Gate

**BUG 7** — Prevents auto-dispatch of web bookings before Stripe payment is confirmed.

```
Web booking created (Firebase pendingjobs, Status:'Waiting')
  ↓
Server [IngestPassengerJob]: job stored as Pending (BookingSource:'Website')
  paymentStatus: '' (not yet paid)
  ↓
Auto-dispatch cycle: job arrives in dt1 from AutoDispatchVehiclesallride
  ↓
Client-side gate:
  src = job.BookingSource.toLowerCase()  // 'website'
  paid = job.paymentStatus              // ''
  → SKIP (logged: "Skipping web job — payment not confirmed")
  ↓
Stripe payment completes:
  POST /api/stripe/webhook (checkout.session.completed)
  OR POST /api/payment/confirm
    ↓
    jobStore find → job.paymentStatus = 'paid'
    Firebase pendingjobs/{cid}/{id} → { paymentStatus:'paid', Status:'Pending', ... }
    Firebase allbookings/{cid}/{id} → { paymentStatus:'paid', Status:'Pending', ... }
  ↓
Next auto-dispatch cycle (within 10s):
  job.paymentStatus = 'paid' → PASS gate → driver offered
```

---

## 16. Key Data Structures

### Job object in `jobStore`

```js
{
  Id:              6206112605076,        // numeric
  BookingStatus:   'Pending',            // state machine value
  companyId:       '620611',
  DriverId:        0,                    // 0 = unassigned
  VehicleId:       0,
  VehicleNo:       'TAXI02',
  CallSign:        'TAXI02',
  Name:            'Jane Doe',
  PhoneNo:         '021000111',
  PickAddress:     '120 Esk Street',
  DropAddress:     'Southland Hospital',
  PickLatLng:      '-46.4132,168.3538',
  DropLatLng:      '-46.4260,168.3380',
  BookingDateTime: '2026-05-07 14:30.',  // trailing dot = NZ convention
  Pickingtime:     '2026-05-07 14:30.',
  BookingSource:   'Website',            // 'Dispatcher' | 'Website' | 'passenger' | 'Hail'
  serviceType:     'taxi',               // 'taxi' | 'food' | 'freight'
  VehicleType:     'Sedan',
  Passengers:      1,
  Bags:            0,
  DispatchTimebefore: '0',              // minutes before pickup (pre-book)
  NotifyDispatchAt:   null,             // ISO timestamp (scheduled jobs)
  paymentStatus:   'paid',              // '' | 'paid' | 'completed'
  paymentMethod:   'card',             // 'card' | 'cash'
  PaymentMethod:   'card',             // both cases written by webhook/confirm
  PaymentType:     '',                 // TM-specific: 'total_mobility'
  stripeChargeId:  'ch_xxx',
  Recieve_payment: '',                 // legacy TM cash field
  UserFName:       'Jane',
  UserLName:       'Doe',
  offeredAt:       1715074200000,      // ms, for stale-offer watchdog
  AcceptedAt:      '2026-05-07T...',
  ActiveAt:        '2026-05-07T...',
  JobCompleteTime: '2026-05-07T...',
  completedAtMs:   1715074800000,
  returnReason:    'No Response',      // badge shown in U-A tab
  booking_type:    'Hail',
  rentalRequestId: null,               // set for ride-to-rental jobs
  // TM fields:
  tmSubsidy: 12, tmPassengerPays: 3, councilId: 'INV',
  _fbKey:    '6206112605076',          // Firebase key (passenger/web jobs)
}
```

### ZONE_DRIVERS entry

```js
{
  driverid:      1212,              // SQL driverid — Firebase /notification/{driverid}
  VehicleId:     'TAXI02',          // Firebase vehicleId key
  vehiclenumber: 'TAXI02',
  drivername:    'John Smith',
  vehicletype:   'Sedan',
  vehiclestatus: 'Available',       // Available | Busy | Away | Assigned | Picking
  zonename:      'Invercargill',
  zoneid:        'INV01',
  zonequeue:     3,                 // position in zone queue (1 = front)
  queueWaitSince: 1715074800000,
  lat:           '-46.4132',
  lng:           '168.3538',
  companyId:     '620611',
  PlayerId:      '1212',            // legacy Firebase path ID
  jobpickup:     '',               // shown in zone table when on job
  jobdropoff:    '',
  JobphoneNo:    '',
  jobCount:      0,
}
```

### `_dscCompletedJob` (returned from `[DriverStatusChanged]`)

```js
{
  tripId, bookingId, bookingRef, companyId,
  driverId, driverName, vehicleId, vehicleNo,
  fare:          18.50,
  paymentType:   'card',    // resolved from PaymentType||paymentType||PaymentMethod||paymentMethod||'cash'
  paymentMethod: 'card',    // same
  paymentStatus: 'paid',
  stripeChargeId: 'ch_xxx',
  completedAt:   1715074800000,
  status:        'Completed',
  source:        'dispatch',
  pickup, dropoff, pickupAddress, dropAddress, distanceKm,
  // TM only:
  tmSubsidy, tmSubsidyHoist, tmPassengerPays, totalCouncilPays, councilId
}
```

---

## Quick Reference: Which function calls which server action

| UI action | Client function | Server action |
|---|---|---|
| Auto-dispatch tick | `smartAutoDispatch()` | `AutoDispatchVehiclesallride` |
| Send offer to driver | `acknowledgemethodx()` | `[changeriddestatusforoffer]` (ridestatus=Offered) |
| Driver accepts | `_resolveAcceptance()` | `[AssignJobStatusFromJobList]` or `[QueueJob]` |
| Driver rejects/timeout | `convertstatus()` / `convertstatus1()` | `[changeriddestatusforoffer]` (ridestatus=Pending) |
| Driver no-response | `convertstatus1()` | `[changeriddestatusforoffer]` (ridestatus=Unreached) |
| Manual assign | drag-drop → AJAX | `[AssignJobStatusFromJobListv2]` |
| Manual unassign | Recall button | `[changeriddestatusforoffer]` (ridestatus=Pending, manually unassigned) |
| Cancel unassigned | Cancel button | `[CancelUnAssignedJobStatusFromJobList]` |
| Driver heartbeat | Firebase child_added/changed | `[DriverStatusChanged]` |
| Queue Busy driver | `_resolveAcceptance(mustQueue)` | `[QueueJob]` |
| Recall queued job | Queued-recall watcher | `[RecallQueuedJob]` |
| Job status gate | Before dispatch | `checkriddestatusforoffer` |
| Force driver online | Dev/test | `[BwForceDriver]` |
| Fetch all jobs | `getjobs()` | `[UnAssignedJobsv3]` |
| Fetch assigned | `AssignedJobs()` | `[AssignedJobsv2]` |
| Fetch active | `ActiveJobsdata()` | `[ActiveJobsv3]` |
| Fetch queued | `getQueuedJobs()` | `[GetQueuedJobs]` |
| Get zone data | Init | `ZoneCoordinates` + `VehiclesStatus` |

---

*Generated from BookaWaka codebase — `server.js` (7,074 lines) + `Default.aspx` (22,548 lines)*  
*Last updated: 2026-05-07*
