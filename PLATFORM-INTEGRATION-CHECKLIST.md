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
| `allbookings/{cid}/{bookingId}` | Passenger app | Server (recall fallback), SA portal | Long-term booking store. SA master report does NOT read this yet — understated revenue. |
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
| `driverRatings/{cid}/{bookingId}` | Driver app / Passenger app | SA portal | Not read by dispatcher — no change needed. |
| `freightOrders/{cid}/{bookingId}` | Driver app | SA portal | Freight pickup/delivery confirmation. Not read by dispatcher. |
| `foodOrders/{cid}` | Passenger app | SA portal | Food order real-time status. Parked — not yet in scope. |

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
| Cross-team E2E test session | All 6 teams | Schedule when teams are available — Sections 2–8 have the exact steps |
| Net payout deduction (`companies/{cid}/cardSettings`) | SA portal + owner portal | Parked — joint feature, ship together |
| Freight POD photo / signature | All teams | Future feature — field names to be agreed before any team builds |
| `contactInquiries` SA reader | SA portal | Future sprint, low priority |
