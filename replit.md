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

## §FIX-F2 — Assign-tab "No One" used string-vs-number coercion (May 2026)

- Root cause: `[UnAssignJobStatusFromJobList]` (`server.js` ~5953) used `const prevDriverId = job.DriverId || 0; job.BookingStatus = prevDriverId > 0 ? 'No One' : 'Pending';`. For tenants whose `DriverId` is a string like `"D002"`, `"D002" > 0` coerces to `NaN > 0 === false`, so the handler demoted Assigned jobs to `Pending` (not `No One`) on dispatcher "take to No One". Auto-dispatch then immediately re-offered the same job to the same driver. The §FIX-G `releasedAt` cooldown was gated on the same broken check and never armed.
- Fix (~5957-5972): stringify+trim `prevDriverId`; set `_hadDriver = _prevDrvStr !== '' && _prevDrvStr !== '0' && _prevDrvStr !== '-1'`; gate both `BookingStatus = 'No One'` and the `releasedAt` cooldown on `_hadDriver`. Added diagnostic `[UnAssignJobStatusFromJobList] §FIX-F2 ... hadDriver=... → BookingStatus='...'`.
- Numeric IDs still work: `5` and `'5'` both yield `hadDriver=true`; `0/'0'/-1/'-1'/''` yield `hadDriver=false`.

## §FIX-U2 — Unreached timeout → Pending + releasedAt cooldown (May 2026)

- Reverted policy: the original §FIX-U made Unreached → 'No One', which broke the auto-dispatch retry loop. Correct behaviour: Unreached on an auto-dispatched job should go back to 'Pending' so auto-dispatch can offer to the **next** driver; the existing §FIX-G `releasedAt` 30 s cooldown (server.js ~8030 — `if (Date.now() - j.releasedAt) < 30000) return false`) prevents the same driver being re-offered immediately.
- Fix (`server.js` ~6567 + ~8673): `effectiveStatus = newStatus === 'Unreached' ? 'Pending' : newStatus`, and when `newStatus === 'Unreached'` also stamp `job.releasedAt = Date.now()` with diagnostic `[§FIX-U2/...] Unreached → Pending + releasedAt stamped`.
- Manual-dispatcher "take to No One" path is unchanged — it still routes through `[UnAssignJobStatusFromJobList]` (§FIX-F2) which sets `BookingStatus='No One'`. So: auto-timeout → Pending+cooldown (auto retries other drivers); manual unassign → No One (dispatcher controls).

## §FIX-V — Manual reassign now writes to correct Firebase path (May 2026)

- Bug: `$scope.AssignJobFromJobList` (`Default.aspx` ~13889) called `writeJobDetailsToFirebase(_vid, _vid, _bid, …)` and `acknowledgemethodx(JobVehicleId, JobVehicleId, …)` — passing the dropdown value as **both** driverId and vehicleId. For string-ID tenants (dropdown returns `D002`), this wrote the Offered payload to `jobs/620611/D002/D002` while the driver app listens on `jobs/620611/TAXI02/D002`. Driver popup never showed → 27 s timeout → §FIX-U-or-Pending demote → loop.
- Fix (`Default.aspx` ~13891-13970): pre-resolve `_resolvedDrv` / `_resolvedVeh` by scanning `scope.driverdatarealx` for a row whose `driverid` OR `VehicleId` matches the dropdown value. Pass the correct pair to both helpers in the documented argument order (`writeJobDetailsToFirebase(driverId, vehicleId, …)` and `acknowledgemethodx(vehicle, driverid, …)`). Falls back to `JobVehicleId` as both when no match is found, so numeric-tenant behaviour is preserved. Diagnostic log `[§FIX-V/AssignJobFromJobList] dropdown=… → driver=… vehicle=…` surfaces the resolution.

## §FIX-A2 — Edit-form "back to Pending" path restored (May 2026)

- Bug: `§FIX-A` accidentally blocked the dispatcher's legitimate Edit-form action of sending a No-One job back to `Pending` (Edit dropdown sends `DriveId='0'` + `bookstatus='Pending'` when `$scope.selecteddriver === -2`).
- Fix (`server.js` ~5669-5694): new `_explicitPending = (driverId <= 0) && (_clientBookstatus === 'Pending')` flag added to the §FIX-A guard whitelist (`!_explicitNoOne && !_explicitPending`), plus a new explicit-Pending branch that sets `VehicleId=0`, `DriverId=0`, `BookingStatus='Pending'` with a `§FIX-A2` diagnostic log.
- `_explicitPending` is gated on `driverId <= 0`, so a payload with a real driver picked (`driverId > 0`) and `bookstatus='Pending'` still falls into the normal `Offered` arm — the driver pick wins. Malformed `DId=0 + bookstatus='Offered'` is still BLOCKED by §FIX-A.

## §FIX-A — No One → Pending silent demote blocked (May 2026)

- Root cause: dispatch console Edit form (`Default.aspx` `updateride` ~13966) emits malformed reassign POSTs to `ProcUpdateJobv6` in two observed shapes: (1) `DId=-2` + `bookstatus='Pending'` (when `$scope.selecteddriver === -2`), (2) `DId` missing/`0` + `bookstatus='Offered'` (when `$scope.selecteddriver === 0` or undefined). Server parsed both as `driverId=0`, fell into the `editableStatuses` branch's `else` arm, and set `BookingStatus='Pending'` — silently demoting `No One` jobs.
- Fix lives entirely server-side at `server.js` ~5671-5693. New guard: if `prevStatus === 'No One' && parsedDriverId <= 0 && !_explicitNoOne`, leave `BookingStatus / DriverId / VehicleId` unchanged and log `[§FIX-A/ProcUpdateJobv6] *** BLOCKED No One → Pending demote ***` with the incoming payload. Other edit fields (Name, Notes, DateTime, Pick/Drop, tariff, etc.) still apply normally.
- Legitimate paths preserved: explicit unassign (`DId=-1 + bookstatus='No One'`) still hits the existing `driverId === -1 => 'No One'` arm; real driver pick (`driverId > 0`) still goes through the `'Offered'` arm.
- Frontend left untouched: four `DId`-emitting sites in `Default.aspx` (updateride 14118, addjob 14617, addjob2 14782, updateride2 20372) have multiple entry points (ASAP / later / ACC / account / web). The server guard catches all of them and the BLOCKED log surfaces which frontend path triggers each malformed POST for follow-up.

## §FIX-R — OTA-22be audit payload consumed (May 2026)

- `_sotExtractAuditFields(summary)` in `server.js` (~line 3996) defensively pulls the new HQ fields out of every `/api/syncOfflineTrip` POST: `WaitingTime` / `WaitingCost` / `WaitingIntervals`, `TariffLog` + `CurrentTariffId/Name`, `pauseLog`, `BookingType`, `TripSource`, `DriverNote`, `TripIssueFlag/Note`, `FixedPrice` / `CustomTotal` / `PriceOverride*`, payment sub-fields (`TmVoucherNo`, `AccClaimNo`, `GiftCardCode`, `StripeIntent`, `PaymentSettled`, `PaymentSplits`).
- Helper called from both syncOfflineTrip paths (live + `§FIX-L` late-merge) — live path stamps wins, late-merge fills-if-empty.
- Root-level `runtimeVersion` / `groupId` / `platform` are persisted as `AppVersion` / `AppBuild` / `Platform` so HQ's "which OTA?" questions resolve from the closed-job record.
- Diagnostic log `[§FIX-R/diag] summary keys=[…] payment keys=[…]` fires on every sync so unknown HQ field names surface in workflow logs.
- Frontend `Default.aspx` `jdpBuildFare` (~23224) renders new rows: Waiting Time, Booking Type, Tariff Changes (chronological), Payment Details (voucher / claim / gift / Stripe / settled badge / splits), Fare Override, Driver Note, Trip Issue.
- Take Payment button hide logic (`§FIX-P`) now honours `j.PaymentSettled === true` regardless of payment method.

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