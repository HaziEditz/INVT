/**
 * Display polish — fixed fare label, edit history actor + creation time on timing edits.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret } from '../lib/config.mjs';
import { getHarness } from '../lib/harness.mjs';

function formatFixedFareAmount(raw) {
  const cleaned = String(raw || '').trim().replace(/^\$/, '');
  if (!cleaned || cleaned === '0') return null;
  const n = parseFloat(cleaned);
  if (Number.isNaN(n) || n <= 0) return null;
  return n % 1 === 0 ? n.toFixed(0) : n.toFixed(2);
}

function jobTariffLabel(job) {
  if (job.isFixedPrice) {
    const fixedAmount = formatFixedFareAmount(job.estimatedFare || job.totalFare || '');
    return fixedAmount ? `Fixed $${fixedAmount}` : 'Fixed';
  }
  const name = String(job.tariffName || '').trim();
  if (name && name.toLowerCase() !== 'automatic') return name;
  if (job.tariffId && job.tariffId !== '0' && job.tariffId !== '-1') return `Tariff #${job.tariffId}`;
  return job.tariffId === '0' ? 'Automatic' : null;
}

function editHistorySourceLabel(by) {
  const b = String(by || '').toLowerCase();
  if (b === 'dispatcher') return 'Dispatcher';
  if (b === 'passenger') return 'Passenger App';
  if (b === 'website') return 'Website';
  return String(by || '').trim() || 'Unknown';
}

function formatJobEditHistoryActor(entry) {
  const source = editHistorySourceLabel(entry.by);
  const actor = String(entry.byName || '').trim();
  if (!actor) return source;
  const a = actor.toLowerCase();
  const b = String(entry.by || '').toLowerCase();
  // Never collapse desk actor names (default "Dispatcher" lowercases to channel "dispatcher").
  if (b === 'dispatcher') return `${source} · ${actor}`;
  if (b === 'passenger' && (a === 'passenger' || a === 'passenger app' || a === 'app')) return source;
  if (b === 'website' && (a === 'website' || a === 'web')) return source;
  return `${source} · ${actor}`;
}

const TIMING_KEYS = [
  'BookingDateTime',
  'Pickingtime',
  'DispatchTimebefore',
  'Dispatchbefore',
  'ScheduledFor',
  'ScheduledForMs',
  'NotifyDispatchAt',
];

function editHistoryEntryTouchesTiming(entry) {
  if (!entry.changes) return false;
  return TIMING_KEYS.some((k) => Object.prototype.hasOwnProperty.call(entry.changes, k));
}

function formatJobDateTimeShort(d) {
  return d.toLocaleString('en-NZ', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatJobEditHistorySummary(entry, jobCreatedAt) {
  if (entry.summary.includes('job created')) return entry.summary;
  if (!editHistoryEntryTouchesTiming(entry)) return entry.summary;
  const ms = entry.jobCreatedAtMs ?? jobCreatedAt?.getTime();
  if (!ms || Number.isNaN(ms)) return entry.summary;
  return `${entry.summary} · job created ${formatJobDateTimeShort(new Date(ms))}`;
}

test('jobTariffLabel: fixed-price job shows amount on UA card', () => {
  assert.equal(
    jobTariffLabel({ isFixedPrice: true, tariffName: 'Fixed', estimatedFare: '45', tariffId: '-1' }),
    'Fixed $45',
  );
  assert.equal(
    jobTariffLabel({ isFixedPrice: true, tariffName: 'Fixed', estimatedFare: '$45.50', tariffId: '-1' }),
    'Fixed $45.50',
  );
  assert.equal(
    jobTariffLabel({ isFixedPrice: true, tariffName: 'Fixed', estimatedFare: '', tariffId: '-1' }),
    'Fixed',
  );
});

test('formatJobEditHistoryActor: source channel plus actor name', () => {
  assert.equal(
    formatJobEditHistoryActor({ by: 'dispatcher', byName: 'Jane Smith', summary: '' }),
    'Dispatcher · Jane Smith',
  );
  assert.equal(
    formatJobEditHistoryActor({ by: 'website', byName: 'John Doe', summary: '' }),
    'Website · John Doe',
  );
  assert.equal(
    formatJobEditHistoryActor({ by: 'passenger', byName: 'Sam Lee', summary: '' }),
    'Passenger App · Sam Lee',
  );
  assert.equal(formatJobEditHistoryActor({ by: 'website', summary: '' }), 'Website');
  // Product default person label "Dispatcher" must NOT collapse against channel "dispatcher".
  assert.equal(
    formatJobEditHistoryActor({ by: 'dispatcher', byName: 'Dispatcher', summary: '' }),
    'Dispatcher · Dispatcher',
  );
});

test('formatJobEditHistorySummary: timing entry references original creation time', () => {
  const created = new Date('2026-07-13T10:30:00');
  const entry = {
    by: 'dispatcher',
    byName: 'Jane',
    summary: 'Timing → Later (pickup 2026-07-14 16:37:00, dispatch 10 min before)',
    changes: { DispatchTimebefore: { from: '0', to: '10' } },
    jobCreatedAtMs: created.getTime(),
  };
  const out = formatJobEditHistorySummary(entry, created);
  assert.match(out, /job created/);
  assert.match(out, /Timing → Later/);
});

test('integration: timing edit history records dispatcher actor and job created ref', async () => {
  await getHarness({ fresh: true });
  requireFirebaseSecret();
  const h = await getHarness();
  const jobId = await h.createAsapJob('display-polish-history');
  const before = await h.jobTrace(jobId);
  const createdMs = Number(before.jobStore?.lifecycle?.createdAt || before.firebase?.allbookings?.createdAt || 0);

  const future = new Date(Date.now() + 26 * 3600_000);
  const dateTime = future.toLocaleString('sv-SE', { timeZone: 'Pacific/Auckland' }).replace('T', ' ');
  const seq = await h.readUpdateSeq(jobId);
  const save = await h.bookingUpdate(
    jobId,
    {
      BookingDateTime: dateTime,
      Pickingtime: dateTime,
      DispatchTimebefore: '10',
      Dispatchbefore: '10',
      DispatcherName: 'Regression Dispatcher',
    },
    seq,
  );
  assert.equal(save.body.ok, true, JSON.stringify(save.body));

  const after = await h.jobTrace(jobId);
  const history = after.firebase?.allbookings?.editHistory || after.firebase?.allbookings?.EditHistory;
  assert.ok(Array.isArray(history) && history.length > 0, 'edit history should be written to Firebase');
  const last = history[history.length - 1];
  assert.equal(String(last.by || ''), 'dispatcher');
  assert.equal(String(last.byName || ''), 'Regression Dispatcher');
  assert.match(String(last.summary || ''), /Timing → Later/);
  assert.match(String(last.summary || ''), /job created/);
  if (createdMs > 0) {
    assert.ok(Number(last.jobCreatedAtMs) > 0, 'timing entry should snapshot jobCreatedAtMs');
  }

  await h.cancelUnassigned(jobId);
});
