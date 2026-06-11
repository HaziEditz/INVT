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
