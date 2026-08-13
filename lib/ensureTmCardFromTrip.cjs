'use strict';

/**
 * Create-if-absent tmCards registry rows from driver TM trip complete/sync.
 * Never overwrites council-set region / limits / notes / active / phone.
 */

const NAME_JUNK_RE =
  /\b(total\s*mobility|totalmobility|times\s+when|using\s+total|authorized|authorised|signature|cardholder|visa|mastercard|american\s+express|eftpos|contactless|debit\s+card|credit\s+card|valid\s+thru|not\s+valid)\b/i;

/** Digits-only card key for tmCards/{id} lookup + create. */
function normalizeTmCardNumber(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  return digits;
}

/**
 * Accept plausible TM short ids (6–11) or bank PANs (13–19).
 * Reject empty / too short / OCR fragment soup.
 */
function isPlausibleTmCardNumber(raw) {
  const digits = normalizeTmCardNumber(raw);
  if (!digits) return false;
  if (digits.length < 6 || digits.length > 19) return false;
  // Reject all-same-digit junk (000000 / 11111111).
  if (/^(\d)\1+$/.test(digits)) return false;
  return true;
}

/** First + last name, no OCR banner / brand chrome. */
function isValidTmCardholderName(raw) {
  const s = String(raw || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length < 5 || s.length > 64) return false;
  if (/\d/.test(s)) return false;
  if (NAME_JUNK_RE.test(s)) return false;
  const tokens = s.split(' ').filter(Boolean);
  if (tokens.length < 2 || tokens.length > 6) return false;
  let singles = 0;
  let longish = 0;
  for (const t of tokens) {
    if (!/^[A-Za-z][A-Za-z'.-]*$/.test(t)) return false;
    if (t.length === 1) singles += 1;
    if (t.length >= 3) longish += 1;
  }
  if (singles > 1) return false;
  if (longish < 1) return false;
  const shortish = tokens.filter((t) => t.length <= 3).length;
  if (tokens.length >= 3 && shortish === tokens.length) return false;
  return true;
}

/**
 * Convert MM/YY or MM/YYYY → YYYY-MM-DD (last day of expiry month).
 * Pass through already-ISO dates. Invalid → null.
 */
function expiryMmYyToIsoDate(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const y = parseInt(iso[1], 10);
    const m = parseInt(iso[2], 10);
    const d = parseInt(iso[3], 10);
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }
  const mmyy = s.match(/^(0[1-9]|1[0-2])\s*[\/\-.]\s*(\d{2}|\d{4})$/);
  if (!mmyy) return null;
  const month = parseInt(mmyy[1], 10);
  let year = parseInt(mmyy[2], 10);
  if (mmyy[2].length === 2) year += year >= 70 ? 1900 : 2000;
  if (year < 1990 || year > 2100) return null;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

function buildTmCardCreatePayload(opts) {
  const cardNumber = normalizeTmCardNumber(opts && opts.cardNumber);
  const passengerName = String((opts && opts.passengerName) || '')
    .replace(/\s+/g, ' ')
    .trim();
  const councilId = String((opts && opts.councilId) || '').trim();
  if (!isPlausibleTmCardNumber(cardNumber)) {
    return { ok: false, reason: 'bad_card_number' };
  }
  if (!isValidTmCardholderName(passengerName)) {
    return { ok: false, reason: 'bad_passenger_name' };
  }
  if (!councilId) {
    return { ok: false, reason: 'missing_council_id' };
  }
  const expiryDate = expiryMmYyToIsoDate(opts && opts.expiry);
  const now = Number((opts && opts.now) || Date.now());
  return {
    ok: true,
    cardNumber,
    payload: {
      passengerName,
      passengerPhone: null,
      expiryDate: expiryDate || null,
      cardRegion: null,
      notes: null,
      usageLimitMonthly: null,
      usageLimitDaily: null,
      active: true,
      councilId,
      balance: 0,
      createdAt: now,
      updatedAt: now,
      updatedBy: 'driver_scan',
      source: String((opts && opts.source) || 'driver_scan'),
    },
  };
}

/**
 * Explicit driver "Hoist used? Yes" — never infer from booking tmHoistRequired alone.
 */
function isDriverHoistConfirmed(job) {
  if (!job || typeof job !== 'object') return false;
  if (job.hoistUsedConfirmed === true || job.hoistUsedConfirmed === 'true') return true;
  // Legacy: payment flow only stamps hoistCount/tmHoists after Yes.
  const count = Math.max(
    0,
    parseInt(job.hoistCount != null ? job.hoistCount : job.tmHoistCount, 10) || 0,
  );
  if (count < 1) return false;
  return Array.isArray(job.tmHoists) && job.tmHoists.length > 0;
}

/** Collect primary (+ hoist-only when confirmed) card candidates from a completed job. */
function collectTmCardCandidatesFromJob(job) {
  const out = [];
  const seen = new Set();
  function push(cardNumber, passengerName, expiry, role) {
    const key = normalizeTmCardNumber(cardNumber);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push({
      cardNumber: key,
      passengerName: String(passengerName || '').trim(),
      expiry: expiry || '',
      role: role || 'primary',
    });
  }
  if (!job || typeof job !== 'object') return out;
  push(
    job.tmCardNumber || job.tmVoucherNo,
    job.tmCardName,
    job.tmCardExpiry,
    'primary',
  );
  if (!isDriverHoistConfirmed(job)) return out;
  const hoists = Array.isArray(job.tmHoists) ? job.tmHoists : [];
  for (const h of hoists) {
    if (!h || typeof h !== 'object') continue;
    push(h.cardNumber || h.tmCardNumber, h.cardName || h.tmCardName, h.cardExpiry || h.tmCardExpiry, 'hoist');
  }
  return out;
}

/**
 * Create-if-absent for one card. deps: { get(path), set(path, value) }
 * Returns { action: 'created'|'exists'|'skipped', reason?, cardNumber? }
 */
async function ensureTmCardFromTrip(opts, deps) {
  const built = buildTmCardCreatePayload(opts || {});
  if (!built.ok) {
    return { action: 'skipped', reason: built.reason, cardNumber: normalizeTmCardNumber(opts && opts.cardNumber) || '' };
  }
  if (!deps || typeof deps.get !== 'function' || typeof deps.set !== 'function') {
    return { action: 'skipped', reason: 'missing_deps', cardNumber: built.cardNumber };
  }
  const path = `tmCards/${built.cardNumber}`;
  let existing = null;
  try {
    existing = await deps.get(path);
  } catch (e) {
    return { action: 'skipped', reason: 'get_failed', cardNumber: built.cardNumber, error: e && e.message };
  }
  if (existing && typeof existing === 'object' && Object.keys(existing).length > 0) {
    return { action: 'exists', cardNumber: built.cardNumber };
  }
  try {
    await deps.set(path, built.payload);
  } catch (e) {
    return { action: 'skipped', reason: 'set_failed', cardNumber: built.cardNumber, error: e && e.message };
  }
  return { action: 'created', cardNumber: built.cardNumber };
}

/** Ensure all candidates from a TM job (create-if-absent each). */
async function ensureTmCardsFromJob(job, deps, opts) {
  const councilId = String(
    (opts && opts.councilId) ||
      (job && (job.councilId || job.tmCouncilId)) ||
      '',
  ).trim();
  const source = String((opts && opts.source) || 'dispatch_complete');
  const results = [];
  const candidates = collectTmCardCandidatesFromJob(job);
  for (const c of candidates) {
    // eslint-disable-next-line no-await-in-loop
    const r = await ensureTmCardFromTrip(
      {
        cardNumber: c.cardNumber,
        passengerName: c.passengerName,
        expiry: c.expiry,
        councilId,
        source,
      },
      deps,
    );
    results.push(Object.assign({ role: c.role }, r));
  }
  return results;
}

module.exports = {
  normalizeTmCardNumber,
  isPlausibleTmCardNumber,
  isValidTmCardholderName,
  expiryMmYyToIsoDate,
  buildTmCardCreatePayload,
  isDriverHoistConfirmed,
  collectTmCardCandidatesFromJob,
  ensureTmCardFromTrip,
  ensureTmCardsFromJob,
};
