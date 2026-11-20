import React, { useState, useEffect, useRef } from 'react';
import { QuranText } from '../shared/QuranText';
import { 
  Repeat, 
  CheckCircle2, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  Play, 
  Sparkles, 
  Plus,
  BookOpen,
  Filter,
  Check,
  X,
  History,
  TrendingUp,
  Award,
  ChevronLeft,
  Search,
  BookmarkCheck,
  HelpCircle,
  BarChart2
} from 'lucide-react';
import { 
  PortionStatusRecord, 
  PortionMemorizationStatus, 
  RevisionRating, 
  WeakVerseItem, 
  UserProfile 
} from '../../types/quran';
import { RetentionService, RetentionMetrics } from '../../services/retentionService';
import { StorageService, STORAGE_KEYS } from '../../services/storageService';
import { persistJournaledSnapshot, persistJournaledTransaction, persistPortionsSnapshot } from '../../services/journaledSnapshotService';
import { getLocalDateString } from '../../services/unifiedPortionService';
import { ALL_SURAHS } from '../../data/quranMeta';
import { loadAyahByCoordinate, loadSimpleAyahText } from '../../data/quranDataLoader';
import { buildWeakVerseFailureTransaction, buildWeakVerseResolutionSnapshot } from '../../services/weakVerseRecording';
import { createSecureId } from '../../services/secureId';
import type { RevisionRatedEvent, WeakVerseFailedEvent, WeakVerseResolvedEvent } from '../../services/domainEvents';

import { HorizontalScrollRail } from '../shared/HorizontalScrollRail';
import { SurahPickerControl } from '../shared/SurahPickerControl';
import { ReadingDisplaySettingsMenu, useReadingDisplayPreferences } from '../shared/DisplaySettingsMenu';
import { READING_PAGE_WIDTH_CLASSES } from '../../services/readingDisplayPreferences';

interface RevisionCenterViewProps {
  profile: UserProfile;
  onStartSession?: (surahNumber: number, startAyah: number, endAyah: number, mode?: 'memorize' | 'review') => void;
  onOpenAdvisor?: () => void;
}

type RevisionTab = 'daily_queue' | 'weekly_overview' | 'weak_verses' | 'history' | 'retention_dashboard';

const STATUS_LABELS: Record<PortionMemorizationStatus, { label: string; bg: string; text: string; border: string; dot: string }> = {
  stable: { label: 'راسخ ومتقن', bg: 'bg-[#1C4E46]/10 dark:bg-[#1E4A47]/40', text: 'text-[#1C4E46] dark:text-[#6EE7B7]', border: 'border-[#1C4E46]/25 dark:border-[#1E4A47]', dot: 'bg-[#1C4E46] dark:bg-[#6EE7B7]' },
  recently_memorized: { label: 'محفوظ حديثاً', bg: 'bg-sky-50 dark:bg-sky-950/40', text: 'text-sky-800 dark:text-sky-300', border: 'border-sky-200 dark:border-sky-800/60', dot: 'bg-sky-600 dark:bg-sky-400' },
  needs_revision: { label: 'يحتاج مراجعة', bg: 'bg-[#C59B27]/12 dark:bg-[#E0A96D]/15', text: 'text-[#9A7415] dark:text-[#E0A96D]', border: 'border-[#C59B27]/35 dark:border-[#E0A96D]/35', dot: 'bg-[#C59B27] dark:bg-[#E0A96D]' },
  weak: { label: 'ضعيف ويتفلت', bg: 'bg-rose-50 dark:bg-rose-950/40', text: 'text-rose-800 dark:text-rose-300', border: 'border-rose-200 dark:border-rose-800/60', dot: 'bg-rose-600 dark:bg-rose-400' },
  currently_memorizing: { label: 'قيد الحفظ', bg: 'bg-purple-50 dark:bg-purple-950/40', text: 'text-purple-800 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800/60', dot: 'bg-purple-600 dark:bg-purple-400' },
  not_memorized: { label: 'غير محفوظ', bg: 'bg-[#F2EDE2]/70 dark:bg-[#162744]/50', text: 'text-[#5B6F6B] dark:text-[#8B9E9B]', border: 'border-[#1C4E46]/15 dark:border-[#E0A96D]/20', dot: 'bg-[#5B6F6B] dark:bg-[#8B9E9B]' }
};

const PORTION_STATUS_OPTIONS: Array<{ value: PortionMemorizationStatus; label: string; hint: string }> = [
  { value: 'recently_memorized', label: 'محفوظ حديثاً', hint: 'مراجعة قريبة' },
  { value: 'stable', label: 'راسخ ومتقن', hint: 'مراجعة متباعدة' },
  { value: 'needs_revision', label: 'يحتاج مراجعة', hint: 'تثبيت قريب' },
  { value: 'weak', label: 'ضعيف ويتفلت', hint: 'مراجعة يومية' },
  { value: 'currently_memorizing', label: 'قيد الحفظ', hint: 'جاري التسميع' }
];

export const RevisionCenterView: React.FC<RevisionCenterViewProps> = ({
  profile,
  onStartSession,
  onOpenAdvisor
}) => {
  const {
    preferences: displayPreferences,
    updatePreferences: updateDisplayPreferences,
    resetPreferences: resetDisplayPreferences,
  } = useReadingDisplayPreferences('revision');
  const [activeTab, setActiveTab] = useState<RevisionTab>('daily_queue');
  const [portions, setPortions] = useState<PortionStatusRecord[]>(() => RetentionService.getPortions());
  const [weakVerses, setWeakVerses] = useState<WeakVerseItem[]>(() => {
    try { return RetentionService.getWeakVerses(); } catch { return []; }
  });
  const [metrics, setMetrics] = useState<RetentionMetrics>(() => RetentionService.getRetentionDashboardMetrics());
  
  // Feedback toast banner
  const [actionFeedback, setActionFeedback] = useState<{ message: string; type: 'success' | 'warn' | 'info' } | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  // Active review drawer / modal for rating a portion
  const [ratingPortion, setRatingPortion] = useState<PortionStatusRecord | null>(null);
  const ratingDialogRef = useRef<HTMLDivElement>(null);
  const ratingCloseRef = useRef<HTMLButtonElement>(null);
  const ratingTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [weakAyahNum, setWeakAyahNum] = useState<number | ''>('');
  const [ratingWeakAyahPreview, setRatingWeakAyahPreview] = useState('');
  const [isSavingRating, setIsSavingRating] = useState(false);

  useEffect(() => {
    if (!ratingPortion || weakAyahNum === '') {
      setRatingWeakAyahPreview('');
      return;
    }
    const ayahNum = Number(weakAyahNum);
    if (!Number.isSafeInteger(ayahNum) || ayahNum < ratingPortion.startAyah || ayahNum > ratingPortion.endAyah) {
      setRatingWeakAyahPreview('');
      return;
    }
    let active = true;
    loadAyahByCoordinate(ratingPortion.surahNumber, ayahNum)
      .then(ayah => {
        if (active) setRatingWeakAyahPreview(ayah?.text || '');
      })
      .catch(() => {
        if (active) setRatingWeakAyahPreview('');
      });
    return () => { active = false; };
  }, [ratingPortion, weakAyahNum]);

  useEffect(() => {
    if (!ratingPortion) return;
    const trigger = ratingTriggerRef.current;
    ratingCloseRef.current?.focus();

    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isSavingRating) return;
        event.preventDefault();
        setRatingPortion(null);
        setReviewNotes('');
        setWeakAyahNum('');
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = ratingDialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
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

    document.addEventListener('keydown', handleDialogKeyDown);
    return () => {
      document.removeEventListener('keydown', handleDialogKeyDown);
      (ratingTriggerRef.current ?? trigger)?.focus();
    };
  }, [ratingPortion, isSavingRating]);

  const ratingInFlightRef = useRef(false);
  const ratingMutationKeyRef = useRef<string | null>(null);
  const ratingMutationIdRef = useRef<string | null>(null);
  const ratingMutationOccurredAtRef = useRef<string | null>(null);
  const weakVerseMutationIdRef = useRef<string | null>(null);
  const weakVerseMutationOccurredAtRef = useRef<string | null>(null);
  const weakVerseMutationKeyRef = useRef<string | null>(null);
  const weakVerseInFlightRef = useRef(false);
  const [isSavingWeakVerse, setIsSavingWeakVerse] = useState(false);
  const weakVerseResolutionMutationIdsRef = useRef<Map<string, string>>(new Map());
  const weakVerseResolutionOccurredAtRef = useRef<Map<string, string>>(new Map());
  const weakVerseResolutionInFlightRef = useRef<Set<string>>(new Set());

  // Add new portion modal
  const [isAddPortionModalOpen, setIsAddPortionModalOpen] = useState(false);
  const addPortionDialogRef = useRef<HTMLDivElement>(null);
  const addPortionCloseRef = useRef<HTMLButtonElement>(null);
  const addPortionTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [newSurahNum, setNewSurahNum] = useState(67);
  const [newStartAyah, setNewStartAyah] = useState(1);
  const [newEndAyah, setNewEndAyah] = useState(15);
  const [newStatus, setNewStatus] = useState<PortionMemorizationStatus>('recently_memorized');

  // Add manual weak verse modal
  const [isAddWeakVerseModalOpen, setIsAddWeakVerseModalOpen] = useState(false);
  const addWeakVerseDialogRef = useRef<HTMLDivElement>(null);
  const addWeakVerseCloseRef = useRef<HTMLButtonElement>(null);
  const addWeakVerseTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [weakSurahNum, setWeakSurahNum] = useState(67);
  const [manualWeakAyahNum, setManualWeakAyahNum] = useState(1);
  const [manualWeakText, setManualWeakText] = useState('');
  const [manualWeakNotes, setManualWeakNotes] = useState('');

  useEffect(() => {
    if (!isAddWeakVerseModalOpen) return;
    let active = true;
    loadAyahByCoordinate(weakSurahNum, manualWeakAyahNum)
      .then(ayah => {
        if (active && ayah?.text) setManualWeakText(ayah.text);
      })
      .catch(() => { /* Keep existing input if local chunk is unavailable. */ });
    return () => { active = false; };
  }, [isAddWeakVerseModalOpen, weakSurahNum, manualWeakAyahNum]);

  useEffect(() => {
    const activeDialog = isAddPortionModalOpen ? 'portion' : isAddWeakVerseModalOpen ? 'weakVerse' : null;
    if (!activeDialog) return;

    const dialog = activeDialog === 'portion' ? addPortionDialogRef.current : addWeakVerseDialogRef.current;
    const initialFocus = activeDialog === 'portion' ? addPortionCloseRef.current : addWeakVerseCloseRef.current;
    const trigger = activeDialog === 'portion' ? addPortionTriggerRef.current : addWeakVerseTriggerRef.current;
    initialFocus?.focus();

    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (activeDialog === 'portion') setIsAddPortionModalOpen(false);
        else setIsAddWeakVerseModalOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
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

    document.addEventListener('keydown', handleDialogKeyDown);
    return () => {
      document.removeEventListener('keydown', handleDialogKeyDown);
      trigger?.focus();
    };
  }, [isAddPortionModalOpen, isAddWeakVerseModalOpen]);

  // Search in weak verses
  const [weakSearchQuery, setWeakSearchQuery] = useState('');
  const [weakSimpleTexts, setWeakSimpleTexts] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    Promise.all(weakVerses.map(async verse => {
      const key = `${verse.surahNumber}:${verse.ayahNumber}`;
      const text = await loadSimpleAyahText(verse.surahNumber, verse.ayahNumber);
      return [key, text] as const;
    })).then(entries => {
      if (active) setWeakSimpleTexts(Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => Boolean(entry[1]))));
    }).catch(error => console.warn('[WIRD Revision] Could not load Simple text for weak-verse search:', error));
    return () => { active = false; };
  }, [weakVerses]);

  const refreshAll = () => {
    setPortions(RetentionService.getPortions());
    try {
      setWeakVerses(RetentionService.getWeakVerses());
    } catch (error) {
      // Keep the damaged archive untouched and make the recovery state visible.
      setActionFeedback({
        message: error instanceof Error ? error.message : 'تعذر قراءة سجل الآيات المتعثرة؛ لم يتم تغييره.',
        type: 'warn'
      });
    }
    setMetrics(RetentionService.getRetentionDashboardMetrics());
  };

  useEffect(() => {
    refreshAll();
  }, []);

  const todayStr = getLocalDateString();
  const dailyQueue = RetentionService.getDailyRevisionQueue(todayStr);
  const weeklyOverview = RetentionService.getWeeklyRevisionOverview(todayStr);
  const revisionHistory = RetentionService.getRevisionHistory();

  // Journal the canonical portion, activity, profile, and optional weak-verse update as one action.
  const handleRatePortion = async (
    rating: RevisionRating,
    portionOverride?: PortionStatusRecord
  ) => {
    const selectedPortion = portionOverride || ratingPortion;
    if (!selectedPortion || ratingInFlightRef.current) return;

    const mutationKey = [
      selectedPortion.id,
      rating,
      reviewNotes,
      rating === 'failed' ? weakAyahNum : ''
    ].join('|');
    if (ratingMutationKeyRef.current !== mutationKey) {
      ratingMutationKeyRef.current = mutationKey;
      ratingMutationIdRef.current = 'revision-' + createSecureId();
      ratingMutationOccurredAtRef.current = new Date().toISOString();
    }
    const mutationId = ratingMutationIdRef.current || 'revision-' + createSecureId();
    ratingMutationIdRef.current = mutationId;

    ratingInFlightRef.current = true;
    setIsSavingRating(true);
    try {
      let weakDetails: { ayahNumber: number; text: string; notes: string } | undefined;
      if (rating === 'failed' && weakAyahNum) {
        const ayahNumber = Number(weakAyahNum);
        if (!Number.isSafeInteger(ayahNumber) ||
            ayahNumber < selectedPortion.startAyah || ayahNumber > selectedPortion.endAyah) {
          throw new Error('الآية المتعثرة يجب أن تقع داخل نطاق المقطع الذي تتم مراجعته.');
        }
        const foundAyah = await loadAyahByCoordinate(selectedPortion.surahNumber, ayahNumber).catch(() => undefined);
        if (!foundAyah?.text) {
          throw new Error('تعذر تحميل نص الآية من مصدر القرآن؛ لم يتم تسجيل نص بديل أو تعديل تقييم المراجعة.');
        }
        weakDetails = {
          ayahNumber,
          text: foundAyah.text,
          notes: reviewNotes || 'خطأ متكرر أثناء المراجعة'
        };
      }

      const prepared = RetentionService.buildRevisionPerformanceSnapshot(
        selectedPortion.id,
        rating,
        reviewNotes,
        0,
        mutationId
      );
      if (!prepared.success) throw new Error(prepared.messageAr);

      let operations = prepared.operations;
      if (weakDetails) {
        const weakPrepared = buildWeakVerseFailureTransaction({
          surahNumber: selectedPortion.surahNumber,
          surahName: selectedPortion.surahName,
          ayahNumber: weakDetails.ayahNumber,
          text: weakDetails.text,
          notes: weakDetails.notes
        }, mutationId, prepared.operations[0].payload.records as PortionStatusRecord[]);
        if (!weakPrepared.success) throw new Error(weakPrepared.messageAr);

        const isSameSingleVerse =
          selectedPortion.startAyah === weakDetails.ayahNumber &&
          selectedPortion.endAyah === weakDetails.ayahNumber;
        operations = [
          isSameSingleVerse ? prepared.operations[0] : weakPrepared.operations[0],
          weakPrepared.operations[1],
          ...prepared.operations.slice(1)
        ];
      }

      const domainEvent: RevisionRatedEvent = {
        schemaVersion: 1,
        id: mutationId,
        type: 'revision.rated',
        occurredAt: ratingMutationOccurredAtRef.current || new Date().toISOString(),
        payload: {
          portionId: selectedPortion.id,
          surahNumber: selectedPortion.surahNumber,
          startAyah: selectedPortion.startAyah,
          endAyah: selectedPortion.endAyah,
          rating,
          ...(reviewNotes ? { notes: reviewNotes } : {}),
          ...(weakDetails ? { weakAyahNumber: weakDetails.ayahNumber } : {})
        }
      };
      const result = await persistJournaledTransaction(operations, {}, mutationId, domainEvent);
      const expectedPortions = operations.find(operation => operation.collection === 'portions')?.payload.records;
      const expectedWeakVerses = operations.find(operation => operation.collection === 'weakVerses')?.payload.records;
      const expectedActivity = operations.find(operation => operation.collection === 'activityEvents')?.payload.records;
      const expectedProfile = operations.find(operation => operation.collection === 'profile')?.payload.profile;
      let projectionsMatch = false;
      try {
        projectionsMatch = Boolean(
          expectedPortions && StorageService.verifyRawItem(STORAGE_KEYS.UNIFIED_PORTIONS, (JSON.stringify(expectedPortions) ?? '')) &&
          expectedActivity && StorageService.verifyRawItem(STORAGE_KEYS.LOGS, (JSON.stringify(expectedActivity) ?? '')) &&
          expectedProfile && StorageService.verifyRawItem(STORAGE_KEYS.PROFILE, (JSON.stringify(expectedProfile) ?? '')) &&
          (expectedWeakVerses === undefined ||
            StorageService.verifyRawItem(STORAGE_KEYS.WEAK_VERSES, (JSON.stringify(expectedWeakVerses) ?? '')))
        );
      } catch {
        projectionsMatch = false;
      }

      if (!result.success && !(result.recoveredPriorEvents && projectionsMatch)) {
        if (result.recoveredPriorEvents) refreshAll();
        setActionFeedback({
          message: result.recoveredPriorEvents
            ? 'استعدنا عمليات سابقة وحدّثنا بيانات المراجعة؛ تحقق من حالة المقطع قبل إعادة المحاولة.'
            : result.queued
              ? 'حُفظ تقييم المراجعة في سجل الاستعادة، لكن تعذر تطبيقه محلياً. حدّث الصفحة قبل أي محاولة أخرى.'
              : result.error || 'تعذر حفظ تقييم المراجعة؛ لم يتم تأكيد التغيير.',
          type: 'warn'
        });
        return;
      }

      ratingMutationKeyRef.current = null;
      ratingMutationIdRef.current = null;
      ratingMutationOccurredAtRef.current = null;
      setActionFeedback({
        message: prepared.messageAr,
        type: rating === 'successful' ? 'success' : rating === 'difficult' ? 'info' : 'warn'
      });
      setRatingPortion(null);
      setReviewNotes('');
      setWeakAyahNum('');
      refreshAll();

      if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = window.setTimeout(() => {
        setActionFeedback(null);
        feedbackTimerRef.current = null;
      }, 5000);
    } catch (error) {
      setActionFeedback({
        message: error instanceof Error ? error.message : 'تعذر حفظ تقييم المراجعة؛ لم يتم تأكيد التغيير.',
        type: 'warn'
      });
    } finally {
      ratingInFlightRef.current = false;
      setIsSavingRating(false);
    }
  };

  // Handle adding new portion
  const handleAddNewPortion = async (e: React.FormEvent) => {
    e.preventDefault();
    const surah = ALL_SURAHS.find(s => s.number === newSurahNum);
    if (!surah) return;

    let updatedPortions: PortionStatusRecord[];
    try {
      const snapshot = RetentionService.buildAddPortionSnapshot({
        type: 'passage',
        surahNumber: newSurahNum,
        surahName: surah.name,
        startAyah: newStartAyah,
        endAyah: newEndAyah,
        pageNumber: surah.pageStart,
        juzNumber: surah.juzStart,
        status: newStatus,
        lastReviewedDate: todayStr,
        nextDueDate: todayStr,
        intervalDays: newStatus === 'stable' ? 7 : newStatus === 'weak' ? 1 : 2,
        easeFactor: 2.5,
        repetitionCount: newStatus === 'stable' ? 4 : 1,
        mistakesCount: newStatus === 'weak' ? 2 : 0
      });
      updatedPortions = snapshot.portions;
    } catch (error) {
      setActionFeedback({ message: error instanceof Error ? error.message : 'تعذر إعداد المقطع الجديد.', type: 'warn' });
      return;
    }

    const result = await persistPortionsSnapshot(updatedPortions);
    if (!result.success) {
      if (result.recoveredPriorEvents) refreshAll();
      setActionFeedback({
        message: result.recoveredPriorEvents
          ? 'استعدنا تقدمًا سابقًا وحدّثنا بيانات المقاطع؛ لم ننفذ الإضافة الجديدة. راجع الحالة ثم أعد المحاولة.'
          : result.queued
            ? 'تم حفظ إضافة المقطع في سجل الاستعادة، لكن تعذر تطبيقها محلياً.'
            : result.recoveryBlocked
              ? 'تعذر تأمين الحفظ أو استعادة سجل سابق؛ لم نضف المقطع الجديد.'
              : 'تعذر حفظ المقطع الجديد في التخزين المحلي؛ لم يتم تأكيد التغيير.',
        type: 'warn'
      });
      return;
    }

    setIsAddPortionModalOpen(false);
    refreshAll();
    setActionFeedback({
      message: `تمت إضافة مقطع سورة ${surah.name} بنجاح إلى منظومة المتابعة.`,
      type: 'success'
    });
  };

  // Resolve a weak verse through a stable, journal-first snapshot mutation.
  const handleResolveWeakVerse = async (id: string, ayahRef: string) => {
    if (weakVerseResolutionInFlightRef.current.has(id)) return;
    const prepared = buildWeakVerseResolutionSnapshot(id);
    if (!prepared.success) {
      setActionFeedback({ message: prepared.messageAr, type: 'warn' });
      return;
    }
    if (!prepared.changed) {
      refreshAll();
      setActionFeedback({
        message: `الآية ${ayahRef} غير موجودة بالفعل في قائمة الآيات الملتبسة؛ لم يتم إنشاء تغيير جديد.`,
        type: 'info'
      });
      return;
    }

    const resolvedWeakVerse = RetentionService.getWeakVerses().find(item => item.id === id);
    if (!resolvedWeakVerse) {
      setActionFeedback({ message: 'لم نعثر على بيانات الآية الأصلية؛ لم يتم تسجيل حدث إزالة غير مكتمل.', type: 'warn' });
      return;
    }
    let mutationId = weakVerseResolutionMutationIdsRef.current.get(id);
    if (!mutationId) {
      mutationId = 'weak-resolve-' + createSecureId();
      weakVerseResolutionMutationIdsRef.current.set(id, mutationId);
      weakVerseResolutionOccurredAtRef.current.set(id, new Date().toISOString());
    }
    weakVerseResolutionInFlightRef.current.add(id);
    let result: Awaited<ReturnType<typeof persistJournaledSnapshot>>;
    try {
      result = await persistJournaledSnapshot(
        {
          mutationId,
          collection: 'weakVerses',
          documentId: 'snapshot',
          operation: 'upsert',
          payload: {
            records: prepared.records,
            baseSnapshotFingerprint: prepared.baseSnapshotFingerprint,
            domainEvent: {
              schemaVersion: 1,
              id: mutationId,
              type: 'weak_verse.resolved' as const,
              occurredAt: weakVerseResolutionOccurredAtRef.current.get(id) || new Date().toISOString(),
              payload: {
                weakVerseId: id,
                surahNumber: resolvedWeakVerse.surahNumber,
                ayahNumber: resolvedWeakVerse.ayahNumber
              }
            } satisfies WeakVerseResolvedEvent
          }
        },
        () => RetentionService.saveWeakVerses(prepared.records)
      );
    } catch (error) {
      weakVerseResolutionInFlightRef.current.delete(id);
      setActionFeedback({
        message: error instanceof Error ? error.message : 'تعذر حفظ تحديث قائمة الآيات المتعثرة.',
        type: 'warn'
      });
      return;
    }
    weakVerseResolutionInFlightRef.current.delete(id);

    let projectionMatches = false;
    try {
      projectionMatches = JSON.stringify(RetentionService.getWeakVerses()) === JSON.stringify(prepared.records);
    } catch {
      projectionMatches = false;
    }
    if (!result.success && !(result.recoveredPriorEvents && projectionMatches)) {
      if (result.recoveredPriorEvents) refreshAll();
      setActionFeedback({
        message: result.recoveredPriorEvents
          ? 'استعدنا تغييرات سابقة وحدّثنا القائمة؛ تحقق من حالة الآية قبل إعادة المحاولة.'
          : result.queued
            ? 'حُفظ حذف الآية في سجل الاستعادة، لكن تعذر تطبيقه محلياً. حدّث الصفحة قبل أي محاولة أخرى.'
            : result.error || 'تعذر حفظ تحديث قائمة الآيات المتعثرة.',
        type: 'warn'
      });
      return;
    }

    weakVerseResolutionMutationIdsRef.current.delete(id);
    weakVerseResolutionOccurredAtRef.current.delete(id);
    refreshAll();
    setActionFeedback({
      message: `تمت إزالة ${ayahRef} من قائمة الآيات الملتبسة فقط؛ لم يتغير تقييم المقطع أو موعد مراجعته.`,
      type: 'success'
    });
  };

  // Handle adding manual weak verse
  const handleAddManualWeakVerse = async (e: React.FormEvent) => {
    e.preventDefault();
    const surah = ALL_SURAHS.find(s => s.number === weakSurahNum);
    if (!surah) return;

    const found = await loadAyahByCoordinate(weakSurahNum, manualWeakAyahNum).catch(() => undefined);
    const text = found?.text || manualWeakText.trim();
    if (!text) {
      setActionFeedback({
        message: 'تعذر تحميل نص الآية من مصدر القرآن؛ أدخل النص القرآني الصحيح أو حاول مجددًا. لم يتم تسجيل نص بديل.',
        type: 'warn'
      });
      return;
    }

    if (weakVerseInFlightRef.current) return;
    const mutationKey = [weakSurahNum, manualWeakAyahNum, text, manualWeakNotes].join('|');
    if (weakVerseMutationKeyRef.current !== mutationKey) {
      weakVerseMutationKeyRef.current = mutationKey;
      weakVerseMutationIdRef.current = 'weak-' + createSecureId();
      weakVerseMutationOccurredAtRef.current = new Date().toISOString();
    }
    const mutationId = weakVerseMutationIdRef.current || 'weak-' + createSecureId();
    weakVerseMutationIdRef.current = mutationId;
    const prepared = buildWeakVerseFailureTransaction({
      surahNumber: weakSurahNum,
      surahName: surah.name,
      ayahNumber: manualWeakAyahNum,
      text,
      notes: manualWeakNotes || 'تمت إضافتها يدوياً للتركيز'
    }, mutationId);
    if (!prepared.success) {
      weakVerseMutationIdRef.current = null;
      weakVerseMutationKeyRef.current = null;
      weakVerseMutationOccurredAtRef.current = null;
      setActionFeedback({ message: prepared.messageAr, type: 'warn' });
      return;
    }

    weakVerseInFlightRef.current = true;
    setIsSavingWeakVerse(true);
    let result: Awaited<ReturnType<typeof persistJournaledTransaction>>;
    try {
      const domainEvent: WeakVerseFailedEvent = {
        schemaVersion: 1,
        id: mutationId,
        type: 'weak_verse.failed',
        occurredAt: weakVerseMutationOccurredAtRef.current || new Date().toISOString(),
        payload: {
          surahNumber: weakSurahNum,
          ayahNumber: manualWeakAyahNum,
          ...(manualWeakNotes ? { notes: manualWeakNotes } : {})
        }
      };
      result = await persistJournaledTransaction(prepared.operations, {}, mutationId, domainEvent);
    } catch (error) {
      weakVerseInFlightRef.current = false;
      setActionFeedback({ message: error instanceof Error ? error.message : 'تعذر حفظ الآية المتعثرة؛ لم يتم تأكيد التغيير.', type: 'warn' });
      return;
    }
    weakVerseInFlightRef.current = false;
    setIsSavingWeakVerse(false);
    let projectionsMatch = false;
    try {
      projectionsMatch = JSON.stringify(RetentionService.getPortions()) ===
          JSON.stringify(prepared.operations[0].payload.records) &&
        JSON.stringify(RetentionService.getWeakVerses()) ===
          JSON.stringify(prepared.operations[1].payload.records);
    } catch {
      projectionsMatch = false;
    }
    if (!result.success && !(result.recoveredPriorEvents && projectionsMatch)) {
      if (result.recoveredPriorEvents) {
        // Retain the mutation ID: if this action was part of the recovered batch,
        // reusing it prevents a second increment from being recorded.
        refreshAll();
      }
      setActionFeedback({
        message: result.recoveredPriorEvents
          ? 'استعدنا تغييراً سابقاً وحدّثنا البيانات؛ راجع سجل الآية قبل إعادة المحاولة.'
          : result.queued
            ? 'حُفظت العملية في سجل الاستعادة، لكن تعذر تطبيقها محلياً. حدّث الصفحة قبل أي محاولة أخرى.'
            : result.error || 'تعذر حفظ الآية المتعثرة؛ لم يتم تأكيد التغيير.',
        type: 'warn'
      });
      return;
    }

    weakVerseMutationIdRef.current = null;
    weakVerseMutationKeyRef.current = null;
    weakVerseMutationOccurredAtRef.current = null;
    setIsAddWeakVerseModalOpen(false);
    setManualWeakText('');
    setManualWeakNotes('');
    refreshAll();
    setActionFeedback({
      message: `تمت إضافة الآية ${manualWeakAyahNum} من سورة ${surah.name} إلى قائمة الآيات الملتبسة.`,
      type: 'info'
    });
  };

  const filteredWeakVerses = weakVerses.filter(v => 
    v.surahName.includes(weakSearchQuery) ||
    v.text.includes(weakSearchQuery) ||
    (weakSimpleTexts[`${v.surahNumber}:${v.ayahNumber}`] || '').includes(weakSearchQuery) ||
    (v.notes && v.notes.includes(weakSearchQuery))
  );

  const revisionSpacingGapClass =
    displayPreferences.spacing === 'compact'
      ? 'gap-3'
      : displayPreferences.spacing === 'relaxed'
      ? 'gap-6'
      : 'gap-4';
  const revisionCardPaddingClass =
    displayPreferences.spacing === 'compact'
      ? 'p-4'
      : displayPreferences.spacing === 'relaxed'
      ? 'p-6 md:p-7'
      : 'p-5';
  const weakVerseLineHeight =
    displayPreferences.spacing === 'compact'
      ? 2.0
      : displayPreferences.spacing === 'relaxed'
      ? 2.75
      : 2.35;
  const selectedNewSurahMax = ALL_SURAHS.find(s => s.number === newSurahNum)?.versesCount || 286;

  return (
    <div
      className={`space-y-6 ${READING_PAGE_WIDTH_CLASSES[displayPreferences.pageWidth]} mx-auto transition-all`}
    >
      {/* 1. Header Banner */}
      <div className="wird-card rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#142421] dark:text-[#F5F1E8] flex items-center gap-2 font-quran">
              <Repeat className="w-5 h-5 text-[#1C4E46] dark:text-[#E0A96D]" />
              مركز المراجعة ومنظومة قياس جودة الرسوخ
            </h2>
            <p className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B] mt-1">
              خوارزمية التكرار المتباعد التكيفية لمتابعة محفوظك القرآني وتثبيت المتشابهات والمتفلتات
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              ref={addWeakVerseTriggerRef}
              type="button"
              onClick={() => setIsAddWeakVerseModalOpen(true)}
              className="flex min-h-11 items-center gap-1.5 px-3.5 py-2 bg-[#C59B27]/12 dark:bg-[#E0A96D]/15 text-[#9A7415] dark:text-[#E0A96D] hover:bg-[#C59B27]/20 rounded-xl text-xs font-bold border border-[#C59B27]/35 dark:border-[#E0A96D]/35 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27]"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>تسجيل آية ملتبسة</span>
            </button>

            <button
              ref={addPortionTriggerRef}
              type="button"
              onClick={() => setIsAddPortionModalOpen(true)}
              className="flex min-h-11 items-center gap-1.5 px-4 py-2 bg-[#1C4E46] hover:bg-[#28665B] dark:bg-[#1E4A47] dark:hover:bg-[#255C58] text-white rounded-xl text-xs font-bold transition-all shadow-xs border border-[#C59B27]/30 dark:border-[#E0A96D]/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27]"
            >
              <Plus className="w-4 h-4 text-[#E0A96D]" />
              <span>إضافة مقطع متابعة جديد</span>
            </button>
          </div>
        </div>

        {/* Global Action Feedback Alert */}
        {actionFeedback && (
          <div role="status" aria-live="polite" className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${
            actionFeedback.type === 'success' 
              ? 'bg-[#1C4E46]/10 dark:bg-[#1E4A47]/40 border-[#1C4E46]/30 dark:border-[#6EE7B7]/30 text-[#1C4E46] dark:text-[#6EE7B7]' 
              : actionFeedback.type === 'warn'
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
              : 'bg-[#C59B27]/12 dark:bg-[#E0A96D]/15 border-[#C59B27]/35 text-[#9A7415] dark:text-[#E0A96D]'
          }`}>
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{actionFeedback.message}</span>
            </div>
            <button type="button" aria-label="إغلاق التنبيه" onClick={() => setActionFeedback(null)} className="min-h-11 min-w-11 flex items-center justify-center opacity-70 hover:opacity-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <ReadingDisplaySettingsMenu
          viewLabel="مركز المراجعة"
          preferences={displayPreferences}
          onUpdate={updateDisplayPreferences}
          onReset={resetDisplayPreferences}
          fontLabel="حجم خط الآيات"
        />

        {/* Navigation Tabs (5 Views) with smooth horizontal scroll */}
        <HorizontalScrollRail
          ariaLabel="أقسام مركز المراجعة"
          activeKey={activeTab}
          className="border-t border-[#1C4E46]/10 dark:border-[#E0A96D]/15 pt-3"
          contentClassName="gap-2"
        >
          <button
            type="button"
            onClick={() => setActiveTab('daily_queue')}
            aria-pressed={activeTab === 'daily_queue'}
            className={`flex min-h-11 shrink-0 snap-start items-center gap-2 px-3.5 py-2 rounded-xl transition-all border text-xs font-bold whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27] ${
              activeTab === 'daily_queue'
                ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white border-[#C59B27] dark:border-[#E0A96D] shadow-xs'
                : 'bg-[#F2EDE2]/70 dark:bg-[#162744] text-[#5B6F6B] dark:text-[#8B9E9B] border-transparent hover:text-[#142421] dark:hover:text-[#F5F1E8]'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>طابور المراجعة اليومي</span>
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono tabular-nums ${
              activeTab === 'daily_queue'
                ? 'bg-[#C59B27] text-[#0B132B] font-bold'
                : dailyQueue.length > 0 
                ? 'bg-[#1C4E46] text-white font-bold' 
                : 'bg-white/70 dark:bg-[#0B132B]/70 text-[#5B6F6B] dark:text-[#8B9E9B]'
            }`}>
              {dailyQueue.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('weekly_overview')}
            aria-pressed={activeTab === 'weekly_overview'}
            className={`flex min-h-11 shrink-0 snap-start items-center gap-2 px-3.5 py-2 rounded-xl transition-all border text-xs font-bold whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27] ${
              activeTab === 'weekly_overview'
                ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white border-[#C59B27] dark:border-[#E0A96D] shadow-xs'
                : 'bg-[#F2EDE2]/70 dark:bg-[#162744] text-[#5B6F6B] dark:text-[#8B9E9B] border-transparent hover:text-[#142421] dark:hover:text-[#F5F1E8]'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>نظرة أسبوعية للمراجعات</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('weak_verses')}
            aria-pressed={activeTab === 'weak_verses'}
            className={`flex min-h-11 shrink-0 snap-start items-center gap-2 px-3.5 py-2 rounded-xl transition-all border text-xs font-bold whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27] ${
              activeTab === 'weak_verses'
                ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white border-[#C59B27] dark:border-[#E0A96D] shadow-xs'
                : 'bg-[#F2EDE2]/70 dark:bg-[#162744] text-[#5B6F6B] dark:text-[#8B9E9B] border-transparent hover:text-[#142421] dark:hover:text-[#F5F1E8]'
            }`}
          >
            <AlertTriangle className={`w-4 h-4 ${activeTab === 'weak_verses' ? 'text-[#E0A96D]' : 'text-[#C59B27] dark:text-[#E0A96D]'}`} />
            <span>الآيات الملتبسة والصعبة</span>
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono tabular-nums ${
              activeTab === 'weak_verses'
                ? 'bg-[#C59B27] text-[#0B132B]'
                : 'bg-[#C59B27]/20 dark:bg-[#E0A96D]/20 text-[#9A7415] dark:text-[#E0A96D]'
            }`}>
              {weakVerses.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            aria-pressed={activeTab === 'history'}
            className={`flex min-h-11 shrink-0 snap-start items-center gap-2 px-3.5 py-2 rounded-xl transition-all border text-xs font-bold whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27] ${
              activeTab === 'history'
                ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white border-[#C59B27] dark:border-[#E0A96D] shadow-xs'
                : 'bg-[#F2EDE2]/70 dark:bg-[#162744] text-[#5B6F6B] dark:text-[#8B9E9B] border-transparent hover:text-[#142421] dark:hover:text-[#F5F1E8]'
            }`}
          >
            <History className="w-4 h-4" />
            <span>سجل المراجعات السابقة</span>
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono tabular-nums ${
              activeTab === 'history'
                ? 'bg-[#C59B27] text-[#0B132B]'
                : 'bg-white/70 dark:bg-[#0B132B]/70 text-[#5B6F6B] dark:text-[#8B9E9B]'
            }`}>
              {revisionHistory.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('retention_dashboard')}
            aria-pressed={activeTab === 'retention_dashboard'}
            className={`flex min-h-11 shrink-0 snap-start items-center gap-2 px-3.5 py-2 rounded-xl transition-all border text-xs font-bold whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27] ${
              activeTab === 'retention_dashboard'
                ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white border-[#C59B27] dark:border-[#E0A96D] shadow-xs'
                : 'bg-[#F2EDE2]/70 dark:bg-[#162744] text-[#5B6F6B] dark:text-[#8B9E9B] border-transparent hover:text-[#142421] dark:hover:text-[#F5F1E8]'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>لوحة قياس جودة الرسوخ</span>
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono tabular-nums ${
              activeTab === 'retention_dashboard'
                ? 'bg-[#C59B27] text-[#0B132B]'
                : 'bg-[#1C4E46]/15 dark:bg-[#1E4A47]/60 text-[#1C4E46] dark:text-[#E0A96D]'
            }`}>
              %{metrics.retentionScorePercentage}
            </span>
          </button>
        </HorizontalScrollRail>
      </div>

      <div className="space-y-6" style={{ zoom: displayPreferences.uiScale / 100 }}>
      {/* VIEW 1: DAILY REVISION QUEUE */}
      {activeTab === 'daily_queue' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-[#5B6F6B] dark:text-[#8B9E9B]">
            <span>المقاطع المستحقة للمراجعة اليوم (مرتبة حسب الأولوية والحاجة للتثبيت):</span>
            <span className="tabular-nums">إجمالي المقاطع المستحقة: <strong className="text-[#142421] dark:text-[#F5F1E8]">{dailyQueue.length}</strong></span>
          </div>

          {dailyQueue.length === 0 ? (
            <div className="wird-card rounded-2xl p-8 text-center space-y-3">
              <Award className="w-12 h-12 text-[#1C4E46] dark:text-[#E0A96D] mx-auto" />
              <h3 className="text-base font-bold text-[#142421] dark:text-[#F5F1E8]">
                أحسنت! أتممت جميع مراجعات اليوم بنجاح
              </h3>
              <p className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B] max-w-md mx-auto">
                لا توجد مقاطع قرآنية مستحقة للمراجعة اليوم. تم حفظ جميع الفواصل الزمنية وفق جدول التكرار المتباعد.
              </p>
            </div>
          ) : (
            <div className={`grid grid-cols-1 md:grid-cols-2 ${revisionSpacingGapClass}`}>
              {dailyQueue.map((item) => {
                const statusStyle = STATUS_LABELS[item.status];
                const versesCount = (item.endAyah - item.startAyah + 1) || 1;
                return (
                  <div 
                    key={item.id}
                    className={`wird-card rounded-2xl ${revisionCardPaddingClass} space-y-4 transition-all ${
                      item.status === 'weak' 
                        ? 'border-rose-300 dark:border-rose-800/80' 
                        : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-[#142421] dark:text-[#F5F1E8] font-quran">
                            سورة {item.surahName}
                          </h3>
                          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-bold border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                            {statusStyle.label}
                          </span>
                        </div>
                        <div className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B] mt-1 tabular-nums">
                          الآيات: {item.startAyah} إلى {item.endAyah} ({versesCount} آيات)
                          {item.pageNumber && ` • صفحة ${item.pageNumber}`}
                        </div>
                      </div>

                      <div className="text-left font-mono tabular-nums text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B]">
                        التكرار: {item.repetitionCount}x
                      </div>
                    </div>

                    {/* Stats strip */}
                    <div className="grid grid-cols-3 gap-2 bg-[#F9F6EE] dark:bg-[#0B132B]/70 p-2.5 rounded-xl border border-[#1C4E46]/10 dark:border-[#E0A96D]/15 text-[11px]">
                      <div>
                        <div className="text-[#5B6F6B] dark:text-[#8B9E9B] text-[10px]">الفاصل الحالي</div>
                        <div className="font-bold text-[#142421] dark:text-[#F5F1E8] font-mono tabular-nums">
                          {item.intervalDays} {item.intervalDays === 1 ? 'يوم' : 'أيام'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[#5B6F6B] dark:text-[#8B9E9B] text-[10px]">عامل السهولة (EF)</div>
                        <div className="font-bold text-[#142421] dark:text-[#F5F1E8] font-mono tabular-nums">
                          {item.easeFactor.toFixed(1)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[#5B6F6B] dark:text-[#8B9E9B] text-[10px]">الأخطاء السابقة</div>
                        <div className={`font-bold font-mono tabular-nums ${(item.mistakesCount || 0) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-[#1C4E46] dark:text-[#6EE7B7]'}`}>
                          {item.mistakesCount || 0}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="space-y-2 pt-1">
                      <div className="text-[11px] font-semibold text-[#5B6F6B] dark:text-[#8B9E9B]">
                        تقييم رسوخ المقطع بعد التسميع:
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          disabled={isSavingRating}
                          onClick={() => handleRatePortion('successful', item)}
                          className="min-h-11 py-2 px-1 text-center bg-[#1C4E46]/10 dark:bg-[#1E4A47]/45 hover:bg-[#1C4E46]/20 text-[#1C4E46] dark:text-[#6EE7B7] rounded-xl text-xs font-bold border border-[#1C4E46]/25 dark:border-[#6EE7B7]/30 transition-all flex flex-col items-center justify-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>ناجحة (متقن)</span>
                        </button>

                        <button
                          type="button"
                          disabled={isSavingRating}
                          onClick={() => handleRatePortion('difficult', item)}
                          className="min-h-11 py-2 px-1 text-center bg-[#C59B27]/12 dark:bg-[#E0A96D]/15 hover:bg-[#C59B27]/22 text-[#9A7415] dark:text-[#E0A96D] rounded-xl text-xs font-bold border border-[#C59B27]/35 dark:border-[#E0A96D]/35 transition-all flex flex-col items-center justify-center gap-1"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>صعبة (بتردد)</span>
                        </button>

                        <button
                          type="button"
                          disabled={isSavingRating}
                          onClick={(event) => { ratingTriggerRef.current = event.currentTarget; setRatingPortion(item); setReviewNotes(''); setWeakAyahNum(''); }}
                          className="min-h-11 py-2 px-1 text-center bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-800 dark:text-rose-300 rounded-xl text-xs font-bold border border-rose-200 dark:border-rose-800/60 transition-all flex flex-col items-center justify-center gap-1"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                          <span>غير متقنة (يتفلت)</span>
                        </button>
                      </div>

                      {/* Launch Interactive Recitation / Session button */}
                      {onStartSession && (
                        <button
                          type="button"
                          onClick={() => onStartSession(item.surahNumber, item.startAyah, item.endAyah, 'review')}
                          className="w-full mt-2 min-h-11 py-2 px-3 bg-[#F2EDE2]/75 dark:bg-[#162744] hover:bg-[#1C4E46] hover:text-white dark:hover:bg-[#1E4A47] text-[#142421] dark:text-[#F5F1E8] rounded-xl text-[11px] font-bold border border-[#1C4E46]/15 dark:border-[#E0A96D]/20 transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Play className="w-3 h-3" />
                          <span>فتح المقطع في جلسة التسميع التفاعلية</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: WEEKLY REVISION OVERVIEW */}
      {activeTab === 'weekly_overview' && (
        <div className="space-y-4">
          <div className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B]">
            توزيع المقاطع المجدولة للأيام السبعة القادمة حسب خوارزمية التكرار المتباعد:
          </div>

          <div role="region" aria-label="جدول المراجعات الأسبوعي" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-3">
            {weeklyOverview.map((day) => (
              <div 
                key={day.date}
                className={`wird-card rounded-2xl p-4 flex flex-col justify-between min-h-[220px] transition-all ${
                  day.isToday 
                    ? 'border-[#C59B27] dark:border-[#E0A96D] ring-2 ring-[#C59B27]/20 dark:ring-[#E0A96D]/20 shadow-sm' 
                    : ''
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs text-[#142421] dark:text-[#F5F1E8]">
                      {day.dayName}
                    </span>
                    {day.isToday && (
                      <span className="text-[10px] bg-[#1C4E46] dark:bg-[#E0A96D] text-white dark:text-[#0B132B] px-1.5 py-0.5 rounded-md font-bold">
                        اليوم
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-[#5B6F6B] dark:text-[#8B9E9B] font-mono tabular-nums mb-3">
                    {day.date}
                  </div>

                  {/* Scheduled Items list */}
                  <div className="space-y-2">
                    {day.portions.length === 0 ? (
                      <div className="text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B] italic py-4 text-center">
                        لا توجد مراجعات مجدولة
                      </div>
                    ) : (
                      day.portions.map(p => {
                        const statusBadge = STATUS_LABELS[p.status];
                        return (
                          <div 
                            key={p.id}
                            className="p-2 rounded-xl bg-[#F9F6EE] dark:bg-[#0B132B]/70 border border-[#1C4E46]/10 dark:border-[#E0A96D]/15 text-[11px] space-y-1"
                          >
                            <div className="font-bold text-[#142421] dark:text-[#F5F1E8] font-quran truncate">
                              {p.surahName} ({p.startAyah}-{p.endAyah})
                            </div>
                            <div className="flex items-center justify-between text-[10px]">
                              <span className={statusBadge.text}>
                                {p.status === 'weak' ? 'ضعيف' : p.status === 'needs_revision' ? 'يحتاج ضبط' : 'مراجعة دورية'}
                              </span>
                              <span className="text-[#5B6F6B] dark:text-[#8B9E9B] font-mono tabular-nums">{p.intervalDays}d</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-[#1C4E46]/10 dark:border-[#E0A96D]/15 mt-3 text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B] flex justify-between items-center">
                  <span>المجموع:</span>
                  <span className="font-bold font-mono tabular-nums text-[#142421] dark:text-[#F5F1E8]">
                    {day.portions.length}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 3: WEAK-VERSES LIST */}
      {activeTab === 'weak_verses' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute right-3 top-3.5 text-[#5B6F6B] dark:text-[#8B9E9B]" />
              <input
                type="text"
                aria-label="البحث في الآيات الملتبسة"
                placeholder="ابحث في الآيات الملتبسة أو السور..."
                value={weakSearchQuery}
                onChange={e => setWeakSearchQuery(e.target.value)}
                className="w-full min-h-11 pr-9 pl-4 py-2 bg-white dark:bg-[#111F36] rounded-xl border border-[#1C4E46]/20 dark:border-[#E0A96D]/25 text-xs text-[#142421] dark:text-[#F5F1E8] focus:ring-2 focus:ring-[#C59B27] focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B] tabular-nums">
                إجمالي الآيات المرصودة: <strong className="text-[#142421] dark:text-[#F5F1E8]">{filteredWeakVerses.length}</strong>
              </div>
              {onOpenAdvisor && (
                <button
                  type="button"
                  onClick={onOpenAdvisor}
                  className="min-h-11 px-3.5 py-2 rounded-xl bg-[#F2EDE2] dark:bg-[#162744] hover:bg-[#1C4E46] hover:text-white text-[#1C4E46] dark:text-[#E0A96D] border border-[#C59B27]/35 dark:border-[#E0A96D]/35 text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>حلّل مواضع التفلت مع المستشار</span>
                </button>
              )}
            </div>
          </div>

          {filteredWeakVerses.length === 0 ? (
            <div className="wird-card rounded-2xl p-8 text-center space-y-3">
              <BookmarkCheck className="w-12 h-12 text-[#1C4E46] dark:text-[#E0A96D] mx-auto" />
              <h3 className="text-base font-bold text-[#142421] dark:text-[#F5F1E8]">
                سجل الآيات الملتبسة نظيف ومثبت
              </h3>
              <p className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B] max-w-md mx-auto">
                لم يتم تسجيل أي آيات متعثرة حالياً. يمكنك تسجيل أي آية تلتبس عليك أثناء القراءة أو التسميع لمراجعتها دورياً.
              </p>
            </div>
          ) : (
            <div className={`grid grid-cols-1 md:grid-cols-2 ${revisionSpacingGapClass}`}>
              {filteredWeakVerses.map(item => (
                <div 
                  key={item.id}
                  className={`wird-card rounded-2xl ${revisionCardPaddingClass} border-rose-200/80 dark:border-rose-900/60 space-y-3 relative overflow-hidden`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#142421] dark:text-[#F5F1E8] font-quran">
                          سورة {item.surahName}
                        </span>
                        <span className="text-[11px] font-mono tabular-nums text-[#5B6F6B] dark:text-[#8B9E9B]">
                          الآية {item.ayahNumber}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#5B6F6B] dark:text-[#8B9E9B] mt-0.5 tabular-nums">
                        آخر تعثر: {item.lastFailedDate}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-[11px] font-bold font-mono tabular-nums">
                      <span>تكرار الخطأ:</span>
                      <span>{item.mistakeCount}x</span>
                    </div>
                  </div>

                  {/* Ayah Text in Uthmani Quranic Font */}
                  <div
                    className="p-3 bg-[#F9F6EE] dark:bg-[#0B132B]/70 rounded-xl border border-[#1C4E46]/10 dark:border-[#E0A96D]/15 font-quran text-[#142421] dark:text-[#F5F1E8]"
                    style={{
                      fontSize: `${Math.max(16, displayPreferences.fontSize - 4)}px`,
                      lineHeight: weakVerseLineHeight,
                    }}
                  >
                    «<QuranText surahNumber={item.surahNumber} ayahNumber={item.ayahNumber}>{item.text}</QuranText>»
                  </div>

                  {item.notes && (
                    <div className="text-xs text-[#9A7415] dark:text-[#E0A96D] bg-[#C59B27]/10 dark:bg-[#E0A96D]/12 p-2.5 rounded-xl border border-[#C59B27]/30 dark:border-[#E0A96D]/25">
                      <strong>ملاحظة التثبيت: </strong>{item.notes}
                    </div>
                  )}

                  <div className="pt-2 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleResolveWeakVerse(item.id, `آية ${item.ayahNumber} من سورة ${item.surahName}`)}
                      className="flex-1 min-h-11 py-2 px-3 bg-[#1C4E46]/10 dark:bg-[#1E4A47]/45 hover:bg-[#1C4E46]/20 text-[#1C4E46] dark:text-[#6EE7B7] rounded-xl text-xs font-bold border border-[#1C4E46]/25 dark:border-[#6EE7B7]/30 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>إزالة من قائمة الالتباس</span>
                    </button>

                    {onStartSession && (
                      <button
                        type="button"
                        onClick={() => onStartSession(item.surahNumber, item.ayahNumber, item.ayahNumber, 'review')}
                        className="min-h-11 py-2 px-3 bg-[#F2EDE2]/80 dark:bg-[#162744] hover:bg-[#1C4E46] hover:text-white text-[#142421] dark:text-[#F5F1E8] rounded-xl text-xs font-bold border border-[#1C4E46]/15 dark:border-[#E0A96D]/20 transition-colors"
                      >
                        تكرار وسماع
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW 4: REVISION HISTORY */}
      {activeTab === 'history' && (
        <div className="wird-card rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#142421] dark:text-[#F5F1E8] flex items-center gap-2">
              <History className="w-4 h-4 text-[#1C4E46] dark:text-[#E0A96D]" />
              <span>سجل التدقيق الزمني لعمليات المراجعة والتسميع السابقة</span>
            </h3>
            <span className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B] font-mono tabular-nums">
              إجمالي السجلات: {revisionHistory.length}
            </span>
          </div>

          {revisionHistory.length === 0 ? (
            <div className="text-center py-10 text-xs text-[#5B6F6B] dark:text-[#8B9E9B]">
              لم يتم تسجيل أي مراجعات سابقة بعد. ابدأ مراجعتك الأولى من طابور المراجعة اليومي.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-[#1C4E46]/12 dark:border-[#E0A96D]/18 text-[#5B6F6B] dark:text-[#8B9E9B] pb-2">
                    <th className="py-2 px-3 font-semibold">التاريخ</th>
                    <th className="py-2 px-3 font-semibold">المقطع القرآني</th>
                    <th className="py-2 px-3 font-semibold">التقييم المسجل</th>
                    <th className="py-2 px-3 font-semibold">تغير الفاصل الزمني</th>
                    <th className="py-2 px-3 font-semibold">ملاحظات التثبيت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1C4E46]/8 dark:divide-[#E0A96D]/10">
                  {revisionHistory.map((entry) => (
                    <tr key={entry.id} className="hover:bg-[#F2EDE2]/50 dark:hover:bg-[#162744]/50">
                      <td className="py-3 px-3 font-mono tabular-nums text-[#5B6F6B] dark:text-[#8B9E9B]">{entry.date}</td>
                      <td className="py-3 px-3 font-bold font-quran text-[#142421] dark:text-[#F5F1E8]">
                        سورة {entry.surahName} ({entry.startAyah}-{entry.endAyah})
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${
                          entry.rating === 'successful' 
                            ? 'bg-[#1C4E46]/12 text-[#1C4E46] dark:bg-[#1E4A47]/50 dark:text-[#6EE7B7]'
                            : entry.rating === 'difficult'
                            ? 'bg-[#C59B27]/15 text-[#9A7415] dark:bg-[#E0A96D]/20 dark:text-[#E0A96D]'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}>
                          {entry.rating === 'successful' ? 'ناجحة (متقن)' : entry.rating === 'difficult' ? 'صعبة (بتردد)' : 'غير متقنة (يتفلت)'}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono tabular-nums text-[#5B6F6B] dark:text-[#8B9E9B]">
                        {entry.intervalDaysBefore}d ➔ {entry.intervalDaysAfter}d
                      </td>
                      <td className="py-3 px-3 text-[#5B6F6B] dark:text-[#8B9E9B]">
                        {entry.notes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VIEW 5: RETENTION DASHBOARD */}
      {activeTab === 'retention_dashboard' && (
        <div className="space-y-6">
          {/* Key Metric Gauges */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="wird-card rounded-2xl p-5 space-y-1">
              <div className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B]">مؤشر جودة الرسوخ التراكمي</div>
              <div className="text-3xl font-bold text-[#1C4E46] dark:text-[#6EE7B7] font-mono tabular-nums">
                %{metrics.retentionScorePercentage}
              </div>
              <div className="text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B]">
                مقياس علمي مبني على استقرار الفواصل
              </div>
            </div>

            <div className="wird-card rounded-2xl p-5 space-y-1">
              <div className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B]">المقاطع المتتبعة</div>
              <div className="text-3xl font-bold text-[#142421] dark:text-[#F5F1E8] font-mono tabular-nums">
                {metrics.totalTrackedPortions}
              </div>
              <div className="text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B] tabular-nums">
                تشمل {metrics.totalMemorizedAyahs} آية محفوظة
              </div>
            </div>

            <div className="wird-card rounded-2xl p-5 space-y-1">
              <div className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B]">متوسط عامل السهولة (EF)</div>
              <div className="text-3xl font-bold text-[#142421] dark:text-[#F5F1E8] font-mono tabular-nums">
                {metrics.averageEaseFactor}
              </div>
              <div className="text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B] tabular-nums">
                المعدل الطبيعي: 2.2 - 2.8
              </div>
            </div>

            <div className="wird-card rounded-2xl p-5 space-y-1">
              <div className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B]">الآيات المتعثرة حالياً</div>
              <div className="text-3xl font-bold text-[#C59B27] dark:text-[#E0A96D] font-mono tabular-nums">
                {metrics.weakVersesCount}
              </div>
              <div className="text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B]">
                تحتاج تركيزاً في الأيام القادمة
              </div>
            </div>
          </div>

          {/* Breakdown by 6 Exact Statuses */}
          <div className="wird-card rounded-2xl p-6 space-y-5">
            <div>
              <h3 className="text-base font-bold text-[#142421] dark:text-[#F5F1E8] flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-[#1C4E46] dark:text-[#E0A96D]" />
                <span>توزيع المحفوظ القرآني حسب الحالات الست الدقيقة</span>
              </h3>
              <p className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B] mt-1">
                تصنيف إحصائي شامل لجميع مقاطع وسور القرآن المتتبعة
              </p>
            </div>

            {/* Visual Multi-Segment Bar */}
            <div className="space-y-2">
              <div className="w-full h-4 bg-[#F2EDE2] dark:bg-[#0B132B] rounded-full overflow-hidden flex">
                <div style={{ width: `${metrics.statusPercentages.stable}%` }} className="bg-[#1C4E46]" title={`راسخ: ${metrics.statusPercentages.stable}%`} />
                <div style={{ width: `${metrics.statusPercentages.recently_memorized}%` }} className="bg-sky-500" title={`محفوظ حديثاً: ${metrics.statusPercentages.recently_memorized}%`} />
                <div style={{ width: `${metrics.statusPercentages.needs_revision}%` }} className="bg-[#C59B27]" title={`يحتاج مراجعة: ${metrics.statusPercentages.needs_revision}%`} />
                <div style={{ width: `${metrics.statusPercentages.weak}%` }} className="bg-rose-500" title={`ضعيف: ${metrics.statusPercentages.weak}%`} />
                <div style={{ width: `${metrics.statusPercentages.currently_memorizing}%` }} className="bg-purple-500" title={`قيد الحفظ: ${metrics.statusPercentages.currently_memorizing}%`} />
              </div>

              {/* Legend & Count Cards */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 pt-2 text-xs">
                <div className="p-3 bg-[#1C4E46]/10 dark:bg-[#1E4A47]/40 rounded-xl border border-[#1C4E46]/25 dark:border-[#1E4A47]">
                  <div className="font-bold text-[#1C4E46] dark:text-[#6EE7B7]">راسخ ومتقن</div>
                  <div className="text-lg font-bold font-mono tabular-nums mt-1 text-[#142421] dark:text-[#F5F1E8]">{metrics.statusBreakdown.stable}</div>
                  <div className="text-[10px] text-[#5B6F6B] dark:text-[#8B9E9B] font-mono tabular-nums">%{metrics.statusPercentages.stable}</div>
                </div>

                <div className="p-3 bg-sky-50/70 dark:bg-sky-950/30 rounded-xl border border-sky-200 dark:border-sky-800/40">
                  <div className="font-bold text-sky-900 dark:text-sky-300">محفوظ حديثاً</div>
                  <div className="text-lg font-bold font-mono tabular-nums mt-1 text-sky-800 dark:text-sky-200">{metrics.statusBreakdown.recently_memorized}</div>
                  <div className="text-[10px] text-[#5B6F6B] dark:text-[#8B9E9B] font-mono tabular-nums">%{metrics.statusPercentages.recently_memorized}</div>
                </div>

                <div className="p-3 bg-[#C59B27]/12 dark:bg-[#E0A96D]/15 rounded-xl border border-[#C59B27]/35 dark:border-[#E0A96D]/30">
                  <div className="font-bold text-[#9A7415] dark:text-[#E0A96D]">يحتاج مراجعة</div>
                  <div className="text-lg font-bold font-mono tabular-nums mt-1 text-[#142421] dark:text-[#F5F1E8]">{metrics.statusBreakdown.needs_revision}</div>
                  <div className="text-[10px] text-[#5B6F6B] dark:text-[#8B9E9B] font-mono tabular-nums">%{metrics.statusPercentages.needs_revision}</div>
                </div>

                <div className="p-3 bg-rose-50/70 dark:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-800/40">
                  <div className="font-bold text-rose-900 dark:text-rose-300">ضعيف ويتفلت</div>
                  <div className="text-lg font-bold font-mono tabular-nums mt-1 text-rose-800 dark:text-rose-200">{metrics.statusBreakdown.weak}</div>
                  <div className="text-[10px] text-[#5B6F6B] dark:text-[#8B9E9B] font-mono tabular-nums">%{metrics.statusPercentages.weak}</div>
                </div>

                <div className="p-3 bg-purple-50/70 dark:bg-purple-950/30 rounded-xl border border-purple-200 dark:border-purple-800/40">
                  <div className="font-bold text-purple-900 dark:text-purple-300">قيد الحفظ</div>
                  <div className="text-lg font-bold font-mono tabular-nums mt-1 text-purple-800 dark:text-purple-200">{metrics.statusBreakdown.currently_memorizing}</div>
                  <div className="text-[10px] text-[#5B6F6B] dark:text-[#8B9E9B] font-mono tabular-nums">%{metrics.statusPercentages.currently_memorizing}</div>
                </div>

                <div className="p-3 bg-[#F2EDE2]/70 dark:bg-[#162744]/60 rounded-xl border border-[#1C4E46]/15 dark:border-[#E0A96D]/15">
                  <div className="font-bold text-[#5B6F6B] dark:text-[#8B9E9B]">غير محفوظ</div>
                  <div className="text-lg font-bold font-mono tabular-nums mt-1 text-[#142421] dark:text-[#F5F1E8]">{metrics.statusBreakdown.not_memorized}</div>
                  <div className="text-[10px] text-[#5B6F6B] dark:text-[#8B9E9B]">باقي المصحف</div>
                </div>
              </div>
            </div>

            {/* Smart Pedagogical Guidance */}
            <div className="p-4 bg-[#F9F6EE] dark:bg-[#0B132B]/70 rounded-xl border border-[#C59B27]/30 dark:border-[#E0A96D]/25 space-y-2 text-xs">
              <div className="font-bold text-[#142421] dark:text-[#F5F1E8] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#C59B27] dark:text-[#E0A96D]" />
                <span>توصية منهجية لمسارك الحالي:</span>
              </div>
              <p className="text-[#5B6F6B] dark:text-[#8B9E9B] leading-relaxed text-[11px]">
                {metrics.statusBreakdown.weak > 0 
                  ? `لديك ${metrics.statusBreakdown.weak} مقطع بحاجة إلى رعاية عاجلة وتكرار يومي. نوصيك بتقديم مراجعة المقاطع الضعيفة قبل البدء بأي حفظ جديد، تماشياً مع قاعدة الإمام الشاطبي: «والتثبيت مقدم على الاستكثار».`
                  : 'نسبة الرسوخ لديك ممتازة ومستقرة! يمكنك مواصلة إدراج سور جديدة وفق خطتك مع الالتزام بالورد اليومي للتكرار المتباعد.'}
              </p>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* MODAL: RATE FAILED REVISION DETAILS */}
      {ratingPortion && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div ref={ratingDialogRef} role="dialog" aria-modal="true" aria-labelledby="revision-rating-dialog-title" className="max-h-[calc(100dvh-2rem)] overflow-y-auto bg-[#F9F6EE] dark:bg-[#111F36] rounded-3xl p-6 max-w-md w-full border border-[#C59B27]/35 dark:border-[#E0A96D]/30 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 id="revision-rating-dialog-title" className="text-base font-bold text-[#142421] dark:text-[#F5F1E8] font-quran">
                تسجيل تعثر في سورة {ratingPortion.surahName}
              </h3>
              <button ref={ratingCloseRef} type="button" aria-label="إغلاق نافذة تسجيل التعثر" disabled={isSavingRating} onClick={() => { setRatingPortion(null); setReviewNotes(''); setWeakAyahNum(''); }} className="min-h-11 min-w-11 flex items-center justify-center rounded-xl text-[#5B6F6B] hover:text-[#142421] dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B]">
              سيتم إعادة ضبط فاصل المراجعة إلى يوم واحد للمراجعة غداً. هل ترغب في تحديد رقم الآية التي حدث فيها اللبس لحفظها في قائمة المتشابهات والمتعثرات؟
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[#142421] dark:text-[#F5F1E8] font-bold mb-1">
                  رقم الآية الملتبسة (اختياري، بين {ratingPortion.startAyah} و {ratingPortion.endAyah}):
                </label>
                <input
                  type="number"
                  min={ratingPortion.startAyah}
                  max={ratingPortion.endAyah}
                  value={weakAyahNum}
                  onChange={e => setWeakAyahNum(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="مثال: 8"
                  className="w-full min-h-11 px-3 py-2 bg-white dark:bg-[#0B132B] rounded-xl border border-[#1C4E46]/20 dark:border-[#E0A96D]/25 text-[#142421] dark:text-[#F5F1E8] focus:outline-none focus:ring-2 focus:ring-[#C59B27] font-mono tabular-nums"
                />
                {ratingWeakAyahPreview && (
                  <div className="mt-2 p-2.5 rounded-xl bg-white/80 dark:bg-[#0B132B]/70 border border-[#C59B27]/30 font-quran text-sm text-[#142421] dark:text-[#F5F1E8] leading-loose">
                    <QuranText>{ratingWeakAyahPreview}</QuranText>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[#142421] dark:text-[#F5F1E8] font-bold mb-1">
                  ملاحظة سبب الخطأ أو الكلمة المشكلة:
                </label>
                <input
                  type="text"
                  value={reviewNotes}
                  onChange={e => setReviewNotes(e.target.value)}
                  placeholder="مثال: نسيان رأس الآية، التباس بآية أخرى..."
                  className="w-full min-h-11 px-3 py-2 bg-white dark:bg-[#0B132B] rounded-xl border border-[#1C4E46]/20 dark:border-[#E0A96D]/25 text-[#142421] dark:text-[#F5F1E8] focus:outline-none focus:ring-2 focus:ring-[#C59B27]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isSavingRating}
                onClick={() => { setRatingPortion(null); setReviewNotes(''); setWeakAyahNum(''); }}
                className="min-h-11 px-4 py-2 bg-[#F2EDE2] dark:bg-[#162744] hover:bg-[#E5DEC9] text-[#142421] dark:text-[#F5F1E8] rounded-xl text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27]"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isSavingRating}
                onClick={() => handleRatePortion('failed')}
                className="min-h-11 px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                تأكيد التسجيل كـ "غير متقن"
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD NEW PORTION */}
      {isAddPortionModalOpen && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div ref={addPortionDialogRef} role="dialog" aria-modal="true" aria-labelledby="wird-add-portion-title" className="max-h-[calc(100dvh-2rem)] overflow-y-auto bg-[#F9F6EE] dark:bg-[#111F36] rounded-3xl p-6 max-w-lg w-full border border-[#C59B27]/35 dark:border-[#E0A96D]/30 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 id="wird-add-portion-title" className="text-base font-bold text-[#142421] dark:text-[#F5F1E8] font-quran">
                إضافة مقطع حفظ ومراجعة جديد
              </h3>
              <button ref={addPortionCloseRef} type="button" aria-label="إغلاق نافذة إضافة مقطع" onClick={() => setIsAddPortionModalOpen(false)} className="min-h-11 min-w-11 flex items-center justify-center rounded-xl text-[#5B6F6B] hover:text-[#142421] dark:hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddNewPortion} className="space-y-4 text-xs">
              <SurahPickerControl
                label="اختر السورة:"
                ariaLabel="اختر السورة لإضافة مقطع"
                value={newSurahNum}
                onChange={(num) => {
                  setNewSurahNum(num);
                  const s = ALL_SURAHS.find(sur => sur.number === num);
                  if (s) {
                    setNewStartAyah(1);
                    setNewEndAyah(Math.min(15, s.versesCount));
                  }
                }}
              />

              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="revision-add-start-ayah" className="block text-[#142421] dark:text-[#F5F1E8] font-bold mb-1">
                      من الآية:
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        aria-label="إنقاص آية البداية"
                        onClick={() => {
                          const next = Math.max(1, newStartAyah - 1);
                          setNewStartAyah(next);
                        }}
                        className="min-h-11 min-w-11 rounded-xl border border-[#1C4E46]/20 dark:border-[#E0A96D]/25 bg-white dark:bg-[#0B132B] text-base font-bold text-[#1C4E46] dark:text-[#E0A96D] hover:bg-[#F2EDE2] dark:hover:bg-[#162744]"
                      >
                        -
                      </button>
                      <input
                        id="revision-add-start-ayah"
                        type="number"
                        min={1}
                        max={selectedNewSurahMax}
                        value={newStartAyah}
                        onChange={e => {
                          const parsed = Number(e.target.value);
                          if (!Number.isFinite(parsed)) return;
                          const clamped = Math.min(selectedNewSurahMax, Math.max(1, Math.trunc(parsed)));
                          setNewStartAyah(clamped);
                          if (newEndAyah < clamped) setNewEndAyah(clamped);
                        }}
                        className="w-full min-h-11 px-3 py-2 text-center bg-white dark:bg-[#0B132B] rounded-xl border border-[#1C4E46]/20 dark:border-[#E0A96D]/25 text-[#142421] dark:text-[#F5F1E8] font-mono tabular-nums"
                        required
                      />
                      <button
                        type="button"
                        aria-label="زيادة آية البداية"
                        onClick={() => {
                          const next = Math.min(selectedNewSurahMax, newStartAyah + 1);
                          setNewStartAyah(next);
                          if (newEndAyah < next) setNewEndAyah(next);
                        }}
                        className="min-h-11 min-w-11 rounded-xl border border-[#1C4E46]/20 dark:border-[#E0A96D]/25 bg-white dark:bg-[#0B132B] text-base font-bold text-[#1C4E46] dark:text-[#E0A96D] hover:bg-[#F2EDE2] dark:hover:bg-[#162744]"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="revision-add-end-ayah" className="block text-[#142421] dark:text-[#F5F1E8] font-bold mb-1">
                      إلى الآية:
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        aria-label="إنقاص آية النهاية"
                        onClick={() => {
                          const next = Math.max(newStartAyah, newEndAyah - 1);
                          setNewEndAyah(next);
                        }}
                        className="min-h-11 min-w-11 rounded-xl border border-[#1C4E46]/20 dark:border-[#E0A96D]/25 bg-white dark:bg-[#0B132B] text-base font-bold text-[#1C4E46] dark:text-[#E0A96D] hover:bg-[#F2EDE2] dark:hover:bg-[#162744]"
                      >
                        -
                      </button>
                      <input
                        id="revision-add-end-ayah"
                        type="number"
                        min={newStartAyah}
                        max={selectedNewSurahMax}
                        value={newEndAyah}
                        onChange={e => {
                          const parsed = Number(e.target.value);
                          if (!Number.isFinite(parsed)) return;
                          const clamped = Math.min(selectedNewSurahMax, Math.max(newStartAyah, Math.trunc(parsed)));
                          setNewEndAyah(clamped);
                        }}
                        className="w-full min-h-11 px-3 py-2 text-center bg-white dark:bg-[#0B132B] rounded-xl border border-[#1C4E46]/20 dark:border-[#E0A96D]/25 text-[#142421] dark:text-[#F5F1E8] font-mono tabular-nums"
                        required
                      />
                      <button
                        type="button"
                        aria-label="زيادة آية النهاية"
                        onClick={() => {
                          const next = Math.min(selectedNewSurahMax, newEndAyah + 1);
                          setNewEndAyah(next);
                        }}
                        className="min-h-11 min-w-11 rounded-xl border border-[#1C4E46]/20 dark:border-[#E0A96D]/25 bg-white dark:bg-[#0B132B] text-base font-bold text-[#1C4E46] dark:text-[#E0A96D] hover:bg-[#F2EDE2] dark:hover:bg-[#162744]"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-[#F2EDE2]/70 dark:bg-[#0B132B]/70 border border-[#1C4E46]/12 dark:border-[#E0A96D]/20 px-3 py-2 text-xs font-bold text-[#1C4E46] dark:text-[#E0A96D] tabular-nums text-center">
                  النطاق المحدد: من آية {newStartAyah} إلى آية {newEndAyah} ({Math.max(1, newEndAyah - newStartAyah + 1)} آيات)
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="block text-[#142421] dark:text-[#F5F1E8] font-bold">
                  الحالة المبدئية للمقطع:
                </span>
                <div role="group" aria-label="الحالة المبدئية للمقطع" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PORTION_STATUS_OPTIONS.map(opt => {
                    const isSelected = newStatus === opt.value;
                    const cfg = STATUS_LABELS[opt.value];
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => setNewStatus(opt.value)}
                        className={`min-h-11 px-3 py-2 rounded-xl border text-right flex items-center justify-between gap-2 transition-all ${
                          isSelected
                            ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white border-[#C59B27] dark:border-[#E0A96D] shadow-xs'
                            : 'bg-white dark:bg-[#0B132B]/70 text-[#142421] dark:text-[#F5F1E8] border-[#1C4E46]/15 dark:border-[#E0A96D]/20 hover:border-[#C59B27]'
                        }`}
                      >
                        <span className="flex items-center gap-2 font-bold">
                          <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-[#E0A96D]' : cfg.dot}`} />
                          <span>{opt.label}</span>
                        </span>
                        <span className={`text-[10px] ${isSelected ? 'text-[#F5F1E8]/80' : 'text-[#5B6F6B] dark:text-[#8B9E9B]'}`}>
                          {opt.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1C4E46]/10 dark:border-[#E0A96D]/15">
                <button
                  type="button"
                  onClick={() => setIsAddPortionModalOpen(false)}
                  className="min-h-11 px-4 py-2 bg-[#F2EDE2] dark:bg-[#162744] hover:bg-[#E5DEC9] text-[#142421] dark:text-[#F5F1E8] rounded-xl font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="min-h-11 px-5 py-2 bg-[#1C4E46] hover:bg-[#28665B] dark:bg-[#C59B27] dark:hover:bg-[#E0A96D] text-white dark:text-[#0B132B] rounded-xl font-bold shadow-xs"
                >
                  إضافة المقطع
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD MANUAL WEAK VERSE */}
      {isAddWeakVerseModalOpen && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div ref={addWeakVerseDialogRef} role="dialog" aria-modal="true" aria-labelledby="wird-add-weak-verse-title" className="max-h-[calc(100dvh-2rem)] overflow-y-auto bg-[#F9F6EE] dark:bg-[#111F36] rounded-3xl p-6 max-w-lg w-full border border-[#C59B27]/35 dark:border-[#E0A96D]/30 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 id="wird-add-weak-verse-title" className="text-base font-bold text-[#142421] dark:text-[#F5F1E8] font-quran">
                تسجيل آية ملتبسة أو متعثرة يدوياً
              </h3>
              <button ref={addWeakVerseCloseRef} type="button" aria-label="إغلاق نافذة تسجيل آية ملتبسة" onClick={() => setIsAddWeakVerseModalOpen(false)} className="min-h-11 min-w-11 flex items-center justify-center rounded-xl text-[#5B6F6B] hover:text-[#142421] dark:hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddManualWeakVerse} className="space-y-4 text-xs">
              <SurahPickerControl
                label="اختر السورة والآية:"
                ariaLabel="اختر السورة للآية الملتبسة"
                value={weakSurahNum}
                onChange={(num) => {
                  setWeakSurahNum(num);
                  setManualWeakAyahNum(1);
                }}
                ayahValue={manualWeakAyahNum}
                onAyahChange={setManualWeakAyahNum}
                ayahLabel="رقم الآية"
                maxAyah={ALL_SURAHS.find(s => s.number === weakSurahNum)?.versesCount || 286}
              />

              <div>
                <label className="block text-[#142421] dark:text-[#F5F1E8] font-bold mb-1">
                  نص الآية (اختياري - يتم جلبه تلقائياً إن وُجد):
                </label>
                <textarea
                  value={manualWeakText}
                  onChange={e => setManualWeakText(e.target.value)}
                  placeholder="اكتب نص الآية بالرسم القرآني إن أردت..."
                  rows={2}
                  className="w-full px-3 py-2 bg-white dark:bg-[#0B132B] rounded-xl border border-[#1C4E46]/20 dark:border-[#E0A96D]/25 text-[#142421] dark:text-[#F5F1E8] font-quran"
                />
              </div>

              <div>
                <label className="block text-[#142421] dark:text-[#F5F1E8] font-bold mb-1">
                  سبب اللبس أو المتشابه المشكل:
                </label>
                <input
                  type="text"
                  value={manualWeakNotes}
                  onChange={e => setManualWeakNotes(e.target.value)}
                  placeholder="مثال: الخلط مع موضع سورة البقرة، أو تشابه خواتيم الآيات..."
                  className="w-full min-h-11 px-3 py-2 bg-white dark:bg-[#0B132B] rounded-xl border border-[#1C4E46]/20 dark:border-[#E0A96D]/25 text-[#142421] dark:text-[#F5F1E8]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1C4E46]/10 dark:border-[#E0A96D]/15">
                <button
                  type="button"
                  onClick={() => setIsAddWeakVerseModalOpen(false)}
                  className="min-h-11 px-4 py-2 bg-[#F2EDE2] dark:bg-[#162744] hover:bg-[#E5DEC9] text-[#142421] dark:text-[#F5F1E8] rounded-xl font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSavingWeakVerse}
                  className="min-h-11 px-5 py-2 bg-[#C59B27] hover:bg-[#af851a] dark:bg-[#E0A96D] dark:hover:bg-[#f3b77b] text-[#0B132B] rounded-xl font-bold disabled:opacity-60"
                >
                  {isSavingWeakVerse ? 'جارٍ حفظ الآية...' : 'تسجيل الآية الملتبسة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
