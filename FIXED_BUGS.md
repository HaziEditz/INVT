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
| MID-OFFER-BOUNCE | Mid-offer false **"Network issue — driver unreachable"** bounce despite live phone | INVT `f22bfe4` (Firebase-truth `lastSeen` before bounce); INVT-APP2 `a4e655b` / `b814496` (5s offer-pending heartbeat incl. Offer-tab broadcasts); guards: `tests/regression/zzz-mid-offer-network-bounce.test.mjs`, `tests/regression/network-offer-bounce.test.mjs`, INVT-APP2 `tests/presence-offer-heartbeat.test.mjs` |
| LOGIN-SEQ-RACE | Fresh login advertises **Available** before GPS/`readyForJobs` → silent list offer then network bounce | INVT-APP2 `7100929` — `lib/shiftOfferSequencing.ts`; guard: `tests/shift-offer-sequencing.test.mjs` |
| MISSED-OFFER-AWAY | Missed exclusive offer does not restore driver to **Away** | INVT `f61425b`; INVT-APP2 `1f421db` (timeout stays alive offline until server confirms `driverSetAway`) |
| BUSY-POOL-STALE | When all **Available** candidates are network-stale, job never reaches busy Offer tab | INVT `f61425b` — `busy_pool_broadcast` / `pendingjobs` fanout; guard: `tests/regression/network-offer-bounce.test.mjs` (`busy_pool_broadcast`) |
| CLOSED-JOB-FARE-EMPTY | Closed Job detail showed Flag fall/Distance/Waiting/Total as **—** (and empty Timeline) despite `/api/closed-job-detail` returning rich `fareBreakdown`/`stepTimes`. Truthy empty `{}` fare object fed `FareBreakdownCompact` (`money(undefined)` → `—`); `??` re-parse was blocked. Also: `completedJobs` empty nested objects could wipe `allbookings` meter fields on merge. | INVT `4d3e02f` (render/`fareHasDisplayValues`); `c389fbc` (`mergeClosedDetailRaw`); guards: `tests/regression/closed-job-detail-parse-merge.test.mjs`, `tests/regression/closed-job-detail-fetch-gate.test.mjs` |

When fixing a recurring bug, add a row here and a dedicated regression test when possible.

---

## Offer / presence — confirmed fixes

| ID | Bug / fix | Repo / commit |
|----|-----------|---------------|
| MID-OFFER-BOUNCE | Mid-offer network bounce: server treats **live Firebase `lastSeen` as truth** (ZONE lag alone must not bounce); phone stamps `lastSeen` every **5s** while any offer is pending (modal **or** Offer-tab broadcast), and preserves offer-pending across heartbeat restart | INVT `f22bfe4` (`_refreshOfferedDriverLastSeenFromFirebase`); INVT-APP2 `a4e655b`, `b814496` |
| LOGIN-SEQ-RACE | Login sequencing: bootstrap as **Away**, advertise **Available** only after GPS + presence write + `readyForJobs`, then flush deferred popup | INVT-APP2 `7100929` |
| MISSED-OFFER-AWAY | Missed exclusive offer → restore **Away** (server timeout path; phone keeps timeout alive while offline) | INVT `f61425b`; INVT-APP2 `1f421db` |
| BUSY-POOL-STALE | Busy-driver offer queueing: if every Available candidate is network-stale, fan out to eligible **Busy** drivers via `pendingjobs` / busy Offer tab | INVT `f61425b` |

---

## Driver app — permanent features

| ID | Feature | Repo / commit |
|----|---------|---------------|
| BUILD-LABEL | Visible build version + short git SHA on **login** and **Profile** (`vX.Y.Z · <sha>`), injected via `app.config.js` | INVT-APP2 `2bb2c7a` — `AppBuildLabel`, `lib/appBuildInfo.ts`; guard: `tests/app-build-info.test.mjs` |

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
