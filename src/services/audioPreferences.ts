import type { ReciterId } from '../types/quran';

export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;
export type PlaybackRate = typeof PLAYBACK_RATES[number];

const STORAGE_KEY = 'wird.audio.playbackRate.v1';
export const AUDIO_REPEAT_COUNTS = [1, 2, 3, 5, 10, -1] as const;
export type AudioRepeatCount = typeof AUDIO_REPEAT_COUNTS[number];
export const AYAH_SEGMENT_REPEAT_COUNTS = [1, 2, 3, 5, 10] as const;
export type AyahSegmentRepeatCount = typeof AYAH_SEGMENT_REPEAT_COUNTS[number];
const REPEAT_STORAGE_KEY = 'wird.audio.repeatCount.v1';
const SEGMENT_REPEAT_STORAGE_KEY = 'wird.audio.segmentRepeatCount.v1';
const RECITER_STORAGE_KEY = 'wird.audio.preferredReciter.v1';
const RUQYAH_RECITER_STORAGE_KEY = 'wird.audio.ruqyahReciter.v1';

export const STANDARD_RECITER_IDS: readonly ReciterId[] = [
  'alafasy',
  'husary',
  'minshawi',
  'abdulbasit',
  'sudais',
  'shuraim',
  'ajamy',
  'ghamdi'
] as const;

export const APPROVED_RUQYAH_RECITER_IDS = [
  'ar.alafasy',
  'ar.husary',
  'ar.minshawi',
  'ar.abdulbasit',
  'ar.sudais',
  'ar.shuraim',
  'ar.ajamy'
] as const;

export type ApprovedRuqyahReciterId = typeof APPROVED_RUQYAH_RECITER_IDS[number];

export interface UnifiedAudioPreferences {
  preferredReciter: ReciterId;
  ruqyahReciterId: ApprovedRuqyahReciterId;
  playbackRate: PlaybackRate;
  repeatCount: AudioRepeatCount;
  segmentRepeatCount: AudioRepeatCount;
}

const STANDARD_TO_RUQYAH_MAP: Record<ReciterId, ApprovedRuqyahReciterId> = {
  alafasy: 'ar.alafasy',
  husary: 'ar.husary',
  minshawi: 'ar.minshawi',
  abdulbasit: 'ar.abdulbasit',
  sudais: 'ar.sudais',
  shuraim: 'ar.shuraim',
  ajamy: 'ar.ajamy',
  ghamdi: 'ar.alafasy'
};

const RUQYAH_TO_STANDARD_MAP: Partial<Record<ApprovedRuqyahReciterId, ReciterId>> = {
  'ar.alafasy': 'alafasy',
  'ar.husary': 'husary',
  'ar.minshawi': 'minshawi',
  'ar.abdulbasit': 'abdulbasit',
  'ar.sudais': 'sudais',
  'ar.shuraim': 'shuraim',
  'ar.ajamy': 'ajamy'
};

let inMemoryFallback: Partial<UnifiedAudioPreferences> = {};
type AudioPreferencesListener = (prefs: UnifiedAudioPreferences) => void;
const listeners = new Set<AudioPreferencesListener>();

export function isStandardReciterId(value: unknown): value is ReciterId {
  return typeof value === 'string' && (STANDARD_RECITER_IDS as readonly string[]).includes(value);
}

export function isApprovedRuqyahReciterId(value: unknown): value is ApprovedRuqyahReciterId {
  return typeof value === 'string' && (APPROVED_RUQYAH_RECITER_IDS as readonly string[]).includes(value);
}

export function toStandardReciterId(value: unknown, fallback: ReciterId = 'alafasy'): ReciterId {
  if (isStandardReciterId(value)) return value;
  if (isApprovedRuqyahReciterId(value)) {
    return RUQYAH_TO_STANDARD_MAP[value] ?? fallback;
  }
  return fallback;
}

export function toRuqyahReciterId(
  value: unknown,
  fallback: ApprovedRuqyahReciterId = 'ar.alafasy'
): ApprovedRuqyahReciterId {
  if (isApprovedRuqyahReciterId(value)) return value;
  if (isStandardReciterId(value)) {
    return STANDARD_TO_RUQYAH_MAP[value] ?? fallback;
  }
  return fallback;
}

export function normalizeAudioRepeatCount(value: unknown): AudioRepeatCount {
  const numeric = typeof value === 'number' ? value : Number(value);
  return AUDIO_REPEAT_COUNTS.includes(numeric as AudioRepeatCount) ? numeric as AudioRepeatCount : 1;
}

export function normalizeAyahSegmentRepeatCount(value: unknown): AyahSegmentRepeatCount {
  const numeric = typeof value === 'number' ? value : Number(value);
  return AYAH_SEGMENT_REPEAT_COUNTS.includes(numeric as AyahSegmentRepeatCount)
    ? numeric as AyahSegmentRepeatCount
    : 1;
}

export function getSavedAudioRepeatCount(): AudioRepeatCount {
  try {
    if (typeof localStorage === 'undefined') return inMemoryFallback.repeatCount ?? 1;
    const raw = localStorage.getItem(REPEAT_STORAGE_KEY);
    if (raw === null) return inMemoryFallback.repeatCount ?? 1;
    return normalizeAudioRepeatCount(raw);
  } catch {
    return inMemoryFallback.repeatCount ?? 1;
  }
}

export function saveAudioRepeatCount(value: unknown): AudioRepeatCount {
  const count = normalizeAudioRepeatCount(value);
  inMemoryFallback.repeatCount = count;
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(REPEAT_STORAGE_KEY, String(count));
  } catch {
    // Keep the selected repeat count for the current session if storage is unavailable.
  }
  notifyAudioPreferencesListeners();
  return count;
}

export function getSavedSegmentRepeatCount(): AudioRepeatCount {
  try {
    if (typeof localStorage === 'undefined') return inMemoryFallback.segmentRepeatCount ?? 1;
    const raw = localStorage.getItem(SEGMENT_REPEAT_STORAGE_KEY);
    if (raw === null) return inMemoryFallback.segmentRepeatCount ?? 1;
    return normalizeAudioRepeatCount(raw);
  } catch {
    return inMemoryFallback.segmentRepeatCount ?? 1;
  }
}

export function saveSegmentRepeatCount(value: unknown): AudioRepeatCount {
  const count = normalizeAudioRepeatCount(value);
  inMemoryFallback.segmentRepeatCount = count;
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(SEGMENT_REPEAT_STORAGE_KEY, String(count));
  } catch {
    // Keep the selected segment repeat count for the current session if storage is unavailable.
  }
  notifyAudioPreferencesListeners();
  return count;
}

export function normalizePlaybackRate(value: unknown): PlaybackRate {
  const numeric = typeof value === 'number' ? value : Number(value);
  return PLAYBACK_RATES.includes(numeric as PlaybackRate) ? numeric as PlaybackRate : 1;
}

export function getSavedPlaybackRate(): PlaybackRate {
  try {
    if (typeof localStorage === 'undefined') return inMemoryFallback.playbackRate ?? 1;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return inMemoryFallback.playbackRate ?? 1;
    return normalizePlaybackRate(raw);
  } catch {
    return inMemoryFallback.playbackRate ?? 1;
  }
}

export function savePlaybackRate(value: unknown): PlaybackRate {
  const rate = normalizePlaybackRate(value);
  inMemoryFallback.playbackRate = rate;
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, String(rate));
  } catch {
    // Audio speed remains available for the current view even if storage is unavailable.
  }
  notifyAudioPreferencesListeners();
  return rate;
}

export function getSavedPreferredReciter(fallback: ReciterId = 'alafasy'): ReciterId {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(RECITER_STORAGE_KEY);
      if (raw && isStandardReciterId(raw)) return raw;
    }
  } catch {
    // Fallback below
  }
  return inMemoryFallback.preferredReciter ?? fallback;
}

export function getSavedRuqyahReciterId(
  fallback: ApprovedRuqyahReciterId = 'ar.alafasy'
): ApprovedRuqyahReciterId {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(RUQYAH_RECITER_STORAGE_KEY);
      if (raw && isApprovedRuqyahReciterId(raw)) return raw;
      const std = localStorage.getItem(RECITER_STORAGE_KEY);
      if (std && isStandardReciterId(std)) return toRuqyahReciterId(std, fallback);
    }
  } catch {
    // Fallback below
  }
  return inMemoryFallback.ruqyahReciterId ?? fallback;
}

export function getUnifiedAudioPreferences(fallbackReciter: ReciterId = 'alafasy'): UnifiedAudioPreferences {
  const preferredReciter = getSavedPreferredReciter(fallbackReciter);
  const ruqyahReciterId = getSavedRuqyahReciterId(toRuqyahReciterId(preferredReciter));
  return {
    preferredReciter,
    ruqyahReciterId,
    playbackRate: getSavedPlaybackRate(),
    repeatCount: getSavedAudioRepeatCount(),
    segmentRepeatCount: getSavedSegmentRepeatCount()
  };
}

export function savePreferredReciter(reciterId: unknown): UnifiedAudioPreferences {
  const current = getUnifiedAudioPreferences();
  const nextPreferred = isStandardReciterId(reciterId)
    ? reciterId
    : isApprovedRuqyahReciterId(reciterId)
      ? (RUQYAH_TO_STANDARD_MAP[reciterId] ?? current.preferredReciter)
      : current.preferredReciter;
  const nextRuqyah = isApprovedRuqyahReciterId(reciterId)
    ? reciterId
    : toRuqyahReciterId(nextPreferred, current.ruqyahReciterId);

  inMemoryFallback.preferredReciter = nextPreferred;
  inMemoryFallback.ruqyahReciterId = nextRuqyah;

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(RECITER_STORAGE_KEY, nextPreferred);
      localStorage.setItem(RUQYAH_RECITER_STORAGE_KEY, nextRuqyah);
    }
  } catch {
    // Preserve in-memory fallback even if storage write throws (e.g. offline/private storage quota)
  }

  const nextPrefs = getUnifiedAudioPreferences(nextPreferred);
  notifyAudioPreferencesListeners(nextPrefs);
  return nextPrefs;
}

function notifyAudioPreferencesListeners(snapshot?: UnifiedAudioPreferences): void {
  const prefs = snapshot || getUnifiedAudioPreferences();
  for (const listener of listeners) {
    try {
      listener(prefs);
    } catch {
      // Ignore individual subscriber errors
    }
  }
}

export function subscribeAudioPreferences(listener: AudioPreferencesListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

