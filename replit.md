# BookaWaka — Taxi Dispatch System

A web-based Taxi Dispatch System providing a real-time dispatch console for managing taxi bookings, vehicles, and drivers, styled as a professional Uber/Bolt-style dashboard.

## Run & Operate

- Run: `node server.js`
- Required Environment Variables:
    - `BW_ADMIN_KEY`: (Default: `bookawaka-admin-2026`) Admin key for Super Admin API access.
    - `BW_FIREBASE_SECRET`: Firebase DB Legacy Secret (bypasses Firebase rules for server-side writes).
    - `TZ`: `Pacific/Auckland` (Set at top of `server.js` for correct local time operations).

## Stack

- Frontend: HTML5, CSS3, Bootstrap 4.1.3, jQuery 3.5.1, AngularJS 1.6.9
- Real-time: Firebase Realtime Database
- Mapping: Google Maps JavaScript API
- Payments: Stripe v2
- Utilities: jsPDF, SweetAlert2, toastr, DataTables
- Backend: Node.js (plain JavaScript)

## Where things live

- `server.js`: Node.js HTTP server, main entry point.
- `taxitime.co.nz/Dispatchthree/Default.aspx`: Main dispatch console UI (AngularJS frontend).
- `taxitime.co.nz/Dispatchthree/DispatcherLogin.aspx`: Login and account request page.
- `taxitime.co.nz/Dispatchthree/DataManager/AjaxHandler.js`: AJAX wrapper functions.
- `database.rules.json`: Firebase Realtime Database security rules (requires deployment: `firebase deploy --only database`).
- `.data/registrationRequests.json`: Stores pending account registration requests.
- `.data/suspended_drivers.json`: Persists suspended driver information across server restarts.
- `.data/zone_assignments.json`: Persists driver zone assignments across server restarts.
- `MULTITENANCY_SPEC.md`: Full multi-tenancy specification for related services.

## Architecture decisions

- **Real-backend proxy with in-memory fallback**: All DataManager POST requests are first proxied to the live `taxitime.co.nz` ASP.NET backend. A fallback to an in-memory mock occurs for specific custom actions, proxy errors/timeouts, or non-JSON/non-200 responses.
- **Multi-tenancy via signed session cookies**: `BW_SID` HttpOnly signed session cookie enables per-company data isolation, with all in-memory stores filtered by `sessionCompanyId`.
- **Firebase for real-time data**: Used for driver locations, emergency alerts, and real-time messaging, with specific `online/{companyId}/{vehicleId}/current` and `jobs/{companyId}/{vehicleId}/{driverId}` paths for driver presence and job acceptance.
- **Client-side zone detection**: Uses `google.maps.geometry.poly.containsLocation` to update driver zones based on GPS, ensuring accurate zone queueing even if the driver app doesn't report it.
- **Pre-queue feature for Busy drivers**: Allows Busy (Hail) drivers to accept pending Unassigned jobs silently. This job is queued and automatically assigned when the driver becomes Available, streamlining dispatch for active drivers.

## Product

- Real-time management of taxi bookings, vehicles, and drivers.
- Dispatch console with an Uber/Bolt-style dashboard.
- Account registration system with free trial and paid plan options, managed via a Super Admin interface.
- Multi-tenancy support ensures data isolation for each company.
- Real-time driver tracking and status updates via Firebase.
- Comprehensive job lifecycle management: creation, assignment, offer/acceptance, cancellation, completion, and historical tracking.
- Messaging system for dispatch-to-driver, broadcast, group, and driver-to-dispatcher communication.
- Search and filtering capabilities for jobs and drivers.
- Dynamic zone management and driver queueing.
- Accident Compensation (ACC) workflow for client and approval management.
- Driver suspension functionality.
- Support for multiple service types (taxi, restaurant, freight).
- Shared driver identification for drivers working across multiple companies.

## User preferences

- _Populate as you build_

## Gotchas

- **Firebase Rules Deployment**: After any changes to `database.rules.json`, run `firebase deploy --only database`. Otherwise, Firebase writes might fail with `permission_denied`.
- **Driver Visibility**: `driverdatarealx` is populated exclusively from Firebase. Without a live driver app session, the zone table and driver lists will be empty.
- **Server Restart Impact**: In-memory job stores and driver zone assignments reset on server restart unless persisted. `suspended_drivers.json` and `zone_assignments.json` mitigate some of this.
- **Asynchronous Operations**: `$scope.$digest()` calls need `if (!$scope.$$phase)` guards in AngularJS to prevent "apply already in progress" errors.
- **Driver App Compatibility**: Driver app Firebase contract (paths, fields) must align with the dispatch console's expectations for real-time features to function correctly.
- **Google Maps API Key**: Ensure valid API keys are configured for full mapping functionality.
- **Timezone Configuration**: `process.env.TZ = 'Pacific/Auckland'` must be set at the very top of `server.js` to ensure all server-side timestamps are in NZ local time.

## Pointers

- **Firebase Realtime Database**: [Firebase Docs](https://firebase.google.com/docs/database)
- **Google Maps JavaScript API**: [Google Maps Platform Docs](https://developers.google.com/maps/documentation/javascript)
- **Stripe API**: [Stripe Docs](https://stripe.com/docs/api)
- **AngularJS 1.x**: [AngularJS Docs](https://docs.angularjs.org/api)
- **Node.js File System (fs)**: [Node.js fs Docs](https://nodejs.org/docs/latest/api/fs.html)
- **Multi-tenancy Specification**: `MULTITENANCY_SPEC.md`