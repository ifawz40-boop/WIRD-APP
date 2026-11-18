export type MushafSurfaceId = 'library' | 'session';
export type MushafSpreadMode = 'auto' | 'single' | 'double';
export type MushafTafsirDesktopLayout = 'panel' | 'replace_opposite';

export const TOTAL_MUSHAF_PAGES = 604;
export const DESKTOP_SPREAD_BREAKPOINT_PX = 768;

const SPREAD_MODE_STORAGE_PREFIX = 'wird:mushaf-spread-mode:v1:';
const TAFSIR_LAYOUT_STORAGE_PREFIX = 'wird:mushaf-tafsir-layout:v1:';
const TAFSIR_PAGE_MODE_STORAGE_PREFIX = 'wird:mushaf-tafsir-page-modes:v1:';

export interface MushafTafsirPagePreferences {
  sourcePages: Record<number, boolean>;
  preferredSourcePage: number | null;
}

function normalizeMushafTafsirPagePreferences(value: unknown): MushafTafsirPagePreferences {
  if (!value || typeof value !== 'object') return { sourcePages: {}, preferredSourcePage: null };
  const raw = value as Record<string, unknown>;
  const sourcePages: Record<number, boolean> = {};
  if (raw.sourcePages && typeof raw.sourcePages === 'object') {
    for (const [key, enabled] of Object.entries(raw.sourcePages as Record<string, unknown>)) {
      const page = Number(key);
      if (Number.isInteger(page) && page >= 1 && page <= TOTAL_MUSHAF_PAGES && enabled === true) {
        sourcePages[page] = true;
      }
    }
  }
  const preferred = Number(raw.preferredSourcePage);
  return {
    sourcePages,
    preferredSourcePage: Number.isInteger(preferred) && preferred >= 1 && preferred <= TOTAL_MUSHAF_PAGES && sourcePages[preferred]
      ? preferred
      : null
  };
}

export function clampMushafPage(page: number): number {
  if (!Number.isFinite(page)) return 1;
  return Math.min(TOTAL_MUSHAF_PAGES, Math.max(1, Math.trunc(page)));
}

/**
 * Canonical RTL printed Mushaf facing pair:
 * Page 1 pairs with Page 2 (right = 1, left = 2),
 * Page 3 pairs with Page 4 (right = 3, left = 4),
 * ..., Page 603 pairs with Page 604.
 */
export function getSpreadPairForPage(page: number): [number, number] {
  const safe = clampMushafPage(page);
  const rightPage = safe % 2 === 1 ? safe : safe - 1;
  const boundedRight = Math.min(TOTAL_MUSHAF_PAGES - 1, Math.max(1, rightPage));
  return [boundedRight, boundedRight + 1];
}

export function normalizeSpreadAnchorPage(page: number, isTwoPage: boolean): number {
  const safe = clampMushafPage(page);
  if (!isTwoPage) return safe;
  return getSpreadPairForPage(safe)[0];
}

export function stepSpreadPage(
  currentPage: number,
  direction: 'next' | 'prev',
  isTwoPage: boolean
): number {
  const safe = clampMushafPage(currentPage);
  if (!isTwoPage) {
    return direction === 'next'
      ? clampMushafPage(safe + 1)
      : clampMushafPage(safe - 1);
  }
  const [rightPage] = getSpreadPairForPage(safe);
  return direction === 'next'
    ? Math.min(TOTAL_MUSHAF_PAGES - 1, rightPage + 2)
    : Math.max(1, rightPage - 2);
}

export function resolveEffectiveSpreadMode(
  preference: MushafSpreadMode,
  viewportWidth: number
): 'single' | 'double' {
  if (preference === 'single') return 'single';
  if (preference === 'double') {
    return viewportWidth >= DESKTOP_SPREAD_BREAKPOINT_PX ? 'double' : 'single';
  }
  return viewportWidth >= DESKTOP_SPREAD_BREAKPOINT_PX ? 'double' : 'single';
}

export function normalizeMushafSpreadMode(value: unknown): MushafSpreadMode {
  if (value === 'single' || value === 'double' || value === 'auto') return value;
  return 'auto';
}

export function normalizeMushafTafsirDesktopLayout(value: unknown): MushafTafsirDesktopLayout {
  if (value === 'panel' || value === 'replace_opposite') return value;
  return 'panel';
}

export function getSavedMushafSpreadMode(surface: MushafSurfaceId): MushafSpreadMode {
  try {
    if (typeof localStorage === 'undefined') return 'auto';
    return normalizeMushafSpreadMode(localStorage.getItem(SPREAD_MODE_STORAGE_PREFIX + surface));
  } catch {
    return 'auto';
  }
}

export function saveMushafSpreadMode(
  surface: MushafSurfaceId,
  mode: unknown
): MushafSpreadMode {
  const normalized = normalizeMushafSpreadMode(mode);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SPREAD_MODE_STORAGE_PREFIX + surface, normalized);
    }
  } catch {
    // Preference remains active in component state if storage fails.
  }
  return normalized;
}

export function getSavedMushafTafsirPagePreferences(surface: MushafSurfaceId): MushafTafsirPagePreferences {
  try {
    if (typeof localStorage === 'undefined') return { sourcePages: {}, preferredSourcePage: null };
    const raw = localStorage.getItem(TAFSIR_PAGE_MODE_STORAGE_PREFIX + surface);
    return raw ? normalizeMushafTafsirPagePreferences(JSON.parse(raw)) : { sourcePages: {}, preferredSourcePage: null };
  } catch {
    return { sourcePages: {}, preferredSourcePage: null };
  }
}

export function saveMushafTafsirPagePreferences(
  surface: MushafSurfaceId,
  preferences: MushafTafsirPagePreferences
): MushafTafsirPagePreferences {
  const normalized = normalizeMushafTafsirPagePreferences(preferences);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(TAFSIR_PAGE_MODE_STORAGE_PREFIX + surface, JSON.stringify(normalized));
    }
  } catch {
    // Preferences remain active in component state if storage is unavailable.
  }
  return normalized;
}

export function getSavedMushafTafsirLayout(surface: MushafSurfaceId): MushafTafsirDesktopLayout {
  try {
    if (typeof localStorage === 'undefined') return 'panel';
    return normalizeMushafTafsirDesktopLayout(
      localStorage.getItem(TAFSIR_LAYOUT_STORAGE_PREFIX + surface)
    );
  } catch {
    return 'panel';
  }
}

export function saveMushafTafsirLayout(
  surface: MushafSurfaceId,
  layout: unknown
): MushafTafsirDesktopLayout {
  const normalized = normalizeMushafTafsirDesktopLayout(layout);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(TAFSIR_LAYOUT_STORAGE_PREFIX + surface, normalized);
    }
  } catch {
    // Layout choice remains active in state if storage fails.
  }
  return normalized;
}
