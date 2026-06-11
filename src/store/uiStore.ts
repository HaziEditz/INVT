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
  category?: NotificationCategory;
}

export type NotificationCategory =
  | 'job_created'
  | 'job_cancelled'
  | 'job_updated'
  | 'driver_online'
  | 'new_booking'
  | 'general';

export interface NotificationItem {
  id: string;
  type: ToastItem['type'];
  title: string;
  message?: string;
  category: NotificationCategory;
  read: boolean;
  createdAt: number;
}

function inferCategory(t: Omit<ToastItem, 'id'>): NotificationCategory {
  if (t.category) return t.category;
  const hay = `${t.title} ${t.message ?? ''}`.toLowerCase();
  if (hay.includes('cancel')) return 'job_cancelled';
  if (hay.includes('updated') || hay.includes('edit')) return 'job_updated';
  if (hay.includes('booked') || hay.includes('created') || hay.includes('job #')) {
    if (hay.includes('new job')) return 'new_booking';
    return 'job_created';
  }
  if (hay.includes('driver') && hay.includes('online')) return 'driver_online';
  if (hay.includes('app') || hay.includes('web') || hay.includes('hail')) return 'new_booking';
  return 'general';
}

interface UiStore {
  theme: DispatchThemeId;
  openModal: ModalId;
  modalJobId: number | null;
  modalDriverId: string | null;
  notificationCount: number;
  notifications: NotificationItem[];
  toasts: ToastItem[];
  routeDrawing: boolean;
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
  dismissNotification: (id: string) => void;
  clearAllNotifications: () => void;
  setRouteDrawing: (v: boolean) => void;
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
  notifications: [],
  toasts: [],
  routeDrawing: false,
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
  addToast: (t) => {
    const id = `${Date.now()}-${Math.random()}`;
    const category = inferCategory(t);
    const notification: NotificationItem = {
      id,
      type: t.type,
      title: t.title,
      message: t.message,
      category,
      read: false,
      createdAt: Date.now(),
    };
    set((s) => ({
      notifications: [notification, ...s.notifications].slice(0, 100),
      toasts: [...s.toasts, { ...t, id, category }].slice(-2),
      notificationCount: s.notificationCount + 1,
    }));
    setTimeout(() => {
      get().removeToast(id);
    }, 3000);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
  dismissNotification: (id) =>
    set((s) => {
      const target = s.notifications.find((n) => n.id === id);
      const next = s.notifications.filter((n) => n.id !== id);
      return {
        notifications: next,
        notificationCount: Math.max(0, s.notificationCount - (target && !target.read ? 1 : 0)),
      };
    }),
  clearAllNotifications: () => set({ notifications: [], notificationCount: 0 }),
  setRouteDrawing: (v) => set({ routeDrawing: v }),
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
