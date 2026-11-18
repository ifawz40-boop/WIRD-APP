import { NavTabId } from '../components/layout/Sidebar';
import { ALL_SURAHS } from '../data/quranMeta';

/**
 * ====================================================================
 * WIRD — Lightweight Browser Router & Deep-Link Manager (Phase 3E)
 * ====================================================================
 * 
 * Provides:
 * 1. URL Hash routing supporting Browser Back/Forward navigation.
 * 2. Deep linking for all views, specific Surahs, and interactive Sessions.
 * 3. Query parameter parsing for session mode, Surah, and Ayah ranges.
 * 4. Safe route parsing on refresh (zero broken views or 404s).
 * 5. Session exit confirmation support.
 */

export interface RouteState {
  tab: NavTabId;
  surahNumber?: number;
  startAyah?: number;
  endAyah?: number;
  mode?: 'memorize' | 'review';
  enginePlanId?: string | null;
  enginePlanDate?: string | null;
}

export const VALID_NAV_TABS: NavTabId[] = [
  'dashboard',
  'library',
  'plans',
  'session',
  'revision',
  'tests',
  'progress',
  'advisor',
  'ruqyah',
  'settings',
  'showcase'
];

/**
 * Parse current window.location.hash into a structured RouteState
 */
export function parseRoute(hashString?: string): RouteState {
  const raw = hashString !== undefined 
    ? hashString 
    : (typeof window !== 'undefined' ? window.location.hash : '');

  // Strip leading '#/' or '#'
  const clean = raw.replace(/^#\/?/, '').trim();
  if (!clean) {
    return { tab: 'dashboard' };
  }

  const [pathPart, queryPart] = clean.split('?');
  const path = pathPart.toLowerCase();

  let tab: NavTabId = 'dashboard';
  if (VALID_NAV_TABS.includes(path as NavTabId)) {
    tab = path as NavTabId;
  }

  const searchParams = new URLSearchParams(queryPart || '');

  const surahParam = searchParams.get('surah');
  const startParam = searchParams.get('start');
  const endParam = searchParams.get('end');
  const modeParam = searchParams.get('mode');
  const planParam = searchParams.get('plan');
  const enginePlanId = tab === 'session' && planParam !== null && /^[A-Za-z0-9_-]{1,128}$/.test(planParam)
    ? planParam
    : undefined;
  const planDateParam = searchParams.get('planDate');
  const enginePlanDate = tab === 'session' && planDateParam !== null && /^\d{4}-\d{2}-\d{2}$/.test(planDateParam)
    ? planDateParam
    : undefined;

  const rawSurah = surahParam !== null ? Number(surahParam) : NaN;
  const validSurah = Number.isInteger(rawSurah) && rawSurah >= 1 && rawSurah <= 114
    ? ALL_SURAHS[rawSurah - 1]
    : undefined;
  const surahNumber = validSurah?.number;

  let startAyah: number | undefined;
  let endAyah: number | undefined;
  if (validSurah) {
    const rawStart = startParam !== null ? Number(startParam) : NaN;
    if (Number.isInteger(rawStart) && rawStart >= 1) {
      startAyah = Math.min(rawStart, validSurah.versesCount);
    }
    const rawEnd = endParam !== null ? Number(endParam) : NaN;
    if (Number.isInteger(rawEnd) && rawEnd >= 1) {
      const clampedEnd = Math.min(rawEnd, validSurah.versesCount);
      endAyah = startAyah !== undefined ? Math.max(startAyah, clampedEnd) : clampedEnd;
    }
  }
  const mode = modeParam === 'review' ? 'review' : 'memorize';

  return {
    tab,
    surahNumber,
    startAyah,
    endAyah,
    mode,
    enginePlanId,
    enginePlanDate
  };
}

/**
 * Build URL hash string from RouteState
 */
export function buildRouteHash(state: RouteState): string {
  const { tab, surahNumber, startAyah, endAyah, mode, enginePlanId, enginePlanDate } = state;
  const params = new URLSearchParams();

  if (surahNumber !== undefined) params.set('surah', String(surahNumber));
  if (startAyah !== undefined) params.set('start', String(startAyah));
  if (endAyah !== undefined) params.set('end', String(endAyah));
  if (mode && tab === 'session') params.set('mode', mode);
  if (enginePlanId && tab === 'session' && /^[A-Za-z0-9_-]{1,128}$/.test(enginePlanId)) params.set('plan', enginePlanId);
  if (enginePlanDate && tab === 'session' && /^\d{4}-\d{2}-\d{2}$/.test(enginePlanDate)) params.set('planDate', enginePlanDate);

  const query = params.toString();
  return `#/${tab}${query ? `?${query}` : ''}`;
}

/**
 * Programmatically navigate to a route
 */
export function navigateTo(target: RouteState | NavTabId, replace: boolean = false): void {
  if (typeof window === 'undefined') return;

  const state: RouteState = typeof target === 'string' ? { tab: target } : target;
  const newHash = buildRouteHash(state);

  if (window.location.hash !== newHash) {
    if (replace) {
      const url = `${window.location.pathname}${window.location.search}${newHash}`;
      window.history.replaceState(null, '', url);
      // Manually dispatch hashchange event for in-app listeners
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } else {
      window.location.hash = newHash;
    }
  }
}
