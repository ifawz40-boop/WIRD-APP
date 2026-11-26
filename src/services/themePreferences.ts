export type WirdDesignId = 'design-a' | 'design-b';
export type WirdAppearanceMode = 'light' | 'dark';

/** Backward-compatible alias for legacy imports. */
export type WirdThemePresetId = WirdDesignId;

export type WirdLayoutDensity = 'comfortable' | 'compact';
export type WirdCornerStyle = 'refined' | 'soft';
export type WirdPaperTone = 'default' | 'madinah-cream' | 'sepia-warm';
export type WirdQuranFontFamily = 'amiri-quran' | 'scheherazade';

export interface WirdThemePreferences {
  schemaVersion: 3;
  design: WirdDesignId;
  /** Synchronized mirror of `design` for backward compatibility. */
  preset: WirdDesignId;
  density: WirdLayoutDensity;
  corners: WirdCornerStyle;
  /** Reading paper tone inspired by Ayah & Apple Books (Madinah Cream / Warm Sepia). */
  paperTone?: WirdPaperTone;
  /** Selectable self-hosted Quranic typeface family. */
  quranFont?: WirdQuranFontFamily;
}

export interface WirdVariantPalette {
  labelAr: string;
  descriptionAr: string;
  bg: string;
  surface: string;
  surfaceMuted: string;
  primary: string;
  accent: string;
  ink: string;
  themeColor: string;
  previewImage: string;
  emblemImage: string;
}

export interface WirdDesignMeta {
  id: WirdDesignId;
  code: 'A' | 'B';
  nameAr: string;
  shortNameAr: string;
  taglineAr: string;
  characterAr: string;
  day: WirdVariantPalette;
  night: WirdVariantPalette;
}

/** Backward-compatible alias. */
export type WirdThemePresetMeta = WirdDesignMeta;

export const WIRD_THEME_PREFS_STORAGE_KEY = 'wird:ui-theme-prefs:v2';
export const WIRD_APPEARANCE_MODE_STORAGE_KEY = 'wird:ui-appearance-mode:v1';

export const DEFAULT_APPEARANCE_MODE: WirdAppearanceMode = 'light';

export const DEFAULT_THEME_PREFERENCES: WirdThemePreferences = {
  schemaVersion: 3,
  design: 'design-a',
  preset: 'design-a',
  density: 'comfortable',
  corners: 'refined',
  paperTone: 'default',
  quranFont: 'amiri-quran',
};

export const WIRD_DESIGNS: readonly WirdDesignMeta[] = [
  {
    id: 'design-a',
    code: 'A',
    nameAr: 'التصميم A — الأندلسي التراثي',
    shortNameAr: 'التصميم A',
    taglineAr:
      'دفء المخطوطات التراثية نهاراً وعمق الزمرد الأندلسي ليلاً بلمسات ذهبية هادئة',
    characterAr: 'تراثي أندلسي · رقّ دافئ وزمرد غابي',
    day: {
      labelAr: 'نهاري تراثي دافئ',
      descriptionAr: 'ورق كريمي دافئ مع زمرد عميق ولمسات نحاسية هادئة',
      bg: '#FAF6EE',
      surface: '#FFFFFF',
      surfaceMuted: '#F2ECE0',
      primary: '#06291F',
      accent: '#A67C2E',
      ink: '#181814',
      themeColor: '#06291F',
      previewImage: '/assets/aistudio/screen__10__7bd02a79.png',
      emblemImage: '/assets/aistudio/screen__67__f2b24ad2.png',
    },
    night: {
      labelAr: 'ليلي أندلسي زمردي',
      descriptionAr: 'زمرد ليلي عميق بلا وهج مع ذهب دافئ وحروف عاجية مريحة',
      bg: '#06120E',
      surface: '#0B1D17',
      surfaceMuted: '#081712',
      primary: '#145240',
      accent: '#DFB86C',
      ink: '#F3EFE6',
      themeColor: '#06120E',
      previewImage: '/assets/aistudio/screen__28__8cd915c9.png',
      emblemImage: '/assets/aistudio/screen__69__cf31ae3c.png',
    },
  },
  {
    id: 'design-b',
    code: 'B',
    nameAr: 'التصميم B — العصري والأسحار',
    shortNameAr: 'التصميم B',
    taglineAr:
      'صفاء عصري ناصع نهاراً وكحلي الأسحار العميق ليلاً بتباين هادئ',
    characterAr: 'عصري هادئ · ناصع نهاراً وكحلي عميق ليلاً',
    day: {
      labelAr: 'نهاري عصري ناصع',
      descriptionAr: 'خلفية رخامية صافية وبطاقات ناصعة وحدود هندسية دقيقة',
      bg: '#F8FAF9',
      surface: '#FFFFFF',
      surfaceMuted: '#EEF3F1',
      primary: '#0B382C',
      accent: '#966F26',
      ink: '#111917',
      themeColor: '#0B382C',
      previewImage: '/assets/aistudio/screen__40__0ba4301f.png',
      emblemImage: '/assets/aistudio/screen__68__7395aa77.png',
    },
    night: {
      labelAr: 'ليلي الأسحار الكحلي الملكي',
      descriptionAr: 'كحلي ليلي عميق لقيام الأسحار مع كهرمان هادئ وتباين مريح',
      bg: '#081019',
      surface: '#0E1926',
      surfaceMuted: '#0A141F',
      primary: '#1B436B',
      accent: '#DDA955',
      ink: '#EEF2F6',
      themeColor: '#081019',
      previewImage: '/assets/aistudio/screen__42__2f2353c4.png',
      emblemImage: '/assets/aistudio/screen__70__6ddee078.png',
    },
  },
] as const;

/** Backward-compatible export alias. */
export const WIRD_THEME_PRESETS = WIRD_DESIGNS;

const VALID_DESIGNS = new Set<WirdDesignId>(WIRD_DESIGNS.map((d) => d.id));

type ThemePrefsListener = (prefs: WirdThemePreferences) => void;
const listeners = new Set<ThemePrefsListener>();

export function mapLegacyPresetToDesign(value: unknown): WirdDesignId | null {
  if (typeof value !== 'string') return null;
  if (VALID_DESIGNS.has(value as WirdDesignId)) {
    return value as WirdDesignId;
  }
  if (value === 'emerald-editorial' || value === 'mushaf-parchment') {
    return 'design-a';
  }
  if (value === 'classic-midnight') {
    return 'design-b';
  }
  return null;
}

export function getDesignMeta(id: WirdDesignId): WirdDesignMeta {
  return WIRD_DESIGNS.find((design) => design.id === id) || WIRD_DESIGNS[0];
}

/** Backward-compatible alias for `getDesignMeta`. */
export const getThemePresetMeta = getDesignMeta;

export function getActiveVariantSummary(
  designId: WirdDesignId,
  mode: WirdAppearanceMode
): {
  design: WirdDesignMeta;
  palette: WirdVariantPalette;
  combinedLabelAr: string;
} {
  const design = getDesignMeta(designId);
  const palette = mode === 'dark' ? design.night : design.day;
  return {
    design,
    palette,
    combinedLabelAr: `${design.shortNameAr} · ${palette.labelAr}`,
  };
}

export function normalizeThemePreferences(
  candidate: unknown
): WirdThemePreferences {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return { ...DEFAULT_THEME_PREFERENCES };
  }
  const raw = candidate as Record<string, unknown>;
  const resolvedDesign =
    mapLegacyPresetToDesign(raw.design) ??
    mapLegacyPresetToDesign(raw.preset) ??
    DEFAULT_THEME_PREFERENCES.design;

  const density: WirdLayoutDensity =
    raw.density === 'compact' ? 'compact' : 'comfortable';
  const corners: WirdCornerStyle =
    raw.corners === 'soft' ? 'soft' : 'refined';
  const paperTone: WirdPaperTone =
    raw.paperTone === 'madinah-cream' || raw.paperTone === 'sepia-warm'
      ? raw.paperTone
      : 'default';
  const quranFont: WirdQuranFontFamily =
    raw.quranFont === 'scheherazade' ? 'scheherazade' : 'amiri-quran';

  return {
    schemaVersion: 3,
    design: resolvedDesign,
    preset: resolvedDesign,
    density,
    corners,
    paperTone,
    quranFont,
  };
}

export function loadSavedAppearanceMode(
  fallback: WirdAppearanceMode = DEFAULT_APPEARANCE_MODE
): WirdAppearanceMode {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const saved = localStorage.getItem(WIRD_APPEARANCE_MODE_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // Ignore restricted storage errors.
  }
  return fallback;
}

export function saveAppearanceModeLocal(mode: WirdAppearanceMode): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(WIRD_APPEARANCE_MODE_STORAGE_KEY, mode);
    }
  } catch {
    // Ignore restricted storage errors.
  }
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
  const nextDesign =
    partial.design !== undefined
      ? partial.design
      : partial.preset !== undefined
      ? partial.preset
      : current.design;
  const next = normalizeThemePreferences({
    ...current,
    ...partial,
    design: nextDesign,
    preset: nextDesign,
  });
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
  saveAppearanceModeLocal(DEFAULT_APPEARANCE_MODE);
  return saveThemePreferences({
    design: DEFAULT_THEME_PREFERENCES.design,
    preset: DEFAULT_THEME_PREFERENCES.preset,
    density: DEFAULT_THEME_PREFERENCES.density,
    corners: DEFAULT_THEME_PREFERENCES.corners,
    paperTone: DEFAULT_THEME_PREFERENCES.paperTone,
    quranFont: DEFAULT_THEME_PREFERENCES.quranFont,
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
  mode: WirdAppearanceMode
): void {
  saveAppearanceModeLocal(mode);
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-wird-design', prefs.design);
  root.setAttribute('data-wird-theme', prefs.design);
  root.setAttribute('data-wird-mode', mode);
  root.setAttribute('data-wird-density', prefs.density);
  root.setAttribute('data-wird-corners', prefs.corners);
  root.setAttribute('data-wird-paper', prefs.paperTone || 'default');
  root.setAttribute('data-wird-quran-font', prefs.quranFont || 'amiri-quran');

  if (mode === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  const designMeta = getDesignMeta(prefs.design);
  const themeColor =
    mode === 'dark' ? designMeta.night.themeColor : designMeta.day.themeColor;
  const metaTag = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]'
  );
  if (metaTag) {
    metaTag.content = themeColor;
  }
}
