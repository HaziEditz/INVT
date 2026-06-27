import { useMemo, useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/shared/Button';
import { useDriverStore } from '@/store/driverStore';
import { useJobStore } from '@/store/jobStore';
import { useUiStore } from '@/store/uiStore';
import { resolveDriverPanelJobCount, statusColor } from '@/types/driver';

export function DriverDetailModal() {
  const open = useUiStore((s) => s.openModal === 'driverDetail');
  const driverId = useUiStore((s) => s.modalDriverId);
  const closeModal = useUiStore((s) => s.closeModal);
  const drivers = useDriverStore((s) => s.drivers);
  const jobs = useJobStore((s) => s.jobs);
  const driver = drivers.find((d) => d.driverId === driverId);
  const jobCount = useMemo(
    () => (driver ? resolveDriverPanelJobCount(driver, jobs) : 0),
    [driver, jobs],
  );
  const [msg, setMsg] = useState('');

  if (!driver) {
    return (
      <Modal open={open && !!driverId} onClose={closeModal} title="Driver">
        <p className="text-bw-muted text-sm">Driver not found</p>
      </Modal>
    );
  }

  return (
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
          <span className="text-bw-muted">· Jobs today: {jobCount}</span>
        </div>
        {driver.bookingId && (
          <div className="bw-card p-2 text-xs">
            <div>Current job #{driver.bookingId}</div>
            <div className="text-bw-muted truncate">{driver.jobPickup}</div>
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          <Button variant="danger" size="md">Suspend</Button>
          <Button variant="gold" size="md">Kick</Button>
          <Button variant="primary" size="md">Move to Front</Button>
        </div>
        <div className="flex gap-2">
          <input
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder="Message driver…"
            className="flex-1 px-3 py-2 rounded bg-bw-bg border border-bw-border text-sm"
          />
          <Button variant="primary">Send</Button>
        </div>
      </div>
    </Modal>
  );
}
