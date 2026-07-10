import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { StatusBar } from '@/components/layout/StatusBar';
import { ResizableDispatchLayout } from '@/components/layout/ResizableDispatchLayout';
import { JobTabs } from '@/components/jobs/JobTabs';
import { CreateJobModal } from '@/components/jobs/CreateJobModal';
import { JobDetailModal } from '@/components/jobs/JobDetailModal';
import { ClosedJobDetailModal } from '@/components/jobs/ClosedJobDetailModal';
import { ZoneBoard } from '@/components/drivers/ZoneBoard';
import { ZoneQueuePanel } from '@/components/drivers/ZoneQueuePanel';
import { DriverDetailModal } from '@/components/drivers/DriverDetailModal';
import { DispatchMap } from '@/components/map/DispatchMap';
import { MessagesModal } from '@/components/modals/MessagesModal';
import { ClosedJobsModal } from '@/components/modals/ClosedJobsModal';
import { SearchJobsModal } from '@/components/modals/SearchJobsModal';
import { AlarmsModal } from '@/components/modals/AlarmsModal';
import { SuspendedModal } from '@/components/modals/SuspendedModal';
import { AccModal } from '@/components/modals/AccModal';
import { ToastStack } from '@/components/shared/Toast';
import { Button } from '@/components/shared/Button';
import { Spinner } from '@/components/shared/Spinner';
import { useFirebaseInit } from '@/hooks/useFirebase';
import { useJobs, useDispatchWindowAlerts } from '@/hooks/useJobs';
import { useDrivers } from '@/hooks/useDrivers';
import { useSession, useCompanySettings, useRealtimeNotifications } from '@/hooks/useSession';
import { sessionMe, accountStatus } from '@/lib/jobFlow';
import { acknowledgeSos, resolveSos, falseAlarmSos } from '@/lib/sosApi';
import { stopEmergencyAlarm } from '@/lib/notifySound';
import { useUiStore } from '@/store/uiStore';
import { useJobStore } from '@/store/jobStore';
import { DEFAULT_MAP_CENTER, normalizeMapCenter } from '@/lib/mapCenter';

export function DispatchPage() {
  const navigate = useNavigate();
  const { ready, error, mapsKey } = useFirebaseInit();
  const [companyId, setCompanyId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [dispatcherName, setDispatcherName] = useState(localStorage.getItem('bw_dispatcher_name') || 'Dispatcher');
  const [sessionId] = useState(() => localStorage.getItem('bw_session_id') || `sess_${Date.now()}`);
  const [authChecked, setAuthChecked] = useState(false);
  const popOutRef = useRef<Window | null>(null);
  const emergency = useUiStore((s) => s.emergency);
  const emergencyQueue = useUiStore((s) => s.emergencyQueue);
  const setEmergency = useUiStore((s) => s.setEmergency);
  const settings = useUiStore((s) => s.settings);
  const setBillingBanner = useUiStore((s) => s.setBillingBanner);
  const mapFullscreen = useUiStore((s) => s.mapFullscreen);
  const setMapFullscreen = useUiStore((s) => s.setMapFullscreen);
  const mapPoppedOut = useUiStore((s) => s.mapPoppedOut);
  const setMapPoppedOut = useUiStore((s) => s.setMapPoppedOut);
  const selectedJobId = useJobStore((s) => s.selectedJobId);
  const jobs = useJobStore((s) => s.jobs);

  const activeCompanyId = ready && companyId ? companyId : null;

  useEffect(() => {
    sessionMe()
      .then(async (s) => {
        setCompanyId(s.companyId);
        setCompanyName(s.company);
        localStorage.setItem('bw_company_id', s.companyId);
        const acct = await accountStatus(s.companyId);
        if (acct.loginBlocked) {
          setBillingBanner(acct.blockMessage || 'Subscription expired — contact support@bookawaka.com');
        }
        setAuthChecked(true);
      })
      .catch(() => navigate('/login', { replace: true }));
  }, [navigate, setBillingBanner]);

  useJobs(activeCompanyId);
  useDispatchWindowAlerts(jobs);
  useDrivers(activeCompanyId);
  useSession(activeCompanyId, sessionId, dispatcherName);
  useCompanySettings(activeCompanyId);
  useRealtimeNotifications(activeCompanyId);

  useEffect(() => {
    localStorage.setItem('bw_dispatcher_name', dispatcherName);
  }, [dispatcherName]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mapFullscreen) setMapFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mapFullscreen, setMapFullscreen]);

  useEffect(() => {
    const tick = setInterval(() => {
      if (popOutRef.current?.closed) {
        popOutRef.current = null;
        setMapPoppedOut(false);
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [setMapPoppedOut]);

  const mapCenter = useMemo(() => {
    if (settings?.city) return normalizeMapCenter(settings.city.lat, settings.city.lng);
    return DEFAULT_MAP_CENTER;
  }, [settings?.city?.lat, settings?.city?.lng, settings?.city?.name]);

  const togglePopOut = () => {
    if (popOutRef.current && !popOutRef.current.closed) {
      popOutRef.current.close();
      popOutRef.current = null;
      setMapPoppedOut(false);
      return;
    }
    popOutRef.current = window.open(
      '/dispatch/map',
      'bw-dispatch-map',
      'width=1280,height=800,menubar=no,toolbar=no,location=no'
    );
    setMapPoppedOut(!!popOutRef.current);
  };

  if (!authChecked || !ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bw-shell">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (error) {
    return <div className="min-h-screen flex items-center justify-center text-red-400">{error}</div>;
  }

  const mapNode = (
    <DispatchMap
      mapsKey={mapsKey}
      center={mapCenter}
      companyId={companyId}
      selectedJobId={selectedJobId}
      onPopOut={togglePopOut}
      onFullscreen={() => setMapFullscreen(true)}
      popOutActive={mapPoppedOut}
    />
  );

  const rightPanel = (
    <>
      <div className="flex-1 min-h-0 overflow-hidden">
        <ZoneBoard />
      </div>
      <ZoneQueuePanel companyId={companyId} />
    </>
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden bw-shell">
      <Header
        companyId={companyId}
        companyName={companyName}
        dispatcherName={dispatcherName}
        onNameChange={setDispatcherName}
      />
      {emergency && (
        <div
          className={[
            'px-3 py-2 border-b border-red-800/70',
            emergency.status === 'active'
              ? 'bg-red-700 text-white animate-pulse'
              : 'bg-red-900/80 text-red-100',
          ].join(' ')}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-extrabold tracking-wide">SOS</span>
            <span className="text-sm">
              {emergency.driverName} · {emergency.vehicle || 'No vehicle'}
              {emergency.driverPhone ? (
                <>
                  {' · '}
                  <a href={`tel:${emergency.driverPhone}`} className="underline font-semibold">
                    {emergency.driverPhone}
                  </a>
                </>
              ) : null}
            </span>
            <span className="text-xs opacity-90">
              {emergency.locationAddress || `${emergency.lat.toFixed(5)}, ${emergency.lng.toFixed(5)}`}
            </span>
            <span className="ml-auto text-[11px] opacity-90">{emergency.time}</span>
          </div>
          {!!emergency.dispatchMessage && (
            <div className="text-xs mt-1 opacity-95">{emergency.dispatchMessage}</div>
          )}
          {emergency.responders.length > 0 && (
            <div className="text-xs mt-1">
              Responding:{' '}
              {emergency.responders
                .sort((a, b) => (a.respondedAt || 0) - (b.respondedAt || 0))
                .map((r) => `${r.name}${r.vehicleNo ? ` (${r.vehicleNo})` : ''}`)
                .join(', ')}
            </div>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            {emergency.status === 'active' ? (
              <Button
                variant="danger"
                onClick={async () => {
                  try {
                    await acknowledgeSos(emergency.sosId, dispatcherName);
                    stopEmergencyAlarm();
                  } catch (e) {
                    console.error('[SOS] acknowledge failed', e);
                  }
                }}
              >
                Acknowledge
              </Button>
            ) : (
              <>
                <Button
                  variant="primary"
                  onClick={async () => {
                    try {
                      await resolveSos(emergency.sosId);
                      setEmergency(null);
                    } catch (e) {
                      console.error('[SOS] resolve failed', e);
                    }
                  }}
                >
                  Resolve
                </Button>
                <Button
                  variant="ghost"
                  onClick={async () => {
                    try {
                      await falseAlarmSos(emergency.sosId);
                      setEmergency(null);
                    } catch (e) {
                      console.error('[SOS] false alarm failed', e);
                    }
                  }}
                >
                  False alarm
                </Button>
              </>
            )}
          </div>
          {emergencyQueue.length > 0 && (
            <div className="mt-2 text-[11px] opacity-90">
              Queued SOS: {emergencyQueue.map((q) => `${q.driverName}${q.vehicle ? ` (${q.vehicle})` : ''}`).join(' · ')}
            </div>
          )}
        </div>
      )}

      <ResizableDispatchLayout left={<JobTabs companyId={companyId} />} center={mapNode} right={rightPanel} />

      {mapFullscreen && (
        <div className="fixed inset-x-0 top-11 bottom-[32px] z-40 bw-map-bg">
          <DispatchMap
            mapsKey={mapsKey}
            center={mapCenter}
            companyId={companyId}
            selectedJobId={selectedJobId}
            compactControls
          />
          <button
            type="button"
            className="absolute top-2 right-2 z-50 px-3 py-1.5 rounded-md text-xs font-semibold bw-surface border bw-border bw-text hover:border-[var(--bw-accent)] shadow-lg"
            onClick={() => setMapFullscreen(false)}
          >
            Exit Fullscreen (Esc)
          </button>
        </div>
      )}

      <StatusBar />

      <CreateJobModal mapsKey={mapsKey} companyId={companyId} dispatcherName={dispatcherName} />
      <JobDetailModal />
      <ClosedJobDetailModal companyId={companyId} mapsKey={mapsKey} />
      <DriverDetailModal />
      <MessagesModal companyId={activeCompanyId} />
      <ClosedJobsModal companyId={companyId} />
      <SearchJobsModal companyId={companyId} />
      <AlarmsModal companyId={companyId} />
      <SuspendedModal companyId={companyId} />
      <AccModal />
      <ToastStack />
    </div>
  );
}
