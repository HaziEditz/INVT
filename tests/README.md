# Regression test suite (Phase 0–3)

Automated API + Firebase sync checks for core dispatch flows. Mirrors manual `GET /admin/jobTrace/:id` verification.

## Run locally

```bash
# Requires Firebase admin secret (same as production server)
export BW_FIREBASE_SECRET=your-secret
export BW_ADMIN_KEY=bookawaka-admin-2026   # optional, defaults match dev

npm run test:regression
```

Spawns an isolated server on port **5099** with data in `.data-regtest/` (never touches `.data/`). Expect **25 tests**, ~4–5 minutes.

## Coverage

| Phase | Test file | Covers |
|-------|-----------|--------|
| 0 | `smoke.test.mjs` | Server health, admin jobTrace |
| 1 | `create-pool.test.mjs` | ASAP create → jobStore + Firebase pool |
| 1 | `quick-assign-sync.test.mjs` | Pending ↔ No One via `/api/booking/update` |
| 1 | `edit-lock.test.mjs` | Edit-lock acquire/release + failed-save release |
| 1 | `sequence-two-jobs.test.mjs` | Two jobs sequential quick-assign |
| 2 | `full-lifecycle.test.mjs` | Create → auto-dispatch → Accept → Arrived → Active → Complete |
| 2 | `no-one-pending-dispatch.test.mjs` | Pending auto-offers; No One never auto-dispatches |
| 2 | `cancel-sources.test.mjs` | Cancel from dispatcher, website, driver recall |
| 2 | `terminal-outcomes.test.mjs` | Recall vs No Show vs Cancelled |
| 3 | `edit-states.test.mjs` | Edit-lock in Pending, Assigned, Active |
| 3 | `queue-while-busy.test.mjs` | Offer → Queue → Recall → clean Pending |
| 3 | `vehicle-eligibility.test.mjs` | Van vs Sedan + seat capacity |
| 3 | `scheduled-timing.test.mjs` | Scheduled → release → Pending → dispatch |
| 3 | `driver-pre-booking.test.mjs` | Driver app `/api/pre-booking` → Scheduled + Firebase sync |
| 3 | `zone-queue-g1.test.mjs` | `zoneQueues` Firebase sync on Available |

## CI

Runs on every push to `main` (`.github/workflows/regression.yml`). Requires GitHub secret `BW_FIREBASE_SECRET`.
