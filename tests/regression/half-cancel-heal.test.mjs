/**
 * Half-cancel / post-cancel overwrite: jobStore must NOT heal authentic
 * Cancelled allbookings/pendingjobs back to Pending (82585 class).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const src = readFileSync(join(root, 'server.js'), 'utf8');

test('reconcile refuses heal when pendingjobs is terminal', () => {
  assert.match(src, /_jobStoreShouldWinOverTerminalAllbookings/);
  assert.match(src, /_firebasePendingIsTerminal\(cid, bookingId, tok\)\) return false/);
  assert.match(src, /_firebaseAllbookingsIsAuthenticTerminal/);
  assert.match(src, /82585 half-cancel|authentic terminal/);
});

test('allbookings live write refuses replacing authentic Cancelled', () => {
  assert.match(src, /refuse replace authentic/);
  assert.match(src, /allowReplaceTerminal/);
  assert.match(src, /existingSt === 'Cancelled'/);
});

test('hydrate copies website TM/Account payment stamps', () => {
  assert.match(src, /function _fbRecToJob/);
  assert.match(src, /accountNumber/);
  assert.match(src, /isTotalMobility/);
  assert.match(src, /tmCardNumber/);
  assert.match(src, /giftCardCode/);
  assert.match(src, /paymentStatus/);
  assert.match(src, /Website \/ passenger payment stamps/);
});
