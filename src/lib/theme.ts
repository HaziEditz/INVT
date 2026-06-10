export type DispatchThemeId = 'dark' | 'dark-blue' | 'light';

export const THEME_ORDER: DispatchThemeId[] = ['dark', 'dark-blue', 'light'];

export const THEME_LABELS: Record<DispatchThemeId, string> = {
  dark: 'Dark',
  'dark-blue': 'Dark Blue',
  light: 'Light',
};

const STORAGE_KEY = 'bw_theme';

export function nextTheme(current: DispatchThemeId): DispatchThemeId {
  const i = THEME_ORDER.indexOf(current);
  return THEME_ORDER[(i + 1) % THEME_ORDER.length];
}

export function parseStoredTheme(raw: string | null): DispatchThemeId {
  if (raw === 'dark-blue' || raw === 'light' || raw === 'dark') return raw;
  return 'dark';
}

export function applyThemeToDocument(theme: DispatchThemeId) {
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.classList.toggle('light', theme === 'light');
  document.documentElement.classList.toggle('dark', theme !== 'light');
}

export function initThemeFromStorage(): DispatchThemeId {
  const theme = parseStoredTheme(localStorage.getItem(STORAGE_KEY));
  applyThemeToDocument(theme);
  return theme;
}

export function persistTheme(theme: DispatchThemeId) {
  localStorage.setItem(STORAGE_KEY, theme);
  applyThemeToDocument(theme);
}
