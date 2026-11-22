export type WirdThemePresetId =
  | 'emerald-editorial'
  | 'mushaf-parchment'
  | 'classic-midnight';

export type WirdLayoutDensity = 'comfortable' | 'compact';
export type WirdCornerStyle = 'refined' | 'soft';

export interface WirdThemePreferences {
  schemaVersion: 2;
  preset: WirdThemePresetId;
  density: WirdLayoutDensity;
  corners: WirdCornerStyle;
}

export interface WirdThemePresetMeta {
  id: WirdThemePresetId;
  nameAr: string;
  taglineAr: string;
  inspirationAr: string;
  day: {
    bg: string;
    surface: string;
    primary: string;
    accent: string;
    ink: string;
    themeColor: string;
  };
  night: {
    bg: string;
    surface: string;
    primary: string;
    accent: string;
    ink: string;
    themeColor: string;
  };
}

export const WIRD_THEME_PREFS_STORAGE_KEY = 'wird:ui-theme-prefs:v2';

export const DEFAULT_THEME_PREFERENCES: WirdThemePreferences = {
  schemaVersion: 2,
  preset: 'emerald-editorial',
  density: 'comfortable',
  corners: 'refined',
};

export const WIRD_THEME_PRESETS: readonly WirdThemePresetMeta[] = [
  {
    id: 'emerald-editorial',
    nameAr: 'الزمرد والعاج التحريري',
    taglineAr: 'تباين هادئ بالزمرد العميق والعاج الدافئ نهاراً، وغابي فحمي مريح ليلاً',
    inspirationAr: 'هوية WIRD V2 المعتمدة · مستلهمة من هدوء Noor UI وShadcnStore',
    day: {
      bg: '#F8F5EE',
      surface: '#FFFFFF',
      primary: '#14453D',
      accent: '#B58D34',
      ink: '#13221F',
      themeColor: '#14453D',
    },
    night: {
      bg: '#0C1412',
      surface: '#131F1C',
      primary: '#226358',
      accent: '#D4B475',
      ink: '#EFECE4',
      themeColor: '#0C1412',
    },
  },
  {
    id: 'mushaf-parchment',
    nameAr: 'رقّ المصحف الهادئ',
    taglineAr: 'ورق دافئ مانع للإجهاد لجلسات التلاوة الطويلة والتدبر والسيرة',
    inspirationAr: 'مستلهمة من لوحات القراءة الورقية الدافئة في Ummah Library',
    day: {
      bg: '#F4EDE0',
      surface: '#FBF8F1',
      primary: '#2D4A3E',
      accent: '#9E7432',
      ink: '#261E16',
      themeColor: '#2D4A3E',
    },
    night: {
      bg: '#141210',
      surface: '#1D1A17',
      primary: '#386353',
      accent: '#CFA56A',
      ink: '#F1EAE0',
      themeColor: '#141210',
    },
  },
  {
    id: 'classic-midnight',
    nameAr: 'سكون الليل الكلاسيكي',
    taglineAr: 'هوية وِرد الأصلية بالكحلي الليلي والذهب الكهرماني مع تباين محسن',
    inspirationAr: 'استمرارية هوية WIRD الكلاسيكية المعتادة',
    day: {
      bg: '#F9F6EE',
      surface: '#FFFFFF',
      primary: '#1C4E46',
      accent: '#C59B27',
      ink: '#142421',
      themeColor: '#1C4E46',
    },
    night: {
      bg: '#0B132B',
      surface: '#111F36',
      primary: '#1E4A47',
      accent: '#E0A96D',
      ink: '#F5F1E8',
      themeColor: '#0B132B',
    },
  },
] as const;

const VALID_PRESETS = new Set<WirdThemePresetId>(
  WIRD_THEME_PRESETS.map((preset) => preset.id)
);

type ThemePrefsListener = (prefs: WirdThemePreferences) => void;
const listeners = new Set<ThemePrefsListener>();

export function getThemePresetMeta(id: WirdThemePresetId): WirdThemePresetMeta {
  return (
    WIRD_THEME_PRESETS.find((preset) => preset.id === id) ||
    WIRD_THEME_PRESETS[0]
  );
}

export function normalizeThemePreferences(
  candidate: unknown
): WirdThemePreferences {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return { ...DEFAULT_THEME_PREFERENCES };
  }
  const raw = candidate as Record<string, unknown>;
  const preset: WirdThemePresetId =
    typeof raw.preset === 'string' &&
    VALID_PRESETS.has(raw.preset as WirdThemePresetId)
      ? (raw.preset as WirdThemePresetId)
      : DEFAULT_THEME_PREFERENCES.preset;
  const density: WirdLayoutDensity =
    raw.density === 'compact' ? 'compact' : 'comfortable';
  const corners: WirdCornerStyle =
    raw.corners === 'soft' ? 'soft' : 'refined';

  return {
    schemaVersion: 2,
    preset,
    density,
    corners,
  };
}

export function loadThemePreferences(): WirdThemePreferences {
  try {
    if (typeof localStorage === 'undefined') {
      return { ...DEFAULT_THEME_PREFERENCES };
    }
    const raw = localStorage.getItem(WIRD_THEME_PREFS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_THEME_PREFERENCES };
    return normalizeThemePreferences(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_THEME_PREFERENCES };
  }
}

export function saveThemePreferences(
  partial: Partial<Omit<WirdThemePreferences, 'schemaVersion'>>
): WirdThemePreferences {
  const current = loadThemePreferences();
  const next = normalizeThemePreferences({ ...current, ...partial });
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(WIRD_THEME_PREFS_STORAGE_KEY, JSON.stringify(next));
    }
  } catch {
    // Device-local visual preferences degrade safely when storage is restricted.
  }
  for (const listener of listeners) {
    listener(next);
  }
  return next;
}

export function resetThemePreferences(): WirdThemePreferences {
  return saveThemePreferences({
    preset: DEFAULT_THEME_PREFERENCES.preset,
    density: DEFAULT_THEME_PREFERENCES.density,
    corners: DEFAULT_THEME_PREFERENCES.corners,
  });
}

export function subscribeThemePreferences(
  listener: ThemePrefsListener
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function applyThemePreferencesToDocument(
  prefs: WirdThemePreferences,
  mode: 'light' | 'dark'
): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-wird-theme', prefs.preset);
  root.setAttribute('data-wird-density', prefs.density);
  root.setAttribute('data-wird-corners', prefs.corners);

  if (mode === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  const presetMeta = getThemePresetMeta(prefs.preset);
  const themeColor =
    mode === 'dark' ? presetMeta.night.themeColor : presetMeta.day.themeColor;
  const metaTag = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]'
  );
  if (metaTag) {
    metaTag.content = themeColor;
  }
}
