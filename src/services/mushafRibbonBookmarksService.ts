import { StorageService } from './storageService';

export type MushafRibbonId = 'khatma' | 'hifz' | 'murajaah' | 'tadabbur';

export interface MushafRibbonBookmark {
  id: MushafRibbonId;
  labelAr: string;
  colorHex: string;
  page: number | null;
  note?: string;
  updatedAtMs: number;
}

export const MUSHAF_RIBBONS_STORAGE_KEY = 'wird.quran.ribbons.v1';

export const DEFAULT_MUSHAF_RIBBONS: readonly MushafRibbonBookmark[] = [
  {
    id: 'khatma',
    labelAr: 'فاصل الختمة',
    colorHex: '#0F6A4B',
    page: null,
    updatedAtMs: 0,
  },
  {
    id: 'hifz',
    labelAr: 'فاصل الحفظ',
    colorHex: '#B8862D',
    page: null,
    updatedAtMs: 0,
  },
  {
    id: 'murajaah',
    labelAr: 'فاصل المراجعة',
    colorHex: '#9E2A3B',
    page: null,
    updatedAtMs: 0,
  },
  {
    id: 'tadabbur',
    labelAr: 'فاصل التدبر',
    colorHex: '#1D4E89',
    page: null,
    updatedAtMs: 0,
  },
] as const;

export function readMushafRibbons(): MushafRibbonBookmark[] {
  const defaults = DEFAULT_MUSHAF_RIBBONS.map((r) => ({ ...r }));
  try {
    if (typeof localStorage === 'undefined') return defaults;
    const raw = localStorage.getItem(StorageService.resolveScopedKey(MUSHAF_RIBBONS_STORAGE_KEY));
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaults;
    const byId = new Map<string, Record<string, unknown>>();
    for (const item of parsed) {
      if (item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string') {
        byId.set((item as { id: string }).id, item as Record<string, unknown>);
      }
    }
    return defaults.map((def) => {
      const saved = byId.get(def.id);
      if (!saved) return def;
      const rawPage = Number(saved.page);
      const validPage =
        Number.isInteger(rawPage) && rawPage >= 1 && rawPage <= 604 ? rawPage : null;
      const updatedAtMs =
        typeof saved.updatedAtMs === 'number' && Number.isFinite(saved.updatedAtMs)
          ? Math.max(0, Math.trunc(saved.updatedAtMs))
          : 0;
      const note =
        typeof saved.note === 'string' && saved.note.trim()
          ? saved.note.trim().slice(0, 160)
          : undefined;
      return {
        ...def,
        page: validPage,
        note,
        updatedAtMs,
      };
    });
  } catch {
    return defaults;
  }
}

export function saveMushafRibbons(ribbons: MushafRibbonBookmark[]): MushafRibbonBookmark[] {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(
        StorageService.resolveScopedKey(MUSHAF_RIBBONS_STORAGE_KEY),
        JSON.stringify(ribbons)
      );
    }
  } catch {
    // Graceful degradation when storage is restricted.
  }
  return ribbons;
}

export function placeMushafRibbon(
  ribbonId: MushafRibbonId,
  page: number | null,
  note?: string
): MushafRibbonBookmark[] {
  const validPage =
    page !== null && Number.isInteger(page) && page >= 1 && page <= 604 ? page : null;
  const current = readMushafRibbons();
  const next = current.map((item) =>
    item.id === ribbonId
      ? {
          ...item,
          page: validPage,
          note: note !== undefined ? note.trim().slice(0, 160) || undefined : item.note,
          updatedAtMs: Date.now(),
        }
      : item
  );
  return saveMushafRibbons(next);
}

export function getRibbonsOnPage(
  ribbons: MushafRibbonBookmark[],
  page: number
): MushafRibbonBookmark[] {
  return ribbons.filter((r) => r.page === page);
}
