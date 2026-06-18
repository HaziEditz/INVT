import { getDb, onValue, ref } from '@/lib/firebase';

export type CompanyZone = {
  id: string;
  zoneNumber: number;
  name: string;
  active: boolean;
  boundary: number[][];
};

function parseBoundary(raw: unknown): number[][] {
  if (!Array.isArray(raw)) return [];
  const out: number[][] = [];
  for (const p of raw) {
    if (Array.isArray(p) && p.length >= 2) {
      const lat = Number(p[0]);
      const lng = Number(p[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) out.push([lat, lng]);
      continue;
    }
    if (p && typeof p === 'object' && !Array.isArray(p)) {
      const pt = p as Record<string, unknown>;
      const lat = Number(pt.lat ?? pt.Lat ?? pt.latitude);
      const lng = Number(pt.lng ?? pt.Lng ?? pt.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) out.push([lat, lng]);
    }
  }
  return out;
}

/** Normalize Owner Panel / legacy zone node into dispatch map + queue shape. */
export function parseZoneNode(id: string, val: unknown): CompanyZone | null {
  if (!val || typeof val !== 'object') return null;
  const z = val as Record<string, unknown>;
  const boundary = parseBoundary(
    z.paths ?? z.boundary ?? z.coordinates ?? z.coords ?? z.polygon,
  );
  if (boundary.length < 3) return null;
  const zoneNumber = Number(z.zoneNumber ?? z.number ?? id);
  const name = String(z.name ?? z.zoneName ?? z.zonename ?? `Zone ${zoneNumber}`).trim();
  if (!name) return null;
  return {
    id,
    zoneNumber: Number.isFinite(zoneNumber) ? zoneNumber : 0,
    name,
    active: z.active !== false,
    boundary,
  };
}

export function zonePathsForGoogleMaps(zone: CompanyZone): { lat: number; lng: number }[] {
  return zone.boundary.map(([lat, lng]) => ({ lat, lng }));
}

export function subscribeCompanyZones(
  companyId: string,
  onChange: (zones: CompanyZone[]) => void,
): () => void {
  if (!companyId) {
    onChange([]);
    return () => undefined;
  }
  const zoneRef = ref(getDb(), `zones/${companyId}`);
  return onValue(zoneRef, (snap) => {
    if (!snap.exists()) {
      onChange([]);
      return;
    }
    const val = snap.val() as Record<string, unknown>;
    const zones = Object.entries(val)
      .map(([key, node]) => parseZoneNode(key, node))
      .filter((z): z is CompanyZone => !!z && z.active)
      .sort((a, b) => a.zoneNumber - b.zoneNumber || a.name.localeCompare(b.name));
    onChange(zones);
  });
}

/** Ray-casting point-in-polygon for [lat, lng] vertices. */
export function pointInPolygon(lat: number, lng: number, polygon: number[][]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const yi = polygon[i][0];
    const xi = polygon[i][1];
    const yj = polygon[j][0];
    const xj = polygon[j][1];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function findZoneAtCoords(
  lat: number,
  lng: number,
  zones: CompanyZone[],
): CompanyZone | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) return null;
  for (const zone of zones) {
    if (pointInPolygon(lat, lng, zone.boundary)) return zone;
  }
  return null;
}
