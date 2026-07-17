import { useEffect, useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/shared/Button';
import { useDriverStore } from '@/store/driverStore';
import { useJobStore } from '@/store/jobStore';
import { useUiStore } from '@/store/uiStore';
import { kickDriver, suspendDriver } from '@/lib/suspendedApi';
import { evaluateSuspendGuard, evaluateKickGuard } from '@/lib/suspendDriverGuards';
import {
  hasPendingSuspendAfterTrip,
  queueSuspendAfterTrip,
} from '@/lib/pendingSuspendAfterTrip';
import { type DriverStatus } from '@/types/driver';
import {
  driverConnectivityJobBanner,
  driverPresenceColorHex,
  formatLastSeenAge,
  isDriverConnectivityStale,
  lastSeenAgeMs,
} from '@/lib/driverConnectivity';

export function DriverDetailModal() {
  const open = useUiStore((s) => s.openModal === 'driverDetail');
  const driverId = useUiStore((s) => s.modalDriverId);
  const closeModal = useUiStore((s) => s.closeModal);
  const addToast = useUiStore((s) => s.addToast);
  const drivers = useDriverStore((s) => s.drivers);
  const jobs = useJobStore((s) => s.jobs);
  const driver = drivers.find((d) => d.driverId === driverId);
  const [msg, setMsg] = useState('');
  const [suspendUntil, setSuspendUntil] = useState('');
  const [confirmKick, setConfirmKick] = useState(false);
  const [kickWarning, setKickWarning] = useState<string | null>(null);
  const [suspendWarning, setSuspendWarning] = useState<string | null>(null);
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [open]);

  if (!driver) {
    return (
      <Modal open={open && !!driverId} onClose={closeModal} title="Driver">
        <p className="text-bw-muted text-sm">Driver not found</p>
      </Modal>
    );
  }

  const scheduledAfterTrip = hasPendingSuspendAfterTrip(driver.driverId, driver.vehicleId);

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      addToast({ type: 'success', title: ok });
      closeModal();
    } catch (e) {
      addToast({
        type: 'error',
        title: 'Action failed',
        message: e instanceof Error ? e.message : 'Request failed',
      });
    } finally {
      setBusy(false);
      setConfirmKick(false);
      setKickWarning(null);
      setConfirmSuspend(false);
      setSuspendWarning(null);
    }
  };

  const beginSuspend = () => {
    const guard = evaluateSuspendGuard(driver, jobs);
    if (!guard.canProceed) {
      setSuspendWarning(guard.message || 'Cannot suspend this driver right now.');
      return;
    }
    setConfirmSuspend(true);
  };

  const beginKick = () => {
    const guard = evaluateKickGuard(driver, jobs);
    if (!guard.canProceed) {
      setKickWarning(guard.message || 'Cannot kick this driver right now.');
      return;
    }
    setConfirmKick(true);
  };

  const doSuspend = () =>
    run(
      () =>
        suspendDriver({
          driverId: driver.driverId,
          vehicleId: driver.vehicleId || driver.driverId,
          driverName: driver.driverName,
          vehicleNo: driver.vehicleNo,
          vehicleType: driver.vehicleType,
          zoneName: driver.zoneName,
          suspendedUntil: suspendUntil ? new Date(suspendUntil).toISOString() : undefined,
        }),
      `${driver.driverName} suspended`,
    );

  const scheduleAfterTrip = () => {
    queueSuspendAfterTrip({
      driverId: driver.driverId,
      vehicleId: driver.vehicleId || driver.driverId,
      driverName: driver.driverName,
      vehicleNo: driver.vehicleNo,
      vehicleType: driver.vehicleType,
      zoneName: driver.zoneName,
      suspendedUntil: suspendUntil ? new Date(suspendUntil).toISOString() : undefined,
    });
    setSuspendWarning(null);
    addToast({
      type: 'success',
      title: 'Auto-suspend scheduled',
      message: `${driver.driverName} will be suspended when the trip completes.`,
    });
  };

  const guard = evaluateSuspendGuard(driver, jobs);

  return (
    <>
      <Modal
        open={open}
        onClose={closeModal}
        title={`${driver.driverName} · ${driver.vehicleNo}`}
        footer={<Button variant="ghost" onClick={closeModal}>Close</Button>}
      >
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ background: driverPresenceColorHex(driver.status as DriverStatus, driver.lastSeen, now) }}
            />
            <span className="font-bold">{driver.status}</span>
            <span className="text-bw-muted">· Jobs today: {driver.jobCount ?? 0}</span>
            {scheduledAfterTrip && (
              <span className="text-xs text-amber-400">Suspend after trip</span>
            )}
          </div>
          {(() => {
            const banner = driverConnectivityJobBanner(driver, now);
            const stale = isDriverConnectivityStale(driver.lastSeen, now);
            const age = lastSeenAgeMs(driver.lastSeen, now);
            if (banner) {
              return (
                <div className="text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/15 rounded px-2 py-1">
                  {banner}
                </div>
              );
            }
            if (stale && age != null) {
              return (
                <div className="text-xs text-amber-700 dark:text-amber-300">
                  Last seen {formatLastSeenAge(age)} ago
                </div>
              );
            }
            if (age != null && age <= 30_000) {
              return (
                <div className="text-xs text-bw-muted">
                  Last seen {formatLastSeenAge(age)} ago
                </div>
              );
            }
            return null;
          })()}
          {driver.bookingId && (
            <div className="bw-card p-2 text-xs">
              <div>Current job #{driver.bookingId}</div>
              <div className="text-bw-muted truncate">{driver.jobPickup}</div>
            </div>
          )}
          <label className="block text-xs">
            <span className="text-bw-muted">Suspend until (optional)</span>
            <input
              type="datetime-local"
              value={suspendUntil}
              onChange={(e) => setSuspendUntil(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded bg-bw-bg border border-bw-border text-sm"
            />
          </label>
          <div className="flex gap-2 flex-wrap">
            <Button variant="danger" size="md" disabled={busy} onClick={beginSuspend}>
              Suspend
            </Button>
            <Button variant="gold" size="md" disabled={busy} onClick={beginKick}>
              Kick
            </Button>
            <Button variant="primary" size="md" disabled>
              Move to Front
            </Button>
          </div>
          <div className="flex gap-2">
            <input
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              placeholder="Message driver…"
              className="flex-1 px-3 py-2 rounded bg-bw-bg border border-bw-border text-sm"
            />
            <Button variant="primary" disabled>
              Send
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={confirmSuspend}
        onClose={() => setConfirmSuspend(false)}
        title="Suspend driver?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmSuspend(false)}>Cancel</Button>
            <Button variant="danger" disabled={busy} onClick={() => void doSuspend()}>
              Suspend now
            </Button>
          </>
        }
      >
        <p className="text-sm text-bw-text">
          Suspend <strong>{driver.driverName}</strong> ({driver.vehicleNo})?
        </p>
      </Modal>

      <Modal
        open={!!suspendWarning}
        onClose={() => setSuspendWarning(null)}
        title="Cannot suspend now"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSuspendWarning(null)}>OK</Button>
            {guard.canScheduleAfterTrip && (
              <Button variant="danger" disabled={busy} onClick={scheduleAfterTrip}>
                Schedule after trip
              </Button>
            )}
          </>
        }
      >
        <p className="text-sm text-bw-text">{suspendWarning}</p>
      </Modal>

      <Modal
        open={confirmKick}
        onClose={() => setConfirmKick(false)}
        title="Kick driver?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmKick(false)}>Cancel</Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() =>
                void run(
                  () => kickDriver(driver.driverId, driver.vehicleId || driver.driverId),
                  `${driver.driverName} kicked`,
                )
              }
            >
              Kick driver
            </Button>
          </>
        }
      >
        <p className="text-sm text-bw-text">
          Force sign out <strong>{driver.driverName}</strong> ({driver.vehicleNo})?
        </p>
      </Modal>

      <Modal
        open={!!kickWarning}
        onClose={() => setKickWarning(null)}
        title="Cannot kick now"
        footer={
          <Button variant="ghost" onClick={() => setKickWarning(null)}>OK</Button>
        }
      >
        <p className="text-sm text-bw-text">{kickWarning}</p>
      </Modal>
    </>
  );
}
