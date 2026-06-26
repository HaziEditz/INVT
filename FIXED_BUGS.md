# Confirmed fixed bugs — regression guard list

Run **`npm run test:regression`** (full suite, all tests) before every push. Do not push after testing only the change in isolation.

| ID | Bug | Guard test / commit |
|----|-----|---------------------|
| TARIFF-STD | Hardcoded **"Standard"** placeholder tariff leaks into dispatch/driver UI for company **860869** | `tests/regression/tariff-standard-guard.test.mjs` — commit `7ffff99`, reinforced here |
| DRIVER-WITHDRAW | Driver app keeps active job after dispatch unassigns (`jobs/` deleted, `currentJobId` null) | INVT-APP2 `lib/activeJobPresenceWatch.ts` |
| DISPATCH-OFFER-STUCK | Offer tab job stuck after recall/cancel until manual refresh | `src/lib/jobPoolSync.ts` offer-awaiting purge |
| DISPATCH-REFRESH | Dispatch tabs do not auto-refresh after status changes | `useJobs.ts` `dispatchConsole/refresh` listener |
| DD002-DISPLAY | Vehicle **DD002** shown instead of **D002** on driver cards | `src/types/driver.ts` — commit `7ffff99` |
| QUEUE-FANOUT | Late Offered Firebase write wins over Queued fanout | `server.js` queue fanout — commit `7ffff99` |
| ASSIGN-DROPDOWN | Assign tab dropdown shows wrong drivers / missing No One | `JobCard.tsx` — commit `e02fc62` |
| UNASSIGN-BOUNCE | Unassign bounces job back to Assign tab | `useJobs.ts` `refreshTrustsPoolRestore` — commit `e02fc62` |

When fixing a recurring bug, add a row here and a dedicated regression test when possible.
