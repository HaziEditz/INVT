import { create } from 'zustand';
import type { CompanySettings } from '@/types/booking';
import {
  type DispatchThemeId,
  initThemeFromStorage,
  nextTheme,
  persistTheme,
} from '@/lib/theme';

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
  theme: DispatchThemeId;
  openModal: ModalId;
  modalJobId: number | null;
  modalDriverId: string | null;
  notificationCount: number;
  toasts: ToastItem[];
  billingBanner: string | null;
  mapTraffic: boolean;
  mapZones: boolean;
  mapVisible: boolean;
  mapFullscreen: boolean;
  mapPoppedOut: boolean;
  emergency: { driverName: string; vehicle: string; lat: number; lng: number; time: string } | null;
  settings: CompanySettings | null;
  routePreview: { pick: { lat: number; lng: number }; drop?: { lat: number; lng: number } } | null;
  mapInstance: google.maps.Map | null;
  setRoutePreview: (r: UiStore['routePreview']) => void;
  setMapInstance: (map: google.maps.Map | null) => void;
  setTheme: (t: DispatchThemeId) => void;
  cycleTheme: () => void;
  openModalWith: (m: ModalId, opts?: { jobId?: number; driverId?: string }) => void;
  closeModal: () => void;
  addToast: (t: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;
  setNotificationCount: (n: number) => void;
  setBillingBanner: (msg: string | null) => void;
  setMapTraffic: (v: boolean) => void;
  setMapZones: (v: boolean) => void;
  setMapVisible: (v: boolean) => void;
  setMapFullscreen: (v: boolean) => void;
  setMapPoppedOut: (v: boolean) => void;
  setEmergency: (e: UiStore['emergency']) => void;
  setSettings: (s: CompanySettings | null) => void;
}

export const useUiStore = create<UiStore>((set, get) => ({
  theme: initThemeFromStorage(),
  openModal: null,
  modalJobId: null,
  modalDriverId: null,
  notificationCount: 0,
  toasts: [],
  billingBanner: null,
  mapTraffic: true,
  mapZones: true,
  mapVisible: localStorage.getItem('bw_map_visible') !== 'false',
  mapFullscreen: false,
  mapPoppedOut: false,
  emergency: null,
  settings: null,
  routePreview: null,
  mapInstance: null,
  setTheme: (t) => {
    persistTheme(t);
    set({ theme: t });
  },
  cycleTheme: () => {
    const t = nextTheme(get().theme);
    persistTheme(t);
    set({ theme: t });
  },
  openModalWith: (m, opts) =>
    set({ openModal: m, modalJobId: opts?.jobId ?? null, modalDriverId: opts?.driverId ?? null }),
  closeModal: () =>
    set({ openModal: null, modalJobId: null, modalDriverId: null, routePreview: null }),
  addToast: (t) =>
    set((s) => ({
      toasts: [...s.toasts, { ...t, id: `${Date.now()}-${Math.random()}` }].slice(-8),
    })),
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
  setNotificationCount: (n) => set({ notificationCount: n }),
  setBillingBanner: (msg) => set({ billingBanner: msg }),
  setMapTraffic: (v) => set({ mapTraffic: v }),
  setMapZones: (v) => set({ mapZones: v }),
  setMapVisible: (v) => {
    localStorage.setItem('bw_map_visible', v ? 'true' : 'false');
    set({ mapVisible: v });
  },
  setMapFullscreen: (v) => set({ mapFullscreen: v }),
  setMapPoppedOut: (v) => set({ mapPoppedOut: v }),
  setEmergency: (e) => set({ emergency: e }),
  setSettings: (s) => set({ settings: s }),
  setRoutePreview: (r) => set({ routePreview: r }),
  setMapInstance: (map) => set({ mapInstance: map }),
}));
