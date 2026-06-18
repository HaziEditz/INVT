import { useEffect, useRef, useState } from 'react';
import { getDb, ref, onValue } from '@/lib/firebase';
import { useDriverStore } from '@/store/driverStore';
import {
  driverFromFirebase,
  isGhostOnlineNode,
  isLoggedOutOnlineNode,
  isZoneQueueInactive,
  isZoneQueueRanked,
} from '@/types/driver';
import { findZoneAtCoords, subscribeCompanyZones, type CompanyZone } from '@/lib/companyZones';

export type ZoneQueueDriver = {
  vehicleNo: string;
  driverId: string;
  status: string;
  queue: number;
};

export type ZoneQueueZoneData = {
  ranked: ZoneQueueDriver[];
  inactive: ZoneQueueDriver[];
};

export function useDrivers(companyId: string | null) {
  const setDrivers = useDriverStore((s) => s.setDrivers);
  const zonesRef = useRef<CompanyZone[]>([]);

  useEffect(() => {
    if (!companyId) return;
    return subscribeCompanyZones(companyId, (zones) => {
      zonesRef.current = zones;
    });
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    const db = getDb();
    const r = ref(db, `online/${companyId}`);

    const unsub = onValue(r, (snap) => {
      const list = [];
      const val = snap.val();
      if (val && typeof val === 'object') {
        for (const [vehicleId, rec] of Object.entries(val as Record<string, Record<string, unknown>>)) {
          if (vehicleId === 'current') continue;
          const driver = driverFromFirebase(vehicleId, rec, companyId);
          if (!driver) continue;
          if (!driver.zoneName) {
            const current = (rec.current as Record<string, unknown>) || {};
            const inferred = resolveDriverZoneName(rec, current, zonesRef.current);
            if (inferred) driver.zoneName = inferred;
          }
          list.push(driver);
        }
      }
      setDrivers(list);
    });

    return () => unsub();
  }, [companyId, setDrivers]);
}

function resolveDriverZoneName(
  rec: Record<string, unknown>,
  current: Record<string, unknown>,
  configuredZones: CompanyZone[],
): string {
  const explicit = String(
    rec.zonename ?? rec.zoneName ?? current.zonename ?? current.zoneName ?? '',
  ).trim();
  if (explicit && explicit.toLowerCase() !== 'unknown') return explicit;

  const lat = Number(rec.lat ?? current.lat ?? rec.Lat ?? current.Lat ?? 0);
  const lng = Number(rec.lng ?? current.lng ?? rec.Lng ?? current.Lng ?? 0);
  const hit = findZoneAtCoords(lat, lng, configuredZones);
  return hit?.name ?? '';
}

function partitionZoneDrivers(drivers: ZoneQueueDriver[]): ZoneQueueZoneData {
  const ranked: ZoneQueueDriver[] = [];
  const inactive: ZoneQueueDriver[] = [];
  for (const d of drivers) {
    if (isZoneQueueRanked(d.status)) ranked.push(d);
    else if (isZoneQueueInactive(d.status)) inactive.push({ ...d, queue: 0 });
  }
  ranked.sort((a, b) => a.queue - b.queue || a.vehicleNo.localeCompare(b.vehicleNo));
  inactive.sort((a, b) => a.vehicleNo.localeCompare(b.vehicleNo));
  return { ranked, inactive };
}

function mergeQueueWithConfiguredZones(
  configured: CompanyZone[],
  live: Record<string, ZoneQueueDriver[]>,
): Record<string, ZoneQueueZoneData> {
  const merged: Record<string, ZoneQueueZoneData> = {};
  const names = new Set<string>();
  for (const z of configured) names.add(z.name);
  for (const name of Object.keys(live)) names.add(name);

  for (const name of names) {
    merged[name] = partitionZoneDrivers(live[name] ?? []);
  }
  return merged;
}

export function useDriverQueue(companyId: string | null) {
  const [queueByZone, setQueueByZone] = useState<Record<string, ZoneQueueZoneData>>({});
  const [configuredZones, setConfiguredZones] = useState<CompanyZone[]>([]);
  const configuredRef = useRef<CompanyZone[]>([]);
  const liveRef = useRef<Record<string, ZoneQueueDriver[]>>({});

  useEffect(() => {
    configuredRef.current = configuredZones;
    setQueueByZone(mergeQueueWithConfiguredZones(configuredZones, liveRef.current));
  }, [configuredZones]);

  useEffect(() => {
    if (!companyId) {
      setConfiguredZones([]);
      return;
    }
    return subscribeCompanyZones(companyId, setConfiguredZones);
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    const db = getDb();
    const r = ref(db, `online/${companyId}`);
    const unsub = onValue(r, (snap) => {
      const live: Record<string, ZoneQueueDriver[]> = {};
      const val = snap.val();
      if (val && typeof val === 'object') {
        for (const [vid, rec] of Object.entries(val as Record<string, Record<string, unknown>>)) {
          if (vid === 'current') continue;
          const current = (rec.current as Record<string, unknown>) || {};
          if (isLoggedOutOnlineNode(rec, current) || isGhostOnlineNode(rec, current)) continue;
          const zone = resolveDriverZoneName(rec, current, configuredRef.current);
          if (!zone) continue;
          const status = String(rec.vehiclestatus ?? current.vehiclestatus ?? 'Away');
          const qRaw = rec.zonequeue ?? current.zonequeue ?? rec.zoneQueue ?? current.zoneQueue;
          const q = isZoneQueueRanked(status) && qRaw != null ? Number(qRaw) : 0;
          if (!live[zone]) live[zone] = [];
          live[zone].push({
            vehicleNo: String(rec.vehiclenumber ?? rec.vehicleNo ?? vid),
            driverId: String(rec.driverid ?? rec.driverId ?? ''),
            status,
            queue: Number.isFinite(q) && q > 0 ? q : isZoneQueueRanked(status) ? 999 : 0,
          });
        }
      }
      liveRef.current = live;
      setQueueByZone(mergeQueueWithConfiguredZones(configuredRef.current, live));
    });
    return () => unsub();
  }, [companyId]);

  return { queueByZone, configuredZones };
}
