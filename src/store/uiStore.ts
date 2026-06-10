import { create } from 'zustand';
import type { CompanySettings } from '@/types/booking';

export type ModalId =
  | 'createJob'
  | 'jobDetail'
  | 'driverDetail'
  | 'messages'
  | 'closedJobs'
  | 'searchJobs'
  | 'alarms'
  | 'suspended'
  | 'acc'
  | 'emergency'
  | null;

export interface ToastItem {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
}

interface UiStore {
  theme: 'dark' | 'light';
  openModal: ModalId;
  modalJobId: number | null;
  modalDriverId: string | null;
  notificationCount: number;
  toasts: ToastItem[];
  billingBanner: string | null;
  mapTraffic: boolean;
  mapZones: boolean;
  emergency: { driverName: string; vehicle: string; lat: number; lng: number; time: string } | null;
  settings: CompanySettings | null;
  setTheme: (t: 'dark' | 'light') => void;
  openModalWith: (m: ModalId, opts?: { jobId?: number; driverId?: string }) => void;
  closeModal: () => void;
  addToast: (t: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;
  setNotificationCount: (n: number) => void;
  setBillingBanner: (msg: string | null) => void;
  setMapTraffic: (v: boolean) => void;
  setMapZones: (v: boolean) => void;
  setEmergency: (e: UiStore['emergency']) => void;
  setSettings: (s: CompanySettings | null) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  theme: (localStorage.getItem('bw_theme') as 'dark' | 'light') || 'dark',
  openModal: null,
  modalJobId: null,
  modalDriverId: null,
  notificationCount: 0,
  toasts: [],
  billingBanner: null,
  mapTraffic: true,
  mapZones: true,
  emergency: null,
  settings: null,
  setTheme: (t) => {
    localStorage.setItem('bw_theme', t);
    document.documentElement.classList.toggle('dark', t === 'dark');
    set({ theme: t });
  },
  openModalWith: (m, opts) =>
    set({ openModal: m, modalJobId: opts?.jobId ?? null, modalDriverId: opts?.driverId ?? null }),
  closeModal: () => set({ openModal: null, modalJobId: null, modalDriverId: null }),
  addToast: (t) =>
    set((s) => ({
      toasts: [...s.toasts, { ...t, id: `${Date.now()}-${Math.random()}` }].slice(-8),
    })),
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
  setNotificationCount: (n) => set({ notificationCount: n }),
  setBillingBanner: (msg) => set({ billingBanner: msg }),
  setMapTraffic: (v) => set({ mapTraffic: v }),
  setMapZones: (v) => set({ mapZones: v }),
  setEmergency: (e) => set({ emergency: e }),
  setSettings: (s) => set({ settings: s }),
}));
