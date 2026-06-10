import { useEffect, useRef, useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/shared/Button';
import { attachPlacesAutocomplete, loadGoogleMaps } from '@/lib/geocoder';
import { createJob } from '@/lib/jobFlow';
import { useUiStore } from '@/store/uiStore';
import { getDb, ref, get } from '@/lib/firebase';
import type { BusinessAccount } from '@/types/booking';

interface CreateJobModalProps {
  mapsKey: string;
  companyId: string;
}

export function CreateJobModal({ mapsKey, companyId }: CreateJobModalProps) {
  const open = useUiStore((s) => s.openModal === 'createJob');
  const closeModal = useUiStore((s) => s.closeModal);
  const settings = useUiStore((s) => s.settings);
  const addToast = useUiStore((s) => s.addToast);

  const pickRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLInputElement>(null);
  const [pick, setPick] = useState({ address: '', lat: 0, lng: 0 });
  const [drop, setDrop] = useState({ address: '', lat: 0, lng: 0 });
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [service, setService] = useState('taxi');
  const [timing, setTiming] = useState<'now' | 'later'>('now');
  const [bizAccounts, setBizAccounts] = useState<BusinessAccount[]>([]);
  const [bizId, setBizId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !mapsKey) return;
    loadGoogleMaps(mapsKey).then(() => {
      const u1 = pickRef.current ? attachPlacesAutocomplete(pickRef.current, setPick) : () => {};
      const u2 = dropRef.current ? attachPlacesAutocomplete(dropRef.current, setDrop) : () => {};
      return () => {
        u1();
        u2();
      };
    });
  }, [open, mapsKey]);

  useEffect(() => {
    if (!open || !companyId) return;
    get(ref(getDb(), `businessAccounts/${companyId}`)).then((snap) => {
      const list: BusinessAccount[] = [];
      snap.forEach((c) => {
        const v = c.val();
        list.push({ id: c.key!, name: String(v.name ?? v.accountName ?? ''), code: v.code, email: v.email });
      });
      setBizAccounts(list);
    });
  }, [open, companyId]);

  const submit = async () => {
    if (!pick.address) {
      addToast({ type: 'error', title: 'Pickup required' });
      return;
    }
    setLoading(true);
    try {
      await createJob({
        companyId,
        source: 'dispatch',
        passenger: { name, phone },
        pickup: pick,
        dropoff: drop,
        notes,
        serviceType: service,
        pickupTime: timing === 'now' ? new Date().toISOString() : undefined,
        accountId: bizId || undefined,
      });
      addToast({ type: 'success', title: 'Job created' });
      closeModal();
    } catch (e) {
      addToast({ type: 'error', title: 'Create failed', message: e instanceof Error ? e.message : '' });
    } finally {
      setLoading(false);
    }
  };

  const services = ['taxi', 'food', 'freight', 'tm', 'acc', 'rental'];

  return (
    <Modal
      open={open}
      onClose={closeModal}
      title="Create Job"
      wide
      footer={
        <>
          <Button variant="ghost" onClick={closeModal}>
            Cancel
          </Button>
          <Button variant="ghost" onClick={() => { setPick({ address: '', lat: 0, lng: 0 }); setDrop({ address: '', lat: 0, lng: 0 }); setName(''); setPhone(''); setNotes(''); }}>
            Clear
          </Button>
          <Button variant="success" onClick={submit} disabled={loading}>
            Book
          </Button>
          {settings?.features.cardBooking && (
            <Button variant="gold" disabled>
              Card Booking
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <section>
          <h3 className="text-xs font-bold text-bw-muted uppercase mb-2">Route</h3>
          <input ref={pickRef} placeholder="Pickup address" className="w-full mb-2 px-3 py-2 rounded bg-bw-bg border border-bw-border text-bw-text" />
          <input ref={dropRef} placeholder="Dropoff address" className="w-full px-3 py-2 rounded bg-bw-bg border border-bw-border text-bw-text" />
        </section>
        <section>
          <h3 className="text-xs font-bold text-bw-muted uppercase mb-2">Passenger</h3>
          <div className="grid grid-cols-2 gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="px-3 py-2 rounded bg-bw-bg border border-bw-border" />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className="px-3 py-2 rounded bg-bw-bg border border-bw-border" />
          </div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" className="w-full mt-2 px-3 py-2 rounded bg-bw-bg border border-bw-border min-h-[60px]" />
        </section>
        <section>
          <h3 className="text-xs font-bold text-bw-muted uppercase mb-2">Timing</h3>
          <div className="flex gap-2">
            <Button variant={timing === 'now' ? 'primary' : 'ghost'} onClick={() => setTiming('now')}>Now</Button>
            <Button variant={timing === 'later' ? 'primary' : 'ghost'} onClick={() => setTiming('later')}>Later</Button>
          </div>
        </section>
        <section>
          <h3 className="text-xs font-bold text-bw-muted uppercase mb-2">Service</h3>
          <div className="flex flex-wrap gap-1">
            {services.map((s) => (
              <Button key={s} variant={service === s ? 'primary' : 'ghost'} onClick={() => setService(s)}>
                {s.toUpperCase()}
              </Button>
            ))}
          </div>
        </section>
        {settings?.features.businessAccounts && bizAccounts.length > 0 && (
          <section>
            <h3 className="text-xs font-bold text-bw-muted uppercase mb-2">Account</h3>
            <select value={bizId} onChange={(e) => setBizId(e.target.value)} className="w-full px-3 py-2 rounded bg-bw-bg border border-bw-border">
              <option value="">None</option>
              {bizAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </section>
        )}
      </div>
    </Modal>
  );
}
