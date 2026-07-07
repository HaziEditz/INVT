import { useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/shared/Button';
import { useDriverStore } from '@/store/driverStore';
import { useUiStore } from '@/store/uiStore';
import { kickDriver, suspendDriver } from '@/lib/suspendedApi';
import { statusColor } from '@/types/driver';

export function DriverDetailModal() {
  const open = useUiStore((s) => s.openModal === 'driverDetail');
  const driverId = useUiStore((s) => s.modalDriverId);
  const closeModal = useUiStore((s) => s.closeModal);
  const addToast = useUiStore((s) => s.addToast);
  const drivers = useDriverStore((s) => s.drivers);
  const driver = drivers.find((d) => d.driverId === driverId);
  const [msg, setMsg] = useState('');
  const [suspendUntil, setSuspendUntil] = useState('');
  const [confirmKick, setConfirmKick] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!driver) {
    return (
      <Modal open={open && !!driverId} onClose={closeModal} title="Driver">
        <p className="text-bw-muted text-sm">Driver not found</p>
      </Modal>
    );
  }

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
    }
  };

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
            <span className="w-3 h-3 rounded-full" style={{ background: statusColor(driver.status) }} />
            <span className="font-bold">{driver.status}</span>
            <span className="text-bw-muted">· Jobs today: {driver.jobCount ?? 0}</span>
          </div>
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
            <Button
              variant="danger"
              size="md"
              disabled={busy}
              onClick={() =>
                void run(
                  () =>
                    suspendDriver({
                      driverId: driver.driverId,
                      vehicleId: driver.vehicleId || driver.driverId,
                      driverName: driver.driverName,
                      vehicleNo: driver.vehicleNo,
                      vehicleType: driver.vehicleType,
                      zoneName: driver.zoneName,
                      suspendedUntil: suspendUntil
                        ? new Date(suspendUntil).toISOString()
                        : undefined,
                    }),
                  `${driver.driverName} suspended`,
                )
              }
            >
              Suspend
            </Button>
            <Button variant="gold" size="md" disabled={busy} onClick={() => setConfirmKick(true)}>
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
    </>
  );
}
