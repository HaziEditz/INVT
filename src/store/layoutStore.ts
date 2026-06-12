import { create } from 'zustand';

export const DEFAULT_LEFT_WIDTH = 380;
export const DEFAULT_RIGHT_WIDTH = 460;
const MIN_LEFT = 280;
const MIN_RIGHT = 320;
const MIN_MAP = 200;
const MIN_PANEL = 200;
const MAX_PANEL = 800;
const LEGACY_STORAGE_KEY = 'bw_dispatch_panel_sizes';

export interface PanelSizes {
  left: number;
  right: number;
}

interface SavedLayout extends PanelSizes {
  locked?: boolean;
}

function layoutKey(dispatcherUid: string) {
  return `bw_dispatch_layout_${dispatcherUid}`;
}

function sanitizeWidth(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < MIN_PANEL || n > MAX_PANEL) return fallback;
  return Math.round(n);
}

function readSavedLayout(dispatcherUid: string): SavedLayout {
  const defaults: SavedLayout = {
    left: DEFAULT_LEFT_WIDTH,
    right: DEFAULT_RIGHT_WIDTH,
    locked: false,
  };

  try {
    let raw = localStorage.getItem(layoutKey(dispatcherUid));
    if (!raw) raw = localStorage.getItem(LEGACY_STORAGE_KEY);

    if (!raw) {
      console.log('[Layout] loaded from localStorage:', null);
      console.log('[Layout] applying widths:', defaults.left, defaults.right);
      return defaults;
    }

    const parsed = JSON.parse(raw) as Partial<SavedLayout>;
    const leftWidth = sanitizeWidth(parsed.left, DEFAULT_LEFT_WIDTH);
    const rightWidth = sanitizeWidth(parsed.right, DEFAULT_RIGHT_WIDTH);
    const savedLayout: SavedLayout = {
      left: leftWidth,
      right: rightWidth,
      locked: !!parsed.locked,
    };

    console.log('[Layout] loaded from localStorage:', savedLayout);
    console.log('[Layout] applying widths:', leftWidth, rightWidth);

    if (leftWidth !== Number(parsed.left) || rightWidth !== Number(parsed.right)) {
      writeSavedLayout(dispatcherUid, savedLayout);
    }

    return savedLayout;
  } catch (err) {
    console.warn('[Layout] corrupt localStorage, using defaults', err);
    console.log('[Layout] applying widths:', defaults.left, defaults.right);
    writeSavedLayout(dispatcherUid, defaults);
    return defaults;
  }
}

function writeSavedLayout(dispatcherUid: string, data: SavedLayout) {
  localStorage.setItem(layoutKey(dispatcherUid), JSON.stringify(data));
}

/** Clamp panel widths to fit container without mutating saved values in store. */
export function clampPanelSizes(next: PanelSizes, containerWidth: number): PanelSizes {
  if (!Number.isFinite(containerWidth) || containerWidth < MIN_LEFT + MIN_RIGHT + MIN_MAP) {
    return next;
  }
  const maxLeft = Math.max(MIN_LEFT, containerWidth - next.right - MIN_MAP);
  const maxRight = Math.max(MIN_RIGHT, containerWidth - next.left - MIN_MAP);
  return {
    left: Math.min(Math.max(MIN_LEFT, next.left), maxLeft),
    right: Math.min(Math.max(MIN_RIGHT, next.right), maxRight),
  };
}

function getInitialState() {
  const dispatcherUid =
    typeof localStorage !== 'undefined' ? localStorage.getItem('bw_session_id') || 'default' : 'default';
  const saved = readSavedLayout(dispatcherUid);
  return {
    dispatcherUid,
    left: saved.left,
    right: saved.right,
    locked: saved.locked ?? false,
    containerWidth: 0,
  };
}

interface LayoutStore {
  dispatcherUid: string;
  left: number;
  right: number;
  locked: boolean;
  containerWidth: number;
  setDispatcherUid: (uid: string) => void;
  setContainerWidth: (w: number) => void;
  resizeLeft: (delta: number) => void;
  resizeRight: (delta: number) => void;
  saveLayout: () => void;
  resetLayout: () => void;
  toggleLayoutLock: () => void;
}

export const useLayoutStore = create<LayoutStore>((set, get) => ({
  ...getInitialState(),

  setDispatcherUid: (uid) => {
    if (get().dispatcherUid === uid) return;
    const saved = readSavedLayout(uid);
    set({
      dispatcherUid: uid,
      left: saved.left,
      right: saved.right,
      locked: saved.locked ?? false,
    });
  },

  setContainerWidth: (w) => {
    if (!Number.isFinite(w) || w < MIN_LEFT + MIN_RIGHT + MIN_MAP) return;
    const current = get().containerWidth;
    if (Math.abs(current - w) < 1) return;
    set({ containerWidth: w });
  },

  resizeLeft: (delta) => {
    const s = get();
    if (s.locked) return;
    const next = clampPanelSizes({ left: s.left + delta, right: s.right }, s.containerWidth);
    set({ left: next.left, right: next.right });
  },

  resizeRight: (delta) => {
    const s = get();
    if (s.locked) return;
    const next = clampPanelSizes({ left: s.left, right: s.right - delta }, s.containerWidth);
    set({ left: next.left, right: next.right });
  },

  saveLayout: () => {
    const s = get();
    writeSavedLayout(s.dispatcherUid, { left: s.left, right: s.right, locked: s.locked });
  },

  resetLayout: () => {
    const s = get();
    const next = {
      left: DEFAULT_LEFT_WIDTH,
      right: DEFAULT_RIGHT_WIDTH,
    };
    set(next);
    writeSavedLayout(s.dispatcherUid, { ...next, locked: s.locked });
  },

  toggleLayoutLock: () => {
    const s = get();
    const locked = !s.locked;
    set({ locked });
    writeSavedLayout(s.dispatcherUid, { left: s.left, right: s.right, locked });
  },
}));
