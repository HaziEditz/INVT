import { importLibrary } from '@googlemaps/js-api-loader';
import { loadGoogleMaps } from '@/lib/mapLoader';

export interface RouteInfo {
  distanceKm: number;
  durationMin: number;
  path: google.maps.LatLngLiteral[];
}

export interface LatLng {
  lat: number;
  lng: number;
}

function validCoord(p: LatLng): boolean {
  return Math.abs(p.lat) > 0.0001 || Math.abs(p.lng) > 0.0001;
}

export async function fetchDrivingRoute(
  origin: LatLng,
  destination: LatLng
): Promise<RouteInfo | null> {
  if (!validCoord(origin) || !validCoord(destination)) return null;
  await loadGoogleMaps();
  const { DirectionsService } = await importLibrary('routes');
  const service = new DirectionsService();
  return new Promise((resolve) => {
    service.route(
      {
        origin,
        destination,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status !== google.maps.DirectionsStatus.OK || !result?.routes[0]) {
          resolve(null);
          return;
        }
        const leg = result.routes[0].legs[0];
        const path = result.routes[0].overview_path.map((p) => ({
          lat: p.lat(),
          lng: p.lng(),
        }));
        resolve({
          distanceKm: (leg?.distance?.value ?? 0) / 1000,
          durationMin: (leg?.duration?.value ?? 0) / 60,
          path,
        });
      }
    );
  });
}

export async function renderDrivingRoute(
  map: google.maps.Map,
  renderer: google.maps.DirectionsRenderer,
  origin: LatLng,
  destination: LatLng
): Promise<RouteInfo | null> {
  if (!validCoord(origin) || !validCoord(destination)) {
    renderer.setMap(null);
    return null;
  }
  await loadGoogleMaps();
  const { DirectionsService } = await importLibrary('routes');
  const service = new DirectionsService();
  return new Promise((resolve) => {
    service.route(
      {
        origin,
        destination,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status !== google.maps.DirectionsStatus.OK || !result) {
          renderer.setMap(null);
          resolve(null);
          return;
        }
        renderer.setMap(map);
        renderer.setDirections(result);
        const leg = result.routes[0]?.legs[0];
        const path =
          result.routes[0]?.overview_path.map((p) => ({ lat: p.lat(), lng: p.lng() })) ?? [];
        resolve({
          distanceKm: (leg?.distance?.value ?? 0) / 1000,
          durationMin: (leg?.duration?.value ?? 0) / 60,
          path,
        });
      }
    );
  });
}

export function formatRouteSummary(km: number, min: number, fare?: number): string {
  const parts = [`~${km.toFixed(1)} km`, `~${Math.round(min)} min`];
  if (fare != null && !Number.isNaN(fare)) parts.push(`Est. $${fare.toFixed(2)}`);
  return parts.join(' · ');
}

export function formatCityDistance(km: number, min: number): string {
  return `~${km.toFixed(1)} km from city, ~${Math.round(min)} min drive`;
}

/** Quadratic bezier arc between two points (fallback when Directions API unavailable). */
export function bezierRoutePath(start: LatLng, end: LatLng, segments = 40): LatLng[] {
  const midLat = (start.lat + end.lat) / 2;
  const midLng = (start.lng + end.lng) / 2;
  const dx = end.lng - start.lng;
  const dy = end.lat - start.lat;
  const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
  const bulge = dist * 0.18;
  const ctrl = { lat: midLat + bulge, lng: midLng - bulge * 0.6 };
  const path: LatLng[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const u = 1 - t;
    path.push({
      lat: u * u * start.lat + 2 * u * t * ctrl.lat + t * t * end.lat,
      lng: u * u * start.lng + 2 * u * t * ctrl.lng + t * t * end.lng,
    });
  }
  return path;
}
