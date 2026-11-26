import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  Headphones,
  ListMusic,
  Loader2,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  RotateCw,
  ShieldCheck,
  SkipBack,
  SkipForward,
  Square,
  Timer,
  Volume2,
  VolumeX
} from 'lucide-react';
import { AUDIO_RUQYAH_SESSIONS, RUQYAH_ITEMS } from '../../data/ruqyahData';
import type { RuqyahAudioSession } from '../../data/ruqyahData';
import type { QuranReciter } from '../../services/ruqyahAudioService';
import { estimateRuqyahSessionStats, parseRuqyahVerseRange } from '../../services/ruqyahContentService';
import { ALL_SURAHS } from '../../data/quranMeta';
import { QuranText } from '../shared/QuranText';

export interface ActiveSessionPlaybackInfo {
  sessionId: string | null;
  isPlaying: boolean;
  isLoading: boolean;
  isOfflinePlayback?: boolean;
  currentTitle: string;
  currentSurahName: string;
  currentSurahNumber: number;
  currentAyahNumber: number;
  currentAyahText: string;
  currentPassageIndex: number;
  queuePosition: number;
  queueLength: number;
  currentTime: number;
  duration: number;
  error: string;
  statusMessage: string;
}

export interface SessionOfflineDownloadState {
  isDownloading: boolean;
  completedItems: number;
  totalItems: number;
  error?: string;
}

interface AudioRuqyahStudioProps {
  reciters: QuranReciter[];
  selectedReciterId: string;
  onReciterChange: (reciterId: string) => void;
  playbackRate: number;
  onPlaybackRateChange: (rate: number) => void;
  audioVolume: number;
  onAudioVolumeChange: (volume: number) => void;
  loopEnabled: boolean;
  onToggleLoop: () => void;
  sleepTimerMinutes: number | null;
  sleepTimerRemainingSec: number | null;
  onSelectSleepTimer: (minutes: number | null) => void;
  playback: ActiveSessionPlaybackInfo;
  availableOfflineAyahs: ReadonlySet<number>;
  sessionDownloads: Record<string, SessionOfflineDownloadState | undefined>;
  onDownloadSessionOffline: (session: RuqyahAudioSession) => void;
  onPlaySession: (session: RuqyahAudioSession, startPassageIndex?: number) => void;
  onTogglePlayPause: () => void;
  onStop: () => void;
  onPrevPassage: () => void;
  onNextPassage: () => void;
  onSeek: (nextSeconds: number) => void;
  onSeekDelta: (deltaSeconds: number) => void;
}

const SLEEP_TIMER_OPTIONS: Array<{ value: number | null; label: string }> = [
  { value: null, label: 'إيقاف' },
  { value: 15, label: '15 د' },
  { value: 30, label: '30 د' },
  { value: 45, label: '45 د' },
  { value: 60, label: '60 د' }
];

const PLAYBACK_SPEEDS = [0.75, 1, 1.25] as const;

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getSessionUniqueGlobalAyahs(session: RuqyahAudioSession): number[] {
  const byId = new Map(RUQYAH_ITEMS.map(item => [item.id, item]));
  const globals = new Set<number>();
  for (const track of session.tracks) {
    const item = byId.get(track.itemId);
    if (!item || item.type !== 'quran' || !item.surahNumber || !item.verseRange) continue;
    try {
      const range = parseRuqyahVerseRange(item.verseRange);
      const preceding = ALL_SURAHS.slice(0, item.surahNumber - 1).reduce((s, x) => s + x.versesCount, 0);
      for (let a = range.start; a <= range.end; a++) {
        globals.add(preceding + a);
      }
    } catch {
      // ignore invalid coordinate
    }
  }
  return [...globals];
}

export const AudioRuqyahStudio: React.FC<AudioRuqyahStudioProps> = ({
  reciters,
  selectedReciterId,
  onReciterChange,
  playbackRate,
  onPlaybackRateChange,
  audioVolume,
  onAudioVolumeChange,
  loopEnabled,
  onToggleLoop,
  sleepTimerMinutes,
  sleepTimerRemainingSec,
  onSelectSleepTimer,
  playback,
  availableOfflineAyahs,
  sessionDownloads,
  onDownloadSessionOffline,
  onPlaySession,
  onTogglePlayPause,
  onStop,
  onPrevPassage,
  onNextPassage,
  onSeek,
  onSeekDelta
}) => {
  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    playback.sessionId || AUDIO_RUQYAH_SESSIONS[0].id
  );
  const [showTracklist, setShowTracklist] = useState<boolean>(true);
  const [previousVolume, setPreviousVolume] = useState<number>(0.85);

  const activeSession = useMemo(
    () => AUDIO_RUQYAH_SESSIONS.find(s => s.id === (playback.sessionId || selectedSessionId)) || AUDIO_RUQYAH_SESSIONS[0],
    [playback.sessionId, selectedSessionId]
  );

  const itemsById = useMemo(
    () => new Map(RUQYAH_ITEMS.map(item => [item.id, item])),
    []
  );

  const sessionOfflineMap = useMemo(() => {
    const result = new Map<string, { cached: number; total: number; isReady: boolean }>();
    for (const session of AUDIO_RUQYAH_SESSIONS) {
      const ayahs = getSessionUniqueGlobalAyahs(session);
      const cached = ayahs.filter(g => availableOfflineAyahs.has(g)).length;
      result.set(session.id, {
        cached,
        total: ayahs.length,
        isReady: ayahs.length > 0 && cached === ayahs.length
      });
    }
    return result;
  }, [availableOfflineAyahs]);

  const activeStats = useMemo(() => estimateRuqyahSessionStats(activeSession, RUQYAH_ITEMS), [activeSession]);
  const activeOffline = sessionOfflineMap.get(activeSession.id) ?? { cached: 0, total: 0, isReady: false };
  const activeDownloadJob = sessionDownloads[activeSession.id];
  const isThisSessionLoaded = playback.sessionId === activeSession.id && playback.queueLength > 0;
  const progressPercent = isThisSessionLoaded
    ? Math.round((playback.queuePosition / Math.max(1, playback.queueLength)) * 100)
    : 0;

  const handleToggleMute = () => {
    if (audioVolume > 0) {
      setPreviousVolume(audioVolume);
      onAudioVolumeChange(0);
    } else {
      onAudioVolumeChange(previousVolume > 0 ? previousVolume : 0.85);
    }
  };

  return (
    <section aria-label="استوديو الرقية الشرعية المسموعة" className="space-y-6">
      {/* 1. Timed Audio Ruqyah Sessions Grid (5 Durations: 3m, 6m, 12m, 20m, 30m) */}
      <div className="space-y-3.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold font-editorial-ar text-[var(--wird-text)]">
              جلسات الرقية الصوتية الموثقة
            </h2>
            <p className="text-xs text-[var(--wird-muted)] mt-0.5">
              تلاوات قرآنية نقية تدعم التشغيل في الخلفية والمتابعة التلقائية والتنزيل للاستماع الكامل بدون إنترنت.
            </p>
          </div>
          <span className="text-xs font-semibold tabular-nums text-[var(--wird-muted)]">
            <span className="font-mono">{AUDIO_RUQYAH_SESSIONS.length}</span> جلسات صوتية
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {AUDIO_RUQYAH_SESSIONS.map(session => {
            const stats = estimateRuqyahSessionStats(session, RUQYAH_ITEMS);
            const isSelected = activeSession.id === session.id;
            const isPlayingThis = playback.sessionId === session.id && playback.isPlaying;
            const offlineInfo = sessionOfflineMap.get(session.id) ?? { cached: 0, total: 0, isReady: false };
            const dlState = sessionDownloads[session.id];

            return (
              <div
                key={session.id}
                className={`wird-card rounded-2xl p-5 flex flex-col justify-between gap-4 border transition-all duration-150 ${
                  isSelected
                    ? 'border-[var(--wird-border-gold)] bg-[var(--wird-accent-soft)]/40'
                    : 'border-[var(--wird-border)] hover:border-[var(--wird-border-strong)]'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                        isPlayingThis
                          ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] border-transparent'
                          : 'bg-[var(--wird-surface-muted)] text-[var(--wird-primary)] dark:text-[var(--wird-accent)] border-[var(--wird-border)]'
                      }`}
                    >
                      <Headphones className="w-5 h-5" />
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span className="inline-flex items-center gap-1 text-xs font-bold tabular-nums text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{session.durationBadge}</span>
                      </span>
                      {offlineInfo.isReady && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>متاحة بدون إنترنت</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-base font-bold font-editorial-ar text-[var(--wird-text)] leading-snug">
                      {session.title}
                    </h3>
                    <p className="text-[11px] font-semibold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
                      {session.focusLabel} · <span className="font-mono tabular-nums">{stats.passageCount}</span> مقاطع · <span className="font-mono tabular-nums">{stats.totalAyahCount}</span> آية
                    </p>
                    <p className="text-xs text-[var(--wird-muted)] leading-relaxed">
                      {session.description}
                    </p>
                  </div>

                  {dlState?.isDownloading && (
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
                        <span>جارٍ تنزيل الصوتيات…</span>
                        <span>
                          {dlState.completedItems}/{dlState.totalItems}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--wird-surface-muted)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[var(--wird-primary)] dark:bg-[var(--wird-accent)] transition-all"
                          style={{
                            width: `${dlState.totalItems > 0 ? Math.round((dlState.completedItems / dlState.totalItems) * 100) : 0}%`
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-[var(--wird-border)]">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSessionId(session.id);
                      if (isPlayingThis) {
                        onTogglePlayPause();
                      } else {
                        onPlaySession(session, 0);
                      }
                    }}
                    className={`flex-1 min-h-11 px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-ring)] ${
                      isPlayingThis
                        ? 'bg-[var(--wird-accent)] text-[var(--wird-accent-ink)]'
                        : 'bg-[var(--wird-primary)] hover:bg-[var(--wird-primary-hover)] text-[var(--wird-primary-ink)]'
                    }`}
                  >
                    {isPlayingThis ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    <span>{isPlayingThis ? 'إيقاف مؤقت' : 'استمع الآن'}</span>
                  </button>

                  {!offlineInfo.isReady ? (
                    <button
                      type="button"
                      onClick={() => onDownloadSessionOffline(session)}
                      disabled={Boolean(dlState?.isDownloading)}
                      aria-label={`تنزيل ${session.title} للاستماع بدون إنترنت`}
                      title="تنزيل الجلسة للاستماع بدون إنترنت"
                      className="min-h-11 px-3 py-2 rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] hover:border-[var(--wird-border-gold)] text-xs font-bold text-[var(--wird-text)] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap disabled:opacity-50"
                    >
                      {dlState?.isDownloading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
                      )}
                      <span>تنزيل</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSelectedSessionId(session.id)}
                      aria-pressed={isSelected}
                      className="min-h-11 px-3 py-2 rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] hover:border-[var(--wird-border-gold)] text-xs font-bold text-[var(--wird-text)] transition-colors whitespace-nowrap"
                    >
                      التفاصيل
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Active Listening Studio Deck */}
      <div className="wird-card rounded-2xl p-5 md:p-6 space-y-5">
        {/* Studio Header & Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[var(--wird-border)]">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
              <span>مشغّل الرقية المسموعة</span>
              <span aria-hidden="true">·</span>
              <span>{activeSession.durationBadge}</span>
              <span aria-hidden="true">·</span>
              <span><span className="font-mono tabular-nums">{activeStats.totalAyahCount}</span> آية متتالية</span>
              {activeOffline.isReady && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-700 dark:text-emerald-400">محفوظة دون إنترنت</span>
                </>
              )}
            </div>
            <h3 className="text-xl font-bold font-editorial-ar text-[var(--wird-text)]">
              {activeSession.title}
            </h3>
            <p className="text-xs text-[var(--wird-muted)]">
              {activeSession.subtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-2.5">
            <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--wird-text)] min-w-44">
              <span>القارئ</span>
              <select
                aria-label="اختيار قارئ الرقية المسموعة"
                value={selectedReciterId}
                onChange={e => onReciterChange(e.target.value)}
                className="min-h-11 rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] px-3 py-2 text-xs font-bold text-[var(--wird-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-ring)]"
              >
                {reciters.map(reciter => (
                  <option key={reciter.id} value={reciter.id}>
                    {reciter.arabicName}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-[var(--wird-text)]">السرعة</span>
              <div
                role="group"
                aria-label="سرعة تلاوة الرقية المسموعة"
                className="inline-flex items-center p-1 rounded-xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)]"
              >
                {PLAYBACK_SPEEDS.map(rate => (
                  <button
                    key={rate}
                    type="button"
                    aria-pressed={playbackRate === rate}
                    onClick={() => onPlaybackRateChange(rate)}
                    className={`min-h-9 px-2.5 rounded-lg text-xs font-mono font-bold tabular-nums transition-colors ${
                      playbackRate === rate
                        ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)]'
                        : 'text-[var(--wird-muted)] hover:text-[var(--wird-text)]'
                    }`}
                  >
                    {rate}×
                  </button>
                ))}
              </div>
            </div>

            {!activeOffline.isReady && (
              <button
                type="button"
                onClick={() => onDownloadSessionOffline(activeSession)}
                disabled={Boolean(activeDownloadJob?.isDownloading)}
                className="min-h-11 px-3.5 py-2 rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] hover:border-[var(--wird-border-gold)] text-xs font-bold text-[var(--wird-text)] inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {activeDownloadJob?.isDownloading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>
                      جارٍ الحفظ ({activeDownloadJob.completedItems}/{activeDownloadJob.totalItems})
                    </span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
                    <span>حفظ للاستماع بدون إنترنت ({activeOffline.cached}/{activeOffline.total})</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Live Synced Quran Ayah Display */}
        <div className="rounded-2xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] p-5 md:p-6 text-center space-y-3">
          {isThisSessionLoaded && playback.currentAyahText ? (
            <>
              <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
                <span>{playback.currentTitle}</span>
                {playback.currentSurahName && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      سورة {playback.currentSurahName} — آية <span className="font-mono tabular-nums">{playback.currentAyahNumber}</span>
                    </span>
                  </>
                )}
                {playback.isOfflinePlayback && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-emerald-700 dark:text-emerald-400">تشغيل محلي بدون إنترنت</span>
                  </>
                )}
              </div>
              <p className="font-quran text-xl md:text-2xl leading-[2.35] text-[var(--wird-text)]">
                <QuranText surahNumber={playback.currentSurahNumber} ayahNumber={playback.currentAyahNumber}>
                  {playback.currentAyahText}
                </QuranText>
                <span className="ayah-number">{playback.currentAyahNumber}</span>
              </p>
            </>
          ) : (
            <div className="py-3 space-y-2">
              <Headphones className="w-7 h-7 text-[var(--wird-accent)] mx-auto" />
              <p className="text-sm font-bold text-[var(--wird-text)]">
                جاهزة للاستماع الهادئ — اضغط «تشغيل الجلسة الصوتية» للبدء
              </p>
              <p className="text-xs text-[var(--wird-muted)] max-w-lg mx-auto leading-relaxed">
                تعمل الجلسة في الخلفية وعلى شاشة القفل، وتعرض الآية المتلوّة لحظة بلحظة من مصحف وِرد المعتمد.
              </p>
            </div>
          )}
        </div>

        {/* Transport & Progress Controls */}
        <div className="space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onPrevPassage}
                disabled={!isThisSessionLoaded || playback.currentPassageIndex <= 0}
                aria-label="المقطع السابق"
                title="المقطع السابق"
                className="min-h-11 min-w-11 px-3 rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] text-[var(--wird-text)] hover:border-[var(--wird-border-strong)] disabled:opacity-40 flex items-center justify-center transition-colors"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => onSeekDelta(-10)}
                disabled={!isThisSessionLoaded || !playback.duration}
                aria-label="إرجاع 10 ثوانٍ"
                title="إرجاع 10 ثوانٍ"
                className="min-h-11 px-3 rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] text-xs font-mono font-bold text-[var(--wird-text)] hover:border-[var(--wird-border-strong)] disabled:opacity-40 inline-flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>10ث</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (isThisSessionLoaded) {
                    onTogglePlayPause();
                  } else {
                    onPlaySession(activeSession, 0);
                  }
                }}
                disabled={playback.isLoading}
                className="min-h-11 px-5 py-2.5 rounded-xl bg-[var(--wird-primary)] hover:bg-[var(--wird-primary-hover)] text-[var(--wird-primary-ink)] text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-ring)]"
              >
                {isThisSessionLoaded && playback.isPlaying ? (
                  <>
                    <Pause className="w-4 h-4" />
                    <span>إيقاف مؤقت</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>{isThisSessionLoaded ? 'استكمال الجلسة' : 'تشغيل الجلسة الصوتية'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => onSeekDelta(10)}
                disabled={!isThisSessionLoaded || !playback.duration}
                aria-label="تقديم 10 ثوانٍ"
                title="تقديم 10 ثوانٍ"
                className="min-h-11 px-3 rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] text-xs font-mono font-bold text-[var(--wird-text)] hover:border-[var(--wird-border-strong)] disabled:opacity-40 inline-flex items-center gap-1 transition-colors"
              >
                <span>10ث</span>
                <RotateCw className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={onNextPassage}
                disabled={!isThisSessionLoaded || playback.currentPassageIndex >= activeSession.tracks.length - 1}
                aria-label="المقطع التالي"
                title="المقطع التالي"
                className="min-h-11 min-w-11 px-3 rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] text-[var(--wird-text)] hover:border-[var(--wird-border-strong)] disabled:opacity-40 flex items-center justify-center transition-colors"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              {isThisSessionLoaded && (
                <button
                  type="button"
                  onClick={onStop}
                  className="min-h-11 px-3.5 rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] text-xs font-bold text-[var(--wird-text)] hover:border-[var(--wird-border-strong)] flex items-center gap-1.5 transition-colors"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>إيقاف</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                aria-pressed={loopEnabled}
                onClick={onToggleLoop}
                className={`min-h-11 px-3.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors ${
                  loopEnabled
                    ? 'bg-[var(--wird-accent-soft)] border-[var(--wird-border-gold)] text-[var(--wird-text)]'
                    : 'bg-[var(--wird-surface-muted)] border-[var(--wird-border)] text-[var(--wird-muted)]'
                }`}
              >
                <Repeat className="w-3.5 h-3.5 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
                <span>{loopEnabled ? 'التكرار المستمر: مفعل' : 'تكرار الجلسة'}</span>
              </button>
            </div>
          </div>

          {/* Sleep Timer Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] px-3.5 py-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--wird-text)]">
              <Timer className="w-4 h-4 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
              <span>مؤقّت النوم:</span>
              {sleepTimerRemainingSec !== null && sleepTimerRemainingSec > 0 && (
                <span className="font-mono tabular-nums text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
                  متبقٍ {formatClock(sleepTimerRemainingSec)}
                </span>
              )}
            </div>

            <div role="group" aria-label="اختيار مدة مؤقت النوم" className="flex flex-wrap items-center gap-1.5">
              {SLEEP_TIMER_OPTIONS.map(option => {
                const active = sleepTimerMinutes === option.value;
                return (
                  <button
                    key={String(option.value)}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onSelectSleepTimer(option.value)}
                    className={`min-h-9 px-3 rounded-lg text-xs font-bold transition-colors ${
                      active
                        ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)]'
                        : 'bg-[var(--wird-surface)] border border-[var(--wird-border)] text-[var(--wird-text)] hover:border-[var(--wird-border-strong)]'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Progress & Volume Row */}
          {isThisSessionLoaded && (
            <div className="space-y-2.5 rounded-xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <p role="status" aria-live="polite" className="font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
                  {playback.isLoading
                    ? 'جارٍ تحميل التلاوة...'
                    : playback.isPlaying
                    ? `يتم التشغيل: ${playback.currentTitle}`
                    : `متوقف مؤقتًا: ${playback.currentTitle}`}
                </p>
                <span className="font-mono tabular-nums text-[var(--wird-muted)]">
                  {playback.queuePosition} / {playback.queueLength} ({progressPercent}%)
                </span>
              </div>

              <div
                role="progressbar"
                aria-label="تقدم الجلسة الصوتية"
                aria-valuemin={0}
                aria-valuemax={playback.queueLength}
                aria-valuenow={playback.queuePosition}
                className="h-2 overflow-hidden rounded-full bg-[var(--wird-border)]"
              >
                <div
                  className="h-full rounded-full bg-[var(--wird-primary)] dark:bg-[var(--wird-accent)] transition-[width]"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max={playback.duration || 0}
                  step="0.1"
                  value={Math.min(playback.currentTime, playback.duration || 0)}
                  disabled={!playback.duration}
                  aria-label="موضع الآية الصوتية"
                  onChange={e => onSeek(Number(e.target.value))}
                  className="min-h-11 w-full accent-[var(--wird-primary)] dark:accent-[var(--wird-accent)] disabled:opacity-50"
                />
                <span dir="ltr" className="shrink-0 font-mono tabular-nums text-[11px] text-[var(--wird-muted)]">
                  {formatClock(playback.currentTime)} / {formatClock(playback.duration)}
                </span>
                <div className="flex shrink-0 items-center gap-2 text-[11px] text-[var(--wird-muted)]">
                  <button
                    type="button"
                    onClick={handleToggleMute}
                    aria-label={audioVolume === 0 ? 'إلغاء كتم الصوت' : 'كتم الصوت'}
                    className="min-h-9 min-w-9 rounded-lg flex items-center justify-center hover:bg-[var(--wird-surface)] text-[var(--wird-text)] transition-colors"
                  >
                    {audioVolume === 0 ? <VolumeX className="w-4 h-4 text-rose-600" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={audioVolume}
                    aria-label="مستوى صوت الرقية المسموعة"
                    onChange={e => onAudioVolumeChange(Number(e.target.value))}
                    className="min-h-11 w-20 accent-[var(--wird-primary)] dark:accent-[var(--wird-accent)]"
                  />
                </div>
              </div>
            </div>
          )}

          {playback.error && (
            <p role="alert" className="text-xs font-semibold text-rose-700 dark:text-rose-300">
              {playback.error}
            </p>
          )}
          {playback.statusMessage && (
            <p role="status" className="text-xs font-semibold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
              {playback.statusMessage}
            </p>
          )}
        </div>

        {/* 3. Interactive Passage Tracklist */}
        <div className="pt-2 border-t border-[var(--wird-border)] space-y-3">
          <button
            type="button"
            aria-expanded={showTracklist}
            onClick={() => setShowTracklist(prev => !prev)}
            className="w-full flex items-center justify-between text-xs font-bold text-[var(--wird-text)] py-1"
          >
            <span className="flex items-center gap-2">
              <ListMusic className="w-4 h-4 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
              <span>مقاطع هذه الجلسة الصوتية ({activeSession.tracks.length} مقاطع)</span>
            </span>
            {showTracklist ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showTracklist && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {activeSession.tracks.map((track, idx) => {
                const item = itemsById.get(track.itemId);
                if (!item) return null;
                const isCurrentPassage =
                  isThisSessionLoaded && playback.currentPassageIndex === idx;
                return (
                  <button
                    key={`${activeSession.id}-${track.itemId}-${idx}`}
                    type="button"
                    onClick={() => onPlaySession(activeSession, idx)}
                    className={`text-right p-3 rounded-xl border transition-colors flex items-center justify-between gap-2 min-h-12 ${
                      isCurrentPassage
                        ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] border-transparent'
                        : 'bg-[var(--wird-surface-muted)] border-[var(--wird-border)] text-[var(--wird-text)] hover:border-[var(--wird-border-strong)]'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">
                        <span className="font-mono opacity-75 ml-1">{String(idx + 1).padStart(2, '0')}.</span>
                        {item.title}
                      </p>
                      <p
                        className={`text-[10px] mt-0.5 truncate ${
                          isCurrentPassage ? 'opacity-85' : 'text-[var(--wird-muted)]'
                        }`}
                      >
                        سورة {item.surahName} ({item.verseRange})
                        {track.repeatCount && track.repeatCount > 1 ? ` · مكرر ${track.repeatCount} مرات` : ''}
                      </p>
                    </div>
                    <Play className="w-3.5 h-3.5 shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Religious Transparency Footer */}
        <div className="flex items-start gap-2.5 pt-3 border-t border-[var(--wird-border)] text-[11px] text-[var(--wird-muted)] leading-relaxed">
          <ShieldCheck className="w-4 h-4 text-[var(--wird-primary)] dark:text-[var(--wird-accent)] shrink-0 mt-0.5" />
          <p>
            جميع جلسات الرقية المسموعة تتلو آيات القرآن الكريم الموثقة من مصحف وِرد المعتمد بأصوات القراء المرخّصين (Al Quran Cloud)، وتدعم الحفظ الكامل على الجهاز للاستماع بدون إنترنت. الاستماع الصوتي لا يعدّل عدّادات القراءة الخاصة بك.
          </p>
        </div>
      </div>
    </section>
  );
};
