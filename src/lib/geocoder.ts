/** Google Maps + Places — loaded via @googlemaps/js-api-loader */

import { Loader } from '@googlemaps/js-api-loader';

declare global {
  interface Window {
    google: typeof google;
    __BW_GOOGLE_MAPS_API_KEY__?: string;
  }
}

let loaderPromise: Promise<typeof google> | null = null;

function resolveApiKey(explicit?: string): string {
  const key = explicit || window.__BW_GOOGLE_MAPS_API_KEY__ || '';
  if (!key) throw new Error('Google Maps API key is not configured');
  return key;
}

/** Load Google Maps once; safe to call from multiple components. */
export function loadGoogleMaps(apiKey?: string): Promise<typeof google> {
  if (loaderPromise) return loaderPromise;

  const loader = new Loader({
    apiKey: resolveApiKey(apiKey),
    version: 'weekly',
    libraries: ['places', 'geometry', 'drawing'],
  });

  loaderPromise = loader.load().catch((err) => {
    loaderPromise = null;
    throw err;
  });

  return loaderPromise;
}

export function createGoogleMapsLoader(apiKey?: string): Loader {
  return new Loader({
    apiKey: resolveApiKey(apiKey),
    version: 'weekly',
    libraries: ['places', 'geometry', 'drawing'],
  });
}

export function attachPlacesAutocomplete(
  input: HTMLInputElement,
  onSelect: (place: { address: string; lat: number; lng: number }) => void
) {
  const g = window.google;
  if (!g?.maps?.places) return () => {};
  const ac = new g.maps.places.Autocomplete(input, {
    fields: ['formatted_address', 'geometry'],
  });
  const listener = ac.addListener('place_changed', () => {
    const place = ac.getPlace();
    if (!place.geometry?.location) return;
    onSelect({
      address: place.formatted_address || input.value,
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng(),
    });
  });
  return () => g.maps.event.removeListener(listener);
}

export {};
