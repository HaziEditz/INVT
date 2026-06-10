/** Default dispatch map center — Invercargill, NZ */
export const DEFAULT_MAP_CENTER = { lat: -46.4132, lng: 168.3538 } as const;

export const DEFAULT_MAP_CITY = {
  ...DEFAULT_MAP_CENTER,
  name: 'Invercargill',
};

/** Return valid lat/lng or fall back to Invercargill when Firebase city coords are missing/NaN. */
export function normalizeMapCenter(lat: unknown, lng: unknown): { lat: number; lng: number } {
  const la = typeof lat === 'number' ? lat : Number(lat);
  const ln = typeof lng === 'number' ? lng : Number(lng);
  if (Number.isFinite(la) && Number.isFinite(ln) && la >= -90 && la <= 90 && ln >= -180 && ln <= 180) {
    return { lat: la, lng: ln };
  }
  return { lat: DEFAULT_MAP_CENTER.lat, lng: DEFAULT_MAP_CENTER.lng };
}

export function parseCityFromFirebase(raw: unknown): { lat: number; lng: number; name: string } {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const c = raw as Record<string, unknown>;
    const coords = normalizeMapCenter(c.lat, c.lng);
    return {
      ...coords,
      name: String(c.name ?? c.city ?? DEFAULT_MAP_CITY.name),
    };
  }
  if (typeof raw === 'string' && raw.trim()) {
    return { ...DEFAULT_MAP_CENTER, name: raw.trim() };
  }
  return { ...DEFAULT_MAP_CITY };
}
