/** Google Places helpers — loaded when Maps script is ready */

export function attachPlacesAutocomplete(
  input: HTMLInputElement,
  onSelect: (place: { address: string; lat: number; lng: number }) => void
) {
  const g = (window as unknown as { google?: typeof google }).google;
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

export function loadGoogleMaps(apiKey: string): Promise<void> {
  if ((window as unknown as { google?: typeof google }).google?.maps) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const id = 'bw-gmaps-script';
    if (document.getElementById(id)) {
      const check = setInterval(() => {
        if ((window as unknown as { google?: typeof google }).google?.maps) {
          clearInterval(check);
          resolve();
        }
      }, 100);
      return;
    }
    const s = document.createElement('script');
    s.id = id;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,drawing,geometry&loading=async`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Google Maps failed to load'));
    document.head.appendChild(s);
  });
}

declare global {
  interface Window {
    google: typeof google;
  }
}

export {};
