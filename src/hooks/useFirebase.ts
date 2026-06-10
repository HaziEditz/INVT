import { useEffect, useState } from 'react';
import { fetchClientConfig, initFirebase } from '@/lib/firebase';

export function useFirebaseInit() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapsKey, setMapsKey] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await fetchClientConfig();
        if (cancelled) return;
        initFirebase(cfg.firebase);
        window.__BW_GOOGLE_MAPS_API_KEY__ = cfg.mapsApiKey;
        setMapsKey(cfg.mapsApiKey);
        setReady(true);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Init failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { ready, error, mapsKey };
}
