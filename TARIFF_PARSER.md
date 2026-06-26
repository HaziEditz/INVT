# Tariff record parser contract

Owner Panel publishes tariff rates to Firebase Realtime Database. Dispatch and the driver app must parse the same nodes from the same paths so both show identical live tariffs.

## Firebase paths (read both, merge by id)

| Path | Role |
|------|------|
| `tariffs/{companyId}` | Legacy / secondary tariff list |
| `tariffZones/{companyId}` | **Primary** Owner Panel path (see `MULTITENANCY_SPEC.md`) |

**Merge rule:** Build a map keyed by tariff `id`. Ingest `tariffs/` first, then `tariffZones/` — **tariffZones overrides** on duplicate ids.

**Skip:** Child keys starting with `zone_grid_` (polygon-only, no pricing).

**Snapshot shape:** Array of records or object map of child key → record.

## Canonical field aliases

Each record may use PascalCase (Owner Panel / legacy) or camelCase (newer writes). Parsers in both repos must accept all aliases below.

| Concept | Aliases (first match wins) |
|---------|----------------------------|
| **id** | `Id`, `id`, Firebase child key |
| **name** | `TariffName`, `tariffName`, `name`, `zoneName`, `label` — must be non-empty and **not** a forbidden placeholder (`Standard`) |
| **flag fall / start price** | `StartPrice`, `baseFare`, `startPrice`, `flagFall`, `flagfall`, `base` |
| **distance rate** | `DistanceRate`, `pricePerKm`, `perKm`, `ratePerKm`, `kmRate` |
| **waiting rate** | `WaitingRate`, `waitingRate`, `waitRate`, `waitingRatePerMinute`, `waitingPerMin`, `waitPerMin`, `waiting`, `waitingCostPerMin`, `waitingPerMinute` |
| **minimum fare** | `MinimumFare`, `minimumFare` (dispatch estimates only) |

## Implementations (keep in sync)

| Repo | File |
|------|------|
| **INVT** (dispatch) | `src/lib/fareEstimate.ts` → `parseTariffRecord` |
| **INVT-APP2** (driver) | `lib/parseTariffRecord.ts` → `parseTariffRecord` |

When adding a new alias or changing merge rules, update **both** files and both copies of this document.

## Driver app subscription

`INVT-APP2/lib/companyTariffs.ts` → `subscribeCompanyTariffs()` — real-time `onValue` on both paths.

## Dispatch subscription

`src/hooks/useTariffs.ts` — same merge logic for fare estimates and job-card rates.

## Forbidden placeholder names

`Standard` is a legacy dev placeholder and must **never** appear for live companies (especially `860869`). Enforced in:

- `lib/tariffGuard.cjs` / `src/lib/tariffGuard.ts`
- `parseTariffRecord` in dispatch and driver app
- `tests/regression/tariff-standard-guard.test.mjs`

## Not covered here

- Create Job **dropdown** prefers live Firebase tariffs (`useTariffs`); server `TARIFF_STORE` is kept in sync via `[TariffSync]` when Firebase tariffs load.

## Manual drift check

After Owner Panel edits a tariff:

1. Dispatch Create Job — confirm fare estimate line uses new rates.
2. Driver app Tariff picker — same names and rates without restarting the app.
