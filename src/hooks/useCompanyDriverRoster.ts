import { useEffect, useMemo, useState } from 'react';
import { getDb, onValue, ref } from '@/lib/firebase';
import { useDriverStore } from '@/store/driverStore';
import { driverIdsMatch } from '@/types/driver';

export type CompanyDriverRosterEntry = {
  driverId: string;
  vehicleId: string;
  driverName: string;
  vehicleNo: string;
  vehicleType: string;
  zoneName: string;
  isOnline: boolean;
  onlineStatus: string;
};

function normVehicleNo(raw: string): string {
  const s = String(raw || '').trim();
  if (/^DD\d+$/i.test(s)) return s.slice(1);
  return s;
}

function rosterFromProfile(
  key: string,
  prof: Record<string, unknown>,
): CompanyDriverRosterEntry | null {
  const driverId = String(
    prof.id ?? prof.dispatcherId ?? prof.driverId ?? prof.DriverId ?? key,
  ).trim();
  if (!driverId || driverId === '0') return null;

  let vehicleId = '';
  if (Array.isArray(prof.assignedVehicles) && prof.assignedVehicles.length) {
    vehicleId = String(prof.assignedVehicles[0] ?? '').trim();
  }
  if (!vehicleId) {
    vehicleId = String(
      prof.allocatedTaxi ?? prof.vehicleId ?? prof.currentVehicleId ?? prof.VehicleId ?? '',
    ).trim();
  }
  if (!vehicleId) vehicleId = driverId;

  const driverName = String(
    prof.name ?? prof.driverName ?? prof.drivername ?? prof.DriverName ?? '',
  ).trim();
  const vehicleNo = normVehicleNo(
    String(prof.vehicleNo ?? prof.vehiclenumber ?? prof.vehicleNumber ?? vehicleId),
  );
  const vehicleType = String(prof.vehicleType ?? prof.vehicletype ?? 'Sedan').trim();

  return {
    driverId,
    vehicleId,
    driverName: driverName || `Driver ${driverId}`,
    vehicleNo: vehicleNo || vehicleId,
    vehicleType,
    zoneName: '',
    isOnline: false,
    onlineStatus: 'Offline',
  };
}

export function useCompanyDriverRoster(companyId: string | null) {
  const onlineDrivers = useDriverStore((s) => s.drivers);
  const [roster, setRoster] = useState<CompanyDriverRosterEntry[]>([]);

  useEffect(() => {
    if (!companyId) {
      setRoster([]);
      return;
    }
    const db = getDb();
    const r = ref(db, `drivers/${companyId}`);
    const unsub = onValue(r, (snap) => {
      const val = snap.val();
      const byKey = new Map<string, CompanyDriverRosterEntry>();
      if (val && typeof val === 'object') {
        for (const [key, raw] of Object.entries(val as Record<string, unknown>)) {
          if (!raw || typeof raw !== 'object') continue;
          const entry = rosterFromProfile(key, raw as Record<string, unknown>);
          if (!entry) continue;
          const mapKey = `${entry.driverId}:${entry.vehicleId}`;
          if (!byKey.has(mapKey)) byKey.set(mapKey, entry);
        }
      }
      setRoster(Array.from(byKey.values()));
    });
    return () => unsub();
  }, [companyId]);

  return useMemo(() => {
    const merged = new Map<string, CompanyDriverRosterEntry>();
    for (const r of roster) {
      merged.set(`${r.driverId}:${r.vehicleId}`, { ...r });
    }
    for (const d of onlineDrivers) {
      if (!d.driverId) continue;
      const mapKey = `${d.driverId}:${d.vehicleId || d.driverId}`;
      const existing = merged.get(mapKey);
      if (existing) {
        existing.isOnline = true;
        existing.onlineStatus = d.status;
        existing.zoneName = d.zoneName || existing.zoneName;
        existing.driverName = d.driverName || existing.driverName;
        existing.vehicleNo = d.vehicleNo || existing.vehicleNo;
        existing.vehicleType = d.vehicleType || existing.vehicleType;
      } else {
        merged.set(mapKey, {
          driverId: d.driverId,
          vehicleId: d.vehicleId || d.driverId,
          driverName: d.driverName || d.driverId,
          vehicleNo: d.vehicleNo || d.vehicleId,
          vehicleType: d.vehicleType || 'Sedan',
          zoneName: d.zoneName || '',
          isOnline: true,
          onlineStatus: d.status,
        });
      }
    }
    return Array.from(merged.values()).sort((a, b) => {
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      return (a.driverName || a.driverId).localeCompare(b.driverName || b.driverId);
    });
  }, [roster, onlineDrivers]);
}

export function rosterEntryKey(entry: Pick<CompanyDriverRosterEntry, 'driverId' | 'vehicleId'>) {
  return `${entry.driverId}:${entry.vehicleId}`;
}

export function findRosterEntry(
  roster: CompanyDriverRosterEntry[],
  driverId: string,
  vehicleId?: string,
) {
  return roster.find(
    (r) =>
      driverIdsMatch(r.driverId, driverId) &&
      (!vehicleId || driverIdsMatch(r.vehicleId, vehicleId)),
  );
}
