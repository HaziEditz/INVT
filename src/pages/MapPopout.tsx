import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DispatchMap } from '@/components/map/DispatchMap';
import { Spinner } from '@/components/shared/Spinner';
import { useFirebaseInit } from '@/hooks/useFirebase';
import { useDrivers } from '@/hooks/useDrivers';
import { useCompanySettings } from '@/hooks/useSession';
import { sessionMe } from '@/lib/jobFlow';
import { DEFAULT_MAP_CENTER, normalizeMapCenter } from '@/lib/mapCenter';
import { useUiStore } from '@/store/uiStore';

/** Standalone map window — live drivers/zones via shared Firebase stores */
export function MapPopoutPage() {
  const navigate = useNavigate();
  const { ready, error, mapsKey } = useFirebaseInit();
  const [companyId, setCompanyId] = useState('');
  const [authChecked, setAuthChecked] = useState(false);
  const settings = useUiStore((s) => s.settings);

  const activeCompanyId = ready && companyId ? companyId : null;

  useEffect(() => {
    document.title = 'BookaWaka Map';
  }, []);

  useEffect(() => {
    sessionMe()
      .then((s) => {
        setCompanyId(s.companyId);
        setAuthChecked(true);
      })
      .catch(() => navigate('/login', { replace: true }));
  }, [navigate]);

  useDrivers(activeCompanyId);
  useCompanySettings(activeCompanyId);

  const mapCenter = useMemo(() => {
    if (settings?.city) return normalizeMapCenter(settings.city.lat, settings.city.lng);
    return DEFAULT_MAP_CENTER;
  }, [settings?.city?.lat, settings?.city?.lng]);

  if (!authChecked || !ready) {
    return (
      <div className="h-screen flex items-center justify-center bw-map-bg">
        <Spinner className="w-10 h-10 bw-muted" />
      </div>
    );
  }

  if (error) {
    return <div className="h-screen flex items-center justify-center text-red-400">{error}</div>;
  }

  return (
    <div className="h-screen flex flex-col bw-shell">
      <div className="h-8 shrink-0 flex items-center px-3 bw-header-bar border-b bw-border text-xs font-semibold bw-muted">
        BookaWaka Live Map · {companyId}
      </div>
      <DispatchMap mapsKey={mapsKey} center={mapCenter} companyId={companyId} />
    </div>
  );
}
