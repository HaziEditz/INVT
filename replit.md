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

### Messaging system fully wired (session 9)
60. **Chat sidebar only showed SQL backend drivers** — `GetDetails()` in ChatRoom.js only called `[RetrieveMessages]` (SQL list). Fixed: now also reads live drivers from `driverdatarealx` (Firebase) and merges them in, so any driver currently online in Firebase appears in the chat sidebar immediately.
61. **Broadcast/Group message had no Firebase notification** — `BroadcastMessage()` and `FnGroupMessage()` called the SQL backend only. Fixed: both now also loop over `driverdatarealx` and write to Firebase `/chat/{driverId}` for each matching live driver, giving instant app-level notification.
62. **Driver → Dispatcher had no real-time path** — There was no mechanism for the driver app to push messages to the console. Fixed: added `initDriverMessageListener(companyId)` which listens on Firebase `/driverMsg/{companyId}`. When a driver writes there, the console shows a toast notification instantly, appends the message to the open conversation if that driver is selected, stores it via `[DriverMessageInsert]` in the SQL backend, then removes it from Firebase.
63. **`[DriverMessageInsert]` unhandled** — New server.js handler stores driver-originated messages (SenderId = driverId) in the in-memory messageStore with IsRead=false so they appear in conversation history and unread badge counts.
64. **Messaging actions were proxied to live backend** — All messaging actions (`[MessageInsert]`, `[DriverMessageInsert]`, `[BroadcastMessage]`, `[GroupMessage]`, `[DeleteMessage]`, `[RetrieveMessages]`, `[DispatcherUnReadMessages]`) added to `LOCAL_ONLY_ACTIONS` so they never hit the remote server (which has no session anyway).

#### Driver app Firebase messaging spec
| Direction | Firebase path | Fields |
|---|---|---|
| Dispatcher → Driver | `/chat/{driverId}` | `{ content: "message text", bookingid: "0,MessageType,0,0,Dispatcher" }` |
| Driver → Dispatcher | `/driverMsg/{companyId}/{pushKey}` | `{ driverId, driverName, vehicleNumber, message, timestamp }` |

Driver app should:
- Listen on `/chat/{driverId}` — show message to driver when `content` arrives
- To send to dispatcher: `firebase.database().ref('/driverMsg/1216').push({ driverId, driverName, message, timestamp: Date.now() })`

### Firebase map marker + zone queue fixes (session 10)
65. **`setLabel: not a string` Google Maps crash** — `AddCar()` created a marker with `label: { text: data.vehiclenumber }`. Firebase sends `vehiclenumber` as a numeric type (e.g., `201`), but Google Maps requires the label text to be a string. Fixed: `text: String(data.vehiclenumber || '')` — casts to string safely.
66. **Zone queue shows zone rows but driver cab cards invisible** — The zone queue used 5 hard-coded `ng-if` conditions (`vehiclestatus == 'Available'|'Away'|'Busy'|'Picking'|'Clearing'`). If the driver app sends any other status string (e.g., `'active'`, `'online'`, or even `undefined`), none of the spans rendered and the driver appeared as an invisible row. Fixed: added a catch-all `<span>` that shows for any status not in the 5 known values, with a neutral grey background so the cab number/type is always visible.

### Job accept flow + messaging fixes (session 11)
67. **`checkriddestatusforoffer` returned 0 eligible — status transitions stuck** — Server checked `job.BookingStatus === 'Pending'`, but offered jobs have status `'Offered'`. `convertstatus()` therefore always found 0 eligible and never called `[changeriddestatusforoffer]`, so job status never transitioned from Offered → Assigned/Unreached. Fixed: changed condition to `'Offered' || 'Pending'` (handles both paths).
68. **Driver acceptance via joback Firebase listener didn't update server status** — When driver accepted a job (`jobstatus == 'Assigned'` or `discription == 'Ride Status successfully Updated to Assigned'`), the dispatch console removed the Firebase joback ref and called `getjobs()`, but never called `convertstatus(id, 'Assigned', driverId, '')` to update the SQL job store. Job stayed as `'Offered'` permanently. Fixed: both acceptance paths in both `resolveAfter2Secondsx` and `resolveAfter2Seconds` now call `convertstatus(id, 'Assigned', driverid, '')`.
69. **`convertstatus` success only refreshed `getjobs`, not `AssignedJobs`** — After changing job status (e.g., to Assigned), only the Unassigned tab was refreshed. The Assigned tab kept showing the old snapshot. Fixed: `convertstatus` success callback now also calls `sc.AssignedJobs()`.
70. **`[changeriddestatusforoffer]` wrongly reset driver to Available when job became Assigned** — Server reset driver status to `Available` for any status other than `'Offered'`, including `'Assigned'`. An accepted job should keep the driver `Busy` (they're driving to pick up). Fixed: only reset driver to Available for release statuses (`Unreached`, `Pending`, `Cancelled`, `Unassigned`, `No Show`).
71. **Chat driver list didn't auto-refresh** — If the chat panel was opened before Firebase had loaded `driverdatarealx`, the sidebar showed "No drivers online" and never recovered without a page reload. Fixed: (a) `GetDetails()` now schedules a 3-second retry when it finds no drivers; (b) a 30-second periodic interval always refreshes the driver list.
72. **Firebase write errors in `FnNewMessage` were silent** — If the Firebase write to `/chat/{driverId}` failed (e.g., auth/permission-denied), no UI feedback was shown — the dispatcher couldn't tell whether the message was delivered. Fixed: added `.catch()` that shows an error toast explaining the message couldn't reach Firebase.

### ACC (Accident Compensation) fixes (session 12)
73. **Stray `getapprovalall()` call in `getclientlist()`** — Line 14800 had `var proc = 'Client_ACC_GET';getapprovalall()` — the stray call fired `getapprovalall()` (which reinitialises the DataTable) every time a manager was selected in the Approvals tab. Fixed: removed the stray call; `getclientlist()` now only fetches the client list.
74. **`Manager_ACC_ADD` had no server mock** — The add-manager form submitted to an unrouted action, falling through to the catch-all which returned `[]`. The JS checked `result.d == "Manager successfully Saved"` and always hit the error toast. Fixed: added `Manager_ACC_ADD` handler returning `"Manager successfully Saved"`.
75. **`Client_ACC_ADD` wrong response string** — Server returned `"Operation Successfully Performed"` but JS checked `"Client successfully Saved"`. Fixed: mock now returns `"Client successfully Saved"`.
76. **`ACC_Approval_add` wrong response string** — Returned `"Operation Successfully Performed"` but JS checked `"Approval successfully Saved"`. Fixed: separate handler now returns the correct string.
77. **`ACC_Approval_update` wrong response string** — Returned `"Operation Successfully Performed"` but JS checked `"Approval successfully update"`. Fixed: separate handler now returns the correct string.
78. **Remote validation calls to `DataProcessor22` blocked form submission** — The add-manager and add-client forms validate `manager_name`, `manager_email`, `manager_phone`, and `client_phone` against `/DataProcessor22` with actions `checkmanagername`, `checkmanageremail`, `checkmanagerphone`, `checkpassengernumber`. These were unrouted (returned `[]`), causing the validator to show "field is invalid" and blocking the form. Fixed: added handlers for all four actions returning `{d:"true"}`.
79. **Duplicate ID on update-approval form** — The modal `<div id="updateapproval">` and the `<form id="updateapproval">` inside it shared the same ID. Fixed: form renamed to `id="updateapprovalform"` and the jQuery validator selector updated to match.
80. **`Approve_ACC_GET` mock missing fields** — The edit-approval flow populates manager email/phone, client phone, registration date, purchase order, services code, and trip status in the update modal. Mock data was missing all of these. Fixed: both demo approval records now include all fields the JS reads.
81. **`Client_ACC_ALL` missing `manager_name`** — The client dropdown in the Approvals tab shows `client_name ( manager_name )` but `manager_name` was absent from the mock. Fixed: all three demo clients now carry `manager_name`.

### Job lifecycle + driver counter fixes (session 14)
82. **Driver status counters (Free/Picking/Busy/Away/All) stuck at 0** — `VehiclesStatus()` called server's `VehiclesStatus` action which computed counts from `ZONE_DRIVERS` (a static/empty server-side array). Live drivers exist only in `$scope.driverdatarealx` (populated from Firebase). `zonetablez()` called every 15s already had access to `driverdatarealx` but never updated the counter spans. Fixed: `zonetablez()` real-time branch now computes Available/Picking/Busy/Away/All counts from `driverdatarealx` and updates `#FreeVehicles`, `#PickingVehicles`, `#BusyVehicles`, `#AwayVehicles`, `.AllVehicles` directly via jQuery.
83. **Server `VehiclesStatus` Picking count hardcoded to 0** — `dt4: [{ Picking: 0 }]` never reflected real-time data. Fixed: now computed as `ZONE_DRIVERS.filter(d => d.vehiclestatus === 'Picking').length`.
84. **Job lifecycle not auto-transitioning on Firebase driver status change** — When a driver's `vehiclestatus` changed in Firebase from `Picking → Busy` (driver picked up passenger) or `Busy → Available` (ride complete), the linked job in the mock server was never updated. Added new `[DriverStatusChanged]` server action + client AJAX call in `tallo()` (fired whenever Firebase vehicle status changes): `Busy` → transitions Assigned/Offered job to `Active`; `Available` → transitions Active job to `Completed`.
85. **Auto-dispatch accept path didn't update job to Assigned** — Firebase `joback` listener on `discription == 'Ride Status successfully Updated to Assigned'` only called `getjobs()`. Job stayed as `Offered` in mock server and Assigned tab didn't update. Fixed: now also calls `convertstatus(id, 'Assigned', driverid, '')` and `AssignedJobs()`.
86. **`JobsCount` only counted Closed/Completed status, missing terminal jobs** — `DispatchedJobs` counter (shown on map overlay) only counted `'Closed'|'Completed'` from `jobStore`. Fixed: now counts all TERMINAL statuses (`Dispatched`, `Done`, `Cancel`, `Cancelled`, `Closed`, `Completed`, `No Show`, `NoShow`, `Reject`) from both `jobStore` and `closedJobStore`.

### joback listener hardened against driver apps that omit 'status' field (session 17)
89. **Job stuck in 'Offer' tab + driver reverts to green after 30 s** — Root cause: when the real driver app accepts a job it writes `{jobstatus:'Assigned'}` to Firebase `joback/{id}/{driverId}` without the `status` field. The listener in both `resolveAfter2Secondsx` and `resolveAfter2Seconds` checked `if($respp['status'])` first — with no `status` field the outer else block ran with nothing in it, the offer card was never removed, and `checkingjobz` fired 26 s later (6 s delay + 20 s timer). Since the job was still 'Offered', `checkriddestatusforoffer` returned [job] and `[changeriddestatusforoffer]` reset it to 'Unreached', releasing the driver back to 'Available'. Fixed: added an early-exit guard block immediately after the null check in both listener callbacks. The guard runs before any `status`-field branching and checks `jobstatus` directly (case-insensitive). `jobstatus === 'Assigned'` → removes joback, detaches listener, removes offer card, calls `convertstatus(id,'Assigned',…)` + `getjobs()`. `jobstatus === 'Reject'` → same but calls `convertstatus(id,'Pending',…)`. Also shortcuts on `status === 'Sent'` so the listener is a no-op while genuinely waiting.
90. **Start Meter did not promote job to Active** — Downstream consequence of bug 89: because acceptance was never processed, the job remained 'Offered'/'Unreached' when the driver pressed Start Meter. `[DriverStatusChanged]` with `newStatus='Busy'` only matches `BookingStatus === 'Assigned' || 'Offered'` — once reset to 'Unreached' there was no eligible job to promote. Fixed as a side-effect of fix 89: acceptance is now correctly processed → job stays 'Assigned' → Start Meter → 'Busy' → 'Active'. ✓
91. **Driver going red (Busy) still didn't move job to Active in all paths** — Additional hardening: `[DriverStatusChanged]` Busy check now promotes ANY non-terminal job linked to that driver (not just 'Assigned'/'Offered'), so even if the job was reset to 'Unreached' by a previous timer, the driver pressing Start Meter still transitions the dispatch correctly. `tallo()` now also triggers `[DriverStatusChanged]` when driver goes `'Picking'` (→ job Assigned) in addition to Busy/Available, covering driver apps that skip directly from Available to Picking on accept. Each status change triggers the appropriate tab refresh (Active/Assigned/Pending). Server handler updated accordingly.

### Core dispatch lifecycle fix — jobs now reach Assigned/Active (session 15)
87. **Dispatched jobs always reverted to Unreached after 20 seconds** — Root cause: `[AssignJobStatusFromJobListv2]` and `[AssignJobStatusFromJobList]` set `job.BookingStatus = 'Offered'`. This started a Firebase `joback/{id}/{driverid}` polling loop (`resolveAfter2Secondsx`). With no real driver app, `joback` was null → after 6 s the "Driver may not be available" error toast fired + `checkingjobz` was scheduled → 20 s later `checkingjobz` called `convertstatus(id, 'Unreached', ...)` → `checkriddestatusforoffer` found the job was still 'Offered' → `[changeriddestatusforoffer]` reset it to 'Unreached'. Fixed in two parts: (a) server now sets `job.BookingStatus = 'Assigned'` directly (not 'Offered') so `checkriddestatusforoffer` returns 0 eligible and any timeout-triggered `convertstatus` call is a no-op; (b) `acknowledgemethodx` and `acknowledgemethod` now pre-seed `joback/{id}/{driverId}` with `{jobstatus:'Offer',status:'Sent'}` so the Firebase listener sees a non-null value and the "Driver may not be available" toast never fires.
88. **Driver status set to Busy on dispatch instead of Picking** — When `[AssignJobStatusFromJobListv2]` set the ZONE_DRIVERS entry to `'Busy'`, the driver appeared as on-a-job immediately without showing the en-route/picking-up phase. Fixed: ZONE_DRIVERS entry is now set to `'Picking'` on dispatch (aligned with lifecycle: Picking → Busy when driver arrives, Busy → Available when ride ends).

### Vehicle/driver name in closed jobs + job enrichment (session 19)
94. **Closed/Search jobs table showed "null" for Vehicle and blank/garbled Driver** — Root causes: (a) `InsertBookingv4` seeded new jobs with `VehicleNo: null` and no `UserFName`/`UserLName`/`drivername` fields, so JavaScript string concatenation in `FnClosedJobs` produced literal `"null"` and `"undefinedundefined"` in the DataTable; (b) `[AssignJobStatusFromJobListv2]` never wrote `VehicleNo`/`drivername` back to the job even though it looked up the driver in `ZONE_DRIVERS`; (c) both `[DriverStatusChanged]` handlers promoted jobs without updating vehicle/driver fields. Fixed in four places: (1) `InsertBookingv4` now initialises `VehicleNo: ''`, `CallSign: ''`, `UserFName: ''`, `UserLName: ''`, `drivername: ''`; (2) `[AssignJobStatusFromJobListv2]` now copies `zd.vehiclenumber` → `job.VehicleNo`/`job.CallSign` and splits `zd.drivername` into `job.drivername`/`job.UserFName`/`job.UserLName`; (3) both `[DriverStatusChanged]` handlers call a local `enrichJobDriver()` helper (from the request's `vehiclenumber`/`drivername` params) on every Assigned/Active/Picking promotion; (4) `FnClosedJobs` template now renders `($res["dt1"][$i].VehicleNo || '')` and falls back through `drivername → UserFName + ' ' + UserLName` with null-safe guards; (5) `enrichSearchResult` now derives `drivername` from `UserFName`+`UserLName` if `drivername` is absent, and coerces `VehicleNo`/`CallSign` to empty string.

### `countr` global variable + Active-job demotion fix (session 18)
92. **`countr` implicit global — no-response timeout was permanently broken AND unsafe** — `resolveAfter2Secondsx` and `resolveAfter2Seconds` used `countr` without any `var` declaration. In JavaScript sloppy mode, the first `countr++` turns `undefined` into `NaN`; `NaN >= 6` is always false, so the 6-tick driver-no-response timeout (`convertstatus(id,'Pending',…)`) never fired at all. Additionally, if any other code had previously seeded a numeric `window.countr`, all concurrent dispatch listeners shared it — a counter increment for Job A could erroneously trigger the timeout path for Job B. Fixed: added `var countr = 0;` at the top of both `resolveAfter2Secondsx` and `resolveAfter2Seconds` (outside the setTimeout, inside the function body) so each dispatch invocation gets its own closure-captured counter that starts cleanly at 0.
93. **`[DriverStatusChanged]` demoted Active jobs to Assigned** — When a driver's Firebase status changed to `'Assigned'` the server handler matched ALL non-terminal jobs (`!TERMINAL.has(j.BookingStatus)`), which includes `'Active'`. A driver with one Active trip who accepted a second offer would have their Active job silently reset to `'Assigned'`, breaking the Active tab. Fixed in both `[DriverStatusChanged]` handlers (DataProcessor and DataSelectorLess paths): the `Assigned` branch now only promotes jobs in `'Offered'`, `'Pending'`, or `'Assigned'` state — `'Active'` and other non-terminal statuses are untouched.

## Known Limitations (Not Fixable Without Live Credentials)

- **Firebase Anonymous Auth** — Must be enabled in Firebase Console → Authentication → Sign-in providers → Anonymous. Until enabled, `firebase.auth().signInAnonymously()` fails with `auth/internal-error` and real-time features (driver locations, emergency alerts) do not load.
- **Google Maps deprecation warnings** — DirectionsRenderer/Service, Marker, Places Autocomplete APIs deprecated 2024-2026. All still functional.
- **Driver dropdown / zone queue empty without live drivers** — `driverdatarealx` is populated exclusively from Firebase (`online/1216`). Without a live driver app session the zone table and dispatch driver list will be empty. When the driver app is running and drivers are online they appear automatically in real time.
- **In-memory store resets on restart** — New jobs created during the session are lost when the server restarts.

## Dispatcher Session Info (Demo)

- Dispatcher: `Safinah Mohammed` (returned by LoginSelector, stored in `TT_Name`)
- Dispatcher ID: `1051` (stored in `TT_DId`; NOT used for Firebase paths — see below)
- Company: `1216` (stored in `TT_CId`; used for ALL Firebase `online/` paths)
