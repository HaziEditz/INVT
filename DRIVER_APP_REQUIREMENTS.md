# Driver-App Data Contract — what dispatch needs you to transmit

This document lists every piece of trip telemetry the BookaWaka dispatch console
wants to display on the closed-job detail panel for dispute resolution, billing
verification, and audit. For each field it states:

  * **What** it is
  * **Source today** — where (if anywhere) dispatch can read it now
  * **Required driver-app change** — what the driver app must do to make the
    field reach dispatch reliably

If a row says **NO TRANSMISSION**, that field will stay blank on the closed-job
detail until the driver app is updated, no matter what the server does.

---

## 1. GPS route trail   (server-side fix — DONE, no driver-app change)

The driver app already writes `Lat / Lng / Speed` to
`online/{companyId}/{vehicleId}/current` every few seconds. As of §FIX-Q
the dispatch server polls that node every 10 s while a job is Active /
Picking and stamps an encoded polyline (`RoutePolyline`) onto the closed
job. The closed-job map renders it automatically.

No driver-app change required. Just keep writing `Lat / Lng / Speed /
currentJobId` to `online/{cid}/{vid}/current` as today.

---

## 2. Waiting time & waiting cost   (driver-app change REQUIRED)

The driver taps a "Waiting" button in the app, the app accumulates the time
locally and adds the cost to the on-screen total. **None of this is sent to
dispatch.** Cur `online/current` keys observed: `AppVersion, CompanyId,
GpsStatus, Lat, Lng, PhoneNo, PlayerId, Speed, VehicleId, VehicleSpeed,
currentJobId, driverid, drivername, jobpickup, jobdropoff, joboffer,
lastSeen, online, time, zoneid, zonename, zonequeue` — no `WaitingTime`,
no `WaitingCost`.

**Required:** at trip completion, the driver app must POST or write the
following fields. Recommended path: extend the existing `/api/syncOfflineTrip`
POST (already used for dispatch-created trips) to also fire for hail trips,
with these extra fields:

```
WaitingTime    : minutes (integer)        e.g. 4
WaitingCost    : dollars (float, 2 dp)    e.g. 4.00
WaitingStarts  : [{ at: ISO, durMin: n }] — optional log of each waiting tap
                  for audit (preferred for dispute resolution)
```

---

## 3. Tariff changes mid-trip   (driver-app change REQUIRED)

Driver can switch tariff (Standard / Night / Out-of-town / etc.) before
starting the trip OR during the trip. None of these changes are
transmitted today.

**Required:** at every tariff change the driver app should write to:

```
online/{cid}/{vid}/current/CurrentTariffId        — the live tariff id
online/{cid}/{vid}/current/TariffLog              — append-only:
  [{ tariffId, tariffName, at: ISO, where: "preTrip"|"midTrip" }]
```

At trip completion include the full `TariffLog` in the syncOfflineTrip POST
so dispatch can show **every** tariff used and the timestamp of each switch.
This is the single biggest anti-fraud signal — without it a driver can run
an expensive Night tariff for a daytime trip and dispatch can't see it.

---

## 4. Payment method   (driver-app change REQUIRED)

Today dispatch only ever sees `paymentMethod = "cash"` for hail trips
(default) and the original booking method for dispatch trips. The driver
app supports cash / card / eftpos / account / Total Mobility (TM) /
ACC / gift card / split — none of these reach dispatch.

**Required:** at trip completion include in syncOfflineTrip:

```
PaymentMethod  : "cash"|"card"|"eftpos"|"account"|"tm"|"acc"|"gift"|"split"
PaymentSplits  : (only if PaymentMethod="split") an array of:
                 [{ method, amount }]   e.g.
                 [{ method:"cash", amount:8.00 }, { method:"card", amount:5.00 }]
TmVoucherNo    : string  (only if PaymentMethod="tm")
AccClaimNo     : string  (only if PaymentMethod="acc")
GiftCardCode   : string  (only if PaymentMethod="gift")
PaymentSettled : true|false   — true = settled with driver (cash/eftpos/card-in-car)
                                false = needs dispatch to charge (online card)
```

The dispatch UI uses `PaymentSettled` to decide whether to show the purple
"Take Payment" button. Setting it correctly removes the confusion the user
reported ("button shouldn't appear when already paid cash to driver").

---

## 5. Fixed-price / custom-price overrides   (driver-app change REQUIRED)

If the driver agrees a flat price with the passenger (common for airport
runs) or enters a custom total at the end of the trip, dispatch never sees
the override — it still shows the metered fare.

**Required:** in syncOfflineTrip add:

```
FixedPrice     : true|false                 — true if a flat fare was agreed
CustomTotal    : float (2 dp)               — the price actually charged
PriceOverrideReason : "fixedFlatFare"|"manualAdjustment"|"discount"|"other"
PriceOverrideNote   : free-text note (optional)
```

When `CustomTotal` is set, the dispatch UI will show **both** the metered
total (struck through) and the custom total, plus the reason — exactly
what's needed for dispute resolution.

---

## 6. Comments / passenger notes / driver notes

* Job-creation comments (booked via dispatch or website or passenger app)
  ARE transmitted today via `Comments` / `CustomerNote` fields on the
  original booking record. Dispatch renders them.
* **Driver-side notes added during or after the trip are NOT transmitted.**

**Required:** in syncOfflineTrip add:

```
DriverNote     : free-text (e.g. "passenger left bag in boot")
TripIssueFlag  : "none"|"vomit"|"damage"|"noShow"|"refused"|"other"
TripIssueNote  : free-text (only when TripIssueFlag !== "none")
```

---

## 7. Service-type fields (food / freight / rental / towing)

User has not yet tested food/freight/rental/towing closed jobs, so the
exact field gaps are unknown. The general rule applies: any data shown to
the driver in the app must be sent to dispatch at completion, otherwise
the closed-job detail will show blanks.

**Minimum recommended fields** (in addition to the standard fare/payment block):

| Service   | Extra fields                                                            |
|-----------|-------------------------------------------------------------------------|
| Food      | `RestaurantName`, `OrderRef`, `ItemCount`, `PackagingFee`, `DeliveryFee`|
| Freight   | `FreightWeightKg`, `FreightDimensionsCm`, `ItemDescription`, `Recipient`, `RecipientSig` |
| Rental    | `RentalStart`, `RentalEnd`, `Odometer:{start,end}`, `FuelLevel:{start,end}`, `DamageReport` |
| Towing    | `VehicleTowed:{plate,make,model}`, `TowReason`, `TowFromOdometer`, `TowToOdometer`        |

---

## Summary of what HQ must add to the driver app

A single OTA update that, **on trip completion**, POSTs the existing
`/api/syncOfflineTrip` endpoint (already wired for dispatch trips) with the
extra fields listed above, **AND** triggers it for hail trips too (today it
only fires for dispatch-assigned trips). That single change unblocks every
remaining item on the closed-job detail panel.

For tariff changes specifically, also write `CurrentTariffId` and
`TariffLog` to `online/{cid}/{vid}/current` *during* the trip so dispatch
can show live tariff state on the active-job map, not just at completion.
