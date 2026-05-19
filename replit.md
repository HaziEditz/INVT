# BookaWaka — Taxi Dispatch System

A web-based Taxi Dispatch System providing a real-time dispatch console for managing taxi bookings, vehicles, and drivers, styled as a professional Uber/Bolt-style dashboard.

## Run & Operate

- Run: `node server.js`
- Required Environment Variables:
    - `BW_ADMIN_KEY`: (Default: `bookawaka-admin-2026`) Admin key for Super Admin API access.
    - `BW_FIREBASE_SECRET`: Firebase DB Legacy Secret (bypasses Firebase rules for server-side writes).
    - `TZ`: `Pacific/Auckland` (Set at top of `server.js` for correct local time operations).

## Stack

- Frontend: HTML5, CSS3, Bootstrap 4.1.3, jQuery 3.5.1, AngularJS 1.6.9
- Real-time: Firebase Realtime Database
- Mapping: Google Maps JavaScript API
- Payments: Stripe v2
- Utilities: jsPDF, SweetAlert2, toastr, DataTables
- Backend: Node.js (plain JavaScript)

## Where things live

- `server.js`: Node.js HTTP server, main entry point.
- `taxitime.co.nz/Dispatchthree/Default.aspx`: Main dispatch console UI (AngularJS frontend).
- `taxitime.co.nz/Dispatchthree/DispatcherLogin.aspx`: Login and account request page.
- `taxitime.co.nz/Dispatchthree/DataManager/AjaxHandler.js`: AJAX wrapper functions.
- `database.rules.json`: Firebase Realtime Database security rules (requires deployment: `firebase deploy --only database`).
- `.data/registrationRequests.json`: Stores pending account registration requests.
- `.data/suspended_drivers.json`: Persists suspended driver information across server restarts.
- `.data/zone_assignments.json`: Persists driver zone assignments across server restarts.
- `MULTITENANCY_SPEC.md`: Full multi-tenancy specification for related services.
- `DRIVER_APP_REQUIREMENTS.md`: Field-by-field spec of what the driver app must transmit (waiting cost, tariff changes, payment splits, fixed price, comments, service-type extras) for the closed-job detail panel to render every dispute-resolution data point.
- `FIX_HISTORY.md`: Archived fix entries (§FIX-CB, §FIX-UB, §FIX-DA, §FIX-DA-G2, and older). Consult before changing code these touched.

## Architecture decisions

- **Real-backend proxy with in-memory fallback**: All DataManager POST requests are first proxied to the live `taxitime.co.nz` ASP.NET backend. A fallback to an in-memory mock occurs for specific custom actions, proxy errors/timeouts, or non-JSON/non-200 responses.
- **Multi-tenancy via signed session cookies**: `BW_SID` HttpOnly signed session cookie enables per-company data isolation, with all in-memory stores filtered by `sessionCompanyId`.
- **Firebase for real-time data**: Used for driver locations, emergency alerts, and real-time messaging, with specific `online/{companyId}/{vehicleId}/current` and `jobs/{companyId}/{vehicleId}/{driverId}/{bookingId}` paths for driver presence and per-booking offer state (booking-keyed children per §FIX-DA-G2).
- **Client-side zone detection**: Uses `google.maps.geometry.poly.containsLocation` to update driver zones based on GPS, ensuring accurate zone queueing even if the driver app doesn't report it.
- **Pre-queue feature for Busy drivers**: Allows Busy (Hail) drivers to accept pending Unassigned jobs silently. This job is queued and automatically assigned when the driver becomes Available, streamlining dispatch for active drivers.

## Product

- Real-time management of taxi bookings, vehicles, and drivers.
- Dispatch console with an Uber/Bolt-style dashboard.
- Account registration system with free trial and paid plan options, managed via a Super Admin interface.
- Multi-tenancy support ensures data isolation for each company.
- Real-time driver tracking and status updates via Firebase.
- Comprehensive job lifecycle management: creation, assignment, offer/acceptance, cancellation, completion, and historical tracking.
- Messaging system for dispatch-to-driver, broadcast, group, and driver-to-dispatcher communication.
- Search and filtering capabilities for jobs and drivers.
- Dynamic zone management and driver queueing.
- Accident Compensation (ACC) workflow for client and approval management.
- Driver suspension functionality.
- Support for multiple service types (taxi, restaurant, freight).
- Shared driver identification for drivers working across multiple companies.

## §FIX-GHOST — Pendingjobs DELETE on completion (May 2026)

Bug: completed hail trips lingered on the driver's phone as "ghost Active" cards because `pendingjobs/{cid}/{bookingId}` was only PATCHed to `Status:Completed` on terminal close, never DELETEd. The driver app's pendingjobs listener treats record presence (not the Status field) as authoritative, so the ghost card persisted until the driver manually cancelled or logged out + back in.

Repro confirmed for booking `6112605192` (TAXI02 / D002): hail trip created with `_bwClearJobFromFirebase`-style PATCH on completion. closedJobStore had the booking marked Completed correctly. allbookings had the full record. pendingjobs entry stayed `Status:Completed` for hours; pendingjobs-normalizer kept logging "Kept ... (ID reuse or unknown timestamps)" every 30s because `pendingCreated` couldn't be parsed cleanly. Driver phone kept showing the stale card.

**Fix (server.js ~630 in `_bwClearJobFromFirebase`):** After the existing pendingjobs PATCH (stamps `Status:_final` + `completedAt`/`cancelledAt` for any consumer racing cleanup), follow up with a DELETE of the same `pendingjobs/{cid}/{bookingId}` node. PATCH-then-DELETE preserves the terminal-state snapshot for in-flight listeners and removes the record so the driver app clears the card. Trip history is still preserved in `/allbookings/{cid}/{bookingId}` and the server-side `closedJobStore`. `IngestPassengerJob`'s resurrection guard is unaffected (it only re-creates from `Scheduled`/`Waiting`/`Pending` — a deleted record cannot satisfy any of those).

Applies to every completion/cancellation path (hail, passenger, web, dispatch, ACC, business account) because they all funnel through `_bwClearJobFromFirebase`. One-shot manual cleanup of the stuck `6112605192` Firebase entry was performed at the same time so the driver's app would clear immediately without waiting for another action.

## §STUCK-ACTIVE — Pre-cutover sweeper (May 2026)

One-time admin endpoints for clearing "ghost Active" trips before driver-app 22c cutover (Mon 25 May). The new driver app silently ignores re-broadcasts of completed bookingIds, so pre-OTA stuck Active/Picking/OnTrip trips in HQ won't auto-clean — they must be cleared manually.

- `GET  /admin/stuck-active?cid=620611&olderThanHours=4` — lists in-flight bookings older than threshold (default 4h, min 0.5h). Returns `{ok, count, stuck:[{bookingId, status, companyId, driverId, vehicleId, driverName, callSign, passenger, phone, pickup, dropoff, bookingTime, acceptedAt, ageHours}]}`. Age uses `DriverAcceptedAt` (preferred) then `BookingDateTime`. Cross-tenant safe (no `cid` filter = all companies).
- `POST /admin/stuck-active/clear` body `{bookingId, companyId?, reason?}` — clears one stuck trip via `cancelBooking({cancelledBy:'dispatcher', source:'admin/stuck-active/clear'})`. Idempotent (already-Cancelled returns `{ok:true, idempotent:true}`). `companyId` is optional; if provided it must match the booking's companyId or the request is rejected.
- Both endpoints gated by `X-Admin-Key: <BW_ADMIN_KEY>` under the existing `/admin/` prefix.
- server.js ~4145. Uses the existing §FIX-CB `cancelBooking()` helper — no new lifecycle logic.

## §FIX-HAIL — Pre-assigned hail bookings (May 2026)

Hail trips are created mid-trip by the driver (meter already running, passenger in car). When `/api/job/create` receives `source:'hail'` + `driverId` + `vehicleId`, the booking lands in `BookingStatus:'Active'` with driver pre-attached, `updateSeq=1`, `DriverAcceptedAt` stamped, `VehicleNo`/`CallSign` set to vehicleId. Skips Pending→Offered→Assigned.

**§FIX-HAIL/2 (server.js ~6008):** On hail pre-assigned create, also fan out to the dispatch-visibility paths so the driver popover and pendingjobs board immediately reflect the in-progress trip:
- `ZONE_DRIVERS` in-memory: `BookingId`, `jobpickup`, `jobdropoff`, `JobphoneNo`, `jobname`, `vehiclestatus='Busy'`, `jobCount++` (guarded: skips increment if same BookingId already attached — retry-safe).
- Firebase: `pendingjobs/{cid}/{bid}` + `allbookings/{cid}/{bid}` (full booking shape with status='Active'), `online/{cid}/{vid}/current` PATCH (currentJobId, jobId, joboffer:0, jobpickup, jobdropoff, JobphoneNo, jobname, vehiclestatus:'Busy'). Fire-and-forget; logs each write.
- Emits `BookingCreatedHail` bookingEvent (`{from:'New', to:'Active', source:'hail'}`).

**Driver-app contract:** Hail **complete** MUST use `POST /api/job/command` with `{command:'complete', by:'driver', bookingId, ifVersion:1, payload:{...}}`. Legacy `/api/job/sync-offline-trip` does NOT find Active-state hail bookings and silently fails (app hangs, force-close, ghost-offer popup on relaunch). Driver-app team needs to ship this cutover ahead of the broader 22c lifecycle migration.

## §FIX-CMD — Unified `/api/job/command` (May 2026)

Single front door for every booking lifecycle verb so external apps (passenger, driver app, integrations) only have to integrate one URL. Backward-safe — all existing endpoints (`/api/cancel`, `/api/booking/update`, `/api/driver/active-bookings`, legacy DataProcessor `[AssignJob]` / `[ProcUpdateJobv6]` / etc.) keep working unchanged.

### Endpoint
`POST /api/job/command` — server.js ~5660.

Body: `{bookingId, command, by, payload?, ifVersion?, clientRequestId?}` where:
- `command ∈ {assign, accept, cancel, recall, update, complete}`
- `by ∈ {dispatcher, driver, passenger, website}`

### Auth (three identities)
- `dispatcher` → BW_SID session cookie.
- `driver` → `X-User-Key` header matched against `ZONE_DRIVERS[].passforlink|userKey|UserKey`. Server derives `driverId` + `companyId` from the record; client cannot spoof. Fallback to `X-Admin-Key` + `payload.driverId` for server-to-server / testing.
- `passenger|website` → `X-Admin-Key` header (server-to-server only — do NOT ship in driver app).

Cross-tenant 403 enforced on all three.

### State machine — `_BOOKING_STATE_MACHINE` at server.js ~975 + `_canTransition()`
Allowed transitions:
- `Pending → Assigned/Cancelled`
- `Offered → Assigned/Cancelled/recalled-to-Pending` (also `accept → Assigned`)
- `Assigned → Cancelled/recalled-to-Pending/Completed` (`accept` idempotent re-stamp allowed)
- `Picking|OnTrip|Active → Cancelled/Completed`
- `Queued → Cancelled`
- `No One → Assigned/Cancelled`
- Terminal `Completed`/`Cancelled` allow only idempotent re-runs.

### Helpers (all idempotent, all return `{ok, version, booking, ...}`)
- `assignBooking({bookingId, driverId, vehicleId, by, ifVersion})` — server.js ~1074. Dispatcher-initiated offer. `manualOffer` flag preserved for legacy Take-to-No-One timeout semantics when `by==='dispatcher'`. Idempotent on assigned-to-same-driver. Emits `OfferSent` bookingEvent + `notification/{drv}.eventType:'new_offer'`.
- `acceptBooking({bookingId, driverId, by, ifVersion})` — server.js ~1278. Driver confirms an offer. Stamps `DriverAcceptedAt`. Driver-attribution check rejects accept-by-wrong-driver. Idempotent on re-tap. Emits `OfferAccepted` bookingEvent.
- `cancelBooking({bookingId, cancelledBy, reason, driverFault, recallToPending, ifVersion, ...})` — server.js ~836 (§FIX-CB). `cancel` = hard close, `recall` = return to Pending with `releasedAt` cooldown.
- `completeBooking({bookingId, fare, distance, payload, by, ifVersion})` — server.js ~1162. Accepts a whitelisted ~30-field payload (tariffId, waitingCost, extras, voucherCode/tmVoucher, ACC fields, paymentSplit, stripeChargeId, finalDropAddress, GST/tips/tolls/parking, etc.). Moves to closedJobStore. Restores driver state via `_maybeRestoreDriverState` (respects remaining-assignments rule). Emits `BookingCompleted` event + `eventType:'completed'`.
- `updateBooking()` — §FIX-UB, unchanged.

### Optimistic concurrency (`ifVersion`)
All commands accept optional `ifVersion` (or legacy `ifSeq`). If sent and ≠ current `updateSeq`, returns `{ok:false, error_code:'version_conflict', currentVersion, booking}` with HTTP 409. Caller rolls forward to `currentVersion` and retries.

### Request-level idempotency (`clientRequestId`)
Body `clientRequestId` (or `Idempotency-Key` header) → 10-min in-memory cache keyed by `(by, bookingId, command, clientRequestId)` (server.js ~988 `_CMD_DEDUP`). Retry returns the same response with added `dedup:true` flag. 2xx, 409, 410 responses are cached; 4xx auth/bad_request are NOT (those re-evaluate). Soft ceiling 5000 entries with lazy TTL sweep.

### Structured response (success and error)
Success: `{ok:true, idempotent?, status, version, booking:{bookingId, status, version, updatedAt, driverId, vehicleId, passengerName, passengerPhone, pickupAddress, dropAddress, fare, distance, paymentMethod, notes, bookingSource}, ...verb-specific}`.

Errors: `{ok:false, error_code, error, booking?, currentVersion?, currentStatus?}` with stable `error_code` values:

| error_code | HTTP | Caller reaction |
|---|---|---|
| `bad_request` | 400 | Client bug, do not retry |
| `auth_failed` | 401 | Force re-login |
| `forbidden` | 403 | Cross-tenant / wrong-driver — do not retry |
| `not_found` | 404 | Drop from local cache |
| `invalid_transition` | 409 | Re-read state and reconcile |
| `version_conflict` | 409 | Roll forward to `currentVersion` |
| `already_terminal` | 410 | Drop from active list |
| `server_error` | 500 | Retry w/ backoff (same clientRequestId) |

### Driver-app contract — 22c cutover plan
- `accept` / `decline (cancel by:driver)` / `complete` → `/api/job/command`. Stop writing `DriverAccepted` / `DriverDeclined` / `completedJobs/` directly.
- Presence (`online/{cid}/{vid}/current` — vehiclestatus, location, OnTheWay/Arrived/MeterOn) → stays direct Firebase write.
- Optimistic UI — flip local state on tap, POST in background, rollback on non-2xx, roll-forward when server version > local version.
- Offline queue: persist on `.info/connected → false`; replay in order with original `clientRequestId` on reconnect; `dedup:true` = success; `version_conflict` = drop+roll-forward; `already_terminal` = drop silently.
- ETA: 3–4 days dev + 1 day soak. Mon 25 → Wed 27 May.

### Phase 2 (deferred)
Dispatch UI (`Default.aspx`, ~24k lines) button refactor — assign/cancel/recall/edit handlers still hit legacy DataProcessor endpoints. New `/api/job/command` is exposed for the driver app + passenger app + future SDKs to consume; UI cutover is a larger Default.aspx pass.

## User preferences

- _Populate as you build_

## Gotchas

- **Firebase Rules Deployment**: After any changes to `database.rules.json`, run `firebase deploy --only database`. Otherwise, Firebase writes might fail with `permission_denied`.
- **Driver Visibility**: `driverdatarealx` is populated exclusively from Firebase. Without a live driver app session, the zone table and driver lists will be empty.
- **Server Restart Impact**: In-memory job stores and driver zone assignments reset on server restart unless persisted. `suspended_drivers.json` and `zone_assignments.json` mitigate some of this. `_CMD_DEDUP` cache also resets — retries that landed pre-restart are NOT deduped post-restart, but state-based idempotency (already-Assigned, already-Completed) still protects against double-mutation.
- **Asynchronous Operations**: `$scope.$digest()` calls need `if (!$scope.$$phase)` guards in AngularJS to prevent "apply already in progress" errors.
- **Driver App Compatibility**: Driver app Firebase contract (paths, fields) must align with the dispatch console's expectations for real-time features to function correctly.
- **Google Maps API Key**: Ensure valid API keys are configured for full mapping functionality.
- **Timezone Configuration**: `process.env.TZ = 'Pacific/Auckland'` must be set at the very top of `server.js` to ensure all server-side timestamps are in NZ local time.

## Pointers

- **Firebase Realtime Database**: [Firebase Docs](https://firebase.google.com/docs/database)
- **Google Maps JavaScript API**: [Google Maps Platform Docs](https://developers.google.com/maps/documentation/javascript)
- **Stripe API**: [Stripe Docs](https://stripe.com/docs/api)
- **AngularJS 1.x**: [AngularJS Docs](https://docs.angularjs.org/api)
- **Node.js File System (fs)**: [Node.js fs Docs](https://nodejs.org/docs/latest/api/fs.html)
- **Multi-tenancy Specification**: `MULTITENANCY_SPEC.md`
