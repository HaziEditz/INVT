import { useEffect, useState } from 'react';
import { fetchClosedJobDetail, type ClosedJobDetail } from '@/lib/closedJobDetail';

export function useClosedJobDetail(
  companyId: string | null,
  jobId: number | null,
  enabled: boolean,
) {
  const [detail, setDetail] = useState<ClosedJobDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !companyId || !jobId) {
      setDetail(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchClosedJobDetail(companyId, jobId)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setDetail(null);
          setError('Closed job not found.');
          return;
        }
        setDetail(result);
      })
      .catch((e) => {
        if (cancelled) return;
        setDetail(null);
        setError((e && e.message) || 'Failed to load closed job.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, jobId, enabled]);

  return { detail, loading, error };
}
