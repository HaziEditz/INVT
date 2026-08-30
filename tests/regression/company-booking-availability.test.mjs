/**
 * Unit checks for ASAP dispatch-online + operating-hours gate.
 * Run: node --test tests/regression/company-booking-availability.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Mirror of passenger/website helpers — keep logic in this file so tests don't
// depend on TS transpile of the app packages.
// Keep in sync with website/passenger companyBookingAvailability.ts (12m).
const DISPATCH_HEARTBEAT_STALE_MS = 12 * 60 * 1000;

function isCompanyDispatchOnline(sessions, nowMs = Date.now(), staleMs = DISPATCH_HEARTBEAT_STALE_MS) {
  if (!sessions || typeof sessions !== "object") return false;
  const entries = Object.values(sessions).filter((s) => s && typeof s === "object");
  if (entries.length === 0) return false;
  for (const s of entries) {
    if (s.active === false || s.active === "false" || s.active === 0) continue;
    const ts = Number(s.heartbeat ?? s.lastSeen ?? 0);
    if (!Number.isFinite(ts) || ts <= 0) return true;
    const ms = ts < 1e12 ? ts * 1000 : ts;
    if (nowMs - ms <= staleMs) return true;
  }
  return false;
}

function isWithinOperatingHours(hoursText, now = new Date(), timeZone) {
  const raw = String(hoursText || "").trim();
  if (!raw) return true;
  const lower = raw.toLowerCase();
  if (/24\s*\/\s*7|24\s*hours|always\s*open|open\s*24/.test(lower)) return true;
  if (/^closed\b|permanently\s*closed|not\s*accepting/.test(lower)) return false;
  return true; // unparsed free text → open (parity with app helpers for empty-config)
}

describe("company ASAP availability", () => {
  it("dispatch online when fresh heartbeat exists", () => {
    const now = Date.now();
    assert.equal(
      isCompanyDispatchOnline({ s1: { lastSeen: now - 60_000, active: true } }, now),
      true,
    );
  });

  it("dispatch offline when sessions empty", () => {
    assert.equal(isCompanyDispatchOnline({}), false);
    assert.equal(isCompanyDispatchOnline(null), false);
  });

  it("dispatch offline when heartbeat stale", () => {
    const now = Date.now();
    assert.equal(
      isCompanyDispatchOnline({ s1: { lastSeen: now - 15 * 60_000 } }, now),
      false,
    );
  });

  it("dispatch still online within 12m throttle window", () => {
    const now = Date.now();
    assert.equal(
      isCompanyDispatchOnline({ s1: { lastSeen: now - 10 * 60_000, active: true } }, now),
      true,
    );
  });

  it("presence without timestamp still counts online", () => {
    assert.equal(isCompanyDispatchOnline({ s1: { email: "d@x.com" } }), true);
  });

  it("empty operating hours → open", () => {
    assert.equal(isWithinOperatingHours(""), true);
    assert.equal(isWithinOperatingHours(null), true);
  });

  it("24/7 and Closed strings", () => {
    assert.equal(isWithinOperatingHours("24/7"), true);
    assert.equal(isWithinOperatingHours("Closed"), false);
  });
});
