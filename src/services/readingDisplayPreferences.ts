export type ReadingViewId = 'library' | 'revision' | 'tests' | 'ruqyah';
export type ReadingSpacing = 'compact' | 'comfortable' | 'relaxed';
export type ReadingPageWidth = 'comfortable' | 'wide' | 'full';

export interface ReadingDisplayPreferences {
  uiScale: number;
  fontSize: number;
  spacing: ReadingSpacing;
  pageWidth: ReadingPageWidth;
}

export const DEFAULT_READING_DISPLAY_PREFERENCES: Readonly<ReadingDisplayPreferences> = {
  uiScale: 100,
  fontSize: 26,
  spacing: 'comfortable',
  pageWidth: 'comfortable',
};

const MIN_UI_SCALE = 85;
const MAX_UI_SCALE = 115;
const MIN_FONT_SIZE = 18;
const MAX_FONT_SIZE = 40;

export const READING_PAGE_WIDTH_CLASSES: Record<ReadingPageWidth, string> = {
  comfortable: 'max-w-5xl',
  wide: 'max-w-7xl',
  full: 'max-w-none',
};

export const NARROW_READING_WIDTH_CLASSES: Record<ReadingPageWidth, string> = {
  comfortable: 'max-w-3xl',
  wide: 'max-w-5xl',
  full: 'max-w-none',
};

export function normalizeReadingDisplayPreferences(value: unknown): ReadingDisplayPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_READING_DISPLAY_PREFERENCES };
  }
  const candidate = value as Record<string, unknown>;
  const uiScale = typeof candidate.uiScale === 'number' && Number.isFinite(candidate.uiScale)
    ? Math.min(MAX_UI_SCALE, Math.max(MIN_UI_SCALE, Math.round(candidate.uiScale / 5) * 5))
    : DEFAULT_READING_DISPLAY_PREFERENCES.uiScale;
  const fontSize = typeof candidate.fontSize === 'number' && Number.isFinite(candidate.fontSize)
    ? Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(candidate.fontSize / 2) * 2))
    : DEFAULT_READING_DISPLAY_PREFERENCES.fontSize;
  const spacing: ReadingSpacing =
    candidate.spacing === 'compact' || candidate.spacing === 'relaxed' || candidate.spacing === 'comfortable'
      ? candidate.spacing
      : DEFAULT_READING_DISPLAY_PREFERENCES.spacing;
  const pageWidth: ReadingPageWidth =
    candidate.pageWidth === 'wide' || candidate.pageWidth === 'full' || candidate.pageWidth === 'comfortable'
      ? candidate.pageWidth
      : DEFAULT_READING_DISPLAY_PREFERENCES.pageWidth;

  return { uiScale, fontSize, spacing, pageWidth };
}

function getStorageKey(viewId: ReadingViewId): string {
  return `wird:reading-display:${viewId}:v1`;
}

/** Device-local reading display preferences; excluded from Firestore sync and backups. */
export function getReadingDisplayPreferences(viewId: ReadingViewId): ReadingDisplayPreferences {
  try {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_READING_DISPLAY_PREFERENCES };
    const raw = localStorage.getItem(getStorageKey(viewId));
    return raw
      ? normalizeReadingDisplayPreferences(JSON.parse(raw))
      : { ...DEFAULT_READING_DISPLAY_PREFERENCES };
  } catch {
    return { ...DEFAULT_READING_DISPLAY_PREFERENCES };
  }
}

export function saveReadingDisplayPreferences(
  viewId: ReadingViewId,
  preferences: ReadingDisplayPreferences
): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    const normalized = normalizeReadingDisplayPreferences(preferences);
    localStorage.setItem(getStorageKey(viewId), JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}

export function clampUiScale(value: number, min = 80, max = 115): number {
  if (!Number.isFinite(value)) return 100;
  return Math.min(max, Math.max(min, Math.round(value / 5) * 5));
}

/** Formats sequential Arabic ayah labels without RTL-ambiguous colons. */
export function formatAyahRangeOptionLabel(
  ayahNumber: number,
  surahName?: string,
  includeSurahName = false
): string {
  if (includeSurahName && surahName) {
    return `آية ${ayahNumber} (${surahName})`;
  }
  return `آية ${ayahNumber}`;
}
