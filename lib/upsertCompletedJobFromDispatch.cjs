/**
 * Upsert completedJobs (+ optional closedJobs) from a dispatch in-memory job.
 * Fill-if-empty: never clobber richer driver-written fields with empties.
 */
'use strict';

function str(v, fallback) {
  if (v == null) return fallback != null ? fallback : '';
  const s = String(v).trim();
  return s || (fallback != null ? fallback : '');
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function hasValue(v) {
  if (v == null) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (typeof v === 'number') return !isNaN(v);
  if (typeof v === 'boolean') return true;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
}

function fillIfEmpty(target, key, value) {
  if (!hasValue(value)) return false;
  if (hasValue(target[key])) return false;
  target[key] = value;
  return true;
}

function assignPreferIncoming(target, key, value, preferIncoming) {
  if (!hasValue(value)) return false;
  if (preferIncoming || !hasValue(target[key])) {
    target[key] = value;
    return true;
  }
  return false;
}

function completedAtMs(job) {
  // Prefer trip-end stamps (stepTimes / JobCompleteTime) over upload-time completedAtMs
  // so late offline sync does not rewrite confirm-time into anomaly windows.
  const st = job && job.stepTimes;
  if (st && typeof st === 'object') {
    const done = st.completeAt != null ? st.completeAt : st.hailEndedAt;
    const n = Number(done);
    if (Number.isFinite(n) && n > 0) return n < 1e12 ? n * 1000 : n;
  }
  const iso = job.JobCompleteTime || job.completedAt_ISO;
  if (iso && typeof iso === 'string') {
    const ms = Date.parse(iso);
    if (!isNaN(ms) && ms > 0) return ms;
  }
  if (typeof job.completedAt === 'number' && job.completedAt > 0) {
    return job.completedAt < 1e12 ? job.completedAt * 1000 : job.completedAt;
  }
  if (typeof job.completedAtMs === 'number' && job.completedAtMs > 0) return job.completedAtMs;
  if (typeof job.completedAt === 'string') {
    const ms = Date.parse(job.completedAt);
    if (!isNaN(ms) && ms > 0) return ms;
  }
  return Date.now();
}

/**
 * Build a lowercase SA-shaped completedJobs record from a dispatch job.
 */
function buildCompletedJobRecord(job, opts) {
  opts = opts || {};
  const bookingId = parseInt(job.Id || job.bookingId || job.jobId || opts.bookingId, 10) || 0;
  const companyId = str(job.companyId || opts.companyId);
  const pickup = str(job.PickAddress || job.pickAddress || job.pickup || job.PickupAddress);
  const dropoff = str(
    job.DropAddress || job.dropAddress || job.dropoff || job.finalDropAddress || job.DropoffAddress,
  );
  const paymentType = str(
    job.tmRemainderPaymentType ||
      job.PaymentType ||
      job.paymentType ||
      job.PaymentMethod ||
      job.paymentMethod ||
      job.Recieve_payment ||
      'Cash',
  );
  const fare =
    num(job.TotalFare) != null
      ? num(job.TotalFare)
      : num(job.totalFare) != null
        ? num(job.totalFare)
        : num(job.Fare) != null
          ? num(job.Fare)
          : num(job.fare);
  const distanceKm =
    num(job.distanceKm) != null
      ? num(job.distanceKm)
      : num(job.JobDistance) != null
        ? num(job.JobDistance)
        : num(job.distance) != null
          ? num(job.distance)
          : num(job.EstimatedDistance);
  const now = completedAtMs(job);
  const isTm =
    job.isTotalMobility === true ||
    job.isTM === true ||
    job.IsTM === true ||
    job.tmUsed === true ||
    job.tmCouncilPays != null ||
    job.tmSubsidyFare != null ||
    !!str(job.tmCardNumber || job.tmVoucherNo) ||
    /^(tm|total\s*mobility)$/i.test(paymentType);

  const record = {
    bookingId,
    jobId: bookingId,
    companyId,
    driverId: str(job.DriverId || job.driverId || job.AssignedDriverId),
    driverName: str(job.driverName || job.DriverName || job.drivername),
    vehicleId: str(job.VehicleNo || job.CallSign || job.vehicleId || job.VehicleId || job.AssignedVehicleId),
    pickup,
    dropoff,
    pickupAddress: pickup,
    dropAddress: dropoff,
    passengerName: str(job.PassengerName || job.passengerName || job.name || job.tmCardName),
    passengerPhone: str(job.PhoneNo || job.phoneNo || job.passengerPhone),
    paymentType,
    paymentMethod: paymentType,
    fare: fare != null ? fare : 0,
    totalFare: fare != null ? fare : 0,
    distanceKm: distanceKm != null ? distanceKm : undefined,
    completedAt: now,
    completedAt_ISO: new Date(now).toISOString(),
    closedAt: now,
    status: 'Completed',
    BookingStatus: 'Completed',
    // Prefer authentic booking origin (Website / PassengerApp / Hail). Never use
    // the complete API path tag (/api/job/complete) as BookingSource — that broke Owner Panel Web:0.
    BookingSource: undefined, // filled below
    source: str(
      job.BookingSource ||
        job.bookingSource ||
        job.Source ||
        job.source ||
        (opts.source && !String(opts.source).includes('/api/') ? opts.source : '') ||
        'dispatch_complete',
    ),
    completedVia: str(opts.source || 'dispatch_complete'),
  };

  record.BookingSource = record.source;
  record.bookingSource = record.source;
  if (job.CreatedBy || job.createdBy) {
    record.CreatedBy = str(job.CreatedBy || job.createdBy);
  }
  if (job.CompletedBy) record.CompletedBy = str(job.CompletedBy);
  if (job.Account_id || job.AccountId || job.jobAccountId || job.accountNumber) {
    record.accountId = str(job.Account_id || job.AccountId || job.jobAccountId || job.accountNumber);
    record.Account_id = record.accountId;
    record.AccountId = record.accountId;
    record.jobAccountId = record.accountId;
  }
  if (job.paymentStatus || job.PaymentStatus) {
    record.paymentStatus = str(job.paymentStatus || job.PaymentStatus);
  }
  if (job.giftCardCode || job.GiftCardCode) {
    record.giftCardCode = str(job.giftCardCode || job.GiftCardCode);
    record.GiftCardCode = record.giftCardCode;
  }
  if (job.Account_Name || job.AccountName || job.jobAccountName) {
    record.accountName = str(job.Account_Name || job.AccountName || job.jobAccountName);
    record.Account_Name = record.accountName;
    record.AccountName = record.accountName;
    record.jobAccountName = record.accountName;
  }
  if (job.fareBreakdown || job.FareBreakdown) {
    record.fareBreakdown = job.fareBreakdown || job.FareBreakdown;
    record.FareBreakdown = record.fareBreakdown;
  }
  if (job.stepTimes) record.stepTimes = job.stepTimes;
  if (job.gpsRoute) record.gpsRoute = job.gpsRoute;
  if (job.routePolyline || job.route_polyline || job.RoutePolyline) {
    record.routePolyline = job.routePolyline || job.route_polyline || job.RoutePolyline;
    record.route_polyline = record.routePolyline;
  }
  // Intermediate stops — Closed Job detail reads these (#86926090112 gap)
  if (job.Nextstop != null && String(job.Nextstop) !== '') {
    record.Nextstop = job.Nextstop;
    record.nextstop = job.Nextstop;
  }
  if (job.nextstopdata) {
    record.nextstopdata = job.nextstopdata;
    record.Nextstopdata = job.nextstopdata;
  }
  if (Array.isArray(job.Stops) && job.Stops.length) record.Stops = job.Stops;
  if (Array.isArray(job.stops) && job.stops.length) record.stops = job.stops;
  if (Array.isArray(job.extraStops) && job.extraStops.length) record.extraStops = job.extraStops;

  if (isTm) {
    record.isTotalMobility = true;
    record.tmUsed = true;
    record.tmPaymentType = str(job.tmPaymentType || 'total_mobility');
    record.paymentCategory = str(job.paymentCategory || 'total_mobility');
    record.tmCouncilPays =
      job.tmCouncilPays != null ? job.tmCouncilPays : job.tmSubsidy != null ? job.tmSubsidy : job.councilPays;
    record.tmPassengerPays =
      job.tmPassengerPays != null
        ? job.tmPassengerPays
        : job.passengerPays != null
          ? job.passengerPays
          : undefined;
    record.tmSubsidy = job.tmSubsidy != null ? job.tmSubsidy : record.tmCouncilPays;
    record.tmSubsidyFare = job.tmSubsidyFare != null ? job.tmSubsidyFare : record.tmCouncilPays;
    record.tmMeterFare = job.tmMeterFare != null ? job.tmMeterFare : fare;
    record.tmTotalFare = job.tmTotalFare != null ? job.tmTotalFare : fare;
    record.tmSubsidyHoist =
      job.tmSubsidyHoist != null ? job.tmSubsidyHoist : job.hoistTotal != null ? job.hoistTotal : undefined;
    if (job.hoistTotal != null) record.hoistTotal = job.hoistTotal;
    if (job.hoistCount != null || job.tmHoistCount != null) {
      record.hoistCount = job.hoistCount != null ? job.hoistCount : job.tmHoistCount;
      record.tmHoistCount = job.tmHoistCount != null ? job.tmHoistCount : job.hoistCount;
    }
    if (job.tmHoists) record.tmHoists = job.tmHoists;
    if (job.hoistUsedConfirmed === true || job.hoistUsedConfirmed === 'true') {
      record.hoistUsedConfirmed = true;
    }
    record.tmCardNumber = str(job.tmCardNumber || job.tmVoucherNo);
    record.tmVoucherNo = str(job.tmVoucherNo || job.tmCardNumber);
    record.tmCardName = str(job.tmCardName);
    record.tmCardExpiry = str(job.tmCardExpiry);
    record.tmRemainderPaymentType = str(job.tmRemainderPaymentType || paymentType);
    record.councilId = str(job.councilId || job.tmCouncilId);
    record.tmCouncilId = str(job.tmCouncilId || job.councilId);
  }

  // Drop undefined keys
  Object.keys(record).forEach((k) => {
    if (record[k] === undefined) delete record[k];
  });
  return record;
}

/**
 * Merge incoming into existing with fill-if-empty (preferExisting=true)
 * or preferIncoming for scalar enrichment when explicitly requested.
 */
function mergeCompletedJobRecords(existing, incoming, opts) {
  opts = opts || {};
  const preferIncoming = !!opts.preferIncoming;
  const base =
    existing && typeof existing === 'object' ? Object.assign({}, existing) : {};
  if (!incoming || typeof incoming !== 'object') return base;
  Object.keys(incoming).forEach((k) => {
    if (preferIncoming) assignPreferIncoming(base, k, incoming[k], true);
    else fillIfEmpty(base, k, incoming[k]);
  });
  // Always keep bookingId/companyId/status coherent
  if (incoming.bookingId != null) base.bookingId = incoming.bookingId;
  if (incoming.companyId) base.companyId = String(incoming.companyId);
  if (!base.status) base.status = 'Completed';
  if (!base.BookingStatus) base.BookingStatus = 'Completed';
  return base;
}

/**
 * @param {object} deps { get(path), set(path, value), push?(path, value) }
 * @returns {Promise<{ completedPath, closedPath?, action, bookingId }>}
 */
async function upsertCompletedJobFromDispatch(job, deps, opts) {
  opts = opts || {};
  deps = deps || {};
  if (!job || typeof job !== 'object') {
    return { action: 'skipped', reason: 'no_job' };
  }
  const bookingId = parseInt(job.Id || job.bookingId || opts.bookingId, 10) || 0;
  const companyId = str(job.companyId || opts.companyId);
  if (!bookingId || !companyId) {
    return { action: 'skipped', reason: 'missing_id', bookingId, companyId };
  }
  if (typeof deps.get !== 'function' || typeof deps.set !== 'function') {
    return { action: 'skipped', reason: 'no_fb_deps', bookingId, companyId };
  }

  const incoming = buildCompletedJobRecord(job, {
    bookingId,
    companyId,
    source: opts.source || 'dispatch_complete',
  });
  const path = `completedJobs/${companyId}/${bookingId}`;
  let existing = null;
  try {
    existing = await deps.get(path);
  } catch (_e) {
    existing = null;
  }
  const preferIncoming = !!opts.preferIncoming;
  const merged = mergeCompletedJobRecords(existing, incoming, { preferIncoming });
  await deps.set(path, merged);

  let closedPath = null;
  if (opts.writeClosedJobs !== false && typeof deps.set === 'function') {
    // Deterministic key — one closedJobs row per bookingId (no push races from
    // complete + idempotent complete + driver writeClosedJob).
    const closedPathKey = `closedJobs/${companyId}/job_${bookingId}`;
    const alreadyPushed =
      existing &&
      (existing.closedJobsPushed === true ||
        existing.closedJobsKey === `job_${bookingId}` ||
        existing.closedJobsKey === closedPathKey);
    if (!alreadyPushed || opts.forceClosedPush) {
      let existingClosed = null;
      try {
        existingClosed = await deps.get(closedPathKey);
      } catch (_e) {
        existingClosed = null;
      }
      const closedRecord = Object.assign({}, merged, {
        status: 'closed',
        bookingId,
        closedJobsKey: `job_${bookingId}`,
      });
      if (existingClosed && typeof existingClosed === 'object' && !opts.forceClosedPush) {
        const closedMerged = mergeCompletedJobRecords(existingClosed, closedRecord, {
          preferIncoming: false,
        });
        await deps.set(closedPathKey, closedMerged);
      } else {
        await deps.set(closedPathKey, closedRecord);
      }
      closedPath = closedPathKey;
      merged.closedJobsPushed = true;
      merged.closedJobsKey = `job_${bookingId}`;
      await deps.set(path, merged);
    }
  } else if (opts.writeClosedJobs !== false && typeof deps.push === 'function') {
    // Legacy fallback when set is unavailable.
    if (!existing || opts.forceClosedPush) {
      const closedRecord = Object.assign({}, merged, { status: 'closed' });
      try {
        const pushResult = await deps.push(`closedJobs/${companyId}`, closedRecord);
        closedPath =
          typeof pushResult === 'string'
            ? pushResult
            : pushResult && pushResult.name
              ? `closedJobs/${companyId}/${pushResult.name}`
              : `closedJobs/${companyId}`;
      } catch (_e) {
        closedPath = null;
      }
    }
  }

  return {
    action: existing ? 'merged' : 'created',
    bookingId,
    companyId,
    completedPath: path,
    closedPath,
    record: merged,
  };
}

/**
 * Fill sparse job body from allbookings-shaped record (A-lite).
 * fill-if-empty only.
 */
function fillJobFromAllbookings(job, ab) {
  const base = job && typeof job === 'object' ? Object.assign({}, job) : {};
  if (!ab || typeof ab !== 'object') return base;
  const mapped = buildCompletedJobRecord(
    Object.assign({}, ab, {
      Id: ab.bookingId || ab.Id || base.bookingId,
      companyId: ab.companyId || base.companyId,
    }),
    { source: ab.source || 'allbookings_fill' },
  );
  return mergeCompletedJobRecords(base, mapped, { preferIncoming: false });
}

/**
 * Apply tmTripStatus economics onto a job when fare fields are empty.
 */
function applyStatusEconomicsToJob(job, st) {
  const base = job && typeof job === 'object' ? Object.assign({}, job) : {};
  if (!st || typeof st !== 'object') return base;
  if (st.isTotalMobility) base.isTotalMobility = true;
  fillIfEmpty(base, 'tmCouncilPays', st.tmCouncilPays != null ? st.tmCouncilPays : st.tmSubsidy);
  fillIfEmpty(base, 'tmPassengerPays', st.tmPassengerPays);
  fillIfEmpty(base, 'tmSubsidy', st.tmCouncilPays != null ? st.tmCouncilPays : st.tmSubsidy);
  fillIfEmpty(base, 'tmSubsidyFare', st.tmSubsidyFare != null ? st.tmSubsidyFare : st.tmCouncilPays);
  fillIfEmpty(base, 'tmCardNumber', st.tmCardNumber);
  fillIfEmpty(base, 'councilId', st.councilId);
  fillIfEmpty(base, 'tmCouncilId', st.councilId);
  if (st.submittedAt != null && !hasValue(base.completedAt)) base.completedAt = st.submittedAt;
  return base;
}

module.exports = {
  buildCompletedJobRecord,
  mergeCompletedJobRecords,
  upsertCompletedJobFromDispatch,
  fillJobFromAllbookings,
  applyStatusEconomicsToJob,
  fillIfEmpty,
  hasValue,
};
