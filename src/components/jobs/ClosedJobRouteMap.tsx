import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '@/lib/mapLoader';
import { DEFAULT_MAP_CENTER } from '@/lib/mapCenter';
import { getMapThemeConfig } from '@/lib/mapStyles';
import { useUiStore } from '@/store/uiStore';
import { Spinner } from '@/components/shared/Spinner';
import type { GpsRoutePoint } from '@/lib/closedJobDetail';

interface ClosedJobRouteMapProps {
  mapsKey: string;
  route: GpsRoutePoint[];
  pick?: { lat: number; lng: number } | null;
  drop?: { lat: number; lng: number } | null;
  height?: number;
}

export function ClosedJobRouteMap({
  mapsKey,
  route,
  pick,
  drop,
  height = 220,
}: ClosedJobRouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const overlaysRef = useRef<google.maps.MVCObject[]>([]);
  const theme = useUiStore((s) => s.theme);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || !mapsKey) return;

    let cancelled = false;
    setReady(false);
    setError(null);

    (async () => {
      try {
        await loadGoogleMaps(mapsKey);
        if (cancelled || !containerRef.current) return;

        const center = pick ?? route[0] ?? DEFAULT_MAP_CENTER;
        const map = new google.maps.Map(containerRef.current, {
          center,
          zoom: 13,
          disableDefaultUI: true,
          zoomControl: true,
          ...getMapThemeConfig(theme),
        });
        mapRef.current = map;

        for (const o of overlaysRef.current) {
          if ('setMap' in o && typeof o.setMap === 'function') o.setMap(null);
        }
        overlaysRef.current = [];

        const bounds = new google.maps.LatLngBounds();

        if (route.length >= 2) {
          const path = route.map((p) => ({ lat: p.lat, lng: p.lng }));
          const poly = new google.maps.Polyline({
            path,
            geodesic: true,
            strokeColor: '#4f6ef7',
            strokeOpacity: 0.9,
            strokeWeight: 4,
          });
          poly.setMap(map);
          overlaysRef.current.push(poly);
          path.forEach((p) => bounds.extend(p));
        } else if (route.length === 1) {
          bounds.extend({ lat: route[0].lat, lng: route[0].lng });
        }

        if (pick) {
          const m = new google.maps.Marker({
            position: pick,
            map,
            title: 'Pickup',
            label: { text: 'P', color: '#fff', fontWeight: '700' },
          });
          overlaysRef.current.push(m);
          bounds.extend(pick);
        }

        if (drop) {
          const m = new google.maps.Marker({
            position: drop,
            map,
            title: 'Dropoff',
            label: { text: 'D', color: '#fff', fontWeight: '700' },
          });
          overlaysRef.current.push(m);
          bounds.extend(drop);
        }

        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, 48);
          google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
            const z = map.getZoom();
            if (z != null && z > 15) map.setZoom(15);
          });
        }

        if (!cancelled) setReady(true);
      } catch (e) {
        if (!cancelled) {
          setError((e && (e as Error).message) || 'Map failed to load');
        }
      }
    })();

    return () => {
      cancelled = true;
      for (const o of overlaysRef.current) {
        if ('setMap' in o && typeof o.setMap === 'function') o.setMap(null);
      }
      overlaysRef.current = [];
      mapRef.current = null;
    };
  }, [mapsKey, theme, route, pick, drop]);

  if (!mapsKey) {
    return (
      <div
        className="bw-card flex items-center justify-center text-xs text-bw-muted"
        style={{ height }}
      >
        Map unavailable — no API key
      </div>
    );
  }

  return (
    <div className="relative rounded-lg overflow-hidden border border-bw-border" style={{ height }}>
      {!ready && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-bw-surface/80 z-10">
          <Spinner />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-bw-muted p-4 z-10">
          {error}
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
