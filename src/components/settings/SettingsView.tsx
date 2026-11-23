import React, { useEffect, useState, useRef } from 'react';
import { 
  Settings, 
  User, 
  Volume2, 
  Type, 
  Moon, 
  Sun, 
  RotateCcw, 
  Save, 
  Check, 
  ShieldAlert,
  Sparkles,
  Download,
  Upload,
  FileText,
  Database,
  AlertTriangle,
  LogOut,
  CheckCircle2,
  KeyRound,
  Shield,
  Cloud,
  CloudCheck,
  CloudOff,
  CloudAlert,
  RefreshCw,
  Palette,
  ChevronDown,
  ChevronUp,
  Pause,
  Play,
  Trash2,
  X,
  HardDrive,
  CheckCircle
} from 'lucide-react';
import { UserProfile, ReciterId } from '../../types/quran';
import { ALL_SURAHS } from '../../data/quranMeta';
import { RECITERS, resolveApprovedOfflineReciterId } from '../../services/audioService';
import { FALLBACK_QURAN_RECITERS } from '../../services/ruqyahAudioService';
import {
  buildJuzAudioRanges,
  estimateAudioDownloadBytes,
  extractEnginePlanAudioRanges,
  offlineQuranAudioLibrary,
  type OfflineAudioJob,
  type OfflineAudioJobScopeKind,
  type OfflineAudioLibraryStats,
  type QuotaPreflightResult
} from '../../services/offlineQuranAudioLibrary';
import { type EngineGeneratedPlan } from '../../services/planningEngine';
import { StorageService } from '../../services/storageService';
import { RetentionService } from '../../services/retentionService';
import { useAuth } from '../../context/AuthContext';
import { useCloudSync } from '../../hooks/useCloudSync';
import { LocalSyncOutbox } from '../../services/localSyncOutbox';
import type { ConflictResolutionIntent, RemoteProjectionConflict } from '../../services/indexedDbSyncJournal';
import { cancelPreparedProjectionConflictResolution, resolveProjectionConflictUsingLocal, resolveProjectionConflictUsingRemote } from '../../services/syncConflictResolutionService';
import { containsUnsafeFullSnapshotProjection } from '../../services/syncConflictSafety';
import { getLocalDateString } from '../../services/unifiedPortionService';
import { importBackupFile } from '../../services/backupPersistence';
import { loadDemoDataJournaled } from '../../services/demoDataPersistence';
import { getWirdOfflinePackageStatus, prepareWirdForOffline, type OfflinePackageStatus, type OfflinePreparationProgress } from '../../services/offlinePreparationService';
import { getOfflineStorageStatus, requestOfflineStoragePersistence, type OfflineStorageStatus } from '../../services/offlineStorageService';
import { PWAInstallAction } from '../shared/OfflineStatusControls';
import { WirdAvatar } from '../brand/WirdAvatar';
import { BrandDesignShowcase } from '../brand/BrandDesignShowcase';
import { AppearanceSelectorPanel } from '../ui/AppearanceSelectorPanel';
import {
  DEFAULT_APPEARANCE_MODE,
  loadThemePreferences,
  resetThemePreferences,
  saveThemePreferences,
  type WirdAppearanceMode,
  type WirdThemePreferences,
} from '../../services/themePreferences';

function formatConflictSnapshotValue(value: string | null): string {
  if (value === null) return 'null';
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function formatBytesLabel(bytes: number): string {
  if (bytes <= 0) return '0 ك.ب';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} ك.ب`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} م.ب`;
}

interface SettingsViewProps {
  profile: UserProfile;
  enginePlans?: EngineGeneratedPlan[];
  isStandalone?: boolean;
  hasInstallPrompt?: boolean;
  onInstallPwa?: () => void;
  onUpdateProfile: (profile: UserProfile) => void;
  onSaveProfile: (profile: UserProfile) => Promise<boolean>;
  onResetAllData: () => Promise<boolean>;
  onBackupImported?: () => void;
  onOpenShowcase?: () => void;
  onToast?: (message: string, type?: 'success' | 'warn' | 'error' | 'info') => void;
  themePreferences?: WirdThemePreferences;
  onUpdateThemePreferences?: (partial: Partial<Omit<WirdThemePreferences, 'schemaVersion'>>) => void;
  onSetAppearanceMode?: (mode: WirdAppearanceMode) => void;
  onResetAppearance?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  profile,
  enginePlans = [],
  isStandalone = false,
  hasInstallPrompt = false,
  onInstallPwa,
  onUpdateProfile,
  onSaveProfile,
  onResetAllData,
  onBackupImported,
  onOpenShowcase,
  onToast,
  themePreferences,
  onUpdateThemePreferences,
  onSetAppearanceMode,
  onResetAppearance,
}) => {
  const [formData, setFormData] = useState<UserProfile>(profile);
  const [localThemePrefs, setLocalThemePrefs] = useState<WirdThemePreferences>(() =>
    themePreferences ?? loadThemePreferences()
  );

  const effectiveThemePrefs = themePreferences ?? localThemePrefs;
  const effectiveAppearanceMode: WirdAppearanceMode =
    profile.theme === 'dark' ? 'dark' : 'light';

  const handleUpdateThemePrefs = (
    partial: Partial<Omit<WirdThemePreferences, 'schemaVersion'>>
  ) => {
    if (onUpdateThemePreferences) {
      onUpdateThemePreferences(partial);
    } else {
      setLocalThemePrefs(saveThemePreferences(partial));
    }
  };

  const handleImmediateAppearanceMode = (nextMode: WirdAppearanceMode) => {
    setFormData((prev) => ({ ...prev, theme: nextMode }));
    if (onSetAppearanceMode) {
      onSetAppearanceMode(nextMode);
    } else {
      void onSaveProfile({ ...profile, theme: nextMode });
    }
  };

  const handleResetAppearanceSettings = () => {
    if (onResetAppearance) {
      onResetAppearance();
    } else {
      setLocalThemePrefs(resetThemePreferences());
      handleImmediateAppearanceMode(DEFAULT_APPEARANCE_MODE);
    }
  };

  useEffect(() => {
    setFormData(profile);
  }, [profile]);
  const [isSaved, setIsSaved] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDemoConfirm, setShowDemoConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isBrandShowcaseOpen, setIsBrandShowcaseOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const resetDialogRef = useRef<HTMLDivElement | null>(null);
  const demoDialogRef = useRef<HTMLDivElement | null>(null);
  const resetCancelRef = useRef<HTMLButtonElement | null>(null);
  const demoCancelRef = useRef<HTMLButtonElement | null>(null);
  const resetTriggerRef = useRef<HTMLButtonElement | null>(null);
  const demoTriggerRef = useRef<HTMLButtonElement | null>(null);
  const isResettingRef = useRef(false);
  const savedTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current !== null) window.clearTimeout(savedTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const activeDialog = showResetConfirm ? 'reset' : showDemoConfirm ? 'demo' : null;
    if (!activeDialog) return;

    const dialog = activeDialog === 'reset' ? resetDialogRef.current : demoDialogRef.current;
    const initialFocus = activeDialog === 'reset' ? resetCancelRef.current : demoCancelRef.current;
    const trigger = activeDialog === 'reset' ? resetTriggerRef.current : demoTriggerRef.current;
    initialFocus?.focus();

    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (activeDialog === 'reset') {
          if (!isResettingRef.current) setShowResetConfirm(false);
        } else {
          setShowDemoConfirm(false);
        }
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
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

    document.addEventListener('keydown', handleDialogKeyDown);
    return () => {
      document.removeEventListener('keydown', handleDialogKeyDown);
      trigger?.focus();
    };
  }, [showResetConfirm, showDemoConfirm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!await onSaveProfile(formData)) return;
    if (savedTimerRef.current !== null) window.clearTimeout(savedTimerRef.current);
    setIsSaved(true);
    if (onToast) {
      onToast("تم حفظ التعديلات وإعدادات الملف الشخصي بنجاح", "success");
    }
    savedTimerRef.current = window.setTimeout(() => {
      setIsSaved(false);
      savedTimerRef.current = null;
    }, 2500);
  };

  const handleConfirmReset = async () => {
    if (isResettingRef.current) return;
    isResettingRef.current = true;
    setIsResetting(true);
    try {
      const resetSucceeded = await onResetAllData();
      setFormData(StorageService.getProfile());
      if (!resetSucceeded) {
        onToast?.('تعذر تأكيد إعادة الضبط؛ لم نغلق نافذة التأكيد ولم نعلن نجاح العملية.', 'error');
        return;
      }
      setShowResetConfirm(false);
      onToast?.("تمت إعادة ضبط البيانات وحفظها في سجل الاستعادة بنجاح", "info");
    } finally {
      isResettingRef.current = false;
      setIsResetting(false);
    }
  };

  const handleExportBackup = async () => {
    try {
      const backupJson = await StorageService.exportFullBackupVerified();
      const blob = new Blob([backupJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wird-quran-backup-${getLocalDateString()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      if (onToast) {
        onToast("تم تصدير ملف النسخة الاحتياطية بنجاح (ملف نصي JSON غير مشفر)", "success");
      }
    } catch (error) {
      onToast?.(
        error instanceof Error ? error.message : 'تعذر تصدير النسخة الاحتياطية الموثقة.',
        'error'
      );
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file || isImporting) return;

    setIsImporting(true);
    try {
      const result = await importBackupFile(file);
      if (result.success) {
        const updated = StorageService.getProfile();
        setFormData(updated);
        onUpdateProfile(updated);
        onBackupImported?.();
        onToast?.(result.message, 'success');
      } else {
        if (result.recoveredPriorEvents) onBackupImported?.();
        onToast?.(`فشل استيراد النسخة: ${result.message}`, 'error');
      }
    } catch (error) {
      onToast?.(
        `فشل استيراد النسخة: ${error instanceof Error ? error.message : 'خطأ غير متوقع'}`,
        'error'
      );
    } finally {
      setIsImporting(false);
      input.value = '';
    }
  };

  const { user, isGuest, isEmailVerified, logout } = useAuth();
  const {
    status: syncStatus, pendingCount, remoteInboxPendingCount,
    remoteProjectionBlockReason, remoteProjectionBlockedAtSequence,
    projectionConflictCount, latestProjectionConflict,
    lastSyncAtMs, isOnline, errorMessage: syncErrorMessage, triggerSync
  } = useCloudSync();
  const [conflictDetails, setConflictDetails] = useState<RemoteProjectionConflict[]>([]);
  const [conflictIntents, setConflictIntents] = useState<Record<string, ConflictResolutionIntent | null>>({});
  const [confirmRemoteConflictId, setConfirmRemoteConflictId] = useState<string | null>(null);
  const [confirmLocalConflictId, setConfirmLocalConflictId] = useState<string | null>(null);
  const [resolvingConflictId, setResolvingConflictId] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (!user?.uid || isGuest || StorageService.getStorageScope() !== 'user:' + user.uid) {
      setConflictDetails([]);
      return () => { active = false; };
    }
    void LocalSyncOutbox.listProjectionConflicts(20)
      .then(async records => {
        const intentEntries = await Promise.all(records.map(async conflict => [
          conflict.event.eventId,
          await LocalSyncOutbox.getConflictResolutionIntent(conflict.event.eventId)
        ] as const));
        if (active) {
          setConflictDetails(records);
          setConflictIntents(Object.fromEntries(intentEntries));
        }
      })
      .catch(() => {
        if (active) {
          setConflictDetails([]);
          setConflictIntents({});
        }
      });
    return () => { active = false; };
  }, [user?.uid, isGuest, projectionConflictCount, latestProjectionConflict?.eventId]);

  const handleUseRemoteConflict = async (eventId: string) => {
    if (resolvingConflictId) return;
    setResolvingConflictId(eventId);
    try {
      const result = await resolveProjectionConflictUsingRemote(eventId);
      setConflictDetails(previous => previous.filter(item => item.event.eventId !== eventId));
      setConflictIntents(previous => ({ ...previous, [eventId]: null }));
      setConfirmRemoteConflictId(null);
      setConfirmLocalConflictId(null);
      onUpdateProfile(StorageService.getProfile());
      onBackupImported?.();
      onToast?.(
        `تم تطبيق أحدث نسخة سحابية للتعارض ${eventId}. حُفظت أدلة التعديلات المحلية في الأرشيف قبل استبعادها من صندوق الرفع (${result.archivedMutationCount} عملية مؤرشفة).`,
        'success'
      );
      void triggerSync();
    } catch (error) {
      const intent = await LocalSyncOutbox.getConflictResolutionIntent(eventId).catch(() => null);
      setConflictIntents(previous => ({ ...previous, [eventId]: intent }));
      onToast?.(
        error instanceof Error ? error.message : 'تعذر اعتماد النسخة السحابية؛ بقيت الأدلة محفوظة.',
        'error'
      );
    } finally {
      setResolvingConflictId(null);
    }
  };

  const handleKeepLocalConflict = async (eventId: string) => {
    if (resolvingConflictId) return;
    setResolvingConflictId(eventId);
    try {
      const result = await resolveProjectionConflictUsingLocal(eventId);
      setConflictDetails(previous => previous.filter(item => item.event.eventId !== eventId));
      setConflictIntents(previous => ({ ...previous, [eventId]: null }));
      setConfirmLocalConflictId(null);
      setConfirmRemoteConflictId(null);
      onToast?.(
        `تم اعتماد النسخة المحلية للتعارض ${eventId} وتجهيز عملية جديدة على الإصدار السحابي ${result.revision}. حُفظت ${result.archivedMutationCount} عملية قديمة في الأرشيف، والعملية الجديدة بانتظار تأكيد الرفع.`,
        'success'
      );
      void triggerSync();
    } catch (error) {
      const intent = await LocalSyncOutbox.getConflictResolutionIntent(eventId).catch(() => null);
      setConflictIntents(previous => ({ ...previous, [eventId]: intent }));
      onToast?.(
        error instanceof Error ? error.message : 'تعذر تجهيز إعادة نشر النسخة المحلية؛ بقيت الأدلة محفوظة.',
        'error'
      );
    } finally {
      setResolvingConflictId(null);
    }
  };

  const handleCancelPreparedConflict = async (eventId: string) => {
    const intent = conflictIntents[eventId];
    if (!intent || resolvingConflictId) return;
    setResolvingConflictId(eventId);
    try {
      const cancelled = await cancelPreparedProjectionConflictResolution(eventId, intent.decisionId);
      if (cancelled) {
        setConflictIntents(previous => ({ ...previous, [eventId]: null }));
        setConfirmRemoteConflictId(null);
        setConfirmLocalConflictId(null);
        onToast?.('تم إلغاء القرار غير المنفذ فقط؛ لم تُحذف أدلة التعارض أو العمليات المحلية.', 'info');
        void triggerSync();
      }
    } catch (error) {
      onToast?.(error instanceof Error ? error.message : 'تعذر إلغاء القرار المحفوظ.', 'error');
    } finally {
      setResolvingConflictId(null);
    }
  };

  const projectionBlockMessages: Record<string, string> = {
    projection_disabled: 'استقبال الأحداث غير مفعّل بعد؛ نحتفظ بها دون تطبيقها.',
    legacy_remote_state: 'توجد بيانات سحابية قديمة تحتاج إلى مصالحة آمنة.',
    events_pending: 'توجد أحداث سحابية أخرى بانتظار التطبيق.',
    import_failed: 'تعذر استيراد الأحداث أو التحقق منها؛ لم نحرك المؤشرات.',
    blocked_pending_local: 'هناك تغييرات محلية معلقة في مجموعة البيانات نفسها.',
    blocked_base_revision: 'الإصدار المحلي لا يطابق الإصدار السابق للحدث السحابي.',
    blocked_tombstone: 'حدث حذف ينتظر سياسة حذف آمنة.',
    projection_failed: 'تعذر تطبيق الحدث محليًا؛ احتفظنا به لإعادة المحاولة.'
  };
  const projectionBlockMessage = remoteProjectionBlockReason
    ? projectionBlockMessages[remoteProjectionBlockReason] || 'تطبيق الأحداث السحابية متوقف بأمان.'
    : null;
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [isPreparingOffline, setIsPreparingOffline] = useState(false);
  const [offlineProgress, setOfflineProgress] = useState<OfflinePreparationProgress | null>(null);
  const [offlinePackageStatus, setOfflinePackageStatus] = useState<OfflinePackageStatus | null>(null);
  const [isCheckingOfflineStatus, setIsCheckingOfflineStatus] = useState(false);
  const [offlineStorageStatus, setOfflineStorageStatus] = useState<OfflineStorageStatus | null>(null);

  // Offline Audio Library State
  const profileApprovedReciter = resolveApprovedOfflineReciterId(profile.preferredReciter);
  const [audioDownloadReciter, setAudioDownloadReciter] = useState<string>(
    () => profileApprovedReciter || FALLBACK_QURAN_RECITERS[0].id
  );
  const [audioScopeKind, setAudioScopeKind] = useState<OfflineAudioJobScopeKind>('surah');
  const [audioSurahNumber, setAudioSurahNumber] = useState<number>(67);
  const [audioJuzNumber, setAudioJuzNumber] = useState<number>(30);
  const [audioPlanId, setAudioPlanId] = useState<string>(() => enginePlans[0]?.id || '');
  const [audioJobs, setAudioJobs] = useState<OfflineAudioJob[]>([]);
  const [audioLibraryStats, setAudioLibraryStats] = useState<OfflineAudioLibraryStats>({
    jobCount: 0,
    availableFilesCount: 0,
    totalBytes: 0
  });
  const [audioQuotaPreflight, setAudioQuotaPreflight] = useState<QuotaPreflightResult | null>(null);
  const [isEnqueuingAudioJob, setIsEnqueuingAudioJob] = useState(false);

  const selectedAudioPlan = enginePlans.find(p => p.id === audioPlanId) || enginePlans[0] || null;
  const targetAudioPayload = (() => {
    if (audioScopeKind === 'juz') {
      const ranges = buildJuzAudioRanges(audioJuzNumber);
      const totalAyahs = ranges.reduce((s, r) => s + (r.endAyah - r.startAyah + 1), 0);
      return { ranges, totalAyahs, labelAr: `الجزء ${audioJuzNumber}` };
    }
    if (audioScopeKind === 'plan' && selectedAudioPlan) {
      const ranges = extractEnginePlanAudioRanges(selectedAudioPlan);
      const totalAyahs = ranges.reduce((s, r) => s + (r.endAyah - r.startAyah + 1), 0);
      return { ranges, totalAyahs, labelAr: `خطة: ${selectedAudioPlan.title}` };
    }
    const meta = ALL_SURAHS[audioSurahNumber - 1] || ALL_SURAHS[66];
    return {
      ranges: [{ surahNumber: meta.number, startAyah: 1, endAyah: meta.versesCount }],
      totalAyahs: meta.versesCount,
      labelAr: `سورة ${meta.name}`
    };
  })();

  const refreshOfflineAudioState = async () => {
    try {
      const [jobs, stats] = await Promise.all([
        offlineQuranAudioLibrary.listJobs(),
        offlineQuranAudioLibrary.getStats()
      ]);
      setAudioJobs(jobs);
      setAudioLibraryStats(stats);
    } catch {
      // IndexedDB may be unavailable in restricted contexts
    }
  };

  useEffect(() => {
    let active = true;
    void offlineQuranAudioLibrary.reconcileLibrary()
      .catch(() => undefined)
      .then(() => { if (active) return refreshOfflineAudioState(); });
    const unsubscribe = offlineQuranAudioLibrary.subscribe(() => {
      if (active) void refreshOfflineAudioState();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    void offlineQuranAudioLibrary.preflightQuota(audioDownloadReciter, targetAudioPayload.totalAyahs)
      .then(result => { if (active) setAudioQuotaPreflight(result); })
      .catch(() => { if (active) setAudioQuotaPreflight(null); });
    return () => { active = false; };
  }, [audioDownloadReciter, targetAudioPayload.totalAyahs]);

  const handleStartOfflineAudioDownload = async () => {
    if (isEnqueuingAudioJob || targetAudioPayload.ranges.length === 0) return;
    setIsEnqueuingAudioJob(true);
    try {
      const storageStatus = await requestOfflineStoragePersistence().catch(() => null);
      if (storageStatus) setOfflineStorageStatus(storageStatus);
      const job = await offlineQuranAudioLibrary.enqueueDownloadJob({
        scopeKind: audioScopeKind,
        labelAr: targetAudioPayload.labelAr,
        reciterId: audioDownloadReciter,
        ranges: targetAudioPayload.ranges,
        autoStart: true
      });
      await refreshOfflineAudioState();
      onToast?.(`تمت جدولة تنزيل «${job.labelAr}» (${job.totalItems} آية) للاستماع دون إنترنت.`, 'success');
    } catch (error) {
      onToast?.(
        error instanceof Error ? error.message : 'تعذر بدء تحميل التلاوة للأوفلاين.',
        'error'
      );
    } finally {
      setIsEnqueuingAudioJob(false);
    }
  };

  const handlePrepareOffline = async () => {
    if (isPreparingOffline) return;
    setIsPreparingOffline(true);
    setOfflineProgress(null);
    try {
      const storageStatus = await requestOfflineStoragePersistence();
      setOfflineStorageStatus(storageStatus);
      const result = await prepareWirdForOffline(setOfflineProgress);
      const status = await getWirdOfflinePackageStatus();
      setOfflinePackageStatus(status);
      onToast?.(`اكتمل تنزيل ${result.completed} ملفًا. تم التحقق من حفظ ${status.cached} من أصل ${status.total} ملفًا برمجيًا. ${storageStatus.persisted ? 'حماية التخزين الدائم مفعّلة.' : 'قد يحذف المتصفح بعض الملفات عند ضغط المساحة؛ احتفظ بنسخة احتياطية من بياناتك.'}`, status.missing === 0 ? 'success' : 'info');
    } catch (error) {
      onToast?.(error instanceof Error ? error.message : 'تعذر إكمال التجهيز المحلي؛ يمكنك إعادة المحاولة وسيُستكمل ما تم تنزيله.', 'error');
    } finally {
      setIsPreparingOffline(false);
    }
  };

  const handleCheckOfflineStatus = async () => {
    if (isCheckingOfflineStatus) return;
    setIsCheckingOfflineStatus(true);
    try {
      const [status, storageStatus] = await Promise.all([getWirdOfflinePackageStatus(), getOfflineStorageStatus()]);
      setOfflineStorageStatus(storageStatus);
      setOfflinePackageStatus(status);
      onToast?.(
        status.missing === 0
          ? 'تم التحقق: جميع ملفات التطبيق الاختيارية المطلوبة للعمل دون إنترنت محفوظة على هذا الجهاز.'
          : `تم العثور على ${status.cached} ملفًا محفوظًا من أصل ${status.total}؛ ما زال ${status.missing} ملفًا يحتاج إلى تنزيل.`,
        status.missing === 0 ? 'success' : 'info'
      );
    } catch (error) {
      onToast?.(error instanceof Error ? error.message : 'تعذر فحص حالة الملفات المحلية.', 'error');
    } finally {
      setIsCheckingOfflineStatus(false);
    }
  };

  const handleManualSync = async () => {
    setIsManualSyncing(true);
    try {
      const ok = await triggerSync();
      if (ok) {
        onToast?.("تمت المزامنة السحابية مع Cloud Firestore بنجاح", "success");
      } else {
        if (!isOnline) {
          onToast?.("الجهاز غير متصل بالإنترنت حالياً؛ التغييرات محفوظة محلياً.", "info");
        } else if (!isEmailVerified && !isGuest && user) {
          onToast?.("يتطلب حفظ البيانات سحابياً تفعيل البريد الإلكتروني أولاً.", "warn");
        }
      }
    } finally {
      setIsManualSyncing(false);
    }
  };

  const handleLoadDemoData = async () => {
    if (!import.meta.env.DEV) return;
    if (!isGuest && user) {
      setShowDemoConfirm(false);
      onToast?.("تحميل البيانات التجريبية مقتصر على وضع الزائر لحماية حسابك السحابي من التداخل.", "warn");
      return;
    }
    await loadDemoDataJournaled();
    const updated = StorageService.getProfile();
    setFormData(updated);
    onUpdateProfile(updated);
    setShowDemoConfirm(false);
    if (onToast) {
      onToast("تم تحميل البيانات التجريبية بنجاح (سجلات استعراضية للملك والنبأ)", "info");
    }
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* 1. Header */}
      <div className="wird-card rounded-2xl p-5 sm:p-6">
        <h2 className="text-xl font-bold text-[var(--wird-text)] flex items-center gap-2 font-quran">
          <Settings className="w-5 h-5 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
          الإعدادات والمظهر والملف الشخصي
        </h2>
        <p className="text-xs text-[var(--wird-muted)] mt-1">
          التبديل الفوري بين التصميمين A و B والوضع النهاري أو الليلي، وتخصيص القراءة والتلاوة وإدارة الحساب
        </p>
      </div>

      {/* 1.25 Dedicated Four-Variant Appearance & Design Selector */}
      <section
        id="settings-appearance-section"
        aria-label="إعدادات التصميم والمظهر"
        className="wird-card rounded-2xl p-5 sm:p-6 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--wird-border)] pb-3">
          <div className="flex items-center gap-2 font-bold text-sm text-[var(--wird-text)]">
            <Palette className="w-4 h-4 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
            <span>التصميم والمظهر البصري (A / B × نهاري / ليلي)</span>
          </div>
          <span className="text-[11px] font-semibold text-[var(--wird-muted)]">
            يُحفظ تلقائياً وفورياً
          </span>
        </div>

        <AppearanceSelectorPanel
          layout="settings"
          mode={effectiveAppearanceMode}
          onSetMode={handleImmediateAppearanceMode}
          preferences={effectiveThemePrefs}
          onUpdatePreferences={handleUpdateThemePrefs}
          onReset={handleResetAppearanceSettings}
          onOpenShowcase={onOpenShowcase}
        />
      </section>

      {/* 1.5 Firebase Authentication Status Card */}
      <div className="wird-card rounded-2xl p-5 sm:p-6 space-y-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--wird-border)] pb-3">
          <div className="flex items-center gap-2 font-bold text-sm text-[var(--wird-text)]">
            <Shield className="w-4 h-4 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
            <span>حالة الحساب والهوية</span>
          </div>
          {isGuest || !user ? (
            <span className="text-xs text-[var(--wird-accent-hover)] dark:text-[var(--wird-accent)] font-bold">
              نمط الزائر (محلي)
            </span>
          ) : isEmailVerified ? (
            <span className="text-xs text-[var(--wird-primary)] dark:text-[var(--wird-accent)] font-bold">
              حساب موثق
            </span>
          ) : (
            <span className="text-xs text-[var(--wird-accent-hover)] dark:text-[var(--wird-accent)] font-bold">
              بانتظار تفعيل البريد
            </span>
          )}
        </div>

        {user && !isGuest ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[var(--wird-surface-muted)] p-4 rounded-xl border border-[var(--wird-border)]">
            <div className="flex items-center gap-3">
              <WirdAvatar size="md" shape="squircle" variant="primary" />
              <div className="space-y-1">
                <div className="font-bold text-[var(--wird-text)] flex items-center gap-2 font-mono">
                  <span>{user.email || user.displayName || 'مستخدم مسجل'}</span>
                  {isEmailVerified ? (
                    <span title="البريد الإلكتروني مفعل">
                      <CheckCircle2 className="w-4 h-4 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
                    </span>
                  ) : (
                    <span title="البريد الإلكتروني غير مؤكد بعد" className="text-[var(--wird-accent-hover)] dark:text-[var(--wird-accent)] font-sans text-[11px] font-bold bg-[var(--wird-accent-soft)] px-2 py-0.5 rounded-md border border-[#C59B27]/30">
                      غير مؤكد
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[var(--wird-muted)]">
                  طريقة التسجيل: {user.providerData.some(p => p.providerId === 'google.com') ? 'Google OAuth' : 'البريد الإلكتروني وكلمة المرور'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => logout()}
              className="min-h-11 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-bold rounded-xl border border-rose-200 dark:border-rose-800 transition-colors flex items-center gap-1.5 shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[var(--wird-surface-muted)] p-4 rounded-xl border border-[var(--wird-border)]">
            <div className="flex items-center gap-3">
              <WirdAvatar size="md" shape="squircle" variant="monochrome" />
              <div className="space-y-1">
                <div className="font-bold text-[var(--wird-text)]">
                  أنت تستخدم المنصة حالياً بنمط الزائر
                </div>
                <p className="text-[11px] text-[var(--wird-muted)]">
                  جميع بيانات الحفظ والمراجعة المحفوظة محلية وتعمل بكفاءة تامة. يمكنك إنشاء حساب مستقبلاً لتفعيل المزامنة في المكونات القادمة.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => logout()}
              className="min-h-11 px-4 py-2 bg-[var(--wird-primary)] hover:bg-[var(--wird-primary-hover)] text-[var(--wird-primary-ink)] font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 shrink-0 border border-[#C59B27]/40"
            >
              <KeyRound className="w-3.5 h-3.5 text-[#E0A96D] dark:text-[var(--wird-accent-ink)]" />
              <span>تسجيل الدخول / حساب جديد</span>
            </button>
          </div>
        )}
      </div>

      {/* Offline readiness: explicit opt-in download of lazy app assets */}
      <section className="wird-card rounded-2xl p-5 sm:p-6 space-y-4 text-xs">
        <div className="flex items-center gap-2 border-b border-[var(--wird-border)] pb-3">
          <Download className="w-4 h-4 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
          <h3 className="font-bold text-sm text-[var(--wird-text)]">التجهيز للعمل دون إنترنت</h3>
        </div>
        <p className="text-[var(--wird-text)] leading-7">
          نزّل ملفات الشاشات والبيانات البرمجية المؤجلة إلى هذا الجهاز لتعمل الأقسام التي لم تفتحها من قبل دون اتصال. التنزيل اختياري ويُحفظ تدريجيًا؛ إذا انقطع الاتصال يمكنك إعادة المحاولة لاستكمال الملفات المتبقية.
        </p>
        <p className="text-[var(--wird-muted)] leading-6">
          هذا التجهيز لا ينزّل كامل مكتبة التلاوات أو التفاسير. عند تشغيل التلاوة متصلًا، يحفظ وِرد تلقائيًا مقطعًا قصيرًا من الآيات التالية، وليس السورة كاملة. يحتفظ التطبيق بالتفاسير التي سبق عرضها ضمن ذاكرة محلية محدودة؛ أما التفسير غير المحفوظ فيحتاج اتصالًا. كما يحتفظ بصفحات الأحاديث التي سبق عرضها بعد التحقق من مصدرها وصحتها، ضمن ذاكرة محلية محدودة. كذلك تُحفظ صفحات المصحف المصوّرة الخارجية عند عرضها بعدد محدود، وليس كامل الصفحات الـ604. قد يستهلك التخزين مساحة، وقد يحذف المتصفح الملفات إذا لم يمنح التخزين الدائم؛ لذلك لا يُعد نسخة احتياطية.
        </p>
        {offlineStorageStatus && (
          <div className="rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] p-3 space-y-1" aria-live="polite">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-[var(--wird-text)]">حماية التخزين المحلي</span>
              <span className={offlineStorageStatus.persisted ? 'text-[var(--wird-primary)] dark:text-[var(--wird-accent)] font-bold' : 'text-[var(--wird-accent-hover)] dark:text-[var(--wird-accent)] font-bold'}>
                {offlineStorageStatus.persisted === true ? 'حفظ دائم مفعّل' : offlineStorageStatus.supported ? 'قد يخضع التخزين للإزالة' : 'غير مدعوم في هذا المتصفح'}
              </span>
            </div>
            {offlineStorageStatus.usageBytes !== null && offlineStorageStatus.quotaBytes !== null && (
              <div className="text-[var(--wird-muted)] tabular-nums">
                المستخدم: {(offlineStorageStatus.usageBytes / (1024 * 1024)).toFixed(1)} MB من {(offlineStorageStatus.quotaBytes / (1024 * 1024)).toFixed(1)} MB
              </div>
            )}
          </div>
        )}
        {offlinePackageStatus && (
          <div className="rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] p-3 space-y-2" aria-live="polite">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-[var(--wird-text)]">حالة ملفات التطبيق على هذا الجهاز</span>
              <span className={offlinePackageStatus.missing === 0 ? 'text-[var(--wird-primary)] dark:text-[var(--wird-accent)] font-bold' : 'text-[var(--wird-accent-hover)] dark:text-[var(--wird-accent)] font-bold'}>
                {offlinePackageStatus.missing === 0 ? 'مكتمل' : 'غير مكتمل'}
              </span>
            </div>
            <div className="text-[var(--wird-muted)] tabular-nums">
              {offlinePackageStatus.cached} محفوظ · {offlinePackageStatus.missing} متبقٍ · {offlinePackageStatus.total} إجمالي الملفات
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCheckOfflineStatus}
            disabled={isCheckingOfflineStatus || !('serviceWorker' in navigator)}
            className="w-full sm:w-auto min-h-11 px-4 py-2.5 rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] text-[var(--wird-text)] hover:bg-[var(--wird-surface-muted)] disabled:opacity-50 font-bold inline-flex items-center justify-center gap-2 transition-colors"
          >
            <Database className="w-4 h-4" />
            {isCheckingOfflineStatus ? 'جارٍ فحص الملفات...' : 'فحص الملفات المحفوظة'}
          </button>
          <button
            type="button"
            onClick={handlePrepareOffline}
            disabled={isPreparingOffline || !isOnline}
            className="w-full sm:w-auto min-h-11 px-4 py-2.5 rounded-xl bg-[var(--wird-primary)] hover:bg-[var(--wird-primary-hover)] disabled:opacity-50 text-[var(--wird-primary-ink)] font-bold inline-flex items-center justify-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            {isPreparingOffline ? 'جارٍ تنزيل ملفات التطبيق...' : offlineProgress ? 'استكمال / التحقق من التجهيز' : 'تجهيز وِرد لهذا الجهاز'}
          </button>
        </div>
        {offlineProgress && (
          <div className="space-y-2" aria-live="polite">
            <div className="flex justify-between text-[var(--wird-muted)]">
              <span>تم تنزيل {offlineProgress.completed} من {offlineProgress.total}</span>
              <span className="font-mono tabular-nums">{Math.round(offlineProgress.completed / Math.max(offlineProgress.total, 1) * 100)}%</span>
            </div>
            <div
              role="progressbar"
              aria-label="تقدم تجهيز وِرد للعمل دون إنترنت"
              aria-valuemin={0}
              aria-valuemax={offlineProgress.total}
              aria-valuenow={offlineProgress.completed}
              className="h-2 rounded-full bg-[var(--wird-surface-muted)] overflow-hidden"
            >
              <div className="h-full bg-[var(--wird-primary)] dark:bg-[#E0A96D] transition-all" style={{ width: `${offlineProgress.completed / Math.max(offlineProgress.total, 1) * 100}%` }} />
            </div>
          </div>
        )}

        {/* PWA Install Prompt Card + Capability Matrix */}
        <PWAInstallAction
          variant="card"
          isStandalone={Boolean(isStandalone)}
          hasInstallPrompt={Boolean(hasInstallPrompt)}
          onInstall={() => onInstallPwa?.()}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <div className="rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] p-3 space-y-1.5">
            <div className="font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 shrink-0" />
              <span>يعمل دون إنترنت 100%</span>
            </div>
            <p className="text-[11px] text-[var(--wird-muted)] leading-5">
              المصحف كاملاً بالنص المعتمد، جلسات الحفظ والربط التراكمي، مركز المراجعة والآيات المتعثرة، الاختبارات، خطط الحفظ، والتلاوات المحمّلة أدناه.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--wird-border-gold)] bg-[var(--wird-surface-muted)] p-3 space-y-1.5">
            <div className="font-bold text-[var(--wird-accent-hover)] dark:text-[var(--wird-accent)] flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>يتطلب اتصالاً بالإنترنت</span>
            </div>
            <p className="text-[11px] text-[var(--wird-muted)] leading-5">
              تنزيل تلاوات جديدة أو الاستماع لقارئ بث مباشر (مثل الغامدي)، التفاسير غير المحفوظة مسبقاً، صفحات المصحف المصوّرة الجديدة، والمزامنة السحابية.
            </p>
          </div>
        </div>

        {/* Bounded Offline Audio Library Manager */}
        <div className="pt-4 border-t border-[var(--wird-border)] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-sm text-[var(--wird-text)]">
              <HardDrive className="w-4 h-4 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
              <span>مدير تحميل التلاوات للعمل أوفلاين</span>
            </div>
            <span className="text-[11px] font-mono tabular-nums text-[var(--wird-muted)]">
              المحفوظ: {audioLibraryStats.availableFilesCount} آية ({formatBytesLabel(audioLibraryStats.totalBytes)})
            </span>
          </div>

          {!profileApprovedReciter && (
            <div className="rounded-xl border border-[#C59B27]/40 bg-[var(--wird-accent-soft)] p-3 text-[11px] text-[var(--wird-text)]">
              تنبيه الترخيص: قارئك المختار حالياً في الإعدادات متاح للبث المباشر أونلاين فقط؛ اختر قارئاً من القائمة المعتمدة أدناه لتنزيل التلاوات أوفلاين.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="font-semibold text-[var(--wird-text)]">القارئ المعتمد للتنزيل الأوفلاين:</span>
              <select
                aria-label="اختيار القارئ لتحميل التلاوات أوفلاين"
                value={audioDownloadReciter}
                onChange={e => setAudioDownloadReciter(e.target.value)}
                className="min-h-11 rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] px-3 text-xs font-semibold text-[var(--wird-text)]"
              >
                {FALLBACK_QURAN_RECITERS.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.bitrate} kbps)
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-col gap-1">
              <span className="font-semibold text-[var(--wird-text)]">نطاق التحميل:</span>
              <div role="group" aria-label="نطاق تحميل التلاوات أوفلاين" className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'surah' as const, label: 'سورة كاملة' },
                  { id: 'juz' as const, label: 'جزء كامل' },
                  { id: 'plan' as const, label: 'الخطة النشطة' }
                ].map(item => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={audioScopeKind === item.id}
                    disabled={item.id === 'plan' && enginePlans.length === 0}
                    onClick={() => setAudioScopeKind(item.id)}
                    className={`min-h-11 px-2 py-1.5 rounded-xl font-bold border transition-colors whitespace-nowrap disabled:opacity-45 ${
                      audioScopeKind === item.id
                        ? 'bg-[var(--wird-primary)] text-white border-[#C59B27]'
                        : 'bg-[var(--wird-surface-muted)] text-[var(--wird-text)] border-[var(--wird-border)]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            {audioScopeKind === 'surah' && (
              <label className="flex flex-col gap-1">
                <span className="font-semibold text-[var(--wird-text)]">اختر السورة:</span>
                <select
                  aria-label="السورة المطلوب تحميل تلاوتها أوفلاين"
                  value={audioSurahNumber}
                  onChange={e => setAudioSurahNumber(Number(e.target.value))}
                  className="min-h-11 rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] px-3 text-xs font-semibold text-[var(--wird-text)]"
                >
                  {ALL_SURAHS.map(s => (
                    <option key={s.number} value={s.number}>
                      {s.number}. سورة {s.name} ({s.versesCount} آية)
                    </option>
                  ))}
                </select>
              </label>
            )}

            {audioScopeKind === 'juz' && (
              <label className="flex flex-col gap-1">
                <span className="font-semibold text-[var(--wird-text)]">اختر الجزء:</span>
                <select
                  aria-label="الجزء المطلوب تحميل تلاوته أوفلاين"
                  value={audioJuzNumber}
                  onChange={e => setAudioJuzNumber(Number(e.target.value))}
                  className="min-h-11 rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] px-3 text-xs font-semibold text-[var(--wird-text)]"
                >
                  {Array.from({ length: 30 }, (_, i) => i + 1).map(j => (
                    <option key={j} value={j}>الجزء {j}</option>
                  ))}
                </select>
              </label>
            )}

            {audioScopeKind === 'plan' && (
              <label className="flex flex-col gap-1">
                <span className="font-semibold text-[var(--wird-text)]">اختر الخطة:</span>
                <select
                  aria-label="الخطة المطلوب تحميل تلاواتها أوفلاين"
                  value={selectedAudioPlan?.id || ''}
                  onChange={e => setAudioPlanId(e.target.value)}
                  className="min-h-11 rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] px-3 text-xs font-semibold text-[var(--wird-text)]"
                >
                  {enginePlans.map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </label>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] rounded-xl px-3 py-2">
              <div className="text-[11px] tabular-nums">
                <div className="font-bold text-[var(--wird-text)]">
                  {targetAudioPayload.labelAr} · {targetAudioPayload.totalAyahs} آية
                </div>
                <div className="text-[var(--wird-muted)]">
                  الحجم التقديري: ~{formatBytesLabel(estimateAudioDownloadBytes(audioDownloadReciter, targetAudioPayload.totalAyahs))}
                </div>
              </div>
              <button
                type="button"
                disabled={isEnqueuingAudioJob || !isOnline || targetAudioPayload.ranges.length === 0 || audioQuotaPreflight?.allowed === false}
                onClick={handleStartOfflineAudioDownload}
                className="wird-btn-primary min-h-11 px-4 py-2 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>{isEnqueuingAudioJob ? 'جارٍ التجهيز...' : 'بدء التحميل للأوفلاين'}</span>
              </button>
            </div>
          </div>

          {audioQuotaPreflight && !audioQuotaPreflight.allowed && (
            <p role="alert" className="text-[11px] text-rose-700 dark:text-rose-300 font-semibold">
              {audioQuotaPreflight.messageAr}
            </p>
          )}

          {audioJobs.length > 0 && (
            <div className="space-y-2.5" aria-label="قائمة مهام تحميل التلاوات">
              {audioJobs.map(job => {
                const percent = Math.round((job.completedItems / Math.max(1, job.totalItems)) * 100);
                const statusLabel =
                  job.status === 'completed' ? 'مكتمل ومتاح أوفلاين' :
                  job.status === 'downloading' ? 'جارٍ التحميل' :
                  job.status === 'paused' ? 'متوقف مؤقتاً' :
                  job.status === 'partial' ? 'مكتمل جزئياً' :
                  job.status === 'failed' ? 'تعذر الاكتمال' :
                  job.status === 'cancelled' ? 'ملغى' : 'في الانتظار';
                const reciterName = FALLBACK_QURAN_RECITERS.find(r => r.id === job.reciterId)?.name || job.reciterId;

                return (
                  <div
                    key={job.jobId}
                    className="rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] p-3.5 space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-[var(--wird-text)]">
                          {job.labelAr} · <span className="font-normal text-[var(--wird-muted)]">{reciterName}</span>
                        </div>
                        <div className="text-[11px] text-[var(--wird-muted)] tabular-nums">
                          {statusLabel} · {job.completedItems}/{job.totalItems} آية ({percent}%) · {formatBytesLabel(job.totalBytes)}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {job.status === 'downloading' && (
                          <button
                            type="button"
                            onClick={() => void offlineQuranAudioLibrary.pauseJob(job.jobId)}
                            className="min-h-11 px-3 py-1.5 rounded-lg border border-[var(--wird-border)] bg-[var(--wird-surface)] text-[var(--wird-text)] font-bold inline-flex items-center gap-1 text-[11px] whitespace-nowrap"
                          >
                            <Pause className="w-3.5 h-3.5" />
                            <span>إيقاف مؤقت</span>
                          </button>
                        )}
                        {(job.status === 'paused' || job.status === 'partial' || job.status === 'failed' || job.status === 'queued') && (
                          <button
                            type="button"
                            disabled={!isOnline}
                            onClick={() => void offlineQuranAudioLibrary.startOrResumeJob(job.jobId)}
                            className="min-h-11 px-3 py-1.5 rounded-lg bg-[var(--wird-primary)] text-white font-bold inline-flex items-center gap-1 text-[11px] whitespace-nowrap disabled:opacity-50"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>{job.status === 'failed' ? 'إعادة المحاولة' : 'استكمال'}</span>
                          </button>
                        )}
                        {(job.status === 'downloading' || job.status === 'queued' || job.status === 'paused') && (
                          <button
                            type="button"
                            onClick={() => void offlineQuranAudioLibrary.cancelJob(job.jobId)}
                            className="min-h-11 px-3 py-1.5 rounded-lg border border-[var(--wird-border)] text-[var(--wird-muted)] font-bold inline-flex items-center gap-1 text-[11px] whitespace-nowrap"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>إلغاء</span>
                          </button>
                        )}
                        <button
                          type="button"
                          aria-label={`حذف حزمة التلاوة ${job.labelAr}`}
                          onClick={() => void offlineQuranAudioLibrary.deleteJob(job.jobId)}
                          className="min-h-11 min-w-11 px-2.5 py-1.5 rounded-lg text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-bold inline-flex items-center justify-center text-[11px]"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div
                      role="progressbar"
                      aria-label={`تقدم تحميل ${job.labelAr}`}
                      aria-valuemin={0}
                      aria-valuemax={Math.max(1, job.totalItems)}
                      aria-valuenow={job.completedItems}
                      className="h-1.5 rounded-full bg-[#E6DFCE] dark:bg-[var(--wird-surface-elevated)] overflow-hidden"
                    >
                      <div className="h-full bg-[var(--wird-primary)] dark:bg-[#E0A96D] transition-all" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 1.6 Cloud Sync & Data Protection Card */}
      <div className="wird-card rounded-2xl p-5 sm:p-6 space-y-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--wird-border)] pb-3">
          <div className="flex items-center gap-2 font-bold text-sm text-[var(--wird-text)]">
            <Cloud className="w-4 h-4 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
            <span>المزامنة السحابية وحماية البيانات</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold">
            {syncStatus === 'synced' ? (
              <span className="text-[var(--wird-primary)] dark:text-[var(--wird-accent)] flex items-center gap-1.5">
                <CloudCheck className="w-4 h-4" />
                <span>مُزامن بالكامل</span>
              </span>
            ) : syncStatus === 'partial' ? (
              <span className="text-[var(--wird-accent-hover)] dark:text-[var(--wird-accent)] flex items-center gap-1.5">
                <CloudAlert className="w-4 h-4" />
                <span>مزامنة جزئية</span>
              </span>
            ) : syncStatus === 'syncing' || isManualSyncing ? (
              <span className="text-[var(--wird-accent-hover)] dark:text-[var(--wird-accent)] flex items-center gap-1.5">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>جاري المزامنة...</span>
              </span>
            ) : syncStatus === 'offline' ? (
              <span className="text-[var(--wird-muted)] flex items-center gap-1.5">
                <CloudOff className="w-4 h-4" />
                <span>غير متصل (محلي)</span>
              </span>
            ) : syncStatus === 'unverified' ? (
              <span className="text-[var(--wird-accent-hover)] dark:text-[var(--wird-accent)] flex items-center gap-1.5">
                <CloudAlert className="w-4 h-4" />
                <span>بانتظار تفعيل البريد</span>
              </span>
            ) : (
              <span className="text-[var(--wird-muted)] flex items-center gap-1.5">
                <Database className="w-4 h-4" />
                <span>محلي فقط</span>
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
          <div className="bg-[var(--wird-surface-muted)] p-3.5 rounded-xl border border-[var(--wird-border)] space-y-1">
            <span className="text-[var(--wird-muted)] block text-[11px]">حالة الاتصال والشبكة:</span>
            <div className="font-bold text-[var(--wird-text)] flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-[var(--wird-primary)] dark:bg-[#6EE7B7]' : 'bg-[#8B9E9B]'}`} />
              <span>{isOnline ? 'متصل بالإنترنت' : 'غير متصل (يعمل محلياً)'}</span>
            </div>
          </div>

          <div className="bg-[var(--wird-surface-muted)] p-3.5 rounded-xl border border-[var(--wird-border)] space-y-1">
            <span className="text-[var(--wird-muted)] block text-[11px]">التغييرات في انتظار الرفع:</span>
            <div className="font-bold text-[var(--wird-text)] font-mono tabular-nums">
              {pendingCount === 0 ? 'لا توجد تغييرات معلقة' : `${pendingCount} تغيير معلق`}
            </div>
          </div>

          <div className="bg-[var(--wird-surface-muted)] p-3.5 rounded-xl border border-[var(--wird-border)] space-y-1">
            <span className="text-[var(--wird-muted)] block text-[11px]">آخر مزامنة ناجحة:</span>
            <div className="font-bold text-[var(--wird-text)] tabular-nums">
              {lastSyncAtMs ? new Date(lastSyncAtMs).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'لم تتم بعد'}
            </div>
          </div>

          <div className="bg-[var(--wird-surface-muted)] p-3.5 rounded-xl border border-[var(--wird-border)] space-y-1">
            <span className="text-[var(--wird-muted)] block text-[11px]">أحداث سحابية بانتظار التطبيق:</span>
            <div className="font-bold text-[var(--wird-text)] font-mono tabular-nums">
              {remoteInboxPendingCount === 0 ? 'لا توجد أحداث معلقة' : `${remoteInboxPendingCount} حدث غير مطبق`}
            </div>
          </div>

          <div className="bg-[var(--wird-surface-muted)] p-3.5 rounded-xl border border-[var(--wird-border)] space-y-1">
            <span className="text-[var(--wird-muted)] block text-[11px]">تعارضات محفوظة للمراجعة:</span>
            <div className="font-bold text-[var(--wird-text)] font-mono tabular-nums">
              {projectionConflictCount === 0 ? 'لا توجد تعارضات' : `${projectionConflictCount} تعارض محفوظ`}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
          <div className="space-y-1 max-w-xl">
            <p className="text-[11px] text-[var(--wird-muted)] leading-5">
              المزامنة الثنائية ما زالت تمر باختبارات الحماية والتعارض. بياناتك المحلية لا تُحذف عند تعذر الرفع أو تطبيق الأحداث المستقبلة.
            </p>
            {syncErrorMessage && (
              <p className="text-[11px] text-[var(--wird-accent-hover)] dark:text-[var(--wird-accent)] leading-5" role="status">
                {syncErrorMessage}
              </p>
            )}
            {projectionBlockMessage && (
              <p className="text-[11px] text-[var(--wird-accent-hover)] dark:text-[var(--wird-accent)] leading-5" role="status">
                {projectionBlockMessage}
                {remoteProjectionBlockedAtSequence !== null && ` (الحدث رقم ${remoteProjectionBlockedAtSequence})`}
              </p>
            )}
            {latestProjectionConflict && (
              <p className="text-[11px] text-[var(--wird-accent-hover)] dark:text-[var(--wird-accent)] leading-5" role="status">
                آخر تعارض محفوظ: {latestProjectionConflict.collection}/{latestProjectionConflict.documentId}
                {' · '}الحدث #{latestProjectionConflict.serverSequence}
              </p>
            )}
            {projectionConflictCount > 0 && (
              <section className="w-full space-y-3 pt-3 border-t border-[var(--wird-border-gold)]" aria-labelledby="sync-conflict-review-title">
                <div className="space-y-1">
                  <h3 id="sync-conflict-review-title" className="text-xs font-bold text-[var(--wird-text)]">
                    تفاصيل النسخ المحفوظة للتعارضات
                  </h3>
                  <p className="text-[11px] text-[var(--wird-muted)] leading-5">
                    راجع النسختين وسجل العمليات قبل الاختيار. لا تُحذف أدلة التعارض؛ والخيارات المتاحة تقتصر على إعادة نشر لقطة محلية كاملة أو اعتماد أحدث نسخة سحابية.
                  </p>
                </div>
                {conflictDetails.length === 0 ? (
                  <p className="text-[11px] text-[var(--wird-muted)]" role="status">
                    تعذر تحميل تفاصيل التعارضات الآن؛ الأدلة الأصلية ما زالت محفوظة محليًا.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {conflictDetails.map(conflict => {
                      const localMutations = conflict.localMutations || [];
                      const isUnsafeFullSnapshot = containsUnsafeFullSnapshotProjection(conflict.event);
                      const canKeepLocal = !isUnsafeFullSnapshot &&
                        conflict.event.operation === 'upsert' &&
                        conflict.event.collection !== 'syncMeta' &&
                        conflict.event.collection !== 'ruqyahProgress' &&
                        localMutations.length > 0 &&
                        localMutations.every(item =>
                          item.collection === conflict.event.collection &&
                          item.documentId === conflict.event.documentId &&
                          item.operation === 'upsert'
                        );
                      const preparedIntent = conflictIntents[conflict.event.eventId];
                      return (
                      <details key={conflict.event.eventId} className="rounded-xl border border-[var(--wird-border-gold)] bg-[var(--wird-surface-muted)] p-3">
                        <summary className="cursor-pointer flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-[var(--wird-text)]">
                          <span>{conflict.event.collection} / {conflict.event.documentId}</span>
                          <span className="text-[10px] font-normal text-[var(--wird-muted)]">
                            الحدث #{conflict.event.serverSequence} · {new Date(conflict.createdAtMs).toLocaleString('ar-EG')}
                          </span>
                        </summary>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 text-[11px]">
                          <div className="space-y-1">
                            <p className="font-bold text-[var(--wird-text)]">بيانات الحدث البعيد</p>
                            <p className="text-[var(--wird-muted)]">العملية: {conflict.event.operation} · الإصدار: {conflict.event.baseRevision} ← {conflict.event.revision}</p>
                            <pre dir="ltr" className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-[var(--wird-surface)] border border-[var(--wird-border)] p-2 text-[10px] text-[var(--wird-text)]">{JSON.stringify(conflict.event.payload, null, 2)}</pre>
                          </div>
                          <div className="space-y-1">
                            <p className="font-bold text-[var(--wird-text)]">لقطة البيانات المحلية وقت اكتشاف التعارض</p>
                            {Object.entries(conflict.localSnapshot).map(([key, value]) => (
                              <div key={key} className="space-y-1">
                                <p className="text-[var(--wird-muted)] break-all">{key}</p>
                                <pre dir="ltr" className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-[var(--wird-surface)] border border-[var(--wird-border)] p-2 text-[10px] text-[var(--wird-text)]">{formatConflictSnapshotValue(value)}</pre>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="mt-3 space-y-2">
                          <p className="font-bold text-[11px] text-[var(--wird-text)]">
                            العمليات المحلية المعلقة المحفوظة ({conflict.localMutations?.length || 0})
                          </p>
                          {(conflict.localMutations || []).slice(0, 10).map(mutation => (
                            <div key={mutation.mutationId} className="rounded-lg border border-[var(--wird-border)] p-2 space-y-1">
                              <p className="text-[10px] text-[var(--wird-muted)] break-all">
                                {mutation.collection}/{mutation.documentId} · revision base {mutation.baseRevision} · sequence {mutation.sequence}
                              </p>
                              <pre dir="ltr" className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-[var(--wird-surface)] border border-[var(--wird-border)] p-2 text-[10px] text-[var(--wird-text)]">{JSON.stringify(mutation.payload, null, 2)}</pre>
                            </div>
                          ))}
                          {(conflict.localMutations || []).length === 0 && (
                            <p className="text-[10px] text-[var(--wird-muted)]">
                              لم تكن هناك عملية محلية معلقة مرتبطة بهذا المستند عند حفظ التعارض؛ لقطة التخزين المحلية محفوظة أعلاه.
                            </p>
                          )}
                          {(conflict.localMutations || []).length > 10 && (
                            <p className="text-[10px] text-[var(--wird-muted)]">
                              عُرضت أول 10 عمليات فقط؛ بقية العمليات محفوظة في سجل التعافي المحلي.
                            </p>
                          )}
                        </div>
                        <p className="mt-2 text-[10px] text-[var(--wird-muted)]">
                          سبب الإيقاف: {conflict.reason} · معرّف الحدث: <span dir="ltr">{conflict.event.eventId}</span>
                        </p>
                        <div className="mt-3 pt-3 border-t border-[var(--wird-border)] space-y-2">
                          {conflictIntents[conflict.event.eventId] ? (
                            <div className="space-y-2" role="status">
                              <p className="text-[11px] text-[var(--wird-accent-hover)] dark:text-[var(--wird-accent)]">
                                يوجد قرار محفوظ لم يُعتمد بعد ({conflictIntents[conflict.event.eventId]?.decision}). لن يتجاوزه الإسقاط التلقائي.
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {!isUnsafeFullSnapshot && conflict.event.operation === 'upsert' && preparedIntent?.decision === 'use-remote' ? (
                                  <button
                                    type="button"
                                    onClick={() => void handleUseRemoteConflict(conflict.event.eventId)}
                                    disabled={resolvingConflictId !== null || !isOnline || syncStatus === 'syncing'}
                                    className="min-h-11 px-3 py-2 rounded-lg bg-[var(--wird-primary)] text-white text-[11px] font-bold disabled:opacity-50"
                                  >
                                    إعادة محاولة اعتماد النسخة السحابية
                                  </button>
                                ) : !isUnsafeFullSnapshot && canKeepLocal && preparedIntent?.decision === 'keep-local' ? (
                                  <button
                                    type="button"
                                    onClick={() => void handleKeepLocalConflict(conflict.event.eventId)}
                                    disabled={resolvingConflictId !== null || !isOnline || syncStatus === 'syncing'}
                                    className="min-h-11 px-3 py-2 rounded-lg bg-[var(--wird-primary)] text-white text-[11px] font-bold disabled:opacity-50"
                                  >
                                    إعادة محاولة إعادة نشر النسخة المحلية
                                  </button>
                                ) : (
                                  <p className="text-[11px] text-[var(--wird-accent-hover)] dark:text-[var(--wird-accent)]">
                                    قرار الدمج المحفوظ لا يملك منفذاً تنفيذياً آمناً لهذا النوع من التعارض؛ ألغِه فقط إذا راجعت الأدلة وتأكدت من ذلك.
                                  </p>
                                )}
                                <button
                                  type="button"
                                  onClick={() => void handleCancelPreparedConflict(conflict.event.eventId)}
                                  disabled={resolvingConflictId !== null}
                                  className="min-h-11 px-3 py-2 rounded-lg border border-[var(--wird-border)] text-[11px] font-semibold text-[var(--wird-text)] disabled:opacity-50"
                                >
                                  إلغاء القرار غير المنفذ مع الاحتفاظ بالأدلة
                                </button>
                              </div>
                            </div>
                          ) : conflict.event.operation === 'tombstone' ? (
                            <p className="text-[11px] text-[var(--wird-accent-hover)] dark:text-[var(--wird-accent)]" role="status">
                              لا يمكن اختيار النسخة البعيدة لحدث حذف قبل اكتمال سياسة Tombstones؛ لم نفعّل هذا المسار.
                            </p>
                          ) : isUnsafeFullSnapshot ? (
                            <p className="text-[11px] text-[var(--wird-accent-hover)] dark:text-[var(--wird-accent)] leading-5" role="status">
                              هذا التعارض يشمل قائمة الآيات المتعثرة أو سجل النشاط اليومي المحفوظ كلقطة كاملة؛ لم نفعّل خيارات الاستبدال الكلي هنا لأن اختيار نسخة واحدة قد يفقد تغييرات جهاز آخر، وما زالت جميع الأدلة محفوظة.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              <button
                                type="button"
                                onClick={() => { setConfirmLocalConflictId(null); setConfirmRemoteConflictId(conflict.event.eventId); }}
                                disabled={!user || isGuest || !isEmailVerified || !isOnline || syncStatus === 'syncing' || resolvingConflictId !== null}
                                className="min-h-11 px-3 py-2 rounded-lg bg-[var(--wird-primary)] hover:bg-[#143b35] dark:bg-[var(--wird-primary)] dark:hover:bg-[#255C58] text-white text-[11px] font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                استخدام أحدث نسخة سحابية
                              </button>
                              {canKeepLocal && (
                                <button
                                  type="button"
                                  onClick={() => { setConfirmRemoteConflictId(null); setConfirmLocalConflictId(conflict.event.eventId); }}
                                  disabled={!user || isGuest || !isEmailVerified || !isOnline || syncStatus === 'syncing' || resolvingConflictId !== null}
                                  className="min-h-11 px-3 py-2 rounded-lg border border-[var(--wird-border)] text-[var(--wird-primary)] dark:text-[var(--wird-accent)] dark:border-[var(--wird-border)] text-[11px] font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  الاحتفاظ بالنسخة المحلية وإعادة نشرها
                                </button>
                              )}
                              {confirmLocalConflictId === conflict.event.eventId && (
                                <div className="rounded-lg border border-[var(--wird-border)] bg-[var(--wird-primary)]/8 dark:bg-[var(--wird-primary)] p-3 space-y-2" role="group" aria-label="تأكيد إعادة نشر النسخة المحلية">
                                  <p className="text-[11px] leading-5 text-[var(--wird-text)]">
                                    سيُعاد التحقق من أحدث إصدار في Firestore، ثم تُحفظ اللقطة المحلية الحالية كما هي وتُنشأ عملية رفع جديدة مبنية على ذلك الإصدار. ستظل العمليات القديمة وأدلتها في أرشيف التعارض. هذا المسار لا يدمج حقولاً ولا يدعم معاملات syncMeta المجمعة أو أحداث الحذف.
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => void handleKeepLocalConflict(conflict.event.eventId)}
                                      disabled={resolvingConflictId !== null}
                                      className="min-h-11 px-3 py-2 rounded-lg bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] text-[11px] font-bold disabled:opacity-50"
                                    >
                                      {resolvingConflictId === conflict.event.eventId ? 'جارٍ التحقق وتجهيز الرفع…' : 'تأكيد الاحتفاظ بالنسخة المحلية'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmLocalConflictId(null)}
                                      disabled={resolvingConflictId !== null}
                                      className="min-h-11 px-3 py-2 rounded-lg border border-[var(--wird-border)] text-[11px] font-semibold text-[var(--wird-text)] disabled:opacity-50"
                                    >
                                      تراجع
                                    </button>
                                  </div>
                                </div>
                              )}
                              {confirmRemoteConflictId === conflict.event.eventId && (
                                <div className="rounded-lg border border-[var(--wird-border-gold)] bg-[#C59B27]/12 dark:bg-[#E0A96D]/12 p-3 space-y-2" role="group" aria-label="تأكيد استخدام النسخة السحابية">
                                  <p className="text-[11px] leading-5 text-[var(--wird-text)]">
                                    سيُعاد تحميل أحدث مستند من Firestore وتطبيقه محلياً. التعديلات المحلية المعلقة ذات الصلة ستُستبعد من صندوق الرفع بعد حفظ أدلتها في أرشيف التعارض. يشمل القرار كل عمليات المعاملة إذا كان التعارض من syncMeta.
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => void handleUseRemoteConflict(conflict.event.eventId)}
                                      disabled={resolvingConflictId !== null}
                                      className="min-h-11 px-3 py-2 rounded-lg bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] text-[11px] font-bold disabled:opacity-50"
                                    >
                                      {resolvingConflictId === conflict.event.eventId ? 'جارٍ التحقق والتطبيق…' : 'تأكيد استخدام النسخة السحابية'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmRemoteConflictId(null)}
                                      disabled={resolvingConflictId !== null}
                                      className="min-h-11 px-3 py-2 rounded-lg border border-[var(--wird-border)] text-[11px] font-semibold text-[var(--wird-text)] disabled:opacity-50"
                                    >
                                      تراجع
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </details>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
          </div>

          <button
            type="button"
            onClick={handleManualSync}
            disabled={isManualSyncing || syncStatus === 'syncing' || !user || isGuest || !isEmailVerified}
            className={`min-h-11 px-4 py-2 font-bold rounded-xl text-xs transition-colors flex items-center gap-2 shrink-0 ${
              !user || isGuest || !isEmailVerified
                ? 'bg-[var(--wird-surface-muted)] text-[#8B9E9B] border border-[var(--wird-border)] cursor-not-allowed'
                : 'bg-[var(--wird-primary)] hover:bg-[var(--wird-primary-hover)] text-[var(--wird-primary-ink)] shadow-xs'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isManualSyncing || syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
            <span>مزامنة الآن</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 2. User Profile Card */}
        <div className="wird-card rounded-2xl p-5 sm:p-6 space-y-4 text-xs">
          <div className="flex items-center gap-2 font-bold text-sm text-[var(--wird-text)] border-b border-[var(--wird-border)] pb-3">
            <User className="w-4 h-4 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
            <span>بيانات الحافظ والهدف</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[var(--wird-text)] font-semibold mb-1.5">
                اسم الحافظ / الطالب:
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full min-h-11 px-3 py-2 bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] rounded-xl text-[var(--wird-text)] focus:outline-none focus:ring-2 focus:ring-[#C59B27]"
              />
            </div>

            <div>
              <label className="block text-[var(--wird-text)] font-semibold mb-1.5">
                البريد الإلكتروني (محلي):
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full min-h-11 px-3 py-2 bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] rounded-xl text-[var(--wird-text)] focus:outline-none focus:ring-2 focus:ring-[#C59B27] font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-[var(--wird-text)] font-semibold mb-1.5">
              هدفك القرآني:
            </label>
            <input
              type="text"
              value={formData.memorizationGoal}
              onChange={(e) => setFormData({ ...formData, memorizationGoal: e.target.value })}
              placeholder="مثال: حفظ القرآن كاملاً بتدبر..."
              className="w-full min-h-11 px-3 py-2 bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] rounded-xl text-[var(--wird-text)] focus:outline-none focus:ring-2 focus:ring-[#C59B27]"
            />
          </div>
        </div>

        {/* 3. Audio & Reciter Settings */}
        <div className="wird-card rounded-2xl p-5 sm:p-6 space-y-4 text-xs">
          <div className="flex items-center gap-2 font-bold text-sm text-[var(--wird-text)] border-b border-[var(--wird-border)] pb-3">
            <Volume2 className="w-4 h-4 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
            <span>تفضيلات التلاوة والاستماع</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-[var(--wird-text)] font-semibold">
                القارئ المعتمد للتسميع:
              </label>
              <select
                aria-label="القارئ المفضل للتسميع"
                value={formData.preferredReciter}
                onChange={(e) => setFormData({ ...formData, preferredReciter: e.target.value as ReciterId })}
                className="w-full min-h-11 px-3 py-2 bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] rounded-xl text-[var(--wird-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-ring)]"
              >
                {RECITERS.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-[var(--wird-text)] font-semibold">
                عدد مرات التكرار المستهدف للآية:
              </label>
              <select
                aria-label="عدد مرات تكرار الآية المستهدف"
                value={formData.repetitionTarget}
                onChange={(e) => setFormData({ ...formData, repetitionTarget: Number(e.target.value) })}
                className="w-full min-h-11 px-3 py-2 bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] rounded-xl text-[var(--wird-text)] font-mono tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-ring)]"
              >
                <option value="5">5 مرات (سريع)</option>
                <option value="10">10 مرات (موصى به للرسوخ)</option>
                <option value="15">15 مرة (متقن جداً)</option>
                <option value="20">20 مرة (طريقة الشناقطة)</option>
              </select>
            </div>
          </div>
        </div>

        {/* 4. Quran Typography Settings & Live Preview */}
        <div className="wird-card rounded-2xl p-5 sm:p-6 space-y-4 text-xs">
          <div className="flex items-center gap-2 font-bold text-sm text-[var(--wird-text)] border-b border-[var(--wird-border)] pb-3">
            <Type className="w-4 h-4 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
            <span>الخط القرآني والمظهر</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[var(--wird-text)] font-semibold mb-1.5">
                حجم الخط القرآني:
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['sm', 'md', 'lg', 'xl'] as const).map(size => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setFormData({ ...formData, quranFontSize: size })}
                    aria-pressed={formData.quranFontSize === size}
                    className={`min-h-11 py-2 rounded-xl border font-bold transition-colors ${
                      formData.quranFontSize === size
                        ? 'bg-[var(--wird-primary)] text-white border-[var(--wird-border-gold)] shadow-xs'
                        : 'bg-[var(--wird-surface-muted)] border-[var(--wird-border)] text-[var(--wird-muted)]'
                    }`}
                  >
                    {size === 'sm' ? 'صغير' : size === 'md' ? 'متوسط' : size === 'lg' ? 'كبير' : 'أكبر'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[var(--wird-text)] font-semibold mb-1.5">
                وضع الإضاءة السريع:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleImmediateAppearanceMode('light')}
                  aria-pressed={effectiveAppearanceMode === 'light'}
                  className={`min-h-11 py-2 px-3 rounded-xl border flex items-center justify-center gap-2 font-semibold transition-colors ${
                    effectiveAppearanceMode === 'light'
                      ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] border-[var(--wird-accent)]'
                      : 'bg-[var(--wird-surface-muted)] border-[var(--wird-border)] text-[var(--wird-muted)] hover:text-[var(--wird-text)]'
                  }`}
                >
                  <Sun className="w-4 h-4" />
                  <span>نهاري</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleImmediateAppearanceMode('dark')}
                  aria-pressed={effectiveAppearanceMode === 'dark'}
                  className={`min-h-11 py-2 px-3 rounded-xl border flex items-center justify-center gap-2 font-semibold transition-colors ${
                    effectiveAppearanceMode === 'dark'
                      ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] border-[var(--wird-accent)]'
                      : 'bg-[var(--wird-surface-muted)] border-[var(--wird-border)] text-[var(--wird-muted)] hover:text-[var(--wird-text)]'
                  }`}
                >
                  <Moon className="w-4 h-4" />
                  <span>ليلي</span>
                </button>
              </div>
            </div>
          </div>

          {/* Live Preview */}
          <div className="p-4 bg-[var(--wird-surface-muted)] rounded-xl border border-[var(--wird-border)] text-center">
            <div className="text-[10px] text-[var(--wird-muted)] mb-2">معاينة الخط القرآني:</div>
            <p className={`font-quran leading-loose text-[var(--wird-text)] ${
              formData.quranFontSize === 'sm' ? 'text-lg' :
              formData.quranFontSize === 'md' ? 'text-xl' :
              formData.quranFontSize === 'lg' ? 'text-2xl' : 'text-3xl'
            }`}>
              «إِنَّ هَٰذَا الْقُرْآنَ يَهْدِي لِلَّتِي هِيَ أَقْوَمُ»
            </p>
          </div>
        </div>

        {/* 5. Backup & Data Management Card */}
        <div className="wird-card rounded-2xl p-5 sm:p-6 space-y-4 text-xs">
          <div className="flex items-center gap-2 font-bold text-sm text-[var(--wird-text)] border-b border-[var(--wird-border)] pb-3">
            <Database className="w-4 h-4 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
            <span>النسخ الاحتياطي واستعادة البيانات</span>
          </div>

          <p className="text-[var(--wird-muted)] leading-relaxed">
            بياناتك محفوظة محلياً على هذا المتصفح. يمكنك تصدير نسخة احتياطية كاملة ونقلها إلى أي جهاز آخر أو استعادتها بأمان.
          </p>

          {/* Security Transparency Notice */}
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-[var(--wird-accent-soft)] border border-[var(--wird-border-gold)] text-[var(--wird-text)] text-[11px] leading-relaxed">
            <AlertTriangle className="w-4 h-4 shrink-0 text-[var(--wird-accent)] mt-0.5" />
            <span>
              <strong>إشعار الشفافية والخصوصية:</strong> ملفات النسخ الاحتياطي نصية غير مشفرة بصيغة JSON صريحة. احتفظ بملفاتك المصدرة في مكان آمن لضمان خصوصيتك التامة.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleExportBackup}
              className="flex min-h-11 items-center gap-2 px-4 py-2.5 bg-[var(--wird-surface-muted)] hover:bg-[var(--wird-surface-muted)] text-[var(--wird-text)] rounded-xl font-bold border border-[var(--wird-border)] transition-colors shadow-2xs"
            >
              <Download className="w-4 h-4 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
              <span>تصدير نسخة احتياطية (JSON)</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex min-h-11 items-center gap-2 px-4 py-2.5 bg-[var(--wird-surface-muted)] hover:bg-[var(--wird-surface-muted)] text-[var(--wird-text)] rounded-xl font-bold border border-[var(--wird-border)] transition-colors shadow-2xs"
            >
              <Upload className="w-4 h-4 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
              <span>استيراد نسخة احتياطية</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>

        {import.meta.env.DEV && (
          <>
        {/* 6. Isolated Demo Mode Card */}
        <div className="wird-card rounded-2xl p-5 sm:p-6 space-y-3 text-xs">
          <div className="flex items-center justify-between border-b border-[var(--wird-border)] pb-3">
            <div className="flex items-center gap-2 font-bold text-sm text-[var(--wird-text)]">
              <Sparkles className="w-4 h-4 text-[var(--wird-accent)]" />
              <span>البيانات التجريبية الاستعراضية (Demo Mode)</span>
            </div>
            <span className="text-[10px] bg-[var(--wird-accent-soft)] text-[var(--wird-accent-hover)] dark:text-[var(--wird-accent)] font-bold px-2.5 py-0.5 rounded-md">
              للمعاينة فقط
            </span>
          </div>

          <p className="text-[var(--wird-muted)] leading-relaxed">
            يبدأ المستخدمون الجدد افتراضياً بملف نظيف وسجلات فارغة بنسبة صفر%. إذا رغبت في معاينة التطبيق واختبار جميع الشاشات بمحتوى تجريبي لسورة الملك والنبأ، يمكنك تحميل الحزمة التجريبية هنا.
          </p>

          <button
            type="button"
            onClick={(event) => { demoTriggerRef.current = event.currentTarget; setShowDemoConfirm(true); }}
            className="flex min-h-11 items-center gap-2 px-4 py-2 bg-[#C59B27]/12 dark:bg-[#E0A96D]/12 hover:bg-[#C59B27]/20 dark:hover:bg-[#E0A96D]/20 text-[var(--wird-accent-hover)] dark:text-[var(--wird-accent)] rounded-xl font-semibold border border-[var(--wird-border-gold)] transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>تحميل بيانات تجريبية (Demo Data)</span>
          </button>
        </div>
          </>
        )}

        {/* Submit Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <button
            type="submit"
            className="flex min-h-11 items-center gap-2 px-6 py-2.5 bg-[var(--wird-primary)] hover:bg-[var(--wird-primary-hover)] text-[var(--wird-primary-ink)] rounded-xl text-xs font-bold shadow-xs transition-colors"
          >
            {isSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            <span>{isSaved ? 'تم حفظ التغييرات بنجاح!' : 'حفظ التعديلات'}</span>
          </button>

          <button
            type="button"
            onClick={(event) => { resetTriggerRef.current = event.currentTarget; setShowResetConfirm(true); }}
            className="flex min-h-11 items-center gap-1.5 px-4 py-2.5 text-[var(--wird-muted)] hover:text-rose-600 dark:hover:text-rose-400 text-xs font-medium transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>إعادة ضبط المصنع للبيانات</span>
          </button>
        </div>
      </form>

      {/* 7. WIRD Brand Visual Identity & Showcase Section (Embedded & Collapsible) */}
      <section className="wird-card rounded-2xl p-5 sm:p-6 space-y-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[var(--wird-accent-soft)] text-[var(--wird-accent-hover)] dark:text-[var(--wird-accent)] flex items-center justify-center shrink-0">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[var(--wird-text)]">دليل الهوية البصرية ومعرض التصميم</h3>
              <p className="text-[11px] text-[var(--wird-muted)]">استعراض ألوان وِرد النهارية والليلية، الشعارات، والخطوط المعتمدة</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsBrandShowcaseOpen(prev => !prev)}
              aria-expanded={isBrandShowcaseOpen}
              className="min-h-11 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] text-[var(--wird-text)] font-bold hover:bg-[var(--wird-surface-muted)] transition-colors"
            >
              {isBrandShowcaseOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              <span>{isBrandShowcaseOpen ? 'إخفاء دليل الهوية' : 'استعراض دليل الألوان والهوية البصرية'}</span>
            </button>
            {onOpenShowcase && (
              <button
                type="button"
                onClick={onOpenShowcase}
                className="min-h-11 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--wird-accent)] hover:bg-[var(--wird-accent-hover)] text-[var(--wird-accent-ink)] font-bold transition-colors"
              >
                <span>فتح المعرض الكامل</span>
              </button>
            )}
          </div>
        </div>

        {isBrandShowcaseOpen && (
          <div className="pt-4 border-t border-[var(--wird-border)]">
            <BrandDesignShowcase onClose={() => setIsBrandShowcaseOpen(false)} />
          </div>
        )}
      </section>

      {/* In-app Reset Confirmation Dialog */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div ref={resetDialogRef} role="dialog" aria-modal="true" aria-labelledby="wird-reset-confirm-title" className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-[var(--wird-border-gold)] bg-[var(--wird-surface)] p-6 shadow-2xl space-y-4 text-right">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 id="wird-reset-confirm-title" className="font-bold text-[var(--wird-text)] text-base">
                  تأكيد إعادة الضبط الافتراضي
                </h3>
                <p className="text-xs text-[var(--wird-muted)]">
                  هل أنت متأكد من رغبتك في مسح كافة السجلات المحلية؟
                </p>
              </div>
            </div>

            <p className="text-xs text-[var(--wird-text)] leading-relaxed bg-[var(--wird-surface)] p-3.5 rounded-xl border border-[var(--wird-border)]">
              سيتم إعادة تعيين إحصائيات الحفظ وخططك وسجلات المراجعة إلى بيانات وِرد الأولية. لن تتمكن من التراجع عن هذه الخطوة إلا إذا كان لديك ملف نسخة احتياطية.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                ref={resetCancelRef}
                type="button"
                onClick={() => setShowResetConfirm(false)}
                disabled={isResetting}
                className="min-h-11 px-4 py-2 text-xs font-semibold text-[var(--wird-text)] hover:bg-[var(--wird-surface-muted)] rounded-xl transition-colors"
              >
                إلغاء التراجع
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                disabled={isResetting}
                className="min-h-11 px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors"
              >
                تأكيد إعادة الضبط
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-app Demo Mode Confirmation Dialog */}
      {import.meta.env.DEV && showDemoConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div ref={demoDialogRef} role="dialog" aria-modal="true" aria-labelledby="wird-demo-confirm-title" className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-[var(--wird-border-gold)] bg-[var(--wird-surface)] p-6 shadow-2xl space-y-4 text-right">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[var(--wird-accent-soft)] text-[var(--wird-accent-hover)] dark:text-[var(--wird-accent)] flex items-center justify-center shrink-0">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 id="wird-demo-confirm-title" className="font-bold text-[var(--wird-text)] text-base">
                  تأكيد تفعيل البيانات التجريبية
                </h3>
                <p className="text-xs text-[var(--wird-muted)]">
                  تحميل بيانات استعراضية للملك والنبأ
                </p>
              </div>
            </div>

            <p className="text-xs text-[var(--wird-text)] leading-relaxed bg-[var(--wird-surface)] p-3.5 rounded-xl border border-[var(--wird-border)]">
              سيتم تحميل خطة وسجلات استعراضية ومقاطع مراجعة تجريبية لمساعدتك على فحص جميع ميزات التطبيق. يمكنك دائماً العودة إلى الحالة الصفرية بالضغط على "إعادة ضبط المصنع".
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                ref={demoCancelRef}
                type="button"
                onClick={() => setShowDemoConfirm(false)}
                className="min-h-11 px-4 py-2 text-xs font-semibold text-[var(--wird-text)] hover:bg-[var(--wird-surface-muted)] rounded-xl transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleLoadDemoData}
                className="min-h-11 px-5 py-2 text-xs font-bold text-[var(--wird-accent-ink)] bg-[var(--wird-accent)] hover:bg-[var(--wird-accent-hover)] rounded-xl shadow-xs transition-colors"
              >
                تحميل البيانات الآن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
