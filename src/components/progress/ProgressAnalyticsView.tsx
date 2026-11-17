import React, { useState, useEffect, useRef } from 'react';
import { 
  BarChart3, 
  BookOpen, 
  Download, 
  Upload, 
  CheckCircle2, 
  Flame, 
  Trophy, 
  Calendar,
  Layers,
  Sparkles,
  Filter,
  Check,
  X,
  Play,
  RotateCcw,
  Eye,
  Info
} from 'lucide-react';
import { TOTAL_QURAN_VERSES, TOTAL_QURAN_PAGES, JUZ_NAMES, ALL_SURAHS } from '../../data/quranMeta';
import { DailyLog, UserProfile, PortionMemorizationStatus, PortionStatusRecord } from '../../types/quran';
import { StorageService } from '../../services/storageService';
import { persistPortionsSnapshot } from '../../services/journaledSnapshotService';
import { importBackupFile } from '../../services/backupPersistence';
import { RetentionService } from '../../services/retentionService';
import { getLocalDateString } from '../../services/unifiedPortionService';
import { buildPageStatusUpdate, getPageAyahSegments, getPageProgressStatus, PageAyahSegment } from '../../services/pageProgressService';
import { HorizontalScrollRail } from '../shared/HorizontalScrollRail';

interface ProgressAnalyticsViewProps {
  logs: DailyLog[];
  profile: UserProfile;
  onRefreshData: () => void;
  onStartSession?: (surahNumber: number, startAyah: number, endAyah: number) => void;
  onToast?: (message: string, type?: 'success' | 'warn' | 'error' | 'info') => void;
  onOpenSettings?: () => void;
}


type PageGridZoom = 'compact' | 'normal' | 'large';
const PAGE_GRID_ZOOM_CLASSES: Record<PageGridZoom, string> = {
  compact: 'grid-cols-5 sm:grid-cols-8 md:grid-cols-12 lg:grid-cols-16 xl:grid-cols-20',
  normal: 'grid-cols-5 sm:grid-cols-7 md:grid-cols-10 lg:grid-cols-14 xl:grid-cols-18',
  large: 'grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 xl:grid-cols-16'
};

const STATUS_CONFIG: Record<PortionMemorizationStatus, { label: string; bg: string; border: string; text: string; dotColor: string }> = {
  stable: { label: 'راسخ ومتقن', bg: 'bg-[#1C4E46]/12 dark:bg-[#1E4A47]/65', border: 'border-[#1C4E46]/35 dark:border-[#6EE7B7]/40', text: 'text-[#1C4E46] dark:text-[#6EE7B7]', dotColor: 'bg-[#1C4E46] dark:bg-[#6EE7B7]' },
  recently_memorized: { label: 'محفوظ حديثاً', bg: 'bg-sky-100/80 dark:bg-sky-950/70', border: 'border-sky-400/70 dark:border-sky-700', text: 'text-sky-900 dark:text-sky-200', dotColor: 'bg-sky-500' },
  needs_revision: { label: 'يحتاج مراجعة', bg: 'bg-[#C59B27]/15 dark:bg-[#E0A96D]/20', border: 'border-[#C59B27]/50 dark:border-[#E0A96D]/50', text: 'text-[#9A7415] dark:text-[#E0A96D]', dotColor: 'bg-[#C59B27] dark:bg-[#E0A96D]' },
  weak: { label: 'ضعيف ويتفلت', bg: 'bg-rose-100/85 dark:bg-rose-950/70', border: 'border-rose-400/70 dark:border-rose-700', text: 'text-rose-900 dark:text-rose-200', dotColor: 'bg-rose-500' },
  currently_memorizing: { label: 'قيد الحفظ', bg: 'bg-purple-100/80 dark:bg-purple-950/70', border: 'border-purple-400/70 dark:border-purple-700', text: 'text-purple-900 dark:text-purple-200', dotColor: 'bg-purple-500' },
  not_memorized: { label: 'غير محفوظ', bg: 'bg-[#F2EDE2]/70 dark:bg-[#162744]/55', border: 'border-[#1C4E46]/15 dark:border-[#E0A96D]/15', text: 'text-[#5B6F6B] dark:text-[#8B9E9B]', dotColor: 'bg-[#5B6F6B]/50 dark:bg-[#8B9E9B]/50' }
};

export const ProgressAnalyticsView: React.FC<ProgressAnalyticsViewProps> = ({
  logs,
  profile,
  onRefreshData,
  onStartSession,
  onToast,
  onOpenSettings
}) => {
  const [mapMode, setMapMode] = useState<'juz' | 'pages'>('pages');
  const [pageGridZoom, setPageGridZoom] = useState<PageGridZoom>('normal');
  const [selectedJuz, setSelectedJuz] = useState<number>(30); // Default Juz Amma
  const [statusFilter, setStatusFilter] = useState<PortionMemorizationStatus | 'all'>('all');
  const [isExportSuccess, setIsExportSuccess] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [portions, setPortions] = useState<PortionStatusRecord[]>(() => RetentionService.getPortions());
  const exportSuccessTimerRef = useRef<number | null>(null);
  const revokeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (exportSuccessTimerRef.current !== null) window.clearTimeout(exportSuccessTimerRef.current);
      if (revokeTimerRef.current !== null) window.clearTimeout(revokeTimerRef.current);
    };
  }, []);

  // Page inspection / edit modal
  const [inspectedPage, setInspectedPage] = useState<{
    pageNumber: number;
    surah: typeof ALL_SURAHS[0];
    surahs: typeof ALL_SURAHS;
    segments: PageAyahSegment[];
    status: PortionMemorizationStatus;
    portionId?: string;
    portionIds?: string[];
  } | null>(null);
  const inspectedPageDialogRef = useRef<HTMLDivElement>(null);
  const closeInspectedPageRef = useRef<HTMLButtonElement>(null);
  const inspectedPageTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!inspectedPage) return;
    const trigger = inspectedPageTriggerRef.current;
    closeInspectedPageRef.current?.focus();

    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setInspectedPage(null);
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = inspectedPageDialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ));
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleDialogKeyDown);
    return () => {
      window.removeEventListener('keydown', handleDialogKeyDown);
      (inspectedPageTriggerRef.current ?? trigger)?.focus();
    };
  }, [inspectedPage]);

  useEffect(() => {
    setPortions(RetentionService.getPortions());
  }, []);

  // Page status is derived only from actual tracked ayah/page ranges.
  const getPageStatus = (page: number) => getPageProgressStatus(page, portions);

  // Change page status
  const handleUpdatePageStatus = async (pageNumber: number, newStatus: PortionMemorizationStatus) => {
    const updatedPortions = buildPageStatusUpdate(
      portions,
      pageNumber,
      newStatus,
      getLocalDateString()
    );
    if (!updatedPortions) {
      onToast?.('تعذر تحديد نطاق الآيات لهذه الصفحة؛ لم يتم تسجيل تقدم غير دقيق.', 'error');
      return;
    }

    // Persist the complete page snapshot through the journal before projecting
    // it to the canonical archive and its two legacy compatibility views.
    const result = await persistPortionsSnapshot(updatedPortions);
    if (!result.success) {
      if (result.recoveredPriorEvents) {
        setPortions(RetentionService.getPortions());
        onRefreshData();
      }
      onToast?.(result.recoveredPriorEvents
        ? 'استعدنا تقدمًا سابقًا وحدّثنا البيانات؛ لم ننفذ تغيير الصفحة الجديد. راجع الحالة ثم أعد المحاولة.'
        : result.queued
          ? 'تم حفظ تقدم الصفحة في سجل الاستعادة، لكن تعذر تطبيقه محلياً.'
          : result.recoveryBlocked
            ? 'تعذر تأمين الحفظ أو استعادة سجل سابق؛ لم نضف تغيير الصفحة الجديد.'
            : 'تعذر حفظ تقدم الصفحة في التخزين المحلي؛ لم يتم تأكيد التغيير.', 'error');
      return;
    }

    setPortions(updatedPortions);
    setInspectedPage(null);
    onRefreshData();
  };

  // Handle Export Backup
  const handleExportBackup = () => {
    const json = StorageService.exportFullBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wird_backup_${getLocalDateString()}.json`;
    a.click();
    if (revokeTimerRef.current !== null) window.clearTimeout(revokeTimerRef.current);
    revokeTimerRef.current = window.setTimeout(() => {
      URL.revokeObjectURL(url);
      revokeTimerRef.current = null;
    }, 1000);
    if (exportSuccessTimerRef.current !== null) window.clearTimeout(exportSuccessTimerRef.current);
    setIsExportSuccess(true);
    exportSuccessTimerRef.current = window.setTimeout(() => {
      setIsExportSuccess(false);
      exportSuccessTimerRef.current = null;
    }, 3000);
  };

  // Handle Import Backup through the same journal-first boundary as Settings.
  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file || isImporting) return;

    setIsImporting(true);
    try {
      const result = await importBackupFile(file);
      if (result.success) {
        setPortions(RetentionService.getPortions());
        onRefreshData();
        onToast?.(result.message, 'success');
      } else {
        if (result.recoveredPriorEvents) onRefreshData();
        onToast?.(result.message, 'error');
      }
    } catch (error) {
      onToast?.(
        error instanceof Error ? error.message : 'تعذر استيراد النسخة الاحتياطية؛ لم يتم تغيير بياناتك.',
        'error'
      );
    } finally {
      setIsImporting(false);
      input.value = '';
    }
  };

  // Surahs in selected Juz
  const juzSurahs = ALL_SURAHS.filter(s => s.juzStart <= selectedJuz && s.juzEnd >= selectedJuz);

  // Stats calculation across the 604 pages
  const pageStats = {
    stable: 0,
    recently_memorized: 0,
    needs_revision: 0,
    weak: 0,
    currently_memorizing: 0,
    not_memorized: 0,
    completed: 0
  };

  for (let p = 1; p <= 604; p++) {
    const pageProgress = getPageStatus(p);
    pageStats[pageProgress.status] = (pageStats[pageProgress.status] || 0) + 1;
    if (pageProgress.isFullyCovered && pageProgress.status !== 'not_memorized' && pageProgress.status !== 'currently_memorizing') {
      pageStats.completed++;
    }
  }

  const totalMemorizedPagesCount = pageStats.completed;

  return (
    <div className="space-y-6">
      {/* 1. Header with Export/Import */}
      <div className="wird-card rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#142421] dark:text-[#F5F1E8] flex items-center gap-2 font-quran">
            <BarChart3 className="w-5 h-5 text-[#1C4E46] dark:text-[#E0A96D]" />
            المصحف البصري التفاعلي وخريطة الحفظ
          </h2>
          <p className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B] mt-1">
            خريطة إلكترونية تفاعلية لـ 604 صفحة و 30 جزء بالترميز اللوني الدقيق للحالات الست
          </p>
        </div>

        {/* Backup export/import */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportBackup}
            className="flex min-h-11 items-center gap-1.5 px-3.5 py-2 bg-[#F2EDE2]/80 dark:bg-[#162744] hover:bg-[#1C4E46] hover:text-white text-[#142421] dark:text-[#F5F1E8] rounded-xl text-xs font-bold border border-[#1C4E46]/15 dark:border-[#E0A96D]/25 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExportSuccess ? 'تم التصدير!' : 'تصدير نسخة احتياطية'}</span>
          </button>

          <label className="flex min-h-11 items-center gap-1.5 px-3.5 py-2 bg-[#F2EDE2]/80 dark:bg-[#162744] hover:bg-[#1C4E46] hover:text-white text-[#142421] dark:text-[#F5F1E8] rounded-xl text-xs font-bold border border-[#1C4E46]/15 dark:border-[#E0A96D]/25 transition-colors cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>{isImporting ? 'جارٍ الاستيراد...' : 'استيراد بيانات'}</span>
            <input 
              type="file" 
              accept=".json" 
              onChange={handleImportBackup}
              disabled={isImporting}
              className="hidden" 
            />
          </label>

          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex min-h-11 items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#1C4E46] dark:text-[#E0A96D] hover:underline"
            >
              <span>مركز النسخ بالإعدادات</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Key Metrics Summary Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="wird-card rounded-2xl p-5 space-y-1">
          <div className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B]">الصفحات المتقنة والمحفوظة</div>
          <div className="text-2xl font-bold text-[#1C4E46] dark:text-[#6EE7B7] font-mono tabular-nums">
            {totalMemorizedPagesCount}
          </div>
          <div className="text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B] tabular-nums">
            من أصل 604 صفحة ({((totalMemorizedPagesCount / 604) * 100).toFixed(1)}%)
          </div>
        </div>

        <div className="wird-card rounded-2xl p-5 space-y-1">
          <div className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B]">صفحات في طور الحفظ</div>
          <div className="text-2xl font-bold text-purple-700 dark:text-purple-400 font-mono tabular-nums">
            {pageStats.currently_memorizing}
          </div>
          <div className="text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B]">
            قيد المتابعة اليومية
          </div>
        </div>

        <div className="wird-card rounded-2xl p-5 space-y-1">
          <div className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B]">صفحات تحتاج مراجعة أو تثبيت</div>
          <div className="text-2xl font-bold text-[#C59B27] dark:text-[#E0A96D] font-mono tabular-nums">
            {pageStats.needs_revision + pageStats.weak}
          </div>
          <div className="text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B] tabular-nums">
            منها {pageStats.weak} صفحات ضعيفة
          </div>
        </div>

        <div className="wird-card rounded-2xl p-5 space-y-1">
          <div className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B]">معدل التثبيت العام</div>
          <div className="text-2xl font-bold text-[#142421] dark:text-[#F5F1E8] font-mono tabular-nums">
            %{totalMemorizedPagesCount > 0 ? Math.round(((pageStats.stable + pageStats.recently_memorized * 0.8) / totalMemorizedPagesCount) * 100) : 0}
          </div>
          <div className="text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B]">
            جودة الرسوخ التراكمية
          </div>
        </div>
      </div>

      {/* 3. Interactive Visual Quran Map Control Bar */}
      <div className="wird-card rounded-3xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-base text-[#142421] dark:text-[#F5F1E8] flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#1C4E46] dark:text-[#E0A96D]" />
              <span>خريطة المصحف البصرية التفاعلية</span>
            </h3>
            <p className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B] mt-0.5">
              انقر على أي صفحة لتفقد حالتها، وتغيير تصنيفها، أو بدء جلسة تسميع وتكرار لها
            </p>
          </div>

          {/* Toggle between 30 Juz and 604 Pages */}
          <div className="flex items-center gap-2">
            <div className="flex bg-[#F2EDE2] dark:bg-[#0B132B] p-1 rounded-xl border border-[#1C4E46]/15 dark:border-[#E0A96D]/20 text-xs font-bold">
              <button
                type="button"
                onClick={() => setMapMode('pages')}
                aria-pressed={mapMode === 'pages'}
                className={`min-h-11 px-3.5 py-1.5 rounded-lg transition-colors ${
                  mapMode === 'pages'
                    ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white shadow-xs border border-[#C59B27]/40 dark:border-[#E0A96D]/40'
                    : 'text-[#5B6F6B] dark:text-[#8B9E9B]'
                }`}
              >
                صفحات المصحف (604)
              </button>
              <button
                type="button"
                onClick={() => setMapMode('juz')}
                aria-pressed={mapMode === 'juz'}
                className={`min-h-11 px-3.5 py-1.5 rounded-lg transition-colors ${
                  mapMode === 'juz'
                    ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white shadow-xs border border-[#C59B27]/40 dark:border-[#E0A96D]/40'
                    : 'text-[#5B6F6B] dark:text-[#8B9E9B]'
                }`}
              >
                أجزاء القرآن (30)
              </button>
            </div>
          </div>
        </div>

        {/* Status Legend & Filter inside HorizontalScrollRail */}
        <div className="space-y-2 border-y border-[#1C4E46]/10 dark:border-[#E0A96D]/15 py-3">
          <span className="text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B] font-bold block">تصفية العرض حسب الحالة:</span>
          <HorizontalScrollRail
            ariaLabel="تصفية خريطة المصحف حسب الحالة"
            activeKey={statusFilter}
            contentClassName="gap-2 text-xs"
          >
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              aria-pressed={statusFilter === 'all'}
              className={`min-h-11 shrink-0 snap-start px-3 py-1.5 rounded-xl transition-all border ${
                statusFilter === 'all'
                  ? 'bg-[#1C4E46] dark:bg-[#E0A96D] text-white dark:text-[#0B132B] border-[#C59B27] font-bold shadow-xs'
                  : 'bg-[#F2EDE2]/75 dark:bg-[#162744] text-[#5B6F6B] dark:text-[#8B9E9B] border-transparent'
              }`}
            >
              الكل (604)
            </button>

            {(Object.keys(STATUS_CONFIG) as PortionMemorizationStatus[]).map(statusKey => {
              const cfg = STATUS_CONFIG[statusKey];
              const count = pageStats[statusKey];
              const isSelected = statusFilter === statusKey;
              return (
                <button
                  key={statusKey}
                  type="button"
                  onClick={() => setStatusFilter(statusKey)}
                  aria-pressed={isSelected}
                  className={`flex min-h-11 shrink-0 snap-start items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all ${
                    isSelected 
                      ? 'ring-2 ring-[#C59B27] dark:ring-[#E0A96D] font-bold' 
                      : 'hover:border-[#C59B27]/50'
                  } ${cfg.bg} ${cfg.border} ${cfg.text}`}
                >
                  <span className={`w-2 h-2 rounded-full ${cfg.dotColor}`} />
                  <span className="whitespace-nowrap">{cfg.label}</span>
                  <span className="font-mono tabular-nums text-[10px] opacity-80">({count})</span>
                </button>
              );
            })}
          </HorizontalScrollRail>
        </div>

        {/* MAP VIEW: 604 PAGES GRID */}
        {mapMode === 'pages' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#5B6F6B] dark:text-[#8B9E9B]">
              <span>انقر على رقم أي صفحة للتعديل أو المراجعة:</span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] tabular-nums">مصحف المدينة المنورة (604 صفحة)</span>
                <div role="group" aria-label="تكبير خريطة الصفحات" className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#F2EDE2] dark:bg-[#0B132B] border border-[#1C4E46]/15 dark:border-[#E0A96D]/20">
                  <button type="button" aria-pressed={pageGridZoom === 'compact'} onClick={() => setPageGridZoom('compact')} className={`min-h-11 px-2.5 py-1.5 rounded-lg font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27] ${pageGridZoom === 'compact' ? 'bg-white dark:bg-[#162744] text-[#142421] dark:text-[#F5F1E8] shadow-xs' : ''}`}>أصغر</button>
                  <button type="button" aria-pressed={pageGridZoom === 'normal'} onClick={() => setPageGridZoom('normal')} className={`min-h-11 px-2.5 py-1.5 rounded-lg font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27] ${pageGridZoom === 'normal' ? 'bg-white dark:bg-[#162744] text-[#142421] dark:text-[#F5F1E8] shadow-xs' : ''}`}>متوسط</button>
                  <button type="button" aria-pressed={pageGridZoom === 'large'} onClick={() => setPageGridZoom('large')} className={`min-h-11 px-2.5 py-1.5 rounded-lg font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27] ${pageGridZoom === 'large' ? 'bg-white dark:bg-[#162744] text-[#142421] dark:text-[#F5F1E8] shadow-xs' : ''}`}>أكبر</button>
                </div>
              </div>
            </div>

            <div className={`grid ${PAGE_GRID_ZOOM_CLASSES[pageGridZoom]} gap-2 max-h-[600px] overflow-y-auto overscroll-contain touch-pan-y p-2.5 bg-[#F9F6EE] dark:bg-[#0B132B]/70 rounded-2xl border border-[#1C4E46]/12 dark:border-[#E0A96D]/18`}>
              {Array.from({ length: 604 }, (_, i) => i + 1).map((pageNum) => {
                const { status, surah, surahs, portionId, portionIds } = getPageStatus(pageNum);
                const pageSegments = getPageAyahSegments(pageNum);
                const cfg = STATUS_CONFIG[status];
                const matchesFilter = statusFilter === 'all' || statusFilter === status;

                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={(event) => { inspectedPageTriggerRef.current = event.currentTarget; setInspectedPage({ pageNumber: pageNum, surah, surahs, segments: pageSegments, status, portionId, portionIds }); }}
                    className={`aspect-square ${pageGridZoom === 'large' ? 'min-h-14 min-w-14' : 'min-h-12 min-w-12'} rounded-xl p-1.5 border text-center transition-all flex flex-col items-center justify-center relative group touch-manipulation active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27] ${
                      matchesFilter ? 'opacity-100 hover:scale-110 z-10' : 'opacity-20 hover:opacity-100'
                    } ${cfg.bg} ${cfg.border} shadow-2xs cursor-pointer`}
                    title={`صفحة ${pageNum} - ${surahs.map(item => item.name).join('، ')} (${cfg.label})`}
                    aria-label={`صفحة ${pageNum} - ${surahs.map(item => item.name).join('، ')} - ${cfg.label}`}
                  >
                    <span className="text-[10px] font-mono tabular-nums font-bold leading-none text-[#142421] dark:text-[#F5F1E8]">
                      {pageNum}
                    </span>
                    <span className={`w-1.5 h-1.5 rounded-full mt-1 ${cfg.dotColor}`} />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* MAP VIEW: 30 JUZ GRID */}
        {mapMode === 'juz' && (
          <div className="space-y-4">
            <HorizontalScrollRail ariaLabel="الانتقال السريع بين أجزاء القرآن" activeKey={selectedJuz}>
              {Array.from({ length: 30 }, (_, i) => i + 1).map(juzNum => (
                <button
                  key={juzNum}
                  type="button"
                  onClick={() => setSelectedJuz(juzNum)}
                  aria-pressed={selectedJuz === juzNum}
                  className={`min-h-11 shrink-0 snap-start px-3 py-1.5 rounded-xl border text-xs font-bold font-mono tabular-nums transition-all ${
                    selectedJuz === juzNum
                      ? 'bg-[#1C4E46] dark:bg-[#E0A96D] text-white dark:text-[#0B132B] border-[#C59B27]'
                      : 'bg-[#F2EDE2]/75 dark:bg-[#162744] text-[#142421] dark:text-[#F5F1E8] border-transparent hover:border-[#C59B27]'
                  }`}
                >
                  ج {juzNum}
                </button>
              ))}
            </HorizontalScrollRail>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {Array.from({ length: 30 }, (_, i) => i + 1).map((juzNum) => {
                const isSelected = selectedJuz === juzNum;
                const juzStartPage = (juzNum - 1) * 20 + 1;
                const juzEndPage = juzNum === 30 ? 604 : juzNum * 20;
                let memorizedInJuz = 0;

                for (let p = juzStartPage; p <= juzEndPage; p++) {
                  const { status } = getPageStatus(p);
                  if (status !== 'not_memorized') memorizedInJuz++;
                }

                const totalInJuz = (juzEndPage - juzStartPage + 1);
                const percent = Math.round((memorizedInJuz / totalInJuz) * 100);

                return (
                  <button
                    key={juzNum}
                    type="button"
                    onClick={() => setSelectedJuz(juzNum)}
                    aria-pressed={isSelected}
                    className={`p-3.5 rounded-2xl border text-right transition-all flex flex-col justify-between min-h-[100px] ${
                      isSelected
                        ? 'border-[#C59B27] dark:border-[#E0A96D] bg-[#1C4E46]/8 dark:bg-[#1E4A47]/45 ring-2 ring-[#C59B27]/25'
                        : 'border-[#1C4E46]/12 dark:border-[#E0A96D]/18 bg-white dark:bg-[#111F36] hover:border-[#C59B27]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B] font-mono tabular-nums">الجزء {juzNum}</span>
                      <span className="text-[10px] font-mono tabular-nums font-bold text-[#1C4E46] dark:text-[#E0A96D]">%{percent}</span>
                    </div>

                    <div className="font-bold text-sm text-[#142421] dark:text-[#F5F1E8] font-quran truncate">
                      {JUZ_NAMES[juzNum - 1]}
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-[#F2EDE2] dark:bg-[#0B132B] h-1.5 rounded-full overflow-hidden mt-2">
                      <div style={{ width: `${percent}%` }} className="h-full bg-[#1C4E46] dark:bg-[#E0A96D]" />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Juz Detail Panel */}
            <div className="bg-[#F9F6EE] dark:bg-[#0B132B]/70 p-5 rounded-2xl border border-[#C59B27]/25 dark:border-[#E0A96D]/25 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-[#142421] dark:text-[#F5F1E8] font-quran">
                  سور {JUZ_NAMES[selectedJuz - 1]} (الجزء {selectedJuz})
                </h4>
                <span className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B] font-mono tabular-nums">
                  {juzSurahs.length} سور
                </span>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {juzSurahs.map((s) => (
                  <div 
                    key={s.number}
                    className="bg-white dark:bg-[#111F36] px-3.5 py-2 rounded-xl border border-[#1C4E46]/12 dark:border-[#E0A96D]/18 text-xs flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <span className="font-bold font-quran text-[#142421] dark:text-[#F5F1E8]">
                      سورة {s.name}
                    </span>
                    <span className="text-[#5B6F6B] dark:text-[#8B9E9B] text-[10px] font-mono tabular-nums">
                      ص {s.pageStart} • {s.versesCount} آية
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: INSPECT & EDIT PAGE STATUS */}
      {inspectedPage && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div ref={inspectedPageDialogRef} role="dialog" aria-modal="true" aria-labelledby="wird-progress-page-title" className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-[#C59B27]/35 dark:border-[#E0A96D]/30 bg-[#F9F6EE] dark:bg-[#111F36] p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-mono text-[#1C4E46] dark:text-[#E0A96D] font-bold">
                  مصحف المدينة المنورة
                </span>
                <h3 id="wird-progress-page-title" className="text-lg font-bold text-[#142421] dark:text-[#F5F1E8] font-quran">
                  صفحة رقم {inspectedPage.pageNumber} • {inspectedPage.surahs.map(item => item.name).join('، ')}
                </h3>
              </div>
              <button
                ref={closeInspectedPageRef}
                type="button"
                onClick={() => setInspectedPage(null)}
                aria-label="إغلاق تفاصيل الصفحة"
                className="min-h-11 min-w-11 flex items-center justify-center rounded-xl text-[#5B6F6B] hover:text-[#142421] dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-white dark:bg-[#0B132B]/70 rounded-xl border border-[#1C4E46]/12 dark:border-[#E0A96D]/20 text-xs space-y-2">
              <div className="flex justify-between gap-3">
                <span className="text-[#5B6F6B] dark:text-[#8B9E9B] shrink-0">السور الموجودة:</span>
                <span className="font-bold text-[#142421] dark:text-[#F5F1E8] text-left">{inspectedPage.surahs.map(item => item.name).join('، ')}</span>
              </div>
              <div className="space-y-1 border-y border-[#1C4E46]/10 dark:border-[#E0A96D]/15 py-2">
                {inspectedPage.segments.map((segment, index) => {
                  const segmentSurah = ALL_SURAHS.find(item => item.number === segment.surahNumber);
                  return (
                    <div key={segment.surahNumber + '-' + index} className="flex justify-between gap-3">
                      <span className="text-[#5B6F6B] dark:text-[#8B9E9B]">سورة {segmentSurah?.name || segment.surahNumber}</span>
                      <span className="font-bold font-mono tabular-nums text-[#142421] dark:text-[#F5F1E8]">الآيات {segment.startAyah}–{segment.endAyah}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between">
                <span className="text-[#5B6F6B] dark:text-[#8B9E9B]">الحالة الحالية:</span>
                <span className={`font-bold ${STATUS_CONFIG[inspectedPage.status].text}`}>
                  {STATUS_CONFIG[inspectedPage.status].label}
                </span>
              </div>
            </div>

            {/* Set New Status Radio Options (6 exact statuses) */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#142421] dark:text-[#F5F1E8]">
                تحديث حالة حفظ ورسوخ هذه الصفحة:
              </label>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {(Object.keys(STATUS_CONFIG) as PortionMemorizationStatus[]).map((key) => {
                  const cfg = STATUS_CONFIG[key];
                  const isCurrent = inspectedPage.status === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleUpdatePageStatus(inspectedPage.pageNumber, key)}
                      aria-pressed={isCurrent}
                      className={`min-h-11 p-2.5 rounded-xl border text-right transition-all flex items-center gap-2 ${
                        isCurrent 
                          ? 'ring-2 ring-[#C59B27] dark:ring-[#E0A96D] font-bold shadow-xs' 
                          : 'hover:border-[#C59B27]'
                      } ${cfg.bg} ${cfg.border} ${cfg.text}`}
                    >
                      <span className={`w-2 h-2 rounded-full ${cfg.dotColor}`} />
                      <span className="text-[11px]">{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {inspectedPage.segments.length > 1 && (
              <p className="text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B] leading-5">
                تحتوي هذه الصفحة على {inspectedPage.segments.length} مقاطع من مواضع قرآنية مختلفة؛ يفتح زر الجلسة المقطع الأول فقط حتى لا ندمج نطاقات غير متصلة.
              </p>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-[#1C4E46]/10 dark:border-[#E0A96D]/15">
              {onStartSession && (
                <button
                  type="button"
                  disabled={!inspectedPage.segments[0]}
                  onClick={() => {
                    const firstSegment = inspectedPage.segments[0];
                    if (!firstSegment) return;
                    onStartSession(firstSegment.surahNumber, firstSegment.startAyah, firstSegment.endAyah);
                    setInspectedPage(null);
                  }}
                  className="flex min-h-11 items-center gap-1.5 px-3.5 py-2 bg-[#1C4E46] hover:bg-[#28665B] dark:bg-[#C59B27] dark:hover:bg-[#E0A96D] text-white dark:text-[#0B132B] rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{inspectedPage.segments.length > 1 ? 'فتح أول مقطع من الصفحة' : 'فتح الصفحة في جلسة التسميع'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setInspectedPage(null)}
                className="min-h-11 px-4 py-2 bg-[#F2EDE2] dark:bg-[#162744] hover:bg-[#E5DEC9] text-[#142421] dark:text-[#F5F1E8] rounded-xl text-xs font-bold mr-auto"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
