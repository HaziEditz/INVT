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
| `jobDetails/{cid}/{bookingId}` | Dispatcher | Passenger app | Full job payload including vehicleId. Passenger app uses vehicleId to build GPS tracking path. |
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

---

## 4. Job ID Contract

| Item | Expected | Dispatcher | Passenger app | Driver app |
|---|---|---|---|---|
| Canonical job ID source | `POST /api/job/create` → `{ jobId }` → passed as `ExternalJobId` to SQL | ✅ called on every booking create | ⬜ called on passenger booking? | n/a |
| Fallback if `/api/job/create` fails | **None — do not create local IDs** | ✅ booking fails cleanly | ⬜ | n/a |
| Firebase job key | Must match SQL bookingId | ✅ | ⬜ | ⬜ |

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

⚠️ Path is `superClients/{cid}/sessionRevoke` — NOT `companies/{cid}/sessionRevoke`. Other teams writing to the wrong path will not trigger sign-out.

---

## 8. Known Open Gaps (Parked)

| Gap | Impact | Owner | Status |
|---|---|---|---|
| SA master report reads only `completedJobs` — not `allbookings` | Revenue/trip counts understated for dispatched jobs | SA portal dev | Parked — fix when report is next touched |
| Food order real-time status (`foodOrders/{cid}`) | Passenger app can't track food orders | Passenger app + SA portal | Parked — paths documented, ready to scope |
| Freight post-booking tracking | Same | Passenger app + SA portal | Parked |
| Card commission / net payout deduction (`companies/{cid}/cardSettings`) | Owner portal + SA portal revenue inaccurate | Owner portal + SA portal | Parked |
