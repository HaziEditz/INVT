# Regression test suite (Phase 0 + Phase 1)

Automated API + Firebase sync checks for core dispatch flows. Mirrors manual `GET /admin/jobTrace/:id` verification.

## Run locally

```bash
# Requires Firebase admin secret (same as production server)
export BW_FIREBASE_SECRET=your-secret
export BW_ADMIN_KEY=bookawaka-admin-2026   # optional, defaults match dev

npm run test:regression
```

Spawns an isolated server on port **5099** with data in `.data-regtest/` (never touches `.data/`).

## What's covered (Phase 0 + 1)

| Test file | Covers |
|-----------|--------|
| `smoke.test.mjs` | Server health, admin jobTrace, create smoke |
| `create-pool.test.mjs` | ASAP create → jobStore + Firebase pool |
| `quick-assign-sync.test.mjs` | Pending ↔ No One via `/api/booking/update` |
| `edit-lock.test.mjs` | Edit-lock acquire/release + failed-save release |
| `sequence-two-jobs.test.mjs` | Two jobs sequential quick-assign (8692606202 class bug) |

## CI

Runs on every push to `main` (`.github/workflows/regression.yml`). Requires GitHub secret `BW_FIREBASE_SECRET`.

## Phase 2+ backlog

See plan in chat — lifecycle, cancel sources, queue-busy, timing, payments, vehicle eligibility.
