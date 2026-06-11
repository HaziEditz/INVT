import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpDown, Minus, Plus, X } from 'lucide-react';
import { AddressAutocomplete } from '@/components/jobs/AddressAutocomplete';
import { useTariffs } from '@/hooks/useTariffs';
import { useUiStore } from '@/store/uiStore';
import { useDriverStore } from '@/store/driverStore';
import { useJobStore } from '@/store/jobStore';
import {
  chargeStripeCard,
  fetchDispatcherSettings,
  insertDispatchBooking,
  searchCustomers,
  updateDispatchBooking,
  type CustomerSearchResult,
} from '@/lib/dispatchApi';
import {
  buildInsertParams,
  buildUpdateParams,
  buildBookingDateTime,
  jobToForm,
  statusFromDriverId,
  CJ_SERVICES,
  CJ_VEHICLE_TYPES,
  defaultCreateJobForm,
  repeatBookingDates,
  type CreateJobFormState,
  type PaymentType,
  type StopPoint,
} from '@/lib/createJobForm';
import { fetchDrivingRoute, formatCityDistance, formatRouteSummary } from '@/lib/directions';
import { estimateFare } from '@/lib/fareEstimate';
import type { Job } from '@/types/job';

interface CreateJobModalProps {
  mapsKey: string;
  companyId: string;
  dispatcherName: string;
}

declare global {
  interface Window {
    Stripe?: (key: string) => {
      card: {
        createToken: (
          card: { number: string; cvc: string; exp_month: string; exp_year: string },
          cb: (status: number, res: { id?: string; error?: { message: string } }) => void
        ) => void;
      };
      setPublishableKey: (key: string) => void;
    };
  }
}

const POS_KEY = 'bw_create_job_pos';
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DISPATCH_MINS = [0, 5, 10, 15, 20, 30, 45, 60, 75, 90, 120];
const PAYMENT_OPTIONS: { value: PaymentType; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card (Stripe)' },
  { value: 'eftpos', label: 'EFTPOS' },
  { value: 'account', label: 'Account' },
  { value: 'tm', label: 'TM' },
  { value: 'acc', label: 'ACC' },
];

function loadPos(): { x: number; y: number } {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as { x?: number; y?: number };
      if (typeof p.x === 'number' && typeof p.y === 'number') return p;
    }
  } catch {
    /* ignore */
  }
  return { x: Math.max(16, window.innerWidth - 540), y: 64 };
}

function savePos(pos: { x: number; y: number }) {
  try {
    localStorage.setItem(POS_KEY, JSON.stringify(pos));
  } catch {
    /* ignore */
  }
}

function loadStripeV2(): Promise<void> {
  if (window.Stripe) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://js.stripe.com/v2/';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Stripe'));
    document.head.appendChild(s);
  });
}

function newStop(): StopPoint {
  return { id: `stop-${Date.now()}-${Math.random()}`, address: '', lat: 0, lng: 0 };
}

function serviceLabel(s: string) {
  return s.toUpperCase();
}

function jobFromForm(
  form: CreateJobFormState,
  cid: string,
  bookingId: number,
  bookingStatus?: string
): Job {
  const { bookingDateTime, dispatchBefore } = buildBookingDateTime(form);
  const status = (bookingStatus || statusFromDriverId(form.driverId)) as Job['status'];
  return {
    id: bookingId,
    companyId: cid,
    status,
    source: 'dispatch',
    serviceType: form.serviceType as Job['serviceType'],
    pickAddress: form.pick.address || form.pickInput,
    pickLatLng: form.pick.lat ? `${form.pick.lat},${form.pick.lng}` : '0,0',
    dropAddress: form.drop.address || form.dropInput,
    dropLatLng: form.drop.lat ? `${form.drop.lat},${form.drop.lng}` : '0,0',
    passengerName: form.name,
    passengerPhone: form.phone,
    paymentType: form.paymentType || 'Cash',
    estimatedFare: form.fixedFareEnabled ? form.fixedFareAmount : '',
    bookingDateTime,
    dispatchBeforeMinutes: dispatchBefore,
    urgent: form.urgent,
    updateSeq: 1,
    createdAt: Date.now(),
    dispatcherName: '',
  };
}

export function CreateJobModal({ mapsKey, companyId, dispatcherName }: CreateJobModalProps) {
  const open = useUiStore((s) => s.openModal === 'createJob');
  const modalJobId = useUiStore((s) => s.modalJobId);
  const closeModal = useUiStore((s) => s.closeModal);
  const setRoutePreview = useUiStore((s) => s.setRoutePreview);
  const settings = useUiStore((s) => s.settings);
  const addToast = useUiStore((s) => s.addToast);
  const upsertJob = useJobStore((s) => s.upsertJob);
  const jobs = useJobStore((s) => s.jobs);
  const setActiveTab = useJobStore((s) => s.setActiveTab);
  const setSelectedJobId = useJobStore((s) => s.setSelectedJobId);

  const editingJob = useMemo(
    () => (modalJobId ? jobs.find((j) => j.id === modalJobId) ?? null : null),
    [modalJobId, jobs]
  );
  const isEdit = !!editingJob;

  const fbTariffs = useTariffs(companyId);

  const drivers = useDriverStore((s) => s.drivers);
  const availableDrivers = useMemo(
    () => drivers.filter((d) => d.status === 'Available'),
    [drivers]
  );

  const [form, setForm] = useState<CreateJobFormState>(defaultCreateJobForm);
  const [loading, setLoading] = useState(false);
  const [tariffs, setTariffs] = useState<Array<{ Id: string | number; TariffName: string }>>([]);
  const [stripePk, setStripePk] = useState('');
  const [accountHits, setAccountHits] = useState<CustomerSearchResult['accounts']>([]);
  const [accHits, setAccHits] = useState<CustomerSearchResult['acc']>([]);
  const [cityDistLabel, setCityDistLabel] = useState('');
  const [routeSummary, setRouteSummary] = useState('');

  const [pos, setPos] = useState(loadPos);
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const posRef = useRef(pos);
  posRef.current = pos;

  const patch = useCallback((p: Partial<CreateJobFormState>) => {
    setForm((f) => ({ ...f, ...p }));
  }, []);

  const dispatchAtLabel = useMemo(() => {
    if (form.timing !== 'later') return null;
    try {
      const pickup = new Date(`${form.laterDate}T${form.laterHour}:${form.laterMin}:00`);
      if (Number.isNaN(pickup.getTime())) return null;
      const dispatchAt = new Date(pickup.getTime() - form.dispatchBeforeMin * 60000);
      return `Will dispatch at ${dispatchAt.toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
    } catch {
      return null;
    }
  }, [form.timing, form.laterDate, form.laterHour, form.laterMin, form.dispatchBeforeMin]);

  const resetForm = useCallback(() => {
    const base = defaultCreateJobForm();
    base.dispatchBeforeMin = settings?.defaultDispatchWindow ?? 10;
    setForm(base);
    setAccountHits([]);
    setAccHits([]);
    setCityDistLabel('');
    setRouteSummary('');
  }, [settings?.defaultDispatchWindow]);

  useEffect(() => {
    if (!open) {
      setRoutePreview(null);
      return;
    }
    if (editingJob) {
      setForm(jobToForm(editingJob));
    } else {
      resetForm();
    }
  }, [open, editingJob, resetForm, setRoutePreview]);

  useEffect(() => {
    if (!open || !companyId) return;
    fetchDispatcherSettings()
      .then((s) => {
        setTariffs(s.tariffs);
        setStripePk(s.stripePublicKey);
      })
      .catch(() => {});
  }, [open, companyId]);

  useEffect(() => {
    if (!open || !settings?.tmConfig) return;
    const council = String(settings.tmConfig.councilPercent ?? '');
    const passenger =
      settings.tmConfig.passengerPercent != null
        ? String(settings.tmConfig.passengerPercent)
        : council
          ? String(Math.max(0, 100 - parseFloat(council)))
          : '';
    patch({ tmCouncilPercent: council, tmPassengerPercent: passenger });
  }, [open, settings?.tmConfig, patch]);

  useEffect(() => {
    const q = form.accountSearch.trim();
    if (!open || form.paymentType !== 'account' || q.length < 2) {
      setAccountHits([]);
      return;
    }
    const t = setTimeout(() => {
      searchCustomers(q)
        .then((r) => setAccountHits(r.accounts))
        .catch(() => setAccountHits([]));
    }, 300);
    return () => clearTimeout(t);
  }, [open, form.paymentType, form.accountSearch]);

  useEffect(() => {
    const q = form.accSearchQuery.trim();
    if (!open || form.paymentType !== 'acc' || q.length < 2) {
      setAccHits([]);
      return;
    }
    const t = setTimeout(() => {
      searchCustomers(q)
        .then((r) => setAccHits(r.acc))
        .catch(() => setAccHits([]));
    }, 300);
    return () => clearTimeout(t);
  }, [open, form.paymentType, form.accSearchQuery]);

  useEffect(() => {
    if (!open || !form.pick.lat || !settings?.city) {
      setCityDistLabel('');
      return;
    }
    let cancelled = false;
    fetchDrivingRoute(settings.city, form.pick).then((r) => {
      if (!cancelled && r) setCityDistLabel(formatCityDistance(r.distanceKm, r.durationMin));
    });
    return () => {
      cancelled = true;
    };
  }, [open, form.pick.lat, form.pick.lng, settings?.city]);

  useEffect(() => {
    if (!open || !form.pick.lat || !form.drop.lat) {
      setRoutePreview(null);
      setRouteSummary('');
      return;
    }
    setRoutePreview({ pick: { lat: form.pick.lat, lng: form.pick.lng }, drop: { lat: form.drop.lat, lng: form.drop.lng } });
    let cancelled = false;
    fetchDrivingRoute(form.pick, form.drop).then((r) => {
      if (cancelled || !r) return;
      const tariff = fbTariffs.find((t) => t.id === form.tariffId) ?? fbTariffs[0];
      let fare: number | undefined;
      if (form.fixedFareEnabled && form.fixedFareAmount) {
        fare = parseFloat(form.fixedFareAmount);
      } else if (tariff) {
        fare = estimateFare(r.distanceKm, tariff);
      }
      setRouteSummary(formatRouteSummary(r.distanceKm, r.durationMin, fare));
    });
    return () => {
      cancelled = true;
    };
  }, [
    open,
    form.pick.lat,
    form.pick.lng,
    form.drop.lat,
    form.drop.lng,
    form.tariffId,
    form.fixedFareEnabled,
    form.fixedFareAmount,
    fbTariffs,
    setRoutePreview,
  ]);

  const onDragStart = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    dragging.current = true;
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const x = Math.max(0, Math.min(window.innerWidth - 500, e.clientX - dragOffset.current.x));
      const y = Math.max(0, Math.min(window.innerHeight - 48, e.clientY - dragOffset.current.y));
      setPos({ x, y });
    };
    const onUp = () => {
      if (dragging.current) {
        dragging.current = false;
        savePos(posRef.current);
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const reverseRoute = () => {
    setForm((f) => ({
      ...f,
      pick: f.drop,
      drop: f.pick,
      pickInput: f.dropInput,
      dropInput: f.pickInput,
    }));
  };

  const addStop = () => patch({ stops: [...form.stops, newStop()] });
  const removeStop = (id: string) => patch({ stops: form.stops.filter((s) => s.id !== id) });
  const updateStop = (id: string, p: Partial<StopPoint>) => {
    patch({ stops: form.stops.map((s) => (s.id === id ? { ...s, ...p } : s)) });
  };

  const validatePickup = (): boolean => {
    const addr = form.pick.address || form.pickInput;
    if (!addr.trim()) {
      addToast({ type: 'error', title: 'Pickup address required' });
      return false;
    }
    return true;
  };

  const bookOne = async (dateOverride?: string) => {
    const f = dateOverride
      ? { ...form, timing: 'later' as const, laterDate: dateOverride }
      : form;
    const params = buildInsertParams(f, dispatcherName);
    return insertDispatchBooking(companyId, params);
  };

  const handleSubmit = async () => {
    if (!validatePickup()) return;
    setLoading(true);
    try {
      if (isEdit && editingJob) {
        const params = buildUpdateParams(form, editingJob.id, dispatcherName);
        const res = await updateDispatchBooking(editingJob.id, params);
        upsertJob({
          ...editingJob,
          ...jobFromForm(form, companyId, editingJob.id, res.bookingStatus),
          dispatcherName,
          updateSeq: (editingJob.updateSeq ?? 0) + 1,
        });
        addToast({ type: 'success', title: 'Job updated', message: `#${editingJob.id}` });
        closeModal();
        resetForm();
        return;
      }

      if (form.paymentType === 'card' && form.cardAmount && stripePk && !form.cardPaid) {
        await loadStripeV2();
        window.Stripe!.setPublishableKey(stripePk);
        const token = await new Promise<string>((resolve, reject) => {
          window.Stripe!.card.createToken(
            {
              number: form.cardNumber.replace(/\s/g, ''),
              cvc: form.cardCvc,
              exp_month: form.cardExpMonth,
              exp_year: form.cardExpYear.slice(-2),
            },
            (status, res) => {
              if (status === 200 && res.id) resolve(res.id);
              else reject(new Error(res.error?.message || 'Card token failed'));
            }
          );
        });
        await chargeStripeCard({
          token,
          amount: parseFloat(form.cardAmount) || 0,
          email: form.email,
          name: form.name,
          phone: form.phone,
        });
        patch({ cardPaid: true });
      }

      const dates = form.repeatExpanded ? repeatBookingDates(form) : [];
      if (form.repeatExpanded && dates.length === 0) {
        addToast({ type: 'error', title: 'Repeat booking', message: 'Select days and an until date.' });
        setLoading(false);
        return;
      }

      const targets = dates.length ? dates : [undefined];
      let lastId = 0;
      let lastStatus = 'Pending';
      for (const d of targets) {
        const res = await bookOne(d);
        lastId = res.bookingId;
        lastStatus = res.bookingStatus;
      }

      if (lastId) {
        upsertJob({ ...jobFromForm(form, companyId, lastId, lastStatus), dispatcherName });
        setActiveTab('ua');
        setSelectedJobId(lastId);
      }

      addToast({
        type: 'success',
        title: targets.length > 1 ? `${targets.length} jobs created` : 'Job booked',
        message: lastId ? `#${lastId} — check U-A tab` : undefined,
      });
      closeModal();
      resetForm();
    } catch (e) {
      addToast({
        type: 'error',
        title: 'Booking failed',
        message: e instanceof Error ? e.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  const clearPayment = () => patch({ paymentType: '', cardPaid: false });

  if (!open) return null;

  return (
    <div
      className="cj-panel fixed z-[100] flex flex-col rounded-lg shadow-2xl overflow-hidden"
      style={{ width: 500, maxHeight: 'calc(100vh - 32px)', left: pos.x, top: pos.y }}
    >
      {/* Drag handle */}
      <div className="cj-drag-bar flex items-center justify-between px-3 py-2 shrink-0" onMouseDown={onDragStart}>
        <span className="text-sm font-semibold text-[#e8eaf0]">
          {isEdit ? `✏️ Edit Job #${editingJob?.id}` : '🚕 Create Job'}
        </span>
        <button
          type="button"
          className="text-[#8892a4] hover:text-[#e8eaf0] p-1"
          onClick={closeModal}
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
        {/* 1. ROUTE */}
        <section className="cj-section">
          <div className="cj-label">Route</div>
          <AddressAutocomplete
            mapsKey={mapsKey}
            active={open}
            value={form.pickInput}
            placeholder="Pickup address"
            className="cj-input mb-2"
            onChange={(pickInput) => patch({ pickInput })}
            onPlace={(pick) => patch({ pick, pickInput: pick.address })}
          />
          {cityDistLabel && (
            <div className="text-[10px] text-[#8892a4] mb-2">{cityDistLabel}</div>
          )}
          {form.stops.map((stop) => (
            <div key={stop.id} className="flex gap-1 mb-2">
              <AddressAutocomplete
                mapsKey={mapsKey}
                active={open}
                value={stop.address}
                placeholder="Stop address (optional)"
                className="cj-input flex-1"
                onChange={(address) => updateStop(stop.id, { address })}
                onPlace={(place) => updateStop(stop.id, { address: place.address, lat: place.lat, lng: place.lng })}
              />
              <button
                type="button"
                className="cj-btn-ghost px-2 shrink-0"
                onClick={() => removeStop(stop.id)}
                aria-label="Remove stop"
              >
                <Minus size={14} />
              </button>
            </div>
          ))}
          <AddressAutocomplete
            mapsKey={mapsKey}
            active={open}
            value={form.dropInput}
            placeholder="Dropoff address (optional)"
            className="cj-input mb-2"
            onChange={(dropInput) => patch({ dropInput })}
            onPlace={(drop) => patch({ drop, dropInput: drop.address })}
          />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#e8eaf0]">
            <button type="button" className="text-[#5b7cfa] flex items-center gap-1 font-semibold" onClick={addStop}>
              <Plus size={12} /> Add Stop
            </button>
            <button type="button" className="text-[#8892a4] flex items-center gap-1 hover:text-[#e8eaf0]" onClick={reverseRoute}>
              <ArrowUpDown size={12} /> Reverse
            </button>
            <label className="flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={form.corner} onChange={(e) => patch({ corner: e.target.checked })} />
              Corner
            </label>
            <label className="flex items-center gap-1 cursor-pointer text-amber-400">
              <input type="checkbox" checked={form.urgent} onChange={(e) => patch({ urgent: e.target.checked })} />
              Urgent
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={form.showEmail}
                onChange={(e) => patch({ showEmail: e.target.checked })}
              />
              Email
            </label>
          </div>
          {routeSummary && (
            <div className="text-xs font-semibold text-[#5b7cfa] mt-1.5">{routeSummary}</div>
          )}
        </section>

        {/* 2. PASSENGER */}
        <section className="cj-section">
          <div className="cj-label">Passenger</div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input
              className="cj-input"
              placeholder="Name (optional)"
              value={form.name}
              onChange={(e) => patch({ name: e.target.value })}
            />
            <input
              className="cj-input"
              placeholder="Phone (optional)"
              value={form.phone}
              onChange={(e) => patch({ phone: e.target.value })}
            />
          </div>
          {form.showEmail && (
            <input
              className="cj-input mb-2"
              type="email"
              placeholder="Email (optional)"
              value={form.email}
              onChange={(e) => patch({ email: e.target.value })}
            />
          )}
          <input
            className="cj-input"
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={(e) => patch({ notes: e.target.value })}
          />
        </section>

        {/* 3. TIMING */}
        <section className="cj-section">
          <div className="cj-label">Timing</div>
          <div className="flex w-fit mb-2">
            <button
              type="button"
              className={`cj-toggle rounded-l ${form.timing === 'now' ? 'cj-toggle-active' : ''}`}
              onClick={() => patch({ timing: 'now' })}
            >
              NOW
            </button>
            <button
              type="button"
              className={`cj-toggle rounded-r border-l-0 ${form.timing === 'later' ? 'cj-toggle-active' : ''}`}
              onClick={() => patch({ timing: 'later' })}
            >
              LATER
            </button>
          </div>
          {form.timing === 'later' && (
            <div className="flex flex-wrap items-end gap-2">
              <input
                type="date"
                className="cj-input w-[130px]"
                value={form.laterDate}
                onChange={(e) => patch({ laterDate: e.target.value })}
              />
              <select className="cj-input w-[70px]" value={form.laterHour} onChange={(e) => patch({ laterHour: e.target.value })}>
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={String(i).padStart(2, '0')}>
                    {String(i).padStart(2, '0')}
                  </option>
                ))}
              </select>
              <span className="text-[#8892a4]">:</span>
              <select className="cj-input w-[70px]" value={form.laterMin} onChange={(e) => patch({ laterMin: e.target.value })}>
                {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                className="cj-input flex-1 min-w-[120px]"
                value={form.dispatchBeforeMin}
                onChange={(e) => patch({ dispatchBeforeMin: parseInt(e.target.value, 10) })}
                title="Dispatch minutes before pickup"
              >
                {DISPATCH_MINS.map((m) => (
                  <option key={m} value={m}>
                    {m === 0 ? 'Dispatch: ASAP' : `Dispatch ${m} min before pickup`}
                  </option>
                ))}
              </select>
            </div>
          )}
          {form.timing === 'later' && dispatchAtLabel && (
            <div className="text-[10px] text-amber-400 mt-1">{dispatchAtLabel}</div>
          )}
        </section>

        {/* 4. SERVICE + VEHICLE */}
        <section className="cj-section">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="cj-label">Service</div>
              <div className="flex flex-wrap gap-1">
                {CJ_SERVICES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`cj-svc-pill ${form.serviceType === s ? 'cj-svc-pill-active' : ''}`}
                    onClick={() => patch({ serviceType: s })}
                  >
                    {serviceLabel(s)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="cj-label">Vehicle</div>
              <select className="cj-input mb-2" value={form.vehicleType} onChange={(e) => patch({ vehicleType: e.target.value })}>
                {CJ_VEHICLE_TYPES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="cj-input"
                  value={form.tariffId}
                  onChange={(e) => {
                    const id = e.target.value;
                    const t = tariffs.find((x) => String(x.Id) === id);
                    patch({
                      tariffId: id,
                      tariffName: id === '0' ? 'Automatic' : t?.TariffName || 'Automatic',
                    });
                  }}
                >
                  <option value="0">Tariff: Auto</option>
                  {tariffs.map((t) => (
                    <option key={String(t.Id)} value={String(t.Id)}>
                      {t.TariffName}
                    </option>
                  ))}
                </select>
                <select
                  className="cj-input"
                  value={form.driverId}
                  onChange={(e) => {
                    const driverId = parseInt(e.target.value, 10);
                    const d = availableDrivers.find((x) => parseInt(x.driverId, 10) === driverId);
                    patch({ driverId, vehicleId: d?.vehicleId || '0', queueNumber: 0 });
                  }}
                >
                  <option value={0}>Driver: Auto</option>
                  <option value={-2}>Pending</option>
                  <option value={-1}>No One</option>
                  {availableDrivers.map((d) => (
                    <option key={d.driverId} value={parseInt(d.driverId, 10) || d.driverId}>
                      {d.driverName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* 5. PAYMENT */}
        <section className="cj-section">
          <div className="cj-label">Payment</div>
          <select
            className="cj-input"
            value={form.paymentType}
            onChange={(e) => patch({ paymentType: e.target.value as PaymentType, cardPaid: false })}
          >
            <option value="">-- Select payment type --</option>
            {PAYMENT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          {form.paymentType === 'cash' && (
            <PaymentPanel onClose={clearPayment}>
              <p className="text-[#8892a4] text-xs">Collect payment from passenger.</p>
            </PaymentPanel>
          )}

          {form.paymentType === 'card' && stripePk && (
            <PaymentPanel onClose={clearPayment}>
              <input className="cj-input mb-2" placeholder="Card number (optional)" value={form.cardNumber} onChange={(e) => patch({ cardNumber: e.target.value })} />
              <div className="grid grid-cols-3 gap-2 mb-2">
                <input className="cj-input" placeholder="MM" value={form.cardExpMonth} onChange={(e) => patch({ cardExpMonth: e.target.value })} />
                <input className="cj-input" placeholder="YY" value={form.cardExpYear} onChange={(e) => patch({ cardExpYear: e.target.value })} />
                <input className="cj-input" placeholder="CVC" value={form.cardCvc} onChange={(e) => patch({ cardCvc: e.target.value })} />
              </div>
              <input className="cj-input" type="number" step="0.01" placeholder="Amount (optional)" value={form.cardAmount} onChange={(e) => patch({ cardAmount: e.target.value })} />
            </PaymentPanel>
          )}

          {form.paymentType === 'card' && !stripePk && (
            <PaymentPanel onClose={clearPayment}>
              <p className="text-amber-400 text-xs">Stripe not configured for this company.</p>
            </PaymentPanel>
          )}

          {form.paymentType === 'eftpos' && (
            <PaymentPanel onClose={clearPayment}>
              <input className="cj-input mb-2" placeholder="Transaction ref (optional)" value={form.eftposRef} onChange={(e) => patch({ eftposRef: e.target.value })} />
              <label className="flex items-center gap-2 text-xs text-[#e8eaf0] cursor-pointer">
                <input type="checkbox" checked={form.eftposSurcharge} onChange={(e) => patch({ eftposSurcharge: e.target.checked })} />
                Apply EFTPOS surcharge
              </label>
            </PaymentPanel>
          )}

          {form.paymentType === 'account' && (
            <PaymentPanel onClose={clearPayment}>
              <input
                className="cj-input mb-1"
                placeholder="Search account (optional)"
                value={form.accountSearch}
                onChange={(e) => patch({ accountSearch: e.target.value })}
              />
              {accountHits.length > 0 && (
                <div className="max-h-24 overflow-y-auto rounded border border-[#3d4260] mb-2 text-xs">
                  {accountHits.map((a) => (
                    <button
                      key={String(a.Id)}
                      type="button"
                      className="w-full text-left px-2 py-1.5 hover:bg-[#1e2235] border-b border-[#3d4260] last:border-0"
                      onClick={() =>
                        patch({
                          accountId: String(a.Id),
                          accountName: a.Name,
                          accountCredit: '',
                          accountSearch: a.Name,
                        })
                      }
                    >
                      {a.Name}
                    </button>
                  ))}
                </div>
              )}
              {form.accountName && (
                <p className="text-xs text-[#e8eaf0]">
                  {form.accountName}
                  {form.accountCredit ? ` · Credit: ${form.accountCredit}` : ''}
                </p>
              )}
            </PaymentPanel>
          )}

          {form.paymentType === 'tm' && (
            <PaymentPanel onClose={clearPayment}>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input className="cj-input" placeholder="Card # (optional)" value={form.tmCardNumber} onChange={(e) => patch({ tmCardNumber: e.target.value })} />
                <input className="cj-input" placeholder="Expiry (optional)" value={form.tmCardExpiry} onChange={(e) => patch({ tmCardExpiry: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input className="cj-input" placeholder="Council %" value={form.tmCouncilPercent} onChange={(e) => patch({ tmCouncilPercent: e.target.value })} />
                <input className="cj-input" placeholder="Passenger %" value={form.tmPassengerPercent} onChange={(e) => patch({ tmPassengerPercent: e.target.value })} />
              </div>
            </PaymentPanel>
          )}

          {form.paymentType === 'acc' && (
            <PaymentPanel onClose={clearPayment}>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input className="cj-input" placeholder="Claim # (optional)" value={form.claimNumber} onChange={(e) => patch({ claimNumber: e.target.value })} />
                <input className="cj-input" placeholder="PO # (optional)" value={form.poNumber} onChange={(e) => patch({ poNumber: e.target.value })} />
              </div>
              <input
                className="cj-input mb-1"
                placeholder="ACC client search (optional)"
                value={form.accSearchQuery}
                onChange={(e) => patch({ accSearchQuery: e.target.value })}
              />
              {accHits.length > 0 && (
                <div className="max-h-24 overflow-y-auto rounded border border-[#3d4260] text-xs">
                  {accHits.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className="w-full text-left px-2 py-1.5 hover:bg-[#1e2235] border-b border-[#3d4260] last:border-0"
                      onClick={() =>
                        patch({
                          accClientId: a.id,
                          accJobId: a.acc_approval_id || '',
                          accManagerId: a.manager_id || '',
                          claimNumber: a.claim_number,
                          accSearchQuery: a.client_name,
                        })
                      }
                    >
                      {a.client_name} · {a.claim_number}
                    </button>
                  ))}
                </div>
              )}
            </PaymentPanel>
          )}
        </section>

        {/* 6. BOTTOM ROW */}
        <section className="cj-section flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            className="text-[#5b7cfa] text-xs font-semibold flex items-center gap-1"
            onClick={() => patch({ repeatExpanded: !form.repeatExpanded })}
          >
            <Plus size={12} className={form.repeatExpanded ? 'rotate-45' : ''} />
            Repeat booking
          </button>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-[#e8eaf0] cursor-pointer">
              <input
                type="checkbox"
                checked={form.fixedFareEnabled}
                onChange={(e) => patch({ fixedFareEnabled: e.target.checked })}
              />
              Fixed fare
            </label>
            <input
              className="cj-input w-20"
              type="number"
              step="0.01"
              placeholder="$"
              disabled={!form.fixedFareEnabled}
              value={form.fixedFareAmount}
              onChange={(e) => patch({ fixedFareAmount: e.target.value })}
            />
          </div>
        </section>

        {form.repeatExpanded && (
          <section className="cj-section -mt-2">
            <div className="flex flex-wrap gap-2 mb-2">
              {DAY_LABELS.map((d, i) => (
                <label key={d} className="flex items-center gap-1 text-[11px] text-[#e8eaf0] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.repeatDays[i]}
                    onChange={(e) => {
                      const repeatDays = [...form.repeatDays];
                      repeatDays[i] = e.target.checked;
                      patch({ repeatDays });
                    }}
                  />
                  {d}
                </label>
              ))}
            </div>
            <input
              type="date"
              className="cj-input w-full"
              placeholder="Until date (optional)"
              value={form.repeatUntil}
              onChange={(e) => patch({ repeatUntil: e.target.value })}
            />
          </section>
        )}
      </div>

      {/* 7. FOOTER */}
      <div className="shrink-0 flex justify-end gap-2 px-3 py-2 border-t border-[#3d4260] bg-[#0f1420]">
        <button type="button" className="cj-btn-ghost" onClick={resetForm}>
          Clear
        </button>
        <button type="button" className="cj-btn-ghost" onClick={closeModal}>
          Cancel
        </button>
        <button type="button" className="cj-btn-book" onClick={handleSubmit} disabled={loading}>
          {loading ? 'Saving…' : isEdit ? 'SAVE ✓' : 'BOOK ✓'}
        </button>
      </div>
    </div>
  );
}

function PaymentPanel({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="cj-pay-panel relative">
      <button
        type="button"
        className="absolute top-1 right-1 text-[#8892a4] hover:text-[#e8eaf0] p-0.5"
        onClick={onClose}
        aria-label="Close payment details"
      >
        <X size={14} />
      </button>
      <div className="pr-5">{children}</div>
    </div>
  );
}
