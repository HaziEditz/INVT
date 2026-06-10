/** Google Places autocomplete — requires loadGoogleMaps() first */

import { loadGoogleMaps } from '@/lib/mapLoader';

export { loadGoogleMaps, loadGoogleMapsLibraries } from '@/lib/mapLoader';

export function attachPlacesAutocomplete(
  input: HTMLInputElement,
  onSelect: (place: { address: string; lat: number; lng: number }) => void
) {
  const g = window.google;
  if (!g?.maps?.places) return () => {};
  const ac = new g.maps.places.Autocomplete(input, {
    fields: ['formatted_address', 'geometry'],
    componentRestrictions: { country: 'nz' },
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

/** Ensure Maps is loaded before attaching autocomplete */
export async function attachPlacesAutocompleteAsync(
  input: HTMLInputElement,
  mapsKey: string,
  onSelect: (place: { address: string; lat: number; lng: number }) => void
) {
  await loadGoogleMaps(mapsKey);
  return attachPlacesAutocomplete(input, onSelect);
}

export {};
