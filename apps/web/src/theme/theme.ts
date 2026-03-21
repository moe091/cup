export const APP_THEME_STORAGE_KEY = 'cup.theme';

export const APP_THEME_IDS = ['hearth-night', 'cabin-moss', 'candle-plum', 'ember-slate', 'dark'] as const;

export type AppThemeId = (typeof APP_THEME_IDS)[number];

export const DEFAULT_APP_THEME: AppThemeId = 'ember-slate';

export const APP_THEME_OPTIONS: Array<{ id: AppThemeId; label: string }> = [
  { id: 'hearth-night', label: 'Hearth Night' },
  { id: 'cabin-moss', label: 'Cabin Moss' },
  { id: 'candle-plum', label: 'Candle Plum' },
  { id: 'ember-slate', label: 'Ember Slate' },
];

function isAppThemeId(value: string): value is AppThemeId {
  return APP_THEME_IDS.includes(value as AppThemeId);
}

export function setAppTheme(themeId: AppThemeId): void {
  document.documentElement.dataset.theme = themeId;
  try {
    window.localStorage.setItem(APP_THEME_STORAGE_KEY, themeId);
  } catch {
    // no-op: localStorage may be unavailable
  }
}

export function getStoredAppTheme(): AppThemeId | null {
  try {
    const stored = window.localStorage.getItem(APP_THEME_STORAGE_KEY);
    if (stored && isAppThemeId(stored)) {
      return stored;
    }
  } catch {
    // no-op: localStorage may be unavailable
  }

  return null;
}

export function initializeAppTheme(): AppThemeId {
  const storedTheme = getStoredAppTheme();
  const themeToApply = storedTheme ?? DEFAULT_APP_THEME;
  setAppTheme(themeToApply);
  return themeToApply;
}
