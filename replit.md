# INVT - Taxi Dispatch System ("Taxi Time")

## Project Overview

A web-based Taxi Dispatch System for "Taxi Time" (taxitime.co.nz). Provides a real-time dispatch console for managing taxi bookings, vehicles, and drivers — styled as a professional Uber/Bolt-style dashboard.

## Tech Stack

- **Frontend:** HTML5, CSS3, Bootstrap 4.1.3, jQuery 3.5.1, AngularJS 1.6.9
- **Real-time:** Firebase Realtime Database (driver locations, emergency alerts)
- **Mapping:** Google Maps JavaScript API (with Places autocomplete, Directions, Traffic Layer)
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
    dispatch-modern.css                     — Modern professional UI overrides (new)
    ChatCss.css                             — Chat panel styles
    AlertTone.mp3                           — Silent audio (avoids browser error)
  DataManager/
    AjaxHandler.js                          — AJAX wrapper (Selector / Selector1 functions)
    Data.aspx/
      DataSelector.html                     — Static JSON: job data snapshot
      DataSelectorLess.html                 — Static JSON: driver/vehicle snapshot
  JsScripts/
    ChatRoom.js, StripeTokenCreation.js
  sound/a.wav                               — Silent alert sound
  images/logo3.png, img/alert.gif
```

## Running the Application

```
node server.js
```

Serves from `taxitime.co.nz/Dispatchthree/` as the web root on port 5000. Root URL → `Default.aspx`.

- POST requests to `DataManager/Data.aspx/*` are matched to `.html` data files
- CDN analytics `/cdn-cgi/` and template `{{...}}` 404s silently return 200
- EADDRINUSE: server auto-kills existing process on port and retries

## Bug Fixes Applied

1. **Duplicate jQuery removed** — jQuery 1.11.0 was loaded at line 7, then 3.5.1 at line 23. Removed 1.11.0 and moved 3.5.1 to load FIRST before any jQuery-dependent scripts.
2. **Broken `<link>` tag fixed** — `<link href="css/ChatCss.css" rel="stylesheet"` was missing closing `/>`, breaking HTML parsing.
3. **Invalid HTML comment fixed** — `<!---Font icons-->` (3 dashes) → `<!--Font icons-->`.
4. **VehiclesStatus dt4/dt5 swap fixed** — `$("#PickingVehicles")` was reading from `$res["dt5"]` and `$("#AwayVehicles")` from `$res["dt4"]` — indices were swapped, now corrected.
5. **Script load order fixed** — `jquery-ui.js` and `Validate.js` loaded before jQuery, causing `jQuery is not defined` errors. Fixed by moving jQuery 3.5.1 to top of `<head>`.

## UI Redesign (dispatch-modern.css)

A new `css/dispatch-modern.css` overrides the original design with a professional dark-mode-inspired dispatch theme:

- **Header**: Dark `#1a1d21` background, white nav links, red "Create Job" CTA
- **Background**: Clean light gray `#f0f2f5`
- **Job cards**: White with subtle border/shadow, clean spacing
- **Status badges**: Semantic color-coded pills (blue/green/red/yellow)
- **Stats sidebar**: Dark panel with color-coded vehicle counts
- **Tabs**: Clean underline-style navigation with blue active indicator
- **Modals**: Dark header, clean white body, rounded corners
- **Buttons**: Consistent pill style, hover transitions
- **Scrollbars**: Slim, minimal
- **DataTables**: Dark header row, clean rows

## Known Limitations (Not Fixable Without Live Credentials)

- **Firebase PERMISSION_DENIED** — `taxilatest.firebaseio.com` requires the company's Firebase credentials. Driver realtime positions won't load.
- **Google Maps deprecation warnings** — DirectionsRenderer/Service APIs deprecated Feb 2026. Functional warnings only.
- **Hardcoded dispatcher session** — `someSession = 'safinah mohammed'`, `SomeSession2 = '1051'`. Login flow not wired up in this environment.
- **Static data** — DataSelector.html/DataSelectorLess.html are snapshots from real Invercargill NZ taxi data (bookings 937195, 937163).

## Dispatcher Session Info (Hardcoded)

- Dispatcher: `safinah mohammed`
- Dispatcher ID: `1051`
- Firebase path: `/online/1051`
- Company: Loaded via `VehiclesStatus()` API
