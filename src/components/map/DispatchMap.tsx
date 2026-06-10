import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Car,
  Home,
  Layers,
  Maximize2,
  Minus,
  Navigation,
  Plus,
  TrafficCone,
  ExternalLink,
  Users,
} from 'lucide-react';
import { loadGoogleMaps, loadGoogleMapsLibraries } from '@/lib/mapLoader';
import { DEFAULT_MAP_CENTER, normalizeMapCenter } from '@/lib/mapCenter';
import { useDriverStore } from '@/store/driverStore';
import { useJobStore } from '@/store/jobStore';
import { useUiStore } from '@/store/uiStore';
import { statusColor } from '@/types/driver';
import { parseLatLng } from '@/types/job';
import { Spinner } from '@/components/shared/Spinner';
import { cn } from '@/lib/utils';

interface DispatchMapProps {
  mapsKey: string;
  center: { lat: number; lng: number };
  companyId: string;
  compactControls?: boolean;
  onPopOut?: () => void;
  onFullscreen?: () => void;
  popOutActive?: boolean;
}

import { getMapThemeConfig } from '@/lib/mapStyles';

export function DispatchMap({
  mapsKey,
  center,
  companyId,
  compactControls,
  onPopOut,
  onFullscreen,
  popOutActive,
}: DispatchMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const gMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const trafficRef = useRef<google.maps.TrafficLayer | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const drivers = useDriverStore((s) => s.drivers);
  const selectedJobId = useJobStore((s) => s.selectedJobId);
  const jobs = useJobStore((s) => s.jobs);
  const mapTraffic = useUiStore((s) => s.mapTraffic);
  const mapZones = useUiStore((s) => s.mapZones);
  const theme = useUiStore((s) => s.theme);
  const setMapTraffic = useUiStore((s) => s.setMapTraffic);
  const setMapZones = useUiStore((s) => s.setMapZones);
  const openModalWith = useUiStore((s) => s.openModalWith);

  const mapTheme = useMemo(() => getMapThemeConfig(theme), [theme]);

  const safeCenter = useMemo(
    () => normalizeMapCenter(center.lat, center.lng),
    [center.lat, center.lng]
  );

  const counts = useMemo(
    () => ({
      all: drivers.length,
      free: drivers.filter((d) => d.status === 'Available').length,
      picking: drivers.filter((d) => d.status === 'Picking').length,
      busy: drivers.filter((d) => ['Busy', 'Active', 'OnTrip', 'Assigned'].includes(d.status)).length,
      away: drivers.filter((d) => d.status === 'Away').length,
    }),
    [drivers]
  );

  const selectedJob = jobs.find((j) => j.id === selectedJobId);

  useEffect(() => {
    const el = mapRef.current;
    const apiKey = mapsKey || window.__BW_GOOGLE_MAPS_API_KEY__ || '';
    if (!apiKey || !el) return;

    let cancelled = false;
    setMapReady(false);
    setMapError(null);

    loadGoogleMapsLibraries(apiKey)
      .then(({ Map }) => {
        if (cancelled || !mapRef.current) return;
        if (!gMapRef.current) {
          gMapRef.current = new Map(mapRef.current, {
            center: safeCenter,
            zoom: 13,
            disableDefaultUI: true,
            backgroundColor: mapTheme.backgroundColor,
            styles: mapTheme.styles,
          });
          trafficRef.current = new google.maps.TrafficLayer();
          if (mapTraffic) trafficRef.current.setMap(gMapRef.current);
        }
        if (!cancelled) setMapReady(true);
      })
      .catch((err) => {
        if (!cancelled) {
          setMapError(err instanceof Error ? err.message : 'Failed to load Google Maps');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [mapsKey, mapTheme.backgroundColor, mapTheme.styles]);

  useEffect(() => {
    if (!gMapRef.current || !mapReady) return;
    gMapRef.current.setOptions({
      styles: mapTheme.styles,
      backgroundColor: mapTheme.backgroundColor,
    });
  }, [mapTheme, mapReady]);

  useEffect(() => {
    if (!gMapRef.current || !mapReady) return;
    gMapRef.current.setCenter(safeCenter);
  }, [safeCenter.lat, safeCenter.lng, mapReady]);

  useEffect(() => {
    if (!gMapRef.current || !trafficRef.current) return;
    trafficRef.current.setMap(mapTraffic ? gMapRef.current : null);
  }, [mapTraffic, mapReady]);

  useEffect(() => {
    if (!gMapRef.current || !mapReady) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    for (const d of drivers) {
      if (!d.lat || !d.lng) continue;
      const m = new google.maps.Marker({
        position: { lat: d.lat, lng: d.lng },
        map: gMapRef.current,
        title: `${d.driverName} (${d.status})`,
        icon: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 5,
          fillColor: statusColor(d.status),
          fillOpacity: 1,
          strokeWeight: 1,
          strokeColor: '#fff',
          rotation: 0,
        },
      });
      m.addListener('click', () => openModalWith('driverDetail', { driverId: d.driverId }));
      markersRef.current.push(m);
    }
  }, [drivers, openModalWith, mapReady]);

  useEffect(() => {
    if (!gMapRef.current || !selectedJob || !mapReady) return;
    const pick = parseLatLng(selectedJob.pickLatLng);
    if (pick) {
      new google.maps.Marker({
        position: pick,
        map: gMapRef.current,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#22c55e', fillOpacity: 1, strokeWeight: 0 },
      });
    }
  }, [selectedJob, mapReady]);

  useEffect(() => {
    if (!gMapRef.current || !mapZones || !companyId || !mapReady) return;
    let cancelled = false;
    let unsub: (() => void) | undefined;
    const polys: google.maps.Polygon[] = [];

    import('@/lib/firebase').then(({ getDb, ref, onValue }) => {
      if (cancelled || !gMapRef.current) return;
      const r = ref(getDb(), `zones/${companyId}`);
      unsub = onValue(r, (snap) => {
        polys.forEach((p) => p.setMap(null));
        polys.length = 0;
        const val = snap.val();
        if (!val || !gMapRef.current) return;
        for (const [, z] of Object.entries(val as Record<string, { paths?: { lat: number; lng: number }[] }>)) {
          if (!z.paths?.length) continue;
          polys.push(
            new google.maps.Polygon({
              paths: z.paths,
              strokeColor: '#4f6ef7',
              strokeOpacity: 0.8,
              strokeWeight: 2,
              fillColor: '#4f6ef7',
              fillOpacity: 0.08,
              map: gMapRef.current,
            })
          );
        }
      });
    });

    return () => {
      cancelled = true;
      unsub?.();
      polys.forEach((p) => p.setMap(null));
    };
  }, [mapZones, companyId, mapReady]);

  const zoom = (delta: number) => {
    const z = gMapRef.current?.getZoom();
    if (z != null) gMapRef.current?.setZoom(z + delta);
  };

  const ctrlBtn = 'bw-ctrl-btn';

  return (
    <div className="relative flex-1 min-h-0 bw-text bw-map-bg">
      <div ref={mapRef} className="absolute inset-0 bw-map-bg" />
      {!mapReady && !mapError && (
        <div className="absolute inset-0 flex items-center justify-center z-[1] bw-map-bg">
          <Spinner className="w-8 h-8 bw-muted" />
        </div>
      )}
      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center z-[1] px-4 text-center text-sm text-red-400 bw-map-bg">
          {mapError}
        </div>
      )}

      <div className={cn('absolute top-2 left-2 z-10 flex flex-col gap-1.5', compactControls && 'scale-90 origin-top-left')}>
        <div className="rounded-lg border bw-border bw-surface p-1.5 shadow-xl backdrop-blur-sm flex flex-col gap-1 min-w-[120px]">
          <button type="button" className={ctrlBtn} onClick={() => gMapRef.current?.setCenter(safeCenter)}>
            <Home size={14} /> Home
          </button>
          <div className="flex gap-1">
            <button type="button" className={cn(ctrlBtn, 'flex-1')} onClick={() => zoom(1)} aria-label="Zoom in">
              <Plus size={14} />
            </button>
            <button type="button" className={cn(ctrlBtn, 'flex-1')} onClick={() => zoom(-1)} aria-label="Zoom out">
              <Minus size={14} />
            </button>
          </div>
          <button
            type="button"
            className={cn(ctrlBtn, mapTraffic && 'border-amber-500/50 text-amber-400')}
            onClick={() => setMapTraffic(!mapTraffic)}
          >
            <TrafficCone size={14} /> Traffic
          </button>
          <button
            type="button"
            className={cn(ctrlBtn, mapZones && 'border-[color-mix(in_srgb,var(--bw-accent)_50%,transparent)] bw-accent')}
            onClick={() => setMapZones(!mapZones)}
          >
            <Layers size={14} /> Zones
          </button>
        </div>
      </div>

      <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
        {onPopOut && (
          <button type="button" className={ctrlBtn} onClick={onPopOut}>
            <ExternalLink size={14} />
            {popOutActive ? 'Close Map Window' : 'Pop Out Map'}
          </button>
        )}
        {onFullscreen && (
          <button type="button" className={ctrlBtn} onClick={onFullscreen}>
            <Maximize2 size={14} /> Fullscreen
          </button>
        )}
      </div>

      <div className="absolute bottom-2 left-2 z-10 flex gap-1.5 flex-wrap max-w-[70%]">
        {(
          [
            { k: 'all', icon: Users, color: 'bw-text' },
            { k: 'free', icon: Car, color: 'text-status-available' },
            { k: 'picking', icon: Navigation, color: 'text-status-picking' },
            { k: 'busy', icon: Car, color: 'text-status-busy' },
            { k: 'away', icon: Car, color: 'bw-muted' },
          ] as const
        ).map(({ k, icon: Icon, color }) => (
          <span
            key={k}
            className={cn(
              'inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bw-surface border bw-border shadow backdrop-blur-sm font-medium',
              color
            )}
          >
            <Icon size={11} />
            {k}: {counts[k]}
          </span>
        ))}
      </div>
    </div>
  );
}

export { DEFAULT_MAP_CENTER };
