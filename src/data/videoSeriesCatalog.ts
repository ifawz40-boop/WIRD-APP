/**
 * ============================================================================
 * WIRD — Curated Video & Lecture Series Catalog (Extensible Multi-Series)
 * ============================================================================
 *
 * Modular catalog designed to host multiple full educational & tazkiyah
 * video series. Adding a new series requires appending a `VideoSeriesDefinition`
 * entry to `VIDEO_SERIES_CATALOG` (or registering a custom YouTube playlist
 * via `videoSeriesService.ts`).
 */

export type VideoSeriesCategory =
  | 'tazkiyah'
  | 'quran'
  | 'seerah'
  | 'worship'
  | 'general';

export interface VideoLessonItem {
  id: string;
  order: number;
  videoId: string;
  title: string;
  description?: string;
  durationText: string;
  durationSeconds: number;
  publishedAt?: string;
  speaker: string;
  topic?: string;
}

export interface VideoSeriesDefinition {
  id: string;
  playlistId: string;
  playlistUrl: string;
  title: string;
  speaker: string;
  channelName?: string;
  category: VideoSeriesCategory;
  categoryLabelAr: string;
  description: string;
  isFeaturedOnDashboard: boolean;
  sourceType: 'curated' | 'custom';
  addedAt: string;
  videos: VideoLessonItem[];
}

export const SERIES_CATEGORY_LABELS: Record<VideoSeriesCategory, string> = {
  tazkiyah: 'تزكية وبناء النفس',
  quran: 'القرآن وتدبره',
  seerah: 'السيرة والتربية',
  worship: 'العبادات والخشوع',
  general: 'دروس علمية وإيمانية',
};

const YOUTUBE_VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_PLAYLIST_ID_RE = /^[A-Za-z0-9_-]{10,64}$/;

export function isValidYouTubeVideoId(videoId: string): boolean {
  return typeof videoId === 'string' && YOUTUBE_VIDEO_ID_RE.test(videoId.trim());
}

export function isValidYouTubePlaylistId(playlistId: string): boolean {
  return (
    typeof playlistId === 'string' && YOUTUBE_PLAYLIST_ID_RE.test(playlistId.trim())
  );
}

/**
 * Safely extract a validated YouTube playlist ID from either a URL or raw ID.
 */
export function extractYouTubePlaylistId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (isValidYouTubePlaylistId(trimmed)) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    const isYouTubeHost =
      host === 'youtube.com' ||
      host === 'www.youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'music.youtube.com' ||
      host === 'youtu.be';
    if (!isYouTubeHost) return null;
    const listParam = parsed.searchParams.get('list')?.trim() || '';
    return isValidYouTubePlaylistId(listParam) ? listParam : null;
  } catch {
    return null;
  }
}

export function getYouTubeEmbedUrl(videoId: string): string {
  if (!isValidYouTubeVideoId(videoId)) return '';
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`;
}

export function getYouTubeWatchUrl(videoId: string, playlistId?: string): string {
  if (!isValidYouTubeVideoId(videoId)) return '';
  const base = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  if (playlistId && isValidYouTubePlaylistId(playlistId)) {
    return `${base}&list=${encodeURIComponent(playlistId)}`;
  }
  return base;
}

export function getYouTubePlaylistUrl(playlistId: string): string {
  if (!isValidYouTubePlaylistId(playlistId)) return '';
  return `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`;
}

export function getYouTubeThumbnailUrl(videoId: string): string {
  if (!isValidYouTubeVideoId(videoId)) return '';
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function parseDurationToSeconds(durationText: string): number {
  const parts = durationText
    .trim()
    .split(':')
    .map((p) => Number(p));
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return 0;
}

export function formatTotalSeriesDurationAr(videos: ReadonlyArray<VideoLessonItem>): string {
  const totalSec = videos.reduce((sum, v) => sum + (v.durationSeconds || 0), 0);
  if (totalSec <= 0) return '—';
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.round((totalSec % 3600) / 60);
  if (hours > 0 && minutes > 0) return `${hours} ساعة و ${minutes} دقيقة`;
  if (hours > 0) return `${hours} ساعة`;
  return `${minutes} دقيقة`;
}

export const BINA_AL_NAFS_SERIES: VideoSeriesDefinition = {
  id: 'bina-al-nafs-al-mutmainnah',
  playlistId: 'PLlciBs22ptiSJpZBg91Udlue8avJ7RtB5',
  playlistUrl: 'https://www.youtube.com/playlist?list=PLlciBs22ptiSJpZBg91Udlue8avJ7RtB5',
  title: 'سلسلة بناء النفس المطمئنة',
  speaker: 'م. علاء حامد',
  channelName: 'وَاللهُ مُتِمُّ نُورِهِ · Alaa Hamed',
  category: 'tazkiyah',
  categoryLabelAr: SERIES_CATEGORY_LABELS.tazkiyah,
  description:
    'سلسلة إيمانية تربوية متكاملة في تزكية النفس، وتذوق حلاوة الصلاة والذكر والدعاء والقرآن، وتحويل المعاني الإيمانية إلى سلوك عملي مطمئن.',
  isFeaturedOnDashboard: true,
  sourceType: 'curated',
  addedAt: '2026-11-22',
  videos: [
    {
      id: 'bina-nafs:ep-01',
      order: 1,
      videoId: 'HVNcSAD8xKs',
      title: 'ماذا سيحدث لك بعد الموت؟',
      description: 'مقدمة السلسلة في استحضار الدار الآخرة وأثر تذكرها في إصلاح القلب وبناء النفس المطمئنة.',
      durationText: '1:13:06',
      durationSeconds: parseDurationToSeconds('1:13:06'),
      publishedAt: '2017-10-04',
      speaker: 'م. علاء حامد',
      topic: 'الإيمان بالآخرة',
    },
    {
      id: 'bina-nafs:ep-02',
      order: 2,
      videoId: 'mLnor1Sg5OE',
      title: 'مدرسة الجنة والنار (الجزء الأول)',
      description: 'طريقة عملية في استشعار معاني الجنة والنار وتحويلها إلى سلوك يومي وتغيير حقيقي في النفس.',
      durationText: '1:15:34',
      durationSeconds: parseDurationToSeconds('1:15:34'),
      publishedAt: '2017-10-18',
      speaker: 'م. علاء حامد',
      topic: 'الترغيب والترهيب',
    },
    {
      id: 'bina-nafs:ep-03',
      order: 3,
      videoId: 'hVtOQAexmAU',
      title: 'مدرسة الجنة والنار (الجزء الثاني)',
      description: 'مواصلة بناء الإيمان ومواجهة الشهوات وتيسير الطاعات من خلال الفهم العملي للدار الآخرة.',
      durationText: '1:16:48',
      durationSeconds: parseDurationToSeconds('1:16:48'),
      publishedAt: '2017-10-25',
      speaker: 'م. علاء حامد',
      topic: 'الترغيب والترهيب',
    },
    {
      id: 'bina-nafs:ep-04',
      order: 4,
      videoId: 'GlI685S0F6I',
      title: 'استمتع بحلاوة الدعاء',
      description: 'كيف تحول الدعاء من مجرد وسيلة لنيل المطالب إلى أقوى طريقة لبناء نفس مطمئنة قريبة من الله.',
      durationText: '1:15:28',
      durationSeconds: parseDurationToSeconds('1:15:28'),
      publishedAt: '2017-11-02',
      speaker: 'م. علاء حامد',
      topic: 'عبادة الدعاء',
    },
    {
      id: 'bina-nafs:ep-05',
      order: 5,
      videoId: 'MgVhwzrlQOo',
      title: 'استمتع بحلاوة الصلاة (الجزء الأول)',
      description: 'معانٍ عملية للخشوع والفزع إلى الصلاة عند الشدائد والشعور براحتها وطمأنينتها.',
      durationText: '1:06:39',
      durationSeconds: parseDurationToSeconds('1:06:39'),
      publishedAt: '2017-11-09',
      speaker: 'م. علاء حامد',
      topic: 'الخشوع في الصلاة',
    },
    {
      id: 'bina-nafs:ep-06',
      order: 6,
      videoId: 'iFzM2ABk1YM',
      title: 'استمتع بحلاوة الصلاة (الجزء الثاني)',
      description: 'استكمال مفاتيح التلذذ بالصلاة وأثرها العملي في تزكية النفس والنهي عن الفحشاء والمنكر.',
      durationText: '1:13:58',
      durationSeconds: parseDurationToSeconds('1:13:58'),
      publishedAt: '2017-11-16',
      speaker: 'م. علاء حامد',
      topic: 'الخشوع في الصلاة',
    },
    {
      id: 'bina-nafs:ep-07',
      order: 7,
      videoId: 'PXia6ts1jSs',
      title: 'استمتع بحلاوة الذكر',
      description: 'أنواع الذكر وآدابه، وكيف يكون الذكر سبباً للطمأنينة وانشراح الصدر وتوفيق الله.',
      durationText: '1:15:16',
      durationSeconds: parseDurationToSeconds('1:15:16'),
      publishedAt: '2017-11-29',
      speaker: 'م. علاء حامد',
      topic: 'الذكر والسكينة',
    },
    {
      id: 'bina-nafs:ep-08',
      order: 8,
      videoId: 'mtF4Fq1TkPc',
      title: 'القرآن غيّر حياتي',
      description: 'أربع مراحل عملية للتعامل مع كتاب الله حتى يصبح القرآن منهج تغيير وحياة للقلب.',
      durationText: '1:14:51',
      durationSeconds: parseDurationToSeconds('1:14:51'),
      publishedAt: '2017-12-16',
      speaker: 'م. علاء حامد',
      topic: 'صحبة القرآن',
    },
    {
      id: 'bina-nafs:ep-09',
      order: 9,
      videoId: 's-rJyuLiucw',
      title: 'كيف نتذوق حلاوة القرآن؟',
      description: 'نقلة عملية في العلاقة مع القرآن الكريم وتدبر آياته واستشعار خطابه للقلب.',
      durationText: '1:17:16',
      durationSeconds: parseDurationToSeconds('1:17:16'),
      publishedAt: '2018-01-10',
      speaker: 'م. علاء حامد',
      topic: 'تدبر القرآن',
    },
    {
      id: 'bina-nafs:ep-10',
      order: 10,
      videoId: 'X2DGkjgiwOM',
      title: 'الالتزام الحقيقي',
      description: 'الطريق المختصر للوصول إلى الله والثبات في مواجهة الشهوات والفتن ببصيرة واطمئنان.',
      durationText: '1:14:53',
      durationSeconds: parseDurationToSeconds('1:14:53'),
      publishedAt: '2018-01-21',
      speaker: 'م. علاء حامد',
      topic: 'الاستقامة والثبات',
    },
    {
      id: 'bina-nafs:ep-11',
      order: 11,
      videoId: '6I2P10ufqN8',
      title: 'الإجابة عن كل أسئلتك حول القدر (استمتع بالإيمان بالقدر)',
      description: 'توضيح معنى «اعملوا فكل ميسّر لما خُلق له» وأثر الإيمان الصحيح بالقدر في طمأنينة النفس.',
      durationText: '1:23:08',
      durationSeconds: parseDurationToSeconds('1:23:08'),
      publishedAt: '2017-11-25',
      speaker: 'م. علاء حامد',
      topic: 'الإيمان بالقدر',
    },
    {
      id: 'bina-nafs:ep-12',
      order: 12,
      videoId: 'vBEp_biqx94',
      title: 'روحانيات الحج والعمرة',
      description: 'رحلة قلبية عبر مشاعر الحج والعمرة واستلهام معاني التوحيد والانقياد والتجرد لله.',
      durationText: '1:13:52',
      durationSeconds: parseDurationToSeconds('1:13:52'),
      publishedAt: '2017-08-28',
      speaker: 'م. علاء حامد',
      topic: 'روحانيات العبادات',
    },
    {
      id: 'bina-nafs:ep-13',
      order: 13,
      videoId: 'rNa9mGJQtqw',
      title: 'صلاتي غيّرت حياتي (الصلاة سر النجاح في الحياة)',
      description: 'بيان منزلة الصلاة وأثرها العملي في توازن المسلم ونجاحه وسكينته في شؤون حياته كلها.',
      durationText: '1:13:55',
      durationSeconds: parseDurationToSeconds('1:13:55'),
      publishedAt: '2018-05-05',
      speaker: 'م. علاء حامد',
      topic: 'أثر الصلاة',
    },
  ],
};

export const DEFAULT_FEATURED_SERIES_ID = BINA_AL_NAFS_SERIES.id;

/**
 * Curated multi-series registry. Append new built-in VideoSeriesDefinition items here
 * to expose additional full video series across the Home daily suggestion and Series Library.
 */
export const VIDEO_SERIES_CATALOG: VideoSeriesDefinition[] = [
  BINA_AL_NAFS_SERIES,
];

export function getAllSeriesMerged(
  customSeries: ReadonlyArray<VideoSeriesDefinition> = []
): VideoSeriesDefinition[] {
  const byId = new Map<string, VideoSeriesDefinition>();
  for (const s of VIDEO_SERIES_CATALOG) {
    byId.set(s.id, s);
  }
  for (const c of customSeries) {
    if (!byId.has(c.id)) {
      byId.set(c.id, c);
    }
  }
  return Array.from(byId.values());
}

export function getSeriesById(
  seriesId: string,
  customSeries: ReadonlyArray<VideoSeriesDefinition> = []
): VideoSeriesDefinition | undefined {
  return getAllSeriesMerged(customSeries).find((s) => s.id === seriesId);
}
