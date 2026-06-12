import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Car,
  Home,
  Layers,
  LayoutGrid,
  Lock,
  Maximize2,
  Minus,
  Navigation,
  Plus,
  Save,
  TrafficCone,
  ExternalLink,
  Unlock,
  Users,
} from 'lucide-react';
import { loadGoogleMaps, loadGoogleMapsLibraries } from '@/lib/mapLoader';
import { DEFAULT_MAP_CENTER, normalizeMapCenter } from '@/lib/mapCenter';
import { useDriverStore } from '@/store/driverStore';
import { useJobStore } from '@/store/jobStore';
import { useLayoutStore } from '@/store/layoutStore';
import { useUiStore } from '@/store/uiStore';
import { statusColor } from '@/types/driver';
import { parseLatLng } from '@/types/job';
import type { Job } from '@/types/job';
import { Spinner } from '@/components/shared/Spinner';
import { cn } from '@/lib/utils';

interface DispatchMapProps {
  mapsKey: string;
  center: { lat: number; lng: number };
  companyId: string;
  selectedJobId?: number | null;
  compactControls?: boolean;
  onPopOut?: () => void;
  onFullscreen?: () => void;
  popOutActive?: boolean;
}

import { getMapThemeConfig } from '@/lib/mapStyles';

const ROUTE_BOUNDS_PADDING = 80;

function fitRouteBounds(map: google.maps.Map, bounds: google.maps.LatLngBounds) {
  map.fitBounds(bounds, ROUTE_BOUNDS_PADDING);
  google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
    const z = map.getZoom();
    if (z != null && z > 12) map.setZoom(12);
  });
}

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
  const jobMarkersRef = useRef<google.maps.Marker[]>([]);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const routeRequestRef = useRef(0);
  const trafficRef = useRef<google.maps.TrafficLayer | null>(null);
  const zonePolysRef = useRef<google.maps.Polygon[]>([]);
  const zoneUnsubRef = useRef<(() => void) | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const layoutMenuRef = useRef<HTMLDivElement>(null);
  const drivers = useDriverStore((s) => s.drivers);
  const selectedJobId = useJobStore((s) => s.selectedJobId);
  const hoveredJobId = useJobStore((s) => s.hoveredJobId);
  const jobs = useJobStore((s) => s.jobs);
  const routeJobId = hoveredJobId ?? selectedJobId;
  const mapTraffic = useUiStore((s) => s.mapTraffic);
  const mapZones = useUiStore((s) => s.mapZones);
  const createJobOpen = useUiStore((s) => s.openModal === 'createJob');
  const routePreview = useUiStore((s) => s.routePreview);
  const routeDrawing = useUiStore((s) => s.routeDrawing);
  const setRouteDrawing = useUiStore((s) => s.setRouteDrawing);
  const setMapInstance = useUiStore((s) => s.setMapInstance);
  const theme = useUiStore((s) => s.theme);
  const setMapTraffic = useUiStore((s) => s.setMapTraffic);
  const setMapZones = useUiStore((s) => s.setMapZones);
  const setSelectedJobId = useJobStore((s) => s.setSelectedJobId);
  const setHoveredJobId = useJobStore((s) => s.setHoveredJobId);
  const openModalWith = useUiStore((s) => s.openModalWith);
  const layoutLocked = useLayoutStore((s) => s.locked);
  const saveLayout = useLayoutStore((s) => s.saveLayout);
  const resetLayout = useLayoutStore((s) => s.resetLayout);
  const toggleLayoutLock = useLayoutStore((s) => s.toggleLayoutLock);
  const addToast = useUiStore((s) => s.addToast);
  const createJobOpenRef = useRef(createJobOpen);
  createJobOpenRef.current = createJobOpen;

  useEffect(() => {
    if (!layoutMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (layoutMenuRef.current && !layoutMenuRef.current.contains(e.target as Node)) {
        setLayoutMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [layoutMenuOpen]);

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

  const clearDirectionsRenderer = () => {
    routeRequestRef.current += 1;
    setRouteDrawing(false);
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null);
      directionsRendererRef.current = null;
    }
    jobMarkersRef.current.forEach((m) => m.setMap(null));
    jobMarkersRef.current = [];
  };

  const drawRouteForJob = useCallback(
    async (job: Job, requestId: number) => {
      const map = gMapRef.current;
      if (!map || routeRequestRef.current !== requestId) return;

      const parsedPick = parseLatLng(job.pickLatLng);
      const parsedDrop = parseLatLng(job.dropLatLng);
      const pickupLat = parsedPick?.lat ?? 0;
      const pickupLng = parsedPick?.lng ?? 0;
      const dropoffLat = parsedDrop?.lat ?? 0;
      const dropoffLng = parsedDrop?.lng ?? 0;

      console.log('[Route] selectedJob:', job.id);
      console.log('[Route] pickup coords:', pickupLat, pickupLng);
      console.log('[Route] dropoff coords:', dropoffLat, dropoffLng);
      console.log('[Route] map ready:', !!map);
      console.log('[Route] renderer:', !!directionsRendererRef.current);

      const labelMarker = (
        pos: google.maps.LatLngLiteral,
        label: string,
        color: string,
        title: string
      ) =>
        new google.maps.Marker({
          position: pos,
          map: gMapRef.current!,
          title,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 14,
            fillColor: color,
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2,
          },
          label: {
            text: label,
            color: '#fff',
            fontWeight: 'bold',
            fontSize: '11px',
          },
        });

      const coordsValid = (lat: number, lng: number) =>
        Math.abs(lat) > 0.0001 || Math.abs(lng) > 0.0001;

      const geocodeAddress = (address: string): Promise<google.maps.LatLngLiteral | null> =>
        new Promise((resolve) => {
          const trimmed = address.trim();
          if (!trimmed) {
            resolve(null);
            return;
          }
          const geocoder = new google.maps.Geocoder();
          geocoder.geocode({ address: trimmed }, (results, status) => {
            if (status === 'OK' && results?.[0]) {
              resolve({
                lat: results[0].geometry.location.lat(),
                lng: results[0].geometry.location.lng(),
              });
            } else {
              console.log('[Route] geocode failed:', trimmed, status);
              resolve(null);
            }
          });
        });

      await loadGoogleMaps(mapsKey || undefined);
      if (routeRequestRef.current !== requestId || !gMapRef.current) return;

      let pick: google.maps.LatLngLiteral | null =
        parsedPick && coordsValid(pickupLat, pickupLng)
          ? { lat: pickupLat, lng: pickupLng }
          : null;
      let drop: google.maps.LatLngLiteral | null =
        parsedDrop && coordsValid(dropoffLat, dropoffLng)
          ? { lat: dropoffLat, lng: dropoffLng }
          : null;

      if (!pick && job.pickAddress?.trim()) {
        console.log('[Route] geocoding pickup address:', job.pickAddress);
        pick = await geocodeAddress(job.pickAddress);
        console.log('[Route] geocoded pickup:', pick);
      }
      if (!drop && job.dropAddress?.trim()) {
        console.log('[Route] geocoding dropoff address:', job.dropAddress);
        drop = await geocodeAddress(job.dropAddress);
        console.log('[Route] geocoded dropoff:', drop);
      }

      if (routeRequestRef.current !== requestId || !gMapRef.current) return;

      if (!pick) {
        console.log('[Route] no pickup coords available, abort');
        return;
      }

      if (!drop) {
        jobMarkersRef.current.push(
          labelMarker(pick, 'P', '#22c55e', job.pickAddress || 'Pickup')
        );
        map.setCenter(pick);
        map.setZoom(14);
        return;
      }

      jobMarkersRef.current.push(
        labelMarker(pick, 'P', '#22c55e', job.pickAddress || 'Pickup')
      );
      jobMarkersRef.current.push(
        labelMarker(drop, 'D', '#ef4444', job.dropAddress || 'Dropoff')
      );

      if (!directionsRendererRef.current) {
        directionsRendererRef.current = new google.maps.DirectionsRenderer({
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: '#4f6ef7',
            strokeWeight: 4,
          },
        });
        directionsRendererRef.current.setMap(map);
      }

      console.log('[Route] renderer:', !!directionsRendererRef.current);

      const directionsService = new google.maps.DirectionsService();
      console.log('[Route] calling DirectionsService');
      setRouteDrawing(true);

      directionsService.route(
        {
          origin: pick,
          destination: drop,
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          setRouteDrawing(false);
          console.log('[Route] status:', status);
          console.log('[Route] result:', result);
          if (routeRequestRef.current !== requestId || !gMapRef.current) return;
          if (status === google.maps.DirectionsStatus.OK && result) {
            directionsRendererRef.current?.setDirections(result);
            const bounds = result.routes[0]?.bounds;
            if (bounds) {
              fitRouteBounds(gMapRef.current, bounds);
            }
          } else {
            clearDirectionsRenderer();
          }
        }
      );
    },
    [mapsKey, setRouteDrawing]
  );

  const drawRouteBetweenCoords = useCallback(
    async (
      pick: google.maps.LatLngLiteral,
      drop: google.maps.LatLngLiteral | undefined,
      requestId: number
    ) => {
      const map = gMapRef.current;
      if (!map || routeRequestRef.current !== requestId) return;

      const labelMarker = (
        pos: google.maps.LatLngLiteral,
        label: string,
        color: string,
        title: string
      ) =>
        new google.maps.Marker({
          position: pos,
          map: gMapRef.current!,
          title,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 14,
            fillColor: color,
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2,
          },
          label: {
            text: label,
            color: '#fff',
            fontWeight: 'bold',
            fontSize: '11px',
          },
        });

      const coordsValid = (lat: number, lng: number) =>
        Math.abs(lat) > 0.0001 || Math.abs(lng) > 0.0001;

      await loadGoogleMaps(mapsKey || undefined);
      if (routeRequestRef.current !== requestId || !gMapRef.current) return;

      jobMarkersRef.current.push(labelMarker(pick, 'P', '#22c55e', 'Pickup'));

      if (drop && coordsValid(drop.lat, drop.lng)) {
        jobMarkersRef.current.push(labelMarker(drop, 'D', '#ef4444', 'Dropoff'));

        if (!directionsRendererRef.current) {
          directionsRendererRef.current = new google.maps.DirectionsRenderer({
            suppressMarkers: true,
            polylineOptions: {
              strokeColor: '#4f6ef7',
              strokeWeight: 4,
            },
          });
        }
        directionsRendererRef.current.setMap(map);

        setRouteDrawing(true);
        const directionsService = new google.maps.DirectionsService();
        directionsService.route(
          {
            origin: pick,
            destination: drop,
            travelMode: google.maps.TravelMode.DRIVING,
          },
          (result, status) => {
            setRouteDrawing(false);
            if (routeRequestRef.current !== requestId || !gMapRef.current) return;
            if (status === google.maps.DirectionsStatus.OK && result) {
              if (!directionsRendererRef.current) {
                directionsRendererRef.current = new google.maps.DirectionsRenderer({
                  suppressMarkers: true,
                  polylineOptions: {
                    strokeColor: '#4f6ef7',
                    strokeWeight: 4,
                  },
                });
              }
              directionsRendererRef.current.setMap(gMapRef.current);
              directionsRendererRef.current.setDirections(result);
              const routeBounds = result.routes[0]?.bounds;
              if (routeBounds) {
                fitRouteBounds(gMapRef.current, routeBounds);
              }
            } else {
              clearDirectionsRenderer();
            }
          }
        );
      } else {
        map.setCenter(pick);
        map.setZoom(14);
      }
    },
    [mapsKey, setRouteDrawing]
  );

  useEffect(() => {
    if (createJobOpen) {
      clearDirectionsRenderer();
    }
  }, [createJobOpen]);

  useEffect(() => {
    if (gMapRef.current && mapReady) {
      setMapInstance(gMapRef.current);
    }
    return () => setMapInstance(null);
  }, [mapReady, setMapInstance]);

  useEffect(() => {
    if (!gMapRef.current || !mapReady) return;
    const listener = gMapRef.current.addListener('click', () => {
      if (createJobOpenRef.current) return;
      setHoveredJobId(null);
      setSelectedJobId(null);
    });
    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [mapReady, setSelectedJobId, setHoveredJobId]);

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
    if (createJobOpen && routePreview) return;
    if (routeJobId) return;
    gMapRef.current.setCenter(safeCenter);
  }, [safeCenter.lat, safeCenter.lng, mapReady, createJobOpen, routePreview, routeJobId]);

  useEffect(() => {
    if (!gMapRef.current || !mapReady) return;
    if (!trafficRef.current) {
      trafficRef.current = new google.maps.TrafficLayer();
    }
    trafficRef.current.setMap(mapTraffic ? gMapRef.current : null);
  }, [mapTraffic, mapReady]);

  useEffect(() => {
    const clearZones = () => {
      zonePolysRef.current.forEach((p) => p.setMap(null));
      zonePolysRef.current = [];
      zoneUnsubRef.current?.();
      zoneUnsubRef.current = null;
    };

    if (!gMapRef.current || !mapReady || !companyId || !mapZones) {
      clearZones();
      return;
    }

    let cancelled = false;

    import('@/lib/firebase').then(({ getDb, ref, onValue }) => {
      if (cancelled || !gMapRef.current) return;
      const r = ref(getDb(), `zones/${companyId}`);
      zoneUnsubRef.current = onValue(r, (snap) => {
        zonePolysRef.current.forEach((p) => p.setMap(null));
        zonePolysRef.current = [];
        if (!useUiStore.getState().mapZones || !gMapRef.current) return;
        const val = snap.val();
        if (!val) return;
        for (const [, z] of Object.entries(val as Record<string, { paths?: { lat: number; lng: number }[] }>)) {
          if (!z.paths?.length) continue;
          zonePolysRef.current.push(
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
      clearZones();
    };
  }, [mapZones, companyId, mapReady]);

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
    console.log('[Route] routeJobId changed:', routeJobId, { hoveredJobId, selectedJobId });

    if (createJobOpen) return;

    if (!routeJobId) {
      clearDirectionsRenderer();
      return;
    }

    const job = jobs.find((j) => j.id === routeJobId);
    const parsedPick = job ? parseLatLng(job.pickLatLng) : null;
    const parsedDrop = job ? parseLatLng(job.dropLatLng) : null;

    console.log('[Route] job found:', job?.id);
    console.log('[Route] pickup:', job?.pickAddress, parsedPick?.lat, parsedPick?.lng);
    console.log('[Route] dropoff:', job?.dropAddress, parsedDrop?.lat, parsedDrop?.lng);

    const map = gMapRef.current;
    if (!job || !map || !mapReady) {
      console.log('[Route] map ready:', !!map, 'mapReady:', mapReady);
      return;
    }

    const requestId = ++routeRequestRef.current;
    clearDirectionsRenderer();
    routeRequestRef.current = requestId;

    void drawRouteForJob(job, requestId);

    return () => {
      if (routeRequestRef.current === requestId) clearDirectionsRenderer();
    };
  }, [routeJobId, hoveredJobId, selectedJobId, jobs, mapReady, createJobOpen, drawRouteForJob]);

  useEffect(() => {
    if (!gMapRef.current || !mapReady) return;

    if (!createJobOpen) {
      if (!routeJobId && !routePreview) clearDirectionsRenderer();
      return;
    }

    const requestId = ++routeRequestRef.current;
    clearDirectionsRenderer();
    routeRequestRef.current = requestId;

    if (!routePreview?.pick) {
      return () => {
        if (routeRequestRef.current === requestId) clearDirectionsRenderer();
      };
    }

    const pick = routePreview.pick;
    const drop = routePreview.drop;

    void drawRouteBetweenCoords(pick, drop, requestId);

    return () => {
      if (routeRequestRef.current === requestId) clearDirectionsRenderer();
    };
  }, [createJobOpen, routePreview, mapReady, routeJobId, drawRouteBetweenCoords]);

  const zoom = (delta: number) => {
    const z = gMapRef.current?.getZoom();
    if (z != null) gMapRef.current?.setZoom(z + delta);
  };

  const toolbarBtn =
    'flex items-center gap-1 px-2.5 h-7 rounded text-[11px] font-medium text-[#e8eaf0] hover:bg-[#2d3148] transition-colors whitespace-nowrap';
  const toolbarBtnActive = 'bg-[#5b7cfa]/20 text-[#5b7cfa]';

  return (
    <div className="relative flex-1 min-h-0 w-full h-full overflow-hidden rounded-lg border border-[#2d3148] shadow-[0_2px_8px_rgba(0,0,0,0.3)] bw-text">
      <div ref={mapRef} className="absolute inset-0 rounded-lg overflow-hidden" />
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

      {routeDrawing && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-[5] px-3 py-1.5 rounded-full bg-[#12151f]/90 border border-[#2d3148] text-[11px] text-[#8892a4]">
          Drawing route…
        </div>
      )}

      <div
        className={cn(
          'absolute top-0 left-0 right-0 z-10 flex items-center h-9 px-1.5 gap-0.5 bg-[#1e2235] border-b border-[#2d3148] rounded-t-lg',
          compactControls && 'scale-95 origin-top'
        )}
      >
        <button type="button" className={toolbarBtn} onClick={() => gMapRef.current?.setCenter(safeCenter)}>
          <Home size={14} /> Home
        </button>
        <button
          type="button"
          className={cn(toolbarBtn, mapTraffic && toolbarBtnActive)}
          onClick={() => setMapTraffic(!mapTraffic)}
        >
          <TrafficCone size={14} /> Traffic
        </button>
        <button
          type="button"
          className={cn(toolbarBtn, mapZones && toolbarBtnActive)}
          onClick={() => setMapZones(!mapZones)}
        >
          <Layers size={14} /> Zones
        </button>

        <div ref={layoutMenuRef} className="relative">
          <button
            type="button"
            className={cn(toolbarBtn, layoutMenuOpen && toolbarBtnActive)}
            onClick={() => setLayoutMenuOpen((o) => !o)}
          >
            <LayoutGrid size={14} /> Layout
          </button>
          {layoutMenuOpen && (
            <div className="absolute left-0 top-full mt-1 min-w-[140px] rounded-lg border border-[#2d3148] bg-[#1e2235] shadow-[0_2px_8px_rgba(0,0,0,0.3)] p-1 flex flex-col gap-0.5 z-20">
              <button
                type="button"
                className={cn(toolbarBtn, 'w-full justify-start')}
                onClick={() => {
                  saveLayout();
                  addToast({ type: 'success', title: 'Layout saved' });
                  setLayoutMenuOpen(false);
                }}
              >
                <Save size={14} /> Save Layout
              </button>
              <button
                type="button"
                className={cn(toolbarBtn, 'w-full justify-start')}
                onClick={() => {
                  resetLayout();
                  addToast({ type: 'info', title: 'Layout reset to default' });
                  setLayoutMenuOpen(false);
                }}
              >
                <LayoutGrid size={14} /> Reset Layout
              </button>
              <button
                type="button"
                className={cn(toolbarBtn, 'w-full justify-start', layoutLocked && toolbarBtnActive)}
                onClick={() => {
                  const next = !layoutLocked;
                  toggleLayoutLock();
                  addToast({
                    type: 'info',
                    title: next ? 'Layout locked' : 'Layout unlocked',
                  });
                }}
              >
                {layoutLocked ? <Unlock size={14} /> : <Lock size={14} />}
                {layoutLocked ? 'Unlock Layout' : 'Lock Layout'}
              </button>
            </div>
          )}
        </div>

        <div className="flex-1" />

        {onPopOut && (
          <button type="button" className={toolbarBtn} onClick={onPopOut}>
            <ExternalLink size={14} />
            {popOutActive ? 'Close Map' : 'Pop Out'}
          </button>
        )}
        {onFullscreen && (
          <button type="button" className={toolbarBtn} onClick={onFullscreen}>
            <Maximize2 size={14} /> Fullscreen
          </button>
        )}
      </div>

      <div className="absolute bottom-2 left-2 z-10 flex rounded-lg border border-[#2d3148] bg-[#1e2235] shadow-[0_2px_8px_rgba(0,0,0,0.3)] overflow-hidden">
        <button
          type="button"
          className="flex items-center justify-center w-8 h-8 text-[#e8eaf0] hover:bg-[#2d3148] transition-colors border-r border-[#2d3148]"
          onClick={() => zoom(1)}
          aria-label="Zoom in"
        >
          <Plus size={14} />
        </button>
        <button
          type="button"
          className="flex items-center justify-center w-8 h-8 text-[#e8eaf0] hover:bg-[#2d3148] transition-colors"
          onClick={() => zoom(-1)}
          aria-label="Zoom out"
        >
          <Minus size={14} />
        </button>
      </div>

      <div className="absolute bottom-2 left-20 z-10 flex gap-1.5 flex-wrap max-w-[60%]">
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
