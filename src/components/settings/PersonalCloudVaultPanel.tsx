import React, { useEffect, useRef, useState } from 'react';
import {
  Cloud,
  CloudCheck,
  Copy,
  Download,
  ExternalLink,
  FolderSync,
  HardDrive,
  Link2,
  RefreshCw,
  ShieldCheck,
  Unlink,
  Upload,
} from 'lucide-react';
import {
  createInstantSyncCapsule,
  disconnectGoogleDrivePersonalCloud,
  exportSmartCloudVaultJson,
  hasActiveGoogleDriveSession,
  isFileSystemAccessSupported,
  linkCloudSyncFile,
  mergeInstantSyncCapsule,
  mergeSmartCloudVaultJson,
  readPersonalCloudMeta,
  subscribePersonalCloudMeta,
  syncLinkedCloudFileNow,
  syncWithGoogleDrivePersonalCloud,
  updatePersonalCloudMeta,
  type PersonalCloudSyncMeta,
} from '../../services/personalCloudSyncService';
import {
  countActiveTombstones,
  readSyncTombstoneLedger,
} from '../../services/syncTombstoneRegistry';
import { getLocalDateString } from '../../services/unifiedPortionService';

interface PersonalCloudVaultPanelProps {
  onSynced?: () => void;
  onToast?: (message: string, type?: 'success' | 'warn' | 'error' | 'info') => void;
}

export const PersonalCloudVaultPanel: React.FC<PersonalCloudVaultPanelProps> = ({
  onSynced,
  onToast,
}) => {
  const [meta, setMeta] = useState<PersonalCloudSyncMeta>(() => readPersonalCloudMeta());
  const [tombstoneCount, setTombstoneCount] = useState<number>(() =>
    countActiveTombstones(readSyncTombstoneLedger())
  );
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [isSyncingFile, setIsSyncingFile] = useState(false);
  const [driveApiEnableUrl, setDriveApiEnableUrl] = useState<string | null>(null);
  const [capsuleInput, setCapsuleInput] = useState('');
  const [generatedCapsule, setGeneratedCapsule] = useState('');
  const [isBusyCapsule, setIsBusyCapsule] = useState(false);
  const mergeFileInputRef = useRef<HTMLInputElement | null>(null);

  const supportsFileHandle = isFileSystemAccessSupported();
  const driveSessionActive = hasActiveGoogleDriveSession();

  useEffect(() => {
    const unsub = subscribePersonalCloudMeta((next) => {
      setMeta(next);
      setTombstoneCount(countActiveTombstones(readSyncTombstoneLedger()));
    });
    const refreshLedger = () => {
      setTombstoneCount(countActiveTombstones(readSyncTombstoneLedger()));
    };
    window.addEventListener('wird:cloud-sync-applied', refreshLedger);
    window.addEventListener('wird:auxiliary-sync-applied', refreshLedger);
    return () => {
      unsub();
      window.removeEventListener('wird:cloud-sync-applied', refreshLedger);
      window.removeEventListener('wird:auxiliary-sync-applied', refreshLedger);
    };
  }, []);

  const handleGoogleDriveSync = async () => {
    if (isSyncingDrive) return;
    setIsSyncingDrive(true);
    setDriveApiEnableUrl(null);
    try {
      const result = await syncWithGoogleDrivePersonalCloud({ interactive: true });
      if (result.driveApiNotEnabled && result.driveApiEnableUrl) {
        setDriveApiEnableUrl(result.driveApiEnableUrl);
      }
      if (result.success) {
        setTombstoneCount(countActiveTombstones(readSyncTombstoneLedger()));
        onSynced?.();
        onToast?.(result.messageAr, 'success');
      } else {
        onToast?.(result.messageAr, result.driveApiNotEnabled ? 'warn' : 'error');
      }
    } finally {
      setIsSyncingDrive(false);
    }
  };

  const handleToggleDriveAutoSync = () => {
    const nextVal = !meta.googleDriveAutoSync;
    updatePersonalCloudMeta({ googleDriveAutoSync: nextVal });
    onToast?.(
      nextVal
        ? 'تم تفعيل المزامنة التلقائية مع خزنة Google Drive عند الإضافة أو الحذف.'
        : 'تم إيقاف المزامنة التلقائية مع Google Drive (تظل المزامنة اليدوية متاحة).',
      'info'
    );
  };

  const handleLinkCloudFile = async (mode: 'open' | 'create') => {
    if (isSyncingFile) return;
    setIsSyncingFile(true);
    try {
      const result = await linkCloudSyncFile(mode);
      if (result.success) {
        setTombstoneCount(countActiveTombstones(readSyncTombstoneLedger()));
        onSynced?.();
        onToast?.(result.messageAr, 'success');
      } else if (result.messageAr !== 'تم إلغاء اختيار الملف.') {
        onToast?.(result.messageAr, 'warn');
      }
    } finally {
      setIsSyncingFile(false);
    }
  };

  const handleSyncLinkedFileNow = async () => {
    if (isSyncingFile) return;
    setIsSyncingFile(true);
    try {
      const result = await syncLinkedCloudFileNow();
      if (result.success) {
        setTombstoneCount(countActiveTombstones(readSyncTombstoneLedger()));
        onSynced?.();
        onToast?.(result.messageAr, 'success');
      } else if (result.messageAr !== 'تم إلغاء اختيار الملف.') {
        onToast?.(result.messageAr, 'warn');
      }
    } finally {
      setIsSyncingFile(false);
    }
  };

  const handleExportSmartVault = () => {
    try {
      const json = exportSmartCloudVaultJson();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wird-smart-cloud-vault-${getLocalDateString()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      onToast?.(
        'تم حفظ ملف الخزنة السحابية الذكي (يشمل الإضافات وسجل الحذف المحمي لمنع عودة المحذوفات).',
        'success'
      );
    } catch {
      onToast?.('تعذر تصدير ملف الخزنة السحابية الذكي.', 'error');
    }
  };

  const handleSmartMergeFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file || isSyncingFile) return;
    setIsSyncingFile(true);
    try {
      const text = await file.text();
      const result = await mergeSmartCloudVaultJson(text);
      if (result.success) {
        setTombstoneCount(countActiveTombstones(readSyncTombstoneLedger()));
        onSynced?.();
        onToast?.(result.messageAr, 'success');
      } else {
        onToast?.(result.messageAr, 'error');
      }
    } finally {
      setIsSyncingFile(false);
      input.value = '';
    }
  };

  const handleGenerateCapsule = async () => {
    if (isBusyCapsule) return;
    setIsBusyCapsule(true);
    try {
      const code = await createInstantSyncCapsule();
      setGeneratedCapsule(code);
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code).catch(() => undefined);
      }
      onToast?.('تم توليد ونسخ كبسولة المزامنة الفورية؛ الصقها على جهازك الآخر للدمج الفوري.', 'success');
    } catch {
      onToast?.('تعذر توليد كبسولة المزامنة الفورية.', 'error');
    } finally {
      setIsBusyCapsule(false);
    }
  };

  const handleApplyCapsule = async () => {
    if (!capsuleInput.trim() || isBusyCapsule) return;
    setIsBusyCapsule(true);
    try {
      const result = await mergeInstantSyncCapsule(capsuleInput);
      if (result.success) {
        setCapsuleInput('');
        setTombstoneCount(countActiveTombstones(readSyncTombstoneLedger()));
        onSynced?.();
        onToast?.(result.messageAr, 'success');
      } else {
        onToast?.(result.messageAr, 'error');
      }
    } finally {
      setIsBusyCapsule(false);
    }
  };

  return (
    <section
      id="settings-personal-cloud-vault"
      aria-label="السحابة الشخصية لحسابك ومزامنة الإضافات والحذف"
      className="pt-4 border-t border-[var(--wird-border)] space-y-4 text-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-bold text-sm text-[var(--wird-text)]">
          <FolderSync className="w-4 h-4 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
          <span>السحابة الشخصية لحسابك (مزامنة الإضافات والحذف الذكية V4)</span>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] text-[11px] font-semibold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] tabular-nums">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>سجل الحذف المحمي: {tombstoneCount}</span>
        </span>
      </div>

      <p className="text-[11px] text-[var(--wird-muted)] leading-6">
        إلى جانب مزامنة خوادم وِرد الفورية أعلاه، يمكنك ربط سحابتك الشخصية ليحتفظ حسابك بنسخة سحابية مستقلة تملكه أنت بالكامل. يعمل محرك الدمج بنظام (CRDT + HLC Tombstones) فيزامن كل إضافة جديدة ويطبّق كل عملية حذف عبر جميع أجهزتك دون إعادة إحياء العناصر المحذوفة.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* Card 1: Google Drive Personal AppData Vault */}
        <div className="rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] p-4 space-y-3 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="font-bold text-[var(--wird-text)] flex items-center gap-1.5">
                <Cloud className="w-4 h-4 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
                <span>خزنة Google Drive الخاصة بحسابك</span>
              </div>
              {meta.googleDriveEnabled && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
                  <CloudCheck className="w-3.5 h-3.5" />
                  <span>{driveSessionActive ? 'متصل حياً' : 'مربوط'}</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-[var(--wird-muted)] leading-5">
              تُحفظ خزنتك في مجلد التطبيق المعزول (`appDataFolder`) داخل مساحة Google Drive الخاصة بحسابك دون أي صلاحية للوصول إلى ملفاتك الشخصية.
            </p>
            {meta.lastGoogleDriveSyncAtMs && (
              <div className="text-[11px] text-[var(--wird-text)] font-mono tabular-nums">
                آخر مزامنة: {new Date(meta.lastGoogleDriveSyncAtMs).toLocaleString('ar-EG')}
              </div>
            )}
            {driveApiEnableUrl && (
              <div className="rounded-lg border border-[var(--wird-border-gold)] bg-[var(--wird-surface)] p-2.5 space-y-1.5 text-[11px]">
                <p className="text-[var(--wird-text)] font-semibold">
                  يلزم تفعيل Google Drive API لمرة واحدة في إعدادات مشروع السحابة:
                </p>
                <a
                  href={driveApiEnableUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] underline"
                >
                  <span>فتح صفحة التفعيل المباشر في Google Cloud</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>

          <div className="space-y-2 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleGoogleDriveSync}
                disabled={isSyncingDrive}
                className="wird-btn-primary min-h-11 px-3.5 py-2 text-xs font-bold inline-flex items-center justify-center gap-1.5 flex-1 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingDrive ? 'animate-spin' : ''}`} />
                <span>
                  {isSyncingDrive
                    ? 'جارٍ المزامنة مع Google Drive...'
                    : meta.googleDriveEnabled
                      ? 'مزامنة Google Drive الآن'
                      : 'ربط ومزامنة Google Drive'}
                </span>
              </button>

              {meta.googleDriveEnabled && (
                <button
                  type="button"
                  onClick={disconnectGoogleDrivePersonalCloud}
                  className="min-h-11 px-3 py-2 rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface)] text-[var(--wird-muted)] hover:text-rose-700 dark:hover:text-rose-300 font-bold inline-flex items-center gap-1 text-[11px]"
                  title="فصل خزنة Google Drive على هذا الجهاز"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  <span>فصل</span>
                </button>
              )}
            </div>

            <button
              type="button"
              aria-pressed={meta.googleDriveAutoSync}
              onClick={handleToggleDriveAutoSync}
              className={`w-full min-h-11 px-3 py-2 rounded-xl border text-[11px] font-bold flex items-center justify-between transition-colors ${
                meta.googleDriveAutoSync
                  ? 'bg-[var(--wird-surface)] border-[var(--wird-border-gold)] text-[var(--wird-text)]'
                  : 'bg-[var(--wird-surface)] border-[var(--wird-border)] text-[var(--wird-muted)]'
              }`}
            >
              <span>مزامنة تلقائية عند الإضافة أو الحذف</span>
              <span className="text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
                {meta.googleDriveAutoSync ? 'مفعّلة' : 'متوقفة'}
              </span>
            </button>
          </div>
        </div>

        {/* Card 2: Smart Linked Cloud File (iCloud / OneDrive / Dropbox / Universal) */}
        <div className="rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] p-4 space-y-3 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="font-bold text-[var(--wird-text)] flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
                <span>ملف السحابة الذكي (iCloud / OneDrive / Dropbox)</span>
              </div>
              {meta.linkedFileName && (
                <span className="text-[10px] font-mono font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] truncate max-w-[130px]">
                  {meta.linkedFileName}
                </span>
              )}
            </div>
            <p className="text-[11px] text-[var(--wird-muted)] leading-5">
              اربط ملف خزنة داخل مجلدك السحابي المشترك على جهازك لدمج الإضافات وتنفيذ الحذوفات ثنائياً دون فقدان تغييرات أي جهاز.
            </p>
            {meta.lastLinkedFileSyncAtMs && (
              <div className="text-[11px] text-[var(--wird-text)] font-mono tabular-nums">
                آخر دمج سحابي: {new Date(meta.lastLinkedFileSyncAtMs).toLocaleString('ar-EG')}
              </div>
            )}
          </div>

          <div className="space-y-2 pt-1">
            {supportsFileHandle && (
              <div className="flex flex-wrap items-center gap-2">
                {meta.linkedFileName ? (
                  <button
                    type="button"
                    disabled={isSyncingFile}
                    onClick={handleSyncLinkedFileNow}
                    className="wird-btn-primary min-h-11 px-3.5 py-2 text-xs font-bold inline-flex items-center justify-center gap-1.5 flex-1 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingFile ? 'animate-spin' : ''}`} />
                    <span>مزامنة الملف المربوط الآن</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isSyncingFile}
                    onClick={() => handleLinkCloudFile('create')}
                    className="wird-btn-primary min-h-11 px-3.5 py-2 text-xs font-bold inline-flex items-center justify-center gap-1.5 flex-1 disabled:opacity-50"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>إنشاء وربط ملف سحابي حي</span>
                  </button>
                )}
                <button
                  type="button"
                  disabled={isSyncingFile}
                  onClick={() => handleLinkCloudFile('open')}
                  className="min-h-11 px-3 py-2 rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface)] text-[var(--wird-text)] font-bold inline-flex items-center justify-center gap-1.5 text-[11px]"
                >
                  <FolderSync className="w-3.5 h-3.5" />
                  <span>اختيار ملف موجود</span>
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleExportSmartVault}
                className="min-h-11 px-3 py-2 rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface)] text-[var(--wird-text)] hover:border-[var(--wird-border-gold)] font-bold inline-flex items-center justify-center gap-1.5 text-[11px]"
              >
                <Download className="w-3.5 h-3.5 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
                <span>حفظ ملف خزنة ذكي</span>
              </button>

              <button
                type="button"
                disabled={isSyncingFile}
                onClick={() => mergeFileInputRef.current?.click()}
                className="min-h-11 px-3 py-2 rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface)] text-[var(--wird-text)] hover:border-[var(--wird-border-gold)] font-bold inline-flex items-center justify-center gap-1.5 text-[11px]"
              >
                <Upload className="w-3.5 h-3.5 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
                <span>دمج ذكي من ملف</span>
              </button>
              <input
                ref={mergeFileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleSmartMergeFilePicked}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Card 3: Instant Peer-to-Peer Sync Capsule */}
      <details className="rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] p-3.5">
        <summary className="cursor-pointer font-bold text-xs text-[var(--wird-text)] flex items-center justify-between gap-2 min-h-8">
          <span>كبسولة المزامنة الفورية المضغوطة بين جهازين (دون ملفات — تدعم الإضافات والحذف)</span>
          <span className="text-[11px] font-semibold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
            WIRD4 Capsule
          </span>
        </summary>
        <div className="mt-3 pt-3 border-t border-[var(--wird-border)] space-y-3">
          <p className="text-[11px] text-[var(--wird-muted)] leading-5">
            انسخ كبسولة المزامنة المضغوطة من هذا الجهاز وألصقها في هاتفك أو حاسوبك الآخر لدمج كل الخطط والختمات والفواصل والأذكار والحذوفات فوراً.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isBusyCapsule}
              onClick={handleGenerateCapsule}
              className="min-h-11 px-4 py-2 rounded-xl bg-[var(--wird-surface)] border border-[var(--wird-border-gold)] text-[var(--wird-text)] font-bold inline-flex items-center gap-1.5 text-xs"
            >
              <Copy className="w-3.5 h-3.5 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
              <span>{isBusyCapsule ? 'جارٍ الضغط...' : 'توليد ونسخ كبسولة المزامنة'}</span>
            </button>
            {generatedCapsule && (
              <span className="text-[11px] text-[var(--wird-primary)] dark:text-[var(--wird-accent)] font-mono">
                تم النسخ ({Math.max(1, Math.round(generatedCapsule.length / 1024))} ك.ب)
              </span>
            )}
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="text"
              dir="ltr"
              value={capsuleInput}
              onChange={(e) => setCapsuleInput(e.target.value)}
              placeholder="WIRD4Z:..."
              aria-label="رمز كبسولة المزامنة الفورية"
              className="min-h-11 flex-1 rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface)] px-3 text-xs font-mono text-[var(--wird-text)]"
            />
            <button
              type="button"
              disabled={!capsuleInput.trim() || isBusyCapsule}
              onClick={handleApplyCapsule}
              className="wird-btn-primary min-h-11 px-4 py-2 text-xs font-bold disabled:opacity-50 whitespace-nowrap"
            >
              دمج الكبسولة الآن
            </button>
          </div>
        </div>
      </details>

      {meta.lastSummaryAr && (
        <div
          role="status"
          className="rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] px-3.5 py-2.5 text-[11px] font-semibold text-[var(--wird-text)]"
        >
          {meta.lastSummaryAr}
        </div>
      )}
    </section>
  );
};
