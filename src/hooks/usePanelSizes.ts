import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'bw_dispatch_panel_sizes';
export const DEFAULT_LEFT_WIDTH = 380;
export const DEFAULT_RIGHT_WIDTH = 460;
const MIN_LEFT = 280;
const MIN_RIGHT = 320;
const MIN_MAP = 200;

export interface PanelSizes {
  left: number;
  right: number;
}

function readSizes(): PanelSizes {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { left: DEFAULT_LEFT_WIDTH, right: DEFAULT_RIGHT_WIDTH };
    const parsed = JSON.parse(raw) as Partial<PanelSizes>;
    return {
      left: Math.max(MIN_LEFT, Number(parsed.left) || DEFAULT_LEFT_WIDTH),
      right: Math.max(MIN_RIGHT, Number(parsed.right) || DEFAULT_RIGHT_WIDTH),
    };
  } catch {
    return { left: DEFAULT_LEFT_WIDTH, right: DEFAULT_RIGHT_WIDTH };
  }
}

function saveSizes(sizes: PanelSizes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sizes));
}

export function usePanelSizes(containerWidth: number) {
  const [sizes, setSizes] = useState<PanelSizes>(readSizes);

  useEffect(() => {
    saveSizes(sizes);
  }, [sizes]);

  const clampSizes = useCallback(
    (next: PanelSizes): PanelSizes => {
      const maxLeft = Math.max(MIN_LEFT, containerWidth - next.right - MIN_MAP);
      const maxRight = Math.max(MIN_RIGHT, containerWidth - next.left - MIN_MAP);
      return {
        left: Math.min(Math.max(MIN_LEFT, next.left), maxLeft),
        right: Math.min(Math.max(MIN_RIGHT, next.right), maxRight),
      };
    },
    [containerWidth]
  );

  const resizeLeft = useCallback(
    (delta: number) => {
      setSizes((prev) => clampSizes({ ...prev, left: prev.left + delta }));
    },
    [clampSizes]
  );

  const resizeRight = useCallback(
    (delta: number) => {
      setSizes((prev) => clampSizes({ ...prev, right: prev.right - delta }));
    },
    [clampSizes]
  );

  const reset = useCallback(() => {
    setSizes({ left: DEFAULT_LEFT_WIDTH, right: DEFAULT_RIGHT_WIDTH });
  }, []);

  return { sizes, resizeLeft, resizeRight, reset };
}
