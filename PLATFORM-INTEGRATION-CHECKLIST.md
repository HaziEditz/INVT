# BookaWaka Platform Integration Checklist

**Version**: 1.0 — May 2026  
**Firebase project**: `taxilatest`  
**companyId example**: `620611`  

Instructions for each team:
1. Read your column and every shared-path row.
2. Mark each cell: ✅ tested and working / ❌ known broken / ⬜ not yet tested.
3. Reply with any field names or paths you use differently — do not silently rename.

---

## 1. Firebase RTDB Path Contract

| Path | Writer | Reader(s) | Notes |
|---|---|---|---|
| `online/{cid}/{vid}` | Driver app | Dispatcher | Top-level node: driver metadata (vehiclenumber, driverid, vehiclestatus, etc.) |
| `online/{cid}/{vid}/current` | Driver app | Dispatcher, Passenger app | `{ lat, lng, hasGps: true, time }` — GPS only, not metadata |
| `pendingjobs/{cid}/{bookingId}` | Passenger app, Server | Dispatcher | Unassigned passenger-app bookings. Server ingests via `[IngestPassengerJob]`. |
| `allbookings/{cid}/{bookingId}` | Passenger app, Driver app | Server (recall fallback), SA portal | Long-term booking store. Driver app must patch on cancellation: `{ status: 'Cancelled', Status: 'Cancelled', CancelledAt: ISO, CancelledBy: 'driver' }`. Driver app must also patch `driverRating` here after a rating is submitted. |
| `completedJobs/{cid}/{tripId}` | Dispatcher (on completion) | SA portal | Fields: fare, paymentType, completedAt, driverId, pickup, dropoff, + TM fields if applicable |
| `jobs/{cid}/{vid}/{driverId}` | Dispatcher | Driver app | Job acceptance handshake node. Checked before sending new offer. |
| `notification/{driverId}` | Dispatcher | Driver app | Job offer payload. Fields: bookingid (CSV), jobpickup, jobdropoff, JobphoneNo, jobname, jobbags, jobpassengers, jobvehicletype, jobFare, jobServiceType, vehicleId, companyId, extras{} |
| `notification/{cid}` | **Nobody** | — | Dead path. Remove any listener on this path. |
| `jobDetails/{cid}/{bookingId}` | Dispatcher | Passenger app | Full job payload including vehicleId. Passenger app uses vehicleId to build GPS tracking path. SA portal confirmed zero reads of this path — no SA change needed. |
| `rideStatus/{cid}/{bookingId}` | Dispatcher | Passenger app | `{ status, driverId, vehicleId, companyId, pickup, dropoff, vehicleType, updatedAt }` — ETA / live tracking anchor |
| `Emergency/{cid}` | Driver app | Dispatcher | Emergency alert. Dispatcher listens, shows red banner, plays sound. |
| `towRequests/{cid}` | Driver app | Dispatcher | Tow request alert. Same banner/sound pattern as Emergency. |
| `chatMessages/{cid}/{conversationId}` | Driver app, Dispatcher | Driver app, Dispatcher | Real-time chat. key = `{driverId}_{bookingId}` or `broadcast`. |
| `superClients/{cid}/sessionRevoke` | SA portal | Dispatcher | SA writes `Date.now()` (ms). Dispatcher signs out if value > `bw_loginTime` (localStorage). |
| `companySettings/{cid}` | Owner portal | Dispatcher, Driver app | Feature flags, company name, logo URL, opening hours. |
| `driverEarnings/taxi/{cid}/{driverId}` | Dispatcher | Owner portal | Cumulative: totalEarned, pendingAmount, tripCount, lastPaidAt. |
| `tmTripStatus/{cid}/{bookingId}` | SA portal | Dispatcher (popup) | TM approval status. Values: pending / company_approved / submitted / approved / paid |
| `driverRatings/{cid}/{bookingId}` | Driver app / Passenger app | SA portal | Write full rating node here AND patch `allbookings/{cid}/{bookingId}/driverRating` with the score. Not read by dispatcher. |
| `freightOrders/{cid}/{bookingId}` | Driver app | SA portal | Freight pickup/delivery confirmation. Not read by dispatcher. |
| `foodOrders/{cid}` | Passenger app | SA portal | Food order real-time status. Parked — not yet in scope. |
| `drivers/{driverId}/assignedVehicles` | Owner portal | Driver app | ⚠️ **Field name mismatch (BUG 10):** Owner portal writes `allocatedVehicles: { "Taxi02": true }` (object). Driver app reads `assignedVehicles: ["Taxi02"]` (array) + `vehicleId: "TAXI02"` (string). Must be normalised — coordinate Owner portal ↔ Driver app before go-live. |

---

## 2. Job Offer Notification Payload (`notification/{driverId}`)

Every field the driver app may read. Mark ✅ if your app sends/reads this correctly.

| Field | Type | Dispatcher sends | Driver app reads | Notes |
|---|---|---|---|---|
| `bookingid` | string | ✅ | ⬜ | CSV format: `{bookingId},{status},{driverId},{uid},{source}` |
| `joboffer` | string | ✅ | ⬜ | Booking ID as a plain string |
| `jobpickup` | string | ✅ | ⬜ | Pickup address |
| `jobdropoff` | string | ✅ | ⬜ | Drop-off address |
| `JobphoneNo` | string | ✅ | ⬜ | Passenger phone |
| `jobname` | string | ✅ | ⬜ | Passenger name |
| `jobbags` | string | ✅ | ⬜ | Number of bags |
| `jobpassengers` | string | ✅ | ⬜ | Passenger count |
| `jobvehicletype` | string | ✅ | ⬜ | Vehicle type string |
| `jobFare` | string | ✅ | ⬜ | Estimated fare |
| `jobServiceType` | string | ✅ | ⬜ | `taxi` / `food` / `freight` / `tm` |
| `jobBookingSrc` | string | ✅ | ⬜ | `Dispatcher` / `android` / `ios` |
| `vehicleId` | string | ✅ | ⬜ | SQL vehicleId — passenger app uses to build GPS path |
| `companyId` | string | ✅ | ⬜ | SQL companyId |
| `extras.tmVoucherNo` | string | ✅ if TM job | ⬜ | Required for driver to write `trips/{cid}/{bookingId}` |
| `extras.tmPassengerName` | string | ✅ if TM job | ⬜ | |
| `extras.tmCardExpiry` | string | ✅ if TM job | ⬜ | |
| `extras.tmSubsidy` | number/string | ✅ if TM job | ⬜ | Council subsidy amount |
| `extras.tmSubsidyHoist` | number/string | ✅ if TM job | ⬜ | Hoist subsidy if applicable |
| `extras.tmPassengerPays` | number/string | ✅ if TM job | ⬜ | Passenger co-payment |
| `extras.tmHoistRequired` | boolean | ✅ if TM job | ⬜ | |
| `extras.tmHoistCount` | number | ✅ if TM job | ⬜ | |
| `extras.tmPaymentMethod` | string | ✅ if TM job | ⬜ | |

---

## 3. Driver Presence / GPS Contract

| Item | Expected | Dispatcher status | Driver app status |
|---|---|---|---|
| GPS write path | `online/{cid}/{vid}/current` — `{ lat, lng, hasGps: true, time }` | ✅ reads `.current.lat/.lng` (fixed May 2026) | ⬜ confirm writing here |
| Metadata write path | `online/{cid}/{vid}` — flat fields: `vehiclenumber`, `driverid`, `vehiclestatus`, `drivername`, `zonename` | ✅ reads correctly | ⬜ confirm flat write (not nested under `current`) |
| Presence: online flag | `online/{cid}/{vid}/current.online: true/false` | ✅ presence listener uses `.current || _raw` | ⬜ confirm writing `online` boolean |
| Presence: lastSeen | `online/{cid}/{vid}/current.lastSeen: Date.now()` | ✅ | ⬜ |
| onDisconnect cleanup | `online/{cid}/{vid}` removed or `current.online = false` | ✅ handles both | ⬜ confirm which cleanup method |

**Dispatcher GPS read order (backward-compat):** `driverData.lat || driverData.current?.lat` — tries top-level fields first (older driver app builds that write flat), then falls through to `.current.lat`. Driver app must not change this without a coordinated cut-over. (Q3 — confirmed May 2026)

---

## 4. Job ID Contract

| Item | Expected | Dispatcher | Passenger app | Driver app |
|---|---|---|---|---|
| Canonical job ID source | `POST /api/job/create` → `{ jobId }` → passed as `ExternalJobId` to SQL | ✅ called on every booking create | ⬜ called on passenger booking? | n/a |
| Fallback if `/api/job/create` fails | **None — do not create local IDs** | ✅ booking fails cleanly | ⬜ | n/a |
| Firebase job key | Must match SQL bookingId | ✅ | ⬜ | ⬜ |

**Edge case closed (Q4 — May 2026):** The scenario "server returns `{}` with no `jobId`" is impossible. `generateJobId()` (`src/jobId.ts`) always returns a valid string or throws — an unhandled throw becomes `{ ok: false, error: "..." }` with HTTP 500. There is no code path that emits `{ ok: true }` without a `jobId`. No defensive handling needed on client side beyond checking `ok === false`.

---

## 5. TM (Total Mobility) Field Contract

Passenger app writes; dispatcher normalises; driver app forwards to `trips/{cid}/{bookingId}`; SA portal reads.

| Field | Passenger app writes | `_normFbJob` normalises to | Driver offer `extras.*` | SA portal reads |
|---|---|---|---|---|
| Voucher number | `tmVoucherNumbers: ['1234']` (array) | `tmVoucherNo: '1234'` (string) | `extras.tmVoucherNo` | `trips/{cid}/{bid}.tmVoucherNo` |
| Passenger name | `tmPassengerName` | `tmPassengerName` | `extras.tmPassengerName` | ⬜ |
| Card expiry | `tmCardExpiry` | `tmCardExpiry` | `extras.tmCardExpiry` | ⬜ |
| Subsidy | `tmSubsidy` | `tmSubsidy` (number) | `extras.tmSubsidy` | `completedJobs/{cid}/{bid}.tmSubsidy` |
| Hoist subsidy | `tmSubsidyHoist` | `tmSubsidyHoist` (number) | `extras.tmSubsidyHoist` | `completedJobs/{cid}/{bid}.tmSubsidyHoist` |
| Passenger pays | `tmPassengerPays` | `tmPassengerPays` (number) | `extras.tmPassengerPays` | `completedJobs/{cid}/{bid}.tmPassengerPays` |
| Hoist required | `tmHoistRequired` | `tmHoistRequired` (boolean) | `extras.tmHoistRequired` | ⬜ |
| Hoist count | `tmHoistCount` | `tmHoistCount` (number) | `extras.tmHoistCount` | ⬜ |
| Payment method | `tmPaymentMethod` | `tmPaymentMethod` | `extras.tmPaymentMethod` | ⬜ |
| Council ID | `councilId` | `councilId` | not forwarded | `completedJobs/{cid}/{bid}.councilId` |

---

## 6. Service Type / Booking Type Values

Canonical values (lowercase). Teams must use these exactly — no aliases in Firebase paths.

| Canonical value | Aliases accepted by `_normFbJob` | UI colour | Notification badge |
|---|---|---|---|
| `taxi` | `taxi` | default | none |
| `food` | `restaurant` | green | food icon |
| `freight` | `delivery` | orange | box icon |
| `tm` | `total_mobility` | purple | TM badge |

---

## 7. Session Revocation

| Item | Path | Writer | Reader | Notes |
|---|---|---|---|---|
| Revoke all dispatchers for a company | `superClients/{cid}/sessionRevoke` | SA portal | Dispatcher | SA writes `Date.now()` (ms integer). Dispatcher compares vs `localStorage.bw_loginTime`. |
| Dispatcher login timestamp | `localStorage.bw_loginTime` | Dispatcher | Dispatcher | Set at login. Must be set before the revoke listener attaches. |

⚠️ **CROSS-TEAM WARNING — PATH IS EXACT:** `superClients/{cid}/sessionRevoke` — **NOT** `companies/{cid}/sessionRevoke`. Writing to the wrong path produces no error and no sign-outs. SA portal already writes to the correct path. Driver app and owner portal must never write to this path — they don't hold session revoke authority. (Q2 — confirmed May 2026)

---

## 8. Known Open Gaps (Parked)

| Gap | Impact | Owner | Status |
|---|---|---|---|
| SA master report reads only `completedJobs` — not `allbookings` | Revenue/trip counts understated for dispatched jobs | SA portal dev | ✅ Closed — Section 11 fix reads both paths and deduplicates by bookingId. Dispatcher uses SQL for job lists; `allbookings` is only touched as a recall fallback. No further change needed. (Q1 — May 2026) |
| Food order real-time status (`foodOrders/{cid}`) | Passenger app can't track food orders | Passenger app + SA portal | Parked — paths documented, ready to scope |
| Freight post-booking tracking | Same | Passenger app + SA portal | Parked |
| Card commission / net payout deduction (`companies/{cid}/cardSettings`) | Owner portal + SA portal revenue inaccurate | Owner portal + SA portal | Parked — joint feature, schedule with owner portal team |
| `firebase deploy --only database` not yet run | `rideStatus` and `driverEarnings` writes blocked; smoke test shows 2 failures | SA portal or dispatcher (whoever has Firebase CLI) | **Blocking** — SA portal audited their `database.rules.json` and found 30 paths missing (including `superClients`, `freightOrders`, `foodOrders`, `driverRatings`, `trips`, and more — all now added). Deploy must be run once against `taxilatest` project to activate all new rules. |

---

## 17. Dispatcher Q&A — May 2026

Recorded answers from the dispatcher team review. Each entry is self-contained so other teams can read it without cross-referencing the Q&A thread.

---

### Q1 — `allbookings` / `completedJobs` coverage gap

**Question:** SA master report only reads `completedJobs`. Does the dispatcher write dispatched trips there, or only to `allbookings`? Are trip counts understated?

**Answer (dispatcher team):** The dispatcher does **not** use Firebase for job lists at all — all job data comes from the SQL API. `allbookings/{cid}` is only ever touched by the dispatcher as a recall-notification fallback (checking for a booking that was cancelled before the driver saw it). `completedJobs/{cid}` is write-only from the dispatcher side: the dispatcher writes one node per completed trip, and the SA portal reads from there.

**Resolution:** ✅ Closed. The Section 11 fix in the SA master report now reads **both** `completedJobs` and `allbookings` and deduplicates by `bookingId`, so any edge cases are covered. The "understated revenue" gap in Section 8 is closed. No code change needed on the dispatcher side.

---

### Q2 — `sessionRevoke` path correctness

**Question:** Dispatcher listens on `superClients/{cid}/sessionRevoke`. SA portal — are you writing to that exact path or to `companies/{cid}/sessionRevoke`?

**Answer (SA portal team):** SA portal writes to `superClients/{cid}/sessionRevoke` — correct path confirmed.

**Resolution:** ✅ Confirmed correct. Cross-team warning added to Section 7: any team writing to `companies/{cid}/sessionRevoke` instead will get no sign-outs and no error — a silent failure. The warning is now prominent in the checklist so future SA portal changes don't accidentally drift the path.

---

### Q3 — GPS read-order backward compatibility

**Question:** The dispatcher reads GPS as `driverData.lat || driverData.current?.lat`. Is this the right fallback order? Will it break when the driver app migrates to writing only under `.current`?

**Answer (dispatcher team):** Yes — `driverData.lat` first covers older driver app builds that write flat top-level fields; fallback to `.current.lat` covers builds that already write the nested structure. Both shapes are in production simultaneously.

**Resolution:** ✅ Confirmed correct. The read order **must not change** until all driver app installs in the field have been updated to the nested format. Any driver app change to the write path requires a coordinated cut-over with the dispatcher team. Pattern documented in Section 3.

---

### Q4 — `/api/job/create` edge case: `{}` response with no `jobId`

**Question:** What happens if `POST /api/job/create` returns HTTP 200 with `{}` and no `jobId`? The passenger app would silently create a booking with no canonical ID.

**Answer (dispatcher team):** Impossible code path. `generateJobId()` in `src/jobId.ts` always returns a valid string (e.g. `62026050601`) or throws. An unhandled throw becomes `{ ok: false, error: "..." }` with HTTP 500 — never `{ ok: true }` without a `jobId`. There is no conditional branch that omits `jobId` from a success response.

**Resolution:** ✅ Closed — no change needed on either side. Client-side defensive check: treat any response where `ok !== true` as a hard failure and surface an error to the user. Do not fall back to a locally-generated ID.

---

## 18. SA Portal Response — May 2026

Recorded responses from the SA portal team following the dispatcher audit notes.

---

### `jobDetails` path change — SA portal not affected

**SA portal:** Checked the entire SA portal codebase. Zero reads of `jobDetails` anywhere. No change needed.

**Status:** ✅ Closed. Path change (`jobDetails/{bookingId}` → `jobDetails/{cid}/{bookingId}`) only affects the passenger app, which reads this node to get `vehicleId` for GPS tracking. SA portal is not a consumer.

---

### `sessionRevoke`, master report gap, TM fields — all confirmed correct

**SA portal:** No action required. All three items match what is documented.

**Status:** ✅ Confirmed. No further follow-up needed from either side.

---

### Firebase rules — larger audit on SA portal side

**SA portal:** The rules issue was wider than the two paths identified by the smoke test. A full audit of the SA portal's `database.rules.json` found **30 paths missing** rules entirely, including `superClients`, `freightOrders`, `foodOrders`, `driverRatings`, `trips`, and others. All have now been added to `database.rules.json` on the SA portal side.

**Action required:** `firebase deploy --only database` must be run once against the `taxilatest` project. Either the SA portal team or the dispatcher team can run this — whoever has the Firebase CLI configured for `taxilatest`. Once deployed, the smoke test at `GET /dev/smoketest?adminKey=bookawaka-admin-2026&cid=620611` should return 27/27 green.

**Status:** ⏳ Pending deploy.

---

## 19. Pre-Go-Live Outstanding Items

All teams. Updated May 2026.

**Audit status: ✅ Complete.** All 6 teams certified. All bugs fixed. All documentation updated on both sides. One gate remains before go-live.

| Item | Owner | Status |
|---|---|---|
| `firebase deploy --only database` (taxilatest) | SA portal or dispatcher — whoever has Firebase CLI authenticated against `taxilatest` | ⏳ **The only remaining blocker.** `database.rules.json` is ready in the repo. Run from project root — takes ~10 seconds. After deploy: dispatcher re-runs smoke test → 27/27 green; all client apps (driver, passenger, website) stop getting silent denies on the 30 previously missing paths. |
| Driver app — 10 bugs from E2E test (see Section 20) | Driver app dev | ❌ 2 critical, 5 high, 3 medium — fix before go-live |
| Dispatch app — 7 bugs from E2E test (see Section 21) | Dispatcher dev | ❌ 1 critical, 5 high, 1 medium — dispatcher dev investigating BUGs 1, 4, 6 |
| Vehicle field name mismatch: `allocatedVehicles` vs `assignedVehicles` (BUG 10) | Owner portal + driver app — cross-team | ❌ **Cross-team blocker.** Owner portal writes `allocatedVehicles: {"Taxi02": true}`. Driver app reads `assignedVehicles: ["Taxi02"]` + `vehicleId`. Agree on one format and both sides update together. |
| Cross-team E2E test session | All 6 teams | Schedule after driver app bugs are fixed — Sections 2–8 have the exact steps |
| Net payout deduction (`companies/{cid}/cardSettings`) | SA portal + owner portal | Parked — joint feature, ship together |
| Freight POD photo / signature | All teams | Future feature — field names to be agreed before any team builds |
| `contactInquiries` SA reader | SA portal | Future sprint, low priority |

---

## 20. Driver App Bug Report — E2E Test 2026-05-06

All bugs are driver app dev's responsibility unless noted as cross-team.

| # | Priority | Bug | Fix | Cross-team? |
|---|---|---|---|---|
| 1 | 🔴 CRITICAL | Offer while on active job cancels the current job. Accept/reject of incoming offer triggers job cancellation and shows false "cancelled by dispatcher" message. | Incoming offer UI must be fully isolated from current job state. Accept/reject must never touch active job. | BUG 7 is related — see below |
| 2 | 🟠 HIGH | Map is static during a trip — GPS position does not update or animate. | Implement real-time GPS map updates during active trip. | No |
| 3 | 🟠 HIGH | App disconnects when backgrounded. GPS stops, offers stop, active trip stops. Resumes only on foreground. | Implement Android foreground service to keep GPS, Firebase listeners, and job state alive when backgrounded. | No |
| 4 | 🟠 HIGH | Hail trips get device-generated IDs (`hail-{timestamp}`). Platform contract requires all IDs from `POST /api/job/create`. Device IDs cause collisions and break SA reporting. | Call `/api/job/create` before starting hail meter. Retry 3× on failure. No local fallback. | Contracts with SA portal — Section 4 |
| 5 | 🟠 HIGH | TM hail trips write `tmSubsidy: 0` and `tmSubsidyFare: 0` even when a voucher is entered. Subsidy calculation not written to completed record. | Write to `completedJobs/{cid}/{bookingId}`: `tmSubsidy`, `tmSubsidyFare`, `tmPassengerPays`, `tmVoucherNo`, `tmPassengerName`, `tmTripCategory` | SA portal reads these — Section 5 |
| 6 | 🟠 HIGH | Cash hail trips record `tariffName: "Total Mobility"` and `tariffId: "5"` even without a voucher. Tariff carries over from previous TM trip. | Reset tariff to default taxi tariff at start of each new hail trip. | No |
| 7 | 🟠 HIGH | False "Job cancelled by dispatcher" message on any app-triggered cancellation. | Only show "cancelled by dispatcher" if `CancelledBy === 'dispatcher'` in Firebase job record. Show neutral message otherwise. | Related to BUG 1 |
| 8 | 🟡 MEDIUM | No sign-out button. Only workaround: Android Settings → Apps → Clear Data. | Add sign-out to settings/profile screen. Call `firebase.auth().signOut()` and return to login. | No |
| 9 | 🟡 MEDIUM | Hail flow asks driver to select job type (taxi/food/freight). Hail is always taxi. | Auto-set type to `"taxi"` for hail and remove the type-selection step. | No |
| 10 | 🟡 MEDIUM | **Cross-team.** Owner portal writes `allocatedVehicles: {"Taxi02": true}` (object). Driver app reads `assignedVehicles: ["Taxi02"]` (array) + `vehicleId: "TAXI02"` (string). Result: drivers created via Owner Portal show "No vehicles available." | Agree on one format. Option A: Owner portal writes `assignedVehicles` array + `vehicleId` string. Option B: Driver app reads `allocatedVehicles` object. Must move together. | ✅ Owner portal + driver app must coordinate |

**Firebase field contract reminders for driver app dev:**

| Action | Path | Fields |
|---|---|---|
| Cancelled trip | `allbookings/{cid}/{bookingId}` (patch) | `status: 'Cancelled'`, `Status: 'Cancelled'`, `CancelledAt: ISO`, `CancelledBy: 'driver'` |
| GPS update | `online/{cid}/{vid}/current` | `{ lat, lng, hasGps: true, time }` |
| Rating write | `driverRatings/{cid}/{bookingId}` (full node) + `allbookings/{cid}/{bookingId}/driverRating` (patch score) | — |
| Job ID | All jobs — `POST /api/job/create` | No local ID generation under any circumstance |

---

## 21. Dispatch App Bug Report — E2E Test 2026-05-06

Bugs in the dispatcher UI / server.js. Marked with owner.

| # | Priority | Bug | Fix | Owner |
|---|---|---|---|---|
| 1 | 🔴 CRITICAL | Dispatch jobs sit at `Status: Pending` in Firebase and never reach the driver app as an offer. Driver app never shows incoming offer popup. | **Dispatcher side investigated — code is correct.** Dispatcher writes to `notification/{sqlDriverId}` (SQL numeric driverId). **Driver app action required:** confirm your Firebase listener is on `notification/{sqlDriverId}` — NOT `notification/{firebaseUID}`. If the driver app is listening on the Firebase UID, offers will never arrive. | ⬜ Driver app to confirm listener path |
| 2 | 🟠 HIGH | Scheduled (later) jobs not dispatching at the correct pre-dispatch window. | Verify scheduled dispatch timer/cron watches `allbookings/{cid}` for upcoming jobs. | Dispatcher dev |
| 3 | 🟠 HIGH | Creating or editing a scheduled job fails — no record appears in Firebase. | Check job creation flow for scheduled bookings; confirm `POST /api/job/create` is called and response jobId is used. | Dispatcher dev |
| 4 | 🟠 HIGH | Driver-to-dispatch messages not appearing in dispatch app. | **Dispatcher side investigated — listeners are correct.** Dispatch app listens on two paths: (1) `/driverMsg/{companyId}` — `child_added` with auto-delete after display; (2) `/chat` — `child_changed` for driver replies to dispatcher chat nodes. **Driver app action required:** write to `firebase.database().ref('/driverMsg/{companyId}').push({ driverId, driverName, vehicleNumber, message, timestamp })`. If the driver app writes to `/driverMsg/{driverId}` or any other path, messages will not appear. | ⬜ Driver app to confirm write path |
| 5 | 🟠 HIGH | Completed job detail panel missing: route map, fare, distance, duration, driver info, passenger info. | Read from `allbookings/{cid}/{bookingId}` and `completedJobs/{cid}/{bookingId}` and populate panel. | Dispatcher dev |
| 6 | 🟠 HIGH | Fleet view shows inactive vehicles alongside active ones. | **✅ Fixed in dispatcher.** Three-layer guard added: (1) `child_added` handler — returns immediately if `vehiclestatus === 'inactive'`; (2) `child_changed` handler — removes vehicle from scope + map if it becomes inactive; (3) `$scope.tallo` — rejects inactive before adding to `driverdatarealx`; (4) fleet table `ng-if` also excludes `vehiclestatus === 'inactive'`. | ✅ Dispatcher fixed |
| 7 | 🟡 MEDIUM | Web bookings dispatched without payment collected first. | Check `paymentStatus` or `prepaid` field before offering job to driver. Hold web bookings until payment confirmed. | Dispatcher dev |

**Firebase field contract reminders for dispatch dev:**

| Item | Detail |
|---|---|
| Job record path | `allbookings/{cid}/{bookingId}` — use `Status` (capital S) |
| Driver GPS | Read `online/{cid}/{vid}/current → { lat, lng, hasGps, time }` — lat/lng are under `current`, not top-level |
| Session revoke | Listen `superClients/{cid}/sessionRevoke` — sign out if value > loginTimestamp |
| Job payload | `vehicleId` and `companyId` must be in every write to `jobDetails/{cid}/{bookingId}` |
| Job IDs | All from `POST /api/job/create` — no local generation |

---

## 22. Dispatch App Bug Report — Round 2 (2026-05-06)

New findings from SA after reviewing Round 1 responses.

| # | Priority | Item | Fix | Status |
|---|---|---|---|---|
| R2-1 | 🟠 HIGH | `notification/{vehicleId}` contains a driver message mixed with job offer format — driver app cannot distinguish the two. | Add `type: 'job_offer'` to every notification payload written by the dispatcher. Driver app filters on `type` field. | ✅ **Fixed** — `type: 'job_offer'` added to `fullPayload` in `writeJobDetailsToFirebase` |
| R2-2 | 🟠 HIGH | `rideStatus/{cid}/{bookingId}.vehicleId` contains driver dispatch ID (e.g. `"D002"`) instead of taxi number (e.g. `"TAXI02"`). GPS path `online/{cid}/{vehicleId}/current` uses taxi number as key — passenger app / map cannot locate driver. | Write `vehicleId` as uppercase taxi number; add `driverDispatchId` as separate field for the driver reference. | ✅ **Fixed** — `rideStatus` set now looks up taxi number from `driverdatarealx` by driverId; falls back to `.toUpperCase()` of the passed vehicleId. Added `driverDispatchId` field for the original driver ID. |
| R2-F | 🟡 FEATURE | No unread badge on Messages tab — dispatcher has no indication when a driver sends a message. | Show unread count badge on Messages tab. Increment on each incoming driver message. Clear when tab is opened. | ✅ **Fixed** — Red badge `#bw-drv-msg-badge` added to Messages tab button. Incremented in `_showDriverMessage`, cleared by `_bwClearMsgBadge()` on tab click. |

---

## 23. Dispatch App Bug Report — Round 3 (2026-05-06)

Remaining 4 bugs from Section 21, all investigated and fixed in this round.

| # | Priority | Bug | Root Cause | Fix | Status |
|---|---|---|---|---|---|
| BUG 2 | 🔴 CRITICAL | Pre-booked (scheduled) jobs dispatched immediately — dispatch window ignored. `smartAutoDispatch` offers jobs to drivers as soon as they enter Pending state, regardless of pickup time. | `smartAutoDispatch` had no `DispatchTimebefore` check. All pending jobs were offered in every 10s cycle, even if the pickup was hours away. | Added dispatch window filter in `smartAutoDispatch` after `pendingJobs` is fetched. Logic: if `DispatchTimebefore > 0`, skip the job unless `now >= BookingDateTime - DispatchTimebefore minutes`. Logs skipped jobs with minutes remaining. | ✅ **Fixed** |
| BUG 3 | 🟠 HIGH | Editing a scheduled (Later) job removes it from the UI — job card disappears and never reappears. | After a successful later-job edit, `FnCancelRide` and `$("#Divo...").remove()` cleared the card correctly, but `changerefresh()` was not called — so the updated job never reloaded into the Unassigned panel. (Create path was already correct.) | Added `setTimeout(changerefresh, 1500)` immediately after the `laterjob` DOM removal block in the edit success handler. The 1.5s delay lets the SQL backend commit before the refresh fetch. | ✅ **Fixed** |
| BUG 5 | 🟠 HIGH | Completed job detail popup missing fare, distance, duration. Fare section stays hidden even on finished trips. | `ShowJobPopup` already fetches `completedJobs/{cid}/{jobKey}` from Firebase but only used that data for Total Mobility fields (`_fillTmFields`). Driver-app fare fields (`TotalFare`, `FareBase`, `FareTime`, `JobDistance`, timestamps) were in Firebase but never passed to `jdpBuildFare()` / `jdpBuildTimeline()`. | In the `completedJobs` Firebase `.then()` callback, after TM processing: merge `fbJob` (Firebase) fields under the SQL job object `j` (SQL non-empty fields win), then call `jdpBuildFare(merged)` and `jdpBuildTimeline(merged)`. All fare/duration sub-panels now populate from combined SQL+Firebase data. | ✅ **Fixed** |
| BUG 7 | 🟡 MEDIUM | Web bookings (`BookingSource === 'Website'`) dispatched to drivers before payment is collected. | `smartAutoDispatch` offered every Pending job regardless of `BookingSource` or payment state. No `paymentStatus` field existed in the dispatch flow. | Added payment gate filter in `smartAutoDispatch` (runs before the dispatch window filter). Web/website/web-booking jobs are skipped unless `paymentStatus === 'paid'` / `'completed'` or `prepaid === true`. Logs skipped jobs. The payment webhook on the server side sets `paymentStatus: 'paid'` when Stripe confirms — until then the job stays Pending but is not offered. | ✅ **Fixed** |

**Notes for SA/testing team:**

- **BUG 2**: Test by creating a Later job with `DispatchTimebefore = 15` (15-min lead time), pickup 2 hours from now. Console should log `"dispatch window opens in X min"` every 10s cycle. No driver offer should appear until the window opens.
- **BUG 3**: Test by editing an existing scheduled job → change time or pickup. Job card should disappear then reappear in the Unassigned panel within ~2 seconds (not stay gone permanently).
- **BUG 5**: Open a completed job detail popup. If the driver app wrote fare data to `completedJobs/{cid}/{bookingId}`, the Fare section (distance, ride cost, total fare) and Timeline durations now populate. If Firebase path has no data, the section remains hidden (correct).
- **BUG 7**: Web booking jobs with no `paymentStatus` will **not** be offered to drivers — they stay in the Pending/Unassigned queue. Dispatcher can still manually assign them. Once Stripe webhook fires and sets `paymentStatus: 'paid'`, the next 10s `smartAutoDispatch` cycle will offer them normally.

**Outstanding items still open from Section 21:**

| # | Status | Notes |
|---|---|---|
| BUG 1 (job offer to wrong driver) | ⬜ **Driver app action required** | Dispatcher side confirmed correct. Driver app must listen on `notification/{sqlDriverId}` (the numeric SQL driver ID, not Firebase UID). See Section 21. |
| BUG 4 (driver-to-dispatch messages missing) | ⬜ **Driver app action required** | Driver app must write to `/driverMsg/{companyId}` (not `/driverMsg/{driverId}`). See Section 21 BUG 4 and Section 22 R2-1. |

---

## 24. Food Ordering App — Firebase Ingest Path Audit (2026-05-06)

**Question from SA:** Does `foodOrders/{cid}/{bookingId}` appear correctly in the dispatcher inbox?

**Answer: ❌ No.**

### What exists
- `foodOrders/{cid}` has a valid Firebase rule (authenticated read/write per companyId) — path is real and writable.
- Dispatcher has a full food delivery UI: `$scope.deliveryjobs`, green `bw-svc-food` card styling, food icon badges, delivery count badge.

### What is missing
- The dispatcher has **no Firebase listener** on `foodOrders/{cid}/*` anywhere (confirmed: Default.aspx, ChatRoom.js, BwMessaging.js — zero matches).
- `$scope.deliveryjobs` is populated exclusively from **SQL** via a periodic `DataSelector → [UnAssignedJobsv3]` poll. Firebase is never consulted for delivery jobs.

### What happens if the food app writes to Firebase only
Nothing. The job is silently lost. The dispatcher never sees it.

### Correct ingest contract for food orders

Food ordering app must create jobs via the platform API — same flow as every other booking source:

```
1. POST /api/job/create
   Body: { source: 'food-app', companyId: '{cid}' }
   Response: { jobId: 12345 }

2. POST DataManager/Data.aspx/DataSelectorRide
   action: InsertBookingv4
   params: [
     { name: 'serviceType',   Value: 'food' },
     { name: 'BookingSource', Value: 'Website' },   // or 'Food App'
     { name: 'ExternalJobId', Value: '12345' },
     { name: 'PickAddress',   Value: '...' },
     { name: 'DropAddress',   Value: '...' },
     ...
   ]
```

That SQL record surfaces in `deliveryjobs` on the next poll cycle (≤10 s).

### Optional Firebase write
`foodOrders/{cid}/{bookingId}` **can** still be written for passenger-facing order tracking (status updates, ETA), but it is **not** the ingest path for dispatch. Job must exist in SQL first.

### Action required

| Team | Action |
|---|---|
| Food ordering app | Replace direct Firebase write with `POST /api/job/create` + `InsertBookingv4`. Set `serviceType: 'food'`. |
| SA / dispatcher | No dispatcher code change needed — SQL pipeline already handles `serviceType: 'food'` correctly. |


---

## 25. Food Delivery Job — Panel Routing & Auto-Dispatch Audit (2026-05-06)

**Question from passenger app team:** When a food job with `serviceType: "food"` comes in via `InsertBookingv4`, does it appear in the food delivery panel? Does `smartAutoDispatch` pick up food jobs from Firebase or SQL?

---

### Q1: Does a food job via InsertBookingv4 appear in the food delivery panel?

**Was: ❌ No — bug in server-side filter. Now: ✅ Fixed.**

**Root cause:** `buildDeliveryResponse()` (powers `[deviUnAssignedJobsv2]` / the DY delivery tab) filtered only:
```
BookingType === 'Delivery'  OR  BookingSource === 'Delivery App'
```
A job created via `InsertBookingv4` with `serviceType: 'food'` has `BookingSource: 'Dispatch Console'` / `'passenger'` / `'web'` — never `'Delivery App'`. So food jobs landed in the main Unassigned tab only, invisible to the delivery panel.

**Fix applied (`server.js` — `buildDeliveryResponse`):**
```js
// Before
jobs.filter(j => j.BookingType === 'Delivery' || j.BookingSource === 'Delivery App')

// After — also matches serviceType-based food/freight jobs from any source
jobs.filter(j =>
  j.BookingType === 'Delivery' ||
  j.BookingSource === 'Delivery App' ||
  j.serviceType === 'food' ||
  j.serviceType === 'freight'
)
```

---

### Q2: Does smartAutoDispatch pick up food jobs from Firebase or SQL?

**SQL only — confirmed.** And a second bug was found and fixed in the process.

**How dispatch sources jobs:**
1. `smartAutoDispatch` calls `AutoDispatchVehiclesallride` (SQL) every 10 seconds.
2. Returns **all** `Pending` jobs from the job store regardless of `serviceType`.
3. Client-side then calls `_bwCanDriverDoService(dvId, job.serviceType)` to gate which drivers see food vs. taxi jobs.
4. **No Firebase paths** (`allbookings`, `pendingjobs`, `foodOrders`) are used by `smartAutoDispatch` — Firebase is ingest-only.

**Second bug found and fixed — `AutoDispatchVehiclesallride` was stripping `serviceType`:**

The `dt1` job objects returned by `AutoDispatchVehiclesallride` were missing `serviceType` entirely. So on the client, `job.serviceType || 'taxi'` always resolved to `'taxi'` — meaning food jobs were silently offered to taxi drivers, bypassing the `_bwCanDriverDoService` gate entirely.

**Fix applied (`server.js` — `AutoDispatchVehiclesallride` dt1 map):**
```js
// Added to each job object in dt1:
serviceType:        j.serviceType    || 'taxi',
BookingSource:      j.BookingSource  || '',
paymentStatus:      j.paymentStatus  || '',   // needed for BUG 7 payment gate
prepaid:            j.prepaid        || false,
DispatchTimebefore: j.DispatchTimebefore || '0',  // needed for BUG 2 window check
BookingDateTime:    j.BookingDateTime    || '',
```

This also completes the server-side support for **BUG 2** (dispatch window) and **BUG 7** (payment gate) fixes made in Section 23 — those client-side filters now receive the fields they need.

---

### Does the web booking site's Firebase-based flow work for food jobs?

**Yes — `pendingjobs` → SQL → dispatch works correctly end-to-end**, provided:

| Step | What happens |
|---|---|
| Website writes `pendingjobs/{cid}/{key}` with `serviceType: 'food'` | Dispatcher Firebase listener (`pendingjobs` `child_added`) fires immediately |
| Listener calls `[IngestPassengerJob]` | `_normFbJob()` preserves `serviceType: 'food'` (maps `'restaurant'` → `'food'` too) |
| Job lands in SQL job store as `Pending` with `serviceType: 'food'` | ✅ |
| Next `AutoDispatchVehiclesallride` cycle (≤10s) returns it | Now includes `serviceType: 'food'` ✅ (after fix) |
| `smartAutoDispatch` offers only to food-capable drivers | ✅ |
| `[deviUnAssignedJobsv2]` poll returns it in delivery panel | Now matches `serviceType === 'food'` ✅ (after fix) |

The website does **not** need to call `InsertBookingv4` separately if it uses the `pendingjobs` Firebase path. Both paths now work.

---

### Summary of fixes in this section

| Bug | File | Fix |
|---|---|---|
| Food jobs not appearing in delivery panel | `server.js` `buildDeliveryResponse` | Add `serviceType === 'food' \|\| 'freight'` to filter |
| Food jobs offered to taxi drivers (serviceType stripped) | `server.js` `AutoDispatchVehiclesallride` dt1 map | Add `serviceType`, `BookingSource`, `paymentStatus`, `prepaid`, `DispatchTimebefore`, `BookingDateTime` to returned job objects |


---

## 26. Owner Portal — Driver Service Permissions (allowedServices) (2026-05-06)

**Source:** Dispatch app audit (Sections 23–25) confirmed that `_bwCanDriverDoService` reads `drivers/{cid}/{uid}/allowedServices` from Firebase to gate which job types a driver can receive. Currently the owner portal has no UI to set these flags — they are hardcoded or absent on most driver records.

---

### Firebase contract

**Path:** `drivers/{cid}/{uid}/allowedServices`

**Schema:**
```json
{
  "taxi":    true,
  "food":    true,
  "freight": true,
  "tm":      false
}
```

**Dispatch gate (Default.aspx `_bwCanDriverDoService`):**
```js
function _bwCanDriverDoService(dvId, serviceType) {
  const svc = (serviceType || 'taxi').toLowerCase();
  const allowed = _driverAllowedServices[dvId] || { taxi: true };
  return !!allowed[svc];
}
```

**Default behaviour when `allowedServices` is absent:** falls back to `{ taxi: true }` — driver receives taxi jobs **only**. This is intentional: drivers must be explicitly granted food/freight/TM access.

---

### Owner portal requirement

On both the **Add Driver** and **Edit Driver** forms, add a checkbox group labelled **"Allowed Services"**:

| Checkbox | Firebase key | Default |
|---|---|---|
| ☑ Taxi | `taxi` | `true` (always on, cannot be deselected) |
| ☐ Food Delivery | `food` | `false` |
| ☐ Freight / Courier | `freight` | `false` |
| ☐ Total Mobility | `tm` | `false` — **show only if company has TM enabled** |

**On save**, write the object to `drivers/{cid}/{uid}/allowedServices`:
```js
firebase.database()
  .ref(`drivers/${cid}/${uid}/allowedServices`)
  .set({ taxi: true, food: fFood, freight: fFreight, tm: fTm });
```

`taxi` must always be `true` in the write — it cannot be false.

---

### Edge cases & rules

| Case | Behaviour |
|---|---|
| Driver record has no `allowedServices` node | Dispatch defaults to `{ taxi: true }` — driver gets taxi jobs only |
| Company does not have TM enabled | TM checkbox is hidden entirely; `tm` key is omitted from the write or explicitly written as `false` |
| Owner saves Edit Driver without changing services | Re-write existing values (idempotent) |
| New driver created | Write `allowedServices` at the same time as the rest of the driver record |

---

### Acceptance criteria

- [ ] Add Driver form has "Allowed Services" checkbox group with taxi pre-checked and disabled
- [ ] Edit Driver form pre-populates checkboxes from existing `drivers/{cid}/{uid}/allowedServices`
- [ ] Save writes complete `allowedServices` object to Firebase (no partial updates)
- [ ] TM checkbox hidden when company TM flag is off
- [ ] Drivers without `allowedServices` in Firebase are treated as `{ taxi: true }` by dispatch (no change needed on dispatch side — already implemented)
- [ ] No regression: existing drivers with `allowedServices` already set continue to work correctly

---

### No dispatch-side changes needed

The `_bwCanDriverDoService` function and `AutoDispatchVehiclesallride` serviceType filtering are already correct after the Section 23–25 fixes. This section is **owner portal UI only**.


---

## 27. Food/Freight Jobs in Main Unassigned Tab (2026-05-06)

**Requirement from SA:** Food and freight jobs should also appear in the main Unassigned tab, not only the food delivery panel. Job cards should show a food/freight icon badge.

---

### Audit result: ✅ Already fully implemented — no code changes needed

#### Server side — `[UnAssignedJobsv3]` / `buildJobListResponse`

`buildJobListResponse` applies no `serviceType` filter. It returns **all** non-terminal pending jobs regardless of service type:

```js
function buildJobListResponse(jobs) {
  const TERMINAL = new Set(['Dispatched','Done','Cancel','Cancelled','Closed','Completed','No Show','NoShow','Reject']);
  const allNonTerminal = jobs.filter(j => !TERMINAL.has(j.BookingStatus));
  const pendingJobs = allNonTerminal.filter(j => PENDING_ST.has(j.BookingStatus) || isOrphaned(j));
  // ↑ no serviceType exclusion — food and freight jobs are included
  ...
}
```

Food/freight jobs have always been returned by `[UnAssignedJobsv3]`. They were not absent from the main tab because of a server filter — they were absent because the job was never being created correctly (the `serviceType` stripping bug fixed in Section 25).

#### Client side — icon badge markup

The main Unassigned tab job card (Default.aspx ~line 3873) already carries:

```html
<!-- CSS class applied to card wrapper -->
ng-class="{'bw-svc-food': value.serviceType==='food',
           'bw-svc-freight': value.serviceType==='freight', ...}"

<!-- Icon badge inside the card -->
<span ng-if="value.serviceType && value.serviceType !== 'taxi'"
      class="bw-b"
      ng-style="{background: value.serviceType==='food'?'#16a34a':...}">
  <i ng-class="{'fa fa-cutlery':value.serviceType==='food',
                'fa fa-truck':value.serviceType==='freight', ...}"></i>
  {{value.serviceType|uppercase}}
</span>
```

The badge is already rendered — green background + fork icon for food, orange + truck for freight, purple + wheelchair for TM.

#### Driver dropdown in the Unassigned card

```html
<option ng-repeat="drivi in driverdatarealx"
        ng-show="checkDriverSvc(drivi.driverid, (value.serviceType||'taxi'))"
        ...>
```

The manual-assign dropdown already filters to service-capable drivers only via `checkDriverSvc`.

---

### Why jobs now appear correctly

The fix in **Section 25** (Bug B — `AutoDispatchVehiclesallride` stripping `serviceType`) was the root cause of food jobs appearing absent or misfiled. After that fix:

1. Food jobs are created with `serviceType: 'food'` in the job store ✅
2. `buildJobListResponse` returns them in `dt1` for the main Unassigned tab ✅  
3. `buildDeliveryResponse` also returns them for the DY delivery panel ✅  
4. Both job card badges render correctly from the existing markup ✅

**No further dispatch or UI changes are required for this requirement.**


---

## 28. E2E Auto-Dispatch Test — Job 62061126050610 (2026-05-06)

### Firebase audit results

**Job `pendingjobs/620611/62061126050610` — confirmed present:**
```json
{
  "BookingId": "62061126050610",
  "CompanyId": "620611",
  "Status": "Pending",
  "ServiceType": "taxi",
  "PaymentMethod": "cash",
  "WebBooking": true,
  "PickAddress": "165, Inglewood Road, Newfield, Invercargill City...",
  "DropAddress": "Invercargill Airport...",
  "PassengerName": "Abdullah Gul",
  "pickupLocation": { "lat": -46.4285, "lng": 168.3552 },
  "dropoffLocation": { "lat": -46.4124, "lng": 168.313 }
}
```

**`online/620611/TAXI02/current.vehiclestatus` — "Away" (NOT "Available"):**
The dispatch team's claim that the status was fixed to "Available" was not reflected in Firebase at query time. However, browser console logs show a subsequent `[changedata Busy→Available]` event fired for D002/TAXI02 (see below).

---

### Bug found and fixed — `_normFbJob` dropped nested lat/lng (`server.js`)

The web booking portal writes lat/lng as nested objects:
```json
"pickupLocation": { "lat": -46.4285, "lng": 168.3552 }
```
`_normFbJob` only read flat fields (`PickupLat`, `pickupLat`, etc.) — the nested values were silently ignored and the job was stored with `pickLatLng: '0,0'`.

**Fix:** Extended the lat/lng resolution chain to also read from `job.pickupLocation.lat/lng` and `job.dropoffLocation.lat/lng` before falling back to `'0,0'`.

---

### E2E auto-dispatch status — observed from browser console logs

Auto-dispatch IS running and working correctly at the dispatch end:

```
[changedata Busy→Available] stale pre-queue offer for job #6112605063 
   (driver D002 never accepted) — clearing map, re-offering with popup
[acknowledgemethodx] driverid: D002  job: 6112605063
[writeJobDetailsToFirebase] notification written for driver D002 job 6112605063
status: Unreached           ← driver app did not respond within timeout
[smartAutoDispatch] Job #6112605063 — all available drivers tried, resetting loop
[smartAutoDispatch] Job #6112605063 → driver D002 (fbUID:current, car:TAXI02) queue#1
[writeJobDetailsToFirebase] notification written for driver D002 job 6112605063
status: Unreached
```

**Dispatch side is working:** TAXI02/D002 is found as Available, offers are written to `notification/D002` (or `notification/{sqlDriverId}`) in Firebase, and the job cycles correctly on Unreached.

**Blocker is driver-app side:** The driver app is not reading or responding to the offer notification. Each offer times out → `Unreached` → auto-dispatch resets and re-offers.

---

### What the driver app team must check

| Check | Path | Expected |
|---|---|---|
| Notification listener path | `notification/{sqlDriverId}` where `sqlDriverId = D002` | App must listen here, not on Firebase UID |
| Offer acknowledged | App must write `joboffer: 1` or `accept` to Firebase within the offer window | Currently silent → timeout → Unreached |
| Driver status after Unreached | `online/620611/TAXI02/current.vehiclestatus` | Should remain "Available" so re-offer fires |

See **BUG 1** (Section 23) — driver app listener path — and **BUG 4** — message path. Both remain outstanding on the driver app side.

---

### `child_added` re-ingest gap (server-side)

Firebase `child_added` listeners only deliver events for nodes written **after** the listener was attached. Jobs written to `pendingjobs` while the dispatch server is down (or before login) are missed on restart. The job was manually re-ingested via the `[IngestPassengerJob]` admin endpoint using the `X-BW-Test-Company: 620611` dev header. This is the correct recovery procedure until a startup-scan of `pendingjobs` is added.

**Recommended future hardening:** On server startup (or dispatcher login), do a one-time `once('value')` read of `pendingjobs/{cid}` and ingest any `Status: Pending` entries not already in the job store.


---

## 29. Pre-booked Web Booking Showing as ASAP — Root Cause & Fix (2026-05-06)

**Symptom:** A scheduled (future) web booking appeared in the Unassigned panel as an immediate ASAP job with no Sched badge and `DispatchTimebefore: '0'`.

---

### Full flow trace — web portal → Firebase → dispatch

**Step 1 — Web portal writes to Firebase `pendingjobs/620611/{key}`:**
```json
{
  "Status":         "Scheduled",
  "ScheduledFor":   "2026-05-07T02:00:00.000Z",   ← ISO string (pickup time)
  "ScheduledForMs": 1778119200000,                  ← Unix ms (same time — portal writes both)
  "CreatedAt":      "2026-05-07T00:36:11.937Z",    ← booking creation time (different!)
  "BookingDateTime": undefined                       ← not written by portal
}
```

**Step 2 — Dispatcher Firebase `child_added` fires → `[IngestPassengerJob]`:**

`_ipjStatus === 'Scheduled'` → enters the Scheduled branch.

**Step 3 — (BUG) `_sMs` calculated incorrectly:**
```js
// Before
const _sMs = parseInt(_ipjJob.ScheduledFor || ...) || null;
// parseInt("2026-05-07T02:00:00.000Z") = 2026  ← year only, not ms timestamp!
// ScheduledForMs (1778119200000) was never read at all
```

**Step 4 — (BUG) `BookingDateTime` set from creation time, not pickup time:**
```js
// Before
BookingDateTime: _sn.createdAt || new Date().toISOString(),
// → "2026-05-07T00:36:11.937Z"  (when booking was MADE, not when to pick up)
```

**Step 5 — (BUG) `DispatchTimebefore` hardcoded to `'0'`:**
```js
DispatchTimebefore: '0'   // 0 = ASAP — always, even for jobs 12 hours away
```

**Result in the store:**
```json
{ "ScheduledFor": 2026, "BookingDateTime": "...(creation time)...", "DispatchTimebefore": "0" }
```
→ Dispatch window gate sees `DispatchTimebefore === 0` → treats as ASAP → job offered immediately.
→ Sched badge on client checks `ScheduledFor > Date.now()` → `2026 > 1778000000000` → false → no badge.

---

### Fixes applied (`server.js`)

**Fix 1 — `_normFbJob` `scheduledFor` field (line ~754):**
```js
// After — reads ScheduledForMs first, then parses ISO string properly
scheduledFor: (function() {
  const ms = job.ScheduledForMs || job.scheduledForMs;
  if (ms && typeof ms === 'number') return ms;
  const raw = job.ScheduledFor || job.scheduledFor || 0;
  if (!raw) return 0;
  if (typeof raw === 'number') return raw;
  const parsed = new Date(raw).getTime();
  return isNaN(parsed) ? (parseInt(raw) || 0) : parsed;
})(),
```

**Fix 2 — `[IngestPassengerJob]` `_sMs` (line ~5933):**
```js
// After — reuse _sn.scheduledFor which is now correctly resolved
const _sMs = _sn.scheduledFor || null;
```

**Fix 3 — `BookingDateTime` = scheduled pickup time:**
```js
// After
const _bdt = _sMs ? new Date(_sMs).toISOString() : (_sn.createdAt || new Date().toISOString());
BookingDateTime: _bdt,
```

**Fix 4 — `DispatchTimebefore` derived from time-to-pickup:**
```js
// After — start offering 30 min before pickup; offer now if ≤ 30 min away
const _minsToPickup = _sMs ? Math.round((_sMs - Date.now()) / 60000) : 0;
const _dtb = _minsToPickup > 30 ? '30' : '0';
DispatchTimebefore: _dtb,
```

---

### Web portal contract for `pendingjobs`

| Field | Type | Notes |
|---|---|---|
| `Status` | `"Scheduled"` / `"Pending"` | `"Scheduled"` = pre-book; `"Pending"` / `"Waiting"` = ASAP |
| `ScheduledFor` | ISO string | Pickup date-time — always write; dispatch uses this to show Sched badge |
| `ScheduledForMs` | Unix ms (number) | Pickup date-time as ms — write alongside `ScheduledFor` for server to read reliably |
| `CreatedAt` | ISO string | When booking was made — different from pickup time for pre-books |
| `pickupLocation` | `{lat, lng, address}` | Nested object — server now reads `.lat`/`.lng` correctly (Section 28 fix) |
| `dropoffLocation` | `{lat, lng, address}` | Same |

**Recommendation to web portal team:** Always write both `ScheduledFor` (ISO) and `ScheduledForMs` (Unix ms). The server now handles both, but ms is preferred.

---

### Currently bad job in store — remediation

Job `6206112605071` was already ingested with wrong values before this fix. After server restart it must be manually re-ingested:

1. Delete from store via `[CancelJob]` or server restart
2. Re-ingest via `[IngestPassengerJob]` with the correct Firebase record
3. `ScheduledFor` → `1778119200000`, `BookingDateTime` → `"2026-05-07T02:00:00.000Z"`, `DispatchTimebefore` → `'30'`


---

## Section 30 — Dispatch-Console Booking DateTime Bugs (S30)

**Reported:** Job `6112605073` booked for 2:15 PM NZ shows as ASAP. Request for past-date validation message.

### Root causes found and fixed

#### Bug S30-A: Param name mismatch — `DateTime` vs `BookingDateTime`

| | Detail |
|---|---|
| **Client sends** | `{ name: "DateTime", Value: "2026-05-07 14:15:00" }` |
| **Server read** | `param('BookingDateTime')` → `null` → fell back to `new Date()` (current time) |
| **Effect** | Every later-booking had `BookingDateTime = now`, showing as ASAP |
| **Fix** | Both `InsertBookingv4` mock handlers now read `param('DateTime') \|\| param('BookingDateTime')` |

#### Bug S30-B: NZ local time string parsed as UTC by server

The server runs in **UTC**. The browser (NZ = UTC+12) constructs `"2026-05-07 14:15:00"` as a local-time string. `new Date("2026-05-07 14:15:00")` on the UTC server = 14:15 UTC = 2:15 AM NZ next cycle — 12 hours wrong.

**Fix:** New helper `_parseLocalDT(dtStr, companyId)` converts a NZ-local datetime string to the correct UTC ms timestamp using the `sv` locale offset technique (same as `_tzTodayStart`). All `InsertBookingv4` and `[ProcUpdateJobv6]` handlers use this to set `ScheduledFor`.

#### Bug S30-C: `ScheduledFor` not set for dispatch-console later bookings

`calcJobMins` received `BookingDateTime` (display string, NZ local) and parsed it as UTC → 12-hour JobMins error.

**Fix:** `calcJobMins` upgraded to accept a job object and use `ScheduledFor` (UTC ms) when present; falls back to string parse only for legacy jobs. All 5 callsites updated to pass the full job object.

#### Bug S30-D: No past-date guard on the server

**Fix (server):** Both `InsertBookingv4` handlers: if `ScheduledFor < now - 90s` and `DispatchTimebefore > 0`, return `{ Result: 'Error: The pickup time is already in the past...', Error: true }` and do NOT create the job.

**Fix (client):** Both `updateride` + `updateride2` success callbacks now check `$res[0].Error` and show `Swal.fire('Booking Failed', ...)` so the dispatcher sees a clear modal explaining the rejection.

Note: Client-side past-date validation (`Swal.fire('Invalid Time!', ...)`) was already present at both booking paths — these are the first line of defence.

### Summary of files changed

| File | Change |
|---|---|
| `server.js` | `_parseLocalDT()` helper added; `calcJobMins()` upgraded; both `InsertBookingv4` handlers read correct param, set `ScheduledFor`, guard past dates; `[ProcUpdateJobv6]` edit handler updates `ScheduledFor` on time change |
| `Default.aspx` | Both booking success callbacks show `Swal.fire` error when server rejects with `Error: true` |

### Company timezone contract

`_parseLocalDT(dtStr, companyId)` reads from `companyTZMap` (line 8–10 of `server.js`). To add a new company:

```js
const companyTZMap = {
  '620611': 'Pacific/Auckland',
  'NEW_ID': 'Pacific/Auckland', // or Australia/Auckland etc.
};
```

When the SA portal approves a new company it must also ensure the correct IANA timezone is in `companyTZMap`.

