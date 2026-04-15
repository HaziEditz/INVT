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

The server maintains an **in-memory job store** (starts with demo jobs 937195 and 937163) and routes all DataManager POST requests by the `action` parameter. Jobs created/updated/cancelled during a session persist in memory (reset on server restart).

### DataSelector action routing
| Action | Response |
|---|---|
| `[UnAssignedJobsv3]` (default) | Full job list from in-memory store with live JobMins |
| `[Editjobv4]` | Single job filtered by `Id` param |
| `[checkjobstatusv2]` | Empty `dt1` (job not assigned, dispatch goes through cleanly) |
| `[AssignedJobsv2]` | Assigned/Offered jobs from store |
| `AutoDispatchVehiclesallride` | Empty (no Firebase drivers) |
| `RetrieveAlarms` / `AllAlarms` | `{"d":"[]"}` (no alarms) |

### DataSelectorLess action routing
| Action | Response |
|---|---|
| `[ZonesListUpdate]` | 5 demo drivers across 3 zones (Central Invercargill, Appleby, Waikiwi) |
| `[ActiveJobsv3]` | Active/Picking jobs from store |
| `RetrieveAlarms` / `AllAlarms` | `{"d":"[]"}` (no alarms) |
| Other | `DataSelectorLess.html` fallback |

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
| Other | `"Operation Successfully Performed"` |

### Demo data
- **Demo jobs**: 937195 (Crinan St pickup, today), 937163 (Centre St pickup, 21 Apr)
- **Demo drivers**: 5 drivers across 3 zones; vehicle IDs 201–205; vehicle status: 201-204 Available, 205 Busy

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

## Known Limitations (Not Fixable Without Live Credentials)

- **Firebase Anonymous Auth** — Must be enabled in Firebase Console → Authentication → Sign-in providers → Anonymous. Until enabled, `firebase.auth().signInAnonymously()` fails with `auth/internal-error` and real-time features (driver locations, emergency alerts) do not load.
- **Google Maps deprecation warnings** — DirectionsRenderer/Service, Marker, Places Autocomplete APIs deprecated 2024-2026. All still functional.
- **Driver dropdown empty** — `driverdatarealx` is populated from Firebase only; without credentials the dropdown has no drivers to select.
- **In-memory store resets on restart** — New jobs created during the session are lost when the server restarts.

## Dispatcher Session Info (Demo)

- Dispatcher: `Safinah Mohammed` (returned by LoginSelector, stored in `TT_Name`)
- Dispatcher ID: `1051` (stored in `TT_DId`; used as Firebase path `/online/1051`)
- Company: `1216` (stored in `TT_CId`)
