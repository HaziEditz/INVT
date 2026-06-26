import { filterForbiddenTariffDropdown } from '@/lib/tariffGuard';

export type DataParam = { name: string; Value?: string; value?: string };

function paramVal(params: DataParam[], ...names: string[]): string {
  for (const name of names) {
    const p = params.find((x) => x.name === name);
    const v = p?.Value ?? p?.value;
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}

function parseLatLng(raw: string): { lat: number; lng: number } {
  const parts = raw.split(',').map((s) => parseFloat(s.trim()));
  if (parts.length !== 2 || parts.some((n) => Number.isNaN(n))) return { lat: 0, lng: 0 };
  return { lat: parts[0], lng: parts[1] };
}

async function postDataManager<T = unknown>(
  selector: 'DataSelector' | 'DataSelectorRide',
  action: string,
  data: DataParam[]
): Promise<T> {
  const r = await fetch(`/DataManager/Data.aspx/${selector}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data, action }),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json.error || `DataManager ${action} failed (${r.status})`);
  return json as T;
}

export interface CustomerSearchResult {
  acc: Array<{
    id: string;
    client_name: string;
    client_phone: string;
    claim_number: string;
    trip_days_left?: number;
    acc_approval_id?: string | null;
    manager_id?: string;
  }>;
  accounts: Array<{ Id: string | number; Name: string; PhoneNo?: string; Email?: string; Type?: string }>;
  passengers: Array<{ Id: string | number; Name: string; PhoneNo?: string; Email?: string }>;
}

export async function searchCustomers(query: string): Promise<CustomerSearchResult> {
  const json = await postDataManager<{ d: string }>('DataSelector', '[searchmulti]', [
    { name: 'claim_number', value: query },
  ]);
  const parsed = JSON.parse(json.d || '{}') as {
    dt1?: CustomerSearchResult['acc'];
    dt2?: CustomerSearchResult['accounts'];
    dt3?: CustomerSearchResult['passengers'];
  };
  return {
    acc: parsed.dt1 || [],
    accounts: parsed.dt2 || [],
    passengers: parsed.dt3 || [],
  };
}

export interface DispatcherSettingsPayload {
  companyName: string;
  tariffs: Array<{ Id: string | number; TariffName: string }>;
  vehicleTypes: Array<{ Id: number; VehicleName: string }>;
  stripePublicKey: string;
}

export async function fetchDispatcherSettings(): Promise<DispatcherSettingsPayload> {
  const json = await postDataManager<{ d: string }>('DataSelector', '[DispatcherSettings]', []);
  const payload = JSON.parse(json.d || '{}') as {
    dt1?: Array<{ CompanyName?: string }>;
    dt3?: DispatcherSettingsPayload['vehicleTypes'];
    dt4?: DispatcherSettingsPayload['tariffs'];
    dt5?: Array<{ PublicKey?: string }>;
  };
  return {
    companyName: payload.dt1?.[0]?.CompanyName || '',
    vehicleTypes: payload.dt3 || [],
    tariffs: filterForbiddenTariffDropdown(payload.dt4 || []),
    stripePublicKey: payload.dt5?.[0]?.PublicKey || '',
  };
}

/** Push live Firebase tariffs into server TARIFF_STORE ([TariffSync]). */
export async function syncTariffsToServer(
  tariffs: Array<{ id: string; name: string; startPrice: number; distanceRate: number; waitingRate: number; minimumFare: number }>,
): Promise<void> {
  if (!tariffs.length) return;
  const payload = tariffs.map((t) => ({
    Id: parseInt(t.id, 10) || t.id,
    TariffName: t.name,
    StartPrice: t.startPrice,
    DistanceRate: t.distanceRate,
    WaitingRate: t.waitingRate,
    MinimumFare: t.minimumFare,
    CurrencyName: 'NZD',
  }));
  try {
    await postDataManager('DataSelector', '[TariffSync]', [
      { name: 'tariffs', value: JSON.stringify(payload) },
    ]);
  } catch (err) {
    console.warn('[TariffSync] push failed:', err);
  }
}

export interface InsertBookingResult {
  bookingId: number;
  bookingStatus: string;
}

export async function insertDispatchBooking(
  companyId: string,
  params: DataParam[]
): Promise<InsertBookingResult> {
  const pickAddr = paramVal(params, 'PickLocation', 'PickAddress', 'pickupAddress', 'PickupAddress');
  const dropAddr = paramVal(params, 'DropLocation', 'DropAddress', 'dropoffAddress', 'DropoffAddress');
  const pickLL = parseLatLng(paramVal(params, 'PickLatLng'));
  const dropLL = parseLatLng(paramVal(params, 'DropLatLng'));

  const pre = await createJob({
    source: 'dispatch',
    companyId,
    pickup: { address: pickAddr, lat: pickLL.lat, lng: pickLL.lng },
    dropoff: { address: dropAddr, lat: dropLL.lat, lng: dropLL.lng },
    passenger: {
      name: paramVal(params, 'Name'),
      phone: paramVal(params, 'PassengerId'),
    },
    notes: paramVal(params, 'EntitiesDetails', 'Notes'),
  });
  const jobId = String(pre.jobId ?? pre.bookingId ?? '');
  if (!jobId) throw new Error('Server did not return a job ID');

  const withId = params
    .filter((p) => p.name !== 'ExternalJobId')
    .concat([{ name: 'ExternalJobId', Value: jobId }]);

  const json = await postDataManager<{ d: string }>('DataSelectorRide', 'InsertBookingv4', withId);
  const rows = JSON.parse(json.d || '[]') as Array<{
    Result?: string;
    Error?: boolean;
    BookingId?: number;
    BookingStatus?: string;
  }>;
  const row = rows[0];
  if (!row) throw new Error('Empty response from booking server');
  if (row.Error || (row.Result && row.Result.indexOf('Error') === 0)) {
    throw new Error(row.Result?.replace(/^Error:\s*/, '') || 'Booking failed');
  }
  if (row.Result !== 'Booking Information Successfully Submitted') {
    throw new Error(row.Result || 'Booking was not accepted');
  }
  return {
    bookingId: row.BookingId ?? parseInt(jobId, 10),
    bookingStatus: row.BookingStatus || 'Pending',
  };
}

export async function updateDispatchBooking(
  bookingId: number,
  params: DataParam[]
): Promise<{ bookingId: number; bookingStatus: string }> {
  const withId = params.some((p) => p.name === 'Id')
    ? params
    : [{ name: 'Id', Value: String(bookingId) }, ...params];

  const json = await postDataManager<{ d: string }>('DataSelectorRide', '[ProcUpdateJobv6]', withId);
  const rows = JSON.parse(json.d || '[]') as Array<{
    Result?: string;
    Error?: boolean;
    BookingStatus?: string;
  }>;
  const row = rows[0];
  if (!row) throw new Error('Empty response from update server');
  if (row.Error || (row.Result && row.Result.indexOf('Error') === 0)) {
    throw new Error(row.Result?.replace(/^Error:\s*/, '') || 'Update failed');
  }
  return { bookingId, bookingStatus: row.BookingStatus || 'Pending' };
}

export async function chargeStripeCard(opts: {
  token: string;
  amount: number;
  jobId?: number;
  email?: string;
  name?: string;
  phone?: string;
}): Promise<void> {
  const r = await fetch('/Default.aspx/DispatchChargeing', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      Token: opts.token,
      Amout: String(opts.amount),
      JobId: opts.jobId ? String(opts.jobId) : '',
      Email: opts.email || '',
      Name: opts.name || '',
      Phone: opts.phone || '',
    }),
  });
  const json = await r.json().catch(() => ({}));
  const msg = String(json.d || '');
  if (msg.startsWith('error')) throw new Error(msg.replace(/^error:\s*/i, ''));
}
