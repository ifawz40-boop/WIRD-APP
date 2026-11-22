import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle,
  RotateCcw,
  Award,
  Sparkles,
  Check,
  X,
  ArrowLeft,
  BookOpen,
  Shuffle,
  ArrowUpDown,
  AlertTriangle,
  ListFilter
} from 'lucide-react';
import { TestResult, WirdPortion } from '../../types/quran';
import { ALL_SURAHS } from '../../data/quranMeta';
import { RetentionService } from '../../services/retentionService';
import { createSecureId } from '../../services/secureId';
import { loadSimpleAyahText } from '../../data/quranDataLoader';
import { generateDynamicTestQuestions } from '../../services/testQuestionGenerator';
import type {
  GeneratedQuestion,
  QuestionGenerationResult,
  TestMode,
  TestScope
} from '../../services/testQuestionGenerator';
import { ReadingDisplaySettingsMenu, useReadingDisplayPreferences } from '../shared/DisplaySettingsMenu';
import { NARROW_READING_WIDTH_CLASSES } from '../../services/readingDisplayPreferences';

interface MemorizationTestsViewProps {
  onSaveTestResult: (result: TestResult) => boolean | Promise<boolean>;
  onAddVerseToRevision: (surahNumber: number, surahName: string, ayahNumber: number, text: string, notes: string, mutationId: string) => boolean | Promise<boolean>;
}

type TestType = TestMode;

const ARABIC_OPTION_LETTERS = ['أ', 'ب', 'ج', 'د'];

export const MemorizationTestsView: React.FC<MemorizationTestsViewProps> = ({
  onSaveTestResult,
  onAddVerseToRevision
}) => {
  const {
    preferences: displayPreferences,
    updatePreferences: updateDisplayPreferences,
    resetPreferences: resetDisplayPreferences,
  } = useReadingDisplayPreferences('tests');
  const [selectedTestType, setSelectedTestType] = useState<TestType>('complete_verse');
  const [scope, setScope] = useState<TestScope>('all');
  const [scopeSurahNumber, setScopeSurahNumber] = useState<number>(() => {
    const portions = RetentionService.getPortions();
    return portions[0]?.surahNumber || 67;
  });
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [missedQuestions, setMissedQuestions] = useState<GeneratedQuestion[]>([]);
  const [savedMissedKeys, setSavedMissedKeys] = useState<Set<string>>(new Set());
  const [isSavingBatchMissed, setIsSavingBatchMissed] = useState(false);
  const [batchMissedFeedback, setBatchMissedFeedback] = useState<{ message: string; success: boolean } | null>(null);
  const [weakVerseFeedback, setWeakVerseFeedback] = useState<{ message: string; success: boolean } | null>(null);
  const [testSaveError, setTestSaveError] = useState<string | null>(null);
  const [pendingTestResult, setPendingTestResult] = useState<TestResult | null>(null);
  const [isSavingTestResult, setIsSavingTestResult] = useState(false);
  const [isSavingWeakVerse, setIsSavingWeakVerse] = useState(false);
  const weakVerseMutationIdsRef = useRef<Map<string, string>>(new Map());
  const weakVerseSaveInFlightRef = useRef(false);
  const saveInProgressRef = useRef(false);
  const [sessionKey, setSessionKey] = useState(0);

  const [generationResult, setGenerationResult] = useState<QuestionGenerationResult>({
    questions: [],
    hasSufficientData: false,
    memorizedPortionsCount: 0,
    messageAr: 'جارٍ تجهيز أسئلة الاختبار من محفوظك الفعلي...'
  });
  const [isGenerating, setIsGenerating] = useState(true);

  useEffect(() => {
    let active = true;
    setIsGenerating(true);
    setCurrentQuestionIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setScore(0);
    setIsFinished(false);
    setMissedQuestions([]);
    setSavedMissedKeys(new Set());
    setBatchMissedFeedback(null);
    const portions = RetentionService.getPortions();
    const weakVerses = RetentionService.getWeakVerses();
    generateDynamicTestQuestions(selectedTestType, portions as WirdPortion[], 5, undefined, {
      scope,
      surahNumber: scope === 'surah' ? scopeSurahNumber : undefined,
      weakVerses
    })
      .then(result => { if (active) setGenerationResult(result); })
      .catch(error => {
        console.error('[WIRD MemorizationTests] Question generation failed:', error);
        if (active) setGenerationResult({
          questions: [],
          hasSufficientData: false,
          memorizedPortionsCount: 0,
          messageAr: 'تعذر تجهيز الاختبار من بيانات الحفظ الحالية. حاول مرة أخرى.'
        });
      })
      .finally(() => { if (active) setIsGenerating(false); });
    return () => { active = false; };
  }, [selectedTestType, scope, scopeSurahNumber, sessionKey]);

  const currentQuestions = generationResult.questions;
  const currentQ = currentQuestions[currentQuestionIndex] || currentQuestions[0];
  const [displayPrompt, setDisplayPrompt] = useState('');
  const [displayOptions, setDisplayOptions] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    if (!currentQ) { setDisplayPrompt(''); setDisplayOptions([]); return () => { active = false; }; }
    const resolveDisplayText = async () => {
      let prompt = currentQ.prompt;
      if (currentQ.blankSpec && currentQ.targetAyahCanonicalText) {
        const canonicalWords = currentQ.targetAyahCanonicalText.trim().split(/\s+/).filter(Boolean);
        const simpleAyah = await loadSimpleAyahText(currentQ.surahNumber, currentQ.blankSpec.ayahNumber);
        if (simpleAyah) {
          const simpleWords = simpleAyah.trim().split(/\s+/).filter(Boolean);
          if (simpleWords.length === canonicalWords.length &&
              currentQ.blankSpec.startWord + currentQ.blankSpec.wordCount <= simpleWords.length) {
            const blankedSimple = [
              ...simpleWords.slice(0, currentQ.blankSpec.startWord),
              '«......»',
              ...simpleWords.slice(currentQ.blankSpec.startWord + currentQ.blankSpec.wordCount)
            ].join(' ');
            prompt = `في سورة ${currentQ.surahName} (الآية ${currentQ.blankSpec.ayahNumber}) — اختر الكلمات المفقودة لإكمال الآية: «${blankedSimple}»`;
          }
        }
      } else if (currentQ.promptAyahNumber && currentQ.promptCanonicalText) {
        const simpleText = await loadSimpleAyahText(currentQ.surahNumber, currentQ.promptAyahNumber);
        if (!simpleText) throw new Error('Missing Simple prompt text');
        prompt = prompt.replace(currentQ.promptCanonicalText, simpleText);
      }
      let options = [...currentQ.options];
      if (currentQ.optionAyahCoordinates?.length) {
        if (currentQ.optionAyahCoordinates.length !== options.length) throw new Error('Option coordinates do not match option count');
        const simpleOptions = await Promise.all(currentQ.optionAyahCoordinates.map(coordinate => loadSimpleAyahText(coordinate.surahNumber, coordinate.ayahNumber)));
        if (simpleOptions.some(option => !option)) throw new Error('Missing Simple option text');
        options = simpleOptions as string[];
      } else if (currentQ.optionWordSpans?.length === options.length) {
        const canonicalSimplePairs = await Promise.all(
          currentQ.optionWordSpans.map(async (span, idx) => {
            const simple = await loadSimpleAyahText(span.surahNumber, span.ayahNumber);
            if (!simple) return options[idx];
            const sWords = simple.trim().split(/\s+/).filter(Boolean);
            const fallbackWordsCount = options[idx].trim().split(/\s+/).filter(Boolean).length;
            if (span.wordCount === fallbackWordsCount && span.startWord + span.wordCount <= sWords.length) {
              return sWords.slice(span.startWord, span.startWord + span.wordCount).join(' ');
            }
            return options[idx];
          })
        );
        options = canonicalSimplePairs;
      }
      if (active) { setDisplayPrompt(prompt); setDisplayOptions(options); }
    };
    resolveDisplayText().catch(error => {
      console.error('[WIRD MemorizationTests] Could not resolve official Simple text:', error);
      if (active) { setDisplayPrompt('تعذر تحميل النص الإملائي المعتمد للاختبار.'); setDisplayOptions([]); }
    });
    return () => { active = false; };
  }, [currentQ]);

  const handleSelectOption = (index: number) => {
    if (isAnswered) return;
    setSelectedOption(index);
    setIsAnswered(true);

    if (index === currentQ.correctIndex) {
      setScore(s => s + 1);
    } else {
      setMissedQuestions(prev => {
        const key = `${currentQ.surahNumber}:${currentQ.targetAyahNumber}`;
        if (prev.some(item => `${item.surahNumber}:${item.targetAyahNumber}` === key)) return prev;
        return [...prev, currentQ];
      });
    }
  };

  const handleNext = async () => {
    if (currentQuestionIndex < currentQuestions.length - 1) {
      setCurrentQuestionIndex(i => i + 1);
      setSelectedOption(null);
      setIsAnswered(false);
      setWeakVerseFeedback(null);
    } else {
      const finalScore = score;
      const resultToSave: TestResult = pendingTestResult || {
        id: `test-${createSecureId()}`,
        date: new Date().toISOString().split('T')[0],
        type: selectedTestType,
        surahName: currentQ.surahName,
        score: finalScore,
        totalQuestions: currentQuestions.length,
        weakVerses: []
      };
      if (saveInProgressRef.current) return;
      if (!pendingTestResult) setPendingTestResult(resultToSave);

      saveInProgressRef.current = true;
      setIsSavingTestResult(true);
      let saved = false;
      try {
        saved = await onSaveTestResult(resultToSave);
      } catch (error) {
        console.error('[WIRD Tests] Test result persistence failed:', error);
      } finally {
        saveInProgressRef.current = false;
        setIsSavingTestResult(false);
      }
      if (!saved) {
        setTestSaveError('تعذر حفظ نتيجة الاختبار. لم نعلن اكتماله؛ اضغط «إعادة محاولة حفظ النتيجة» للمحاولة مجدداً.');
        return;
      }
      setPendingTestResult(null);
      setTestSaveError(null);
      setIsFinished(true);
    }
  };

  const resetQuizState = (bumpSession: boolean) => {
    setCurrentQuestionIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setScore(0);
    setIsFinished(false);
    setMissedQuestions([]);
    setSavedMissedKeys(new Set());
    setBatchMissedFeedback(null);
    setWeakVerseFeedback(null);
    setTestSaveError(null);
    setPendingTestResult(null);
    if (bumpSession) setSessionKey(k => k + 1);
  };

  const handleResetTest = () => {
    if (pendingTestResult || saveInProgressRef.current || weakVerseSaveInFlightRef.current) return;
    resetQuizState(true);
  };

  const handleSwitchTestType = (nextType: TestType) => {
    if (isModeSwitchLocked) return;
    if (nextType === selectedTestType) {
      resetQuizState(true);
      return;
    }
    setSelectedTestType(nextType);
    resetQuizState(false);
  };

  const handleSwitchScope = (nextScope: TestScope) => {
    if (isModeSwitchLocked) return;
    setScope(nextScope);
    resetQuizState(false);
  };

  const getTestModeArabicLabel = (type: TestType): string => {
    switch (type) {
      case 'complete_verse': return 'إكمال الآية التالية';
      case 'bidirectional_recall': return 'الآية السابقة والتالية';
      case 'random_recall': return 'اختبار عشوائي من المحفوظ';
      case 'fill_blank_words': return 'إكمال الكلمات المفقودة';
      case 'mutashabihat': return 'المتشابهات اللفظية';
    }
  };

  const handleAddCurrentToWeakVerses = async () => {
    if (weakVerseSaveInFlightRef.current || isSavingWeakVerse) return;
    const notes = `تعثر في اختبار: ${getTestModeArabicLabel(selectedTestType)}`;
    const actionKey = [selectedTestType, currentQ.surahNumber, currentQ.targetAyahNumber, notes].join('|');
    const mutationId = weakVerseMutationIdsRef.current.get(actionKey) || 'weak-' + createSecureId();
    weakVerseMutationIdsRef.current.set(actionKey, mutationId);
    weakVerseSaveInFlightRef.current = true;
    setIsSavingWeakVerse(true);
    let saved = false;
    try {
      saved = await onAddVerseToRevision(
        currentQ.surahNumber,
        currentQ.surahName,
        currentQ.targetAyahNumber,
        currentQ.targetAyahCanonicalText || currentQ.options[currentQ.correctIndex],
        notes,
        mutationId
      );
    } catch (error) {
      console.error('[WIRD Tests] Weak-verse journal persistence failed:', error);
    } finally {
      weakVerseSaveInFlightRef.current = false;
      setIsSavingWeakVerse(false);
    }
    if (saved) {
      weakVerseMutationIdsRef.current.delete(actionKey);
      setSavedMissedKeys(prev => new Set(prev).add(`${currentQ.surahNumber}:${currentQ.targetAyahNumber}`));
    }
    setWeakVerseFeedback({
      message: saved
        ? `تم تسجيل الآية ${currentQ.targetAyahNumber} من سورة ${currentQ.surahName} في قائمة الالتباس والمراجعة المستعجلة.`
        : 'تعذر تأكيد حفظ الآية المتعثرة. إذا كانت العملية في سجل الاستعادة فحدّث الصفحة قبل إعادة المحاولة.',
      success: saved
    });
  };

  const handleSaveAllMissedToWeakVerses = async () => {
    if (isSavingBatchMissed || missedQuestions.length === 0) return;
    setIsSavingBatchMissed(true);
    setBatchMissedFeedback(null);
    let savedCount = 0;
    const newlySaved = new Set(savedMissedKeys);
    try {
      for (const q of missedQuestions) {
        const key = `${q.surahNumber}:${q.targetAyahNumber}`;
        if (newlySaved.has(key)) continue;
        const notes = `تعثر في اختبار (${getTestModeArabicLabel(selectedTestType)})`;
        const actionKey = [selectedTestType, q.surahNumber, q.targetAyahNumber, notes].join('|');
        const mutationId = weakVerseMutationIdsRef.current.get(actionKey) || 'weak-' + createSecureId();
        weakVerseMutationIdsRef.current.set(actionKey, mutationId);
        const ok = await onAddVerseToRevision(
          q.surahNumber,
          q.surahName,
          q.targetAyahNumber,
          q.targetAyahCanonicalText || q.options[q.correctIndex],
          notes,
          mutationId
        );
        if (ok) {
          weakVerseMutationIdsRef.current.delete(actionKey);
          newlySaved.add(key);
          savedCount++;
        }
      }
      setSavedMissedKeys(newlySaved);
      setBatchMissedFeedback({
        success: savedCount > 0 || newlySaved.size === missedQuestions.length,
        message: savedCount > 0
          ? `تمت إضافة ${savedCount} آية متعثرة إلى مركز المراجعة والتثبيت المستعجل.`
          : 'جميع الآيات المتعثرة في هذه النتيجة مسجلة بالفعل أو تعذر تأكيد حفظها.'
      });
    } finally {
      setIsSavingBatchMissed(false);
    }
  };

  const questionCardPadding =
    displayPreferences.spacing === 'compact'
      ? 'p-4 md:p-6'
      : displayPreferences.spacing === 'relaxed'
      ? 'p-7 md:p-10'
      : 'p-6 md:p-8';
  const optionsSpacingClass =
    displayPreferences.spacing === 'compact'
      ? 'space-y-2'
      : displayPreferences.spacing === 'relaxed'
      ? 'space-y-4'
      : 'space-y-3';
  const textLineHeight =
    displayPreferences.spacing === 'compact'
      ? 1.9
      : displayPreferences.spacing === 'relaxed'
      ? 2.5
      : 2.2;

  const isModeSwitchLocked = Boolean(pendingTestResult) || saveInProgressRef.current || weakVerseSaveInFlightRef.current;

  return (
    <div
      className={`space-y-6 ${NARROW_READING_WIDTH_CLASSES[displayPreferences.pageWidth]} mx-auto transition-all`}
    >
      {/* 1. Header & Test Mode Switcher */}
      <div className="wird-card p-6 space-y-4">
        <div>
          <h2 className="text-xl font-bold text-[var(--wird-text)] flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
            <span>اختبارات الحفظ والتقييم الذاتي المتقدمة</span>
          </h2>
          <p className="text-xs text-[var(--wird-muted)] mt-1">
            امتحانات قرآنية تفاعلية دقيقة: إكمال الآيات، الاسترجاع العكسي، المتشابهات اللفظية، وسحب عشوائي من المحفوظ
          </p>
        </div>

        {/* Test Type 5 Tabs */}
        <div role="group" aria-label="نوع الاختبار" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 text-xs font-semibold">
          <button
            type="button"
            aria-pressed={selectedTestType === 'complete_verse'}
            onClick={() => handleSwitchTestType('complete_verse')}
            className={`min-h-11 p-3 rounded-[var(--wird-radius-control)] border text-center transition-all flex flex-col items-center justify-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-ring)] ${
              selectedTestType === 'complete_verse'
                ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] border-[var(--wird-accent)] shadow-xs'
                : 'bg-[var(--wird-surface-muted)] border-[var(--wird-border)] text-[var(--wird-text)] hover:border-[var(--wird-accent)]'
            }`}
          >
            <BookOpen className={`w-4 h-4 ${selectedTestType === 'complete_verse' ? 'text-[var(--wird-accent)]' : 'text-[var(--wird-primary)] dark:text-[var(--wird-accent)]'}`} />
            <div className="font-bold text-xs">أكمل الآية التالية</div>
            <div className={`text-[10px] font-normal ${selectedTestType === 'complete_verse' ? 'opacity-85' : 'text-[var(--wird-muted)]'}`}>
              التسلسل الأمامي
            </div>
          </button>

          <button
            type="button"
            aria-pressed={selectedTestType === 'bidirectional_recall'}
            onClick={() => handleSwitchTestType('bidirectional_recall')}
            className={`min-h-11 p-3 rounded-[var(--wird-radius-control)] border text-center transition-all flex flex-col items-center justify-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-ring)] ${
              selectedTestType === 'bidirectional_recall'
                ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] border-[var(--wird-accent)] shadow-xs'
                : 'bg-[var(--wird-surface-muted)] border-[var(--wird-border)] text-[var(--wird-text)] hover:border-[var(--wird-accent)]'
            }`}
          >
            <ArrowUpDown className="w-4 h-4 text-[var(--wird-accent)]" />
            <div className="font-bold text-xs">الآية السابقة والتالية</div>
            <div className={`text-[10px] font-normal ${selectedTestType === 'bidirectional_recall' ? 'opacity-85' : 'text-[var(--wird-muted)]'}`}>
              الاسترجاع الثنائي
            </div>
          </button>

          <button
            type="button"
            aria-pressed={selectedTestType === 'fill_blank_words'}
            onClick={() => handleSwitchTestType('fill_blank_words')}
            className={`min-h-11 p-3 rounded-[var(--wird-radius-control)] border text-center transition-all flex flex-col items-center justify-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-ring)] ${
              selectedTestType === 'fill_blank_words'
                ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] border-[var(--wird-accent)] shadow-xs'
                : 'bg-[var(--wird-surface-muted)] border-[var(--wird-border)] text-[var(--wird-text)] hover:border-[var(--wird-accent)]'
            }`}
          >
            <ListFilter className={`w-4 h-4 ${selectedTestType === 'fill_blank_words' ? 'text-[var(--wird-accent)]' : 'text-[var(--wird-primary)] dark:text-[var(--wird-accent)]'}`} />
            <div className="font-bold text-xs">إكمال الكلمات المفقودة</div>
            <div className={`text-[10px] font-normal ${selectedTestType === 'fill_blank_words' ? 'opacity-85' : 'text-[var(--wird-muted)]'}`}>
              تثبيت المواضع
            </div>
          </button>

          <button
            type="button"
            aria-pressed={selectedTestType === 'random_recall'}
            onClick={() => handleSwitchTestType('random_recall')}
            className={`min-h-11 p-3 rounded-[var(--wird-radius-control)] border text-center transition-all flex flex-col items-center justify-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-ring)] ${
              selectedTestType === 'random_recall'
                ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] border-[var(--wird-accent)] shadow-xs'
                : 'bg-[var(--wird-surface-muted)] border-[var(--wird-border)] text-[var(--wird-text)] hover:border-[var(--wird-accent)]'
            }`}
          >
            <Shuffle className={`w-4 h-4 ${selectedTestType === 'random_recall' ? 'text-[var(--wird-accent)]' : 'text-[var(--wird-primary)] dark:text-[var(--wird-accent)]'}`} />
            <div className="font-bold text-xs">عشوائي من المحفوظ</div>
            <div className={`text-[10px] font-normal ${selectedTestType === 'random_recall' ? 'opacity-85' : 'text-[var(--wird-muted)]'}`}>
              اختبار المفاجأة
            </div>
          </button>

          <button
            type="button"
            aria-pressed={selectedTestType === 'mutashabihat'}
            onClick={() => handleSwitchTestType('mutashabihat')}
            className={`min-h-11 p-3 rounded-[var(--wird-radius-control)] border text-center transition-all flex flex-col items-center justify-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-ring)] ${
              selectedTestType === 'mutashabihat'
                ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] border-[var(--wird-accent)] shadow-xs'
                : 'bg-[var(--wird-surface-muted)] border-[var(--wird-border)] text-[var(--wird-text)] hover:border-[var(--wird-accent)]'
            }`}
          >
            <Sparkles className="w-4 h-4 text-[var(--wird-accent)]" />
            <div className="font-bold text-xs">المتشابهات اللفظية</div>
            <div className={`text-[10px] font-normal ${selectedTestType === 'mutashabihat' ? 'opacity-85' : 'text-[var(--wird-muted)]'}`}>
              الضوابط القرآنية
            </div>
          </button>
        </div>

        {/* Scope Selector Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-[var(--wird-muted)]">نطاق الأسئلة:</span>
            <div role="group" aria-label="نطاق أسئلة الاختبار" className="inline-flex flex-wrap items-center gap-1.5">
              {[
                { id: 'all' as const, label: 'كل المحفوظ' },
                { id: 'surah' as const, label: 'سورة محددة' },
                { id: 'weak_priority' as const, label: 'أولوية المتعثرة' }
              ].map(item => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={scope === item.id}
                  onClick={() => handleSwitchScope(item.id)}
                  className={`min-h-11 px-3 py-1.5 rounded-[var(--wird-radius-control)] font-bold border transition-colors whitespace-nowrap ${
                    scope === item.id
                      ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] border-[var(--wird-accent)]'
                      : 'bg-[var(--wird-surface-muted)] text-[var(--wird-text)] border-[var(--wird-border)] hover:border-[var(--wird-accent)]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {scope === 'surah' && (
            <label className="flex items-center gap-2">
              <span className="font-semibold text-[var(--wird-muted)] whitespace-nowrap">السورة:</span>
              <select
                aria-label="اختيار سورة نطاق الاختبار"
                value={scopeSurahNumber}
                onChange={e => {
                  setScopeSurahNumber(Number(e.target.value));
                  resetQuizState(false);
                }}
                className="min-h-11 rounded-[var(--wird-radius-control)] border border-[var(--wird-border-strong)] bg-[var(--wird-surface)] px-3 text-xs font-semibold text-[var(--wird-text)] focus:outline-none focus:ring-2 focus:ring-[var(--wird-ring)]"
              >
                {ALL_SURAHS.map(s => (
                  <option key={s.number} value={s.number}>
                    {s.number}. سورة {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <ReadingDisplaySettingsMenu
          viewLabel="اختبارات الحفظ"
          preferences={displayPreferences}
          onUpdate={updateDisplayPreferences}
          onReset={resetDisplayPreferences}
          fontLabel="حجم خط الأسئلة"
        />
      </div>

      {/* 2. Finished Test Result Card / Question Body */}
      <div style={{ zoom: displayPreferences.uiScale / 100 }}>
      {isFinished ? (
        <div className="wird-card p-8 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-[var(--wird-accent-soft)] text-[var(--wird-primary)] dark:text-[var(--wird-accent)] flex items-center justify-center mx-auto border border-[var(--wird-border-gold)]">
            <Award className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] uppercase tracking-wider">
              نتيجة الاختبار القرآني
            </span>
            <h3 className="text-2xl font-bold text-[var(--wird-text)]">
              أحسنت بارك الله فيك ونفع بك!
            </h3>
            <p className="text-xs text-[var(--wird-muted)]">
              حصلت على <strong className="text-[var(--wird-primary)] dark:text-[var(--wird-accent)] font-mono tabular-nums text-sm">{score}</strong> من <strong className="font-mono tabular-nums text-sm">{currentQuestions.length}</strong>
            </p>
          </div>

          <div className="p-4 bg-[var(--wird-surface-muted)] rounded-xl border border-[var(--wird-border)] max-w-sm mx-auto text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-[var(--wird-muted)]">معدل الدقة الإجمالي:</span>
              <span className="font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] font-mono tabular-nums">
                {Math.round((score / Math.max(1, currentQuestions.length)) * 100)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--wird-muted)]">مستوى الرسوخ الذهني:</span>
              <span className="font-bold text-[var(--wird-text)]">
                {score === currentQuestions.length ? 'ممتاز ومتقن تماماً' : score >= currentQuestions.length * 0.7 ? 'جيد جداً مع حاجة للتثبيت' : 'يحتاج مراجعة وتكرار'}
              </span>
            </div>
          </div>

          {missedQuestions.length > 0 && (
            <div className="max-w-lg mx-auto rounded-2xl border border-[var(--wird-border-gold)] bg-[var(--wird-surface-muted)] p-4 text-right space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[var(--wird-text)]">
                  <AlertTriangle className="w-4 h-4 text-[var(--wird-accent)] shrink-0" />
                  <span>الآيات التي تحتاج إلى مراجعة وتثبيت ({missedQuestions.length})</span>
                </div>
                <button
                  type="button"
                  disabled={isSavingBatchMissed || missedQuestions.every(q => savedMissedKeys.has(`${q.surahNumber}:${q.targetAyahNumber}`))}
                  onClick={handleSaveAllMissedToWeakVerses}
                  className="wird-btn-primary min-h-11 px-3.5 py-2 text-xs disabled:opacity-50 whitespace-nowrap"
                >
                  {isSavingBatchMissed
                    ? 'جارٍ الحفظ...'
                    : missedQuestions.every(q => savedMissedKeys.has(`${q.surahNumber}:${q.targetAyahNumber}`))
                    ? 'تم حفظ جميع المتعثرة'
                    : 'حفظ الآيات المتعثرة في مركز المراجعة'}
                </button>
              </div>

              <ul className="space-y-1.5 text-xs">
                {missedQuestions.map(q => {
                  const key = `${q.surahNumber}:${q.targetAyahNumber}`;
                  const isSavedMissed = savedMissedKeys.has(key);
                  return (
                    <li
                      key={key}
                      className="flex items-center justify-between gap-2 rounded-xl bg-[var(--wird-surface)] px-3 py-2 border border-[var(--wird-border)]"
                    >
                      <span className="font-bold text-[var(--wird-text)]">
                        سورة {q.surahName} · الآية {q.targetAyahNumber}
                      </span>
                      <span className={`text-[11px] font-semibold ${isSavedMissed ? 'text-[var(--wird-primary)] dark:text-[var(--wird-accent)]' : 'text-[var(--wird-muted)]'}`}>
                        {isSavedMissed ? 'مسجلة في المراجعة المستعجلة' : 'بانتظار التثبيت'}
                      </span>
                    </li>
                  );
                })}
              </ul>

              {batchMissedFeedback && (
                <p role="status" aria-live="polite" className={`text-[11px] font-semibold ${batchMissedFeedback.success ? 'text-[var(--wird-primary)] dark:text-[var(--wird-accent)]' : 'text-rose-600 dark:text-rose-300'}`}>
                  {batchMissedFeedback.message}
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleResetTest}
              className="wird-btn-primary flex min-h-11 items-center gap-2 px-5 py-2.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-ring)]"
            >
              <RotateCcw className="w-4 h-4" />
              <span>إعادة الاختبار</span>
            </button>
          </div>
        </div>
      ) : isGenerating ? (
        <div role="status" aria-live="polite" className="wird-card p-8 text-center text-sm text-[var(--wird-muted)]">
          جارٍ تجهيز أسئلة الاختبار من السور المحفوظة فقط...
        </div>
      ) : currentQuestions.length === 0 ? (
        <div className="wird-card p-8 text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-[var(--wird-accent-soft)] text-[var(--wird-accent)] flex items-center justify-center mx-auto border border-[var(--wird-border-gold)]">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <h3 className="font-bold text-[var(--wird-text)] text-base">
              لا تتوفر أسئلة مؤهلة من المحفوظ حالياً
            </h3>
            <p className="text-xs text-[var(--wird-muted)] leading-relaxed">
              {generationResult.messageAr || 'يرجى تسجيل مقاطع محفوظة أولاً في خطتك أو إتمام جلسة حفظ قبل إجراء الاختبارات المبنية على المحفوظ الفعلي.'}
            </p>
          </div>
        </div>
      ) : (
        /* 4. Question Card */
        <div className={`wird-card ${questionCardPadding} space-y-6`}>
          <div className="flex items-center justify-between text-xs pb-3 border-b border-[var(--wird-border)]">
            <span className="font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] tabular-nums">
              السؤال {currentQuestionIndex + 1} من {currentQuestions.length}
            </span>
            <span className="text-[var(--wird-muted)] font-mono tabular-nums">
              الدرجة الحالية: {score}
            </span>
          </div>

          <div
            role="progressbar"
            aria-label="تقدم الاختبار"
            aria-valuemin={0}
            aria-valuemax={currentQuestions.length}
            aria-valuenow={currentQuestionIndex + 1}
            aria-valuetext={`السؤال ${currentQuestionIndex + 1} من ${currentQuestions.length}`}
            className="h-2 overflow-hidden rounded-full bg-[var(--wird-surface-muted)]"
          >
            <div
              className="h-full rounded-full bg-[var(--wird-primary)] dark:bg-[var(--wird-accent)] transition-[width]"
              style={{ width: `${((currentQuestionIndex + 1) / currentQuestions.length) * 100}%` }}
            />
          </div>

          {(!generationResult.hasSufficientData || generationResult.messageAr) && (
            <div className="p-3 bg-[var(--wird-accent-soft)] border border-[var(--wird-border-gold)] rounded-xl text-xs text-[var(--wird-text)] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[var(--wird-accent)] shrink-0" />
              <span>{generationResult.messageAr || 'ملاحظة: هذا الاختبار مستخرج من المقاطع المحفوظة في سجلك الفعلي.'}</span>
            </div>
          )}

          {/* Prompt */}
          <div className="space-y-3">
            <h3
              aria-live="polite"
              aria-atomic="true"
              className="font-quran text-[var(--wird-text)] text-right bg-[var(--wird-surface-muted)] p-5 rounded-2xl border border-[var(--wird-border)]"
              style={{ fontSize: `${displayPreferences.fontSize}px`, lineHeight: textLineHeight }}
            >
              {displayPrompt || 'جارٍ تحميل النص الإملائي المعتمد...'}
            </h3>
          </div>

          {/* Options with Arabic letter marks (أ، ب، ج، د) */}
          <div role="group" aria-label="خيارات الإجابة" className={optionsSpacingClass}>
            {displayOptions.map((opt, idx) => {
              const isSelected = selectedOption === idx;
              const isCorrect = idx === currentQ.correctIndex;
              const letterMark = ARABIC_OPTION_LETTERS[idx] || 'أ';

              let style = 'bg-[var(--wird-surface-muted)] border-[var(--wird-border)] text-[var(--wird-text)] hover:border-[var(--wird-accent)]';
              if (isAnswered) {
                if (isCorrect) {
                  style = 'bg-[var(--wird-primary)]/12 dark:bg-[var(--wird-primary)]/35 border-[var(--wird-primary)] dark:border-[var(--wird-accent)] text-[var(--wird-text)] font-bold ring-1 ring-[var(--wird-primary)] dark:ring-[var(--wird-accent)]';
                } else if (isSelected && !isCorrect) {
                  style = 'bg-rose-50 dark:bg-rose-950/50 border-rose-500 text-rose-950 dark:text-rose-200';
                } else {
                  style = 'opacity-50 border-[var(--wird-border)]';
                }
              }

              return (
                <button
                  key={idx}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => handleSelectOption(idx)}
                  disabled={isAnswered}
                  className={`w-full min-h-11 p-4 rounded-[var(--wird-radius-control)] border text-right transition-all flex items-start gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-ring)] ${style}`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold ${
                    isAnswered && isCorrect
                      ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)]'
                      : isAnswered && isSelected && !isCorrect
                      ? 'bg-rose-600 text-white'
                      : 'bg-[var(--wird-surface)] text-[var(--wird-primary)] dark:text-[var(--wird-accent)] border border-[var(--wird-border)]'
                  }`}>
                    {isAnswered && isCorrect ? <Check className="w-3.5 h-3.5" /> : isAnswered && isSelected && !isCorrect ? <X className="w-3.5 h-3.5" /> : letterMark}
                  </div>

                  <div
                    className="font-quran flex-1"
                    style={{ fontSize: `${Math.max(16, displayPreferences.fontSize - 4)}px`, lineHeight: textLineHeight }}
                  >
                    {opt}
                  </div>
                </button>
              );
            })}
          </div>

          {isAnswered && 'distinctionRule' in currentQ && (
            <div className="p-4 bg-[var(--wird-accent-soft)] rounded-xl border border-[var(--wird-border-gold)] text-xs space-y-1 text-right">
              <div className="font-bold text-[var(--wird-text)]">
                ضابط الحفظ وقاعدة التمييز المعتمدة:
              </div>
              <p className="text-[var(--wird-muted)] leading-relaxed text-[11px]">
                {(currentQ as { distinctionRule?: string }).distinctionRule}
              </p>
            </div>
          )}

          {weakVerseFeedback && (
            <div role="status" aria-live="polite" className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              weakVerseFeedback.success
                ? 'bg-[var(--wird-primary)]/10 dark:bg-[var(--wird-primary)]/30 border-[var(--wird-border-strong)] text-[var(--wird-text)]'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 text-rose-900 dark:text-rose-200'
            }`}>
              {weakVerseFeedback.success
                ? <Check className="w-4 h-4 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
                : <AlertTriangle className="w-4 h-4 text-rose-600" />}
              <span>{weakVerseFeedback.message}</span>
            </div>
          )}

          {testSaveError && (
            <div role="alert" className="p-3 rounded-xl border border-rose-300 bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-900 dark:text-rose-200">
              {testSaveError}
            </div>
          )}

          {isAnswered && (
            <div className="flex items-center justify-between pt-4 border-t border-[var(--wird-border)] flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddCurrentToWeakVerses}
                  disabled={isSavingWeakVerse}
                  className="min-h-11 text-xs text-[var(--wird-text)] hover:border-[var(--wird-accent)] font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--wird-radius-control)] border border-[var(--wird-border-gold)] bg-[var(--wird-accent-soft)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-ring)]"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-[var(--wird-accent)]" />
                  <span>{isSavingWeakVerse ? 'جارٍ حفظ الآية...' : 'تسجيل هذه الآية في قائمة الآيات الملتبسة'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleNext}
                disabled={isSavingTestResult}
                className="wird-btn-primary flex min-h-11 items-center gap-2 px-6 py-2.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-ring)]"
              >
                <span>
                  {currentQuestionIndex === currentQuestions.length - 1
                    ? (testSaveError ? 'إعادة محاولة حفظ النتيجة' : 'إنهاء الاختبار وعرض النتيجة')
                    : 'السؤال التالي'}
                </span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
};

