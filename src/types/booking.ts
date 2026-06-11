export interface CompanyFeatures {
  tmEnabled: boolean;
  autoDispatch: boolean;
  zoneQueue: boolean;
  directAssign: boolean;
  cardBooking: boolean;
  accEnabled: boolean;
  businessAccounts: boolean;
}

export interface CompanySettings {
  companyId: string;
  companyName: string;
  timezone: string;
  city?: { lat: number; lng: number; name?: string };
  features: CompanyFeatures;
  tmConfig?: {
    councilPercent?: number;
    passengerPercent?: number;
    capAmount?: number;
    hoistUnitCost?: number;
  };
  logoUrl?: string;
}

export interface BusinessAccount {
  id: string;
  name: string;
  code?: string;
  email?: string;
  phone?: string;
  active?: boolean;
}

export interface AccApproval {
  id: string;
  accId?: string;
  claimNumber?: string;
  poNumber?: string;
  clientName?: string;
  managerName?: string;
  fromDate?: string;
  toDate?: string;
  qty?: number;
  qtyLeft?: number;
  status?: string;
}

export interface ZonePolygon {
  id: string;
  name: string;
  paths: { lat: number; lng: number }[];
  color?: string;
}

export interface Tariff {
  id: string;
  name: string;
  flagFall?: number;
  perKm?: number;
  perMinute?: number;
}

export interface DispatcherSession {
  companyId: string;
  companyName: string;
  dispatcherName: string;
  email?: string;
  uid?: string;
  sessionId: string;
}

export interface AccountStatus {
  canAccess: boolean;
  loginBlocked: boolean;
  blockMessage?: string;
  planName?: string;
  billingStatus?: string;
}
