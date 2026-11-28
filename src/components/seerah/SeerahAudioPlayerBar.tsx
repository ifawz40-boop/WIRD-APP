import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Loader2,
  Moon,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Square,
  Volume2,
} from 'lucide-react';
import {
  SeerahAudioNarratorController,
  type SeerahAudioSegment,
  type SeerahNarratorState,
  type SeerahNarratorVoicePreset,
  type SeerahSleepTimerOption,
} from '../../services/seerahAudioNarratorService';

interface SeerahAudioPlayerBarProps {
  docKey: string;
  titleAr: string;
  segments: SeerahAudioSegment[];
  onActiveSegmentChange?: (segment: SeerahAudioSegment | null) => void;
  exposeJumpToSceneRef?: React.MutableRefObject<((sceneId: string) => void) | null>;
}

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;

function formatSleepCountdown(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const SeerahAudioPlayerBar: React.FC<SeerahAudioPlayerBarProps> = ({
  docKey,
  titleAr,
  segments,
  onActiveSegmentChange,
  exposeJumpToSceneRef,
}) => {
  const controllerRef = useRef<SeerahAudioNarratorController | null>(null);
  const downloadAbortRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<SeerahNarratorState | null>(null);
  const [downloadProgressLabel, setDownloadProgressLabel] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new SeerahAudioNarratorController(segments, titleAr);
    controllerRef.current = ctrl;
    const unsub = ctrl.subscribe((nextState) => {
      setState(nextState);
      if (nextState.status === 'playing' || nextState.status === 'loading' || nextState.status === 'paused') {
        onActiveSegmentChange?.(nextState.activeSegment);
      } else {
        onActiveSegmentChange?.(null);
      }
    });

    if (exposeJumpToSceneRef) {
      exposeJumpToSceneRef.current = (sceneId: string) => {
        const idx = segments.findIndex((s) => s.sceneId === sceneId);
        if (idx >= 0) {
          ctrl.playFrom(idx);
        }
      };
    }

    return () => {
      downloadAbortRef.current?.abort();
      if (exposeJumpToSceneRef) exposeJumpToSceneRef.current = null;
      unsub();
      ctrl.destroy();
      controllerRef.current = null;
      onActiveSegmentChange?.(null);
    };
  }, [docKey, titleAr, segments]);

  if (!state || segments.length === 0) return null;

  const isActive = state.status === 'playing' || state.status === 'loading' || state.status === 'paused';
  const progressPercent = Math.round(((state.activeIndex + (state.status === 'idle' ? 0 : 1)) / Math.max(1, state.totalSegments)) * 100);
  const spokenSegmentsCount = segments.filter((s) => s.kind !== 'quran_ayahs' && s.spokenText).length;
  const isFullyCachedOffline = spokenSegmentsCount > 0 && state.offlineCachedCount >= spokenSegmentsCount;

  const engineBadge =
    state.activeSegment?.kind === 'quran_ayahs' && isActive
      ? 'تلاوة قرآنية بصوت القارئ'
      : state.engineSource === 'offline-cache' && isActive
        ? 'صوت عصبي محفوظ أوفلاين'
        : state.engineSource === 'cloud-neural' && isActive
          ? 'راوٍ صوتي عصبي (Gemini TTS)'
          : 'الراوي الصوتي العربي';

  const handleOfflineDownload = async () => {
    const ctrl = controllerRef.current;
    if (!ctrl) return;
    if (state.isDownloadingOffline) {
      downloadAbortRef.current?.abort();
      return;
    }
    const abort = new AbortController();
    downloadAbortRef.current = abort;
    setDownloadProgressLabel(`0/${spokenSegmentsCount}`);
    try {
      await ctrl.downloadChapterForOffline((done, total) => {
        setDownloadProgressLabel(`${done}/${total}`);
      }, abort.signal);
    } finally {
      setDownloadProgressLabel(null);
    }
  };

  return (
    <section
      aria-label="الراوي الصوتي لفصل السيرة"
      className="wird-card rounded-2xl px-4 py-3.5 sm:px-5 border border-[var(--wird-border-gold)]/50 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Primary Transport Controls */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => controllerRef.current?.togglePlayPause()}
            aria-label={state.status === 'playing' ? 'إيقاف الاستماع مؤقتاً' : 'الاستماع الصوتي لهذا الفصل'}
            className="min-h-11 px-4 py-2 rounded-xl bg-[var(--wird-primary)] hover:bg-[var(--wird-primary-hover)] text-[var(--wird-primary-ink)] text-xs font-bold inline-flex items-center gap-2 shadow-xs transition-colors shrink-0"
          >
            {state.status === 'loading' ? (
              <Loader2 className="w-4 h-4 animate-spin text-[var(--wird-accent)]" />
            ) : state.status === 'playing' ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            <span>
              {state.status === 'playing'
                ? 'إيقاف مؤقت'
                : state.status === 'paused'
                  ? 'متابعة الاستماع'
                  : 'استمع للفصل صوتياً'}
            </span>
          </button>

          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => controllerRef.current?.prev()}
              disabled={state.activeIndex <= 0 && !isActive}
              aria-label="الفقرة الصوتية السابقة"
              className="min-h-10 min-w-10 rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] text-[var(--wird-text)] inline-flex items-center justify-center disabled:opacity-40"
            >
              <SkipForward className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => controllerRef.current?.next()}
              disabled={state.activeIndex >= state.totalSegments - 1}
              aria-label="الفقرة الصوتية التالية"
              className="min-h-10 min-w-10 rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] text-[var(--wird-text)] inline-flex items-center justify-center disabled:opacity-40"
            >
              <SkipBack className="w-4 h-4" />
            </button>
            {isActive && (
              <button
                type="button"
                onClick={() => controllerRef.current?.stop()}
                aria-label="إنهاء القراءة الصوتية"
                className="min-h-10 min-w-10 rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] text-rose-700 dark:text-rose-300 inline-flex items-center justify-center"
              >
                <Square className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Voice, Speed, Sleep Timer & Offline Chapter Download */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="inline-flex items-center gap-1.5 bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] rounded-xl px-2.5 min-h-10">
            <Volume2 className="w-3.5 h-3.5 text-[var(--wird-accent)] shrink-0" />
            <select
              aria-label="اختيار صوت الراوي"
              value={state.voicePreset}
              onChange={(e) => controllerRef.current?.setVoicePreset(e.target.value as SeerahNarratorVoicePreset)}
              className="bg-transparent text-[11px] font-bold text-[var(--wird-text)] focus:outline-none"
            >
              <option value="Charon">راوٍ وقور (تتخلله تلاوة القارئ)</option>
              <option value="Kore">راوٍ هادئ وواضح</option>
              <option value="local-neural">الصوت العربي المحلي (أوفلاين فوري)</option>
            </select>
          </label>

          <select
            aria-label="سرعة الراوي الصوتي"
            value={state.playbackRate}
            onChange={(e) => controllerRef.current?.setPlaybackRate(Number(e.target.value))}
            className="min-h-10 px-2.5 rounded-xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] text-[11px] font-bold font-mono text-[var(--wird-text)]"
          >
            {SPEED_OPTIONS.map((spd) => (
              <option key={spd} value={spd}>
                {spd}x
              </option>
            ))}
          </select>

          <label className="inline-flex items-center gap-1 bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] rounded-xl px-2.5 min-h-10">
            <Moon className="w-3.5 h-3.5 text-[var(--wird-muted)] shrink-0" />
            <select
              aria-label="مؤقت إيقاف الاستماع"
              value={state.sleepTimer === null ? '' : String(state.sleepTimer)}
              onChange={(e) => {
                const val = e.target.value;
                const parsed: SeerahSleepTimerOption =
                  val === ''
                    ? null
                    : val === 'end_of_chapter'
                      ? 'end_of_chapter'
                      : (Number(val) as 15 | 30 | 45);
                controllerRef.current?.setSleepTimer(parsed);
              }}
              className="bg-transparent text-[11px] font-semibold text-[var(--wird-text)] focus:outline-none"
            >
              <option value="">مؤقت النوم: إيقاف</option>
              <option value="15">بعد 15 دقيقة</option>
              <option value="30">بعد 30 دقيقة</option>
              <option value="45">بعد 45 دقيقة</option>
              <option value="end_of_chapter">عند نهاية الفصل</option>
            </select>
          </label>

          {state.cloudTtsAvailable && state.voicePreset !== 'local-neural' && (
            <button
              type="button"
              onClick={() => void handleOfflineDownload()}
              className="min-h-10 px-3 rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] text-[11px] font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] inline-flex items-center gap-1.5"
            >
              {isFullyCachedOffline ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>محفوظ صوتياً أوفلاين</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>
                    {state.isDownloadingOffline
                      ? `جارٍ حفظ الصوت (${downloadProgressLabel || '...'})`
                      : 'حفظ الفصل صوتياً أوفلاين'}
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Live Segment Status & Progress Strip */}
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="px-2 py-0.5 rounded-md bg-[var(--wird-accent-soft)] text-[var(--wird-primary)] dark:text-[var(--wird-accent)] font-bold shrink-0">
              {engineBadge}
            </span>
            <span className="text-[var(--wird-muted)] truncate">
              {isActive && state.activeSegment
                ? state.activeSegment.labelAr
                : 'يقرأ السرد العربي الفصيح ويتلو الآيات القرآنية بصوت قارئك المعتمد تلقائياً'}
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono tabular-nums text-[var(--wird-muted)] shrink-0">
            {state.sleepRemainingSeconds !== null && (
              <span className="text-[var(--wird-accent)] font-bold">
                نوم بعد {formatSleepCountdown(state.sleepRemainingSeconds)}
              </span>
            )}
            <span>
              {state.activeIndex + 1} / {state.totalSegments}
            </span>
          </div>
        </div>

        <div className="h-1.5 rounded-full bg-[var(--wird-surface-muted)] overflow-hidden">
          <div
            className="h-full bg-[var(--wird-primary)] dark:bg-[var(--wird-accent)] transition-all duration-300"
            style={{ width: `${isActive ? progressPercent : 0}%` }}
          />
        </div>

        {state.errorMessage && (
          <p role="alert" className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">
            {state.errorMessage}
          </p>
        )}
      </div>
    </section>
  );
};
