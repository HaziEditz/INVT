import { useEffect, useState } from 'react';
import type { Job, JobTab } from '@/types/job';
import { parseLiveMeterFromRecord } from '@/types/driver';
import { getDbSafe, ref, onValue } from '@/lib/firebase';

/** Direct online/current subscription for active-tab live meter fields. */
export function useLiveJobMeter(
  job: Job,
  tab: JobTab,
  vehicleId?: string,
): ReturnType<typeof parseLiveMeterFromRecord> {
  const [live, setLive] = useState<ReturnType<typeof parseLiveMeterFromRecord>>({});

  useEffect(() => {
    if (tab !== 'active' || !job.companyId || !vehicleId) {
      setLive({});
      return;
    }
    const db = getDbSafe();
    if (!db) {
      setLive({});
      return;
    }
    const path = ref(db, `online/${job.companyId}/${vehicleId}/current`);
    return onValue(path, (snap) => {
      const val = snap.val();
      if (!val || typeof val !== 'object') {
        setLive({});
        return;
      }
      const rec = val as Record<string, unknown>;
      setLive(parseLiveMeterFromRecord(rec, rec));
    });
  }, [tab, job.companyId, vehicleId]);

  return live;
}
