import {
  RUQYAH_ITEMS,
  RUQYAH_GUIDELINES,
  RUQYAH_PROGRAM_AUDIO,
  RUQYAH_CATEGORIES,
  AUDIO_RUQYAH_SESSIONS,
  getRuqyahItemsByCategory,
  RuqyahCategory
} from '../data/ruqyahData';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
}

export function runRuqyahIntegrityTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
      passed++;
      console.log(`  ✅ [PASS]: ${name}`);
    } catch (e: any) {
      failed++;
      console.error(`  ❌ [FAIL]: ${name} - ${e.message}`);
    }
  }

  test('Ruqyah items contain text, titles, and only valid evidence-based repetition targets', () => {
    assert(RUQYAH_ITEMS.length === 44, `Expected 44 Ruqyah items, got ${RUQYAH_ITEMS.length}`);
    assert(RUQYAH_GUIDELINES.length === 6, `Expected 6 guidelines, got ${RUQYAH_GUIDELINES.length}`);
    assert(RUQYAH_CATEGORIES.length === 9, `Expected 9 category metadata entries, got ${RUQYAH_CATEGORIES.length}`);

    RUQYAH_ITEMS.forEach(item => {
      assert(Boolean(item.id), 'Item must have id');
      assert(Boolean(item.title), `Item ${item.id} must have title`);
      assert(Boolean(item.text), `Item ${item.id} must have text`);
      assert(
        item.repeatTarget === null || (Number.isSafeInteger(item.repeatTarget) && item.repeatTarget > 0),
        `Item ${item.id} must have a positive fixed target or null when no count is established`
      );
      assert(item.categories.length > 0, `Item ${item.id} must have categories`);

      if (item.type === 'quran') {
        assert(Boolean(item.surahNumber && item.surahNumber > 0), `Quran item ${item.id} must have surahNumber`);
        assert(Boolean(item.surahName), `Quran item ${item.id} must have surahName`);
        assert(Boolean(item.verseRange), `Quran item ${item.id} must have a verse range for complete playback`);
      }
    });
  });

  test('Every published religious item uses an explicitly reviewed Sunni source reference', () => {
    const reviewedSources: Record<string, string> = {
      'g-1': 'القرآن الكريم، الشعراء 80',
      'g-3': 'صحيح البخاري 5017',
      'g-4': 'ابن باز: هل يترك العلاج ويكتفى بالتوكل على الله؟',
      'g-5': 'صحيح مسلم 2200',
      'g-6': 'صحيح البخاري 5752؛ صحيح مسلم 220',
      'g-7': 'صحيح مسلم 780',
      'q-fatihah': 'صحيح البخاري 5736',
      'q-baqarah-1-5': 'القرآن الكريم، البقرة 1-5',
      'q-baqarah-102': 'القرآن الكريم، البقرة 102',
      'q-kursi': 'صحيح البخاري 2311 (معلّق؛ وُصل عند النسائي وابن خزيمة)',
      'q-baqarah-256-257': 'القرآن الكريم، البقرة 256-257',
      'q-baqarah-last2': 'صحيح البخاري 5009؛ صحيح مسلم 808a',
      'q-ali-imran-18-19': 'القرآن الكريم، آل عمران 18-19',
      'q-araf-54-56': 'القرآن الكريم، الأعراف 54-56',
      'q-araf-magic': 'القرآن الكريم، الأعراف 117-122',
      'q-tawbah-14': 'القرآن الكريم، التوبة 14',
      'q-yunus-57': 'القرآن الكريم، يونس 57',
      'q-yunus-magic': 'القرآن الكريم، يونس 81-82',
      'q-rad-28': 'القرآن الكريم، الرعد 28',
      'q-nahl-69': 'القرآن الكريم، النحل 69',
      'q-isra-healing': 'القرآن الكريم، الإسراء 82',
      'q-ta-ha-magic': 'القرآن الكريم، طه 69',
      'q-muminun-115-118': 'القرآن الكريم، المؤمنون 115-118',
      'q-shuara-78-82': 'القرآن الكريم، الشعراء 78-82',
      'q-saffat-1-10': 'القرآن الكريم، الصافات 1-10',
      'q-fussilat-44': 'القرآن الكريم، فصلت 44',
      'q-fath-4': 'القرآن الكريم، الفتح 4',
      'q-hashr-21-24': 'القرآن الكريم، الحشر 21-24',
      'q-qalam-51-52': 'القرآن الكريم، القلم 51-52',
      'q-sharh': 'القرآن الكريم، الشرح 1-8',
      'q-kafirun': 'سنن أبي داود 5055 (صحيح، الألباني)',
      'q-ikhlas': 'صحيح البخاري 5017؛ سنن أبي داود 5082 (حسن، الألباني)',
      'q-falaq': 'صحيح البخاري 5017؛ سنن أبي داود 5082 (حسن، الألباني)',
      'q-nas': 'صحيح البخاري 5017؛ سنن أبي داود 5082 (حسن، الألباني)',
      'd-1': 'صحيح البخاري 5750',
      'd-2': 'صحيح مسلم 2186',
      'd-9': 'صحيح مسلم 2185',
      'd-3': 'صحيح البخاري 3371',
      'd-4': 'سنن أبي داود 5088 (صحيح، الألباني)؛ حصن المسلم 86',
      'd-6': 'صحيح مسلم 2202',
      'd-8': 'سنن أبي داود 3106؛ سنن الترمذي 2083 (صحيح، الألباني)',
      'd-10': 'صحيح البخاري 5745؛ صحيح مسلم 2194',
      'd-11': 'صحيح مسلم 2708 و2709؛ سنن الترمذي 3604',
      'd-12': 'سنن أبي داود 3893؛ سنن الترمذي 3528 (حسن، الألباني)',
      'd-13': 'صحيح البخاري 6346؛ صحيح مسلم 2730',
      'd-14': 'سنن أبي داود 5090 (حسن، ابن باز والألباني)',
      'd-15': 'صحيح البخاري 3616 و5656',
      'd-16': 'صحيح البخاري 6369',
      'd-17': 'القرآن الكريم، الأنبياء 87؛ سنن الترمذي 3505 (صحيح، الألباني)',
      'd-18': 'سنن أبي داود 5081 (موقوفاً على أبي الدرداء؛ صححه الأرنؤوط)'
    };
    const contentItems = [...RUQYAH_GUIDELINES, ...RUQYAH_ITEMS];
    const seenIds = new Set<string>();
    assert(
      contentItems.length === Object.keys(reviewedSources).length,
      `Every source registry entry must correspond to exactly one published content item (got ${contentItems.length} vs ${Object.keys(reviewedSources).length})`
    );
    for (const item of contentItems) {
      assert(!seenIds.has(item.id), 'Duplicate published Ruqyah content id: ' + item.id);
      seenIds.add(item.id);
      assert(
        typeof item.source === 'string' && item.source.trim().length > 0,
        item.id + ' must identify its source'
      );
      assert(
        reviewedSources[item.id] === item.source,
        item.id + ' source must exactly match its individually reviewed reference'
      );
    }
    for (const id of Object.keys(reviewedSources)) {
      assert(seenIds.has(id), 'Reviewed source registry contains an item that is not published: ' + id);
    }
  });

  test('Fixed repetition counts are limited to narrations that state a number', () => {
    const byId = new Map(RUQYAH_ITEMS.map(item => [item.id, item]));
    const fixedTargets: Record<string, number> = {
      'q-ikhlas': 3,
      'q-falaq': 3,
      'q-nas': 3,
      'd-4': 3,
      'd-6': 7,
      'd-8': 7,
      'd-11': 3,
      'd-14': 3,
      'd-18': 7
    };

    for (const item of RUQYAH_ITEMS) {
      if (item.id in fixedTargets) {
        assert(
          item.repeatTarget === fixedTargets[item.id],
          `${item.id} must retain its narrated fixed count of ${fixedTargets[item.id]}`
        );
      } else {
        assert(
          item.repeatTarget === null,
          `${item.id} must not impose an unsupported fixed count`
        );
      }
    }
    assert(!byId.has('d-7'), 'Unreviewed optional blessing guidance must not be included in the core Ruqyah corpus');
  });

  test('Ruqyah categories filter accurately across all 9 categories', () => {
    const categories: RuqyahCategory[] = [
      'brief',
      'medium',
      'full',
      'eye_envy',
      'illness',
      'magic_protection',
      'children_home',
      'anxiety_sleep',
      'guidelines'
    ];

    categories.forEach(cat => {
      const filtered = getRuqyahItemsByCategory(cat);
      assert(filtered.length > 0, `Category ${cat} must return non-empty list`);

      if (cat === 'guidelines') {
        assert(filtered.every(i => i.type === 'guideline'), 'Guidelines category must contain guidelines');
      } else {
        assert(filtered.every(i => i.categories.includes(cat)), `Category ${cat} items must include ${cat}`);
      }
    });
  });

  test('Timed Audio Ruqyah sessions have distinct durations and reference only verified Quran items', () => {
    assert(AUDIO_RUQYAH_SESSIONS.length === 5, `Expected 5 timed Audio Ruqyah sessions, got ${AUDIO_RUQYAH_SESSIONS.length}`);
    const quranIds = new Set(RUQYAH_ITEMS.filter(i => i.type === 'quran').map(i => i.id));
    const seenSessionIds = new Set<string>();
    const seenMinutes = new Set<number>();

    for (const session of AUDIO_RUQYAH_SESSIONS) {
      assert(!seenSessionIds.has(session.id), `Duplicate Audio Ruqyah session id: ${session.id}`);
      seenSessionIds.add(session.id);
      assert(!seenMinutes.has(session.estimatedMinutes), `Duplicate estimated duration in session: ${session.id}`);
      seenMinutes.add(session.estimatedMinutes);
      assert(session.tracks.length >= 6, `Session ${session.id} must contain multiple passages`);

      for (const track of session.tracks) {
        assert(quranIds.has(track.itemId), `Audio session ${session.id} references non-Quran or missing item: ${track.itemId}`);
        if (track.repeatCount !== undefined) {
          assert(Number.isSafeInteger(track.repeatCount) && track.repeatCount >= 1 && track.repeatCount <= 7, `Invalid repeatCount in ${session.id}/${track.itemId}`);
        }
      }
    }
  });

  test('Full-program audio remains disabled until its reciter and complete contents are verified', () => {
    assert(RUQYAH_PROGRAM_AUDIO.length === 3, 'The three future program slots may remain available');
    RUQYAH_PROGRAM_AUDIO.forEach(program => {
      assert(Boolean(program.id) && Boolean(program.name), 'Program metadata must be present');
      assert(program.audioUrl === '', 'No unverified third-party full-program recording may be playable');
    });
  });

  return { passed, failed };
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('ruqyahIntegrity.test')) {
  console.log('=== Running Ruqyah Integrity Tests ===');
  const res = runRuqyahIntegrityTests();
  console.log(`Passed: ${res.passed}, Failed: ${res.failed}`);
  if (res.failed > 0) process.exit(1);
}
