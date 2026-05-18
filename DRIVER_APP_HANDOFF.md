# Driver App — Hand-off from BookaWaka Dispatch (May 2026)

This document captures three driver-app changes the dispatch console team
**cannot** fix from the server side. Each issue is backed by hard server +
browser-console log proof from a real end-to-end test (test ID: trip
`6112605185`, driver `D002`, vehicle `TAXI02`, cid `620611`,
timestamps `1779090083` through `1779090582`).

---

## Background

The dispatch console has shipped a sequence of fixes (`§FIX-A` through
`§FIX-Q`, see `replit.md`) that fully resolve the server-side
"Assigned → No One → back to Pending → re-dispatch" loop. On the latest
test the server log proves the full chain fires correctly:

```
[UnAssignJobStatusFromJobList] §FIX-F2 job#6112605185 prevDriverId='D002' hadDriver=true → BookingStatus='No One' (manualOffer cleared)
[UnAssignJobStatusFromJobList] driver D002 → Available q=1 zone="Hail"
[UnAssignJobStatusFromJobList] §FIX-P Firebase online/620611/TAXI02/current → Available (mirrored)
[UnAssignJobStatusFromJobList] §FIX-Q notification/D002 → Job Cancel written
[UnAssignJobStatusFromJobList] §FIX-Q jobs/620611/TAXI02/D002 → set (refs #6112605185)
[§FIX-A2/ProcUpdateJobv6] §FIX-O explicit Pending: ... clearing driver/vehicle/releasedAt/manualOffer
[smartAutoDispatch] Job #6112605185 → driver D002 (fbUID:..., car:TAXI02) queue#1
```

After this the dispatch console writes a **fresh Offered entry** to
`jobs/620611/TAXI02/D002` and a fresh `notification/D002` payload. The
driver app, however, does **not** clear its UI, does **not** show the
"job cancelled" toast, and does **not** show the new offer popup. After
27 seconds the dispatch console marks the driver Unreached and moves on
(`§FIX-U2`). On a single-driver tenant this means the trip stalls
until the driver app is restarted.

---

## Issue 1 — Dedup offers by `bookingId + offeredAt`, not just `bookingId`

### Symptom
After a job is unassigned and re-offered to the same driver, the driver
app silently ignores the new offer. No popup, no sound. 27 s later the
dispatch console gives up on the driver.

### Proof
Browser console (the dispatch console listens to the same Firebase path
the driver app does):

```
1779090083636  jobs/620611/TAXI02/D002 → Offered  (offeredAt: 1779090083636)
1779090087539  jobs/620611/TAXI02/D002 → DriverAccepted
1779090088300  pendingjobs/620611/6112605185 → Assigned (driver D002)
1779090537219  dispatcher unassigns + clicks Pending
1779090554266  jobs/620611/TAXI02/D002 → Offered  (offeredAt: 1779090554266)   ← NEW OFFER
1779090582032  *** 27s NO-RESPONSE FIRING *** jobackVal=null jobsNodeVal=null
```

Both offers are bookingId `6112605185`. They differ on `offeredAt`. If
the driver app keys its "have I seen this offer" set by `bookingId`
alone, the second offer is dropped on the floor.

### Fix
Track the seen-set as `{bookingId, offeredAt}` tuples (or just the
`offeredAt` epoch). The dispatch console always writes a fresh
`offeredAt` on every new offer — even if the bookingId repeats.

---

## Issue 2 — Honour the `notification/{driverId}` "Job Cancel" payload

### Symptom
When the dispatcher takes a job from the driver, the driver app should
show a "Job Cancelled" toast (and ideally clear the active-job screen).
Currently nothing happens — the job just disappears.

### Proof
Server log:
```
[UnAssignJobStatusFromJobList] §FIX-Q notification/D002 → Job Cancel written
```

The dispatch server now writes (mirroring the existing client-side
`FnCancelRide` flow):

```
notification/{driverId} = {
  bookingid: "<id>,Job Cancel,<driverId>,Server,Dispatcher",
  content:   "Passenger Cancel"
}
```

(The legacy client-side path wrote this exact shape from
`Default.aspx:8475` — `FnCancelRide`. Server now writes it server-side
so every caller of `[UnAssignJobStatusFromJobList]` triggers a notify.)

### Fix
The driver app's `notification/{driverId}` listener should:
1. Parse the `bookingid` field (comma-separated:
   `"<bookingId>,Job Cancel,<driverId>,<source>,<role>"`).
2. If the active-job screen is showing this bookingId, clear it +
   show "Job Cancelled" toast + play cancel sound.
3. Acknowledge by deleting the node, so the dispatch console knows
   the message was received (the existing flow on the dispatch side
   already cleans up `notification/{driverId}` for completed jobs;
   driver-app read-and-delete is the right pattern here).

---

## Issue 3 — Honour `jobs/{cid}/{vid}/{drv}` going to `Status:'Cancelled'`

### Symptom
Same as Issue 2 — belt and braces. The dispatch server now also writes
`jobs/{cid}/{vid}/{drv}` to `{Status:'Cancelled', BookingId:'<id>'}` as
a second signal that the offer/acceptance has been pulled.

### Proof
Server log:
```
[UnAssignJobStatusFromJobList] §FIX-Q jobs/620611/TAXI02/D002 → set (refs #6112605185)
```

Browser console (the listener seeing the post-write node):
```
jobs/620611/TAXI02/D002 = {BookingId:"6112605185", Status:"Cancelled", ...}
```

### Fix
The driver app's `jobs/{cid}/{vid}/{drv}` listener should treat a
transition to `Status:'Cancelled'` (where the bookingId matches the
currently-displayed active job) the same as Issue 2 — clear UI, toast,
sound.

---

## Issue 4 (related) — Heartbeat presence on every "Available" tap

Not blocking the immediate test, but recommended for robustness:

When the driver taps "Available" on the driver app, write a fresh
`online/{cid}/{vid}/current` with `vehiclestatus:'Available'` + cleared
job fields. The dispatch console's `smartAutoDispatch` reads this node
to decide who is available; if the driver app keeps writing stale
state, the dispatch server fights with it (this is exactly what `§FIX-P`
addresses on the dispatch side, but mutual cooperation makes it bulletproof).

---

## Verification path

Once Issues 1–3 are shipped, re-run the test:

1. Driver accepts a job → Assigned.
2. Dispatcher takes the job to No One on the Assign tab.
3. Driver phone shows "Job Cancelled" toast (Issue 2 + 3).
4. Dispatcher opens Edit form → Pending → Save.
5. Within ~10 s, driver phone shows the **new offer popup** for the
   same trip (Issue 1).
6. Driver accepts → trip continues normally.

If steps 3 and 5 both succeed without driver-app logout/login, the
hand-off is complete.

---

## Contact

- Dispatch fixes are documented in `replit.md` under `§FIX-A`..`§FIX-Q`.
- Server log filter for end-to-end trace: `grep "§FIX-\|smartAutoDispatch\|writeJobDetailsToFirebase"`.
- Real test logs available in workflow `Start application`.

---

## §FIX-UB — Booking update lifecycle (May 2026)

Server now emits granular, per-booking update events. The driver app must
read them per booking instead of treating any change as a full reset.

### New Firebase path: `bookingEvents/{cid}/{bookingId}`

Append-only event log per booking. Each push-key record contains:

```
{
  type:  "PickupChanged" | "DropoffChanged" | "StopAdded" | "PassengerNoteChanged"
       | "PassengerInfoChanged" | "FareChanged" | "ScheduleChanged" | "JobUpdated"
       | "BookingCancelled" | "BookingRecalled",
  diff:  { fieldName: { from, to }, ... },
  by:    "dispatcher" | "passenger" | "website" | "driver" | "system",
  at:    "2026-05-18T14:00:00.000Z",
  atMs:  1779114000000,
  seq:   <monotonic sequence number>
}
```

- Server trims to the last 50 events per booking.
- Driver app should subscribe (`child_added`) only while the booking is
  visible (Offered / Assigned / Picking / OnTrip / Active / Queued).
- Use the `seq` field for ordering and de-duplication — never the push
  key alone.

### Notification payload shape change

`notification/{drv}` for update events now carries explicit type + seq:

```
{
  bookingid: "<id>,<type>,<drv>,<by>,Dispatcher",
  content:   "Booking <type>",
  type:      "PickupChanged" (etc.),
  seq:       <number>,
  bookingId: <number>
}
```

The legacy `Job Cancel` notification (§FIX-Q) is unchanged. New events
add fields but don't break the existing parser — `bookingid` stays the
authoritative comma-joined key.

### What the driver app MUST NOT do anymore

- Do not treat an update notification as a session/state reset.
- Do not clear the active trip when an update lands on a queued/offered
  sibling booking.
- Do not assume `pendingjobs/{cid}/{bookingId}` field changes are full
  rewrites — server only PATCHes changed fields, and `_seq` tracks the
  version.

### Race-safety contract

- `pendingjobs/{cid}/{bookingId}._seq` is the monotonic source-of-truth
  sequence number per booking.
- If the driver app posts back an edit (currently unsupported but planned),
  it must include the `ifSeq` it saw — stale edits will be rejected by
  the server with HTTP 409.
- `BookingCancelled` / `BookingRecalled` always bump `_seq`, so any
  in-flight edit attempted against a stale `_seq` is automatically
  refused — this closes the resurrect-cancelled-job race.
