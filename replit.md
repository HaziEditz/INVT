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

## §FIX-Q — Server-side "Job Cancel" notification so driver app clears its screen (May 2026)

- Symptom (post §FIX-P test 1779089184): server-side fixes all fire correctly — §FIX-F2 sets BookingStatus='No One', §FIX-P mirrors `online/{cid}/{vid}/current → vehiclestatus='Available'`, Edit-form save (§FIX-A2/§FIX-O) lands the job at 'Pending' with `releasedAt/manualOffer` cleared. **But the driver app still shows the job on screen, no "job cancel" toast, and auto-dispatch still can't re-offer the job.**
- Root cause: the client quick-action button "Take to No One" on the Assigned tab calls `$scope.AssignJobFromJobList` (`Default.aspx` ~13860 → ~18738). The `JobVehicleId == '0'` branch fires the `[UnAssignJobStatusFromJobList]` POST but **does NOT call `FnCancelRide(driverId, BookingId)`** — unlike the sibling `AssignJobFromJobList2` at ~18810 which does. So neither `jobs/{cid}/{vid}/{drv}` is set to `Cancelled` nor is `notification/{drv}` written. The driver app's `jobs/` listener still sees `Status:'DriverAccepted'` from the earlier accept, keeps the job on screen, and the driver app keeps heart-beating `online/{cid}/{vid}/current.vehiclestatus='Assigned'` — stomping §FIX-P's Available write within ~1-2 s. `driverdatarealx`/`smartAutoDispatch` then sees the driver as still Assigned, filters them out, job sits in Pending forever.
- Fix (server.js, two sites — `[UnAssignJobStatusFromJobList]` ~6080 + §FIX-D explicit-No-One in `ProcUpdateJobv6` ~5756): after the §FIX-P online/current PATCH, also (a) SET `jobs/{cid}/{vid}/{drv}` to `{Status:'Cancelled', BookingId:<id>}` (gated by a GET-and-compare so we don't stomp an unrelated new job on the same driver — only overwrite when the node refs THIS booking or is empty), (b) SET `notification/{drv}` to `{bookingid:'<id>,Job Cancel,<drv>,Server,Dispatcher', content:'Passenger Cancel'}`. Both replicate the client-side `FnCancelRide` flow (`Default.aspx` ~8475) but run server-side so all callers of `[UnAssignJobStatusFromJobList]` and Edit-form explicit-No-One get notified regardless of which client button triggered the unassign.
- Diagnostics: `[UnAssignJobStatusFromJobList] §FIX-Q jobs/.../<drv> → Cancelled (driver notified)` + `§FIX-Q notification/<drv> → Job Cancel written` (and `[ProcUpdateJobv6] §FIX-D/Q ...` for the Edit-form path).
- Safety: the `jobs/{cid}/{vid}/{drv}` SET is **ETag-guarded** via new helper `fbCompareAndSet` (`server.js` ~516). Sequence: GET with `X-Firebase-ETag:true` header → if the node refs a DIFFERENT booking, skip (logs `kept-different refs #X`); otherwise PUT with `If-Match: <etag>` → if Firebase returns 412 the race was lost (a new offer landed mid-flight) and we skip (logs `kept-changed`); otherwise the PUT lands as `set`/`empty-set`. This closes the TOCTOU window between the existence check and the cancel write — if smartAutoDispatch wrote a new offer to the same driver between our GET and PUT, our PUT is refused.
- Known limitations: (1) `notification/{drv}` is a **global** node (no companyId namespace) — for shared drivers across tenants, a cancel from cidA could overwrite a pending notification from cidB. This mirrors the existing client-side `FnCancelRide` behavior and would require driver-app coordination to namespace by `notification/{cid}/{drv}`. Not changed here to avoid breaking the driver-app contract. (2) If the previous driver is no longer in `ZONE_DRIVERS` (e.g. driver app fully offline), `_fbVehId` can't be resolved and the §FIX-Q write doesn't fire — acceptable because the offline driver app can't receive the notification anyway; on next login they'll re-read state.
- Structural choice (option B): putting the notify in the server means client-side fixes aren't required — any path that lands in `[UnAssignJobStatusFromJobList]` (legacy ASP.NET callers included) now cancels properly. Same lesson as §FIX-W: server should be source of truth.

## §FIX-P — Driver presence not mirrored to Firebase after dispatcher unassign (May 2026)

- Symptom: dispatcher takes Assigned job to No One (Assign-tab quick action) → opens Edit form → picks "Pending" → Save. Job moves to Pending tab. AutoDispatchVehiclesallride returns it correctly. **But the client `smartAutoDispatch` never offers it** — no `[smartAutoDispatch] Job #X → driver Y` log. Workaround: driver logs out of the driver app and back in, then the next AD tick offers it correctly.
- Root cause: `[UnAssignJobStatusFromJobList]` (`server.js` ~6001) updates the in-memory `ZONE_DRIVERS` entry to `vehiclestatus='Available'` but **does NOT write that back to Firebase `online/{cid}/{vid}/current`**. The dispatch console's client-side `driverdatarealx` (the array `smartAutoDispatch` filters at `Default.aspx:16409` — `dv.vehiclestatus === 'Available'`) is sourced from that Firebase node, not from any server selector. So even though the server thinks the driver is Available, the client still sees them as `Assigned` (the last value the driver app wrote on accept, `[BW] online/{cid}/{vid}/vehiclestatus → Assigned`). With no Available driver visible to `smartAutoDispatch`, the freshly-Pending job sits forever. Driver logout/login worked because the driver app re-writes the presence record on login.
- Fix (`server.js` ~6014 inside the UnAssign zd-block + `server.js` ~5728 inside §FIX-D's explicit-No-One branch): after restoring `ZONE_DRIVERS` to Available, fire-and-forget patch `online/{companyId}/{vehicleId}/current` with `{ vehiclestatus: 'Available', jobId: '', jobpickup: '', jobdropoff: '', JobphoneNo: '' }` via `getFirebaseServerToken() → firebaseDbPatch(...)`. Diagnostic `[UnAssignJobStatusFromJobList] §FIX-P Firebase online/{cid}/{vid}/current → Available (mirrored)` (and `[ProcUpdateJobv6] §FIX-D/P Firebase ... → Available (mirrored)` for the Edit-form path).
- §FIX-D also gained the missing ZONE_DRIVERS restore (it previously only set `BookingStatus='No One'` and `DriverId=-1` — left the previous driver's `vehiclestatus`/`jobpickup`/etc untouched). Now mirrors the `[UnAssignJobStatusFromJobList]` flow including queue position via `calcRestoredQueue`, away-lock clear, home-state clear, and Firebase mirror.
- Failure modes: Firebase token unavailable → silently no-op (logged); Firebase patch fails → logged but server response still returns success (UI not blocked). Driver app's own writes are not stomped — Firebase patch only touches the five fields above; lat/lng/zonename/timestamp written by the driver app remain authoritative.

## §FIX-O — Explicit "back to Pending" via Edit form delayed by stale releasedAt cooldown (May 2026)

- Symptom: dispatcher takes an Assigned job to No One (Assign-tab quick action), then ~2 s later opens the Edit form, picks "Pending" from the driver dropdown (`$scope.selecteddriver === -2`), Save. Job moves to the Pending tab but auto-dispatch never picks it up — even with a single Available driver. Workaround was driver app logout/login, but that only worked because it masked a separate driver-app dedup bug (see hand-off notes); the underlying server-side delay was still real.
- Root cause: `[UnAssignJobStatusFromJobList]` (§FIX-F2 ~5957) stamps `job.releasedAt = Date.now()` on the Assigned → No One transition (§FIX-G 10 s cooldown — `server.js` ~8075). The follow-up `ProcUpdateJobv6` explicit-Pending path (§FIX-A2 ~5689) cleared `BookingStatus / DriverId / VehicleId` but did NOT clear `releasedAt`. AutoDispatchVehiclesallride therefore skipped the job for the remaining ~8 s of the cooldown window even though the dispatcher had deliberately reset it.
- Fix (`server.js` ~5689 §FIX-A2 branch): also set `job.releasedAt = null` and `job.manualOffer = false` whenever the dispatcher explicitly chooses "Pending" from the Edit form. Diagnostic updated to `[§FIX-A2/ProcUpdateJobv6] §FIX-O explicit Pending: ... clearing driver/vehicle/releasedAt/manualOffer`.
- Rationale: the §FIX-G cooldown exists to stop auto-dispatch immediately re-offering a just-timed-out job to the same driver. When the dispatcher manually intervenes via the Edit form, that intent overrides the cooldown — the dispatcher has already decided the job should be dispatchable. `manualOffer` is cleared for symmetry so a future Unreached timeout is treated as the normal auto-dispatch path (§FIX-U2 → Pending+cooldown), not as a manual-pick (§FIX-M → No One).
- Driver-app side still has its own bookingId-only dedup bug (re-offers of the same bookingId silently swallowed) and stale `online/{cid}/{vid}/current` heartbeat — both handed off to the driver-app team. `§FIX-O` makes the dispatch server clean; the popup-not-firing symptom is purely driver-app once they ship dedup-by-`bookingId+offeredAt`.

## §FIX-N — Driver-app late ack silently flipped No One → Pending (May 2026)

- Symptom: dispatcher takes an Assigned job to No One via `[UnAssignJobStatusFromJobList]` (UI works, driver phone shows "job cancelled"). A second later the job in UA quietly changes from **No One** to **Pending** and auto-dispatch immediately re-offers the same job to the same driver — driver popup never fires because of the (separate) driver-app bookingId dedup bug.
- Root cause: after the dispatcher unassign, the driver app's follow-up `[changeriddestatusforoffer]` ack (typically `ridestatus='Unreached'`) arrives at the server. The DP/DS Unreached branches (`server.js` ~6580 / ~8700) compute `effectiveStatus = (newStatus === 'Unreached') ? (manualOffer ? 'No One' : 'Pending') : newStatus`. `UnAssignJobStatusFromJobList` (~5991) had just cleared `manualOffer=false`, so the branch falls into the `'Pending'` arm and overwrites the dispatcher's No One state. None of the earlier guards (isAccepted-downgrade, Queued, isDriverPostAcceptCancel) trip because `currentStatus === 'No One'` matches none of them.
- Fix (`server.js` ~6503 DP + ~8665 DS): new guard immediately after the Queued block — `if (currentStatus === 'No One' && isDowngrade) { BLOCK; return; }` for both variants (`isDowngrade` = Unreached/Pending/Cancelled/Unassigned). Diagnostic `[§FIX-N/changeriddestatusforoffer/{DP|DS}] BLOCKED: job #N is No One, refusing to set <status>`.
- Legit paths preserved: `Offered`/`Assigned`/`Picking` writes are NOT downgrades so they pass through (e.g. dispatcher re-picks driver → No One → Offered still works via `AssignJobFromJobList` / `ProcUpdateJobv6` §FIX-A2). Only Unreached/Pending/Cancelled/Unassigned from a late driver-app ack are blocked while the job sits in No One.

## §FIX-F2 — Assign-tab "No One" used string-vs-number coercion (May 2026)

- Root cause: `[UnAssignJobStatusFromJobList]` (`server.js` ~5953) used `const prevDriverId = job.DriverId || 0; job.BookingStatus = prevDriverId > 0 ? 'No One' : 'Pending';`. For tenants whose `DriverId` is a string like `"D002"`, `"D002" > 0` coerces to `NaN > 0 === false`, so the handler demoted Assigned jobs to `Pending` (not `No One`) on dispatcher "take to No One". Auto-dispatch then immediately re-offered the same job to the same driver. The §FIX-G `releasedAt` cooldown was gated on the same broken check and never armed.
- Fix (~5957-5972): stringify+trim `prevDriverId`; set `_hadDriver = _prevDrvStr !== '' && _prevDrvStr !== '0' && _prevDrvStr !== '-1'`; gate both `BookingStatus = 'No One'` and the `releasedAt` cooldown on `_hadDriver`. Added diagnostic `[UnAssignJobStatusFromJobList] §FIX-F2 ... hadDriver=... → BookingStatus='...'`.
- Numeric IDs still work: `5` and `'5'` both yield `hadDriver=true`; `0/'0'/-1/'-1'/''` yield `hadDriver=false`.

## §FIX-M — Manual-offer Unreached → No One (May 2026)

- Symptom: dispatcher manually picks driver from UA-tab dropdown → driver does NOT accept within 27 s → job parked as **Pending** and bounced back into auto-dispatch retry pool. User expects manual picks that time out to park as **No One** so the dispatcher decides next.
- Root cause: §FIX-U2 demoted every `Unreached` to `Pending` regardless of whether the offer was dispatcher-driven or auto-dispatched. There was no flag distinguishing the two.
- Fix:
  1. `[AssignJobStatusFromJobList]` / `[AssignJobStatusFromJobListv2]` handler (`server.js` ~5950): stamp `job.manualOffer = true` + `job.manualOfferAt = Date.now()` on the job when dispatcher manually assigns.
  2. Both §FIX-U2 sites (`server.js` ~6579 DP and ~8697 DS): if `newStatus === 'Unreached' && job.manualOffer === true`, set `BookingStatus = 'No One'`, clear `DriverId/VehicleId`, and consume the flag (`job.manualOffer = false`). Otherwise keep legacy Pending+`releasedAt` cooldown behaviour for auto-dispatch.
  3. Diagnostic `[§FIX-M/...] job #N manual-offer Unreached → No One (cleared manualOffer, driver/vehicle reset)`.
- Auto-dispatch path unchanged: smartAutoDispatch never sets `manualOffer`, so its Unreached timeouts still go to Pending and the cooldown still arms.

## §FIX-U2 — Unreached timeout → Pending + releasedAt cooldown (May 2026)

- Reverted policy: the original §FIX-U made Unreached → 'No One', which broke the auto-dispatch retry loop. Correct behaviour: Unreached on an auto-dispatched job should go back to 'Pending' so auto-dispatch can offer to the **next** driver; the existing §FIX-G `releasedAt` 30 s cooldown (server.js ~8030 — `if (Date.now() - j.releasedAt) < 30000) return false`) prevents the same driver being re-offered immediately.
- Fix (`server.js` ~6567 + ~8673): `effectiveStatus = newStatus === 'Unreached' ? 'Pending' : newStatus`, and when `newStatus === 'Unreached'` also stamp `job.releasedAt = Date.now()` with diagnostic `[§FIX-U2/...] Unreached → Pending + releasedAt stamped`.
- Cooldown window shortened from 30 s to **10 s** (`server.js` ~8035) per user request — long enough to skip the just-failed driver in the very next auto-dispatch tick, short enough that on a single-driver tenant the same driver gets the offer again quickly.
- Manual-dispatcher "take to No One" path is unchanged — it still routes through `[UnAssignJobStatusFromJobList]` (§FIX-F2) which sets `BookingStatus='No One'`. So: auto-timeout → Pending+cooldown (auto retries other drivers); manual unassign → No One (dispatcher controls).

## §FIX-W — Universal vehicle resolver inside writeJobDetailsToFirebase (May 2026)

- Discovery: log run at 1779025097/1779025406 showed offers still landing on `jobs/620611/D002/D002` (driverId-as-vehicleId) on auto-dispatch and on the manual reassign quick-action paths, not just on `AssignJobFromJobList`. There are at least 5 call sites of `acknowledgemethodx`: `AssignJobFromJobList` (~13967 — §FIX-V), `addjob` (~14966 — `acknowledgemethodx(extra, driverset, …)`), pre-queue helpers (~18750 / ~18798 — `acknowledgemethodx(JobVehicleId, …, "Offered")`), `updateride2` (~20514 — `acknowledgemethodx(DriveId, DriveId, …)`), `addjob2` (~20888). Patching them one by one is whack-a-mole.
- Fix (`Default.aspx` ~8718-8746): defensive resolver inside `writeJobDetailsToFirebase` itself — the single lowest-level function every offer write flows through. If `vehicleId` is missing/`0`/`'null'`/`'undefined'`/equal to `driverId`, scan `scope.driverdatarealx` for a row whose `driverid` matches and `VehicleId` is non-empty and not equal to the driver id; swap it in. Falls through unchanged when input is already correct or no match is found (numeric tenants and unknown drivers are unaffected). Diagnostic `[§FIX-W/writeJobDetailsToFirebase] vehicle resolved: driver="…" vehicleIn="…" → vehicleOut="…"` fires whenever the swap happens, so we can see in production which legacy call sites were saved by this guard.
- This is the structural fix that supersedes the per-call-site §FIX-V approach. §FIX-V remains in place as the primary path for `AssignJobFromJobList` (it also fixes `acknowledgemethodx`'s own first-arg, which §FIX-W cannot reach because §FIX-W lives only in `writeJobDetailsToFirebase`).

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