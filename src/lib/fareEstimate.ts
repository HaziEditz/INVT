import {
  isForbiddenPlaceholderTariffName,
} from '@/lib/tariffGuard';

export interface TariffRate {
  id: string;
  name: string;
  startPrice: number;
  distanceRate: number;
  waitingRate: number;
  minimumFare: number;
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Parse Owner Panel / Firebase tariff node. Keep aliases in sync with TARIFF_PARSER.md and INVT-APP2/lib/parseTariffRecord.ts. */
export function parseTariffRecord(key: string, rec: Record<string, unknown>): TariffRate | null {
  const name = String(rec.TariffName ?? rec.tariffName ?? rec.name ?? rec.zoneName ?? '').trim();
  if (!name || isForbiddenPlaceholderTariffName(name)) return null;
  const id = String(rec.Id ?? rec.id ?? key);
  return {
    id,
    name,
    startPrice: parseFloat(String(rec.StartPrice ?? rec.baseFare ?? rec.startPrice ?? 0)) || 0,
    distanceRate: parseFloat(String(rec.DistanceRate ?? rec.pricePerKm ?? rec.perKm ?? 0)) || 0,
    waitingRate: parseFloat(String(rec.WaitingRate ?? rec.waitingRate ?? rec.waitRate ?? 0)) || 0,
    minimumFare: parseFloat(String(rec.MinimumFare ?? rec.minimumFare ?? 0)) || 0,
  };
}

export function estimateFare(km: number, tariff: TariffRate): number {
  const raw = tariff.startPrice + km * tariff.distanceRate;
  return Math.max(raw, tariff.minimumFare || 0);
}

export function formatFare(amount: number): string {
  return `Est. fare: ~$${amount.toFixed(2)}`;
}
