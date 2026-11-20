import { StorageService } from './storageService';

export const PRAYER_CACHE_KEY = 'wird.prayer.cache.v1';

export const KAABA_COORDINATES = {
  latitude: 21.422487,
  longitude: 39.826206,
} as const;

export type ObligatoryPrayerId = 'Fajr' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha';
export type PrayerTimingKey = ObligatoryPrayerId | 'Sunrise';

export interface PrayerTimingsMap {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
}

export interface PrayerCityPreset {
  id: string;
  nameAr: string;
  countryAr: string;
  latitude: number;
  longitude: number;
  methodId: number;
  methodNameAr: string;
  defaultTimings: PrayerTimingsMap;
}

export const PRAYER_CITY_PRESETS: readonly PrayerCityPreset[] = [
  {
    id: 'makkah',
    nameAr: 'مكة المكرمة',
    countryAr: 'المملكة العربية السعودية',
    latitude: 21.4225,
    longitude: 39.8262,
    methodId: 4,
    methodNameAr: 'تقويم أم القرى',
    defaultTimings: { Fajr: '05:05', Sunrise: '06:23', Dhuhr: '12:22', Asr: '15:44', Maghrib: '18:20', Isha: '19:50' },
  },
  {
    id: 'madinah',
    nameAr: 'المدينة المنورة',
    countryAr: 'المملكة العربية السعودية',
    latitude: 24.4672,
    longitude: 39.6112,
    methodId: 4,
    methodNameAr: 'تقويم أم القرى',
    defaultTimings: { Fajr: '05:06', Sunrise: '06:26', Dhuhr: '12:23', Asr: '15:45', Maghrib: '18:20', Isha: '19:50' },
  },
  {
    id: 'cairo',
    nameAr: 'القاهرة',
    countryAr: 'جمهورية مصر العربية',
    latitude: 30.0444,
    longitude: 31.2357,
    methodId: 5,
    methodNameAr: 'الهيئة المصرية العامة للمساحة',
    defaultTimings: { Fajr: '04:52', Sunrise: '06:21', Dhuhr: '12:04', Asr: '15:24', Maghrib: '17:48', Isha: '19:06' },
  },
  {
    id: 'riyadh',
    nameAr: 'الرياض',
    countryAr: 'المملكة العربية السعودية',
    latitude: 24.7136,
    longitude: 46.6753,
    methodId: 4,
    methodNameAr: 'تقويم أم القرى',
    defaultTimings: { Fajr: '04:38', Sunrise: '05:57', Dhuhr: '11:55', Asr: '15:16', Maghrib: '17:52', Isha: '19:22' },
  },
  {
    id: 'jerusalem',
    nameAr: 'القدس الشريف',
    countryAr: 'فلسطين',
    latitude: 31.7767,
    longitude: 35.2345,
    methodId: 3,
    methodNameAr: 'رابطة العالم الإسلامي',
    defaultTimings: { Fajr: '04:41', Sunrise: '06:07', Dhuhr: '11:48', Asr: '15:08', Maghrib: '17:30', Isha: '18:50' },
  },
  {
    id: 'dubai',
    nameAr: 'دبي',
    countryAr: 'الإمارات العربية المتحدة',
    latitude: 25.2048,
    longitude: 55.2708,
    methodId: 16,
    methodNameAr: 'دائرة الشؤون الإسلامية بدبي',
    defaultTimings: { Fajr: '05:03', Sunrise: '06:21', Dhuhr: '12:20', Asr: '15:42', Maghrib: '18:18', Isha: '19:35' },
  },
  {
    id: 'istanbul',
    nameAr: 'إسطنبول',
    countryAr: 'تركيا',
    latitude: 41.0082,
    longitude: 28.9784,
    methodId: 13,
    methodNameAr: 'رئاسة الشؤون الدينية التركية',
    defaultTimings: { Fajr: '05:38', Sunrise: '07:08', Dhuhr: '13:12', Asr: '16:30', Maghrib: '19:05', Isha: '20:29' },
  },
  {
    id: 'rabat',
    nameAr: 'الرباط',
    countryAr: 'المملكة المغربية',
    latitude: 34.0209,
    longitude: -6.8416,
    methodId: 3,
    methodNameAr: 'رابطة العالم الإسلامي',
    defaultTimings: { Fajr: '05:26', Sunrise: '06:54', Dhuhr: '12:35', Asr: '15:54', Maghrib: '18:16', Isha: '19:37' },
  },
];

export const PRAYER_LABELS_AR: Record<PrayerTimingKey, string> = {
  Fajr: 'الفجر',
  Sunrise: 'الشروق',
  Dhuhr: 'الظهر',
  Asr: 'العصر',
  Maghrib: 'المغرب',
  Isha: 'العشاء',
};

export interface DailyPrayerSchedule {
  dateIso: string; // YYYY-MM-DD
  cityId: string;
  cityNameAr: string;
  countryAr: string;
  methodNameAr: string;
  hijriDateAr: string;
  qiblaDegrees: number;
  qiblaDirectionAr: string;
  timings: PrayerTimingsMap;
  source: 'aladhan-api' | 'local-cache' | 'offline-fallback';
  fetchedAtIso: string;
}

export interface NextPrayerSummary {
  prayerId: ObligatoryPrayerId;
  labelAr: string;
  time24: string;
  remainingMinutes: number;
  remainingLabelAr: string;
}

interface PrayerCacheStore {
  schemaVersion: 1;
  selectedCityId: string;
  schedulesByKey: Record<string, DailyPrayerSchedule>;
}

const HH_MM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDegrees(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Pure mathematical Great-Circle initial bearing from (latitude, longitude) to the Holy Kaaba in Makkah.
 * Returns a normalized compass bearing in degrees [0, 360), rounded to 1 decimal place.
 */
export function computeQiblaBearingDegrees(latitude: number, longitude: number): number {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return 0;
  const dLat = Math.abs(latitude - KAABA_COORDINATES.latitude);
  const dLng = Math.abs(longitude - KAABA_COORDINATES.longitude);
  if (dLat < 0.002 && dLng < 0.002) {
    return 0;
  }

  const phi1 = toRadians(latitude);
  const phiK = toRadians(KAABA_COORDINATES.latitude);
  const deltaLambda = toRadians(KAABA_COORDINATES.longitude - longitude);

  const y = Math.sin(deltaLambda);
  const x = Math.cos(phi1) * Math.tan(phiK) - Math.sin(phi1) * Math.cos(deltaLambda);
  const rawDegrees = (toDegrees(Math.atan2(y, x)) + 360) % 360;
  return Math.round(rawDegrees * 10) / 10;
}

export function getArabicCompassDirection(degrees: number, isInsideMakkah = false): string {
  if (isInsideMakkah || degrees === 0) {
    return 'في رحاب الكعبة المشرفة (0°)';
  }
  const normalized = ((degrees % 360) + 360) % 360;
  const directions = [
    'شمال',
    'شمال شرق',
    'شرق',
    'جنوب شرق',
    'جنوب',
    'جنوب غرب',
    'غرب',
    'شمال غرب',
  ];
  const index = Math.round(normalized / 45) % 8;
  return `${directions[index]} (${normalized.toFixed(1)}°)`;
}

export function formatLocalHijriDate(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    try {
      return new Intl.DateTimeFormat('ar-SA-u-ca-islamic', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(date);
    } catch {
      return date.toISOString().slice(0, 10);
    }
  }
}

export function getPrayerCityPresetById(cityId: string): PrayerCityPreset {
  return PRAYER_CITY_PRESETS.find((c) => c.id === cityId) ?? PRAYER_CITY_PRESETS[0];
}

export function sanitizeTimingValue(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  // AlAdhan sometimes appends timezone suffix like "04:52 (EET)"; extract leading HH:MM
  const trimmed = raw.trim().slice(0, 5);
  return HH_MM_PATTERN.test(trimmed) ? trimmed : null;
}

export function parseAlAdhanResponse(
  payload: unknown,
  city: PrayerCityPreset,
  dateIso: string
): DailyPrayerSchedule | null {
  if (!payload || typeof payload !== 'object') return null;
  const root = payload as Record<string, unknown>;
  if (root.code !== 200 || !root.data || typeof root.data !== 'object') return null;

  const data = root.data as Record<string, unknown>;
  const rawTimings = data.timings as Record<string, unknown> | undefined;
  if (!rawTimings || typeof rawTimings !== 'object') return null;

  const Fajr = sanitizeTimingValue(rawTimings.Fajr);
  const Sunrise = sanitizeTimingValue(rawTimings.Sunrise);
  const Dhuhr = sanitizeTimingValue(rawTimings.Dhuhr);
  const Asr = sanitizeTimingValue(rawTimings.Asr);
  const Maghrib = sanitizeTimingValue(rawTimings.Maghrib);
  const Isha = sanitizeTimingValue(rawTimings.Isha);

  if (!Fajr || !Sunrise || !Dhuhr || !Asr || !Maghrib || !Isha) {
    return null;
  }

  let hijriDateAr = formatLocalHijriDate(new Date(`${dateIso}T12:00:00Z`));
  const dateObj = data.date as Record<string, unknown> | undefined;
  const hijriObj = dateObj?.hijri as Record<string, unknown> | undefined;
  if (hijriObj && typeof hijriObj === 'object') {
    const day = typeof hijriObj.day === 'string' ? hijriObj.day.trim() : '';
    const year = typeof hijriObj.year === 'string' ? hijriObj.year.trim() : '';
    const monthObj = hijriObj.month as Record<string, unknown> | undefined;
    const monthAr = typeof monthObj?.ar === 'string' ? monthObj.ar.trim() : '';
    const weekdayObj = hijriObj.weekday as Record<string, unknown> | undefined;
    const weekdayAr = typeof weekdayObj?.ar === 'string' ? weekdayObj.ar.trim() : '';
    if (day && monthAr && year) {
      hijriDateAr = weekdayAr ? `${weekdayAr}، ${day} ${monthAr} ${year} هـ` : `${day} ${monthAr} ${year} هـ`;
    }
  }

  const qiblaDegrees = computeQiblaBearingDegrees(city.latitude, city.longitude);
  const qiblaDirectionAr = getArabicCompassDirection(qiblaDegrees, city.id === 'makkah');

  return {
    dateIso,
    cityId: city.id,
    cityNameAr: city.nameAr,
    countryAr: city.countryAr,
    methodNameAr: city.methodNameAr,
    hijriDateAr,
    qiblaDegrees,
    qiblaDirectionAr,
    timings: { Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha },
    source: 'aladhan-api',
    fetchedAtIso: new Date().toISOString(),
  };
}

export function buildOfflineFallbackSchedule(
  city: PrayerCityPreset,
  date: Date = new Date()
): DailyPrayerSchedule {
  const dateIso = date.toISOString().slice(0, 10);
  const qiblaDegrees = computeQiblaBearingDegrees(city.latitude, city.longitude);
  return {
    dateIso,
    cityId: city.id,
    cityNameAr: city.nameAr,
    countryAr: city.countryAr,
    methodNameAr: city.methodNameAr,
    hijriDateAr: formatLocalHijriDate(date),
    qiblaDegrees,
    qiblaDirectionAr: getArabicCompassDirection(qiblaDegrees, city.id === 'makkah'),
    timings: { ...city.defaultTimings },
    source: 'offline-fallback',
    fetchedAtIso: date.toISOString(),
  };
}

function getScopedCacheKey(): string {
  return StorageService.resolveScopedKey(PRAYER_CACHE_KEY);
}

function readCacheStore(storage?: Pick<Storage, 'getItem'>): PrayerCacheStore {
  const target = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
  const fallback: PrayerCacheStore = {
    schemaVersion: 1,
    selectedCityId: 'makkah',
    schedulesByKey: {},
  };
  if (!target) return fallback;
  try {
    const raw = target.getItem(getScopedCacheKey());
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PrayerCacheStore> | null;
    if (!parsed || parsed.schemaVersion !== 1) return fallback;
    const selectedCityId =
      typeof parsed.selectedCityId === 'string' &&
      PRAYER_CITY_PRESETS.some((c) => c.id === parsed.selectedCityId)
        ? parsed.selectedCityId
        : 'makkah';
    const schedulesByKey =
      parsed.schedulesByKey && typeof parsed.schedulesByKey === 'object'
        ? parsed.schedulesByKey
        : {};
    return {
      schemaVersion: 1,
      selectedCityId,
      schedulesByKey,
    };
  } catch {
    return fallback;
  }
}

function writeCacheStore(
  store: PrayerCacheStore,
  storage?: Pick<Storage, 'setItem'>
): void {
  const target = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
  if (!target) return;
  try {
    target.setItem(getScopedCacheKey(), JSON.stringify(store));
  } catch {
    // Non-fatal when local storage quota is restricted
  }
}

export function getSelectedPrayerCityId(storage?: Pick<Storage, 'getItem'>): string {
  return readCacheStore(storage).selectedCityId;
}

export function setSelectedPrayerCityId(
  cityId: string,
  storage?: Pick<Storage, 'getItem' | 'setItem'>
): PrayerCityPreset {
  const city = getPrayerCityPresetById(cityId);
  const store = readCacheStore(storage);
  writeCacheStore({ ...store, selectedCityId: city.id }, storage);
  return city;
}

export function getNextPrayerSummary(
  timings: PrayerTimingsMap,
  now: Date = new Date()
): NextPrayerSummary {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const order: ObligatoryPrayerId[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

  const parseMinutes = (time24: string): number => {
    const [hh, mm] = time24.split(':').map(Number);
    return (hh || 0) * 60 + (mm || 0);
  };

  for (const prayerId of order) {
    const pMin = parseMinutes(timings[prayerId]);
    if (pMin > nowMinutes) {
      const diff = pMin - nowMinutes;
      return {
        prayerId,
        labelAr: PRAYER_LABELS_AR[prayerId],
        time24: timings[prayerId],
        remainingMinutes: diff,
        remainingLabelAr: formatRemainingMinutesAr(diff),
      };
    }
  }

  // After Isha -> next prayer is Fajr tomorrow
  const fajrMin = parseMinutes(timings.Fajr);
  const diff = 24 * 60 - nowMinutes + fajrMin;
  return {
    prayerId: 'Fajr',
    labelAr: PRAYER_LABELS_AR.Fajr,
    time24: timings.Fajr,
    remainingMinutes: diff,
    remainingLabelAr: formatRemainingMinutesAr(diff),
  };
}

function formatRemainingMinutesAr(totalMinutes: number): string {
  const clamped = Math.max(1, Math.round(totalMinutes));
  const hours = Math.floor(clamped / 60);
  const mins = clamped % 60;
  if (hours === 0) {
    return `بعد ${mins} دقيقة`;
  }
  if (mins === 0) {
    return hours === 1 ? 'بعد ساعة واحدة' : hours === 2 ? 'بعد ساعتين' : `بعد ${hours} ساعات`;
  }
  const hourPart = hours === 1 ? 'ساعة' : hours === 2 ? 'ساعتين' : `${hours} س`;
  return `بعد ${hourPart} و ${mins} د`;
}

export async function fetchDailyPrayerSchedule(options: {
  cityId?: string;
  date?: Date;
  fetchFn?: typeof fetch;
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
  forceRefresh?: boolean;
} = {}): Promise<DailyPrayerSchedule> {
  const store = readCacheStore(options.storage);
  const city = getPrayerCityPresetById(options.cityId ?? store.selectedCityId);
  const date = options.date ?? new Date();
  const dateIso = date.toISOString().slice(0, 10);
  const cacheKey = `${dateIso}:${city.id}`;

  if (!options.forceRefresh && store.schedulesByKey[cacheKey]) {
    return {
      ...store.schedulesByKey[cacheKey],
      source: 'local-cache',
    };
  }

  const fetchImpl =
    options.fetchFn ?? (typeof fetch === 'function' ? fetch.bind(globalThis) : undefined);

  if (fetchImpl) {
    const [yyyy, mm, dd] = dateIso.split('-');
    const aladhanDate = `${dd}-${mm}-${yyyy}`;
    const url = `https://api.aladhan.com/v1/timings/${aladhanDate}?latitude=${city.latitude}&longitude=${city.longitude}&method=${city.methodId}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    try {
      const response = await fetchImpl(url, {
        method: 'GET',
        redirect: 'error',
        credentials: 'omit',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (response.ok) {
        const json = await response.json();
        const parsed = parseAlAdhanResponse(json, city, dateIso);
        if (parsed) {
          // Prune old cache keys to at most 14 recent entries
          const recentEntries = Object.entries({
            ...store.schedulesByKey,
            [cacheKey]: parsed,
          }).slice(-14);
          writeCacheStore(
            {
              schemaVersion: 1,
              selectedCityId: city.id,
              schedulesByKey: Object.fromEntries(recentEntries),
            },
            options.storage
          );
          return parsed;
        }
      }
    } catch {
      // Fall through to cached or offline mathematical fallback
    } finally {
      clearTimeout(timer);
    }
  }

  if (store.schedulesByKey[cacheKey]) {
    return {
      ...store.schedulesByKey[cacheKey],
      source: 'local-cache',
    };
  }

  return buildOfflineFallbackSchedule(city, date);
}
