# Confirmed fixed bugs — regression guard list

Run **`npm run test:regression`** (full suite, all tests) before every push. Do not push after testing only the change in isolation.

| ID | Bug | Guard test / commit |
|----|-----|---------------------|
| TARIFF-STD | Hardcoded **"Standard"** placeholder tariff leaks into dispatch/driver UI for company **860869** | `tests/regression/tariff-standard-guard.test.mjs`; driver app: `lib/tariffResolve.ts` + meter/booking sync |
| DRIVER-WITHDRAW | Driver app keeps active job after dispatch unassigns (`jobs/` deleted, `currentJobId` null) | INVT-APP2 `lib/activeJobPresenceWatch.ts` |
| DISPATCH-OFFER-STUCK | Offer tab job stuck after recall/cancel until manual refresh | `src/lib/jobPoolSync.ts` offer-awaiting purge |
| DISPATCH-REFRESH | Dispatch tabs do not auto-refresh after status changes | `useJobs.ts` `dispatchConsole/refresh` listener |
| DD002-DISPLAY | Vehicle **DD002** shown instead of **D002** on driver cards | `src/types/driver.ts` — commit `7ffff99` |
| QUEUE-FANOUT | Late Offered Firebase write wins over Queued fanout | `server.js` queue fanout — commit `7ffff99` |
| ASSIGN-DROPDOWN | Assign tab dropdown shows wrong drivers / missing No One | `JobCard.tsx` — commit `e02fc62` |
| UNASSIGN-BOUNCE | Unassign bounces job back to Assign tab | `useJobs.ts` `refreshTrustsPoolRestore` — commit `e02fc62` |

When fixing a recurring bug, add a row here and a dedicated regression test when possible.

---

## SOS — confirmed features (Phases 3–4)

**Regression guard:** `tests/regression/sos-emergency.test.mjs` (trigger → ack → resolve, driver cancel, `notificationSos` fanout); `tests/regression/client-driver-auth.test.mjs` (SOS auth contract).

### Firebase deploy (required)

Rules for **`notificationSos`**, **`Emergency`**, and **`sosHistory`** live in `database.rules.json`. After any rules change, deploy before device testing:

```bash
firebase deploy --only database
```

Without this deploy, nearby drivers may not receive SOS alerts (`notificationSos/{driverId}` permission denied). The server falls back to writing `notification/{driverId}`, but the dedicated SOS path is preferred and requires the deploy.

---

### Phase 3 — driver trigger & dispatch awareness

| ID | Feature | Repo / commit |
|----|---------|---------------|
| SOS-P3-TRIGGER | Double-tap SOS button with countdown before send | INVT-APP2 `components/SosButton.tsx` — `3fed7bf` |
| SOS-P3-COUNTDOWN | 5-second cancel window; tap again to abort | INVT-APP2 `components/SosButton.tsx` — `3fed7bf` |
| SOS-P3-BANNER | Dispatch SOS banner with pulsing alert on active incident | INVT `src/pages/Dispatch.tsx`, `server.js` — `4d62182` |
| SOS-P3-PHONE | Driver phone on dispatch banner (tap-to-call) | INVT `server.js`, `SosIncidentCard.tsx` — `8542195` |
| SOS-P3-STATUSBAR | SOS button in status bar (not buried in a single tab) | INVT-APP2 `components/SosButton.tsx` — `89bd187` |
| SOS-P3-PROFILE | SOS button backup position on Profile tab | INVT-APP2 profile layout — `89bd187` |
| SOS-P3-HISTORY | Resolved/false-alarm SOS history in dispatch Alarms modal | INVT `GET /api/sos/history`, `AlarmsModal.tsx` — `8542195` |
| SOS-P3-CANCEL | Driver can cancel own active SOS before dispatch resolves | INVT `POST /api/driver/sos/cancel` — `tests/regression/sos-emergency.test.mjs` |

---

### Phase 3.5 — SOS during active work

| ID | Feature | Repo / commit |
|----|---------|---------------|
| SOS-P35-ACTIVE | SOS available while driver is on an active trip (Busy) | INVT-APP2 `edcf4a4` |
| SOS-P35-HAIL | SOS available during hail / street-hail flow | INVT-APP2 `edcf4a4` |

---

### Phase 4 — nearby response & multi-incident dispatch

| ID | Feature | Repo / commit |
|----|---------|---------------|
| SOS-P4-ALLTABS | SOS accessible from all driver tabs (not tab-locked) | INVT-APP2 `f077a88` |
| SOS-P4-NOTIFY | Nearby Available drivers receive `notificationSos` fanout on trigger | INVT `server.js` `_fanoutSosToNearby` — `56436af`; test: `sos-emergency.test.mjs` |
| SOS-P4-NOTIFY-FB | Fallback to `notification/{driverId}` when `notificationSos` rules not deployed | INVT `server.js` — `56436af`; INVT-APP2 listener — `2ad7843` |
| SOS-P4-MAP | Responder map screen with SOS location + user position | INVT-APP2 `app/sos-alert.tsx` — `f077a88` |
| SOS-P4-DEEPLINK | Push notification tap / cold-start opens SOS map screen | INVT-APP2 `SosNotificationBootstrap.tsx` — `f077a88` |
| SOS-P4-GOING | "Going to help" registers responder on `Emergency.responders` | INVT `POST /api/sos/respond` — `56436af`; INVT-APP2 `lib/dispatchApi.ts` |
| SOS-P4-UI-3STATE | Responder three-state UI: offer → **You are responding** → resolved | INVT-APP2 `app/sos-alert.tsx` — `841dd76` |
| SOS-P4-WITHDRAW | Cancel response backs responder out (`POST /api/sos/respond/withdraw`) | INVT `1923a5e`; INVT-APP2 `841dd76` |
| SOS-P4-ARRIVED | Arrived / Handled self-resolve clears responder screen without waiting for dispatch | INVT `POST /api/sos/respond/arrived` — `1923a5e`; INVT-APP2 `841dd76` |
| SOS-P4-MULTI | Multiple simultaneous SOS incidents shown as independent dispatch cards | INVT `SosIncidentCard.tsx`, `uiStore.ts` — `56436af` |
| SOS-P4-ACK | Per-incident Acknowledge (multi-active alarm logic) | INVT `POST /api/sos/acknowledge` — `56436af` |
| SOS-P4-RESOLVE-CLEAR | Resolve/false-alarm fans out `sos_resolved` and auto-clears responder alert | INVT `b7b4159`; INVT-APP2 `SosIncidentRelease.tsx` — `659cede` |
| SOS-P4-STALE | Stale SOS notifications filtered on login/shift start (no replay of resolved incidents) | INVT-APP2 `lib/sosEmergency.ts`, `DriverContext.tsx` — `841dd76` |
| SOS-P4-WORDING | Dispatch responder line: "on the way" vs "arrived / handled" | INVT `SosIncidentCard.tsx` — `b7b4159`, `1923a5e` |
