import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/shared/Button';
import { Spinner } from '@/components/shared/Spinner';
import { useUiStore } from '@/store/uiStore';
import {
  findRosterEntry,
  rosterEntryKey,
  useCompanyDriverRoster,
} from '@/hooks/useCompanyDriverRoster';
import {
  fetchSuspendedDrivers,
  kickDriver,
  suspendDriver,
  unsuspendDriver,
  updateSuspensionUntil,
  type SuspendedDriverRow,
} from '@/lib/suspendedApi';

const FILTER_SELECT =
  'px-2 py-1.5 rounded-md bg-bw-surface border border-bw-border text-xs text-bw-text min-w-[200px] focus:border-bw-primary focus:outline-none';

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

export function SuspendedModal({ companyId }: SuspendedModalProps) {
  const open = useUiStore((s) => s.openModal === 'suspended');
  const closeModal = useUiStore((s) => s.closeModal);
  const addToast = useUiStore((s) => s.addToast);
  const roster = useCompanyDriverRoster(companyId || null);

  const [rows, setRows] = useState<SuspendedDriverRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [suspendPick, setSuspendPick] = useState('');
  const [suspendUntil, setSuspendUntil] = useState('');
  const [confirmKick, setConfirmKick] = useState<SuspendedDriverRow | null>(null);
  const [editUntil, setEditUntil] = useState<Record<string, string>>({});

  const suspendedKeys = useMemo(
    () => new Set(rows.map((r) => `${r.driverId}:${r.vehicleId}`)),
    [rows],
  );

  const suspendCandidates = useMemo(
    () =>
      roster.filter((d) => d.driverId && !suspendedKeys.has(rosterEntryKey(d))),
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
    setSuspendPick('');
    setSuspendUntil('');
    setConfirmKick(null);
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

  const handleSuspendNew = async () => {
    const [driverId, vehicleId] = suspendPick.split('|');
    const d = findRosterEntry(roster, driverId, vehicleId);
    if (!d) {
      addToast({ type: 'error', title: 'Select a driver to suspend' });
      return;
    }
    const untilIso = suspendUntil ? new Date(suspendUntil).toISOString() : '';
    await runAction(
      'new-suspend',
      () =>
        suspendDriver({
          driverId: d.driverId,
          vehicleId: d.vehicleId || d.driverId,
          driverName: d.driverName,
          vehicleNo: d.vehicleNo,
          vehicleType: d.vehicleType,
          zoneName: d.zoneName,
          suspendedUntil: untilIso || undefined,
        }),
      `${d.driverName || d.driverId} suspended`,
    );
    setSuspendPick('');
    setSuspendUntil('');
  };

  return (
    <>
      <Modal
        open={open}
        onClose={closeModal}
        title="Suspended Drivers"
        wide
        footer={<Button variant="ghost" onClick={closeModal}>Close</Button>}
      >
        <div className="space-y-3 text-sm text-bw-text">
          <div className="rounded-md border border-bw-border bg-bw-surface/80 p-3 space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wide text-bw-text">
              Suspend driver
            </div>
            <div className="flex flex-wrap gap-2 items-end">
              <label className="flex-1 min-w-[220px]">
                <span className="text-bw-muted block mb-1 text-xs">Driver</span>
                <select
                  value={suspendPick}
                  onChange={(e) => setSuspendPick(e.target.value)}
                  className={FILTER_SELECT}
                >
                  <option value="">Select driver…</option>
                  {suspendCandidates.map((d) => (
                    <option key={rosterEntryKey(d)} value={`${d.driverId}|${d.vehicleId}`}>
                      {d.isOnline ? '● Online' : '○ Offline'} — {d.driverName} ·{' '}
                      {d.vehicleNo || d.vehicleId}
                      {d.isOnline && d.onlineStatus ? ` (${d.onlineStatus})` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="text-bw-muted block mb-1 text-xs">Suspended until</span>
                <input
                  type="datetime-local"
                  value={suspendUntil}
                  onChange={(e) => setSuspendUntil(e.target.value)}
                  className="bw-datetime-input px-2 py-1.5 rounded-md border text-sm min-w-[180px]"
                />
              </label>
              <Button
                variant="danger"
                onClick={() => void handleSuspendNew()}
                disabled={busyId === 'new-suspend'}
              >
                Suspend
              </Button>
            </div>
            {!loading && suspendCandidates.length === 0 && (
              <p className="text-xs text-bw-muted">All company drivers are already suspended.</p>
            )}
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
                                onClick={() => setConfirmKick(r)}
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
        </div>
      </Modal>

      <Modal
        open={!!confirmKick}
        onClose={() => setConfirmKick(null)}
        title="Kick driver?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmKick(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!confirmKick) return;
                const row = confirmKick;
                setConfirmKick(null);
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
        <p className="text-sm text-bw-text">
          Force sign out{' '}
          <strong>{confirmKick?.driverName || confirmKick?.driverId}</strong>
          {confirmKick?.vehicleNo ? ` (${confirmKick.vehicleNo})` : ''}? This removes them from the
          active roster.
        </p>
      </Modal>
    </>
  );
}
