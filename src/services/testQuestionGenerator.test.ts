import { generateDynamicTestQuestions, type QuranDataAccess } from './testQuestionGenerator';
import { isValidDomainEvent } from './domainEvents';
import { StorageService } from './storageService';
import type { Ayah, WeakVerseItem, WirdPortion } from '../types/quran';

const CANONICAL_VERSES: Record<number, Ayah[]> = {
  1: [
    { number: 1, numberInSurah: 1, surahNumber: 1, text: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ', juz: 1, page: 1 },
    { number: 2, numberInSurah: 2, surahNumber: 1, text: 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ', juz: 1, page: 1 },
    { number: 3, numberInSurah: 3, surahNumber: 1, text: 'ٱلرَّحْمَٰنِ ٱلرَّحِيمِ', juz: 1, page: 1 },
    { number: 4, numberInSurah: 4, surahNumber: 1, text: 'مَٰلِكِ يَوْمِ ٱلدِّينِ', juz: 1, page: 1 },
    { number: 5, numberInSurah: 5, surahNumber: 1, text: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ', juz: 1, page: 1 },
    { number: 6, numberInSurah: 6, surahNumber: 1, text: 'ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ', juz: 1, page: 1 },
    { number: 7, numberInSurah: 7, surahNumber: 1, text: 'صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ', juz: 1, page: 1 }
  ],
  112: [
    { number: 6222, numberInSurah: 1, surahNumber: 112, text: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ', juz: 30, page: 604 },
    { number: 6223, numberInSurah: 2, surahNumber: 112, text: 'ٱللَّهُ ٱلصَّمَدُ', juz: 30, page: 604 },
    { number: 6224, numberInSurah: 3, surahNumber: 112, text: 'لَمْ يَلِدْ وَلَمْ يُولَدْ', juz: 30, page: 604 },
    { number: 6225, numberInSurah: 4, surahNumber: 112, text: 'وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌ', juz: 30, page: 604 }
  ]
};

const mockQuranAccess: QuranDataAccess = {
  async loadSurahVerses(surahNumber) {
    return CANONICAL_VERSES[surahNumber] || [];
  },
  async loadAyahByCoordinate(surahNumber, ayahNumber) {
    return (CANONICAL_VERSES[surahNumber] || []).find(a => a.numberInSurah === ayahNumber);
  }
};

function makePortion(
  surahNumber: number,
  surahName: string,
  startAyah: number,
  endAyah: number,
  status: WirdPortion['status'] = 'stable',
  mistakesCount = 0
): WirdPortion {
  return {
    id: `s${surahNumber}_a${startAyah}_a${endAyah}`,
    surahNumber,
    surahName,
    startAyah,
    endAyah,
    status,
    nextDueDate: '2026-11-17',
    intervalDays: 3,
    easeFactor: 2.5,
    repetitionCount: 1,
    mistakesCount
  };
}

export async function runTestQuestionGeneratorTests(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;

  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error(msg);
  };

  const test = async (name: string, fn: () => Promise<void> | void) => {
    try {
      await fn();
      passed++;
      console.log(`  ✅ ${name}`);
    } catch (error: any) {
      failed++;
      console.error(`  ❌ ${name}: ${error?.message || error}`);
    }
  };

  await test('fill_blank_words generates canonical target text, valid blankSpec, and distinct options', async () => {
    const portions = [makePortion(1, 'الفاتحة', 1, 7)];
    const res = await generateDynamicTestQuestions('fill_blank_words', portions, 4, mockQuranAccess);
    assert(res.questions.length > 0, 'Expected fill_blank_words questions for Al-Fatiha');
    for (const q of res.questions) {
      assert(q.surahNumber === 1, 'Question must originate strictly from memorized portion');
      assert(q.isFromMemorizedPortion === true, 'isFromMemorizedPortion must be true');
      assert(Boolean(q.blankSpec && q.blankSpec.wordCount >= 1 && q.blankSpec.startWord >= 0),
        'blankSpec must identify a valid missing word span');
      assert(Boolean(q.targetAyahCanonicalText && q.targetAyahCanonicalText.length > 0),
        'targetAyahCanonicalText must contain the full canonical ayah text');
      assert(q.options.length >= 2 && q.correctIndex >= 0 && q.correctIndex < q.options.length,
        'Question must provide multiple choices and valid correctIndex');
      assert(new Set(q.options).size === q.options.length, 'Options must all be distinct');
    }
  });

  await test('surah scope strictly filters questions and explains honestly when target surah is unmemorized', async () => {
    const portions = [
      makePortion(1, 'الفاتحة', 1, 7),
      makePortion(112, 'الإخلاص', 1, 4)
    ];

    const filteredRes = await generateDynamicTestQuestions('fill_blank_words', portions, 3, mockQuranAccess, {
      scope: 'surah',
      surahNumber: 112
    });
    assert(filteredRes.questions.length > 0, 'Expected questions for memorized Surah 112');
    assert(filteredRes.questions.every(q => q.surahNumber === 112), 'All questions must belong to Surah 112');

    const emptyRes = await generateDynamicTestQuestions('complete_verse', portions, 3, mockQuranAccess, {
      scope: 'surah',
      surahNumber: 67
    });
    assert(emptyRes.questions.length === 0 && emptyRes.hasSufficientData === false && Boolean(emptyRes.messageAr),
      'Unmemorized surah scope must return 0 questions with honest Arabic message');
  });

  await test('weak_priority scope prioritizes weak verses/portions and reports honestly when none are weak', async () => {
    const stableOnly = [makePortion(1, 'الفاتحة', 1, 7, 'stable', 0)];
    const noWeak = await generateDynamicTestQuestions('fill_blank_words', stableOnly, 3, mockQuranAccess, {
      scope: 'weak_priority',
      weakVerses: []
    });
    assert(noWeak.questions.length === 0 && Boolean(noWeak.messageAr),
      'weak_priority without weak portions/verses must return 0 questions with clear Arabic guidance');

    const weakVerses: WeakVerseItem[] = [
      { id: 'w1', surahNumber: 112, surahName: 'الإخلاص', ayahNumber: 3, text: 'لَمْ يَلِدْ وَلَمْ يُولَدْ', mistakeCount: 2, lastFailedDate: '2026-11-16' }
    ];
    const mixedPortions = [
      makePortion(1, 'الفاتحة', 1, 7, 'stable', 0),
      makePortion(112, 'الإخلاص', 1, 4, 'needs_revision', 2)
    ];
    const weakRes = await generateDynamicTestQuestions('fill_blank_words', mixedPortions, 3, mockQuranAccess, {
      scope: 'weak_priority',
      weakVerses
    });
    assert(weakRes.questions.length > 0 && weakRes.questions.every(q => q.surahNumber === 112),
      'weak_priority must select questions exclusively from the weak/needs_revision Surah');
  });

  await test('domainEvents and StorageService accept fill_blank_words test results', () => {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('guest');
    const eventOk = isValidDomainEvent({
      schemaVersion: 1,
      id: 'evt-fill-blank-1',
      type: 'test.completed',
      occurredAt: '2026-11-17T10:00:00Z',
      payload: {
        testResultId: 'test-fb-1',
        surahName: 'سورة الفاتحة',
        testType: 'fill_blank_words',
        score: 4,
        totalQuestions: 5
      }
    }, 'evt-fill-blank-1');
    assert(eventOk, 'test.completed domain event must validate fill_blank_words');

    const saved = StorageService.saveTest({
      id: 'test-fb-1',
      date: '2026-11-17',
      type: 'fill_blank_words',
      surahName: 'سورة الفاتحة',
      score: 4,
      totalQuestions: 5,
      weakVerses: []
    });
    assert(saved === true && StorageService.getTests()[0]?.type === 'fill_blank_words',
      'StorageService.saveTest must accept and persist fill_blank_words');
  });

  return { passed, failed };
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('testQuestionGenerator.test')) {
  runTestQuestionGeneratorTests().then(res => {
    console.log(`Test Question Generator Tests: ${res.passed} passed, ${res.failed} failed`);
    if (res.failed > 0) process.exit(1);
  });
}
