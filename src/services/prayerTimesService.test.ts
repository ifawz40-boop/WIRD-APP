import {
  PRAYER_CITY_PRESETS,
  computeQiblaBearingDegrees,
  getArabicCompassDirection,
  sanitizeTimingValue,
  parseAlAdhanResponse,
  buildOfflineFallbackSchedule,
  getNextPrayerSummary,
  fetchDailyPrayerSchedule,
  getSelectedPrayerCityId,
  setSelectedPrayerCityId,
  getPrayerCityPresetById,
} from './prayerTimesService';
import { StorageService } from './storageService';

export async function runPrayerTimesServiceTests(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, label: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${label}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${label}`);
      failed++;
    }
  }

  // 1. Mathematical Great-Circle Qibla Bearing & Arabic Compass Direction
  const makkah = getPrayerCityPresetById('makkah');
  const cairo = getPrayerCityPresetById('cairo');
  const rabat = getPrayerCityPresetById('rabat');
  const istanbul = getPrayerCityPresetById('istanbul');

  const makkahQibla = computeQiblaBearingDegrees(makkah.latitude, makkah.longitude);
  const cairoQibla = computeQiblaBearingDegrees(cairo.latitude, cairo.longitude);
  const rabatQibla = computeQiblaBearingDegrees(rabat.latitude, rabat.longitude);
  const istanbulQibla = computeQiblaBearingDegrees(istanbul.latitude, istanbul.longitude);

  assert(
    makkahQibla === 0 &&
      getArabicCompassDirection(makkahQibla, true).includes('الكعبة') &&
      cairoQibla >= 135 &&
      cairoQibla <= 137 &&
      getArabicCompassDirection(cairoQibla).startsWith('جنوب شرق') &&
      rabatQibla >= 93 &&
      rabatQibla <= 96 &&
      getArabicCompassDirection(rabatQibla).startsWith('شرق') &&
      istanbulQibla >= 150 &&
      istanbulQibla <= 153,
    'Great-circle Qibla bearing calculation produces verified bearings for Makkah, Cairo, Rabat, and Istanbul'
  );

  // 2. AlAdhan timing sanitization and schema validation
  assert(
    sanitizeTimingValue('04:52 (EET)') === '04:52' &&
      sanitizeTimingValue('18:20 (+03)') === '18:20' &&
      sanitizeTimingValue('25:99') === null &&
      sanitizeTimingValue('<script>') === null,
    'AlAdhan timing sanitizer extracts valid 24-hour HH:MM strings and rejects malformed values'
  );

  const validAlAdhanPayload = {
    code: 200,
    data: {
      timings: {
        Fajr: '04:50 (EET)',
        Sunrise: '06:18 (EET)',
        Dhuhr: '12:03 (EET)',
        Asr: '15:23 (EET)',
        Maghrib: '17:49 (EET)',
        Isha: '19:07 (EET)',
      },
      date: {
        hijri: {
          day: '20',
          year: '1448',
          month: { ar: 'جمادى الأولى' },
          weekday: { ar: 'الجمعة' },
        },
      },
    },
  };

  const parsedCairo = parseAlAdhanResponse(validAlAdhanPayload, cairo, '2026-11-20');
  assert(
    parsedCairo !== null &&
      parsedCairo.timings.Fajr === '04:50' &&
      parsedCairo.timings.Isha === '19:07' &&
      parsedCairo.hijriDateAr === 'الجمعة، 20 جمادى الأولى 1448 هـ' &&
      parsedCairo.source === 'aladhan-api' &&
      parseAlAdhanResponse({ code: 500 }, cairo, '2026-11-20') === null,
    'parseAlAdhanResponse validates timings, formats Arabic Hijri date, and fails closed on non-200 payloads'
  );

  // 3. Next prayer countdown calculation (daytime and post-Isha wraparound)
  const noonTime = new Date(2026, 10, 20, 10, 3, 0); // 10:03 -> 120 mins before Dhuhr 12:03
  const nextAtNoon = getNextPrayerSummary(parsedCairo!.timings, noonTime);
  const lateNight = new Date(2026, 10, 20, 22, 50, 0); // 22:50 -> after Isha 19:07, next is Fajr 04:50 (360 mins)
  const nextAtNight = getNextPrayerSummary(parsedCairo!.timings, lateNight);

  assert(
    nextAtNoon.prayerId === 'Dhuhr' &&
      nextAtNoon.remainingMinutes === 120 &&
      nextAtNoon.remainingLabelAr === 'بعد ساعتين' &&
      nextAtNight.prayerId === 'Fajr' &&
      nextAtNight.remainingMinutes === 360 &&
      nextAtNight.remainingLabelAr === 'بعد 6 ساعات',
    'getNextPrayerSummary identifies upcoming daytime prayer and wraps to tomorrow Fajr after Isha'
  );

  // 4. UID-scoped daily cache, zero duplicate network fetches, and offline fallback
  const memStore = new Map<string, string>();
  const mockStorage: Pick<Storage, 'getItem' | 'setItem'> = {
    getItem: (k: string) => (memStore.has(k) ? memStore.get(k)! : null),
    setItem: (k: string, v: string) => {
      memStore.set(k, String(v));
    },
  };

  try {
    StorageService.setStorageScope('user:prayer_alpha', 'keep-guest');
    setSelectedPrayerCityId('cairo', mockStorage);

    let fetchCount = 0;
    const mockFetch: typeof fetch = async () => {
      fetchCount++;
      return new Response(JSON.stringify(validAlAdhanPayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const fixedDate = new Date('2026-11-20T09:00:00Z');
    const firstFetch = await fetchDailyPrayerSchedule({
      cityId: 'cairo',
      date: fixedDate,
      fetchFn: mockFetch,
      storage: mockStorage,
    });
    const secondFetch = await fetchDailyPrayerSchedule({
      cityId: 'cairo',
      date: fixedDate,
      fetchFn: mockFetch,
      storage: mockStorage,
    });

    assert(
      fetchCount === 1 &&
        firstFetch.source === 'aladhan-api' &&
        secondFetch.source === 'local-cache' &&
        secondFetch.timings.Maghrib === '17:49',
      'fetchDailyPrayerSchedule caches validated daily schedule per city and avoids redundant network calls'
    );

    // Offline failure fallback for an uncached city
    const failingFetch: typeof fetch = async () => {
      throw new Error('Offline network error');
    };
    const offlineSchedule = await fetchDailyPrayerSchedule({
      cityId: 'madinah',
      date: fixedDate,
      fetchFn: failingFetch,
      storage: mockStorage,
    });

    StorageService.setStorageScope('user:prayer_beta', 'keep-guest');
    const betaCityId = getSelectedPrayerCityId(mockStorage);

    assert(
      offlineSchedule.source === 'offline-fallback' &&
        offlineSchedule.cityId === 'madinah' &&
        offlineSchedule.qiblaDegrees > 170 &&
        betaCityId === 'makkah' &&
        PRAYER_CITY_PRESETS.length === 8 &&
        buildOfflineFallbackSchedule(makkah, fixedDate).source === 'offline-fallback',
      'Offline fallback provides mathematical Qibla + local Hijri date and isolates city preferences per UID'
    );
  } finally {
    StorageService.setStorageScope('legacy');
  }

  return { passed, failed };
}
