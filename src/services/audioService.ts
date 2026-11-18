import { ALL_SURAHS } from '../data/quranMeta';
import { ReciterId, ReciterInfo } from '../types/quran';
import { buildQuranAyahAudioUrl, FALLBACK_QURAN_RECITERS } from './ruqyahAudioService';

export const RECITERS: ReciterInfo[] = [
  { id: 'alafasy', name: 'الشيخ مشاري راشد العفاسي', identifier: 'Alafasy_128kbps', subfolder: 'Alafasy_128kbps' },
  { id: 'husary', name: 'الشيخ محمود خليل الحصري (مرتل)', identifier: 'Husary_128kbps', subfolder: 'Husary_128kbps' },
  { id: 'minshawi', name: 'الشيخ محمد صديق المنشاوي (مرتل)', identifier: 'Minshawy_Murattal_128kbps', subfolder: 'Minshawy_Murattal_128kbps' },
  { id: 'abdulbasit', name: 'الشيخ عبد الباسط عبد الصمد (مرتل)', identifier: 'Abdul_Basit_Murattal_192kbps', subfolder: 'Abdul_Basit_Murattal_192kbps' },
  { id: 'ghamdi', name: 'الشيخ سعد الغامدي', identifier: 'Ghamadi_40kbps', subfolder: 'Ghamadi_40kbps' },
];

export const OFFLINE_RECITER_MAP: Partial<Record<ReciterId, string>> = {
  alafasy: 'ar.alafasy',
  husary: 'ar.husary',
  minshawi: 'ar.minshawi',
  abdulbasit: 'ar.abdulbasit'
};

const OFFLINE_RECITER_ID_SET = new Set(
  Object.values(OFFLINE_RECITER_MAP).filter((id): id is string => typeof id === 'string')
);

/** Only expose offline-download editions that the Quran reader can also select for playback. */
export const OFFLINE_DOWNLOADABLE_RECITERS = FALLBACK_QURAN_RECITERS.filter(reciter =>
  OFFLINE_RECITER_ID_SET.has(reciter.id)
);

export function resolveApprovedOfflineReciterId(reciterId: ReciterId): string | null {
  return OFFLINE_RECITER_MAP[reciterId] ?? null;
}

export function computeGlobalAyahNumber(surahNumber: number, ayahNumberInSurah: number): number {
  const surah = ALL_SURAHS[surahNumber - 1];
  if (!surah || surah.number !== surahNumber ||
      !Number.isSafeInteger(ayahNumberInSurah) || ayahNumberInSurah < 1 || ayahNumberInSurah > surah.versesCount) {
    throw new Error('إحداثيات الآية غير صالحة لحساب الرقم العام في المصحف.');
  }
  let preceding = 0;
  for (let i = 0; i < surahNumber - 1; i++) {
    preceding += ALL_SURAHS[i].versesCount;
  }
  return preceding + ayahNumberInSurah;
}

export function formatAyahAudioUrl(surahNumber: number, ayahNumberInSurah: number, reciterId: ReciterId = 'alafasy'): string {
  const reciter = RECITERS.find(r => r.id === reciterId) || RECITERS[0];
  const s = String(surahNumber).padStart(3, '0');
  const a = String(ayahNumberInSurah).padStart(3, '0');
  return `https://everyayah.com/data/${reciter.subfolder}/${s}${a}.mp3`;
}

export interface LicensedAyahAudioDescriptor {
  url: string;
  approvedReciterId: string | null;
  globalAyahNumber: number;
  streamOnly: boolean;
}

/**
 * Resolve audio URL respecting WIRD's licensing boundary:
 * - Approved Al Quran Cloud editions return https://cdn.islamic.network/... (eligible for offline caching)
 * - Unlicensed/stream-only reciters (e.g. ghamdi on EveryAyah) remain stream-only online
 */
export function getLicensedAyahAudioUrl(
  surahNumber: number,
  ayahNumberInSurah: number,
  reciterId: ReciterId = 'alafasy'
): LicensedAyahAudioDescriptor {
  const globalAyahNumber = computeGlobalAyahNumber(surahNumber, ayahNumberInSurah);
  const approvedReciterId = resolveApprovedOfflineReciterId(reciterId);
  if (approvedReciterId) {
    return {
      url: buildQuranAyahAudioUrl(approvedReciterId, globalAyahNumber),
      approvedReciterId,
      globalAyahNumber,
      streamOnly: false
    };
  }
  return {
    url: formatAyahAudioUrl(surahNumber, ayahNumberInSurah, reciterId),
    approvedReciterId: null,
    globalAyahNumber,
    streamOnly: true
  };
}

export function getAyahAudioPlaybackUrl(
  surahNumber: number,
  ayahNumberInSurah: number,
  reciterOrRuqyahId: string = 'alafasy'
): LicensedAyahAudioDescriptor {
  const globalAyahNumber = computeGlobalAyahNumber(surahNumber, ayahNumberInSurah);
  if (reciterOrRuqyahId.startsWith('ar.')) {
    return {
      url: buildQuranAyahAudioUrl(reciterOrRuqyahId, globalAyahNumber),
      approvedReciterId: reciterOrRuqyahId,
      globalAyahNumber,
      streamOnly: false
    };
  }
  return getLicensedAyahAudioUrl(surahNumber, ayahNumberInSurah, reciterOrRuqyahId as ReciterId);
}

/**
 * Ask the active service worker to persist the next short recitation segment.
 * This is opportunistic: playback never waits for caching, and the worker
 * applies its own strict host/path allowlist and bounded cache policy.
 */
export function requestOfflineAudioCache(urls: string[]): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const safeUrls = urls.slice(0, 20).filter(rawUrl => {
    try {
      const url = new URL(rawUrl);
      return url.protocol === 'https:' && !url.search && !url.hash &&
        url.hostname === 'cdn.islamic.network' &&
        /^\/quran\/audio\/(64|128|192)\/(ar\.husary|ar\.minshawi|ar\.abdulbasitmurattal|ar\.abdurrahmaansudais|ar\.saoodshuraym|ar\.ahmedajamy|ar\.alafasy)\/[1-6][0-9]{0,3}\.mp3$/.test(url.pathname);
    } catch {
      return false;
    }
  });
  if (!safeUrls.length) return;
  navigator.serviceWorker.ready
    .then(registration => {
      const worker = navigator.serviceWorker.controller || registration.active || registration.waiting;
      worker?.postMessage({ type: 'WIRD_CACHE_SESSION_AUDIO', urls: safeUrls });
    })
    .catch(error => console.warn('[WIRD Audio] Offline audio pre-cache unavailable:', error));
}
