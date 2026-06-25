#!/usr/bin/env node
/** One-off Firebase RTDB node delete (requires BW_FIREBASE_SECRET in .env). */
import '../tests/lib/loadEnv.mjs';

const FB_DB_URL = 'https://bookawaka2026-564e1-default-rtdb.firebaseio.com';
const path = (process.argv[2] || '').trim().replace(/^\/+/, '');

if (!path || path.includes('..')) {
  console.error('Usage: node scripts/delete-firebase-path.mjs <path>');
  process.exit(1);
}

const token = process.env.BW_FIREBASE_SECRET;
if (!token) {
  console.error('BW_FIREBASE_SECRET not set');
  process.exit(1);
}

const url = `${FB_DB_URL}/${path}.json?auth=${encodeURIComponent(token)}`;
const peek = await fetch(url);
const before = peek.ok ? await peek.json() : null;
console.log('Before:', peek.status, before == null ? '(missing)' : JSON.stringify(before).slice(0, 200));

const del = await fetch(url, { method: 'DELETE' });
const body = await del.text();
console.log('DELETE:', del.status, body || '(empty)');

const verify = await fetch(url);
console.log('After exists:', verify.status === 200);
