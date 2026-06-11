import { useEffect, useState } from 'react';
import { getDb, ref, onValue } from '@/lib/firebase';
import { parseTariffRecord, type TariffRate } from '@/lib/fareEstimate';

const DEFAULT_TARIFF: TariffRate = {
  id: '1',
  name: 'Standard',
  startPrice: 3.5,
  distanceRate: 2.2,
  minimumFare: 0,
};

function mergeTariffMaps(maps: Map<string, TariffRate>[]): TariffRate[] {
  const out = new Map<string, TariffRate>();
  for (const m of maps) for (const [k, v] of m) out.set(k, v);
  return Array.from(out.values());
}

export function useTariffs(companyId: string | null) {
  const [tariffs, setTariffs] = useState<TariffRate[]>([DEFAULT_TARIFF]);

  useEffect(() => {
    if (!companyId) return;
    const db = getDb();
    const maps = [new Map<string, TariffRate>(), new Map<string, TariffRate>()];

    const sync = () => {
      const merged = mergeTariffMaps(maps);
      setTariffs(merged.length ? merged : [DEFAULT_TARIFF]);
    };

    const ingest = (idx: number, snap: { val: () => unknown; forEach?: (cb: (c: { key: string; val: () => unknown }) => void) => void }) => {
      maps[idx] = new Map();
      const val = snap.val();
      if (!val || typeof val !== 'object') {
        sync();
        return;
      }
      if (Array.isArray(val)) {
        val.forEach((rec, i) => {
          if (rec && typeof rec === 'object') {
            const t = parseTariffRecord(String(i), rec as Record<string, unknown>);
            if (t) maps[idx].set(t.id, t);
          }
        });
      } else {
        for (const [key, rec] of Object.entries(val as Record<string, Record<string, unknown>>)) {
          if (key.startsWith('zone_grid_')) continue;
          const t = parseTariffRecord(key, rec);
          if (t) maps[idx].set(t.id, t);
        }
      }
      sync();
    };

    const unsubTariffs = onValue(ref(db, `tariffs/${companyId}`), (snap) => ingest(0, snap));
    const unsubZones = onValue(ref(db, `tariffZones/${companyId}`), (snap) => ingest(1, snap));

    return () => {
      unsubTariffs();
      unsubZones();
    };
  }, [companyId]);

  return tariffs;
}
