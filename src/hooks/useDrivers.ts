import { useEffect, useRef, useState } from 'react';
import { getDb, ref, onValue } from '@/lib/firebase';
import { useDriverStore } from '@/store/driverStore';
import { driverFromFirebase, isGhostOnlineNode, isLoggedOutOnlineNode } from '@/types/driver';
import { findZoneAtCoords, subscribeCompanyZones, type CompanyZone } from '@/lib/companyZones';

export type ZoneQueueDriver = {
  vehicleNo: string;
  driverId: string;
  status: string;
  queue: number;
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

function mergeQueueWithConfiguredZones(
  configured: CompanyZone[],
  live: Record<string, ZoneQueueDriver[]>,
): Record<string, ZoneQueueDriver[]> {
  const merged: Record<string, ZoneQueueDriver[]> = {};
  for (const z of configured) {
    merged[z.name] = live[z.name] ? [...live[z.name]] : [];
  }
  for (const [name, drivers] of Object.entries(live)) {
    if (!merged[name]) merged[name] = [...drivers];
  }
  for (const z of Object.keys(merged)) {
    merged[z].sort((a, b) => a.queue - b.queue);
  }
  return merged;
}

export function useDriverQueue(companyId: string | null) {
  const [queueByZone, setQueueByZone] = useState<Record<string, ZoneQueueDriver[]>>({});
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
          const q = qRaw != null ? Number(qRaw) : 999;
          if (!live[zone]) live[zone] = [];
          live[zone].push({
            vehicleNo: String(rec.vehiclenumber ?? rec.vehicleNo ?? vid),
            driverId: String(rec.driverid ?? rec.driverId ?? ''),
            status,
            queue: Number.isFinite(q) ? q : 999,
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
