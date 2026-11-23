import React, { useEffect, useMemo, useState } from 'react';
import {
  Play,
  CheckCircle2,
  Circle,
  Clock,
  ExternalLink,
  Plus,
  Search,
  Sparkles,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Star,
  Tv,
  StickyNote,
  Loader2,
  X,
  Check,
  ListVideo,
} from 'lucide-react';
import {
  SERIES_CATEGORY_LABELS,
  formatTotalSeriesDurationAr,
  getAllSeriesMerged,
  getYouTubeEmbedUrl,
  getYouTubeThumbnailUrl,
  getYouTubeWatchUrl,
  type VideoLessonItem,
  type VideoSeriesCategory,
  type VideoSeriesDefinition,
} from '../../data/videoSeriesCatalog';
import {
  addCustomSeries,
  fetchYouTubePlaylistMetadata,
  getLessonWatchStatus,
  getSeriesProgressSummary,
  getSeriesWatchProgress,
  readVideoSeriesStore,
  removeCustomSeries,
  saveLessonNote,
  setFeaturedSeries,
  setLessonWatchStatus,
  toggleLessonCompleted,
  type ImportedYouTubePlaylistPayload,
  type LessonWatchStatus,
  type VideoSeriesStoreV1,
} from '../../services/videoSeriesService';
import { WirdIslamicPattern } from '../brand/WirdPattern';
import {
  WirdButton,
  WirdCard,
  WirdEmptyState,
  WirdMetadataRow,
  WirdSegmentedTabs,
  WirdSheet,
} from '../ui/WirdPrimitives';

interface VideoSeriesViewProps {
  initialSeriesId?: string;
  initialVideoId?: string;
  onToast?: (message: string, type?: 'success' | 'info' | 'warn' | 'error') => void;
}

type LessonFilter = 'all' | 'unwatched' | 'in_progress' | 'completed';

export const VideoSeriesView: React.FC<VideoSeriesViewProps> = ({
  initialSeriesId,
  initialVideoId,
  onToast,
}) => {
  const [store, setStore] = useState<VideoSeriesStoreV1>(() => readVideoSeriesStore());
  const allSeries = useMemo(
    () => getAllSeriesMerged(store.customSeries),
    [store.customSeries]
  );

  const [selectedSeriesId, setSelectedSeriesId] = useState<string>(() => {
    if (initialSeriesId && allSeries.some((s) => s.id === initialSeriesId)) {
      return initialSeriesId;
    }
    return store.featuredSeriesId || allSeries[0].id;
  });

  const activeSeries: VideoSeriesDefinition = useMemo(
    () => allSeries.find((s) => s.id === selectedSeriesId) || allSeries[0],
    [allSeries, selectedSeriesId]
  );

  const activeSummary = useMemo(
    () => getSeriesProgressSummary(activeSeries, store),
    [activeSeries, store]
  );

  const activeProgress = useMemo(
    () => getSeriesWatchProgress(store, activeSeries.id),
    [store, activeSeries.id]
  );

  const [selectedVideoId, setSelectedVideoId] = useState<string>(() => {
    if (
      initialVideoId &&
      activeSeries.videos.some((v) => v.videoId === initialVideoId)
    ) {
      return initialVideoId;
    }
    return (
      activeProgress.lastWatchedVideoId ||
      activeSummary.nextUnwatchedLesson.videoId ||
      activeSeries.videos[0].videoId
    );
  });

  // Sync external deep-link changes when navigating from Dashboard
  useEffect(() => {
    if (initialSeriesId && allSeries.some((s) => s.id === initialSeriesId)) {
      setSelectedSeriesId(initialSeriesId);
      const target = allSeries.find((s) => s.id === initialSeriesId)!;
      if (initialVideoId && target.videos.some((v) => v.videoId === initialVideoId)) {
        setSelectedVideoId(initialVideoId);
      } else {
        setSelectedVideoId(getSeriesProgressSummary(target, store).nextUnwatchedLesson.videoId);
      }
      setIsPlayerActive(false);
    }
  }, [initialSeriesId, initialVideoId]);

  const activeLesson: VideoLessonItem = useMemo(
    () =>
      activeSeries.videos.find((v) => v.videoId === selectedVideoId) ||
      activeSeries.videos[0],
    [activeSeries, selectedVideoId]
  );

  const activeLessonIndex = activeSeries.videos.findIndex(
    (v) => v.videoId === activeLesson.videoId
  );
  const activeLessonStatus = getLessonWatchStatus(
    store,
    activeSeries.id,
    activeLesson.videoId
  );

  const [isPlayerActive, setIsPlayerActive] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const [lessonFilter, setLessonFilter] = useState<LessonFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [noteDraft, setNoteDraft] = useState(
    () => activeProgress.videoNotes[activeLesson.videoId] || ''
  );

  useEffect(() => {
    setNoteDraft(activeProgress.videoNotes[activeLesson.videoId] || '');
    setThumbFailed(false);
  }, [activeLesson.videoId, activeSeries.id]);

  // Add Series Sheet state
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [playlistInput, setPlaylistInput] = useState('');
  const [isFetchingPlaylist, setIsFetchingPlaylist] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchedPayload, setFetchedPayload] =
    useState<ImportedYouTubePlaylistPayload | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [customSpeaker, setCustomSpeaker] = useState('');
  const [customCategory, setCustomCategory] =
    useState<VideoSeriesCategory>('tazkiyah');
  const [customDescription, setCustomDescription] = useState('');
  const [featureNewSeries, setFeatureNewSeries] = useState(true);

  const handleSelectSeries = (series: VideoSeriesDefinition) => {
    setSelectedSeriesId(series.id);
    const summary = getSeriesProgressSummary(series, store);
    setSelectedVideoId(summary.nextUnwatchedLesson.videoId);
    setIsPlayerActive(false);
    setLessonFilter('all');
    setSearchQuery('');
  };

  const handleSelectLesson = (lesson: VideoLessonItem, autoPlay = false) => {
    setSelectedVideoId(lesson.videoId);
    setIsPlayerActive(autoPlay);
    if (autoPlay && getLessonWatchStatus(store, activeSeries.id, lesson.videoId) === 'unwatched') {
      setStore(setLessonWatchStatus(activeSeries.id, lesson.videoId, 'in_progress'));
    }
  };

  const handleSetStatus = (videoId: string, status: LessonWatchStatus) => {
    const updated = setLessonWatchStatus(activeSeries.id, videoId, status);
    setStore(updated);
    const lessonObj = activeSeries.videos.find((v) => v.videoId === videoId);
    if (!lessonObj) return;
    if (status === 'completed') {
      onToast?.(`تم تسجيل إتمام «${lessonObj.title}».`, 'success');
    } else if (status === 'in_progress') {
      onToast?.(`تم تحديد «${lessonObj.title}» كقيد المشاهدة.`, 'info');
    } else {
      onToast?.(`تم إعادة «${lessonObj.title}» إلى غير مشاهد.`, 'info');
    }
  };

  const handleQuickToggleCompleted = (lesson: VideoLessonItem) => {
    const updated = toggleLessonCompleted(activeSeries.id, lesson.videoId);
    setStore(updated);
    const isDone = updated.progressBySeries[activeSeries.id]?.completedVideoIds.includes(
      lesson.videoId
    );
    onToast?.(
      isDone
        ? `تم تسجيل إتمام «${lesson.title}».`
        : `تم إلغاء علامة الإتمام عن «${lesson.title}».`,
      isDone ? 'success' : 'info'
    );
  };

  const handleSetAsFeatured = (seriesId: string) => {
    const updated = setFeaturedSeries(seriesId);
    setStore(updated);
    const target = allSeries.find((s) => s.id === seriesId);
    onToast?.(
      `تم اعتماد «${target?.title || 'السلسلة'}» كمصدر للاقتراح اليومي في الرئيسية.`,
      'success'
    );
  };

  const handleSaveNote = () => {
    const updated = saveLessonNote(activeSeries.id, activeLesson.videoId, noteDraft);
    setStore(updated);
    onToast?.(
      noteDraft.trim()
        ? 'تم حفظ فوائدك وملاحظاتك لهذا الدرس.'
        : 'تم مسح الملاحظة المحفوظة لهذا الدرس.',
      'success'
    );
  };

  const handleFetchPlaylist = async () => {
    setFetchError(null);
    setFetchedPayload(null);
    setIsFetchingPlaylist(true);
    try {
      const payload = await fetchYouTubePlaylistMetadata(playlistInput);
      setFetchedPayload(payload);
      setCustomTitle(payload.title);
      setCustomSpeaker(payload.speaker);
      setCustomDescription(`قائمة تشغيل من يوتيوب تضم ${payload.videos.length} درساً.`);
    } catch (err: any) {
      setFetchError(err?.message || 'تعذر جلب قائمة التشغيل.');
    } finally {
      setIsFetchingPlaylist(false);
    }
  };

  const handleConfirmAddSeries = () => {
    if (!fetchedPayload) return;
    const result = addCustomSeries({
      playlistId: fetchedPayload.playlistId,
      title: customTitle || fetchedPayload.title,
      speaker: customSpeaker || fetchedPayload.speaker,
      category: customCategory,
      description: customDescription,
      videos: fetchedPayload.videos,
      featureOnDashboard: featureNewSeries,
    });

    if (result.ok === false) {
      setFetchError(result.errorAr);
      return;
    }

    setStore(result.store);
    setSelectedSeriesId(result.series.id);
    setSelectedVideoId(result.series.videos[0].videoId);
    setIsPlayerActive(false);
    setIsAddSheetOpen(false);
    setPlaylistInput('');
    setFetchedPayload(null);
    setFetchError(null);
    onToast?.(`تمت إضافة «${result.series.title}» (${result.series.videos.length} درساً) بنجاح.`, 'success');
  };

  const handleRemoveSeries = (series: VideoSeriesDefinition) => {
    if (series.sourceType !== 'custom') return;
    const updated = removeCustomSeries(series.id);
    setStore(updated);
    const remaining = getAllSeriesMerged(updated.customSeries);
    if (selectedSeriesId === series.id && remaining[0]) {
      setSelectedSeriesId(remaining[0].id);
      setSelectedVideoId(remaining[0].videos[0].videoId);
    }
    onToast?.(`تمت إزالة السلسلة «${series.title}».`, 'info');
  };

  const filteredLessons = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeSeries.videos.filter((lesson) => {
      const status = getLessonWatchStatus(store, activeSeries.id, lesson.videoId);
      if (lessonFilter !== 'all' && status !== lessonFilter) return false;
      if (!q) return true;
      return (
        lesson.title.toLowerCase().includes(q) ||
        (lesson.description || '').toLowerCase().includes(q) ||
        (lesson.topic || '').toLowerCase().includes(q) ||
        String(lesson.order).includes(q)
      );
    });
  }, [activeSeries, store, lessonFilter, searchQuery]);

  const embedUrl = getYouTubeEmbedUrl(activeLesson.videoId);
  const watchUrl = getYouTubeWatchUrl(activeLesson.videoId, activeSeries.playlistId);
  const thumbUrl = getYouTubeThumbnailUrl(activeLesson.videoId);
  const isFeatured = store.featuredSeriesId === activeSeries.id;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* 1. Editorial Hero Header */}
      <section
        aria-labelledby="series-hero-title"
        className="wird-hero-surface relative rounded-[var(--wird-radius-card)] p-5 sm:p-6 overflow-hidden"
      >
        <WirdIslamicPattern opacity={0.055} variant="gold" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="space-y-2 max-w-3xl text-right">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#F6F1E6]/90">
              <span>مكتبة السلاسل المرئية والدروس العلمية</span>
              <span aria-hidden="true" className="opacity-50">·</span>
              <span className="tabular-nums">{allSeries.length} {allSeries.length === 1 ? 'سلسلة متاحة' : 'سلاسل متاحة'}</span>
              <span aria-hidden="true" className="opacity-50">·</span>
              <span className="tabular-nums">إنجاز السلسلة الحالية: {activeSummary.completedCount} / {activeSummary.totalCount}</span>
            </div>
            <h2
              id="series-hero-title"
              className="text-xl sm:text-2xl font-extrabold text-[#F9F6EE] leading-snug wird-headline-balance"
            >
              {activeSeries.title}
            </h2>
            <p className="text-xs sm:text-sm text-[#F6F1E6]/88 leading-relaxed">
              {activeSeries.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {!isFeatured && (
              <button
                type="button"
                onClick={() => handleSetAsFeatured(activeSeries.id)}
                className="min-h-11 inline-flex items-center gap-2 px-4 py-2 rounded-[var(--wird-radius-control)] bg-white/12 hover:bg-white/20 border border-white/20 text-[#F9F6EE] text-xs font-bold transition-colors whitespace-nowrap"
              >
                <Star className="w-4 h-4 text-[#E6B85C]" />
                <span>اعتماد للاقتراح اليومي</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setFetchError(null);
                setIsAddSheetOpen(true);
              }}
              className="wird-btn-accent min-h-11 inline-flex items-center gap-2 px-4 py-2 text-xs font-bold whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة سلسلة جديدة</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. Multi-Series Switcher Strip (Extensible Catalog) */}
      <section aria-label="السلاسل المتاحة" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-[var(--wird-text)]">
            السلاسل المسجلة ({allSeries.length})
          </h3>
          <span className="text-xs text-[var(--wird-muted)]">
            اختر أي سلسلة للمتابعة أو أضف قوائم تشغيل يوتيوب جديدة لبناء مكتبتك
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {allSeries.map((series) => {
            const summary = getSeriesProgressSummary(series, store);
            const selected = series.id === activeSeries.id;
            const featured = store.featuredSeriesId === series.id;

            return (
              <div
                key={series.id}
                className={`rounded-[var(--wird-radius-card)] border p-4 transition-colors flex flex-col justify-between gap-3 ${
                  selected
                    ? 'bg-[var(--wird-surface)] border-[var(--wird-accent)] shadow-[var(--wird-shadow)]'
                    : 'bg-[var(--wird-surface)]/80 border-[var(--wird-border)] hover:border-[var(--wird-border-strong)]'
                }`}
              >
                <div className="space-y-1.5 text-right">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectSeries(series)}
                      className="text-right font-bold text-sm text-[var(--wird-text)] hover:text-[var(--wird-primary)] dark:hover:text-[var(--wird-accent)] transition-colors line-clamp-1 wird-focus-ring rounded"
                    >
                      {series.title}
                    </button>
                    {series.sourceType === 'custom' && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSeries(series)}
                        aria-label={`حذف سلسلة ${series.title}`}
                        className="p-1.5 text-[var(--wird-muted)] hover:text-rose-600 rounded-lg transition-colors shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <WirdMetadataRow
                    items={[
                      series.speaker,
                      `${series.videos.length} دروس`,
                      formatTotalSeriesDurationAr(series.videos),
                    ]}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] tabular-nums">
                    <span className="text-[var(--wird-muted)]">
                      {featured ? '★ معروضة في اقتراح الرئيسية' : series.categoryLabelAr}
                    </span>
                    <span className="font-mono font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
                      {summary.completedCount}/{summary.totalCount} ({summary.percent}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-[var(--wird-surface-muted)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--wird-primary)] dark:bg-[var(--wird-accent)] transition-all"
                      style={{ width: `${summary.percent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <WirdButton
                      variant={selected ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => handleSelectSeries(series)}
                    >
                      {selected ? 'السلسلة المفتوحة' : 'عرض الدروس'}
                    </WirdButton>
                    {!featured && (
                      <button
                        type="button"
                        onClick={() => handleSetAsFeatured(series.id)}
                        className="text-[11px] font-semibold text-[var(--wird-muted)] hover:text-[var(--wird-primary)] dark:hover:text-[var(--wird-accent)] transition-colors"
                      >
                        تعيين للرئيسية
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Add New Series Card Slot */}
          <button
            type="button"
            onClick={() => {
              setFetchError(null);
              setIsAddSheetOpen(true);
            }}
            className="min-h-36 rounded-[var(--wird-radius-card)] border border-dashed border-[var(--wird-border-strong)] hover:border-[var(--wird-accent)] bg-[var(--wird-surface-muted)]/50 hover:bg-[var(--wird-surface-muted)] p-4 flex flex-col items-center justify-center gap-2 text-center transition-colors wird-focus-ring"
          >
            <div className="w-10 h-10 rounded-xl bg-[var(--wird-surface)] border border-[var(--wird-border)] text-[var(--wird-primary)] dark:text-[var(--wird-accent)] flex items-center justify-center">
              <Plus className="w-5 h-5" />
            </div>
            <div className="text-xs font-bold text-[var(--wird-text)]">
              أضف سلسلة جديدة من يوتيوب
            </div>
            <p className="text-[11px] text-[var(--wird-muted)] max-w-[220px]">
              الصق رابط أي قائمة تشغيل عامة لتتبع دروسها يومياً
            </p>
          </button>
        </div>
      </section>

      {/* 3. Active Player + Episode Checklist Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Main Column: Video Player, Watch Status Controls & Personal Notes */}
        <div className="lg:col-span-7 space-y-5">
          <WirdCard className="p-4 sm:p-5 space-y-4">
            {/* Embedded Player or Thumbnail Launcher */}
            <div className="relative aspect-video w-full rounded-[var(--wird-radius-control)] overflow-hidden border border-[var(--wird-border)] bg-[var(--wird-surface-muted)]">
              {isPlayerActive && embedUrl ? (
                <iframe
                  key={activeLesson.videoId}
                  src={`${embedUrl}&autoplay=1`}
                  title={activeLesson.title}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => handleSelectLesson(activeLesson, true)}
                  className="group relative w-full h-full block focus:outline-none wird-focus-ring"
                  aria-label={`تشغيل الدرس ${activeLesson.order}: ${activeLesson.title}`}
                >
                  {!thumbFailed && thumbUrl ? (
                    <img
                      src={thumbUrl}
                      alt={activeLesson.title}
                      referrerPolicy="no-referrer"
                      onError={() => setThumbFailed(true)}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="w-full h-full wird-hero-surface flex flex-col items-center justify-center gap-2 p-6 text-center">
                      <Tv className="w-10 h-10 text-[#E6B85C]" />
                      <span className="text-sm font-bold text-[#F9F6EE]">{activeLesson.title}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/10" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="w-14 h-14 rounded-full bg-[var(--wird-accent)] text-[var(--wird-accent-ink)] shadow-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-105">
                      <Play className="w-6 h-6 fill-current -mr-0.5" />
                    </span>
                  </div>
                  <div className="absolute bottom-3 inset-x-4 flex items-center justify-between text-xs font-semibold text-white">
                    <span className="tabular-nums">
                      الدرس {String(activeLesson.order).padStart(2, '0')} من {activeSeries.videos.length}
                    </span>
                    <span className="font-mono tabular-nums bg-black/70 px-2 py-0.5 rounded">
                      {activeLesson.durationText}
                    </span>
                  </div>
                </button>
              )}
            </div>

            {/* Active Lesson Details */}
            <div className="space-y-2 text-right">
              <WirdMetadataRow
                items={[
                  `الدرس ${activeLesson.order} من ${activeSeries.videos.length}`,
                  activeLesson.speaker,
                  activeLesson.topic,
                  `المدة ${activeLesson.durationText}`,
                ]}
              />
              <h3 className="text-lg font-extrabold text-[var(--wird-text)] leading-snug">
                {activeLesson.title}
              </h3>
              {activeLesson.description && (
                <p className="text-xs sm:text-sm text-[var(--wird-muted)] leading-relaxed">
                  {activeLesson.description}
                </p>
              )}
            </div>

            {/* Watch Status Controls */}
            <div className="pt-3.5 border-t border-[var(--wird-border)] flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <WirdButton
                  variant={activeLessonStatus === 'completed' ? 'accent' : 'primary'}
                  size="md"
                  onClick={() =>
                    handleSetStatus(
                      activeLesson.videoId,
                      activeLessonStatus === 'completed' ? 'unwatched' : 'completed'
                    )
                  }
                  aria-pressed={activeLessonStatus === 'completed'}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {activeLessonStatus === 'completed'
                      ? 'تمت المشاهدة والانتهاء ✓'
                      : 'تحديد كمكتمل'}
                  </span>
                </WirdButton>

                {activeLessonStatus !== 'completed' && (
                  <WirdButton
                    variant={activeLessonStatus === 'in_progress' ? 'accent' : 'secondary'}
                    size="sm"
                    onClick={() =>
                      handleSetStatus(
                        activeLesson.videoId,
                        activeLessonStatus === 'in_progress' ? 'unwatched' : 'in_progress'
                      )
                    }
                    aria-pressed={activeLessonStatus === 'in_progress'}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {activeLessonStatus === 'in_progress' ? 'قيد المشاهدة' : 'وضع قيد المشاهدة'}
                    </span>
                  </WirdButton>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <WirdButton
                  variant="secondary"
                  size="sm"
                  disabled={activeLessonIndex <= 0}
                  onClick={() => {
                    if (activeLessonIndex > 0) {
                      handleSelectLesson(activeSeries.videos[activeLessonIndex - 1], false);
                    }
                  }}
                >
                  <ChevronRight className="w-4 h-4" />
                  <span>السابق</span>
                </WirdButton>
                <WirdButton
                  variant="secondary"
                  size="sm"
                  disabled={activeLessonIndex >= activeSeries.videos.length - 1}
                  onClick={() => {
                    if (activeLessonIndex < activeSeries.videos.length - 1) {
                      handleSelectLesson(activeSeries.videos[activeLessonIndex + 1], false);
                    }
                  }}
                >
                  <span>التالي</span>
                  <ChevronLeft className="w-4 h-4" />
                </WirdButton>
              </div>
            </div>

            {/* External YouTube Links */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--wird-muted)] pt-2 border-t border-[var(--wird-border)]/70">
              <span>يُعرض الفيديو عبر مشغل يوتيوب الخصوصي دون تتبع إضافي</span>
              <div className="flex items-center gap-3">
                {watchUrl && (
                  <a
                    href={watchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] hover:underline inline-flex items-center gap-1"
                  >
                    <span>فتح الدرس على يوتيوب</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                {activeSeries.playlistUrl && (
                  <a
                    href={activeSeries.playlistUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-[var(--wird-muted)] hover:text-[var(--wird-text)] hover:underline inline-flex items-center gap-1"
                  >
                    <span>قائمة التشغيل</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          </WirdCard>

          {/* Personal Reflections / Takeaways Card */}
          <WirdCard className="p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
                <h4 className="font-bold text-sm text-[var(--wird-text)]">
                  فوائدك وملاحظاتك على الدرس {activeLesson.order}
                </h4>
              </div>
              <span className="text-[11px] text-[var(--wird-muted)]">
                محفوظة محلياً لحسابك
              </span>
            </div>
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={3}
              maxLength={1500}
              placeholder="دوّن أبرز الفوائد أو الخطوات العملية التي استوقفتك في هذا الدرس..."
              className="w-full rounded-[var(--wird-radius-control)] border border-[var(--wird-border-strong)] bg-[var(--wird-surface-muted)] px-3.5 py-2.5 text-xs sm:text-sm text-[var(--wird-text)] placeholder:text-[var(--wird-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--wird-accent)] resize-y"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-[var(--wird-muted)] font-mono tabular-nums">
                {noteDraft.length} / 1500
              </span>
              <WirdButton variant="secondary" size="sm" onClick={handleSaveNote}>
                <Check className="w-3.5 h-3.5" />
                <span>حفظ الملاحظة</span>
              </WirdButton>
            </div>
          </WirdCard>
        </div>

        {/* Side Column: Complete Series Episodes Checklist */}
        <div className="lg:col-span-5">
          <WirdCard className="p-4 sm:p-5 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold text-sm text-[var(--wird-text)] flex items-center gap-2">
                  <ListVideo className="w-4 h-4 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
                  <span>جميع دروس السلسلة ({activeSeries.videos.length})</span>
                </h3>
                <span className="text-xs font-mono font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] tabular-nums">
                  {activeSummary.percent}%
                </span>
              </div>

              <div
                role="progressbar"
                aria-label={`تقدم سلسلة ${activeSeries.title}`}
                aria-valuemin={0}
                aria-valuemax={activeSummary.totalCount}
                aria-valuenow={activeSummary.completedCount}
                className="w-full h-1.5 rounded-full bg-[var(--wird-surface-muted)] overflow-hidden"
              >
                <div
                  className="h-full rounded-full bg-[var(--wird-primary)] dark:bg-[var(--wird-accent)] transition-all duration-300"
                  style={{ width: `${activeSummary.percent}%` }}
                />
              </div>

              <WirdMetadataRow
                items={[
                  `مكتمل: ${activeSummary.completedCount}`,
                  `قيد المشاهدة: ${activeSummary.inProgressCount}`,
                  `متبقي: ${activeSummary.unwatchedCount}`,
                ]}
              />
            </div>

            {/* Filter Tabs + Search */}
            <div className="space-y-2.5">
              <WirdSegmentedTabs<LessonFilter>
                ariaLabel="تصفية دروس السلسلة حسب حالة المشاهدة"
                value={lessonFilter}
                onChange={setLessonFilter}
                options={[
                  { id: 'all', label: 'الكل', count: activeSeries.videos.length },
                  { id: 'unwatched', label: 'لم يُشاهد', count: activeSummary.unwatchedCount },
                  { id: 'in_progress', label: 'قيد المشاهدة', count: activeSummary.inProgressCount },
                  { id: 'completed', label: 'مكتمل', count: activeSummary.completedCount },
                ]}
              />

              <div className="relative">
                <Search className="w-4 h-4 text-[var(--wird-muted)] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث بعنوان الدرس أو الموضوع..."
                  aria-label="البحث داخل دروس السلسلة"
                  className="w-full min-h-10 pr-9 pl-3 rounded-[var(--wird-radius-control)] border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] text-xs text-[var(--wird-text)] placeholder:text-[var(--wird-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--wird-accent)]"
                />
              </div>
            </div>

            {/* Episodes List */}
            {filteredLessons.length === 0 ? (
              <WirdEmptyState
                icon={Sparkles}
                title="لا توجد دروس مطابقة للتصفية"
                description="جرّب تغيير الفلتر أو مسح نص البحث لعرض جميع دروس السلسلة."
                action={
                  <WirdButton
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setLessonFilter('all');
                      setSearchQuery('');
                    }}
                  >
                    عرض كل الدروس
                  </WirdButton>
                }
              />
            ) : (
              <div
                role="list"
                aria-label={`قائمة دروس ${activeSeries.title}`}
                className="divide-y divide-[var(--wird-border)] max-h-[640px] overflow-y-auto pl-1"
              >
                {filteredLessons.map((lesson) => {
                  const status = getLessonWatchStatus(
                    store,
                    activeSeries.id,
                    lesson.videoId
                  );
                  const isCurrent = lesson.videoId === activeLesson.videoId;
                  const hasNote = Boolean(activeProgress.videoNotes[lesson.videoId]);

                  return (
                    <div
                      key={lesson.videoId}
                      role="listitem"
                      className={`py-2.5 px-2.5 first:pt-2 last:pb-2 rounded-lg transition-colors flex items-start gap-2.5 ${
                        isCurrent
                          ? 'bg-[var(--wird-surface-muted)] border border-[var(--wird-border-gold)]'
                          : 'hover:bg-[var(--wird-surface-muted)]/60 border border-transparent'
                      }`}
                    >
                      {/* Quick Completion Checkbox Button */}
                      <button
                        type="button"
                        onClick={() => handleQuickToggleCompleted(lesson)}
                        aria-label={
                          status === 'completed'
                            ? `إلغاء إتمام الدرس ${lesson.order}: ${lesson.title}`
                            : `تحديد الدرس ${lesson.order} كمكتمل: ${lesson.title}`
                        }
                        aria-pressed={status === 'completed'}
                        className={`mt-0.5 min-h-9 min-w-9 rounded-lg flex items-center justify-center shrink-0 transition-colors wird-focus-ring ${
                          status === 'completed'
                            ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/12 hover:bg-emerald-500/20'
                            : status === 'in_progress'
                              ? 'text-[var(--wird-accent-hover)] dark:text-[var(--wird-accent)] bg-[var(--wird-accent-soft)]'
                              : 'text-[var(--wird-muted)] hover:text-[var(--wird-primary)] dark:hover:text-[var(--wird-accent)] hover:bg-[var(--wird-surface)]'
                        }`}
                      >
                        {status === 'completed' ? (
                          <CheckCircle2 className="w-4.5 h-4.5" />
                        ) : status === 'in_progress' ? (
                          <Clock className="w-4.5 h-4.5" />
                        ) : (
                          <Circle className="w-4.5 h-4.5" />
                        )}
                      </button>

                      {/* Select Episode Button */}
                      <button
                        type="button"
                        onClick={() => handleSelectLesson(lesson, false)}
                        className="flex-1 min-w-0 text-right space-y-1 py-0.5 focus:outline-none wird-focus-ring rounded"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span
                            className={`text-xs font-bold leading-snug line-clamp-2 ${
                              status === 'completed'
                                ? 'text-[var(--wird-muted)] line-through decoration-[var(--wird-border-strong)]'
                                : 'text-[var(--wird-text)]'
                            }`}
                          >
                            <span className="font-mono tabular-nums text-[var(--wird-primary)] dark:text-[var(--wird-accent)] ml-1.5 no-underline inline-block">
                              {String(lesson.order).padStart(2, '0')}.
                            </span>
                            {lesson.title}
                          </span>
                        </div>
                        <WirdMetadataRow
                          items={[
                            lesson.durationText,
                            lesson.topic,
                            status === 'completed'
                              ? 'مكتمل'
                              : status === 'in_progress'
                                ? 'قيد المشاهدة'
                                : undefined,
                            hasNote ? 'توجد ملاحظة' : undefined,
                          ]}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </WirdCard>
        </div>
      </div>

      {/* 4. Add New YouTube Playlist Series Sheet */}
      <WirdSheet
        open={isAddSheetOpen}
        onClose={() => setIsAddSheetOpen(false)}
        title="إضافة سلسلة دروس جديدة"
        description="الصق رابط قائمة تشغيل عامة على يوتيوب لجلب جميع دروسها ومتابعتها ضمن وِرد."
      >
        <div className="space-y-4 text-right">
          <div className="space-y-1.5">
            <label
              htmlFor="wird-new-playlist-url"
              className="block text-xs font-bold text-[var(--wird-text)]"
            >
              رابط قائمة التشغيل (YouTube Playlist)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="wird-new-playlist-url"
                type="url"
                dir="ltr"
                value={playlistInput}
                onChange={(e) => setPlaylistInput(e.target.value)}
                placeholder="https://youtube.com/playlist?list=PL..."
                className="flex-1 min-h-11 px-3 rounded-[var(--wird-radius-control)] border border-[var(--wird-border-strong)] bg-[var(--wird-surface-muted)] text-xs text-[var(--wird-text)] focus:outline-none focus:ring-2 focus:ring-[var(--wird-accent)]"
              />
              <WirdButton
                variant="primary"
                size="md"
                disabled={isFetchingPlaylist || !playlistInput.trim()}
                onClick={handleFetchPlaylist}
              >
                {isFetchingPlaylist ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span>جلب</span>
                )}
              </WirdButton>
            </div>
          </div>

          {fetchError && (
            <div
              role="alert"
              className="p-3 rounded-[var(--wird-radius-control)] bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300 flex items-start justify-between gap-2"
            >
              <span>{fetchError}</span>
              <button
                type="button"
                onClick={() => setFetchError(null)}
                aria-label="إغلاق رسالة الخطأ"
                className="shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {fetchedPayload && (
            <div className="space-y-3.5 pt-3 border-t border-[var(--wird-border)]">
              <div className="p-3 rounded-[var(--wird-radius-control)] bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] text-xs space-y-1">
                <div className="font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
                  تم العثور على {fetchedPayload.videos.length} درساً في القائمة
                </div>
                <p className="text-[var(--wird-muted)]">
                  يمكنك تعديل العنوان أو التصنيف قبل الحفظ في مكتبتك.
                </p>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="wird-new-series-title"
                  className="block text-xs font-bold text-[var(--wird-text)]"
                >
                  عنوان السلسلة
                </label>
                <input
                  id="wird-new-series-title"
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full min-h-10 px-3 rounded-[var(--wird-radius-control)] border border-[var(--wird-border-strong)] bg-[var(--wird-surface)] text-xs text-[var(--wird-text)]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor="wird-new-series-speaker"
                    className="block text-xs font-bold text-[var(--wird-text)]"
                  >
                    المُحاضر / الشيخ
                  </label>
                  <input
                    id="wird-new-series-speaker"
                    type="text"
                    value={customSpeaker}
                    onChange={(e) => setCustomSpeaker(e.target.value)}
                    className="w-full min-h-10 px-3 rounded-[var(--wird-radius-control)] border border-[var(--wird-border-strong)] bg-[var(--wird-surface)] text-xs text-[var(--wird-text)]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="wird-new-series-category"
                    className="block text-xs font-bold text-[var(--wird-text)]"
                  >
                    التصنيف
                  </label>
                  <select
                    id="wird-new-series-category"
                    value={customCategory}
                    onChange={(e) =>
                      setCustomCategory(e.target.value as VideoSeriesCategory)
                    }
                    className="w-full min-h-10 px-3 rounded-[var(--wird-radius-control)] border border-[var(--wird-border-strong)] bg-[var(--wird-surface)] text-xs text-[var(--wird-text)]"
                  >
                    {(Object.entries(SERIES_CATEGORY_LABELS) as Array<[VideoSeriesCategory, string]>).map(
                      ([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="wird-new-series-desc"
                  className="block text-xs font-bold text-[var(--wird-text)]"
                >
                  وصف مختصر
                </label>
                <textarea
                  id="wird-new-series-desc"
                  rows={2}
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-[var(--wird-radius-control)] border border-[var(--wird-border-strong)] bg-[var(--wird-surface)] text-xs text-[var(--wird-text)]"
                />
              </div>

              <label className="flex items-center gap-2.5 text-xs text-[var(--wird-text)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={featureNewSeries}
                  onChange={(e) => setFeatureNewSeries(e.target.checked)}
                  className="w-4 h-4 accent-[var(--wird-primary)]"
                />
                <span>اعتمادها فوراً للاقتراح اليومي في الصفحة الرئيسية</span>
              </label>

              <div className="max-h-40 overflow-y-auto divide-y divide-[var(--wird-border)] rounded-[var(--wird-radius-control)] border border-[var(--wird-border)] px-3">
                {fetchedPayload.videos.slice(0, 8).map((v, idx) => (
                  <div
                    key={v.videoId}
                    className="py-2 flex items-center justify-between gap-2 text-[11px]"
                  >
                    <span className="truncate text-[var(--wird-text)]">
                      {idx + 1}. {v.title}
                    </span>
                    <span className="font-mono text-[var(--wird-muted)] shrink-0">
                      {v.durationText}
                    </span>
                  </div>
                ))}
                {fetchedPayload.videos.length > 8 && (
                  <div className="py-2 text-[11px] text-[var(--wird-muted)] text-center">
                    + {fetchedPayload.videos.length - 8} دروس أخرى
                  </div>
                )}
              </div>

              <WirdButton
                variant="primary"
                size="lg"
                className="w-full"
                onClick={handleConfirmAddSeries}
              >
                <Plus className="w-4 h-4" />
                <span>حفظ وإضافة السلسلة</span>
              </WirdButton>
            </div>
          )}
        </div>
      </WirdSheet>
    </div>
  );
};
