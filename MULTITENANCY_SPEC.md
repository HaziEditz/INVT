# BookaWaka — Multi-Tenancy Data Isolation Specification

> **For operators of the Super Admin Replit, Admin/Owner Panel Replit, and Driver App Replit.**
> This document describes the full multi-tenancy architecture used by the Dispatch Console Replit.
> Every other Replit in the BookaWaka system must follow the same rules so that companies
> never see each other's data.

---

## The Core Concept

Every approved taxi company has a **companyId** — a 6-digit number generated at approval time
(e.g. `417942`). This is the single key that isolates one company from another.

All data — jobs, drivers, messages, suspensions — must be **tagged** with a `companyId` when
written, and **filtered** by `companyId` when read.

---

## How a Company Gets Its companyId

1. Company registers via `DispatcherLogin.aspx` → `POST /api/register`
2. Super Admin approves the registration → `POST /admin/registrations/:id/approve`
3. At approval the Dispatch Console server:
   - Generates a unique 6-digit `companyId`
   - Writes `adminAccess/{companyId}/{ownerUid} = true` to Firebase
   - Writes `users/{ownerUid}/companyId = companyId` to Firebase
   - Writes `users/{ownerUid}/companyName = companyName` to Firebase
   - Stores the `companyId` on the registration record in `.data/registrationRequests.json`
   - Starts a 10-day free trial clock

---

## Session Cookie (BW_SID)

After login the Dispatch Console issues an **HMAC-signed HttpOnly cookie** called `BW_SID`:

```
BW_SID = base64(companyId.expiry.hmac)
```

- **Algorithm**: HMAC-SHA256 with a server secret
- **TTL**: 7 days
- **Flags**: `HttpOnly; SameSite=None; Secure; Path=/`
- **SameSite=None** is required because the Replit workspace embeds the app in a cross-origin iframe

The server validates this cookie on **every request** to determine which company the caller belongs to.

### Login endpoint

```
POST /api/session/login
Body: { companyId: "417942", uid: "firebase-uid" }
Response: 200 { ok: true, companyId } + Set-Cookie: BW_SID=...
```

The login page calls this after Firebase auth succeeds. The server verifies the `companyId`
exists in the registration store before issuing the token.

---

## What Is Isolated (and How)

### Jobs

| Store | Isolation |
|-------|-----------|
| Active jobs (`jobStore`) | Each job tagged `companyId`. Reads filtered by `companyJobs()` |
| Closed jobs (`closedJobStore`) | Same tagging, same filter |
| `JobsCount` stats | Filtered |
| `ClosedJobs` history | Filtered |
| `SearchJobs`, `SearchJobDateBetween` | Filtered |

**On every job write**, tag the job:
```js
jobStore.push({
  // ...all job fields...
  companyId: sessionCompanyId || '',
});
```

**On every job read**, filter:
```js
function companyJobs(store) {
  if (!sessionCompanyId) return store; // backward-compat fallback
  return store.filter(j => !j.companyId || j.companyId === sessionCompanyId);
}
```

---

### Drivers (ZONE_DRIVERS)

| Action | Isolation |
|--------|-----------|
| Driver logs in (`[DriverStatusChanged]`) | Tag entry with `companyId` |
| Post-restart recovery push | Tag entry with `companyId` |
| Auto-expire suspension restore | Preserve `companyId` from suspension record |
| `VehiclesStatus` — count & dt6 list | Filter by `companyId` |
| `[KickDriver]` | Only kick own-company drivers |
| `[DispatcherKickUsers]` | Only suspend own-company drivers |
| Queue number calculation (`maxQ`) | Must only count own-company drivers |

**On every ZONE_DRIVERS.push:**
```js
ZONE_DRIVERS.push({
  driverid, VehicleId, drivername, vehiclenumber,
  vehicletype, zonename, zoneid, vehiclestatus,
  zonequeue, lat, lng, queueWaitSince,
  companyId: sessionCompanyId || '',  // ← required
});
```

**Filter helper:**
```js
function companyDrivers(store) {
  if (!sessionCompanyId) return store;
  return store.filter(d => !d.companyId || d.companyId === sessionCompanyId);
}
```

---

### Suspended Drivers (SUSPENDED_DRIVERS)

| Action | Isolation |
|--------|-----------|
| `[DispatcherKickUsers]` write | Tag with `companyId` |
| `[GetSuspendedDrivers]` read | Filter by `companyId` |
| `[UnsuspendDriver]` | Only unsuspend own-company drivers |
| Auto-expire restore | Preserve `companyId` → pass to ZONE_DRIVERS |

**On SUSPENDED_DRIVERS.push:**
```js
SUSPENDED_DRIVERS.push({
  driverId, vehicleId, drivername, vehiclenumber,
  vehicletype, zonename, suspendedAt, suspendedUntil,
  companyId: sessionCompanyId || '',  // ← required
});
```

---

### Messages (messageStore)

| Action | Isolation |
|--------|-----------|
| Dispatcher → Driver direct message | Tag with `companyId` |
| Driver → Dispatcher message | Tag with `companyId` |
| `[BroadcastMessage]` | Only broadcast to own-company drivers; tag messages |
| `[GroupMessage]` | Only group-message own-company drivers; tag messages |
| `[RetrieveMessages]` | Only show own-company drivers' chats |
| `[DispatcherUnReadMessages]` | Filter by `companyId` |
| `buildDriverChatList()` | Accept `cid` param and filter both drivers and messages |

**On every messageStore.push:**
```js
messageStore.push({
  Id, SenderId, ReceiverId, SenderName, Message, Date, Time, IsRead,
  companyId: sessionCompanyId || '',  // ← required
});
```

---

## Firebase Realtime Database Paths

Firebase uses hierarchical paths that are already company-scoped. **Always use the companyId in paths:**

| Data | Path |
|------|------|
| Company owner access | `adminAccess/{companyId}/{uid}` |
| User's company | `users/{uid}/companyId` |
| Online drivers | `online/{companyId}/{driverId}` |
| Zone assignments | `zones/{companyId}/...` |
| Tariff zones | `tariffZones/{companyId}/...` |

**The driver app must write to `online/{companyId}/...`** — not `online/{driverId}`.
The dispatcher reads from `online/{companyId}/...` to get that company's live drivers.

---

## Account Status & Trial

The Dispatch Console exposes an endpoint all other Repls can query:

```
GET /api/account-status?email=owner@company.com
GET /api/account-status?companyId=417942
```

Response:
```json
{
  "status": "active|trial|grace|suspended|rejected",
  "companyId": "417942",
  "company": "ABC Taxis",
  "trialEnd": "2026-05-05T00:00:00.000Z",
  "daysLeft": 8,
  "isActive": true
}
```

Use this to gate access in:
- **Admin/Owner Panel**: check status before allowing the owner to log in
- **Driver App**: check status before allowing drivers to connect
- **Super Admin**: display account health dashboard

---

## What the Other Repls Need to Do

### Super Admin Replit

- Use `X-Admin-Key` header for all admin API calls to the Dispatch Console
- The admin key is stored in the `BW_ADMIN_KEY` environment variable (default: `bookawaka-admin-2026`)
- All registration data comes from the Dispatch Console — the Super Admin is read-only/action-only
- When approving a company, call `POST /admin/registrations/:id/approve` on the Dispatch Console
- If a company's Firebase data is missing (ownerUid wrote before the fix), call
  `POST /admin/registrations/:id/fix-firebase` to repair it

### Admin/Owner Panel Replit

- After owner logs in via Firebase, call `GET /api/account-status?email=...` to get their `companyId`
- Store the `companyId` in the session
- All API calls to the Dispatch Console must include `credentials: 'include'` so the `BW_SID`
  cookie is sent (or pass `companyId` in the data array as a fallback)
- Only show data for the owner's own `companyId`
- Block login if `isActive = false`

### Driver App Replit

- After driver logs in via Firebase, read `users/{uid}/companyId` from Firebase DB to get their companyId
- Write driver presence to `online/{companyId}/{driverId}` — **not** `online/{driverId}`
- All `[DriverStatusChanged]` calls must include `companyId` in the data array:
  ```json
  { "data": [
    { "name": "CompanyId", "value": "417942" },
    { "name": "DriverId",  "value": "1001" },
    ...
  ]}
  ```
- The Dispatch Console uses this `companyId` param as a fallback when no `BW_SID` cookie is present
- Check `GET /api/account-status?companyId=417942` on startup — if `isActive = false`, show
  "Your company account has been suspended. Please contact BookaWaka." and prevent login.

---

## The `companyId` Fallback Chain

In the Dispatch Console, `sessionCompanyId` is resolved in this order:

1. `BW_SID` signed cookie (most secure — set by `/api/session/login` at browser login)
2. `CompanyId` param in the POST data array (fallback for driver app / legacy callers)
3. `null` → backward-compat: returns all data (only acceptable for unauthenticated read-only calls)

---

## Environment Variables Required

| Variable | Where Set | Purpose |
|----------|-----------|---------|
| `BW_ADMIN_KEY` | Dispatch Console `.env` | Admin API authentication |
| `BW_SESSION_SECRET` | Dispatch Console `.env` | HMAC key for BW_SID cookie signing. If not set, a random key is generated on startup (cookies invalidated on restart). **Set this to a stable value in production.** |
| `BW_FIREBASE_SERVICE_ACCOUNT` or `BW_FIREBASE_SECRET` | Dispatch Console `.env` | Firebase Admin SDK credentials for writing to Firebase DB from the server |

---

## Summary Checklist for Each New Replit

- [ ] Read `companyId` from Firebase (`users/{uid}/companyId`) after login
- [ ] Pass `companyId` on every API call to the Dispatch Console
- [ ] Use `online/{companyId}/...` Firebase paths for driver presence
- [ ] Check `/api/account-status` on startup and block access if `isActive = false`
- [ ] Never hard-code or guess a `companyId` — always read from Firebase or the session
