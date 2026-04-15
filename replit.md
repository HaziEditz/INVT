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
server.js                                   — Node.js static file server (port 5000)
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
    AjaxHandler.js                          — AJAX wrapper (Selector / Selector1 functions)
    Data.aspx/
      DataSelector.html                     — Static JSON: job data snapshot
      DataSelectorLess.html                 — Static JSON: driver/vehicle snapshot
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

## Server Routing Logic (server.js)

The server does intelligent routing for POST requests to data endpoints:

- **Alarm/alert actions** (`RetrieveAlarms`, `AllAlarms`, `RetrieveAlarts`, etc.) → returns `{"d":"[]"}` (empty array) to prevent the alarm modal from auto-opening with stale demo data
- **Write operations** (`DataProcessor`, `InsertAlarm`, `UpdateAlarm`, etc.) → returns appropriate success messages so UI feedback works
- **Data queries** (`DataSelector`, `DataSelectorLess`) → serves static HTML snapshot files
- **Missing secondary endpoints** → returns `{"d":"[]"}` silently (no 404 noise)
- **Analytics/template patterns** (`/cdn-cgi/`, `{{...}}`) → returns `{}` silently
- **EADDRINUSE** → auto-kills the port and retries

## Bug Fixes Applied

### Critical JS Bugs (previous session)
1. **Duplicate jQuery** — jQuery 1.11.0 removed, 3.5.1 moved to top of `<head>`
2. **Script load order** — `jquery-ui.js` and `Validate.js` now load after jQuery
3. **Broken `<link>` tag** — `ChatCss.css` link tag was missing closing `/>` 
4. **Invalid HTML comment** — `<!---Font icons-->` → `<!--Font icons-->`
5. **VehiclesStatus dt4/dt5 swap** — Picking/Away vehicle counters were reading from swapped table indices

### Critical JS Bugs (this session)
6. **Repeating alarm modal** — Two root causes fixed:
   - `if ($res.length != [])` is ALWAYS true (nonsense comparison) → fixed to `if ($res.length > 0)` in both `Alarms()` and `AllAlarm()`
   - Server now returns `{"d":"[]"}` for all alarm/alert queries, so no data means no popup
7. **`changerefresh()` crash** (`TypeError: Cannot read properties of undefined (reading 'bounds')`) — Two bugs:
   - `rectangle.bounds.getCenter()` is wrong API → fixed to `rectangle.getBounds().getCenter()`
   - `rectangle` is `undefined` until map initializes → added null guard
8. **Map not showing** — `initMap()` waited on geolocation (async/denied in Replit), map never rendered:
   - Now initializes immediately with Invercargill, NZ coordinates (`-46.4120, 168.3538`)
   - Geolocation runs silently in background as a refinement (no blocking, no `alert()`)
   - Removed the blocking `alert('Your Location service is disabled...')` call
9. **Alarm sound playing on every poll** (35+ times per minute):
   - `{{playAudio()}}` was in `ng-repeat` templates — called for every job on every AngularJS digest
   - `$scope.alerting()` called `playAudio()` on every binding evaluation
   - **Fix**: `playAudio()` is now debounced (returns immediately if called within 30s of last play)
   - **Fix**: `{{playAudio()}}` removed from all 3 template locations

### UI Fixes
10. **Orange/yellow job panel** — Hardcoded inline `background: #ffa500b0` on `.tab-menu-heading` div → fixed to white
11. **Topnav orange background** — `background: #ffa500b0` in inline `<style>` block → fixed to transparent
12. **Page teal background** — `background:#0bcffb2b` inline on `.page` and `.page-main` divs → fixed to `#f0f2f5`

## UI Redesign (dispatch-modern.css)

A new `css/dispatch-modern.css` overrides the original design with a professional dispatch theme:

- **Header**: Dark `#1a1d21` background, white nav links, red "Create Job" CTA
- **Background**: Clean light gray `#f0f2f5`
- **Job cards**: White with subtle border/shadow
- **Status badges**: Semantic color-coded pills (blue/green/red/yellow)
- **Stats sidebar**: Dark panel with color-coded vehicle counts
- **Tabs**: Clean underline-style navigation with blue active indicator
- **Modals**: Dark header with large white close button (×) clearly visible in top-right
- **Buttons**: Consistent pill style with hover transitions
- **Map**: Guaranteed minimum height of 360px so it's always visible
- **DataTables**: Dark header row, clean rows with hover highlight
- **SweetAlert2**: Rounded corners matching design system

## Known Limitations (Not Fixable Without Live Credentials)

- **Firebase PERMISSION_DENIED** — `taxilatest.firebaseio.com` requires the company's Firebase credentials. Driver realtime positions won't load.
- **Google Maps deprecation warnings** — DirectionsRenderer/Service, Marker, Places Autocomplete APIs deprecated 2024-2026. All still functional.
- **Hardcoded dispatcher session** — `someSession = 'safinah mohammed'`, `SomeSession2 = '1051'`
- **Static data** — `DataSelector.html`/`DataSelectorLess.html` are snapshots (bookings 937195, 937163)

## Dispatcher Session Info (Hardcoded)

- Dispatcher: `safinah mohammed`
- Dispatcher ID: `1051`
- Firebase path: `/online/1051`
- Company: loaded via `VehiclesStatus()` API (shows "Not Specified" in demo)
