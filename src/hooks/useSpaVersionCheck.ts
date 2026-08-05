import { useEffect, useState } from 'react';
import {
  fetchSpaVersion,
  readLoadedSpaModuleSrc,
  spaAssetMismatch,
} from '@/lib/spaVersion';

const CHECK_INTERVAL_MS = 60_000;

/**
 * Detects when a long-lived dispatch tab is still running an older Vite bundle
 * after deploy. Polls /api/spa-version on interval + tab focus.
 */
export function useSpaVersionCheck(): {
  updateAvailable: boolean;
  reload: () => void;
} {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (cancelled || updateAvailable) return;
      const loaded = readLoadedSpaModuleSrc();
      if (!loaded) return;
      const remote = await fetchSpaVersion();
      if (cancelled || !remote?.assetJs) return;
      if (spaAssetMismatch(loaded, remote.assetJs)) {
        setUpdateAvailable(true);
      }
    };

    void check();
    const id = window.setInterval(() => void check(), CHECK_INTERVAL_MS);
    const onVis = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
    };
  }, [updateAvailable]);

  return {
    updateAvailable,
    reload: () => {
      window.location.reload();
    },
  };
}
