type DataParam = { name: string; value: string };

export type SuspendedDriverRow = {
  driverId: string;
  vehicleId: string;
  driverName: string;
  vehicleNo: string;
  vehicleType: string;
  zoneName: string;
  suspendedAt: string;
  suspendedUntil: string | null;
  companyId: string;
};

async function postProcessor(action: string, data: DataParam[]): Promise<{ d?: string }> {
  const r = await fetch('/DataManager/Data.aspx/DataProcessor', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, data }),
  });
  const json = (await r.json().catch(() => ({}))) as { d?: string; error?: string };
  if (!r.ok) throw new Error(json.error || `${action} failed (${r.status})`);
  return json;
}

async function postSelector(action: string, data: DataParam[] = []): Promise<{ d?: string }> {
  const r = await fetch('/DataManager/Data.aspx/DataSelector', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, data }),
  });
  const json = (await r.json().catch(() => ({}))) as { d?: string; error?: string };
  if (!r.ok) throw new Error(json.error || `${action} failed (${r.status})`);
  return json;
}

function pick(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}

function normalizeRow(raw: Record<string, unknown>): SuspendedDriverRow {
  return {
    driverId: pick(raw, 'driverId', 'DriverId', 'driverid'),
    vehicleId: pick(raw, 'vehicleId', 'VehicleId', 'vehicleid'),
    driverName: pick(raw, 'drivername', 'driverName', 'DriverName'),
    vehicleNo: pick(raw, 'vehiclenumber', 'vehicleNo', 'VehicleNumber', 'vehicleNumber'),
    vehicleType: pick(raw, 'vehicletype', 'vehicleType', 'VehicleType'),
    zoneName: pick(raw, 'zonename', 'zoneName', 'ZoneName'),
    suspendedAt: pick(raw, 'suspendedAt', 'SuspendedAt'),
    suspendedUntil: pick(raw, 'suspendedUntil', 'SuspendedUntil') || null,
    companyId: pick(raw, 'companyId', 'CompanyId'),
  };
}

export async function fetchSuspendedDrivers(): Promise<SuspendedDriverRow[]> {
  const json = await postSelector('[GetSuspendedDrivers]', []);
  const parsed = JSON.parse(json.d || '{}') as { dt1?: Record<string, unknown>[] } | Record<string, unknown>[];
  const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed.dt1) ? parsed.dt1 : [];
  return rows
    .filter((r) => r && typeof r === 'object')
    .map((r) => normalizeRow(r as Record<string, unknown>))
    .filter((r) => r.driverId || r.vehicleId);
}

export async function suspendDriver(opts: {
  driverId: string;
  vehicleId: string;
  driverName?: string;
  vehicleNo?: string;
  vehicleType?: string;
  zoneName?: string;
  suspendedUntil?: string;
}): Promise<void> {
  const data: DataParam[] = [
    { name: 'DriverId', value: opts.driverId },
    { name: 'VehicleId', value: opts.vehicleId || opts.driverId },
  ];
  if (opts.driverName) data.push({ name: 'DriverName', value: opts.driverName });
  if (opts.vehicleNo) data.push({ name: 'VehicleNumber', value: opts.vehicleNo });
  if (opts.vehicleType) data.push({ name: 'VehicleType', value: opts.vehicleType });
  if (opts.zoneName) data.push({ name: 'ZoneName', value: opts.zoneName });
  if (opts.suspendedUntil) data.push({ name: 'SuspendedUntil', value: opts.suspendedUntil });
  await postProcessor('[DispatcherKickUsers]', data);
}

export async function unsuspendDriver(driverId: string, vehicleId: string): Promise<void> {
  await postProcessor('[UnsuspendDriver]', [
    { name: 'DriverId', value: driverId },
    { name: 'VehicleId', value: vehicleId || driverId },
  ]);
}

export async function updateSuspensionUntil(
  driverId: string,
  vehicleId: string,
  suspendedUntil: string,
): Promise<void> {
  await postProcessor('[UpdateSuspensionTime]', [
    { name: 'DriverId', value: driverId },
    { name: 'VehicleId', value: vehicleId || driverId },
    { name: 'SuspendedUntil', value: suspendedUntil },
  ]);
}

export async function kickDriver(driverId: string, vehicleId: string): Promise<void> {
  await postProcessor('[KickDriver]', [
    { name: 'DriverId', value: driverId },
    { name: 'VehicleId', value: vehicleId || driverId },
  ]);
}
