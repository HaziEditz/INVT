import type { DispatchThemeId } from '@/lib/theme';

/** Silver/Night hybrid — default dark dispatch map */
export const DISPATCH_DARK_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#1e2235' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#cbd5e0' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1e2235' }, { weight: 2 }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1b2e' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#4a5568' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#e2e8f0' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#4a5568' }] },
  { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#e2e8f0' }] },
  { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#2d3748' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d3748' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#cbd5e0' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1a2e1a' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#1a1d2e' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

/** Blue-toned dark map */
export const DISPATCH_DARK_BLUE_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#1a3a5c' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#cbd5e1' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#112240' }, { weight: 2 }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1b2e' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2563eb' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#e2e8f0' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#1e4976' }] },
  { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#e2e8f0' }] },
  { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#153456' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#153456' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#cbd5e1' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0f2847' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#112240' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

/** @deprecated use getMapThemeConfig */
export const DISPATCH_MAP_STYLES = DISPATCH_DARK_MAP_STYLES;

export function getMapThemeConfig(theme: DispatchThemeId): {
  styles: google.maps.MapTypeStyle[] | undefined;
  backgroundColor: string;
} {
  switch (theme) {
    case 'dark-blue':
      return { styles: DISPATCH_DARK_BLUE_MAP_STYLES, backgroundColor: '#1a3a5c' };
    case 'light':
      return { styles: undefined, backgroundColor: '#f0f2f5' };
    default:
      return { styles: DISPATCH_DARK_MAP_STYLES, backgroundColor: '#1e2235' };
  }
}
