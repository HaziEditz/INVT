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

## Architecture decisions

- **Real-backend proxy with in-memory fallback**: All DataManager POST requests are first proxied to the live `taxitime.co.nz` ASP.NET backend. A fallback to an in-memory mock occurs for specific custom actions, proxy errors/timeouts, or non-JSON/non-200 responses.
- **Multi-tenancy via signed session cookies**: `BW_SID` HttpOnly signed session cookie enables per-company data isolation, with all in-memory stores filtered by `sessionCompanyId`.
- **Firebase for real-time data**: Used for driver locations, emergency alerts, and real-time messaging, with specific `online/{companyId}/{vehicleId}/current` and `jobs/{companyId}/{vehicleId}/{driverId}` paths for driver presence and job acceptance.
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

## §FIX-DA-G2 — Booking-keyed `jobs/{cid}/{vid}/{drv}/{bookingId}` children (May 2026)

- Final piece of the driver-app contract. Old shape was `jobs/{cid}/{vid}/{drv}` — a single-slot envelope keyed by driver, which meant any write touching that node could clobber a sibling booking the same driver was holding. Every cancel/edit/clear site needed a TOCTOU/ETag dance to refuse cross-booking overwrites (§FIX-Q, §FIX-D/Q, §FIX-UB's pre-read guard, `_bwClearJobFromFirebase`'s ETag-conditional DELETE, `§FIX-OfferClear`'s GET-then-DELETE).
- Direct cutover — no install base to dual-write for (just owner's two test phones on cid 620611). New shape: each booking lives under its own child key `jobs/{cid}/{vid}/{drv}/{bookingId}`.
- Driver-app contract (answers to their 5 G2 questions):
  - Q1 path = `jobs/{cid}/{vid}/{drv}/{bookingId}` (booking-keyed children of the driver node).
  - Q2 flag = none (direct cutover).
  - Q3 window = none (direct cutover).
  - Q4 atomicity = dispatch only ever writes a single child node — never rewrites the parent. Driver app's `onChildChanged` fires once per real change.
  - Q5 terminal transitions = `remove()` the child node; driver app reacts on `onChildRemoved`. No `Status:Cancelled`/`Status:Completed` tombstones on the active jobs node — terminal state is communicated by `notification/{drv}.eventType` instead. `bookingEvents/{cid}/{bookingId}` is the audit trail.
- 7 server.js sites converted, all the cross-booking guards deleted:
  - `_bwClearJobFromFirebase()` (~640) — ~40-line ETag-guarded GET/DELETE collapsed to a direct child DELETE.
  - `_writeCancelNotify()` (~774) — `fbCompareAndSet` replaced with direct child DELETE.
  - `updateBooking()` §FIX-UB live-patch (~1170) — pre-read + cross-booking guard removed; direct child PATCH.
  - `[ProcUpdateJobv6]` §FIX-D/Q cancel-notify (~6473) — `fbCompareAndSet` replaced with child DELETE.
  - `[ProcUpdateJobv6]` mirror PATCH (~6665) — parent PATCH replaced with child PATCH.
  - `[UnAssignJobStatusFromJobList]` §FIX-Q (~6883) — `fbCompareAndSet` replaced with child DELETE.
  - `§FIX-OfferClear` (~10727) — GET-then-DELETE replaced with direct child DELETE.
- 9 Default.aspx (dispatch console UI) sites converted in same pass:
  - `addNotification` scan-all cancel (~8490) — `set({Status:'Cancelled'})` replaced with `child(BookingId).remove()` per Q5.
  - `writeJobDetailsToFirebase` offer write (~8821/8845) — `set()` now targets `jobs/{cid}/{vid}/{drv}/{bookingId}`; the obsolete "driver may be on another job" pre-read warning was deleted (booking-keyed children make it impossible to clobber).
  - `_cleanupOrphanedFirebase` (~9143) — orphan `remove()` targets the booking child.
  - `resolveAfter2Secondsx` listener (~9380) — `.on('value')` now listens on the booking child directly.
  - `resolveAfter2Secondsx` offline-sync complete (~9401) — `remove()` targets the booking child.
  - `resolveAfter2Secondsx` 27-s timeout diag (~9654) + Unreached remove (~9697) — both target the booking child.
  - `resolveAfter2Seconds` (twin handler) root scanner (~9765) — uses `driverSnap.child(bookingId).val()` instead of treating the driver node as the booking object; also gated on `driverSnap.key === _fbd` so stale DriverAccepted entries on OTHER drivers can no longer prematurely settle this offer.
  - `_watchBusyDriverAcceptance` pre-queue listener (~10092) — now listens on the booking child; payload `BookingId` comparison dropped (path already booking-scoped).
- Stripped driver-level state writes off the `jobs/` path entirely (they were never supposed to be there — duplicate of `online/`):
  - 5 sites (~9824/9877/9939 reject branches, ~10760 zonequeue cvt, ~12608 zonequeue Available) — deleted `update({vehiclestatus:'Away'})` / `update({zonequeue:N})` on the jobs path.
  - 1 site (~12378) — deleted `remove()` of `jobs/{cid}/{vid}/{drv}` when driver goes Available (would have clobbered every booking child).
- `fbCompareAndSet` helper is still defined but no longer called for the `jobs/` path — kept in case any future need arises but effectively obsolete with G2 in place.
- Driver-app side: same cutover day. Driver app must (a) attach `onChildAdded`/`onChildChanged`/`onChildRemoved` listeners on `jobs/{cid}/{vid}/{drv}` (parent node), (b) treat `onChildRemoved` as the terminal-state signal, (c) drop any logic that relied on a single-slot envelope.
- Out-of-scope follow-ups (intentionally left): the flat compatibility write at `jobs/{cid}/{bookingId}` (server.js ~3910 / Default.aspx ~9226) is a separate path some older driver-app builds read on restart — leave alone until you confirm no client depends on it. Smoke test for concurrent-offer + stale-cross-driver scanner scoping is not automated yet; covered manually with the two test phones.

## §FIX-DA — Driver-app public contract (G4 + G5 + G6) (May 2026)

- Companion to §FIX-UB / §FIX-CB. The internal `bookingEvents/{cid}/{bookingId}` stream + rich `type` enum stays untouched; this fix ADDS a thinner, stable public contract that the driver app subscribes to. G2 (`pendingjobs` dual-write to keep legacy `book_now/cancel/sendmessage` paths alive) is deferred.
- **G4 — 6-value `eventType` enum** (server.js ~1091): new `_ubMapEventType(internalType)` collapses every internal type to one of `new_offer | updated | cancelled | reassigned | completed | recalled`. All field-level change types (`PickupChanged`, `FareChanged`, `StopAdded`, etc.) map to `updated` — driver app re-reads the booking node when it sees this; the rich diff is still on `bookingEvents` for HQ/audit.
- **G5 — `version` + serverTimestamp `updatedAt`** (server.js ~1108): new `_FB_SERVER_TIMESTAMP = {'.sv':'timestamp'}` sentinel. Every booking write now carries `version` (= `updateSeq`, monotonic per booking) and `updatedAt` (= Firebase server clock, immune to device skew). Applied to:
  - `updateBooking()` `pendingjobs/{cid}/{bookingId}` + `allbookings/{cid}/{bookingId}` PATCH (~1184).
  - `updateBooking()` `notification/{drv}` PATCH (~1234).
  - `_writeCancelNotify(cid, vehId, drvId, bookingId, cancelledBy, opts)` — accepts `{recalled, version}` and emits `eventType: 'recalled'|'cancelled'` (~789). `cancelBooking()` passes `{recalled:!!recallToPending, version:job.updateSeq}` (~970).
  - `[ProcUpdateJobv6]` §FIX-UB block (~6647 / ~6672) — mirror PATCH + notification both carry the new fields.
  - Inline §FIX-D/Q cancel-notify in `[ProcUpdateJobv6]` (~6433) and §FIX-Q in `[UnAssignJobStatusFromJobList]` (~6842) — both emit `eventType:'cancelled'` + version + sentinel.
- **G6 — `GET /api/driver/active-bookings` reconnect endpoint** (server.js ~5234): driver app calls this on every `.info/connected → true` transition to reconcile its in-memory `jobs[]` against dispatch's source of truth. Auth model: `X-User-Key` header (the driver's `passforlink`) matched against `ZONE_DRIVERS[].passforlink|userKey|UserKey`; falls back to `X-Admin-Key` + `?driverId=` for server-to-server / testing. **`companyId` and `vehicleId` are derived from the driver record on the server**, never trusted from query params — prevents a leaked key from probing a different tenant. Returns `{ok, driverId, companyId, vehicleId, bookings:[{bookingId, status, version, updatedAt, jobBookingSrc, passengerName, passengerPhone, pickupAddress, dropAddress, fare, paymentType, wheelchair, passengers, notes}], fetchedAt}`. Status is mapped to the driver-app's 3-bucket enum (`offered | queued | current`).
- Backward compatibility: internal fields (`type`, `seq`, `_seq`, `lastUpdatedAt`, `bookingEvents`) all remain — public fields are additive. Existing dispatch console listeners are unaffected.

## §FIX-UB — Unified booking update lifecycle (May 2026)

- Companion to §FIX-CB. Same problem shape on the edit side: `[ProcUpdateJobv6]` blanket-PATCHed every editable field to `pendingjobs/`, `allbookings/`, and `jobs/{cid}/{vid}/{drv}` whenever ANY field changed — driver app couldn't tell what changed, no explicit lifecycle events, no race protection against a concurrent §FIX-CB cancel, and the `jobs/{cid}/{vid}/{drv}` path is keyed by driver (not booking) so an edit to Job B could overwrite Job A's fields when the same driver held both.
- Fix (server.js ~970-1170): new helper `updateBooking({bookingId, changes, by, ifSeq?, source})` plus three supporting helpers —
  - `_diffJobChanges(job, changes)` — string-normalized field-level diff. `"10"` vs `10` does not count as a change. Returns `{field: {from, to}}`.
  - `_classifyDiff(diff)` — maps the diff to one or more semantic event types: `PickupChanged`, `DropoffChanged`, `StopAdded`, `PassengerNoteChanged`, `PassengerInfoChanged`, `FareChanged`, `ScheduleChanged`, and generic `JobUpdated` for anything else. Driver app subscribes to the event stream and updates only the affected booking card.
  - `_writeBookingEvent(cid, bookingId, type, diff, by, seq)` — pushes one record under `bookingEvents/{cid}/{bookingId}/{push-id}` and trims to last 50 (`_trimBookingEvents`).
  - `updateBooking()` — refuses if job is already in `closedJobStore` (returns `{ok:false, closed:true}`); race-checks `ifSeq` against `job.updateSeq` (returns `{ok:false, stale:true, currentSeq}` on mismatch); diffs incoming changes (empty diff → idempotent no-op); applies diff, bumps `updateSeq`, stamps `lastUpdatedAt/lastUpdatedBy`; writes one `bookingEvents` record per classified type; sends `notification/{drv}` carrying `{type, seq, bookingId}` only when the booking is currently driver-visible (`Offered|Assigned|Picking|OnTrip|Active|Queued`).
- §FIX-CB interlock: `cancelBooking()` now also bumps `updateSeq` before applying changes and writes a `BookingCancelled` (or `BookingRecalled` for the recall path) event on the same `bookingEvents` stream. Any in-flight `updateBooking()` PATCH using a stale `ifSeq` is rejected with HTTP 409 — closes the resurrect-cancelled-job race.
- Refactor of `[ProcUpdateJobv6]` (~6260): kept the existing blanket-PATCH flow as a compatibility shim for legacy listeners, but added §FIX-UB classification + `bookingEvents` writes + targeted driver notification immediately after the Firebase mirror. The pre-existing §FIX-A / §FIX-A2 / §FIX-D / §FIX-O guards still run first so they decide the post-edit `BookingStatus` before the diff fires.
- New REST endpoint `POST /api/booking/update` (~4858) — body `{bookingId, changes:{...}, ifSeq?, by: dispatcher|passenger|website}`. Dispatcher session + cross-tenant 403; others require `X-Admin-Key`. Stale `ifSeq` → HTTP 409 with `currentSeq` so the caller can refresh and retry. Closed-job → HTTP 410. Empty-diff → 200 `{idempotent:true}`.
- Driver-app contract (hand-off in DRIVER_APP_HANDOFF.md): listen on `bookingEvents/{cid}/{bookingId}` for granular updates; treat `notification/{drv}.type` + `.seq` as a refresh hint, not a state reset; preserve unrelated active trips when an edit lands on a different booking. `pendingjobs/{cid}/{bookingId}._seq` becomes the source-of-truth version number.

## §FIX-CB — Unified `cancelBooking()` flow (May 2026)

- Problem: cancel/recall/no-accept logic was duplicated across 6+ handlers (`[CancelJobStatusFromJobList]` DP+DS, `[CancelUnAssignedJobStatusFromJobList]`, IngestPassengerJob/Cancelled, `isDriverPostAcceptCancel` DP+DS) with subtle drift — each one rebuilt the queue restore / awayLock / Firebase cleanup inline. Worse, recall/Unreached always assumed the driver was free, so a driver holding Job A in `Assigned` who had Job B time out as `Unreached` would lose Job A's `vehiclestatus='Assigned'` to a forced `Available` write.
- Fix (server.js ~758-955): four new helpers backing one front door —
  - `driverHasRemainingAssignments(driverId, excludeBookingId, companyId)` — true if any job in `jobStore` other than `excludeBookingId` references that driver and is in `Offered|Assigned|Picking|OnTrip|Active`. Multi-tenant safe (filters by `companyId`).
  - `_writeCancelNotify(cid, vehId, drvId, bookingId, cancelledBy)` — factored §FIX-Q ETag-guarded `jobs/{cid}/{vid}/{drv}` cancel + `notification/{drv}` Job Cancel write. Per-booking via `fbCompareAndSet`.
  - `_maybeRestoreDriverState(driverId, companyId, driverFault, vehicleId, bookingId)` — gated by `driverHasRemainingAssignments`. If none remain: restore queue + set `vehiclestatus='Available'` (or `'Away' + setAwayLock` when `driverFault`), patch `online/{cid}/{vid}/current` clearing in-trip fields. If remaining: no-op, returns `{driverFreed:false}`.
  - `cancelBooking({bookingId, cancelledBy, reason, driverFault, recallToPending, companyId, source})` — idempotency check (returns `{ok:true, idempotent:true}` if already in `closedJobStore` as Cancelled); snapshot fields (`CancelledBy`, `CancelStage`, `CancelReason`, `CancelledAt`, `PaymentMethod`, `AssignedDriverId`, `AssignedVehicleId`, `FareSnapshot`, `DistanceSnapshot`); recall branch (`recallToPending=true`) sets `BookingStatus='Pending'`, `returnReason='Recalled by Driver'`, stamps `releasedAt` cooldown, keeps job in jobStore; close branch moves to `closedJobStore`. Then calls `_maybeRestoreDriverState`, `_writeCancelNotify`, `_bwClearJobFromFirebase`. Logs `[cancelBooking] booking=… source=… driverFault=… recall=…` + result.
- Refactored call sites (6): all the cancel-equivalent handlers now delegate to `cancelBooking()`. Driver post-accept paths split on current status — `Picking` → close (`driverFault:true, recallToPending:false`); `Assigned` → recall (`driverFault:true, recallToPending:true`). Passenger/website IngestPassengerJob Cancelled no longer has the "dispatcher must handle" skip — helper closes Assigned/Picking jobs correctly.
- Per-driver-not-per-booking guard: §FIX-CB also gates the `releaseStatuses` Unreached/No-Accept branches in `[changeriddestatusforoffer]` DP (~6982) and DS (~9051). Before the existing Available/Away fanout fires, we check `driverHasRemainingAssignments` — if the driver holds another active job, we **skip** the `zd.vehiclestatus` write, the `setAwayLock`, and the `jobpickup/jobdropoff/JobphoneNo` clears. The job-side state (Pending+releasedAt or No One per §FIX-M) still applies. Diagnostic `§FIX-CB driver X keeps state (has remaining active assignment)`.
- New REST endpoint `POST /api/cancel` (~4858) — body `{bookingId, cancelledBy, reason?}` where `cancelledBy ∈ {passenger,driver,dispatcher,website}`. Dispatcher source uses session cookie; other sources require `X-Admin-Key` header. Idempotent — double-POSTs return `{ok:true, idempotent:true}`. Driver source via REST is treated as `Assigned`-recall semantics; legacy DataProcessor endpoint still handles Picking-state driver cancels.
- Phase 2 (not in this fix): booking-level update events (JobUpdated/StopAdded/PickupChanged/etc.) and the matching driver-app refresh contract — separate refactor of edit/`ProcUpdateJobv6` paths.

## Older fixes

Earlier fix entries (§FIX-Q, §FIX-P, §FIX-O, §FIX-N, §FIX-F2, §FIX-M, §FIX-U2, §FIX-W, §FIX-V, §FIX-A2, §FIX-A, §FIX-R) have been moved to `FIX_HISTORY.md` to keep this file lean. Consult that file before changing any code area covered by those fixes.

## User preferences

- _Populate as you build_

## Gotchas

- **Firebase Rules Deployment**: After any changes to `database.rules.json`, run `firebase deploy --only database`. Otherwise, Firebase writes might fail with `permission_denied`.
- **Driver Visibility**: `driverdatarealx` is populated exclusively from Firebase. Without a live driver app session, the zone table and driver lists will be empty.
- **Server Restart Impact**: In-memory job stores and driver zone assignments reset on server restart unless persisted. `suspended_drivers.json` and `zone_assignments.json` mitigate some of this.
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