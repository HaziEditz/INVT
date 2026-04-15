# INVT - Taxi Dispatch System ("Taxi Time")

## Project Overview

A web-based Taxi Dispatch System for "Taxi Time" (taxitime.co.nz). Provides a real-time dispatch console for managing taxi bookings, vehicles, and drivers — styled as a professional Uber/Bolt-style dashboard.

## Tech Stack

- **Frontend:** HTML5, CSS3, Bootstrap 4.1.3, jQuery 3.5.1, AngularJS 1.6.9
- **Real-time:** Firebase Realtime Database (driver locations, emergency alerts)
- **Mapping:** Google Maps JavaScript API (Places autocomplete, Directions, Traffic Layer)
- **Payments:** Stripe v2
- **Utilities:** jsPDF, SweetAlert2, toastr, DataTables

## Project Structure

```
server.js                                   — Node.js HTTP server (port 5000, in-memory job store)
taxitime.co.nz/Dispatchthree/
  Default.aspx                              — Main dispatch console (15k-line monolith)
  assets/
    css/dashboard.css, admin-custom.css     — Base theme styles
    plugins/bootstrap-4.1.3/               — Bootstrap
    plugins/iconfonts/                      — FontAwesome 4.7 + Glyphicons
    fonts/fonts/                            — FontAwesome fonts
    js/vendors/                             — jQuery, selectize, sparklines, etc.
    plugins/datatable/                      — DataTables
  css/
    dispatch-modern.css                     — Modern professional UI overrides
    ChatCss.css                             — Chat panel styles
    AlertTone.mp3                           — Silent audio (avoids browser error)
  DataManager/
    AjaxHandler.js                          — AJAX wrapper functions
    Data.aspx/
      DataSelector.html                     — Fallback JSON (served when action not routed)
      DataSelectorLess.html                 — Fallback JSON for booking history
  JsScripts/
    ChatRoom.js, StripeTokenCreation.js
  sound/a.wav                               — Silent alert sound (debounced, max once/30s)
  images/logo3.png, img/alert.gif
```

## Running the Application

```
node server.js
```

Serves from `taxitime.co.nz/Dispatchthree/` as the web root on port 5000. Root URL → `Default.aspx`.

## Server Architecture (server.js)

### Real-backend proxy
All DataManager POST requests are **first proxied to the live `taxitime.co.nz` ASP.NET backend** (`https://taxitime.co.nz/Dispatchthree/DataManager/Data.aspx/*`). This means:
- Login authenticates against the real database (shared with the 360taxi admin panel)
- `[DispatcherSettings]` returns the real company settings as configured by the admin panel
- Zone coordinates, assigned jobs, active jobs, messages, closed jobs, etc. all come from the real database
- Session cookies from the real backend are stripped of their `domain=taxitime.co.nz` attribute before being forwarded to the browser so they work on the Replit proxy domain

**Fallback to in-memory mock** happens for:
- Actions that exist only in this custom demo build (`[UnAssignedJobsv3]`, `[deviUnAssignedJobsv2]`, `[VehicleInfov2]`, `[AssignJobStatusFromJobListv2]`, `[DispatcherConversation]`, `[changeriddestatusforoffer]`)
- Any proxy error or timeout (8s limit)
- Real backend returning non-JSON / non-200

The server also maintains an **in-memory job store** for the unassigned job list (since the real backend uses a different action name). Jobs created/updated/cancelled during a session persist in memory (reset on server restart).

### DataSelector action routing
| Action | Response |
|---|---|
| `[UnAssignedJobsv3]` (default) | Full job list from in-memory store with live JobMins |
| `[Editjobv4]` | Single job filtered by `Id` param |
| `[checkjobstatusv2]` | Empty `dt1` (job not assigned, dispatch goes through cleanly) |
| `[AssignedJobsv2]` | Assigned/Offered jobs from store |
| `AutoDispatchVehiclesallride` | Empty (no Firebase drivers) |
| `ZoneCoordinates` | NZ-wide bounding polygon (dt1+dt2) so all NZ addresses pass zone validation |
| `[DispatcherSettings]` | Company settings (dt1), vehicle types: Sedan/SUV/Van/Wheelchair (dt3), tariff list: Standard/Airport/Evening/Custom (dt4) |
| `VehiclesStatus` | Live vehicle counts from ZONE_DRIVERS (All/Busy/Free/Picking/Away) |
| `JobsCount` | Job counts from store (Closed/Cancelled/NoShow/All) |
| `RetrieveAlarms` / `AllAlarms` | `{"d":"[]"}` (no alarms) |

### DataSelectorLess action routing
| Action | Response |
|---|---|
| `[ZonesListUpdate]` | 5 demo drivers across 3 zones (Central Invercargill, Appleby, Waikiwi) |
| `[ActiveJobsv3]` | Active/Picking jobs from store |
| `[payment_percentage]` | `[{paymentpercent:0, chargepertra:0}]` (no surcharges) |
| `DispatchEstimation` | Tariff pricing by `TariffId` param (StartPrice, DistanceRate, CurrencyName) |
| `RetrieveAlarms` / `AllAlarms` | `{"d":"[]"}` (no alarms) |
| `[SearchById]` | Filter all jobs+closed by exact booking ID |
| `[SearchJobByName]` | Filter all jobs+closed by passenger name (partial match) |
| `[SearchByPhoneNo]` | Filter all jobs+closed by phone (partial match) |
| `[SearchByAfterDate]` | Filter all jobs+closed with booking date >= param |
| `[SearchByBeforeDate]` | Filter all jobs+closed with booking date <= param |
| `SearchJobDateBetween` | Filter all jobs+closed between From/To dates |
| `JobDetails` | Single job full detail (with Route="" for map) from all jobs+closed |
| `[RetrieveMessages]` | Driver list with unread message count for chat sidebar |
| `[DispatcherUnReadMessages]` | New (unread) messages from a driver; marks them read |
| Other | `DataSelectorLess.html` fallback |

### DataSelector additional actions (session 6)
| Action | Response |
|---|---|
| `ClosedJobs` | Closed job store filtered by status/date/driver/vehicle; dt1=jobs, dt2=drivers, dt3=vehicles |
| `[DispatcherConversation]` | Full conversation thread: dt1=PlayerId, dt2=messages list |

### DataSelectorRide action routing
| Action | Response |
|---|---|
| `InsertBookingv4` | Creates job in store, returns `{"Result":"Booking Information Successfully Submitted","BookingStatus":"...","BookingId":...}` |
| Other | `"Operation Successfully Performed"` |

### DataProcessor action routing
| Action | Response |
|---|---|
| `[ProcUpdateJobv6]` | Updates job in store, returns `"Booking Details Update Successfully"` |
| `[CancelUnAssignedJobStatusFromJobList]` | Removes job from store |
| `[AssignJobStatusFromJobList]` | Marks job as Offered |
| `[UnAssignJobStatusFromJobList]` | Marks job as Pending |
| `[MessageInsert]` | Saves dispatcher→driver message to in-memory message store |
| `[BroadcastMessage]` | Sends a message to all drivers in ZONE_DRIVERS |
| `[GroupMessage]` | Sends to filtered drivers by Zone and/or VehicleType params |
| `[DeleteMessage]` | Removes a message from the store by Id |
| Other | `"Operation Successfully Performed"` |

### Other POST endpoints
| URL | Description |
|---|---|
| `DispatcherLogin.aspx/Logout` | Clears session, returns `{d:"DispatcherLogin.aspx"}` redirect target |
| `DispatcherLogin.aspx/AccountRequest` | Saves access request (Stripe-ready structure), returns confirmation message |

### Demo data
- **Demo jobs**: 937195 (Crinan St pickup, today/ASAP), 937163 (Centre St pickup, 5 days ahead)
- **Demo drivers**: 5 drivers across 3 zones; vehicle IDs 201–205; status: 201-204 Available, 205 Busy
- **Demo closed jobs**: 6 historical jobs (937100–937105) across last 3 days for Closed Jobs view
- **Demo messages**: 4 pre-seeded messages between Dispatcher and Michael Johnson/Sarah Wilson/David Thompson

## Bug Fixes Applied

### Critical JS Bugs (session 1)
1. **Duplicate jQuery** — jQuery 1.11.0 removed, 3.5.1 moved to top of `<head>`
2. **Script load order** — `jquery-ui.js` and `Validate.js` now load after jQuery
3. **Broken `<link>` tag** — `ChatCss.css` link tag was missing closing `/>`
4. **Invalid HTML comment** — `<!---Font icons-->` → `<!--Font icons-->`
5. **VehiclesStatus dt4/dt5 swap** — Picking/Away vehicle counters were reading from swapped table indices

### Critical JS Bugs (session 2)
6. **Repeating alarm modal** — Two root causes fixed:
   - `if ($res.length != [])` is ALWAYS true → fixed to `if ($res.length > 0)`
   - Server returns `{"d":"[]"}` for all alarm queries so no popup fires
7. **`changerefresh()` crash** — `rectangle.bounds.getCenter()` wrong API + null guard added
8. **Map not showing** — `initMap()` blocked on geolocation; now initialises immediately with Invercargill
9. **Alarm sound loop** — `{{playAudio()}}` was in `ng-repeat`; removed + debounce added

### Dispatch/Job flow bugs (session 3)
10. **Job creation crash** — `DataSelectorRide` returned `{"d":"[]"}`; `$res[0].Result` threw TypeError. Fixed: server now returns full booking success JSON.
11. **Job edit always loaded job #937195** — `[Editjobv4]` returned ALL jobs; client always read `dt1[0]`. Fixed: server filters by requested `Id` param.
12. **Job update never confirmed** — server returned `"Operation Successfully Performed"` but client checked `"Booking Details Update Successfully"`. Fixed: `[ProcUpdateJobv6]` now returns the correct string.
13. **Dispatch triggered "Taking Job from Driver" error** — `[checkjobstatusv2]` returned all jobs so `dt1.length > 0` was always true. Fixed: returns empty `dt1`.
14. **Zone queue empty** — `[ZonesListUpdate]` was not routed; fallback had only booking records. Fixed: returns 5 demo drivers grouped by zone. Also uncommented `$scope.zonetablez()` startup call.
15. **AjaxHandler assignment bug** — `data.d = 'Vehicle Successfully Moved'` used `=` (assignment) instead of `==` (comparison), making the condition always truthy and swallowing `ErrMessage`. Fixed.

### Booking form / zone / tariff bugs (session 4)
26. **"Out of Zone" on every address** — `ZoneCoordinates` fell to default handler and returned job data, causing `FnBookingZone` to call `containsLocation()` with empty polygon → always `false`. Fixed: proper NZ-wide bounding polygon now returned. Also added a null guard in `FnBookingZone` to return `true` if zone data hasn't loaded yet.
27. **Tariff dropdown empty** — `[DispatcherSettings]` fell to default handler (returned job list). `$scope.tarriflist = $res["dt4"]` was `undefined`. Fixed: proper handler added with Standard/Airport/Evening/Custom tariffs.
28. **Vehicle type list empty** — Same `[DispatcherSettings]` issue: `$scope.cartype = $res["dt3"]` was `undefined`. Fixed: Sedan/SUV/Van/Wheelchair now returned in `dt3`.
29. **Vehicle/job counters wrong** — `VehiclesStatus` and `JobsCount` returned job list data. Fixed: each now returns proper counted response.
30. **Trip cost calculation NaN** — `unitChanged()` called `parseFloat('')` on unset hidden inputs for `percentage` and `transection`. Fixed: both now default to `0` via `|| 0` guard.
31. **DispatchEstimation missing** — Tariff pricing call from `unitChanged` returned empty `[]`. Fixed: proper `DispatchEstimation` handler added with StartPrice/DistanceRate/CurrencyName per tariff.
32. **Payment percentage missing** — `[payment_percentage]` was not handled; fell to fallback. Fixed: handler added returning `{paymentpercent:0, chargepertra:0}`.

### Job list display / timing fixes (session 5)
33. **Demo job times stale/hardcoded** — jobs 937195 and 937163 had fixed calendar dates. Fixed: times now generated dynamically at server start — 937195 is ASAP (now), 937163 is 5 days ahead. Also enriched demo data with names, phone numbers, and a drop address for 937195.
34. **JobMins server-UTC drift** — `calcJobMins` runs in UTC on Replit; browser is in user's local timezone. Client-side `JobMins` recomputation added in `getjobs()` callback, overwriting the server value using `new Date()` in the browser.
35. **`checklateornow` always showed "Late" for future pre-bookings** — The original formula returned `-(JobMins + DispatchTimebefore)` which is nonsensical for `JobMins > DispatchTimebefore`. Rewrote with correct semantics: shows `Xd Yh` / `Xh Ym` / `X Min` until dispatch window opens, `Dispatch` when window is open, `X Min Late` when overdue.
36. **Job row time badge unreadable** — `datecreate()` returned raw `"15-04 16:05"` format. Rewrote to return: `"ASAP"` (±10 min), `"Today 4:05 PM"`, `"Tomorrow 8:35 AM"`, `"Mon 20 Apr, 8:35 AM"`.
37. **No visual distinction between ASAP and pre-booked jobs** — Added `jobTypeLabel()` function and green/amber/blue badge on every job card. Added `getTheValue()` 3-tier color scheme: green (due now), amber (dispatch in ≤30 min), blue (future pre-booking), red (overdue by >60 min).

### Firebase path + digest fixes (session 7)
55. **`SomeSession2` used wrong localStorage key — root cause of all driver/zone table failures** — `SomeSession2 = localStorage.getItem('TT_DId')` set it to `1051` (dispatcher user ID). ALL Firebase `online/` paths (`cars_Ref`, `ref44`, driver remove/assign) used this variable, meaning the listeners were on `online/1051` instead of `online/1216`. Real drivers write to `online/1216/{vehicleId}`, so `child_added`/`child_changed` never fired, and the zone/driver tables were always empty even though the user could see drivers on the map from a previous session. Fixed: `SomeSession2 = localStorage.getItem('TT_CId')` — always the company ID.
56. **`$scope.$digest()` swallowed with try/catch breaking Angular updates** — A previous fix wrapped all Firebase-path `$scope.$digest()` calls in `try { ... } catch(e) {}`. This silently discarded the call on any exception, so Angular never updated the DOM with Firebase data. Fixed: replaced all 11 instances with `if (!$scope.$$phase) { $scope.$digest(); }` — the correct Angular pattern (only triggers a digest when one isn't already running; if one IS running, it picks up the changes automatically).
57. **`AssignedJobs` called before it was defined** — `$scope.AssignedJobs()` was called at controller startup (line ~11857) but the function definition is at line ~13646, causing an "is not a function" Angular exception on every page load. Fixed: wrapped the startup call in `setTimeout(..., 500)` with a `typeof` guard so it fires after the controller has fully initialized.

### Search/Closed Jobs, Messaging, Zone Queue, Logout fixes (session 6)
38. **Search Jobs modal input hidden** — `TxtSearch` was `type="hidden"` so users couldn't type. Fixed: changed to `type="text"`, added dynamic show/hide of text/date inputs based on `ddlSearchBy` selection, wired `btnSearchJob` to call `SearchJob()`.
39. **Search actions all unhandled** — `[SearchById]`, `[SearchJobByName]`, `[SearchByPhoneNo]`, `[SearchByAfterDate]`, `[SearchByBeforeDate]`, `SearchJobDateBetween` all fell to default fallback. Fixed: all six handlers added in `DataSelectorLess`, searching across both `jobStore` and `closedJobStore`.
40. **Closed Jobs handler missing** — `FnClosedJobs` called `ClosedJobs` action which was unhandled. Fixed: handler added in `DataSelector` returning `dt1` (filtered closed jobs), `dt2` (drivers list), `dt3` (vehicles list). Added 6 historical demo closed jobs.
41. **`JobDetails` action missing** — Single job detail view called `JobDetails` which fell to fallback. Fixed: handler added, searches both active and closed job stores.
42. **Messaging — all actions unhandled** — `[RetrieveMessages]`, `[DispatcherConversation]`, `[DispatcherUnReadMessages]`, `[MessageInsert]`, `[DeleteMessage]` were all unrouted. Fixed: all handlers added; in-memory message store with 4 pre-seeded demo messages; unread badge counts update on conversation open.
43. **Messaging JS bugs** — `$res.length != []` (always true) in ChatRoom.js. Fixed to `$res.length > 0` in `GetDetails()`, `GetConversation()`, `DriverNewMessages()`.
44. **Chat panel** — Single plain textarea. Upgraded to 3-tab panel: **Individual** (driver list + conversation thread + send), **Broadcast All** (textarea + send to all), **Group** (filter by zone/vehicle type + send).
45. **Broadcast/Group message actions** — `[BroadcastMessage]` and `[GroupMessage]` added to `DataProcessor`; `BroadcastMessage()` and `FnGroupMessage()` functions added to `ChatRoom.js`.
46. **Logout — session not cleared** — `FnSuccessLogout()` only redirected; did not clear `localStorage`. Fixed: all `TT_*` keys now explicitly removed before redirect. Firebase `signOut()` wrapped in try/catch.
47. **Zone queue not auto-refreshing** — `zonetablez()` was only called on initial load and on job dispatch events. Added `setInterval(zonetablez, 15000)` so the zone panel refreshes every 15 seconds.
50. **Firebase `child_added`/`child_changed`/`child_removed` crash — `adddrivernew` TypeError** — `angular.element(...).scope()` returned `undefined` when Firebase fired before AngularJS was ready, causing an uncaught TypeError that prevented all driver data from loading. Additionally `AddCar()` crashed with `ReferenceError: google is not defined` when Google Maps wasn't loaded yet, aborting the entire callback before `adddrivernew` was ever reached. Fixed: (a) all three Firebase handlers now guard scope with null check + 1.5s retry; (b) `AddCar` is wrapped in a `typeof google !== 'undefined'` guard and try-catch.
51. **Driver duplication after page reload** — Root cause was the above crash: Firebase fired `child_added` for all existing drivers, scope was undefined, retry fired again 1.5s later, scope was now ready, driver added. But Firebase already fired `child_added` again on reconnect with the same driver record. The dedup logic in `tallo()` (checks `VehicleId` before pushing) prevents actual duplicates as long as the scope is ready — which it now is.
52. **DY (Delivery) tab crash — `[deviUnAssignedJobsv2]` unhandled** — Server returned `[]` but client expected `{dt1, dt4[0].deUnAssignedCount, dt5}`, causing a TypeError. Fixed: explicit `[deviUnAssignedJobsv2]` handler added using new `buildDeliveryResponse()` function, returning the correct structure (empty `dt1` since no delivery jobs in demo mode).
53. **`[AssignJobStatusFromJobListv2]` not handled** — DY tab uses a `v2` variant of the assign action which was silently returning empty. Fixed: added to the same `[AssignJobStatusFromJobList]` handler branch.
54. **Phantom demo jobs on every server restart** — Two hardcoded demo jobs (937195 Jane Doe, 937163 Robert Smith) re-appeared on every restart because they were seeded into `jobStore` at module load. Fixed: `jobStore` now starts empty — the dispatch board is clean on startup; all jobs come from the UI.
49. **Zone queue not real-time / not based on driver GPS position** — `zonetablez()` always fetched static `ZONE_DRIVERS` from the server, even when Firebase had live driver data in `driverdatarealx`. Fixed: `zonetablez()` now checks `driverdatarealx.length > 0` first — if Firebase drivers are present, it calls `changezone(driverdatarealx)` immediately (no server round-trip) and returns. Server fetch is retained as a fallback for the demo/no-Firebase case. All `zonetablez()` calls inside `tallo()` (which fires on every Firebase `child_changed` event) therefore now rebuild the zone list instantly from live GPS data. Zone positions update the moment a driver changes zone, job status, or queue position.
48. **Request Access was a mailto link** — `DispatcherLogin.aspx` had `<a href="mailto:...">Request Access</a>` with no backend. Replaced with a modal form (name, email, phone, company, role fields) with validation, success/error feedback, and `POST DispatcherLogin.aspx/AccountRequest` backend endpoint (Stripe-ready structure).

### Grammar / spelling fixes (session 3)
16. `'so it can t be dispatch automatically'` (Swal.fire 3rd arg was plaintext, not icon type) → `'warning'` + corrected message text
17. `'You Forget To Select Dispatch before Time!'` → `'Dispatch Time Required'`
18. `"Please Select Dispatch Before Time"` → `"Please select a dispatch time before booking."`
19. `"Booking Information Not Update"` (×2) → `"Booking information could not be updated."`
20. `"Driver Might be not Avalible. Job will be Not Reachedable"` (×2) → corrected
21. `"Tarrif Not Define"` → `"Tariff not defined"`
22. `"Website Ride Was Cancel. Automatically!!"` (×2) → `"Website ride was cancelled automatically."`
23. `"You Created  Repeated Ride Successfully"` (double space) → corrected
24. `toastr["error"]("Taking Job from Driver",'success!')` — wrong level → `'error!'`
25. `"This Job is Not Yet Ready For Dispatch.Please Change..."` (missing space) → fixed

## Authentication Flow

### Pages
- **`DispatcherLogin.aspx`** — Professional login/signup homepage. Accepts any non-empty credentials in demo mode and returns demo dispatcher session data.
- **`Default.aspx`** — Main dispatch console. Reads session from `localStorage`; redirects to `DispatcherLogin.aspx` if no session is present.

### localStorage Session Keys
| Key | Value |
|---|---|
| `TT_Name` | Dispatcher full name |
| `TT_DId` | Dispatcher numeric ID (Firebase path segment) |
| `TT_Country` | Country code, e.g. `NZ` |
| `TT_CId` | Company ID |
| `Country` | Country code (legacy key, also written for backward compat) |

### Server endpoint: `LoginSelector`
POST to `DataManager/Data.aspx/LoginSelector` with `{action: 'DispatcherLogin', data: [{name:'Username',value:...},{name:'Password',value:...}]}`. Returns `{d: JSON.stringify([{Id, UserFName, CompanyId, Country, ...}])}` on success.

### Logout
`Logout()` is defined globally in `Default.aspx`. It clears all `TT_*` localStorage keys, calls `firebase.auth().signOut()`, and redirects to `DispatcherLogin.aspx`.

### Session persistence
Sessions survive page refresh and navigation (stored in `localStorage`). Revisiting `DispatcherLogin.aspx` while already logged in auto-redirects to `Default.aspx`.

### Zone queue + console noise fixes (session 8)
58. **Zone queue is Firebase-only — no demo seeding** — `zonetablez()` fallback path simply clears `zonelist` when no Firebase drivers are connected. The zone table is empty until real drivers come online from the driver app. `driverdatarealx` is populated exclusively by the Firebase `child_added` / `child_changed` / `child_removed` handlers on `online/1216`. `[ZonesListUpdate]` server endpoint returns `[]` and is not called by the client.
59. **Periodic `[[]]` console noise** — `console.log($scope.assignedjob_list)` inside the `AssignedJobs` polling callback fired every 15 s, logging `[]` whenever there were no assigned jobs (empty `dt1`). Removed the debug log — browser console is now clean except for meaningful `"start"` warnings from the auto-dispatch checker.

## Known Limitations (Not Fixable Without Live Credentials)

- **Firebase Anonymous Auth** — Must be enabled in Firebase Console → Authentication → Sign-in providers → Anonymous. Until enabled, `firebase.auth().signInAnonymously()` fails with `auth/internal-error` and real-time features (driver locations, emergency alerts) do not load.
- **Google Maps deprecation warnings** — DirectionsRenderer/Service, Marker, Places Autocomplete APIs deprecated 2024-2026. All still functional.
- **Driver dropdown / zone queue empty without live drivers** — `driverdatarealx` is populated exclusively from Firebase (`online/1216`). Without a live driver app session the zone table and dispatch driver list will be empty. When the driver app is running and drivers are online they appear automatically in real time.
- **In-memory store resets on restart** — New jobs created during the session are lost when the server restarts.

## Dispatcher Session Info (Demo)

- Dispatcher: `Safinah Mohammed` (returned by LoginSelector, stored in `TT_Name`)
- Dispatcher ID: `1051` (stored in `TT_DId`; NOT used for Firebase paths — see below)
- Company: `1216` (stored in `TT_CId`; used for ALL Firebase `online/` paths)
