/** Google Maps loader — @googlemaps/js-api-loader v2 functional API */

import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

declare global {
  interface Window {
    google: typeof google;
    __BW_GOOGLE_MAPS_API_KEY__?: string;
  }
}

let loadPromise: Promise<void> | null = null;
let configuredKey: string | null = null;

function resolveApiKey(explicit?: string): string {
  const key = explicit || window.__BW_GOOGLE_MAPS_API_KEY__ || '';
  if (!key) throw new Error('Google Maps API key is not configured');
  return key;
}

/**
 * Load Maps + Places + Geometry once. Safe to call from multiple components.
 * Populates `google.maps` after the first successful load.
 */
export async function loadGoogleMaps(apiKey?: string): Promise<void> {
  const key = resolveApiKey(apiKey);

  if (loadPromise && configuredKey === key) {
    return loadPromise;
  }

  if (configuredKey !== key) {
    loadPromise = null;
    configuredKey = key;
  }

  if (!loadPromise) {
    setOptions({
      key,
      v: 'weekly',
    });

    loadPromise = Promise.all([
      importLibrary('maps'),
      importLibrary('places'),
      importLibrary('geometry'),
      importLibrary('routes'),
    ])
      .then(() => {
        if (typeof google?.maps?.Map !== 'function') {
          throw new Error('Google Maps API loaded but Map constructor is unavailable');
        }
      })
      .catch((err) => {
        loadPromise = null;
        configuredKey = null;
        throw err;
      });
  }

  return loadPromise;
}

/** Preload libraries and return Map + Places constructors (for typed init). */
export async function loadGoogleMapsLibraries(apiKey?: string) {
  await loadGoogleMaps(apiKey);
  const [mapsLib, placesLib] = await Promise.all([
    importLibrary('maps'),
    importLibrary('places'),
  ]);
  return {
    Map: mapsLib.Map,
    Autocomplete: placesLib.Autocomplete,
  };
}

export {};
