import { create } from 'zustand';

export const DEFAULT_LEFT_WIDTH = 380;
export const DEFAULT_RIGHT_WIDTH = 460;
const MIN_LEFT = 280;
const MIN_RIGHT = 320;
const MIN_MAP = 200;

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

function readSavedLayout(dispatcherUid: string): SavedLayout {
  try {
    const raw = localStorage.getItem(layoutKey(dispatcherUid));
    if (!raw) {
      return { left: DEFAULT_LEFT_WIDTH, right: DEFAULT_RIGHT_WIDTH, locked: false };
    }
    const parsed = JSON.parse(raw) as Partial<SavedLayout>;
    return {
      left: Math.max(MIN_LEFT, Number(parsed.left) || DEFAULT_LEFT_WIDTH),
      right: Math.max(MIN_RIGHT, Number(parsed.right) || DEFAULT_RIGHT_WIDTH),
      locked: !!parsed.locked,
    };
  } catch {
    return { left: DEFAULT_LEFT_WIDTH, right: DEFAULT_RIGHT_WIDTH, locked: false };
  }
}

function writeSavedLayout(dispatcherUid: string, data: SavedLayout) {
  localStorage.setItem(layoutKey(dispatcherUid), JSON.stringify(data));
}

function clampSizes(next: PanelSizes, containerWidth: number): PanelSizes {
  const maxLeft = Math.max(MIN_LEFT, containerWidth - next.right - MIN_MAP);
  const maxRight = Math.max(MIN_RIGHT, containerWidth - next.left - MIN_MAP);
  return {
    left: Math.min(Math.max(MIN_LEFT, next.left), maxLeft),
    right: Math.min(Math.max(MIN_RIGHT, next.right), maxRight),
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
  dispatcherUid: localStorage.getItem('bw_session_id') || 'default',
  left: DEFAULT_LEFT_WIDTH,
  right: DEFAULT_RIGHT_WIDTH,
  locked: false,
  containerWidth: 1200,

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
    const s = get();
    set({
      containerWidth: w,
      ...clampSizes({ left: s.left, right: s.right }, w),
    });
  },

  resizeLeft: (delta) => {
    const s = get();
    if (s.locked) return;
    const next = clampSizes({ left: s.left + delta, right: s.right }, s.containerWidth);
    set(next);
  },

  resizeRight: (delta) => {
    const s = get();
    if (s.locked) return;
    const next = clampSizes({ left: s.left, right: s.right - delta }, s.containerWidth);
    set(next);
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

// Load saved layout on module init
const initialUid = localStorage.getItem('bw_session_id') || 'default';
const initialSaved = readSavedLayout(initialUid);
useLayoutStore.setState({
  dispatcherUid: initialUid,
  left: initialSaved.left,
  right: initialSaved.right,
  locked: initialSaved.locked ?? false,
});
