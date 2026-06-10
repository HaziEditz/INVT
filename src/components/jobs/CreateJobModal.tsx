import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Minus, Plus, Search } from 'lucide-react';
import { SlidePanel } from '@/components/shared/SlidePanel';
import { Button } from '@/components/shared/Button';
import { AddressAutocomplete } from '@/components/jobs/AddressAutocomplete';
import { useUiStore } from '@/store/uiStore';
import { useDriverStore } from '@/store/driverStore';
import {
  chargeStripeCard,
  fetchDispatcherSettings,
  insertDispatchBooking,
  searchCustomers,
  type CustomerSearchResult,
} from '@/lib/dispatchApi';
import {
  buildInsertParams,
  defaultCreateJobForm,
  repeatBookingDates,
  VEHICLE_TYPES,
  type CreateJobFormState,
  type StopPoint,
} from '@/lib/createJobForm';

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

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SERVICES = ['taxi', 'food', 'freight', 'tm', 'acc', 'rental'] as const;
const DISPATCH_MINS = [0, 5, 10, 15, 20, 30, 45, 60, 75, 90, 120];

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

export function CreateJobModal({ mapsKey, companyId, dispatcherName }: CreateJobModalProps) {
  const open = useUiStore((s) => s.openModal === 'createJob');
  const closeModal = useUiStore((s) => s.closeModal);
  const settings = useUiStore((s) => s.settings);
  const addToast = useUiStore((s) => s.addToast);

  const drivers = useDriverStore((s) => s.drivers);
  const availableDrivers = useMemo(
    () => drivers.filter((d) => d.status === 'Available'),
    [drivers]
  );

  const [form, setForm] = useState<CreateJobFormState>(defaultCreateJobForm);
  const [loading, setLoading] = useState(false);
  const [tariffs, setTariffs] = useState<Array<{ Id: string | number; TariffName: string }>>([]);
  const [stripePk, setStripePk] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [searchHits, setSearchHits] = useState<CustomerSearchResult | null>(null);
  const [showCard, setShowCard] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [cardExpMonth, setCardExpMonth] = useState('');
  const [cardExpYear, setCardExpYear] = useState('');

  const patch = useCallback((p: Partial<CreateJobFormState>) => {
    setForm((f) => ({ ...f, ...p }));
  }, []);

  const resetForm = useCallback(() => {
    setForm(defaultCreateJobForm());
    setSearchQ('');
    setSearchHits(null);
    setShowCard(false);
    setCardNumber('');
    setCardCvc('');
    setCardExpMonth('');
    setCardExpYear('');
  }, []);

  useEffect(() => {
    if (open) resetForm();
  }, [open, resetForm]);

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
    if (!open || searchQ.trim().length < 2) {
      setSearchHits(null);
      return;
    }
    const t = setTimeout(() => {
      searchCustomers(searchQ.trim())
        .then(setSearchHits)
        .catch(() => setSearchHits(null));
    }, 300);
    return () => clearTimeout(t);
  }, [open, searchQ]);

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

  const pickCustomer = (name: string, phone: string, email?: string, extra?: Partial<CreateJobFormState>) => {
    patch({ name, phone, email: email || form.email, ...extra });
    setSearchHits(null);
    setSearchQ('');
  };

  const validatePickup = (): boolean => {
    const addr = form.pick.address || form.pickInput;
    if (!addr.trim()) {
      addToast({ type: 'error', title: 'Pickup address required' });
      return false;
    }
    if (!form.pick.lat && form.timing === 'now') {
      addToast({ type: 'warning', title: 'Select pickup from suggestions', message: 'Choose an address from the dropdown for accurate dispatch.' });
    }
    return true;
  };

  const bookOne = async (dateOverride?: string) => {
    const f = dateOverride
      ? {
          ...form,
          timing: 'later' as const,
          laterDate: dateOverride,
        }
      : form;
    const params = buildInsertParams(f, dispatcherName);
    return insertDispatchBooking(companyId, params);
  };

  const handleBook = async () => {
    if (!validatePickup()) return;
    setLoading(true);
    try {
      if (showCard && form.cardAmount && stripePk && !form.cardPaid) {
        await loadStripeV2();
        window.Stripe!.setPublishableKey(stripePk);
        const token = await new Promise<string>((resolve, reject) => {
          window.Stripe!.card.createToken(
            {
              number: cardNumber.replace(/\s/g, ''),
              cvc: cardCvc,
              exp_month: cardExpMonth,
              exp_year: cardExpYear.slice(-2),
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

      const dates = form.repeatEnabled ? repeatBookingDates(form) : [];
      if (form.repeatEnabled && dates.length === 0) {
        addToast({ type: 'error', title: 'Repeat booking', message: 'Select days and an until date.' });
        return;
      }

      const targets = dates.length ? dates : [undefined];
      let lastId = 0;
      for (const d of targets) {
        const res = await bookOne(d);
        lastId = res.bookingId;
      }

      addToast({
        type: 'success',
        title: targets.length > 1 ? `${targets.length} jobs created` : 'Job created',
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

  const customTariff = form.tariffId === '-1';

  return (
    <SlidePanel
      open={open}
      onClose={closeModal}
      title="Create Job"
      width={420}
      footer={
        <>
          <Button variant="ghost" onClick={closeModal}>
            Cancel
          </Button>
          <Button variant="ghost" onClick={resetForm}>
            Clear
          </Button>
          {settings?.features.cardBooking && stripePk && (
            <Button variant="gold" onClick={() => setShowCard((v) => !v)}>
              {showCard ? 'Hide Card' : 'Card Pay'}
            </Button>
          )}
          <Button variant="success" onClick={handleBook} disabled={loading}>
            {loading ? 'Booking…' : 'Book'}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm pb-4">
        {/* Route */}
        <section>
          <div className="bw-section-title">Route</div>
          <label className="bw-label">Pickup</label>
          <AddressAutocomplete
            mapsKey={mapsKey}
            active={open}
            value={form.pickInput}
            placeholder="Search pickup (NZ)"
            onChange={(pickInput) => patch({ pickInput })}
            onPlace={(pick) => patch({ pick, pickInput: pick.address })}
          />
          {form.stops.map((stop) => (
            <div key={stop.id} className="flex gap-1 mt-1.5">
              <AddressAutocomplete
                mapsKey={mapsKey}
                active={open}
                value={stop.address}
                placeholder="Stop address"
                className="bw-field flex-1"
                onChange={(address) => updateStop(stop.id, { address })}
                onPlace={(place) => updateStop(stop.id, { address: place.address, lat: place.lat, lng: place.lng })}
              />
              <button type="button" className="bw-icon-btn shrink-0" onClick={() => removeStop(stop.id)} aria-label="Remove stop">
                <Minus size={14} />
              </button>
            </div>
          ))}
          <button type="button" className="text-xs bw-accent mt-1.5 flex items-center gap-1" onClick={addStop}>
            <Plus size={12} /> Add Stop
          </button>
          <div className="flex items-center justify-between mt-2">
            <label className="bw-label mb-0">Dropoff</label>
            <button type="button" className="text-[10px] bw-muted flex items-center gap-1 bw-hover-text" onClick={reverseRoute}>
              <ArrowLeftRight size={12} /> Reverse
            </button>
          </div>
          <AddressAutocomplete
            mapsKey={mapsKey}
            active={open}
            value={form.dropInput}
            placeholder="Search dropoff (NZ)"
            onChange={(dropInput) => patch({ dropInput })}
            onPlace={(drop) => patch({ drop, dropInput: drop.address })}
          />
        </section>

        {/* Customer search */}
        <section>
          <div className="bw-section-title flex items-center gap-1">
            <Search size={12} /> Customer
          </div>
          <input
            className="bw-field mb-1"
            placeholder="Search name / phone / claim #"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
          />
          {searchHits && (
            <div className="max-h-28 overflow-y-auto rounded border bw-border bw-card-static text-xs mb-2">
              {searchHits.passengers.map((p) => (
                <button
                  key={`p-${p.Id}`}
                  type="button"
                  className="w-full text-left px-2 py-1.5 hover:bg-[var(--bw-card-hover)] border-b bw-border"
                  onClick={() => pickCustomer(p.Name, p.PhoneNo || '', p.Email)}
                >
                  {p.Name} · {p.PhoneNo}
                </button>
              ))}
              {searchHits.accounts.map((a) => (
                <button
                  key={`a-${a.Id}`}
                  type="button"
                  className="w-full text-left px-2 py-1.5 hover:bg-[var(--bw-card-hover)] border-b bw-border"
                  onClick={() => pickCustomer(a.Name, a.PhoneNo || '', a.Email, { accountId: String(a.Id) })}
                >
                  Account: {a.Name}
                </button>
              ))}
              {searchHits.acc.map((a) => (
                <button
                  key={`acc-${a.id}`}
                  type="button"
                  className="w-full text-left px-2 py-1.5 hover:bg-[var(--bw-card-hover)] border-b bw-border"
                  onClick={() =>
                    pickCustomer(a.client_name, a.client_phone, '', {
                      claimNumber: a.claim_number,
                      accClientId: a.id,
                      accJobId: a.acc_approval_id || '',
                      accManagerId: a.manager_id || '',
                    })
                  }
                >
                  ACC: {a.client_name} · {a.claim_number}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="bw-label">Name</label>
              <input className="bw-field" value={form.name} onChange={(e) => patch({ name: e.target.value })} />
            </div>
            <div>
              <label className="bw-label">Phone</label>
              <input className="bw-field" value={form.phone} onChange={(e) => patch({ phone: e.target.value })} />
            </div>
          </div>
          <div className="mt-2">
            <label className="bw-label">Email</label>
            <input className="bw-field" type="email" value={form.email} onChange={(e) => patch({ email: e.target.value })} />
          </div>
          <textarea
            className="bw-field mt-2 min-h-[52px]"
            placeholder="Notes / instructions"
            value={form.notes}
            onChange={(e) => patch({ notes: e.target.value })}
          />
          <div className="flex gap-4 mt-2 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={form.corner} onChange={(e) => patch({ corner: e.target.checked })} />
              Corner
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-amber-400">
              <input type="checkbox" checked={form.urgent} onChange={(e) => patch({ urgent: e.target.checked })} />
              Urgent
            </label>
          </div>
          {form.corner && (
            <input
              className="bw-field mt-1"
              placeholder="Corner detail"
              value={form.cornerDetail}
              onChange={(e) => patch({ cornerDetail: e.target.value })}
            />
          )}
        </section>

        {/* Timing */}
        <section>
          <div className="bw-section-title">Booking time</div>
          <div className="flex rounded-md overflow-hidden border bw-border w-fit mb-2">
            <button
              type="button"
              className={`px-4 py-1.5 text-xs font-semibold ${form.timing === 'now' ? 'bw-accent-solid' : 'bw-muted'}`}
              onClick={() => patch({ timing: 'now' })}
            >
              Now
            </button>
            <button
              type="button"
              className={`px-4 py-1.5 text-xs font-semibold ${form.timing === 'later' ? 'bw-accent-solid' : 'bw-muted'}`}
              onClick={() => patch({ timing: 'later' })}
            >
              Later
            </button>
          </div>
          {form.timing === 'later' && (
            <div className="space-y-2 p-2 rounded border bw-border bw-card-static">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="bw-label">Date</label>
                  <input type="date" className="bw-field" value={form.laterDate} onChange={(e) => patch({ laterDate: e.target.value })} />
                </div>
                <div>
                  <label className="bw-label">Hour</label>
                  <select className="bw-field" value={form.laterHour} onChange={(e) => patch({ laterHour: e.target.value })}>
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={String(i).padStart(2, '0')}>
                        {String(i).padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="bw-label">Min</label>
                  <select className="bw-field" value={form.laterMin} onChange={(e) => patch({ laterMin: e.target.value })}>
                    {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="bw-label">Dispatch before (notify drivers)</label>
                <select
                  className="bw-field"
                  value={form.dispatchBeforeMin}
                  onChange={(e) => patch({ dispatchBeforeMin: parseInt(e.target.value, 10) })}
                >
                  {DISPATCH_MINS.map((m) => (
                    <option key={m} value={m}>
                      {m === 0 ? '0 min (ASAP)' : m >= 60 ? `${m / 60}h ${m % 60 ? `${m % 60}m` : ''}` : `${m} min`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </section>

        {/* Service & vehicle */}
        <section>
          <div className="bw-section-title">Service & vehicle</div>
          <div className="flex flex-wrap gap-1 mb-2">
            {SERVICES.map((s) => (
              <button
                key={s}
                type="button"
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${form.serviceType === s ? 'bw-accent-solid' : 'bw-card-static border'}`}
                onClick={() => patch({ serviceType: s })}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-1.5 mb-2">
            {(
              [
                ['passengers', form.passengers, (n: number) => patch({ passengers: n })],
                ['bags', form.bags, (n: number) => patch({ bags: n })],
                ['wheelchairs', form.wheelchairs, (n: number) => patch({ wheelchairs: n })],
                ['cars', form.carsRequired, (n: number) => patch({ carsRequired: n })],
              ] as const
            ).map(([label, val, set]) => (
              <div key={label}>
                <label className="bw-label capitalize">{label}</label>
                <select className="bw-field px-1" value={val} onChange={(e) => set(parseInt(e.target.value, 10))}>
                  {Array.from({ length: label === 'passengers' ? 20 : label === 'cars' ? 7 : 6 }, (_, i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <label className="bw-label">Vehicle type</label>
          <select className="bw-field mb-2" value={form.vehicleType} onChange={(e) => patch({ vehicleType: e.target.value })}>
            {VEHICLE_TYPES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <label className="bw-label">Driver (optional)</label>
          <select
            className="bw-field"
            value={form.driverId}
            onChange={(e) => {
              const driverId = parseInt(e.target.value, 10);
              const d = availableDrivers.find((x) => parseInt(x.driverId, 10) === driverId);
              patch({
                driverId,
                vehicleId: d?.vehicleId || '0',
                queueNumber: 0,
              });
            }}
          >
            <option value={0}>Automatic</option>
            <option value={-2}>Pending (broadcast)</option>
            <option value={-1}>No One</option>
            {availableDrivers.map((d) => (
              <option key={d.driverId} value={parseInt(d.driverId, 10) || d.driverId}>
                {d.driverName} / {d.vehicleNo}
              </option>
            ))}
          </select>
        </section>

        {/* Tariff & ACC */}
        <section>
          <div className="bw-section-title">Tariff & payment</div>
          <label className="bw-label">Tariff</label>
          <select
            className="bw-field mb-1"
            value={form.tariffId}
            onChange={(e) => {
              const id = e.target.value;
              const t = tariffs.find((x) => String(x.Id) === id);
              patch({
                tariffId: id,
                tariffName: id === '0' ? 'Automatic' : id === '-1' ? 'Fixed' : t?.TariffName || 'Automatic',
              });
            }}
          >
            <option value="0">Automatic</option>
            <option value="-1">Fixed fare</option>
            {tariffs.map((t) => (
              <option key={String(t.Id)} value={String(t.Id)}>
                {t.TariffName}
              </option>
            ))}
          </select>
          {customTariff && (
            <input
              className="bw-field mb-2"
              type="number"
              step="0.01"
              placeholder="Fixed fare amount ($)"
              value={form.customRate}
              onChange={(e) => patch({ customRate: e.target.value })}
            />
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="bw-label">Claim #</label>
              <input className="bw-field" value={form.claimNumber} onChange={(e) => patch({ claimNumber: e.target.value })} />
            </div>
            <div>
              <label className="bw-label">PO #</label>
              <input className="bw-field" value={form.poNumber} onChange={(e) => patch({ poNumber: e.target.value })} />
            </div>
          </div>
        </section>

        {/* TM */}
        {form.serviceType === 'tm' && (
          <section>
            <div className="bw-section-title">Total Mobility</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="bw-label">TM card #</label>
                <input className="bw-field" value={form.tmCardNumber} onChange={(e) => patch({ tmCardNumber: e.target.value })} />
              </div>
              <div>
                <label className="bw-label">Card expiry</label>
                <input className="bw-field" placeholder="MM/YY" value={form.tmCardExpiry} onChange={(e) => patch({ tmCardExpiry: e.target.value })} />
              </div>
            </div>
            <label className="bw-label mt-1">Council %</label>
            <input className="bw-field" value={form.tmCouncilPercent} onChange={(e) => patch({ tmCouncilPercent: e.target.value })} />
          </section>
        )}

        {/* Repeat */}
        <section>
          <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
            <input type="checkbox" checked={form.repeatEnabled} onChange={(e) => patch({ repeatEnabled: e.target.checked })} />
            Repeat booking
          </label>
          {form.repeatEnabled && (
            <div className="mt-2 space-y-2 p-2 rounded border bw-border bw-card-static">
              <div>
                <label className="bw-label">Until date</label>
                <input type="date" className="bw-field" value={form.repeatUntil} onChange={(e) => patch({ repeatUntil: e.target.value })} />
              </div>
              <div className="flex flex-wrap gap-2">
                {DAY_LABELS.map((d, i) => (
                  <label key={d} className="flex items-center gap-1 text-[10px]">
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
            </div>
          )}
        </section>

        {/* Stripe card */}
        {showCard && stripePk && (
          <section className="p-2 rounded border border-amber-600/40 bg-amber-950/20">
            <div className="bw-section-title text-amber-400">Card payment</div>
            <input className="bw-field mb-1" placeholder="Amount NZD" value={form.cardAmount} onChange={(e) => patch({ cardAmount: e.target.value })} />
            <input className="bw-field mb-1" placeholder="Card number" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} />
            <div className="grid grid-cols-3 gap-1">
              <input className="bw-field" placeholder="MM" value={cardExpMonth} onChange={(e) => setCardExpMonth(e.target.value)} />
              <input className="bw-field" placeholder="YY" value={cardExpYear} onChange={(e) => setCardExpYear(e.target.value)} />
              <input className="bw-field" placeholder="CVC" value={cardCvc} onChange={(e) => setCardCvc(e.target.value)} />
            </div>
            <p className="text-[10px] bw-muted mt-1">Charged when you click Book</p>
          </section>
        )}
      </div>
    </SlidePanel>
  );
}
