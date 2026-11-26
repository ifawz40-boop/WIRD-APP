import React, { useMemo, useState } from 'react';
import {
  Play,
  CheckCircle2,
  Circle,
  Clock,
  ListVideo,
  SkipForward,
  ExternalLink,
  X,
  Tv,
} from 'lucide-react';
import {
  getYouTubeEmbedUrl,
  getYouTubeThumbnailUrl,
  getYouTubeWatchUrl,
} from '../../data/videoSeriesCatalog';
import {
  advanceDailySuggestedLesson,
  getDailySuggestedLesson,
  readVideoSeriesStore,
  setLessonWatchStatus,
  toggleLessonCompleted,
  type VideoSeriesStoreV1,
} from '../../services/videoSeriesService';
import { WirdButton, WirdCard, WirdMetadataRow } from '../ui/WirdPrimitives';

interface DailyVideoSuggestionCardProps {
  onOpenSeriesLibrary: (seriesId?: string, videoId?: string) => void;
  onToast?: (message: string, type?: 'success' | 'info' | 'warn' | 'error') => void;
}

export const DailyVideoSuggestionCard: React.FC<DailyVideoSuggestionCardProps> = ({
  onOpenSeriesLibrary,
  onToast,
}) => {
  const [store, setStore] = useState<VideoSeriesStoreV1>(() => readVideoSeriesStore());
  const [isPlayingInline, setIsPlayingInline] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);

  const suggestion = useMemo(() => getDailySuggestedLesson(store), [store]);
  const { series, lesson, status, completedCount, totalCount, percent, isSeriesCompleted } = suggestion;

  const embedUrl = getYouTubeEmbedUrl(lesson.videoId);
  const watchUrl = getYouTubeWatchUrl(lesson.videoId, series.playlistId);
  const thumbUrl = getYouTubeThumbnailUrl(lesson.videoId);

  const handleStartInlineWatch = () => {
    setIsPlayingInline(true);
    if (status === 'unwatched') {
      const updated = setLessonWatchStatus(series.id, lesson.videoId, 'in_progress');
      setStore(updated);
    }
  };

  const handleToggleComplete = () => {
    const updated = toggleLessonCompleted(series.id, lesson.videoId);
    setStore(updated);
    const isNowDone = updated.progressBySeries[series.id]?.completedVideoIds.includes(lesson.videoId);
    onToast?.(
      isNowDone
        ? `تم تسجيل إتمام «${lesson.title}» في سجل السلسلة.`
        : `تم إلغاء علامة الإتمام عن «${lesson.title}».`,
      isNowDone ? 'success' : 'info'
    );
  };

  const handleNextSuggestion = () => {
    const updated = advanceDailySuggestedLesson(series.id);
    setStore(updated);
    setIsPlayingInline(false);
    setThumbFailed(false);
    onToast?.('تم تحديث اقتراح اليوم إلى الدرس التالي في السلسلة.', 'info');
  };

  return (
    <WirdCard
      id="dashboard-daily-series"
      aria-label="اقتراح اليوم من السلاسل المرئية"
      className="p-5 sm:p-6 space-y-4 scroll-mt-20"
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-[var(--wird-border)]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[var(--wird-surface-muted)] text-[var(--wird-primary)] dark:text-[var(--wird-accent)] border border-[var(--wird-border-gold)] flex items-center justify-center shrink-0">
            <Tv className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-base text-[var(--wird-text)] truncate">
              اقتراح اليوم — {series.title}
            </h3>
            <WirdMetadataRow
              items={[
                series.speaker,
                series.categoryLabelAr,
                `${completedCount} / ${totalCount} مكتمل (${percent}%)`,
              ]}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => onOpenSeriesLibrary(series.id, lesson.videoId)}
          className="min-h-10 px-2.5 text-xs font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] hover:underline inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 wird-focus-ring rounded-lg"
        >
          <ListVideo className="w-4 h-4" />
          <span>كل دروس السلسلة ({totalCount})</span>
        </button>
      </div>

      {/* Main Split: Video Preview / Inline Player + Details & Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Media Slot (16:9) */}
        <div className="lg:col-span-5 flex flex-col">
          <div className="relative aspect-video w-full rounded-[var(--wird-radius-control)] overflow-hidden border border-[var(--wird-border)] bg-[var(--wird-surface-muted)]">
            {isPlayingInline && embedUrl ? (
              <>
                <iframe
                  src={`${embedUrl}&autoplay=1`}
                  title={lesson.title}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
                <button
                  type="button"
                  onClick={() => setIsPlayingInline(false)}
                  aria-label="إغلاق المشغل المدمج"
                  className="absolute top-2 left-2 z-10 min-h-9 min-w-9 rounded-lg bg-black/70 hover:bg-black/85 text-white flex items-center justify-center transition-colors wird-focus-ring"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleStartInlineWatch}
                className="group relative w-full h-full text-right block focus:outline-none wird-focus-ring"
                aria-label={`تشغيل الدرس ${lesson.order}: ${lesson.title}`}
              >
                {!thumbFailed && thumbUrl ? (
                  <img
                    src={thumbUrl}
                    alt={lesson.title}
                    referrerPolicy="no-referrer"
                    onError={() => setThumbFailed(true)}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="w-full h-full wird-hero-surface flex flex-col items-center justify-center p-4 text-center gap-2">
                    <Tv className="w-8 h-8 text-[#E6B85C]" />
                    <span className="text-xs font-bold text-[#F9F6EE] line-clamp-2">
                      {lesson.title}
                    </span>
                  </div>
                )}

                {/* Measured contrast scrim */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/15 transition-opacity group-hover:from-black/85" />

                {/* Center play affordance */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="w-12 h-12 rounded-full bg-[var(--wird-accent)] text-[var(--wird-accent-ink)] shadow-lg flex items-center justify-center transition-transform duration-200 group-hover:scale-105">
                    <Play className="w-5 h-5 fill-current -mr-0.5" />
                  </span>
                </div>

                {/* Bottom info overlay inside media frame */}
                <div className="absolute bottom-2.5 inset-x-3 flex items-center justify-between gap-2 text-[11px] font-semibold text-white">
                  <span className="tabular-nums">
                    الدرس {String(lesson.order).padStart(2, '0')} من {totalCount}
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono tabular-nums bg-black/65 px-2 py-0.5 rounded">
                    <Clock className="w-3 h-3" />
                    {lesson.durationText}
                  </span>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Content & Controls Slot */}
        <div className="lg:col-span-7 flex flex-col justify-between gap-4">
          <div className="space-y-2.5 text-right">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] tabular-nums">
                {isSeriesCompleted
                  ? `مراجعة مقترحة · الدرس ${lesson.order} من ${totalCount}`
                  : `درس اليوم المقترح · الدرس ${lesson.order} من ${totalCount}`}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 font-semibold ${
                  status === 'completed'
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : status === 'in_progress'
                      ? 'text-[var(--wird-accent-hover)] dark:text-[var(--wird-accent)]'
                      : 'text-[var(--wird-muted)]'
                }`}
              >
                {status === 'completed' ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>تمت المشاهدة والانتهاء</span>
                  </>
                ) : status === 'in_progress' ? (
                  <>
                    <Clock className="w-3.5 h-3.5" />
                    <span>قيد المشاهدة</span>
                  </>
                ) : (
                  <>
                    <Circle className="w-3.5 h-3.5" />
                    <span>لم يُشاهد بعد</span>
                  </>
                )}
              </span>
            </div>

            <h4 className="text-base sm:text-lg font-extrabold text-[var(--wird-text)] leading-snug wird-headline-balance">
              {lesson.title}
            </h4>

            {lesson.description && (
              <p className="text-xs sm:text-sm text-[var(--wird-muted)] leading-relaxed line-clamp-2">
                {lesson.description}
              </p>
            )}

            <WirdMetadataRow
              items={[
                lesson.speaker,
                lesson.topic,
                `المدة ${lesson.durationText}`,
              ]}
            />

            {/* Series Progress Bar */}
            <div className="pt-1 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-[var(--wird-muted)] tabular-nums">
                <span>تقدمك في السلسلة</span>
                <span className="font-mono font-bold text-[var(--wird-text)]">
                  {completedCount} / {totalCount} ({percent}%)
                </span>
              </div>
              <div
                role="progressbar"
                aria-label={`نسبة إنجاز ${series.title}`}
                aria-valuemin={0}
                aria-valuemax={totalCount}
                aria-valuenow={completedCount}
                className="w-full h-1.5 rounded-full bg-[var(--wird-surface-muted)] overflow-hidden"
              >
                <div
                  className="h-full rounded-full bg-[var(--wird-primary)] dark:bg-[var(--wird-accent)] transition-all duration-300"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Interactive Actions */}
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[var(--wird-border)]">
            {!isPlayingInline ? (
              <WirdButton variant="primary" size="md" onClick={handleStartInlineWatch}>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>مشاهدة الدرس الآن</span>
              </WirdButton>
            ) : (
              <WirdButton
                variant="secondary"
                size="md"
                onClick={() => onOpenSeriesLibrary(series.id, lesson.videoId)}
              >
                <ListVideo className="w-4 h-4" />
                <span>فتح صفحة السلسلة الكاملة</span>
              </WirdButton>
            )}

            <WirdButton
              variant={status === 'completed' ? 'accent' : 'secondary'}
              size="md"
              onClick={handleToggleComplete}
              aria-pressed={status === 'completed'}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{status === 'completed' ? 'مكتمل' : 'تحديد كمكتمل'}</span>
            </WirdButton>

            <WirdButton
              variant="ghost"
              size="sm"
              onClick={handleNextSuggestion}
              title="الانتقال إلى الدرس التالي في الاقتراح اليومي"
            >
              <SkipForward className="w-3.5 h-3.5" />
              <span>الدرس التالي</span>
            </WirdButton>

            {watchUrl && (
              <a
                href={watchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-9 px-2.5 inline-flex items-center gap-1 text-xs font-semibold text-[var(--wird-muted)] hover:text-[var(--wird-text)] transition-colors mr-auto whitespace-nowrap"
              >
                <span>يوتيوب</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    </WirdCard>
  );
};
