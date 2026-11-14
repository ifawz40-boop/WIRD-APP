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
  AlertTriangle
} from 'lucide-react';
import { TestResult, WirdPortion } from '../../types/quran';
import { RetentionService } from '../../services/retentionService';
import { createSecureId } from '../../services/secureId';
import { loadSimpleAyahText } from '../../data/quranDataLoader';
import { generateDynamicTestQuestions } from '../../services/testQuestionGenerator';
import type { QuestionGenerationResult } from '../../services/testQuestionGenerator';
import { ReadingDisplaySettingsMenu, useReadingDisplayPreferences } from '../shared/DisplaySettingsMenu';
import { NARROW_READING_WIDTH_CLASSES } from '../../services/readingDisplayPreferences';

interface MemorizationTestsViewProps {
  onSaveTestResult: (result: TestResult) => boolean | Promise<boolean>;
  onAddVerseToRevision: (surahNumber: number, surahName: string, ayahNumber: number, text: string, notes: string, mutationId: string) => boolean | Promise<boolean>;
}

type TestType = 'complete_verse' | 'bidirectional_recall' | 'random_recall' | 'mutashabihat';

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
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
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
    const portions = RetentionService.getPortions();
    generateDynamicTestQuestions(selectedTestType, portions as WirdPortion[])
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
  }, [selectedTestType, sessionKey]);

  const currentQuestions = generationResult.questions;
  const currentQ = currentQuestions[currentQuestionIndex] || currentQuestions[0];
  const [displayPrompt, setDisplayPrompt] = useState('');
  const [displayOptions, setDisplayOptions] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    if (!currentQ) { setDisplayPrompt(''); setDisplayOptions([]); return () => { active = false; }; }
    const resolveDisplayText = async () => {
      let prompt = currentQ.prompt;
      if (currentQ.promptAyahNumber && currentQ.promptCanonicalText) {
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

  const handleAddCurrentToWeakVerses = async () => {
    if (weakVerseSaveInFlightRef.current || isSavingWeakVerse) return;
    const notes = `تعثر في اختبار: ${
      selectedTestType === 'complete_verse' ? 'إكمال الآية التالية' :
      selectedTestType === 'bidirectional_recall' ? 'الآية السابقة والتالية' :
      selectedTestType === 'random_recall' ? 'اختبار عشوائي من المحفوظ' : 'المتشابهات اللفظية'
    }`;
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
        currentQ.options[currentQ.correctIndex],
        notes,
        mutationId
      );
    } catch (error) {
      console.error('[WIRD Tests] Weak-verse journal persistence failed:', error);
    } finally {
      weakVerseSaveInFlightRef.current = false;
      setIsSavingWeakVerse(false);
    }
    if (saved) weakVerseMutationIdsRef.current.delete(actionKey);
    setWeakVerseFeedback({
      message: saved
        ? `تم تسجيل الآية ${currentQ.targetAyahNumber} من سورة ${currentQ.surahName} في قائمة الالتباس والمراجعة المستعجلة.`
        : 'تعذر تأكيد حفظ الآية المتعثرة. إذا كانت العملية في سجل الاستعادة فحدّث الصفحة قبل إعادة المحاولة.',
      success: saved
    });
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
          <h2 className="text-xl font-bold text-[#142421] dark:text-[#F5F1E8] flex items-center gap-2 font-quran">
            <CheckCircle className="w-5 h-5 text-[#1C4E46] dark:text-[#E0A96D]" />
            <span>اختبارات الحفظ والتقييم الذاتي المتقدمة</span>
          </h2>
          <p className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B] mt-1">
            امتحانات قرآنية تفاعلية دقيقة: إكمال الآيات، الاسترجاع العكسي، المتشابهات اللفظية، وسحب عشوائي من المحفوظ
          </p>
        </div>

        {/* Test Type 4 Tabs */}
        <div role="group" aria-label="نوع الاختبار" className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs font-semibold">
          <button
            type="button"
            aria-pressed={selectedTestType === 'complete_verse'}
            onClick={() => handleSwitchTestType('complete_verse')}
            className={`min-h-11 p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27] ${
              selectedTestType === 'complete_verse'
                ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white border-[#C59B27] dark:border-[#E0A96D] shadow-xs'
                : 'bg-[#F9F6EE] dark:bg-[#0B132B] border-[#1C4E46]/15 dark:border-[#E0A96D]/20 text-[#142421] dark:text-[#F5F1E8] hover:border-[#C59B27]'
            }`}
          >
            <BookOpen className={`w-4 h-4 ${selectedTestType === 'complete_verse' ? 'text-[#E0A96D]' : 'text-[#1C4E46] dark:text-[#E0A96D]'}`} />
            <div className="font-bold text-xs">أكمل الآية التالية</div>
            <div className={`text-[10px] font-normal ${selectedTestType === 'complete_verse' ? 'text-[#F5F1E8]/80' : 'text-[#5B6F6B] dark:text-[#8B9E9B]'}`}>
              التسلسل الأمامي
            </div>
          </button>

          <button
            type="button"
            aria-pressed={selectedTestType === 'bidirectional_recall'}
            onClick={() => handleSwitchTestType('bidirectional_recall')}
            className={`min-h-11 p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27] ${
              selectedTestType === 'bidirectional_recall'
                ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white border-[#C59B27] dark:border-[#E0A96D] shadow-xs'
                : 'bg-[#F9F6EE] dark:bg-[#0B132B] border-[#1C4E46]/15 dark:border-[#E0A96D]/20 text-[#142421] dark:text-[#F5F1E8] hover:border-[#C59B27]'
            }`}
          >
            <ArrowUpDown className="w-4 h-4 text-[#C59B27] dark:text-[#E0A96D]" />
            <div className="font-bold text-xs">الآية السابقة والتالية</div>
            <div className={`text-[10px] font-normal ${selectedTestType === 'bidirectional_recall' ? 'text-[#F5F1E8]/80' : 'text-[#5B6F6B] dark:text-[#8B9E9B]'}`}>
              الاسترجاع الثنائي
            </div>
          </button>

          <button
            type="button"
            aria-pressed={selectedTestType === 'random_recall'}
            onClick={() => handleSwitchTestType('random_recall')}
            className={`min-h-11 p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27] ${
              selectedTestType === 'random_recall'
                ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white border-[#C59B27] dark:border-[#E0A96D] shadow-xs'
                : 'bg-[#F9F6EE] dark:bg-[#0B132B] border-[#1C4E46]/15 dark:border-[#E0A96D]/20 text-[#142421] dark:text-[#F5F1E8] hover:border-[#C59B27]'
            }`}
          >
            <Shuffle className={`w-4 h-4 ${selectedTestType === 'random_recall' ? 'text-[#E0A96D]' : 'text-[#1C4E46] dark:text-[#E0A96D]'}`} />
            <div className="font-bold text-xs">عشوائي من المحفوظ</div>
            <div className={`text-[10px] font-normal ${selectedTestType === 'random_recall' ? 'text-[#F5F1E8]/80' : 'text-[#5B6F6B] dark:text-[#8B9E9B]'}`}>
              اختبار المفاجأة
            </div>
          </button>

          <button
            type="button"
            aria-pressed={selectedTestType === 'mutashabihat'}
            onClick={() => handleSwitchTestType('mutashabihat')}
            className={`min-h-11 p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27] ${
              selectedTestType === 'mutashabihat'
                ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white border-[#C59B27] dark:border-[#E0A96D] shadow-xs'
                : 'bg-[#F9F6EE] dark:bg-[#0B132B] border-[#1C4E46]/15 dark:border-[#E0A96D]/20 text-[#142421] dark:text-[#F5F1E8] hover:border-[#C59B27]'
            }`}
          >
            <Sparkles className="w-4 h-4 text-[#C59B27] dark:text-[#E0A96D]" />
            <div className="font-bold text-xs">المتشابهات اللفظية</div>
            <div className={`text-[10px] font-normal ${selectedTestType === 'mutashabihat' ? 'text-[#F5F1E8]/80' : 'text-[#5B6F6B] dark:text-[#8B9E9B]'}`}>
              الضوابط القرآنية
            </div>
          </button>
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
          <div className="w-16 h-16 rounded-2xl bg-[#1C4E46]/10 dark:bg-[#1E4A47]/40 text-[#1C4E46] dark:text-[#E0A96D] flex items-center justify-center mx-auto border border-[#C59B27]/35 dark:border-[#E0A96D]/30">
            <Award className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold text-[#1C4E46] dark:text-[#E0A96D] uppercase tracking-wider">
              نتيجة الاختبار القرآني
            </span>
            <h3 className="text-2xl font-bold font-quran text-[#142421] dark:text-[#F5F1E8]">
              أحسنت بارك الله فيك ونفع بك!
            </h3>
            <p className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B]">
              حصلت على <strong className="text-[#1C4E46] dark:text-[#E0A96D] font-mono tabular-nums text-sm">{score}</strong> من <strong className="font-mono tabular-nums text-sm">{currentQuestions.length}</strong>
            </p>
          </div>

          <div className="p-4 bg-[#F9F6EE] dark:bg-[#0B132B]/70 rounded-xl border border-[#1C4E46]/12 dark:border-[#E0A96D]/20 max-w-sm mx-auto text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-[#5B6F6B] dark:text-[#8B9E9B]">معدل الدقة الإجمالي:</span>
              <span className="font-bold text-[#1C4E46] dark:text-[#E0A96D] font-mono tabular-nums">
                {Math.round((score / currentQuestions.length) * 100)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#5B6F6B] dark:text-[#8B9E9B]">مستوى الرسوخ الذهني:</span>
              <span className="font-bold text-[#142421] dark:text-[#F5F1E8]">
                {score === currentQuestions.length ? 'ممتاز ومتقن تماماً' : score >= currentQuestions.length * 0.7 ? 'جيد جداً مع حاجة للتثبيت' : 'يحتاج مراجعة وتكرار'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleResetTest}
              className="wird-btn-primary flex min-h-11 items-center gap-2 px-5 py-2.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27]"
            >
              <RotateCcw className="w-4 h-4" />
              <span>إعادة الاختبار</span>
            </button>
          </div>
        </div>
      ) : isGenerating ? (
        <div role="status" aria-live="polite" className="wird-card p-8 text-center text-sm text-[#5B6F6B] dark:text-[#8B9E9B]">
          جارٍ تجهيز أسئلة الاختبار من السور المحفوظة فقط...
        </div>
      ) : currentQuestions.length === 0 ? (
        <div className="wird-card p-8 text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-[#C59B27]/12 dark:bg-[#E0A96D]/15 text-[#C59B27] dark:text-[#E0A96D] flex items-center justify-center mx-auto border border-[#C59B27]/30 dark:border-[#E0A96D]/25">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <h3 className="font-bold text-[#142421] dark:text-[#F5F1E8] text-base">
              لا تتوفر أسئلة مؤهلة من المحفوظ حالياً
            </h3>
            <p className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B] leading-relaxed">
              {generationResult.messageAr || 'يرجى تسجيل مقاطع محفوظة أولاً في خطتك أو إتمام جلسة حفظ قبل إجراء الاختبارات المبنية على المحفوظ الفعلي.'}
            </p>
          </div>
        </div>
      ) : (
        /* 4. Question Card */
        <div className={`wird-card ${questionCardPadding} space-y-6`}>
          <div className="flex items-center justify-between text-xs pb-3 border-b border-[#1C4E46]/10 dark:border-[#E0A96D]/15">
            <span className="font-bold text-[#1C4E46] dark:text-[#E0A96D] tabular-nums">
              السؤال {currentQuestionIndex + 1} من {currentQuestions.length}
            </span>
            <span className="text-[#5B6F6B] dark:text-[#8B9E9B] font-mono tabular-nums">
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
            className="h-2 overflow-hidden rounded-full bg-[#F2EDE2] dark:bg-[#0B132B]"
          >
            <div
              className="h-full rounded-full bg-[#1C4E46] dark:bg-[#E0A96D] transition-[width]"
              style={{ width: `${((currentQuestionIndex + 1) / currentQuestions.length) * 100}%` }}
            />
          </div>

          {(!generationResult.hasSufficientData || generationResult.messageAr) && (
            <div className="p-3 bg-[#C59B27]/12 dark:bg-[#E0A96D]/12 border border-[#C59B27]/30 dark:border-[#E0A96D]/25 rounded-xl text-xs text-[#142421] dark:text-[#F5F1E8] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#C59B27] dark:text-[#E0A96D] shrink-0" />
              <span>{generationResult.messageAr || 'ملاحظة: هذا الاختبار مستخرج من المقاطع المحفوظة في سجلك الفعلي.'}</span>
            </div>
          )}

          {/* Prompt */}
          <div className="space-y-3">
            <h3
              aria-live="polite"
              aria-atomic="true"
              className="font-quran text-[#142421] dark:text-[#F5F1E8] text-right bg-[#F9F6EE] dark:bg-[#0B132B]/70 p-5 rounded-2xl border border-[#1C4E46]/15 dark:border-[#E0A96D]/22"
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

              let style = 'bg-[#F9F6EE] dark:bg-[#0B132B]/70 border-[#1C4E46]/15 dark:border-[#E0A96D]/20 text-[#142421] dark:text-[#F5F1E8] hover:border-[#C59B27] dark:hover:border-[#E0A96D]';
              if (isAnswered) {
                if (isCorrect) {
                  style = 'bg-[#1C4E46]/10 dark:bg-[#1E4A47]/45 border-[#1C4E46] dark:border-[#E0A96D] text-[#142421] dark:text-[#F5F1E8] font-bold ring-1 ring-[#1C4E46] dark:ring-[#E0A96D]';
                } else if (isSelected && !isCorrect) {
                  style = 'bg-rose-50 dark:bg-rose-950/50 border-rose-500 text-rose-950 dark:text-rose-200';
                } else {
                  style = 'opacity-50 border-[#1C4E46]/10 dark:border-[#E0A96D]/10';
                }
              }

              return (
                <button
                  key={idx}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => handleSelectOption(idx)}
                  disabled={isAnswered}
                  className={`w-full min-h-11 p-4 rounded-xl border text-right transition-all flex items-start gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27] ${style}`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold font-quran ${
                    isAnswered && isCorrect
                      ? 'bg-[#1C4E46] dark:bg-[#E0A96D] text-white dark:text-[#0B132B]'
                      : isAnswered && isSelected && !isCorrect
                      ? 'bg-rose-600 text-white'
                      : 'bg-[#F2EDE2] dark:bg-[#162744] text-[#1C4E46] dark:text-[#E0A96D]'
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
            <div className="p-4 bg-[#C59B27]/12 dark:bg-[#E0A96D]/12 rounded-xl border border-[#C59B27]/35 dark:border-[#E0A96D]/30 text-xs space-y-1 text-right">
              <div className="font-bold text-[#142421] dark:text-[#E0A96D]">
                ضابط الحفظ وقاعدة التمييز المعتمدة:
              </div>
              <p className="text-[#5B6F6B] dark:text-[#F5F1E8] leading-relaxed text-[11px]">
                {(currentQ as { distinctionRule?: string }).distinctionRule}
              </p>
            </div>
          )}

          {weakVerseFeedback && (
            <div role="status" aria-live="polite" className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              weakVerseFeedback.success
                ? 'bg-[#1C4E46]/10 dark:bg-[#1E4A47]/40 border-[#1C4E46]/30 dark:border-[#E0A96D]/35 text-[#142421] dark:text-[#F5F1E8]'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 text-rose-900 dark:text-rose-200'
            }`}>
              {weakVerseFeedback.success
                ? <Check className="w-4 h-4 text-[#1C4E46] dark:text-[#E0A96D]" />
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
            <div className="flex items-center justify-between pt-4 border-t border-[#1C4E46]/10 dark:border-[#E0A96D]/15 flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddCurrentToWeakVerses}
                  disabled={isSavingWeakVerse}
                  className="min-h-11 text-xs text-[#142421] dark:text-[#E0A96D] hover:border-[#C59B27] font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#C59B27]/40 dark:border-[#E0A96D]/35 bg-[#C59B27]/12 dark:bg-[#E0A96D]/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27]"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-[#C59B27] dark:text-[#E0A96D]" />
                  <span>{isSavingWeakVerse ? 'جارٍ حفظ الآية...' : 'تسجيل هذه الآية في قائمة الآيات الملتبسة'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleNext}
                disabled={isSavingTestResult}
                className="wird-btn-primary flex min-h-11 items-center gap-2 px-6 py-2.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27]"
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

