import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { StatusBar } from '@/components/layout/StatusBar';
import { JobTabs } from '@/components/jobs/JobTabs';
import { CreateJobModal } from '@/components/jobs/CreateJobModal';
import { JobDetailModal } from '@/components/jobs/JobDetailModal';
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
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/shared/Button';
import { Spinner } from '@/components/shared/Spinner';
import { useFirebaseInit } from '@/hooks/useFirebase';
import { useJobs } from '@/hooks/useJobs';
import { useDrivers } from '@/hooks/useDrivers';
import { useSession, useCompanySettings, useRealtimeNotifications } from '@/hooks/useSession';
import { sessionMe, accountStatus } from '@/lib/jobFlow';
import { useUiStore } from '@/store/uiStore';
import { DEFAULT_MAP_CENTER, normalizeMapCenter } from '@/lib/mapCenter';

export function DispatchPage() {
  const navigate = useNavigate();
  const { ready, error, mapsKey } = useFirebaseInit();
  const [companyId, setCompanyId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [dispatcherName, setDispatcherName] = useState(localStorage.getItem('bw_dispatcher_name') || 'Dispatcher');
  const [sessionId] = useState(() => localStorage.getItem('bw_session_id') || `sess_${Date.now()}`);
  const [authChecked, setAuthChecked] = useState(false);
  const emergency = useUiStore((s) => s.emergency);
  const setEmergency = useUiStore((s) => s.setEmergency);
  const settings = useUiStore((s) => s.settings);
  const setBillingBanner = useUiStore((s) => s.setBillingBanner);

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
  useDrivers(activeCompanyId);
  useSession(activeCompanyId, sessionId, dispatcherName);
  useCompanySettings(activeCompanyId);
  useRealtimeNotifications(activeCompanyId);

  useEffect(() => {
    localStorage.setItem('bw_dispatcher_name', dispatcherName);
  }, [dispatcherName]);

  const mapCenter = useMemo(() => {
    if (settings?.city) {
      return normalizeMapCenter(settings.city.lat, settings.city.lng);
    }
    return DEFAULT_MAP_CENTER;
  }, [settings?.city?.lat, settings?.city?.lng, settings?.city?.name]);

  if (!authChecked || !ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bw-bg">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (error) {
    return <div className="min-h-screen flex items-center justify-center text-bw-danger">{error}</div>;
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-bw-bg">
      <Header
        companyId={companyId}
        companyName={companyName}
        dispatcherName={dispatcherName}
        onNameChange={setDispatcherName}
      />
      <div className="flex flex-1 min-h-0">
        <aside className="w-[380px] shrink-0 border-r border-bw-border min-h-0">
          <JobTabs />
        </aside>
        <main className="flex-1 flex flex-col min-w-0 min-h-0">
          <DispatchMap mapsKey={mapsKey} center={mapCenter} companyId={companyId} />
        </main>
        <aside className="w-[460px] shrink-0 border-l border-bw-border flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-hidden">
            <ZoneBoard />
          </div>
          <ZoneQueuePanel companyId={companyId} />
        </aside>
      </div>
      <StatusBar />

      <CreateJobModal mapsKey={mapsKey} companyId={companyId} />
      <JobDetailModal />
      <DriverDetailModal />
      <MessagesModal />
      <ClosedJobsModal companyId={companyId} />
      <SearchJobsModal companyId={companyId} />
      <AlarmsModal />
      <SuspendedModal />
      <AccModal />
      <ToastStack />

      <Modal
        open={!!emergency}
        onClose={() => setEmergency(null)}
        title="EMERGENCY ALERT"
        footer={<Button variant="danger" onClick={() => setEmergency(null)}>Acknowledge</Button>}
      >
        {emergency && (
          <div className="text-center py-6">
            <p className="text-xl font-bold text-bw-danger mb-2">Driver Emergency</p>
            <p className="text-bw-text">{emergency.driverName} · Vehicle {emergency.vehicle}</p>
            <p className="text-sm text-bw-muted mt-2">{emergency.time}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
