/**
 * In-process lock so overlapping hail creates with the same clientTripId
 * cannot both miss lookup and both allocate a booking id (TOCTOU).
 */
'use strict';

/** @type {Map<string, Promise<unknown>>} */
const locks = new Map();

function lockKey(companyId, clientTripId) {
  return `${String(companyId || '').trim()}::${String(clientTripId || '').trim()}`;
}

/**
 * Run `fn` exclusively for (companyId, clientTripId).
 * Waiters re-run `findExisting` after the holder finishes and skip `fn` if found.
 *
 * @template T
 * @param {string} companyId
 * @param {string} clientTripId
 * @param {() => (T|null|undefined)} findExisting
 * @param {() => Promise<T>} fn
 * @returns {Promise<{ value: T, waited: boolean, fromExisting: boolean }>}
 */
async function withClientTripIdCreateLock(companyId, clientTripId, findExisting, fn) {
  const key = lockKey(companyId, clientTripId);
  if (!String(companyId || '').trim() || !String(clientTripId || '').trim()) {
    const value = await fn();
    return { value, waited: false, fromExisting: false };
  }

  let waited = false;
  while (locks.has(key)) {
    waited = true;
    try {
      await locks.get(key);
    } catch (_e) {
      /* holder failed — we may retry create */
    }
    const existing = findExisting();
    if (existing) {
      return { value: existing, waited: true, fromExisting: true };
    }
  }

  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  locks.set(key, gate);
  try {
    const existing = findExisting();
    if (existing) {
      return { value: existing, waited, fromExisting: true };
    }
    const value = await fn();
    return { value, waited, fromExisting: false };
  } finally {
    if (typeof release === 'function') release();
    if (locks.get(key) === gate) locks.delete(key);
  }
}

/** Test helper — clear all locks. */
function _resetClientTripIdCreateLocksForTests() {
  locks.clear();
}

module.exports = {
  withClientTripIdCreateLock,
  lockKey,
  _resetClientTripIdCreateLocksForTests,
};
