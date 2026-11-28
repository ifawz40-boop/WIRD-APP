import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, Loader2, Pause, Play } from 'lucide-react';
import type { ReciterId } from '../../types/quran';
import { computeGlobalAyahNumber, resolveApprovedOfflineReciterId } from '../../services/audioService';
import {
  offlineQuranAudioLibrary,
  type OfflineAudioJob,
  type OfflineAudioJobScopeKind,
} from '../../services/offlineQuranAudioLibrary';
import type { MemorizedAyahRange } from '../../services/memorizedRangeService';
import { requestOfflineStoragePersistence } from '../../services/offlineStorageService';

interface InlineAudioOfflineBadgeButtonProps {
  reciter: ReciterId;
  scopeKind: OfflineAudioJobScopeKind;
  labelAr: string;
  ranges: MemorizedAyahRange[];
  compact?: boolean;
}

export const InlineAudioOfflineBadgeButton: React.FC<InlineAudioOfflineBadgeButtonProps> = ({
  reciter,
  scopeKind,
  labelAr,
  ranges,
  compact = false,
}) => {
  const approvedId = resolveApprovedOfflineReciterId(reciter);
  const [availableSet, setAvailableSet] = useState<Set<number>>(() => new Set());
  const [matchingJob, setMatchingJob] = useState<OfflineAudioJob | null>(null);
  const [busy, setBusy] = useState(false);

  const globalAyahIds = useMemo(() => {
    const ids: number[] = [];
    for (const r of ranges) {
      for (let a = r.startAyah; a <= r.endAyah; a++) {
        try {
          ids.push(computeGlobalAyahNumber(r.surahNumber, a));
        } catch {
          // skip invalid
        }
      }
    }
    return ids;
  }, [ranges]);

  const firstGlobal = globalAyahIds[0] ?? 0;
  const lastGlobal = globalAyahIds[globalAyahIds.length - 1] ?? 0;

  useEffect(() => {
    let active = true;
    if (!approvedId || globalAyahIds.length === 0) {
      setAvailableSet(new Set());
      setMatchingJob(null);
      return () => {
        active = false;
      };
    }

    const syncState = async () => {
      try {
        const [avail, jobs] = await Promise.all([
          offlineQuranAudioLibrary.getAvailableGlobalAyahsForReciter(approvedId),
          offlineQuranAudioLibrary.listJobs(),
        ]);
        if (!active) return;
        setAvailableSet(avail);
        const fingerprint = `${scopeKind}:${approvedId}:${globalAyahIds.length}:${firstGlobal}:${lastGlobal}`;
        const found =
          jobs.find(
            (j) =>
              j.requestFingerprint === fingerprint &&
              j.status !== 'cancelled' &&
              j.status !== 'completed'
          ) || null;
        setMatchingJob(found);
      } catch {
        // ignore in restricted environments
      }
    };

    void syncState();
    const unsub = offlineQuranAudioLibrary.subscribe(() => {
      void syncState();
    });
    return () => {
      active = false;
      unsub();
    };
  }, [approvedId, scopeKind, globalAyahIds.length, firstGlobal, lastGlobal]);

  if (!approvedId || globalAyahIds.length === 0) {
    return null;
  }

  const cachedCount = globalAyahIds.reduce(
    (acc, id) => (availableSet.has(id) ? acc + 1 : acc),
    0
  );
  const isComplete = cachedCount === globalAyahIds.length;
  const isDownloading = matchingJob?.status === 'downloading';
  const isPausedOrPartial =
    matchingJob &&
    (matchingJob.status === 'paused' ||
      matchingJob.status === 'partial' ||
      matchingJob.status === 'failed' ||
      matchingJob.status === 'queued');

  const handleAction = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy || isComplete) return;
    setBusy(true);
    try {
      if (isDownloading && matchingJob) {
        await offlineQuranAudioLibrary.pauseJob(matchingJob.jobId);
      } else if (isPausedOrPartial && matchingJob) {
        await offlineQuranAudioLibrary.startOrResumeJob(matchingJob.jobId);
      } else {
        await requestOfflineStoragePersistence().catch(() => null);
        await offlineQuranAudioLibrary.enqueueDownloadJob({
          scopeKind,
          labelAr,
          reciterId: approvedId,
          ranges,
          autoStart: true,
        });
      }
    } catch {
      // Errors surfaced via Settings manager if quota exceeded
    } finally {
      setBusy(false);
    }
  };

  const pct = Math.round((cachedCount / Math.max(1, globalAyahIds.length)) * 100);

  if (isComplete) {
    return (
      <span
        title={`${labelAr} محفوظة بالكامل للاستماع بدون إنترنت`}
        className={`inline-flex items-center gap-1 rounded-lg border border-[var(--wird-border-gold)] bg-[var(--wird-accent-soft)] text-[var(--wird-primary)] dark:text-[var(--wird-accent)] font-bold ${
          compact ? 'px-2 py-1 text-[10px]' : 'min-h-9 px-2.5 py-1 text-[11px]'
        }`}
      >
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>{compact ? 'أوفلاين' : 'التلاوة محفوظة أوفلاين'}</span>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => void handleAction(e)}
      disabled={busy}
      title={
        isDownloading
          ? `جارٍ تنزيل ${labelAr} (${pct}%) — اضغط للإيقاف المؤقت`
          : isPausedOrPartial
            ? `استكمال تنزيل ${labelAr} (${pct}%)`
            : `تنزيل تلاوة ${labelAr} للاستماع بدون إنترنت`
      }
      className={`inline-flex items-center gap-1.5 rounded-lg border transition-colors font-bold whitespace-nowrap ${
        compact ? 'min-h-9 px-2.5 py-1 text-[11px]' : 'min-h-10 px-3 py-1.5 text-xs'
      } ${
        isDownloading
          ? 'border-[var(--wird-accent)] bg-[var(--wird-primary)] text-[var(--wird-primary-ink)]'
          : 'border-[var(--wird-border-strong)] bg-[var(--wird-surface)] text-[var(--wird-text)] hover:border-[var(--wird-accent)]'
      }`}
    >
      {isDownloading ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
          <span className="tabular-nums">{pct}%</span>
          <Pause className="w-3 h-3 opacity-80 shrink-0" />
        </>
      ) : isPausedOrPartial ? (
        <>
          <Play className="w-3.5 h-3.5 text-[var(--wird-accent)] shrink-0" />
          <span className="tabular-nums">استكمال ({pct}%)</span>
        </>
      ) : (
        <>
          <Download className="w-3.5 h-3.5 text-[var(--wird-primary)] dark:text-[var(--wird-accent)] shrink-0" />
          <span>{compact ? 'تنزيل' : 'تنزيل أوفلاين'}</span>
        </>
      )}
    </button>
  );
};
