import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/shared/Button';
import { Spinner } from '@/components/shared/Spinner';
import { useUiStore } from '@/store/uiStore';
import { useDriverStore } from '@/store/driverStore';
import {
  fetchSuspendedDrivers,
  kickDriver,
  suspendDriver,
  unsuspendDriver,
  updateSuspensionUntil,
  type SuspendedDriverRow,
} from '@/lib/suspendedApi';

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
    return format(d, "yyyy-MM-dd'T'HH:mm");
  } catch {
    return '';
  }
}

export function SuspendedModal() {
  const open = useUiStore((s) => s.openModal === 'suspended');
  const closeModal = useUiStore((s) => s.closeModal);
  const addToast = useUiStore((s) => s.addToast);
  const onlineDrivers = useDriverStore((s) => s.drivers);

  const [rows, setRows] = useState<SuspendedDriverRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [suspendDriverId, setSuspendDriverId] = useState('');
  const [suspendUntil, setSuspendUntil] = useState('');
  const [confirmKick, setConfirmKick] = useState<SuspendedDriverRow | null>(null);
  const [editUntil, setEditUntil] = useState<Record<string, string>>({});

  const suspendedKeys = useMemo(
    () => new Set(rows.map((r) => `${r.driverId}:${r.vehicleId}`)),
    [rows],
  );

  const suspendCandidates = useMemo(
    () =>
      onlineDrivers.filter(
        (d) => d.driverId && !suspendedKeys.has(`${d.driverId}:${d.vehicleId || d.driverId}`),
      ),
    [onlineDrivers, suspendedKeys],
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
    setSuspendDriverId('');
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
    const d = suspendCandidates.find((x) => x.driverId === suspendDriverId);
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
    setSuspendDriverId('');
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
        <div className="space-y-3 text-xs">
          <div className="rounded-md border border-bw-border bg-bw-surface/60 p-3 space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wide text-bw-muted">
              Suspend driver
            </div>
            <div className="flex flex-wrap gap-2 items-end">
              <label className="flex-1 min-w-[180px]">
                <span className="text-bw-muted block mb-1">Driver</span>
                <select
                  value={suspendDriverId}
                  onChange={(e) => setSuspendDriverId(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-md bg-bw-surface border border-bw-border text-bw-text"
                >
                  <option value="">Select online driver…</option>
                  {suspendCandidates.map((d) => (
                    <option key={`${d.driverId}:${d.vehicleId}`} value={d.driverId}>
                      {d.driverName || d.driverId} · {d.vehicleNo || d.vehicleId}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="text-bw-muted block mb-1">Suspended until</span>
                <input
                  type="datetime-local"
                  value={suspendUntil}
                  onChange={(e) => setSuspendUntil(e.target.value)}
                  className="px-2 py-1.5 rounded-md bg-bw-surface border border-bw-border text-bw-text"
                />
              </label>
              <Button variant="danger" onClick={() => void handleSuspendNew()} disabled={busyId === 'new-suspend'}>
                Suspend
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-bw-muted">
              <Spinner />
              Loading suspended drivers…
            </div>
          ) : error ? (
            <p className="text-red-400 py-6 text-center">{error}</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-bw-border">
              <table className="w-full text-xs border-collapse min-w-[720px]">
                <thead className="bg-bw-surface text-bw-muted uppercase text-[10px]">
                  <tr>
                    <th className="text-left p-2 border-b border-bw-border">Driver</th>
                    <th className="text-left p-2 border-b border-bw-border">Vehicle</th>
                    <th className="text-left p-2 border-b border-bw-border">Suspended</th>
                    <th className="text-left p-2 border-b border-bw-border">Until</th>
                    <th className="text-left p-2 border-b border-bw-border">Zone</th>
                    <th className="p-2 border-b border-bw-border">Actions</th>
                  </tr>
                </thead>
                <tbody>
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
                        <tr key={key} className="border-b border-bw-border/60 hover:bg-bw-surface/50">
                          <td className="p-2 whitespace-nowrap">{r.driverName || r.driverId}</td>
                          <td className="p-2 whitespace-nowrap">{r.vehicleNo || r.vehicleId || '—'}</td>
                          <td className="p-2 whitespace-nowrap">{formatWhen(r.suspendedAt)}</td>
                          <td className="p-2">
                            <input
                              type="datetime-local"
                              value={editUntil[key] ?? ''}
                              onChange={(e) =>
                                setEditUntil((prev) => ({ ...prev, [key]: e.target.value }))
                              }
                              className="px-1.5 py-1 rounded bg-bw-bg border border-bw-border text-bw-text"
                            />
                          </td>
                          <td className="p-2 whitespace-nowrap">{r.zoneName || '—'}</td>
                          <td className="p-2 whitespace-nowrap">
                            <div className="flex flex-wrap gap-1">
                              <Button
                                variant="ghost"
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
