import type { NavTabId } from '../components/layout/Sidebar';
import { trimLoadedQuranCaches } from '../data/quranDataLoader';
import { cloudSyncCoordinator } from './cloudSyncCoordinator';
import {
  hasPendingOfflinePackageResume,
  prepareWirdForOffline
} from './offlinePreparationService';
import { offlineQuranAudioLibrary } from './offlineQuranAudioLibrary';

const prefetchedTabs = new Set<NavTabId>();

const ROUTE_LOADERS: Partial<Record<NavTabId, () => Promise<unknown>>> = {
  library: () => import('../components/library/QuranLibraryView'),
  plans: () => import('../components/plans/MemorizationPlansView'),
  session: () => import('../components/session/MemorizationSessionView'),
  revision: () => import('../components/revision/RevisionCenterView'),
  tests: () => import('../components/tests/MemorizationTestsView'),
  progress: () => import('../components/progress/ProgressAnalyticsView'),
  advisor: () => import('../components/assistant/QuranAdvisorView'),
  adhkar: () => import('../components/adhkar/AdhkarView'),
  seerah: () => import('../components/seerah/SeerahView'),
  series: () => import('../components/series/VideoSeriesView'),
  ruqyah: () => import('../components/ruqyah/RuqyahView'),
  settings: () => import('../components/settings/SettingsView')
};

/**
 * Prefetches a lazy route chunk on hover/focus or idle time so navigation
 * feels instantaneous (<16ms) without blocking initial boot.
 */
export function prefetchRouteView(tab: NavTabId): void {
  if (prefetchedTabs.has(tab)) return;
  const loader = ROUTE_LOADERS[tab];
  if (!loader) return;
  prefetchedTabs.add(tab);
  void loader().catch(() => {
    prefetchedTabs.delete(tab);
  });
}

/**
 * Schedules low-priority warm-up of primary worship routes during browser idle time.
 */
export function scheduleIdleRouteWarmup(): () => void {
  if (typeof window === 'undefined') return () => {};
  const priorityQueue: NavTabId[] = ['library', 'session', 'revision', 'adhkar', 'ruqyah', 'seerah', 'advisor'];
  let cancelled = false;
  let timerId: number | null = null;

  const step = (idx: number) => {
    if (cancelled || idx >= priorityQueue.length) return;
    const runNext = () => {
      if (cancelled) return;
      prefetchRouteView(priorityQueue[idx]);
      timerId = window.setTimeout(() => step(idx + 1), 220);
    };
    if ('requestIdleCallback' in window && typeof (window as any).requestIdleCallback === 'function') {
      (window as any).requestIdleCallback(runNext, { timeout: 1500 });
    } else {
      timerId = window.setTimeout(runNext, 350);
    }
  };

  timerId = window.setTimeout(() => step(0), 900);

  return () => {
    cancelled = true;
    if (timerId !== null) window.clearTimeout(timerId);
  };
}

/**
 * Coordinates runtime resilience:
 * 1. Resumes interrupted offline app-package & audio downloads automatically when connectivity returns.
 * 2. Trims excess in-memory Surah chunk caches when tab goes to background to keep RAM footprint low.
 * 3. Triggers non-blocking background sync reconciliation on reconnect.
 */
export function installRuntimeLifecycleCoordinator(
  onNotify?: (message: string, kind?: 'info' | 'success' | 'warn') => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const stopWarmup = scheduleIdleRouteWarmup();

  const handleOnlineReconnect = () => {
    // 1. Resume interrupted Quran/Ruqyah audio download jobs
    void offlineQuranAudioLibrary.resumeInterruptedJobsOnReconnect().then(resumedCount => {
      if (resumedCount > 0) {
        onNotify?.('استؤنف تلقائياً تحميل الصوتيات المتوقفة بعد عودة الاتصال.', 'info');
      }
    });

    // 2. Resume interrupted full-app offline package preparation
    if (hasPendingOfflinePackageResume()) {
      void prepareWirdForOffline()
        .then(() => {
          onNotify?.('اكتمل تلقائياً تجهيز تطبيق «وِرد» للعمل الكامل بدون إنترنت.', 'success');
        })
        .catch(() => {
          // Will remain marked pending for next stable connection if network drops again
        });
    }

    // 3. Non-blocking cloud sync flush
    void cloudSyncCoordinator.triggerSync().catch(() => undefined);
  };

  const handleVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      trimLoadedQuranCaches(24);
    }
  };

  window.addEventListener('online', handleOnlineReconnect);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Reconcile offline audio cache metadata quietly after boot and auto-resume unfinished jobs if online
  const reconcileTimer = window.setTimeout(() => {
    void offlineQuranAudioLibrary
      .reconcileLibrary()
      .then(() => {
        if (typeof navigator === 'undefined' || navigator.onLine !== false) {
          return offlineQuranAudioLibrary.resumeInterruptedJobsOnReconnect();
        }
        return 0;
      })
      .catch(() => undefined);
  }, 1800);

  return () => {
    stopWarmup();
    window.clearTimeout(reconcileTimer);
    window.removeEventListener('online', handleOnlineReconnect);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}
