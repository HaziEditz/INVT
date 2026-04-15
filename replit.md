# INVT - Taxi Dispatch System

## Project Overview

A web-based Taxi Dispatch System for "Taxi Time" (taxitime.co.nz). The application provides a Dispatch Console for managing taxi bookings, drivers, and real-time tracking.

## Tech Stack

- **Frontend:** HTML5, CSS3, Bootstrap 4.1.3, jQuery, AngularJS 1.6.9
- **Real-time:** Firebase Realtime Database (driver locations, notifications)
- **Mapping:** Google Maps JavaScript API
- **Payments:** Stripe v2
- **Utilities:** jsPDF, SweetAlert2, toastr

## Project Structure

- `taxitime.co.nz/Dispatchthree/Default.aspx` - Main entry point (HTML/JS dispatch console)
- `taxitime.co.nz/Dispatchthree/assets/` - CSS, fonts, vendor JS
- `taxitime.co.nz/Dispatchthree/DataManager/` - AJAX handler for API calls
- `taxitime.co.nz/Dispatchthree/JsScripts/` - App-specific scripts
- Various CDN mirror directories (ajax.googleapis.com, cdn.datatables.net, etc.)
- `server.js` - Static file server (Node.js built-in http module)

## Running the Application

The app is served via a simple Node.js HTTP server (`server.js`) on port 5000.

- Root URL `/` redirects to `/taxitime.co.nz/Dispatchthree/Default.aspx`
- All static assets are served from the project root

## Notes

- No build step required - purely static HTML/JS
- Backend was originally ASP.NET; current state uses Firebase + simulated JSON endpoints
- Dependencies are bundled locally (no npm/package.json)
