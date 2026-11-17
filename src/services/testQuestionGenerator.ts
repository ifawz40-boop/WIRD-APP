import { Ayah, WeakVerseItem, WirdPortion } from '../types/quran';

export interface QuranDataAccess {
  loadAyahByCoordinate: (surahNumber: number, ayahNumber: number) => Promise<Ayah | undefined>;
  loadSurahVerses: (surahNumber: number) => Promise<Ayah[]>;
}
import { ALL_SURAHS } from '../data/quranMeta';
import { MUTASHABIHAT_DATA } from '../data/mutashabihatData';

export type TestMode =
  | 'complete_verse'
  | 'bidirectional_recall'
  | 'random_recall'
  | 'mutashabihat'
  | 'fill_blank_words';

export type TestScope = 'all' | 'surah' | 'weak_priority';

export interface TestGenerationOptions {
  scope?: TestScope;
  surahNumber?: number;
  weakVerses?: WeakVerseItem[];
}

export interface BlankWordSpec {
  ayahNumber: number;
  startWord: number;
  wordCount: number;
}

export interface OptionWordSpanSpec {
  surahNumber: number;
  ayahNumber: number;
  startWord: number;
  wordCount: number;
}

export interface GeneratedQuestion {
  surahName: string;
  surahNumber: number;
  prompt: string;
  options: string[];
  correctIndex: number;
  targetAyahNumber: number;
  promptAyahNumber?: number;
  promptCanonicalText?: string;
  optionAyahCoordinates?: Array<{ surahNumber: number; ayahNumber: number }>;
  blankSpec?: BlankWordSpec;
  optionWordSpans?: OptionWordSpanSpec[];
  targetAyahCanonicalText?: string;
  distinctionRule?: string;
  isFromMemorizedPortion: boolean;
}

export interface QuestionGenerationResult {
  questions: GeneratedQuestion[];
  hasSufficientData: boolean;
  memorizedPortionsCount: number;
  isCuratedMutashabihat?: boolean;
  messageAr?: string;
}

// Fisher-Yates shuffle
function shuffleArray<T>(array: T[]): { shuffled: T[]; originalIndexMap: number[] } {
  const items = [...array];
  const originalIndices = items.map((_, i) => i);

  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
    [originalIndices[i], originalIndices[j]] = [originalIndices[j], originalIndices[i]];
  }

  return { shuffled: items, originalIndexMap: originalIndices };
}

function stripArabicDiacritics(word: string): string {
  return word.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u06DE\u06E9\s]/g, '');
}

function filterAndOrderPortions(
  memorized: WirdPortion[],
  options?: TestGenerationOptions
): { filtered: WirdPortion[]; emptyReasonAr?: string } {
  const scope: TestScope = options?.scope || 'all';
  if (scope === 'surah') {
    const targetSurah = options?.surahNumber;
    const surahPortions = typeof targetSurah === 'number'
      ? memorized.filter(p => p.surahNumber === targetSurah)
      : [];
    if (surahPortions.length === 0) {
      const meta = ALL_SURAHS.find(s => s.number === targetSurah);
      return {
        filtered: [],
        emptyReasonAr: meta
          ? `لا توجد مقاطع محفوظة مسجلة حالياً في سورة ${meta.name}. سجّل حفظاً فيها أو غيّر نطاق الاختبار إلى «كل المحفوظ».`
          : 'اختر سورة تحتوي على مقاطع محفوظة لإعداد الاختبار.'
      };
    }
    return { filtered: surahPortions };
  }

  if (scope === 'weak_priority') {
    const weakSet = new Set(
      (options?.weakVerses || []).map(w => `${w.surahNumber}:${w.ayahNumber}`)
    );
    const weakOrNeedsRevision = memorized.filter(p => {
      if (p.status === 'weak' || p.status === 'needs_revision' || (p.mistakesCount ?? 0) > 0) return true;
      for (let a = p.startAyah; a <= p.endAyah; a++) {
        if (weakSet.has(`${p.surahNumber}:${a}`)) return true;
      }
      return false;
    });
    if (weakOrNeedsRevision.length === 0) {
      return {
        filtered: [],
        emptyReasonAr: 'لا توجد آيات متعثرة أو مقاطع بحاجة إلى تثبيت عاجل حالياً. يمكنك اختيار «كل المحفوظ» للاختبار العام.'
      };
    }
    return { filtered: weakOrNeedsRevision };
  }

  return { filtered: memorized };
}

/**
 * Generate truthful, verified dynamic test questions.
 * Rules (Phase 3.1):
 * 1. Zero fallback questions from unmemorized or unrelated Surahs.
 * 2. Questions originate strictly from the user's eligible memorized portions.
 * 3. Partial question sets (< 5) are returned honestly with hasSufficientData: false.
 * 4. Empty memorized state returns zero questions with guidance to record memorization.
 * 5. Curated Mutashabihat is kept distinct and clearly designated.
 */
export async function generateDynamicTestQuestions(
  testType: TestMode,
  portions: WirdPortion[] = [],
  targetCount: number = 5,
  dataAccess?: QuranDataAccess,
  options?: TestGenerationOptions
): Promise<QuestionGenerationResult> {
  const safePortions = Array.isArray(portions) ? portions : [];

  // Filter active memorized portions
  const allMemorized = safePortions.filter(
    p => p.status === 'stable' || p.status === 'recently_memorized' || p.status === 'needs_revision' || p.status === 'weak'
  );

  const scopeResolution = filterAndOrderPortions(allMemorized, options);
  const memorized = scopeResolution.filtered;

  // 1. Curated Mutashabihat Test Mode (Thematic comparative Quranic questions)
  if (testType === 'mutashabihat') {
    const memorizedSurahNumbers = new Set(allMemorized.map(p => p.surahNumber));
    const scope = options?.scope || 'all';
    const baseItems = scope === 'surah' && typeof options?.surahNumber === 'number'
      ? MUTASHABIHAT_DATA.filter(
          item => item.surah1.surahNumber === options.surahNumber || item.surah2.surahNumber === options.surahNumber
        )
      : MUTASHABIHAT_DATA;

    if (baseItems.length === 0) {
      return {
        questions: [],
        hasSufficientData: false,
        memorizedPortionsCount: memorized.length,
        isCuratedMutashabihat: true,
        messageAr: 'لا تتوفر حالياً متشابهات منسّقة للسورة المختارة؛ غيّر النطاق إلى «كل المحفوظ» لاستعراض المتشابهات.'
      };
    }

    const prioritized = [...baseItems].sort((a, b) => {
      const aHas = memorizedSurahNumbers.has(a.surah1.surahNumber) || memorizedSurahNumbers.has(a.surah2.surahNumber);
      const bHas = memorizedSurahNumbers.has(b.surah1.surahNumber) || memorizedSurahNumbers.has(b.surah2.surahNumber);
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;
      return 0;
    });

    const selectedItems = prioritized.slice(0, targetCount);
    const questions: GeneratedQuestion[] = selectedItems.map(item => {
      const rawOptions = [item.surah1.text, item.surah2.text];
      const rawOptionAyahCoordinates = [
        { surahNumber: item.surah1.surahNumber, ayahNumber: item.surah1.ayahNumber },
        { surahNumber: item.surah2.surahNumber, ayahNumber: item.surah2.ayahNumber }
      ];
      const { shuffled, originalIndexMap } = shuffleArray(rawOptions);
      const correctIndex = originalIndexMap.indexOf(0);

      return {
        surahName: item.surah1.name,
        surahNumber: item.surah1.surahNumber,
        prompt: `في سورة ${item.surah1.name} (الآية ${item.surah1.ayahNumber}): كيف وردت صياغة الآية الكريمة وضبط المتشابه بدقة؟`,
        options: shuffled,
        correctIndex,
        optionAyahCoordinates: originalIndexMap.map(index => rawOptionAyahCoordinates[index]),
        distinctionRule: item.distinctionRule,
        targetAyahNumber: item.surah1.ayahNumber,
        targetAyahCanonicalText: item.surah1.text,
        isFromMemorizedPortion: memorizedSurahNumbers.has(item.surah1.surahNumber)
      };
    });

    return {
      questions,
      hasSufficientData: questions.length >= targetCount,
      memorizedPortionsCount: memorized.length,
      isCuratedMutashabihat: true,
      messageAr: questions.length < targetCount
        ? `نماذج المتشابهات المتاحة حالياً: ${questions.length} أسئلة.`
        : undefined
    };
  }

  // 2. Memorization-Based Tests: If user has zero matching memorized portions, never simulate or pull unmemorized Surahs
  if (memorized.length === 0) {
    return {
      questions: [],
      hasSufficientData: false,
      memorizedPortionsCount: 0,
      messageAr: scopeResolution.emptyReasonAr ||
        'لم تسجل أي مقاطع محفوظة بعد. يرجى إتمام وِرد حفظ أو تسجيل مقاطع محفوظة أولاً للبدء في الاختبارات المبنية على محفوظك.'
    };
  }

  // Vite's per-Surah loader is imported only when a memorization-backed mode actually needs Quran data.
  // This keeps module evaluation safe in Node-based integrity tests and avoids loading Quran chunks early.
  const { loadAyahByCoordinate, loadSurahVerses } = dataAccess ?? await import('../data/quranDataLoader');

  switch (testType) {
    case 'complete_verse': {
      const questions: GeneratedQuestion[] = [];
      const eligiblePortions = [...memorized].sort(() => 0.5 - Math.random());

      for (const p of eligiblePortions) {
        if (questions.length >= targetCount) break;
        const surahVerses = await loadSurahVerses(p.surahNumber);
        if (!surahVerses || surahVerses.length < 2) continue;

        // Candidate Ayahs where next Ayah exists within the memorized portion
        const minAyah = p.startAyah;
        const maxAyah = Math.min(p.endAyah - 1, surahVerses.length - 1);
        if (minAyah > maxAyah) continue;

        // Gather all eligible transitions in this portion
        const eligibleTargetNs: number[] = [];
        for (let n = minAyah; n <= maxAyah; n++) {
          eligibleTargetNs.push(n);
        }
        eligibleTargetNs.sort(() => 0.5 - Math.random());

        for (const targetN of eligibleTargetNs) {
          if (questions.length >= targetCount) break;

          const currentAyah = await loadAyahByCoordinate(p.surahNumber, targetN);
          const nextAyah = await loadAyahByCoordinate(p.surahNumber, targetN + 1);
          if (!currentAyah || !nextAyah) continue;

          // Avoid duplicate question prompts
          if (questions.some(q => q.surahNumber === p.surahNumber && q.targetAyahNumber === nextAyah.numberInSurah)) {
            continue;
          }

          // 3 verified distractors from the same Surah or other verified verses
          const candidates = surahVerses.filter(a => a.numberInSurah !== targetN + 1 && a.numberInSurah !== targetN);
          const shuffledCandidates = candidates.sort(() => 0.5 - Math.random());
          const distractorAyahs = shuffledCandidates.slice(0, 3);

          // If not enough in same Surah, pull from adjacent verified Surah
          if (distractorAyahs.length < 3) {
            const otherSurah = await loadSurahVerses(p.surahNumber === 114 ? 113 : p.surahNumber + 1);
            for (const o of (Array.isArray(otherSurah) ? otherSurah : [])) {
              if (distractorAyahs.length >= 3) break;
              if (!distractorAyahs.some(ayah => ayah.text === o.text) && o.text !== nextAyah.text) {
                distractorAyahs.push(o);
              }
            }
          }

          if (distractorAyahs.length < 3) continue;

          const optionAyahs = [nextAyah, ...distractorAyahs];
          const rawOptions = optionAyahs.map(ayah => ayah.text);
          const { shuffled, originalIndexMap } = shuffleArray(rawOptions);
          const correctIndex = originalIndexMap.indexOf(0);

          questions.push({
            surahName: p.surahName,
            surahNumber: p.surahNumber,
            prompt: `في سورة ${p.surahName}: قال تعالى: «${currentAyah.text}» [الآية ${currentAyah.numberInSurah}] — ما هي الآية التي تليها مباشرة؟`,
            options: shuffled,
            correctIndex,
            targetAyahNumber: nextAyah.numberInSurah,
            promptAyahNumber: currentAyah.numberInSurah,
            promptCanonicalText: currentAyah.text,
            optionAyahCoordinates: originalIndexMap.map(index => ({ surahNumber: optionAyahs[index].surahNumber, ayahNumber: optionAyahs[index].numberInSurah })),
            targetAyahCanonicalText: nextAyah.text,
            isFromMemorizedPortion: true
          });
        }
      }

      const hasSufficient = questions.length >= targetCount;
      const messageAr = !hasSufficient
        ? (questions.length === 0
            ? 'المقاطع المحفوظة الحالية قصيرة جداً لإنشاء أسئلة إكمال الآية (تحتاج مقطعاً من آيتين متتاليتين على الأقل).'
            : `المحتوى القرآني المحفوظ حالياً يكفي لإنشاء ${questions.length} أسئلة فقط. تم إعدادها حصرياً من محفوظك الفعلي.`)
        : undefined;

      return {
        questions,
        hasSufficientData: hasSufficient,
        memorizedPortionsCount: memorized.length,
        messageAr
      };
    }

    case 'bidirectional_recall': {
      const questions: GeneratedQuestion[] = [];
      const eligiblePortions = [...memorized].sort(() => 0.5 - Math.random());

      for (const p of eligiblePortions) {
        if (questions.length >= targetCount) break;
        const surahVerses = await loadSurahVerses(p.surahNumber);
        if (!surahVerses || surahVerses.length < 2) continue;

        // Try bidirectional combinations within portion
        for (let targetN = p.startAyah; targetN <= p.endAyah; targetN++) {
          if (questions.length >= targetCount) break;

          const canGoPrev = targetN > p.startAyah;
          const canGoNext = targetN < p.endAyah && targetN < surahVerses.length;
          if (!canGoPrev && !canGoNext) continue;

          const isPrevious = canGoPrev && (!canGoNext || Math.random() > 0.5);
          const expectedAyahNum = isPrevious ? targetN - 1 : targetN + 1;
          const promptDirection = isPrevious ? `⟵ ما هي الآية السابقة لها مباشرة؟` : `⟶ ما هي الآية التالية لها مباشرة؟`;

          const centerAyah = await loadAyahByCoordinate(p.surahNumber, targetN);
          const answerAyah = await loadAyahByCoordinate(p.surahNumber, expectedAyahNum);
          if (!centerAyah || !answerAyah) continue;

          if (questions.some(q => q.surahNumber === p.surahNumber && q.targetAyahNumber === expectedAyahNum)) {
            continue;
          }

          const candidates = surahVerses.filter(a => a.numberInSurah !== expectedAyahNum && a.numberInSurah !== targetN);
          const shuffledCandidates = candidates.sort(() => 0.5 - Math.random());
          const distractorAyahs = shuffledCandidates.slice(0, 3);

          if (distractorAyahs.length < 3) {
            const otherSurah = await loadSurahVerses(p.surahNumber === 114 ? 113 : p.surahNumber + 1);
            for (const o of otherSurah) {
              if (distractorAyahs.length >= 3) break;
              if (!distractorAyahs.some(ayah => ayah.text === o.text) && o.text !== answerAyah.text) {
                distractorAyahs.push(o);
              }
            }
          }

          if (distractorAyahs.length < 3) continue;

          const optionAyahs = [answerAyah, ...distractorAyahs];
          const rawOptions = optionAyahs.map(ayah => ayah.text);
          const { shuffled, originalIndexMap } = shuffleArray(rawOptions);
          const correctIndex = originalIndexMap.indexOf(0);

          questions.push({
            surahName: p.surahName,
            surahNumber: p.surahNumber,
            prompt: `في سورة ${p.surahName}: قال تعالى: «${centerAyah.text}» [الآية ${centerAyah.numberInSurah}] ${promptDirection}`,
            options: shuffled,
            correctIndex,
            targetAyahNumber: expectedAyahNum,
            promptAyahNumber: centerAyah.numberInSurah,
            promptCanonicalText: centerAyah.text,
            optionAyahCoordinates: originalIndexMap.map(index => ({ surahNumber: optionAyahs[index].surahNumber, ayahNumber: optionAyahs[index].numberInSurah })),
            targetAyahCanonicalText: answerAyah.text,
            isFromMemorizedPortion: true
          });
        }
      }

      const hasSufficient = questions.length >= targetCount;
      const messageAr = !hasSufficient
        ? (questions.length === 0
            ? 'المقاطع المحفوظة الحالية قصيرة جداً لاختبار الاسترجاع العكسي.'
            : `المحتوى القرآني المحفوظ حالياً يكفي لإنشاء ${questions.length} أسئلة فقط. تم إعدادها حصرياً من محفوظك الفعلي.`)
        : undefined;

      return {
        questions,
        hasSufficientData: hasSufficient,
        memorizedPortionsCount: memorized.length,
        messageAr
      };
    }

    case 'random_recall': {
      const questions: GeneratedQuestion[] = [];
      const eligiblePortions = [...memorized].sort(() => 0.5 - Math.random());

      for (const p of eligiblePortions) {
        if (questions.length >= targetCount) break;

        // Sample Ayahs directly from the memorized portion
        for (let targetN = p.startAyah; targetN <= p.endAyah; targetN++) {
          if (questions.length >= targetCount) break;

          const ayah = await loadAyahByCoordinate(p.surahNumber, targetN);
          if (!ayah) continue;

          if (questions.some(q => q.surahNumber === p.surahNumber && q.targetAyahNumber === ayah.numberInSurah)) {
            continue;
          }

          // Choose 3 distractor surahs
          const otherSurahs = ALL_SURAHS.filter(s => s.number !== p.surahNumber);
          const shuffledSurahs = otherSurahs.sort(() => 0.5 - Math.random()).slice(0, 3);

          const correctLabel = `سورة ${p.surahName} (الآية ${ayah.numberInSurah})`;
          const distractorLabels = shuffledSurahs.map(s => `سورة ${s.name} (الآية ${Math.min(ayah.numberInSurah, s.versesCount)})`);

          const rawOptions = [correctLabel, ...distractorLabels];
          const { shuffled, originalIndexMap } = shuffleArray(rawOptions);
          const correctIndex = originalIndexMap.indexOf(0);

          questions.push({
            surahName: p.surahName,
            surahNumber: p.surahNumber,
            prompt: `من محفوظك الفعلي: أين ورد قوله تعالى: «${ayah.text}»؟`,
            options: shuffled,
            correctIndex,
            targetAyahNumber: ayah.numberInSurah,
            promptAyahNumber: ayah.numberInSurah,
            promptCanonicalText: ayah.text,
            targetAyahCanonicalText: ayah.text,
            isFromMemorizedPortion: true
          });
        }
      }

      const hasSufficient = questions.length >= targetCount;
      const messageAr = !hasSufficient
        ? (questions.length === 0
            ? 'لا توجد آيات مؤهلة كافية في محفوظك الحالي.'
            : `المحتوى القرآني المحفوظ حالياً يكفي لإنشاء ${questions.length} أسئلة فقط. تم إعدادها حصرياً من محفوظك الفعلي.`)
        : undefined;

      return {
        questions,
        hasSufficientData: hasSufficient,
        memorizedPortionsCount: memorized.length,
        messageAr
      };
    }

    case 'fill_blank_words': {
      const questions: GeneratedQuestion[] = [];
      const eligiblePortions = [...memorized].sort(() => 0.5 - Math.random());

      for (const p of eligiblePortions) {
        if (questions.length >= targetCount) break;
        const surahVerses = await loadSurahVerses(p.surahNumber);
        if (!surahVerses || surahVerses.length === 0) continue;

        const candidateAyahs = surahVerses
          .filter(a => a.numberInSurah >= p.startAyah && a.numberInSurah <= p.endAyah)
          .sort(() => 0.5 - Math.random());

        for (const ayah of candidateAyahs) {
          if (questions.length >= targetCount) break;
          if (questions.some(q => q.surahNumber === p.surahNumber && q.targetAyahNumber === ayah.numberInSurah)) {
            continue;
          }

          const words = ayah.text.trim().split(/\s+/).filter(Boolean);
          if (words.length < 4) continue;

          const wordCount = words.length >= 7 ? 2 : 1;
          const maxStart = words.length - wordCount;
          const meaningfulStarts: number[] = [];
          const fallbackStarts: number[] = [];

          for (let start = 0; start <= maxStart; start++) {
            const slice = words.slice(start, start + wordCount);
            if (slice.every(w => stripArabicDiacritics(w).length >= 3)) {
              if (start > 0) meaningfulStarts.push(start);
              else fallbackStarts.push(start);
            } else if (slice.every(w => stripArabicDiacritics(w).length >= 2)) {
              fallbackStarts.push(start);
            }
          }

          const startCandidates = meaningfulStarts.length > 0 ? meaningfulStarts : fallbackStarts;
          if (startCandidates.length === 0) continue;
          const startWord = startCandidates[Math.floor(Math.random() * startCandidates.length)];

          const correctWords = words.slice(startWord, startWord + wordCount);
          const correctPhrase = correctWords.join(' ');
          const correctNorm = stripArabicDiacritics(correctPhrase);
          if (!correctNorm) continue;

          const blankedText = [
            ...words.slice(0, startWord),
            '«......»',
            ...words.slice(startWord + wordCount)
          ].join(' ');

          const distractors: Array<{ text: string; span: OptionWordSpanSpec }> = [];
          const usedNormalized = new Set<string>([correctNorm]);

          const collectFromPool = (pool: Ayah[]) => {
            const shuffledPool = [...pool].sort(() => 0.5 - Math.random());
            for (const cand of shuffledPool) {
              if (distractors.length >= 3) break;
              if (cand.surahNumber === p.surahNumber && cand.numberInSurah === ayah.numberInSurah) continue;
              const candWords = cand.text.trim().split(/\s+/).filter(Boolean);
              if (candWords.length < wordCount) continue;

              const candMaxStart = candWords.length - wordCount;
              const offsets = Array.from({ length: candMaxStart + 1 }, (_, i) => i).sort(() => 0.5 - Math.random());
              for (const candStart of offsets) {
                if (distractors.length >= 3) break;
                const candSlice = candWords.slice(candStart, candStart + wordCount);
                if (!candSlice.every(w => stripArabicDiacritics(w).length >= 2)) continue;
                const candPhrase = candSlice.join(' ');
                const candNorm = stripArabicDiacritics(candPhrase);
                if (!candNorm || usedNormalized.has(candNorm)) continue;
                usedNormalized.add(candNorm);
                distractors.push({
                  text: candPhrase,
                  span: {
                    surahNumber: cand.surahNumber,
                    ayahNumber: cand.numberInSurah,
                    startWord: candStart,
                    wordCount
                  }
                });
                break;
              }
            }
          };

          collectFromPool(surahVerses);
          if (distractors.length < 3) {
            const adjSurahNum = p.surahNumber === 114 ? 113 : p.surahNumber + 1;
            const adjVerses = await loadSurahVerses(adjSurahNum);
            if (Array.isArray(adjVerses)) collectFromPool(adjVerses);
          }
          if (distractors.length < 3) continue;

          const correctSpan: OptionWordSpanSpec = {
            surahNumber: p.surahNumber,
            ayahNumber: ayah.numberInSurah,
            startWord,
            wordCount
          };

          const rawEntries = [
            { text: correctPhrase, span: correctSpan },
            ...distractors
          ];
          const { shuffled, originalIndexMap } = shuffleArray(rawEntries);
          const correctIndex = originalIndexMap.indexOf(0);

          questions.push({
            surahName: p.surahName,
            surahNumber: p.surahNumber,
            prompt: `في سورة ${p.surahName} (الآية ${ayah.numberInSurah}) — اختر الكلمات المفقودة لإكمال الآية: «${blankedText}»`,
            options: shuffled.map(entry => entry.text),
            correctIndex,
            targetAyahNumber: ayah.numberInSurah,
            blankSpec: {
              ayahNumber: ayah.numberInSurah,
              startWord,
              wordCount
            },
            optionWordSpans: shuffled.map(entry => entry.span),
            targetAyahCanonicalText: ayah.text,
            isFromMemorizedPortion: true
          });
        }
      }

      const hasSufficient = questions.length >= targetCount;
      const messageAr = !hasSufficient
        ? (questions.length === 0
            ? 'المقاطع المحفوظة الحالية لا تحتوي على آيات طويلة بما يكفي لاختبار الكلمات المفقودة (يلزم آيات من 4 كلمات فأكثر).'
            : `المحتوى القرآني المحفوظ حالياً يكفي لإنشاء ${questions.length} أسئلة فقط. تم إعدادها حصرياً من محفوظك الفعلي.`)
        : undefined;

      return {
        questions,
        hasSufficientData: hasSufficient,
        memorizedPortionsCount: memorized.length,
        messageAr
      };
    }
  }
}
