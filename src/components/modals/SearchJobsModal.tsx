import { useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/shared/Button';
import { useUiStore } from '@/store/uiStore';
import { getDb, ref, get } from '@/lib/firebase';
import { jobFromFirebase } from '@/types/job';

interface SearchJobsModalProps {
  companyId: string;
}

export function SearchJobsModal({ companyId }: SearchJobsModalProps) {
  const open = useUiStore((s) => s.openModal === 'searchJobs');
  const closeModal = useUiStore((s) => s.closeModal);
  const openModalWith = useUiStore((s) => s.openModalWith);
  const [mode, setMode] = useState<'id' | 'name' | 'phone'>('id');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ReturnType<typeof jobFromFirebase>[]>([]);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    setLoading(true);
    try {
      const db = getDb();
      const snap = await get(ref(db, `allbookings/${companyId}`));
      const list: NonNullable<ReturnType<typeof jobFromFirebase>>[] = [];
      const val = snap.val();
      if (val) {
        for (const [key, rec] of Object.entries(val as Record<string, Record<string, unknown>>)) {
          const job = jobFromFirebase(key, rec, companyId);
          if (!job) continue;
          const q = query.toLowerCase();
          if (mode === 'id' && String(job.id).includes(q)) list.push(job);
          else if (mode === 'name' && job.passengerName.toLowerCase().includes(q)) list.push(job);
          else if (mode === 'phone' && job.passengerPhone.includes(q)) list.push(job);
        }
      }
      setResults(list.slice(0, 50));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={closeModal} title="Search Jobs" wide footer={<Button variant="ghost" onClick={closeModal}>Close</Button>}>
      <div className="flex gap-2 mb-3">
        <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className="px-2 py-1 rounded bg-bw-bg border border-bw-border text-sm">
          <option value="id">Booking ID</option>
          <option value="name">Passenger Name</option>
          <option value="phone">Phone</option>
        </select>
        <input value={query} onChange={(e) => setQuery(e.target.value)} className="flex-1 px-3 py-1 rounded bg-bw-bg border border-bw-border" placeholder="Search…" />
        <Button variant="gold" onClick={search} disabled={loading}>Search</Button>
      </div>
      <div className="space-y-2 max-h-[50vh] overflow-y-auto">
        {results.map((j) => j && (
          <div key={j.id} className="bw-card p-2 cursor-pointer hover:border-bw-primary" onClick={() => { closeModal(); openModalWith('jobDetail', { jobId: j.id }); }}>
            <div className="font-mono font-bold">#{j.id}</div>
            <div className="text-xs text-bw-muted">{j.passengerName} · {j.status}</div>
            <div className="text-xs truncate">{j.pickAddress}</div>
          </div>
        ))}
        {!loading && results.length === 0 && <p className="text-bw-muted text-sm text-center py-8">No results</p>}
      </div>
    </Modal>
  );
}
