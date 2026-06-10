import { useEffect, useRef } from 'react';
import { loadGoogleMaps } from '@/lib/geocoder';
import { useDriverStore } from '@/store/driverStore';
import { useJobStore } from '@/store/jobStore';
import { useUiStore } from '@/store/uiStore';
import { statusColor } from '@/types/driver';
import { parseLatLng } from '@/types/job';
import { Button } from '@/components/shared/Button';

interface DispatchMapProps {
  mapsKey: string;
  center: { lat: number; lng: number };
  companyId: string;
}

export function DispatchMap({ mapsKey, center, companyId }: DispatchMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const gMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const trafficRef = useRef<google.maps.TrafficLayer | null>(null);
  const drivers = useDriverStore((s) => s.drivers);
  const selectedJobId = useJobStore((s) => s.selectedJobId);
  const jobs = useJobStore((s) => s.jobs);
  const mapTraffic = useUiStore((s) => s.mapTraffic);
  const mapZones = useUiStore((s) => s.mapZones);
  const setMapTraffic = useUiStore((s) => s.setMapTraffic);
  const setMapZones = useUiStore((s) => s.setMapZones);
  const openModalWith = useUiStore((s) => s.openModalWith);
  const counts = useDriverStore((s) => s.counts);

  const selectedJob = jobs.find((j) => j.id === selectedJobId);

  useEffect(() => {
    if (!mapsKey || !mapRef.current) return;
    loadGoogleMaps(mapsKey).then(() => {
      if (gMapRef.current) return;
      gMapRef.current = new google.maps.Map(mapRef.current!, {
        center,
        zoom: 13,
        disableDefaultUI: true,
        styles: [
          { elementType: 'geometry', stylers: [{ color: '#1a1d27' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2d3e' }] },
        ],
      });
      trafficRef.current = new google.maps.TrafficLayer();
      if (mapTraffic) trafficRef.current.setMap(gMapRef.current);
    });
  }, [mapsKey, center, mapTraffic]);

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
  }, [drivers, openModalWith]);

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
  }, [selectedJob]);

  useEffect(() => {
    if (!gMapRef.current || !mapZones || !companyId) return;
    import('@/lib/firebase').then(({ getDb, ref, onValue, off }) => {
      const r = ref(getDb(), `zones/${companyId}`);
      const polys: google.maps.Polygon[] = [];
      const h = onValue(r, (snap) => {
        polys.forEach((p) => p.setMap(null));
        polys.length = 0;
        const val = snap.val();
        if (!val) return;
        for (const [, z] of Object.entries(val as Record<string, { name?: string; paths?: { lat: number; lng: number }[] }>)) {
          if (!z.paths?.length) continue;
          const poly = new google.maps.Polygon({
            paths: z.paths,
            strokeColor: '#4f6ef7',
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: '#4f6ef7',
            fillOpacity: 0.08,
            map: gMapRef.current!,
          });
          polys.push(poly);
        }
      });
      return () => off(r, 'value', h);
    });
  }, [mapZones, companyId]);

  return (
    <div className="relative flex-1 min-h-0">
      <div ref={mapRef} className="absolute inset-0" />
      <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
        <Button variant="ghost" onClick={() => gMapRef.current?.setCenter(center)}>Home</Button>
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
            {k}: {counts()[k === 'all' ? 'all' : k]}
          </span>
        ))}
      </div>
    </div>
  );
}
