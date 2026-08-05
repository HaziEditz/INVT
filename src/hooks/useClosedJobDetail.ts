import { useEffect, useRef, useState } from 'react';
import { fetchClosedJobDetail, type ClosedJobDetail } from '@/lib/closedJobDetail';
import {
  resolveClosedJobDetailCompanyId,
  shouldFetchClosedJobDetail,
} from '@/lib/closedJobDetailFetchGate';

export function useClosedJobDetail(
  companyId: string | null,
  jobId: number | null,
  enabled: boolean,
) {
  const [detail, setDetail] = useState<ClosedJobDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchSeq = useRef(0);

  useEffect(() => {
    if (!shouldFetchClosedJobDetail({ enabled, jobId })) {
      fetchSeq.current += 1;
      setDetail(null);
      setError(null);
      setLoading(false);
      return;
    }

    const id = Number(jobId);
    const cid = resolveClosedJobDetailCompanyId(companyId);
    const seq = ++fetchSeq.current;
    setLoading(true);
    setError(null);
    // Keep prior detail until the in-flight response applies (avoids empty flash).

    fetchClosedJobDetail(cid || 'unknown', id)
      .then((result) => {
        if (seq !== fetchSeq.current) {
          // TEMP: remove with closed-job-debug probe
          console.log('[closed-job-debug]', {
            phase: 'skip-stale-fetch',
            jobId: id,
            seq,
            currentSeq: fetchSeq.current,
            parsedFareBreakdown: result?.fareBreakdown ?? null,
            parsedTimelineLen: result?.timeline?.length ?? 0,
          });
          return;
        }
        if (!result) {
          setDetail(null);
          setError('Closed job not found.');
          return;
        }
        setDetail(result);
        // TEMP: remove with closed-job-debug probe
        console.log('[closed-job-debug]', {
          phase: 'apply-to-react-state',
          jobId: id,
          seq,
          parsedFareBreakdown: result.fareBreakdown,
          parsedTimelineLen: result.timeline.length,
        });
      })
      .catch((e) => {
        if (seq !== fetchSeq.current) return;
        setDetail(null);
        setError((e && e.message) || 'Failed to load closed job.');
      })
      .finally(() => {
        if (seq === fetchSeq.current) setLoading(false);
      });
  }, [companyId, jobId, enabled]);

  return { detail, loading, error };
}
