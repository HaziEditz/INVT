import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/shared/Button';
import { Spinner } from '@/components/shared/Spinner';
import { useUiStore } from '@/store/uiStore';
import { useJobStore } from '@/store/jobStore';
import {
  findRosterEntry,
  rosterEntryKey,
  useCompanyDriverRoster,
  type CompanyDriverRosterEntry,
} from '@/hooks/useCompanyDriverRoster';
import {
  fetchSuspendedDrivers,
  kickDriver,
  suspendDriver,
  unsuspendDriver,
  updateSuspensionUntil,
  type SuspendedDriverRow,
} from '@/lib/suspendedApi';
import { evaluateSuspendGuard } from '@/lib/suspendDriverGuards';
import {
  hasPendingSuspendAfterTrip,
  queueSuspendAfterTrip,
  usePendingSuspendAfterTrip,
} from '@/lib/pendingSuspendAfterTrip';
import { statusColor, type DriverStatus } from '@/types/driver';

const TH =
  'text-left p-2 text-[10px] font-semibold text-bw-text uppercase tracking-wide border-r border-b border-bw-border bg-bw-surface whitespace-nowrap';

const TD = 'p-2 text-bw-text border-r border-b border-bw-border align-middle';

function formatWhen(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const d = parseISO(iso.includes('T') ? iso : iso.replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return iso;
    return format(d, 'dd/MM/yyyy HH:mm');
  } catch {
    return iso;
  }
}

function toLocalInputValue(iso?: string | null): string {
  if (!iso) return '';
  try {
    const d = parseISO(iso.includes('T') ? iso : iso.replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}

interface SuspendedModalProps {
  companyId: string;
}

type SuspendFlow =
  | { kind: 'confirm'; driver: CompanyDriverRosterEntry; until: string }
  | { kind: 'warning'; driver: CompanyDriverRosterEntry; message: string; canSchedule: boolean; until: string };

export function SuspendedModal({ companyId }: SuspendedModalProps) {
  usePendingSuspendAfterTrip();

  const open = useUiStore((s) => s.openModal === 'suspended');
  const closeModal = useUiStore((s) => s.closeModal);
  const addToast = useUiStore((s) => s.addToast);
  const roster = useCompanyDriverRoster(companyId || null);
  const jobs = useJobStore((s) => s.jobs);

  const [rows, setRows] = useState<SuspendedDriverRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [suspendFlow, setSuspendFlow] = useState<SuspendFlow | null>(null);
  const [confirmKickOnline, setConfirmKickOnline] = useState<CompanyDriverRosterEntry | null>(null);
  const [confirmKickSuspended, setConfirmKickSuspended] = useState<SuspendedDriverRow | null>(null);
  const [editUntil, setEditUntil] = useState<Record<string, string>>({});
  const [offlineUntil, setOfflineUntil] = useState('');
  const [offlinePick, setOfflinePick] = useState('');

  const suspendedKeys = useMemo(
    () => new Set(rows.map((r) => `${r.driverId}:${r.vehicleId}`)),
    [rows],
  );

  const onlineDrivers = useMemo(
    () => roster.filter((d) => d.isOnline && !suspendedKeys.has(rosterEntryKey(d))),
    [roster, suspendedKeys],
  );

  const offlineCandidates = useMemo(
    () => roster.filter((d) => !d.isOnline && !suspendedKeys.has(rosterEntryKey(d))),
    [roster, suspendedKeys],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchSuspendedDrivers();
      setRows(list);
      const nextEdit: Record<string, string> = {};
      for (const r of list) {
        const key = `${r.driverId}:${r.vehicleId}`;
        nextEdit[key] = toLocalInputValue(r.suspendedUntil);
      }
      setEditUntil(nextEdit);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load suspended drivers');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setSuspendFlow(null);
    setConfirmKickOnline(null);
    setConfirmKickSuspended(null);
    setOfflinePick('');
    setOfflineUntil('');
    void load();
  }, [open, load]);

  const runAction = async (key: string, fn: () => Promise<void>, okMsg: string) => {
    setBusyId(key);
    try {
      await fn();
      addToast({ type: 'success', title: okMsg });
      await load();
    } catch (e) {
      addToast({
        type: 'error',
        title: 'Action failed',
        message: e instanceof Error ? e.message : 'Request failed',
      });
    } finally {
      setBusyId(null);
    }
  };

  const beginSuspend = (driver: CompanyDriverRosterEntry, until = '') => {
    const guard = evaluateSuspendGuard(driver, jobs);
    if (guard.canProceed) {
      setSuspendFlow({ kind: 'confirm', driver, until });
      return;
    }
    setSuspendFlow({
      kind: 'warning',
      driver,
      message: guard.message || 'Cannot suspend this driver right now.',
      canSchedule: guard.canScheduleAfterTrip,
      until,
    });
  };

  const executeSuspend = async (driver: CompanyDriverRosterEntry, until: string) => {
    const untilIso = until ? new Date(until).toISOString() : '';
    await runAction(
      rosterEntryKey(driver),
      () =>
        suspendDriver({
          driverId: driver.driverId,
          vehicleId: driver.vehicleId || driver.driverId,
          driverName: driver.driverName,
          vehicleNo: driver.vehicleNo,
          vehicleType: driver.vehicleType,
          zoneName: driver.zoneName,
          suspendedUntil: untilIso || undefined,
        }),
      `${driver.driverName || driver.driverId} suspended`,
    );
  };

  const handleOfflineSuspend = () => {
    const [driverId, vehicleId] = offlinePick.split('|');
    const d = findRosterEntry(roster, driverId, vehicleId);
    if (!d) {
      addToast({ type: 'error', title: 'Select a driver to suspend' });
      return;
    }
    beginSuspend(d, offlineUntil);
  };

  return (
    <>
      <Modal
        open={open}
        onClose={closeModal}
        title="Suspend / Kick"
        wide
        footer={<Button variant="ghost" onClick={closeModal}>Close</Button>}
      >
        <div className="space-y-4 text-sm text-bw-text">
          <section className="rounded-md border border-bw-border bg-bw-surface/80 p-3 space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wide text-bw-text">
              Online drivers
            </div>
            {onlineDrivers.length === 0 ? (
              <p className="text-xs text-bw-muted py-2">No online drivers available to suspend.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-bw-border bg-bw-card">
                <table className="w-full text-xs border-collapse min-w-[720px]">
                  <thead>
                    <tr>
                      <th className={TH}>Driver</th>
                      <th className={TH}>Vehicle</th>
                      <th className={TH}>Status</th>
                      <th className={TH}>Zone</th>
                      <th className={`${TH} border-r-0`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-bw-card">
                    {onlineDrivers.map((d) => {
                      const key = rosterEntryKey(d);
                      const busy = busyId === key;
                      const scheduled = hasPendingSuspendAfterTrip(d.driverId, d.vehicleId);
                      return (
                        <tr key={key} className="border-b border-bw-border hover:bg-bw-surface/60">
                          <td className={`${TD} font-medium whitespace-nowrap`}>
                            <span className="inline-flex items-center gap-1.5">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ background: statusColor(d.onlineStatus as DriverStatus) }}
                              />
                              {d.driverName}
                            </span>
                          </td>
                          <td className={`${TD} whitespace-nowrap`}>{d.vehicleNo || '—'}</td>
                          <td className={`${TD} whitespace-nowrap`}>
                            {d.onlineStatus}
                            {scheduled && (
                              <span className="block text-[10px] text-amber-400">Suspend after trip</span>
                            )}
                          </td>
                          <td className={`${TD} whitespace-nowrap`}>{d.zoneName || '—'}</td>
                          <td className={`${TD} border-r-0 whitespace-nowrap`}>
                            <div className="flex flex-wrap gap-1">
                              <Button
                                variant="danger"
                                size="sm"
                                disabled={busy}
                                onClick={() => beginSuspend(d)}
                              >
                                Suspend
                              </Button>
                              <Button
                                variant="gold"
                                size="sm"
                                disabled={busy}
                                onClick={() => setConfirmKickOnline(d)}
                              >
                                Kick
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {offlineCandidates.length > 0 && (
            <section className="rounded-md border border-bw-border bg-bw-surface/60 p-3 space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wide text-bw-text">
                Offline drivers
              </div>
              <div className="flex flex-wrap gap-2 items-end">
                <label className="flex-1 min-w-[220px]">
                  <span className="text-bw-muted block mb-1 text-xs">Driver</span>
                  <select
                    value={offlinePick}
                    onChange={(e) => setOfflinePick(e.target.value)}
                    className="px-2 py-1.5 rounded-md bg-bw-surface border border-bw-border text-xs text-bw-text min-w-[200px] focus:border-bw-primary focus:outline-none w-full"
                  >
                    <option value="">Select offline driver…</option>
                    {offlineCandidates.map((d) => (
                      <option key={rosterEntryKey(d)} value={`${d.driverId}|${d.vehicleId}`}>
                        {d.driverName} · {d.vehicleNo || d.vehicleId}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="text-bw-muted block mb-1 text-xs">Suspended until</span>
                  <input
                    type="datetime-local"
                    value={offlineUntil}
                    onChange={(e) => setOfflineUntil(e.target.value)}
                    className="bw-datetime-input px-2 py-1.5 rounded-md border text-sm min-w-[180px]"
                  />
                </label>
                <Button
                  variant="danger"
                  onClick={handleOfflineSuspend}
                  disabled={!offlinePick || busyId === 'offline-suspend'}
                >
                  Suspend
                </Button>
              </div>
            </section>
          )}

          <section className="space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wide text-bw-text">
              Suspended drivers
            </div>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-bw-muted">
                <Spinner />
                Loading suspended drivers…
              </div>
            ) : error ? (
              <p className="text-red-400 py-6 text-center">{error}</p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-bw-border bg-bw-card">
                <table className="w-full text-xs border-collapse min-w-[820px]">
                  <thead>
                    <tr>
                      <th className={TH}>Driver</th>
                      <th className={TH}>Vehicle</th>
                      <th className={TH}>Suspended</th>
                      <th className={TH}>Until</th>
                      <th className={TH}>Zone</th>
                      <th className={`${TH} border-r-0`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-bw-card">
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center text-bw-muted py-8">
                          No suspended drivers
                        </td>
                      </tr>
                    ) : (
                      rows.map((r) => {
                        const key = `${r.driverId}:${r.vehicleId}`;
                        const busy = busyId === key;
                        return (
                          <tr
                            key={key}
                            className="border-b border-bw-border hover:bg-bw-surface/60"
                          >
                            <td className={`${TD} font-medium whitespace-nowrap`}>
                              {r.driverName || r.driverId}
                            </td>
                            <td className={`${TD} whitespace-nowrap`}>
                              {r.vehicleNo || r.vehicleId || '—'}
                            </td>
                            <td className={`${TD} whitespace-nowrap text-bw-muted`}>
                              {formatWhen(r.suspendedAt)}
                            </td>
                            <td className={TD}>
                              <input
                                type="datetime-local"
                                value={editUntil[key] ?? ''}
                                onChange={(e) =>
                                  setEditUntil((prev) => ({ ...prev, [key]: e.target.value }))
                                }
                                className="bw-datetime-input px-1.5 py-1 rounded-md border text-xs min-w-[160px]"
                              />
                            </td>
                            <td className={`${TD} whitespace-nowrap`}>{r.zoneName || '—'}</td>
                            <td className={`${TD} border-r-0 whitespace-nowrap`}>
                              <div className="flex flex-wrap gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() =>
                                    void runAction(
                                      key,
                                      () =>
                                        updateSuspensionUntil(
                                          r.driverId,
                                          r.vehicleId,
                                          editUntil[key]
                                            ? new Date(editUntil[key]).toISOString()
                                            : '',
                                        ),
                                      'Suspension updated',
                                    )
                                  }
                                >
                                  Save until
                                </Button>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() =>
                                    void runAction(
                                      key,
                                      () => unsuspendDriver(r.driverId, r.vehicleId),
                                      `${r.driverName || r.driverId} unsuspended`,
                                    )
                                  }
                                >
                                  Unsuspend
                                </Button>
                                <Button
                                  variant="danger"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => setConfirmKickSuspended(r)}
                                >
                                  Kick
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </Modal>

      <Modal
        open={suspendFlow?.kind === 'confirm'}
        onClose={() => setSuspendFlow(null)}
        title="Suspend driver?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSuspendFlow(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (suspendFlow?.kind !== 'confirm') return;
                const { driver, until } = suspendFlow;
                setSuspendFlow(null);
                void executeSuspend(driver, until);
              }}
            >
              Suspend now
            </Button>
          </>
        }
      >
        {suspendFlow?.kind === 'confirm' && (
          <div className="space-y-3 text-sm">
            <p>
              Suspend <strong>{suspendFlow.driver.driverName}</strong> (
              {suspendFlow.driver.vehicleNo})?
            </p>
            <label className="block text-xs">
              <span className="text-bw-muted">Suspended until (optional)</span>
              <input
                type="datetime-local"
                value={suspendFlow.until}
                onChange={(e) =>
                  setSuspendFlow({ ...suspendFlow, until: e.target.value })
                }
                className="mt-1 w-full px-2 py-1.5 rounded bg-bw-bg border border-bw-border text-sm"
              />
            </label>
          </div>
        )}
      </Modal>

      <Modal
        open={suspendFlow?.kind === 'warning'}
        onClose={() => setSuspendFlow(null)}
        title="Cannot suspend now"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSuspendFlow(null)}>OK</Button>
            {suspendFlow?.kind === 'warning' && suspendFlow.canSchedule && (
              <Button
                variant="danger"
                onClick={() => {
                  if (suspendFlow?.kind !== 'warning') return;
                  const { driver, until } = suspendFlow;
                  const untilIso = until ? new Date(until).toISOString() : undefined;
                  queueSuspendAfterTrip({
                    driverId: driver.driverId,
                    vehicleId: driver.vehicleId || driver.driverId,
                    driverName: driver.driverName,
                    vehicleNo: driver.vehicleNo,
                    vehicleType: driver.vehicleType,
                    zoneName: driver.zoneName,
                    suspendedUntil: untilIso,
                  });
                  setSuspendFlow(null);
                  addToast({
                    type: 'success',
                    title: 'Auto-suspend scheduled',
                    message: `${driver.driverName} will be suspended when the trip completes.`,
                  });
                }}
              >
                Schedule after trip
              </Button>
            )}
          </>
        }
      >
        {suspendFlow?.kind === 'warning' && (
          <div className="space-y-3 text-sm">
            <p className="text-bw-text">{suspendFlow.message}</p>
            {suspendFlow.canSchedule && (
              <label className="block text-xs">
                <span className="text-bw-muted">Suspended until (optional)</span>
                <input
                  type="datetime-local"
                  value={suspendFlow.until}
                  onChange={(e) =>
                    setSuspendFlow({ ...suspendFlow, until: e.target.value })
                  }
                  className="mt-1 w-full px-2 py-1.5 rounded bg-bw-bg border border-bw-border text-sm"
                />
              </label>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={!!confirmKickOnline}
        onClose={() => setConfirmKickOnline(null)}
        title="Kick driver?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmKickOnline(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!confirmKickOnline) return;
                const d = confirmKickOnline;
                setConfirmKickOnline(null);
                void runAction(
                  rosterEntryKey(d),
                  () => kickDriver(d.driverId, d.vehicleId || d.driverId),
                  `${d.driverName || d.driverId} kicked`,
                );
              }}
            >
              Kick driver
            </Button>
          </>
        }
      >
        {confirmKickOnline && (
          <p className="text-sm text-bw-text">
            Force sign out <strong>{confirmKickOnline.driverName}</strong> (
            {confirmKickOnline.vehicleNo})? This removes them from the active roster.
          </p>
        )}
      </Modal>

      <Modal
        open={!!confirmKickSuspended}
        onClose={() => setConfirmKickSuspended(null)}
        title="Kick driver?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmKickSuspended(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!confirmKickSuspended) return;
                const row = confirmKickSuspended;
                setConfirmKickSuspended(null);
                void runAction(
                  `${row.driverId}:${row.vehicleId}`,
                  () => kickDriver(row.driverId, row.vehicleId),
                  `${row.driverName || row.driverId} kicked`,
                );
              }}
            >
              Kick driver
            </Button>
          </>
        }
      >
        {confirmKickSuspended && (
          <p className="text-sm text-bw-text">
            Force sign out{' '}
            <strong>{confirmKickSuspended.driverName || confirmKickSuspended.driverId}</strong>
            {confirmKickSuspended.vehicleNo ? ` (${confirmKickSuspended.vehicleNo})` : ''}? This
            removes them from the active roster.
          </p>
        )}
      </Modal>
    </>
  );
}
