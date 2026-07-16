import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpDown, Loader2, Minus, Plus, X } from 'lucide-react';
import { AddressAutocomplete } from '@/components/jobs/AddressAutocomplete';
import { useTariffs } from '@/hooks/useTariffs';
import { filterForbiddenTariffDropdown } from '@/lib/tariffGuard';
import { notifyJobCreated } from '@/lib/dispatchNotifications';
import { useDriverStore } from '@/store/driverStore';
import { useJobStore } from '@/store/jobStore';
import { useUiStore } from '@/store/uiStore';
import {
  chargeStripeCard,
  fetchDispatcherSettings,
  insertDispatchBooking,
  searchCustomers,
  type CustomerSearchResult,
} from '@/lib/dispatchApi';
import { updateJob, applyFormDriverAssignment, hydrateJobFromServer } from '@/lib/jobFlow';
import { effectiveJobStatus } from '@/lib/jobStatusAuthority';
import {
  buildStaleAssignedReassignContext,
  reassignBlockedMessage,
} from '@/lib/driverConnectivity';
import { setJobEditLock, releaseJobEditLock, releaseJobEditLockKeepalive } from '@/lib/jobEditLock';
import { getEditLockSessionId } from '@/lib/editLockSession';
import {
  buildInsertParams,
  buildJobEditChangesDelta,
  buildBookingDateTime,
  driverAssignmentChanged,
  driversForAssignDropdown,
  driverOptionFromJob,
  DRIVER_PENDING,
  formShowsLiveDriverOptions,
  isAssignedDriverSelection,
  jobToForm,
  mergeTariffCatalogSources,
  buildEditTariffDropdown,
  resolveTariffFormSelection,
  tariffFieldsFromJob,
  isLaterDraftComplete,
  laterDraftInlineError,
  mergeLaterDraftIntoForm,
  statusFromDriverId,
  validateLaterPickupForm,
  laterDispatchMinOptions as getLaterDispatchMinOptions,
  CJ_SERVICES,
  CJ_VEHICLE_TYPES,
  defaultCreateJobForm,
  nzNowParts,
  repeatBookingDates,
  type CreateJobFormState,
  type PaymentType,
  type PlaceValue,
  type StopPoint,
} from '@/lib/createJobForm';
import { filterDriversForRequirements } from '@/lib/jobVehicleEligibility';
import { fetchDrivingRoute, formatBaseDispatchHint, formatCityDistance, formatFormFareEstimate, estimateRoadKmAndMin } from '@/lib/directions';
import { estimateFare, haversineKm } from '@/lib/fareEstimate';
import type { Job } from '@/types/job';
import {
  formatJobDateTimeShort,
  formatJobEditHistoryActor,
  formatJobEditHistorySummary,
  formatJobEditHistoryWhen,
  jobCreatedAtTime,
  jobBookingTime,
  jobOverdueLabel,
  jobPickupTypeLabel,
  effectiveJobStatus,
} from '@/types/job';

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
const LATER_HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const LATER_MINS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
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

type LaterScheduleDraft = { date: string; hour: string; min: string };

function formatLaterPickupSummary(d: LaterScheduleDraft): string {
  if (!isLaterDraftComplete(d)) return '';
  const h = d.hour.padStart(2, '0');
  const m = d.min.padStart(2, '0');
  try {
    const pickup = new Date(`${d.date}T${h}:${m}:00`);
    if (Number.isNaN(pickup.getTime())) return `${d.date} · ${h}:${m}`;
    const dateLabel = pickup.toLocaleDateString('en-NZ', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    return `${dateLabel} · ${h}:${m}`;
  } catch {
    return `${d.date} · ${h}:${m}`;
  }
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
    notes: form.notes,
    paymentType: form.paymentType || 'Cash',
    estimatedFare: form.fixedFareEnabled ? form.fixedFareAmount : '',
    bookingDateTime,
    dispatchBeforeMinutes: dispatchBefore,
    urgent: form.urgent,
    vehicleType: form.vehicleType,
    tariffId: form.fixedFareEnabled ? '-1' : form.tariffId,
    tariffName: form.fixedFareEnabled ? 'Fixed' : form.tariffName,
    updateSeq: 0,
    createdAt: Date.now(),
    dispatcherName: '',
  };
}

function withBookingTimeout<T>(promise: Promise<T>, ms = 90000, label = 'Booking'): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms);
    }),
  ]);
}

type SubmitPhase = 'creating' | 'saving' | null;

const DISPATCHER_SETTINGS_TTL_MS = 5 * 60 * 1000;
const dispatcherSettingsCache = new Map<
  string,
  { tariffs: Array<{ Id: string | number; TariffName: string }>; stripePublicKey: string; at: number }
>();

function submitPhaseLabel(phase: SubmitPhase, isEdit: boolean): string {
  if (phase === 'creating') return 'Creating booking…';
  if (phase === 'saving') return isEdit ? 'Saving changes…' : 'Saving…';
  return '';
}

export function CreateJobModal({ mapsKey, companyId, dispatcherName }: CreateJobModalProps) {
  const open = useUiStore((s) => s.openModal === 'createJob');
  const modalJobId = useUiStore((s) => s.modalJobId);
  const closeModal = useUiStore((s) => s.closeModal);
  const setRoutePreview = useUiStore((s) => s.setRoutePreview);
  const settings = useUiStore((s) => s.settings);
  const addToast = useUiStore((s) => s.addToast);
  const upsertJob = useJobStore((s) => s.upsertJob);
  const clearRemovedJob = useJobStore((s) => s.clearRemovedJob);
  const jobs = useJobStore((s) => s.jobs);
  const setActiveTab = useJobStore((s) => s.setActiveTab);

  const editingJob = useMemo(
    () => (modalJobId ? jobs.find((j) => j.id === modalJobId) ?? null : null),
    [modalJobId, jobs]
  );
  const isEdit = !!editingJob;

  const fbTariffs = useTariffs(companyId);

  const drivers = useDriverStore((s) => s.drivers);
  const availableDrivers = useMemo(
    () => drivers.filter((d) => d.status === 'Available' && d.driverId),
    [drivers]
  );
  const assignedEditDriver = useMemo(
    () => (editingJob ? driverOptionFromJob(editingJob, drivers) : null),
    [editingJob, drivers]
  );

  const [form, setForm] = useState<CreateJobFormState>(defaultCreateJobForm);
  const [loading, setLoading] = useState(false);
  const [submitPhase, setSubmitPhase] = useState<SubmitPhase>(null);
  const [cityDistLoading, setCityDistLoading] = useState(false);
  const [tariffs, setTariffs] = useState<Array<{ Id: string | number; TariffName: string }>>([]);
  const [stripePk, setStripePk] = useState('');

  const dropdownTariffs = useMemo(() => {
    const merged = mergeTariffCatalogSources(
      filterForbiddenTariffDropdown(fbTariffs.map((t) => ({ Id: t.id, TariffName: t.name }))),
      filterForbiddenTariffDropdown(tariffs),
    );
    if (!isEdit || !editingJob) return merged;
    return buildEditTariffDropdown(merged, tariffFieldsFromJob(editingJob));
  }, [fbTariffs, tariffs, isEdit, editingJob]);

  const [accountHits, setAccountHits] = useState<CustomerSearchResult['accounts']>([]);
  const [accHits, setAccHits] = useState<CustomerSearchResult['acc']>([]);
  const [cityDistLabel, setCityDistLabel] = useState('');
  const [routeSummary, setRouteSummary] = useState('');
  const [pickFromAutocomplete, setPickFromAutocomplete] = useState(false);
  const [dropFromAutocomplete, setDropFromAutocomplete] = useState(false);
  const [pickDirty, setPickDirty] = useState(false);
  const [dropDirty, setDropDirty] = useState(false);
  const [pickAddressError, setPickAddressError] = useState('');
  const [laterDraft, setLaterDraft] = useState<LaterScheduleDraft>({ date: '', hour: '', min: '' });
  const [laterScheduleConfirmed, setLaterScheduleConfirmed] = useState(false);
  const [baseDispatchHint, setBaseDispatchHint] = useState('');
  const [baseDispatchLoading, setBaseDispatchLoading] = useState(false);

  const [pos, setPos] = useState(loadPos);
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const posRef = useRef(pos);
  const submittingRef = useRef(false);
  const loadedFormKeyRef = useRef<string | null>(null);
  const editLockJobIdRef = useRef<number | null>(null);
  posRef.current = pos;

  const patch = useCallback((p: Partial<CreateJobFormState>) => {
    setForm((f) => ({ ...f, ...p }));
  }, []);

  const confirmLaterSchedule = useCallback(() => {
    if (!isLaterDraftComplete(laterDraft)) return;
    const inlineErr = laterDraftInlineError(laterDraft);
    if (inlineErr) return;
    patch({
      laterDate: laterDraft.date.trim(),
      laterHour: laterDraft.hour.padStart(2, '0'),
      laterMin: laterDraft.min.padStart(2, '0'),
    });
    setLaterScheduleConfirmed(true);
  }, [laterDraft, patch]);

  const laterInlineError = useMemo(() => {
    if (form.timing !== 'later') return null;
    const draftErr = laterDraftInlineError(laterDraft);
    if (draftErr) return draftErr;
    if (laterScheduleConfirmed) {
      return validateLaterPickupForm(mergeLaterDraftIntoForm(form, laterDraft));
    }
    return null;
  }, [form, laterDraft, laterScheduleConfirmed]);

  const laterDispatchMinOptions = useMemo(
    () =>
      getLaterDispatchMinOptions(
        laterScheduleConfirmed ? mergeLaterDraftIntoForm(form, laterDraft) : form,
        DISPATCH_MINS,
      ),
    [form, laterDraft, laterScheduleConfirmed],
  );

  const laterDraftReadyForConfirm =
    form.timing === 'later' && isLaterDraftComplete(laterDraft) && !laterInlineError;

  // Create: block until schedule is confirmed and valid.
  // Edit: do not disable Save solely for draft inline errors (driver-only Pending/No One
  // must still save) — handleSubmit toasts and soft-allows unchanged timing.
  const laterBookBlocked =
    form.timing === 'later' &&
    (!laterScheduleConfirmed ||
      !isLaterDraftComplete(laterDraft) ||
      (!isEdit && !!laterInlineError));

  const showLiveDriverOptions = useMemo(
    () => formShowsLiveDriverOptions(form, editingJob),
    [form.timing, editingJob, editingJob?.notifyDispatchAt, editingJob?.dispatchBeforeMinutes, editingJob?.bookingDateTime, editingJob?.scheduledFor, editingJob?.status],
  );

  const confirmedLaterSummary = useMemo(() => {
    if (!laterScheduleConfirmed || form.timing !== 'later') return '';
    return formatLaterPickupSummary({
      date: form.laterDate,
      hour: form.laterHour,
      min: form.laterMin,
    });
  }, [laterScheduleConfirmed, form.timing, form.laterDate, form.laterHour, form.laterMin]);

  useEffect(() => {
    if (form.timing !== 'later' || !laterScheduleConfirmed) return;
    if (!laterDispatchMinOptions.includes(form.dispatchBeforeMin)) {
      patch({ dispatchBeforeMin: laterDispatchMinOptions[0] ?? settings?.defaultDispatchWindow ?? 10 });
    }
  }, [form.timing, form.dispatchBeforeMin, laterScheduleConfirmed, laterDispatchMinOptions, patch, settings?.defaultDispatchWindow]);

  const assignDropdownDrivers = useMemo(() => {
    if (!showLiveDriverOptions) return [] as typeof availableDrivers;
    const base = driversForAssignDropdown(availableDrivers, drivers, editingJob);
    return filterDriversForRequirements(base, {
      vehicleType: form.vehicleType,
      passengers: editingJob?.passengers ?? 1,
      serviceType: form.serviceType,
    });
  }, [
    showLiveDriverOptions,
    availableDrivers,
    drivers,
    editingJob,
    form.vehicleType,
    form.serviceType,
    editingJob?.passengers,
  ]);

  // Pre-window Later must not keep a real driver selection (options are hidden).
  useEffect(() => {
    if (!open || showLiveDriverOptions) return;
    if (!isAssignedDriverSelection(form.driverId)) return;
    patch({ driverId: DRIVER_PENDING, vehicleId: '0', queueNumber: 0 });
  }, [open, showLiveDriverOptions, form.driverId, patch]);

  const selectedDriver = useMemo(() => {
    if (!isAssignedDriverSelection(form.driverId)) return null;
    return (
      drivers.find((d) => d.driverId === form.driverId) ??
      assignDropdownDrivers.find((d) => d.driverId === form.driverId) ??
      null
    );
  }, [form.driverId, drivers, assignDropdownDrivers]);

  const dispatchAtLabel = useMemo(() => {
    if (form.timing !== 'later' || !laterScheduleConfirmed) return null;
    try {
      const pickup = new Date(`${form.laterDate}T${form.laterHour}:${form.laterMin}:00`);
      if (Number.isNaN(pickup.getTime())) return null;
      const dispatchAt = new Date(pickup.getTime() - form.dispatchBeforeMin * 60000);
      return `Will dispatch at ${dispatchAt.toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
    } catch {
      return null;
    }
  }, [form.timing, form.laterDate, form.laterHour, form.laterMin, form.dispatchBeforeMin]);

  const editAuditMeta = useMemo(() => {
    if (!editingJob) return null;
    const now = new Date();
    const created = jobCreatedAtTime(editingJob);
    const pickup = jobBookingTime(editingJob);
    return {
      createdLabel: created ? formatJobDateTimeShort(created) : null,
      pickupType: jobPickupTypeLabel(editingJob),
      pickupTime: pickup ? formatJobDateTimeShort(pickup) : null,
      overdue: jobOverdueLabel(editingJob, now),
      lastEditedAt: editingJob.lastEditedAt,
      lastEditedBy: editingJob.lastEditedBy,
      history: [...(editingJob.editHistory ?? [])].reverse().slice(0, 10),
      jobCreatedAt: created,
    };
  }, [editingJob]);

  const resetForm = useCallback(() => {
    const base = defaultCreateJobForm();
    base.dispatchBeforeMin = settings?.defaultDispatchWindow ?? 10;
    setForm(base);
    setAccountHits([]);
    setAccHits([]);
    setCityDistLabel('');
    setRouteSummary('');
    setPickFromAutocomplete(false);
    setDropFromAutocomplete(false);
    setPickDirty(false);
    setDropDirty(false);
    setPickAddressError('');
    setLaterDraft({ date: '', hour: '', min: '' });
    setLaterScheduleConfirmed(false);
    setBaseDispatchHint('');
    setBaseDispatchLoading(false);
  }, [settings?.defaultDispatchWindow]);

  const releaseHeldEditLock = useCallback(
    (jobId: number | null) => {
      if (jobId == null) return;
      void releaseJobEditLock(jobId, dispatcherName, { force: true });
    },
    [dispatcherName],
  );

  const onClose = useCallback(() => {
    const heldId = editLockJobIdRef.current;
    editLockJobIdRef.current = null;
    releaseHeldEditLock(heldId);
    setRoutePreview(null);
    resetForm();
    closeModal();
  }, [closeModal, resetForm, setRoutePreview, releaseHeldEditLock]);

  useEffect(() => {
    const onPageHide = () => {
      const id = editLockJobIdRef.current;
      if (id != null) releaseJobEditLockKeepalive(id, dispatcherName);
    };
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, [dispatcherName]);

  useEffect(() => {
    if (!open) {
      if (editLockJobIdRef.current != null) {
        const id = editLockJobIdRef.current;
        editLockJobIdRef.current = null;
        releaseHeldEditLock(id);
      }
      loadedFormKeyRef.current = null;
      setRoutePreview(null);
      return;
    }
    if (!editingJob) return;

    if (editLockJobIdRef.current !== editingJob.id) {
      const prev = editLockJobIdRef.current;
      if (prev != null) releaseHeldEditLock(prev);
      editLockJobIdRef.current = editingJob.id;
      void setJobEditLock(editingJob.id, true, {
        actorName: dispatcherName,
        sessionId: getEditLockSessionId(),
      }).catch(() => {
        addToast({
          type: 'warning',
          title: 'Edit lock unavailable',
          message: 'Job may still be offered to drivers while editing',
        });
      });
    }

    const storeJob =
      useJobStore.getState().jobs.find((j) => j.id === editingJob.id) ?? editingJob;
    const formKey = [
      storeJob.id,
      storeJob.updateSeq ?? 0,
      effectiveJobStatus(storeJob),
      storeJob.pickAddress,
      storeJob.dropAddress,
      storeJob.passengerName,
      storeJob.passengerPhone,
      storeJob.notes,
      storeJob.bookingDateTime,
      storeJob.driverId,
      storeJob.vehicleType,
      storeJob.tariffId ?? '',
      storeJob.tariffName ?? '',
      storeJob.dispatchBeforeMinutes ?? 0,
      storeJob.scheduledFor ?? '',
      storeJob.notifyDispatchAt ?? '',
    ].join('|');
    if (loadedFormKeyRef.current !== formKey) {
      loadedFormKeyRef.current = formKey;
      const baseForm = jobToForm(storeJob);
      const tariff = resolveTariffFormSelection(baseForm, dropdownTariffs);
      const loaded = { ...baseForm, ...tariff };
      setForm(loaded);
      setLaterDraft({ date: loaded.laterDate, hour: loaded.laterHour, min: loaded.laterMin });
      setLaterScheduleConfirmed(loaded.timing === 'later');
      setPickFromAutocomplete(!!loaded.pick.lat);
      setDropFromAutocomplete(!!loaded.drop.lat);
      setPickDirty(false);
      setDropDirty(false);
      setPickAddressError('');
    }
  }, [open, editingJob?.id, editingJob?.updateSeq, editingJob?.status, editingJob?.driverId, editingJob, dropdownTariffs, setRoutePreview, addToast, dispatcherName, releaseHeldEditLock]);

  useEffect(() => {
    if (!open || !isEdit || dropdownTariffs.length === 0) return;
    setForm((f) => {
      const resolved = resolveTariffFormSelection(
        { tariffId: f.tariffId, tariffName: f.tariffName },
        dropdownTariffs,
      );
      if (resolved.tariffId === f.tariffId && resolved.tariffName === f.tariffName) return f;
      return { ...f, ...resolved };
    });
  }, [open, isEdit, dropdownTariffs]);

  useEffect(() => {
    if (open && !editingJob) {
      loadedFormKeyRef.current = null;
      resetForm();
    }
  }, [open, editingJob, resetForm]);

  useEffect(() => {
    if (!open || !companyId) return;
    const cached = dispatcherSettingsCache.get(companyId);
    if (cached && Date.now() - cached.at < DISPATCHER_SETTINGS_TTL_MS) {
      setTariffs(cached.tariffs);
      setStripePk(cached.stripePublicKey);
      return;
    }
    fetchDispatcherSettings()
      .then((s) => {
        dispatcherSettingsCache.set(companyId, {
          tariffs: s.tariffs,
          stripePublicKey: s.stripePublicKey,
          at: Date.now(),
        });
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
      setCityDistLoading(false);
      return;
    }
    let cancelled = false;
    setCityDistLoading(true);
    const t = setTimeout(() => {
      fetchDrivingRoute(settings.city!, form.pick)
        .then((r) => {
          if (!cancelled) {
            setCityDistLabel(r ? formatCityDistance(r.distanceKm, r.durationMin) : '');
          }
        })
        .finally(() => {
          if (!cancelled) setCityDistLoading(false);
        });
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(t);
      setCityDistLoading(false);
    };
  }, [open, form.pick.lat, form.pick.lng, settings?.city]);

  useEffect(() => {
    if (!open || form.timing !== 'later' || !form.pick.lat || !settings?.city) {
      setBaseDispatchHint('');
      setBaseDispatchLoading(false);
      return;
    }
    let cancelled = false;
    setBaseDispatchLoading(true);
    const t = setTimeout(() => {
      fetchDrivingRoute(settings.city!, form.pick)
        .then((r) => {
          if (cancelled) return;
          if (r) {
            setBaseDispatchHint(formatBaseDispatchHint(r.distanceKm, r.durationMin));
            return;
          }
          const straightKm = haversineKm(
            settings.city!.lat,
            settings.city!.lng,
            form.pick.lat,
            form.pick.lng,
          );
          const est = estimateRoadKmAndMin(straightKm);
          setBaseDispatchHint(formatBaseDispatchHint(est.km, est.min));
        })
        .finally(() => {
          if (!cancelled) setBaseDispatchLoading(false);
        });
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(t);
      setBaseDispatchLoading(false);
    };
  }, [open, form.timing, form.pick.lat, form.pick.lng, settings?.city]);

  useEffect(() => {
    if (!open || !form.pick.lat) {
      setRoutePreview(null);
      setRouteSummary('');
      return;
    }
    if (!form.drop.lat) {
      setRoutePreview({ pick: { lat: form.pick.lat, lng: form.pick.lng } });
      setRouteSummary('');
      return;
    }
    setRoutePreview({
      pick: { lat: form.pick.lat, lng: form.pick.lng },
      drop: { lat: form.drop.lat, lng: form.drop.lng },
    });
    const straightKm = haversineKm(form.pick.lat, form.pick.lng, form.drop.lat, form.drop.lng);
    const roadKm = straightKm * 1.25;
    const min = Math.max(1, Math.round((roadKm / 35) * 60));
    const tariff = fbTariffs.find((t) => t.id === form.tariffId) ?? fbTariffs[0];
    let fare: number | undefined;
    if (form.fixedFareEnabled && form.fixedFareAmount) {
      fare = parseFloat(form.fixedFareAmount);
    } else if (tariff) {
      fare = estimateFare(roadKm, tariff);
    }
    if (fare != null && !Number.isNaN(fare)) {
      setRouteSummary(formatFormFareEstimate(fare, roadKm, min));
    } else {
      setRouteSummary('');
    }
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
    setPickDirty(true);
    setDropDirty(true);
    setPickFromAutocomplete(false);
    setDropFromAutocomplete(false);
  };

  const addStop = () => patch({ stops: [...form.stops, newStop()] });
  const removeStop = (id: string) => patch({ stops: form.stops.filter((s) => s.id !== id) });
  const updateStop = (id: string, p: Partial<StopPoint>) => {
    patch({ stops: form.stops.map((s) => (s.id === id ? { ...s, ...p } : s)) });
  };

  const onPickupSelect = (pick: PlaceValue) => {
    setPickFromAutocomplete(true);
    setPickDirty(false);
    setPickAddressError('');
    patch({ pick, pickInput: pick.address });
    if (pick.lat) {
      const preview: { pick: { lat: number; lng: number }; drop?: { lat: number; lng: number } } = {
        pick: { lat: pick.lat, lng: pick.lng },
      };
      if (form.drop.lat) {
        preview.drop = { lat: form.drop.lat, lng: form.drop.lng };
      }
      setRoutePreview(preview);
    }
  };

  const onDropSelect = (drop: PlaceValue) => {
    setDropFromAutocomplete(true);
    setDropDirty(false);
    patch({ drop, dropInput: drop.address });
    if (form.pick.lat && drop.lat) {
      setRoutePreview({
        pick: { lat: form.pick.lat, lng: form.pick.lng },
        drop: { lat: drop.lat, lng: drop.lng },
      });
    }
  };

  const validatePickup = (): boolean => {
    const livePick =
      isEdit && editingJob
        ? (
            useJobStore.getState().jobs.find((j) => j.id === editingJob.id) ?? editingJob
          ).pickAddress
        : '';
    const addr = (
      form.pick.address ||
      form.pickInput ||
      livePick ||
      (isEdit && editingJob ? editingJob.pickAddress : '') ||
      ''
    ).trim();
    if (!addr) {
      addToast({ type: 'error', title: 'Pickup address required' });
      return false;
    }
    if (isEdit && editingJob) {
      const orig = (
        livePick ||
        editingJob.pickAddress ||
        ''
      ).trim();
      if (!pickDirty || addr === orig) return true;
      const hasCoords =
        !!(form.pick.lat && form.pick.lng) ||
        (!!editingJob.pickLatLng && editingJob.pickLatLng !== '0,0');
      if (hasCoords) return true;
    }
    if (!pickFromAutocomplete || !form.pick.lat) {
      setPickAddressError('Please select an address from the suggestions');
      addToast({
        type: 'error',
        title: 'Invalid pickup address',
        message: 'Please select an address from the suggestions',
      });
      return false;
    }
    return true;
  };

  const bookOne = async (submitForm: CreateJobFormState, dateOverride?: string) => {
    const f = dateOverride
      ? { ...submitForm, timing: 'later' as const, laterDate: dateOverride }
      : submitForm;
    if (f.timing === 'later') {
      const err = validateLaterPickupForm(f);
      if (err) throw new Error(err);
    }
    const params = buildInsertParams(f, dispatcherName);
    return withBookingTimeout(insertDispatchBooking(companyId, params), 90000, 'Booking API');
  };

  const handleSubmit = async () => {
    if (submittingRef.current || loading) return;
    if (!validatePickup()) return;

    if (form.timing === 'later') {
      const draftErr = laterDraftInlineError(laterDraft);
      if (!laterScheduleConfirmed || !isLaterDraftComplete(laterDraft) || draftErr) {
        const message =
          draftErr ||
          (!laterScheduleConfirmed
            ? 'Confirm pickup time before saving.'
            : 'Choose a pickup date and time.');
        // Edit + unchanged schedule: allow Pending/No One (and other non-timing) saves
        // even when the draft inline check is noisy (e.g. near-due clocks).
        if (isEdit && editingJob && laterScheduleConfirmed && isLaterDraftComplete(laterDraft)) {
          const prevForm = jobToForm(editingJob);
          const prevDt = buildBookingDateTime(prevForm).bookingDateTime;
          const nextDt = buildBookingDateTime(mergeLaterDraftIntoForm(form, laterDraft)).bookingDateTime;
          if (prevForm.timing === 'later' && prevDt === nextDt) {
            /* proceed */
          } else {
            addToast({ type: 'error', title: 'Cannot save', message });
            return;
          }
        } else {
          addToast({ type: 'error', title: 'Cannot save', message });
          return;
        }
      }
    }

    const submitForm =
      form.timing === 'later' ? mergeLaterDraftIntoForm(form, laterDraft) : form;

    if (submitForm.timing === 'later') {
      const laterErr = validateLaterPickupForm(submitForm);
      if (laterErr) {
        let block = true;
        if (isEdit && editingJob) {
          const prevForm = jobToForm(editingJob);
          const prevDt = buildBookingDateTime(prevForm).bookingDateTime;
          const nextDt = buildBookingDateTime(submitForm).bookingDateTime;
          block = submitForm.timing !== prevForm.timing || nextDt !== prevDt;
        }
        if (block) {
          addToast({ type: 'error', title: 'Cannot save', message: laterErr });
          return;
        }
      }
    }

    if (isEdit && !showLiveDriverOptions && isAssignedDriverSelection(submitForm.driverId)) {
      addToast({
        type: 'error',
        title: 'Cannot assign yet',
        message: 'This Later job is still before its dispatch window. Choose Pending or No One, or switch to Now to assign a driver.',
      });
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    setSubmitPhase(isEdit ? 'saving' : 'creating');
    try {
      if (isEdit && editingJob) {
        const liveJob =
          useJobStore.getState().jobs.find((j) => j.id === editingJob.id) ?? editingJob;
        const metadataChanges = buildJobEditChangesDelta(liveJob, submitForm, dispatcherName);
        const assignmentChanged = driverAssignmentChanged(liveJob, submitForm);

        if (Object.keys(metadataChanges).length === 0 && !assignmentChanged) {
          addToast({ type: 'info', title: 'No changes to save' });
          editLockJobIdRef.current = null;
          await releaseHeldEditLock(editingJob.id);
          onClose();
          return;
        }

        if (Object.keys(metadataChanges).length > 0) {
          await updateJob(liveJob.id, companyId, metadataChanges, liveJob);
        }

        if (assignmentChanged) {
          const workingJob =
            useJobStore.getState().jobs.find((j) => j.id === editingJob.id) ?? liveJob;
          const blocked = reassignBlockedMessage(effectiveJobStatus(workingJob));
          if (blocked && isAssignedDriverSelection(submitForm.driverId)) {
            addToast({ type: 'error', title: 'Cannot reassign', message: blocked });
            throw new Error(blocked);
          }
          if (isAssignedDriverSelection(submitForm.driverId)) {
            const currentDrv =
              drivers.find((d) => d.driverId === workingJob.driverId) ??
              availableDrivers.find((d) => d.driverId === workingJob.driverId);
            const staleCtx = buildStaleAssignedReassignContext({
              jobStatus: effectiveJobStatus(workingJob),
              currentDriverId: workingJob.driverId,
              newDriverId: submitForm.driverId,
              currentDriver: currentDrv,
              pickLatLng: workingJob.pickLatLng,
            });
            if (staleCtx?.needsConfirm) {
              const ok = window.confirm(
                [
                  `Reassign while ${staleCtx.driverName} may be offline?`,
                  staleCtx.lastSeenLabel,
                  staleCtx.locationLine,
                  staleCtx.warning,
                  '',
                  'OK = Reassign anyway. Cancel = keep current driver.',
                ].join('\n'),
              );
              if (!ok) {
                addToast({ type: 'info', title: 'Reassign cancelled' });
                return;
              }
            }
          }
          await applyFormDriverAssignment(workingJob, submitForm, availableDrivers).catch((e) => {
            addToast({
              type: 'error',
              title: 'Driver assignment failed',
              message: e instanceof Error ? e.message : '',
            });
            throw e;
          });
        }

        addToast({ type: 'success', title: 'Job updated', category: 'job_updated' });
        editLockJobIdRef.current = null;
        await releaseHeldEditLock(editingJob.id);
        resetForm();
        setRoutePreview(null);
        closeModal();
        return;
      }

      if (form.paymentType === 'card' && form.cardAmount && stripePk && !form.cardPaid) {
        await withBookingTimeout(loadStripeV2(), 30000, 'Stripe load');
        window.Stripe!.setPublishableKey(stripePk);
        const token = await withBookingTimeout(
          new Promise<string>((resolve, reject) => {
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
          }),
          30000,
          'Card token'
        );
        await withBookingTimeout(
          chargeStripeCard({
            token,
            amount: parseFloat(form.cardAmount) || 0,
            email: form.email,
            name: form.name,
            phone: form.phone,
          }),
          30000,
          'Card charge'
        );
        patch({ cardPaid: true });
      }

      const dates = submitForm.repeatExpanded ? repeatBookingDates(submitForm) : [];
      if (submitForm.repeatExpanded && dates.length === 0) {
        addToast({ type: 'error', title: 'Repeat booking', message: 'Select days and an until date.' });
        return;
      }

      const targets = dates.length ? dates : [undefined];
      const created: Array<{ bookingId: number; bookingStatus: string }> = [];
      setSubmitPhase('creating');
      for (const d of targets) {
        const res = await bookOne(submitForm, d);
        if (!res?.bookingId) {
          throw new Error('Server did not return a booking ID');
        }
        created.push({ bookingId: res.bookingId, bookingStatus: res.bookingStatus });
      }

      if (!created.length) {
        throw new Error('Booking was not created — no job ID returned');
      }

      const driverSelected = isAssignedDriverSelection(submitForm.driverId);

      for (const { bookingId, bookingStatus } of created) {
        const createdJob = {
          ...jobFromForm(submitForm, companyId, bookingId, bookingStatus),
          dispatcherName,
          driverId: driverSelected ? submitForm.driverId : undefined,
          vehicleId: driverSelected ? submitForm.vehicleId : undefined,
        };
        clearRemovedJob(bookingId);
        let hydrated = await hydrateJobFromServer(companyId, bookingId);
        if (!hydrated) {
          await new Promise((r) => setTimeout(r, 350));
          hydrated = await hydrateJobFromServer(companyId, bookingId);
        }
        upsertJob(hydrated ?? createdJob);
      }
      setActiveTab('ua');

      const offerFailures: number[] = [];
      if (driverSelected) {
        for (const { bookingId, bookingStatus } of created) {
          if (bookingStatus === 'Offered') continue;
          const createdJob = {
            ...jobFromForm(submitForm, companyId, bookingId, bookingStatus),
            dispatcherName,
            driverId: submitForm.driverId,
            vehicleId: submitForm.vehicleId,
          };
          const workingJob =
            useJobStore.getState().jobs.find((j) => j.id === bookingId) ?? createdJob;
          try {
            await applyFormDriverAssignment(workingJob, submitForm, availableDrivers, {
              fanout: true,
            });
          } catch (e) {
            offerFailures.push(bookingId);
            console.error(`[Book] driver offer failed for #${bookingId}:`, e);
          }
        }
      }

      if (created.length > 1) {
        const idsLabel = created.map((c) => `#${c.bookingId}`).join(', ');
        let message = idsLabel;
        if (driverSelected) {
          const offersSent = created.length - offerFailures.length;
          if (offerFailures.length) {
            message = `${offersSent} of ${created.length} offers sent · failed: ${offerFailures.map((id) => `#${id}`).join(', ')}`;
          } else {
            message = `${created.length} offers sent · ${idsLabel}`;
          }
        }
        addToast({
          type: offerFailures.length ? 'error' : 'success',
          title: `${created.length} jobs created`,
          message,
          category: 'job_created',
        });
      } else {
        const only = created[0];
        if (driverSelected && only.bookingStatus !== 'Offered' && offerFailures.includes(only.bookingId)) {
          addToast({
            type: 'error',
            title: 'Driver offer failed',
            message: `Job #${only.bookingId} was created but offer did not send`,
          });
        } else {
          notifyJobCreated(only.bookingId);
        }
      }
      onClose();
    } catch (e) {
      console.error('[Book] ERROR:', e);
      const toastAlreadyShown =
        isEdit &&
        e instanceof Error &&
        (e as Error & { toastShown?: boolean }).toastShown;
      if (!toastAlreadyShown) {
        addToast({
          type: 'error',
          title: isEdit ? 'Save failed' : 'Booking failed',
          message: e instanceof Error ? e.message : 'Unknown error',
        });
      }
    } finally {
      submittingRef.current = false;
      setLoading(false);
      setSubmitPhase(null);
    }
  };

  const bookButtonLabel = useMemo(() => {
    if (!loading) return isEdit ? 'SAVE ✓' : 'BOOK ✓';
    if (submitPhase === 'creating') return 'Creating…';
    if (submitPhase === 'saving') return 'Saving…';
    return 'Working…';
  }, [loading, submitPhase, isEdit]);

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
          onClick={onClose}
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
            invalid={
              !!pickAddressError ||
              (pickDirty && !pickFromAutocomplete && !!form.pickInput.trim())
            }
            onChange={(pickInput) => {
              patch({ pickInput, pick: { address: '', lat: 0, lng: 0 } });
              setPickDirty(true);
              setPickFromAutocomplete(false);
              setPickAddressError('');
            }}
            onPlace={onPickupSelect}
          />
          {pickAddressError && (
            <div className="text-[10px] text-red-400 mb-2">{pickAddressError}</div>
          )}
          {cityDistLoading && (
            <div className="text-[10px] text-[#8892a4] mb-2">Calculating city distance…</div>
          )}
          {!cityDistLoading && cityDistLabel && (
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
            invalid={dropDirty && !!form.dropInput.trim() && !dropFromAutocomplete}
            onChange={(dropInput) => {
              patch({ dropInput, drop: { address: '', lat: 0, lng: 0 } });
              setDropDirty(true);
              setDropFromAutocomplete(false);
            }}
            onPlace={onDropSelect}
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

        {routeSummary && (
          <div className="text-xs font-semibold text-[#5b7cfa] mb-2 px-0.5">{routeSummary}</div>
        )}

        {isEdit && editAuditMeta && (
          <section className="cj-section mb-2 bg-[#1a1a18] border border-[#333] rounded p-2">
            <div className="cj-label mb-1">Job record (read-only)</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-[#c8c4bc]">
              {editAuditMeta.createdLabel && (
                <div>
                  <span className="opacity-60">Created:</span> {editAuditMeta.createdLabel}
                </div>
              )}
              {editAuditMeta.pickupTime && (
                <div>
                  <span className="opacity-60">Pickup ({editAuditMeta.pickupType}):</span>{' '}
                  {editAuditMeta.pickupTime}
                </div>
              )}
              {editAuditMeta.overdue && (
                <div className="text-amber-400 col-span-2">
                  <span className="opacity-80">Late / overdue:</span> {editAuditMeta.overdue}
                </div>
              )}
              {editAuditMeta.lastEditedAt && (
                <div className="col-span-2">
                  <span className="opacity-60">Last edited:</span>{' '}
                  {formatJobEditHistoryWhen({ at: editAuditMeta.lastEditedAt, summary: '', by: '' })}
                  {editAuditMeta.lastEditedBy ? ` by ${editAuditMeta.lastEditedBy}` : ''}
                </div>
              )}
            </div>
            {editAuditMeta.history.length > 0 && (
              <div className="mt-2 pt-2 border-t border-[#333]">
                <div className="text-[10px] font-semibold text-[#9ca3af] mb-1">Edit history</div>
                <ul className="space-y-1 max-h-24 overflow-y-auto text-[10px] text-[#b8b4ac]">
                  {editAuditMeta.history.map((entry, i) => (
                    <li key={`${entry.at}-${i}`}>
                      <span className="text-[#888]">{formatJobEditHistoryWhen(entry)}</span>
                      {` · ${formatJobEditHistoryActor(entry)}`} —{' '}
                      {formatJobEditHistorySummary(entry, editAuditMeta.jobCreatedAt)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* 3. TIMING */}
        <section className="cj-section">
          <div className="cj-label">Timing</div>
          {isEdit && (
            <p className="text-[10px] text-[#888] mb-1">
              Change Now/Later or scheduled pickup below. Created time and overdue status above stay fixed.
            </p>
          )}
          <div className="flex w-fit mb-2">
            <button
              type="button"
              className={`cj-toggle rounded-l ${form.timing === 'now' ? 'cj-toggle-active' : ''}`}
              onClick={() => {
                setLaterScheduleConfirmed(false);
                patch({ timing: 'now' });
              }}
            >
              NOW
            </button>
            <button
              type="button"
              className={`cj-toggle rounded-r border-l-0 ${form.timing === 'later' ? 'cj-toggle-active' : ''}`}
              onClick={() => {
                setLaterScheduleConfirmed(false);
                if (!isEdit) {
                  setLaterDraft({ date: '', hour: '', min: '' });
                  patch({ timing: 'later', laterDate: '', laterHour: '', laterMin: '' });
                } else {
                  setLaterDraft({
                    date: form.laterDate || '',
                    hour: form.laterHour || '',
                    min: form.laterMin || '',
                  });
                  patch({ timing: 'later' });
                }
              }}
            >
              LATER
            </button>
          </div>
          {form.timing === 'later' && (
            <div className="cj-later-timing">
              <div className="cj-later-datetime-row">
                <input
                  type="date"
                  className="cj-input cj-later-date"
                  value={laterDraft.date}
                  onChange={(e) => {
                    setLaterDraft((d) => ({ ...d, date: e.target.value }));
                    setLaterScheduleConfirmed(false);
                  }}
                />
                <select
                  className="cj-input cj-later-time-part"
                  value={laterDraft.hour}
                  aria-label="Pickup hour (24h)"
                  onChange={(e) => {
                    setLaterDraft((d) => ({ ...d, hour: e.target.value }));
                    setLaterScheduleConfirmed(false);
                  }}
                >
                  <option value="" disabled>
                    HH
                  </option>
                  {LATER_HOURS.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <span className="cj-later-time-sep">:</span>
                <select
                  className="cj-input cj-later-time-part"
                  value={laterDraft.min}
                  aria-label="Pickup minute"
                  onChange={(e) => {
                    setLaterDraft((d) => ({ ...d, min: e.target.value }));
                    setLaterScheduleConfirmed(false);
                  }}
                >
                  <option value="" disabled>
                    MM
                  </option>
                  {LATER_MINS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              {laterInlineError ? (
                <p className="cj-schedule-inline-error" role="alert">
                  {laterInlineError}
                </p>
              ) : null}
              {laterDraftReadyForConfirm && !laterScheduleConfirmed ? (
                <button type="button" className="cj-confirm-schedule" onClick={confirmLaterSchedule}>
                  Confirm pickup time
                </button>
              ) : null}
              {laterScheduleConfirmed && confirmedLaterSummary ? (
                <div className="cj-schedule-confirmed">Pickup confirmed: {confirmedLaterSummary}</div>
              ) : !isLaterDraftComplete(laterDraft) ? (
                <div className="cj-schedule-pending">Pick a date and time to continue.</div>
              ) : null}
              {laterScheduleConfirmed ? (
                <div className="cj-later-dispatch-block">
                  <select
                    className="cj-input cj-dispatch-select"
                    value={form.dispatchBeforeMin}
                    onChange={(e) => patch({ dispatchBeforeMin: parseInt(e.target.value, 10) })}
                    title="Dispatch minutes before pickup"
                  >
                    {laterDispatchMinOptions.map((m) => (
                      <option key={m} value={m}>
                        {m === 0 ? 'Dispatch: ASAP' : `Dispatch ${m} min before pickup`}
                      </option>
                    ))}
                  </select>
                  {baseDispatchLoading ? (
                    <p className="cj-dispatch-hint">Estimating base → pickup…</p>
                  ) : baseDispatchHint ? (
                    <p className="cj-dispatch-hint">{baseDispatchHint}</p>
                  ) : null}
                </div>
              ) : null}
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
                    const t = dropdownTariffs.find((x) => String(x.Id) === id);
                    patch({
                      tariffId: id,
                      tariffName: id === '0' ? 'Automatic' : t?.TariffName || 'Automatic',
                    });
                  }}
                >
                  <option value="0">Tariff: Auto</option>
                  {dropdownTariffs.map((t) => (
                    <option key={String(t.Id)} value={String(t.Id)}>
                      {t.TariffName}
                    </option>
                  ))}
                </select>
                <select
                  className="cj-input"
                  value={form.driverId}
                  onChange={(e) => {
                    const driverId = e.target.value;
                    const d = assignDropdownDrivers.find((x) => x.driverId === driverId);
                    patch({ driverId, vehicleId: d?.vehicleId || '0', queueNumber: 0 });
                  }}
                >
                  {!isEdit && <option value="0">Driver: Auto</option>}
                  <option value="-2">
                    {isEdit ? 'Driver: Pending (U-A pool)' : 'Pending'}
                  </option>
                  <option value="-1">{isEdit ? 'Driver: No One' : 'No One'}</option>
                  {showLiveDriverOptions &&
                    assignedEditDriver &&
                    !availableDrivers.some((d) => d.driverId === assignedEditDriver.driverId) && (
                      <>
                        <option disabled value="__assigned__">
                          — assigned —
                        </option>
                        <option value={assignedEditDriver.driverId}>
                          {assignedEditDriver.vehicleNo} {assignedEditDriver.driverName}
                        </option>
                      </>
                    )}
                  {showLiveDriverOptions && assignDropdownDrivers.length > 0 && (
                    <option disabled value="__online__">
                      — online —
                    </option>
                  )}
                  {showLiveDriverOptions &&
                    assignDropdownDrivers.map((d) => (
                      <option key={d.driverId} value={d.driverId}>
                        {d.vehicleNo} {d.driverName}
                      </option>
                    ))}
                </select>
                {!showLiveDriverOptions && form.timing === 'later' && (
                  <div className="mt-1 text-[10px] text-[#8892a4]">
                    Drivers appear once the dispatch window opens (or switch to Now).
                  </div>
                )}
                {selectedDriver && (
                  <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-[#8892a4]">Selected driver:</span>
                    <span className="text-[10px] font-semibold text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10">
                      {selectedDriver.vehicleNo} {selectedDriver.driverName}
                    </span>
                  </div>
                )}
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
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-t border-[#3d4260] bg-[#0f1420]">
        {loading && submitPhase ? (
          <div className="cj-submit-status">
            <span className="cj-submit-spinner" aria-hidden />
            {submitPhaseLabel(submitPhase, isEdit)}
          </div>
        ) : (
          <div className="flex-1" />
        )}
        <button type="button" className="cj-btn-ghost" onClick={resetForm} disabled={loading}>
          Clear
        </button>
        <button type="button" className="cj-btn-ghost" onClick={onClose} disabled={loading}>
          Cancel
        </button>
        <button
          type="button"
          className="cj-btn-book"
          onClick={handleSubmit}
          disabled={
            loading || (!isEdit && (!pickFromAutocomplete || !form.pick.lat)) || laterBookBlocked
          }
          title={laterBookBlocked ? 'Confirm pickup time before booking' : undefined}
          aria-busy={loading}
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          {bookButtonLabel}
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
