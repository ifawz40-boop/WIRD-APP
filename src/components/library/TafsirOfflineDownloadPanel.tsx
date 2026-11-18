import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  downloadOfflineTafsirMuyassar,
  getOfflineTafsirDownloadStatus,
  OFFLINE_TAFSIR_SOURCE,
  type OfflineTafsirDownloadProgress,
  type OfflineTafsirDownloadStatus
} from '../../services/tafsirOfflineLibrary';

interface TafsirOfflineDownloadPanelProps {
  onComplete?: () => void;
  compact?: boolean;
}

export const TafsirOfflineDownloadPanel: React.FC<TafsirOfflineDownloadPanelProps> = ({ onComplete, compact = false }) => {
  const [status, setStatus] = useState<OfflineTafsirDownloadStatus | null>(null);
  const [progress, setProgress] = useState<OfflineTafsirDownloadProgress | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState('');
  const controllerRef = useRef<AbortController | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const current = await getOfflineTafsirDownloadStatus();
      setStatus(current);
      setProgress(previous => previous ? { ...previous, ...current } : null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر قراءة حالة التفسير المحلي.');
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
    return () => controllerRef.current?.abort();
  }, [refreshStatus]);

  const startDownload = async () => {
    const controller = new AbortController();
    controllerRef.current = controller;
    setIsDownloading(true);
    setError('');
    try {
      const result = await downloadOfflineTafsirMuyassar({
        signal: controller.signal,
        onProgress: next => {
          setProgress(next);
          setStatus({
            downloadedSurahs: next.downloadedSurahs,
            totalSurahs: next.totalSurahs,
            isComplete: next.isComplete,
            status: next.status,
            sourceVersion: next.sourceVersion,
            releaseDate: next.releaseDate
          });
        }
      });
      setStatus(result);
      setProgress({ ...result, currentSurah: null });
      onComplete?.();
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === 'AbortError')) {
        setError(reason instanceof Error ? reason.message : 'توقف تنزيل التفسير بسبب خطأ غير متوقع.');
      }
    } finally {
      controllerRef.current = null;
      setIsDownloading(false);
      await refreshStatus();
    }
  };

  const downloaded = progress?.downloadedSurahs ?? status?.downloadedSurahs ?? 0;
  const total = status?.totalSurahs ?? 114;
  const percent = Math.round((downloaded / total) * 100);
  const isComplete = status?.isComplete === true;

  return (
    <section role="region" aria-label="تجهيز التفسير الميسر دون إنترنت" className={compact ? "rounded-xl border border-[#1C4E46]/15 bg-[#F8F5EC] px-3 py-2 text-right dark:border-[#E0A96D]/20 dark:bg-[#101D35]" : "rounded-2xl border border-[#C59B27]/30 bg-[#F8F5EC] p-4 text-right dark:border-[#E0A96D]/25 dark:bg-[#101D35]"} dir="rtl">
      {!compact && <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-xl bg-[#1C4E46]/10 p-2 text-[#1C4E46] dark:bg-[#E0A96D]/10 dark:text-[#E0A96D]">
          <span aria-hidden="true" className="text-lg">📖</span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-[#142421] dark:text-[#F5F1E8]">التفسير الميسر — للاستخدام دون إنترنت</h3>
          <p className="mt-1 text-xs leading-6 text-[#5B6F6B] dark:text-[#AAB8B4]">
            نزّل التفسير كاملًا مرة واحدة. يُحفظ على هذا الجهاز فقط، ويمكن استكمال التنزيل إذا انقطع الاتصال.
          </p>
        </div>
      </div>}

      <div className={compact ? "flex flex-wrap items-center justify-between gap-2 text-[10px]" : "mt-4 flex flex-wrap items-center justify-between gap-2 text-xs"}>
        <span className="font-bold text-[#1C4E46] dark:text-[#E0A96D]">{downloaded} / {total} سورة</span>
        <span className="text-[#5B6F6B] dark:text-[#AAB8B4]">الإصدار V{OFFLINE_TAFSIR_SOURCE.version} · {OFFLINE_TAFSIR_SOURCE.releaseDate}</span>
      </div>
      {!compact && <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#E3DDCE] dark:bg-[#25334B]" role="progressbar" aria-label="تقدم تنزيل التفسير" aria-valuemin={0} aria-valuemax={total} aria-valuenow={downloaded}>
        <div className="h-full rounded-full bg-[#1C4E46] transition-all dark:bg-[#E0A96D]" style={{ width: `${percent}%` }} />
      </div>}
      {!compact && isDownloading && progress?.currentSurah && (
        <p className="mt-2 text-[11px] text-[#5B6F6B] dark:text-[#AAB8B4]" aria-live="polite">
          جارٍ تنزيل سورة {progress.currentSurah}…
        </p>
      )}
      {isComplete ? (
        <div className={compact ? "mt-2 flex flex-wrap items-center justify-between gap-2" : "mt-3 space-y-2"}>
          <p className={compact ? "text-[10px] font-bold text-emerald-800 dark:text-emerald-300" : "rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"} role="status">
            {compact ? "التفسير محفوظ محليًا دون اتصال." : "اكتمل تنزيل التفسير الميسر. أصبح متاحًا محليًا دون اتصال."}
          </p>
          <button type="button" onClick={startDownload} disabled={isDownloading} className="min-h-11 rounded-xl border border-[#1C4E46]/20 px-4 py-2 text-xs font-bold text-[#1C4E46] disabled:opacity-60 dark:border-[#E0A96D]/30 dark:text-[#E0A96D]">
            {isDownloading ? 'جارٍ التحقق من إصدار المصدر...' : 'التحقق من تحديث المصدر'}
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {isDownloading ? (
            <button type="button" onClick={() => controllerRef.current?.abort()} className="min-h-11 rounded-xl border border-[#1C4E46]/20 px-4 py-2 text-xs font-bold text-[#1C4E46] dark:border-[#E0A96D]/30 dark:text-[#E0A96D]">
              إيقاف مؤقت
            </button>
          ) : (
            <button type="button" onClick={startDownload} className="min-h-11 rounded-xl bg-[#1C4E46] px-4 py-2 text-xs font-bold text-white hover:bg-[#28665B] dark:bg-[#1E4A47]">
              {downloaded > 0 ? 'استكمال التنزيل' : 'تنزيل التفسير الميسر كاملًا'}
            </button>
          )}
        </div>
      )}
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs leading-5 text-red-800 dark:bg-red-950/30 dark:text-red-300" role="alert">{error}</p>}

      {!compact && <p className="mt-4 border-t border-[#1C4E46]/10 pt-3 text-[10px] leading-5 text-[#5B6F6B] dark:border-[#E0A96D]/15 dark:text-[#AAB8B4]">
        الناشر: {OFFLINE_TAFSIR_SOURCE.publisher}. المصدر الرقمي: QuranEnc.com. يُحفظ المحتوى كما ورد من المصدر مع الحواشي وبيانات الإصدار.
        {' '}<a href="https://quranenc.com/ar/browse/arabic_moyassar/" target="_blank" rel="noreferrer" className="font-bold underline">المصدر الرسمي وشروط إعادة النشر</a>.
      </p>}
    </section>
  );
};
