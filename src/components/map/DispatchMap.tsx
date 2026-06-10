import { useEffect, useMemo, useRef, useState } from 'react';
import { loadGoogleMaps } from '@/lib/geocoder';
import { normalizeMapCenter } from '@/lib/mapCenter';
import { useDriverStore } from '@/store/driverStore';
import { useJobStore } from '@/store/jobStore';
import { useUiStore } from '@/store/uiStore';
import { statusColor } from '@/types/driver';
import { parseLatLng } from '@/types/job';
import { Button } from '@/components/shared/Button';
import { Spinner } from '@/components/shared/Spinner';

interface DispatchMapProps {
  mapsKey: string;
  center: { lat: number; lng: number };
  companyId: string;
}

const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#1a1d27' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2d3e' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f1117' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
];

export function DispatchMap({ mapsKey, center, companyId }: DispatchMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const gMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const trafficRef = useRef<google.maps.TrafficLayer | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const drivers = useDriverStore((s) => s.drivers);
  const selectedJobId = useJobStore((s) => s.selectedJobId);
  const jobs = useJobStore((s) => s.jobs);
  const mapTraffic = useUiStore((s) => s.mapTraffic);
  const mapZones = useUiStore((s) => s.mapZones);
  const setMapTraffic = useUiStore((s) => s.setMapTraffic);
  const setMapZones = useUiStore((s) => s.setMapZones);
  const openModalWith = useUiStore((s) => s.openModalWith);

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
    if (!mapsKey || !mapRef.current) return;
    let cancelled = false;
    setMapReady(false);
    loadGoogleMaps(mapsKey).then(() => {
      if (cancelled || !mapRef.current) return;
      if (!gMapRef.current) {
        gMapRef.current = new google.maps.Map(mapRef.current, {
          center: safeCenter,
          zoom: 13,
          disableDefaultUI: true,
          backgroundColor: '#1a1d27',
          styles: MAP_STYLES,
        });
        trafficRef.current = new google.maps.TrafficLayer();
        if (mapTraffic) trafficRef.current.setMap(gMapRef.current);
      }
      if (!cancelled) setMapReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [mapsKey, mapTraffic]);

  useEffect(() => {
    if (!gMapRef.current) return;
    gMapRef.current.setCenter(safeCenter);
  }, [safeCenter.lat, safeCenter.lng]);

  useEffect(() => {
    if (!gMapRef.current || !trafficRef.current) return;
    trafficRef.current.setMap(mapTraffic ? gMapRef.current : null);
  }, [mapTraffic, mapReady]);

  useEffect(() => {
    if (!gMapRef.current) return;
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
    if (!gMapRef.current || !selectedJob) return;
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
    if (!gMapRef.current || !mapZones || !companyId) return;
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
        for (const [, z] of Object.entries(val as Record<string, { name?: string; paths?: { lat: number; lng: number }[] }>)) {
          if (!z.paths?.length) continue;
          const poly = new google.maps.Polygon({
            paths: z.paths,
            strokeColor: '#4f6ef7',
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: '#4f6ef7',
            fillOpacity: 0.08,
            map: gMapRef.current,
          });
          polys.push(poly);
        }
      });
    });

    return () => {
      cancelled = true;
      unsub?.();
      polys.forEach((p) => p.setMap(null));
    };
  }, [mapZones, companyId, mapReady]);

  return (
    <div className="relative flex-1 min-h-0 bg-[#1a1d27]">
      <div ref={mapRef} className="absolute inset-0 bg-[#1a1d27]" />
      {!mapReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1a1d27] z-[1]">
          <Spinner className="w-8 h-8 text-bw-muted" />
        </div>
      )}
      <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
        <Button variant="ghost" onClick={() => gMapRef.current?.setCenter(safeCenter)}>Home</Button>
        <Button variant="ghost" onClick={() => setMapTraffic(!mapTraffic)}>
          Traffic {mapTraffic ? 'On' : 'Off'}
        </Button>
        <Button variant="ghost" onClick={() => setMapZones(!mapZones)}>
          Zones {mapZones ? 'On' : 'Off'}
        </Button>
      </div>
      <div className="absolute bottom-2 left-2 flex gap-1 z-10 flex-wrap">
        {(['all', 'free', 'picking', 'busy', 'away'] as const).map((k) => (
          <span key={k} className="text-[10px] px-2 py-1 rounded bg-bw-surface/90 border border-bw-border text-bw-text">
            {k}: {counts[k === 'all' ? 'all' : k]}
          </span>
        ))}
      </div>
    </div>
  );
}
