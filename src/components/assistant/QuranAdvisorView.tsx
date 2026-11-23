import React, { useState, useEffect } from 'react';
import { 
  Compass, 
  Sparkles, 
  BookOpen, 
  HelpCircle, 
  Lightbulb, 
  CheckCircle, 
  ArrowLeft,
  Calculator,
  ShieldCheck,
  Send,
  Bot,
  User,
  AlertCircle,
  TrendingUp,
  Clock,
  Layers,
  Check,
  RotateCcw,
  RefreshCw,
  Zap
} from 'lucide-react';
import { UserProfile, MemorizationPlan, DailyLog, PortionStatusRecord, WeakVerseItem } from '../../types/quran';
import { AdvisorService, AdvisorStatus } from '../../services/advisorService';
import { RetentionService } from '../../services/retentionService';
import { StorageService } from '../../services/storageService';
import { getLocalDateString } from '../../services/unifiedPortionService';
import { HorizontalScrollRail } from '../shared/HorizontalScrollRail';

interface QuranAdvisorViewProps {
  profile?: UserProfile;
  plans?: MemorizationPlan[];
  logs?: DailyLog[];
  onStartSessionWithSurah?: (surahNumber: number) => void;
}

export const QuranAdvisorView: React.FC<QuranAdvisorViewProps> = ({
  profile,
  plans = [],
  logs = [],
  onStartSessionWithSurah
}) => {
  const [selectedTopic, setSelectedTopic] = useState<'ai_advisor' | 'methods' | 'mutashabihat_rules' | 'calculator'>('ai_advisor');
  const [advisorStatus, setAdvisorStatus] = useState<AdvisorStatus | null>(null);
  const [userQuery, setUserQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [targetAjza, setTargetAjza] = useState<number>(3);
  const [dailyMinutesInput, setDailyMinutesInput] = useState<string>('30');

  const parsedDailyMinutes = Number(dailyMinutesInput);
  const safeDailyMinutes = Number.isFinite(parsedDailyMinutes) && parsedDailyMinutes > 0
    ? Math.min(180, Math.max(15, Math.round(parsedDailyMinutes)))
    : 30;
  const targetPages = targetAjza === 30 ? 604 : Math.max(20, targetAjza * 20);
  const estimatedDays = Math.round(targetPages / Math.max(0.5, safeDailyMinutes / 30));

  const [chatMessages, setChatMessages] = useState<Array<{ 
    sender: 'user' | 'advisor'; 
    text: string; 
    isFallback?: boolean;
    timestamp?: string;
  }>>([
    {
      sender: 'advisor',
      text: 'مرحباً بك في المستشار القرآني الذكي لمنصة وِرد. أنا هنا لمساعدتك على تحليل وتيرة حفظك، تشخيص أسباب التعثر، اقتراح التعديلات الواقعية لجدولك، وتحديد أولويات المراجعة العاجلة وفق منهجيات الحفّاظ المعتمدة.',
      timestamp: 'الآن'
    }
  ]);

  // Check server AI status on mount
  useEffect(() => {
    let active = true;
    AdvisorService.checkStatus().then(status => {
      if (active) setAdvisorStatus(status);
    });
    return () => {
      active = false;
    };
  }, []);

  // Quick Action Buttons corresponding to the 8 required AI capabilities
  const quickActions = [
    {
      id: 'analyze_history',
      title: 'تحليل وتيرة الحفظ والمراجعة',
      desc: 'فحص معدل الإنجاز والانتظام',
      contextType: 'general',
      prompt: 'قم بتحليل سجلي القرآني للأسبوع الماضي وحدد نمط الالتزام وأهم نقاط القوة والتحسين.'
    },
    {
      id: 'missed_tasks',
      title: 'كشف أسباب صعوبة الالتزام بالخطة',
      desc: 'تشخيص أسباب التفويت والضغط',
      contextType: 'workload',
      prompt: 'ما هي الأسباب المحتملة لصعوبة الالتزام بالخطة، وكيف أتفادى تفويت المهام القرآنية؟'
    },
    {
      id: 'workload_adjust',
      title: 'اقتراح تعديل واقعي لحجم الحفظ',
      desc: 'إعادة موازنة المقدار اليومي',
      contextType: 'workload',
      prompt: 'اقترح تعديلاً واقعياً ومتوازناً لمقدار الحفظ والمراجعة اليومي ليتناسب مع وقتي المتاح دون إرهاق.'
    },
    {
      id: 'revision_priorities',
      title: 'تحديد أولويات المراجعة والتثبيت',
      desc: 'فرز المقاطع والآيات الأكثر حاجة',
      contextType: 'priorities',
      prompt: 'ما هي أولويات المراجعة العاجلة لمقاطعي المتتبعة اليوم بناءً على درجات الرسوخ وتكرار الأخطاء؟'
    },
    {
      id: 'weekly_summary',
      title: 'ملخص الإنجاز الأسبوعي',
      desc: 'تقرير الدقائق والآيات والأوجه',
      contextType: 'weekly_summary',
      prompt: 'قدم لي ملخصاً إحصائياً دقيقاً لإنجازي الأسبوعي مع نصيحة منهجية للمرحلة القادمة.'
    },
    {
      id: 'session_organizer',
      title: 'تنظيم وتوزيع جلسة الحفظ (30 د)',
      desc: 'هيكل الجلسة الذهبي (70/30)',
      contextType: 'session',
      prompt: 'كيف أنظم جلسة الحفظ اليومية في 30 دقيقة لتحقيق أقصى درجات الرسوخ ومنع التفلت؟'
    }
  ];

  // Execute an AI Analysis or Quick Action
  const handleRunQuickAction = async (action: typeof quickActions[0]) => {
    if (isLoading) return;

    const userMsg = action.prompt;
    const newMsgs = [...chatMessages, { sender: 'user' as const, text: userMsg, timestamp: 'الآن' }];
    setChatMessages(newMsgs);
    setIsLoading(true);

    const userProfile: UserProfile = profile || StorageService.getProfile();

    const portions = RetentionService.getPortions();
    const weakVerses = RetentionService.getWeakVerses();

    try {
      const response = await AdvisorService.analyzeProgress(
        action.contextType,
        logs,
        userProfile,
        plans,
        portions,
        weakVerses,
        userMsg
      );
      setChatMessages([
        ...newMsgs,
        {
          sender: 'advisor',
          text: response.text,
          isFallback: response.isFallback,
          timestamp: 'الآن'
        }
      ]);
    } catch {
      setChatMessages([
        ...newMsgs,
        {
          sender: 'advisor',
          text: 'تعذر إكمال التحليل الآن. بياناتك المحلية لم تتغير؛ حاول مرة أخرى بعد قليل.',
          isFallback: true,
          timestamp: 'الآن'
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Submit custom user message
  const handleSendCustomMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userQuery.trim() || isLoading) return;

    const query = userQuery.trim();
    setUserQuery('');

    const newMsgs = [...chatMessages, { sender: 'user' as const, text: query, timestamp: 'الآن' }];
    setChatMessages(newMsgs);
    setIsLoading(true);

    try {
      const response = await AdvisorService.sendChatMessage(query, chatMessages);
      setChatMessages([
        ...newMsgs,
        {
          sender: 'advisor',
          text: response.text,
          isFallback: response.isFallback,
          timestamp: 'الآن'
        }
      ]);
    } catch {
      setChatMessages([
        ...newMsgs,
        {
          sender: 'advisor',
          text: 'تعذر إرسال الرسالة الآن. لم تتغير بيانات الحفظ؛ يمكنك إعادة المحاولة.',
          isFallback: true,
          timestamp: 'الآن'
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Classical Methodologies
  const methodologies = [
    {
      title: "طريقة التكرار الشنقيطية (سر الحفاظ الكبار)",
      description: "تقوم على قراءة الآية أو اللوح الواحد بصوت مسموع من 15 إلى 30 مرة متتالية حتى تنطبع في الذاكرة الصورية والسمعية، ثم عدم الانتقال للآية التالية إلا بعد ربطها بسابقتها.",
      tag: "الأعلى رسوخاً",
      tips: [
        "اقرأ الآية الأولى 10 مرات نظراً من المصحف بتركيز تام.",
        "اقرأها 10 مرات غيباً مع التثبت من كل حركة.",
        "انتقل للآية التالية وكررها بنفس القدر.",
        "اربط الآيتين معاً واقرأهما 5 مرات متتابعة قبل التجاوز."
      ]
    },
    {
      title: "قاعدة «المراجعة قبل الحفظ الجديد»",
      description: "خطأ معظم من ينسى القرآن هو البدء بالحفظ الجديد وإهمال الماضي. اجعل أول ثلثي الجلسة مخصصة لورد الماضي (المراجعة الصغرى والكبرى) ثم ابدأ بجديدك.",
      tag: "وقاية من النسيان",
      tips: [
        "خصص 70% من وقت جلستك للمراجعة والتثبيت.",
        "خصص 30% فقط للحفظ الجديد.",
        "ما حُفظ في أسبوع يُراجع يومياً طوال الأسبوع التالي."
      ]
    },
    {
      title: "الحفظ الصوتي بالاستماع المقترن",
      description: "الاستماع لقارئ متقن (كالشيخ الحصري أو الشيخ المنشاوي أو الشيخ العفاسي) قبل البدء في الحفظ لتفادي الأخطاء اللغوية وحفظ التشكيل السليم.",
      tag: "للمبتدئين والأطفال",
      tips: [
        "استمع للمقطع المقرر 3 مرات قبل فتحه من المصحف.",
        "ردد مع القارئ بصوت خافت (الترتيل الترديدي).",
        "تحقق من مواضع الوقف والابتداء الصحيحة."
      ]
    }
  ];

  // Mutashabihat rules
  const mnemonicRules = [
    {
      rule: "قاعدة المجاورة والموافقة",
      explanation: "تأتي الآية موافقة للفظ الأقرب إليها في نفس السياق أو الآية التي سبقتها مباشرة."
    },
    {
      rule: "قاعدة الزيادة لموضع الزيادة",
      explanation: "إذا ورد لفظ مختصر في موضع ومفصل بزيادة حرف أو كلمة في موضع آخر، فالزيادة غالباً تكون في السورة الأطول أو السياق الأكثر تفصيلاً."
    },
    {
      rule: "قاعدة الترتيب الهجائي",
      explanation: "في كثير من الألفاظ المتشابهة في القرآن، يتقدم في المصحف الحرف الأسبق هجائياً."
    },
    {
      rule: "قاعدة ما تكرر تقرر بالربط البصري",
      explanation: "تلوين أو تدوين موضع الشبه بقلم رصاص خفيف في هامش مصحفك يمنع التردد أثناء القراءة في الصلاة."
    }
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* 1. Header & AI Availability Badge */}
      <div className="wird-card rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-[var(--wird-text)] flex items-center gap-2 font-quran">
              <Compass className="w-5 h-5 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
              المستشار القرآني ومنهجيات الحفظ والتثبيت
            </h2>
            <p className="text-xs text-[var(--wird-muted)] mt-1">
              إرشاد ذكي مبني على بياناتك الفعلية وخلاصة تجارب أئمة الإقراء (الشناقطة، الشاطبي، ابن الجزري)
            </p>
          </div>

          {/* AI Availability Text (unboxed, zero pulsing dots) */}
          <div className="flex items-center gap-2 shrink-0 text-xs font-bold">
            {advisorStatus?.available ? (
              <span className="inline-flex items-center gap-1.5 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
                <Sparkles className="w-3.5 h-3.5" />
                <span>المساعد الذكي متاح</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[var(--wird-accent-hover)] dark:text-[var(--wird-accent)]">
                <Zap className="w-3.5 h-3.5 text-[var(--wird-accent)]" />
                <span>النمط الذاتي الحتمي</span>
              </span>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <HorizontalScrollRail ariaLabel="التنقل داخل المستشار القرآني" activeKey={selectedTopic}>
          <div role="group" aria-label="أقسام المستشار القرآني" className="flex items-center gap-2 pb-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setSelectedTopic('ai_advisor')}
              aria-pressed={selectedTopic === 'ai_advisor'}
              className={`shrink-0 snap-start flex min-h-11 items-center gap-1.5 px-4 py-2 rounded-xl border transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-ring)] ${
                selectedTopic === 'ai_advisor'
                  ? 'bg-[var(--wird-primary)] text-white border-[var(--wird-border-gold)] shadow-xs font-bold'
                  : 'bg-[var(--wird-surface-muted)] border-[var(--wird-border)] text-[var(--wird-muted)] hover:text-[var(--wird-text)] dark:hover:text-white'
              }`}
            >
              <Bot className="w-4 h-4" />
              <span>المستشار الذكي وتحليل وتيرة الحفظ</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedTopic('methods')}
              aria-pressed={selectedTopic === 'methods'}
              className={`shrink-0 snap-start flex min-h-11 items-center gap-1.5 px-4 py-2 rounded-xl border transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-ring)] ${
                selectedTopic === 'methods'
                  ? 'bg-[var(--wird-primary)] text-white border-[var(--wird-border-gold)] shadow-xs font-bold'
                  : 'bg-[var(--wird-surface-muted)] border-[var(--wird-border)] text-[var(--wird-muted)] hover:text-[var(--wird-text)] dark:hover:text-white'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>منهجيات الحفظ المعتمدة</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedTopic('mutashabihat_rules')}
              aria-pressed={selectedTopic === 'mutashabihat_rules'}
              className={`shrink-0 snap-start flex min-h-11 items-center gap-1.5 px-4 py-2 rounded-xl border transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-ring)] ${
                selectedTopic === 'mutashabihat_rules'
                  ? 'bg-[var(--wird-primary)] text-white border-[var(--wird-border-gold)] shadow-xs font-bold'
                  : 'bg-[var(--wird-surface-muted)] border-[var(--wird-border)] text-[var(--wird-muted)] hover:text-[var(--wird-text)] dark:hover:text-white'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>قواعد ضبط المتشابهات</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedTopic('calculator')}
              aria-pressed={selectedTopic === 'calculator'}
              className={`shrink-0 snap-start flex min-h-11 items-center gap-1.5 px-4 py-2 rounded-xl border transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-ring)] ${
                selectedTopic === 'calculator'
                  ? 'bg-[var(--wird-primary)] text-white border-[var(--wird-border-gold)] shadow-xs font-bold'
                  : 'bg-[var(--wird-surface-muted)] border-[var(--wird-border)] text-[var(--wird-muted)] hover:text-[var(--wird-text)] dark:hover:text-white'
              }`}
            >
              <Calculator className="w-4 h-4" />
              <span>حاسبة التخطيط القرآني</span>
            </button>
          </div>
        </HorizontalScrollRail>
      </div>

      {/* VIEW 1: AI ADVISOR & CHAT WITH 8 CAPABILITIES */}
      {selectedTopic === 'ai_advisor' && (
        <div className="space-y-4">
          <p className="rounded-xl border border-[var(--wird-border-gold)] bg-[var(--wird-accent-soft)] px-4 py-2.5 text-[11px] leading-6 text-[var(--wird-text)]">
            المستشار مخصص لتنظيم الحفظ والمراجعة فقط؛ لا تعتمد عليه في نقل نص القرآن أو تفسيره أو إصدار أحكام شرعية.
          </p>

          {/* Quick Action Capabilities Strip */}
          <div className="wird-card rounded-2xl p-5 space-y-3">
            <div className="text-xs font-bold text-[var(--wird-text)] flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[var(--wird-accent)]" />
                <span>تحليلات واستشارات سريعة بنقرة واحدة:</span>
              </span>
              <span className="text-[10px] font-medium text-[var(--wird-muted)]">تستند حصرًا لبياناتك المحفوظة</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {quickActions.map(action => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => handleRunQuickAction(action)}
                  disabled={isLoading}
                  className="min-h-11 p-3.5 bg-[var(--wird-surface-muted)] hover:bg-[var(--wird-surface-muted)] rounded-xl border border-[var(--wird-border)] hover:border-[var(--wird-border-gold)]/50 dark:hover:border-[#E0A96D]/50 text-right transition-all group disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-ring)]"
                >
                  <div className="font-bold text-xs text-[var(--wird-text)] group-hover:text-[var(--wird-primary)] dark:text-[var(--wird-accent)] dark:group-hover:text-[#E0A96D]">
                    {action.title}
                  </div>
                  <div className="text-[10px] text-[var(--wird-muted)] mt-1">
                    {action.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Chat Window */}
          <div className="wird-card rounded-2xl p-4 sm:p-5 flex flex-col min-h-[420px] max-h-[580px]">
            {/* Messages Thread */}
            <div role="log" aria-label="محادثة المستشار القرآني" aria-live="polite" aria-relevant="additions" className="flex-1 overflow-y-auto space-y-4 pr-1 pl-1">
              {chatMessages.map((msg, idx) => {
                const isUser = msg.sender === 'user';
                return (
                  <div
                    key={idx}
                    className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      isUser
                        ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)]'
                        : 'bg-[var(--wird-surface-muted)] text-[var(--wird-primary)] dark:text-[var(--wird-accent)] border border-[#C59B27]/35'
                    }`}>
                      {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>

                    <div className={`p-4 rounded-2xl max-w-[85%] text-xs leading-relaxed space-y-1.5 shadow-2xs ${
                      isUser
                        ? 'bg-[var(--wird-primary)] text-white rounded-tl-xs font-medium border border-[#C59B27]/30'
                        : 'bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] text-[var(--wird-text)] rounded-tr-xs'
                    }`}>
                      <div className="whitespace-pre-line leading-relaxed font-sans">
                        {msg.text}
                      </div>

                      {!isUser && msg.isFallback && (
                        <div className="text-[10px] text-[var(--wird-muted)] pt-1.5 border-t border-[var(--wird-border)] flex items-center gap-1">
                          <Check className="w-3 h-3 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
                          <span>إرشاد مبني على الخوارزمية الحتمية المدمجة</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {isLoading && (
                <div role="status" className="flex items-center gap-2 text-xs text-[var(--wird-muted)] py-2">
                  <RefreshCw className="w-3.5 h-3.5 text-[var(--wird-accent)] animate-spin" />
                  <span>المستشار يحلل بيانات الحفظ والمراجعة...</span>
                </div>
              )}
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendCustomMessage} className="mt-4 pt-3 border-t border-[var(--wird-border)] flex items-center gap-2">
              <input
                type="text"
                aria-label="رسالتك إلى المستشار القرآني"
                maxLength={500}
                value={userQuery}
                onChange={e => setUserQuery(e.target.value)}
                placeholder="اسأل المستشار القرآني عن طرائق الحفظ، ضبط المتشابهات، أو تنظيم وقتك..."
                disabled={isLoading}
                className="flex-1 min-h-11 px-4 py-2.5 bg-[var(--wird-surface-muted)] rounded-xl border border-[var(--wird-border)] text-xs text-[var(--wird-text)] placeholder:text-[var(--wird-muted)]/60 dark:placeholder:text-[#8B9E9B]/60 focus:outline-none focus:ring-2 focus:ring-[#C59B27]"
              />
              <button
                type="submit"
                disabled={isLoading || !userQuery.trim()}
                aria-label="إرسال الرسالة"
                className="min-h-11 min-w-11 p-2.5 bg-[var(--wird-primary)] hover:bg-[var(--wird-primary-hover)] disabled:opacity-50 text-[var(--wird-primary-ink)] rounded-xl transition-colors shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-ring)]"
                title="إرسال"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* VIEW 2: METHODOLOGIES */}
      {selectedTopic === 'methods' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {methodologies.map((m, idx) => (
            <div key={idx} className="wird-card rounded-2xl p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
                  {m.tag}
                </span>
                <h3 className="font-bold text-sm text-[var(--wird-text)] font-quran">
                  {m.title}
                </h3>
                <p className="text-xs text-[var(--wird-muted)] leading-relaxed">
                  {m.description}
                </p>
              </div>

              <div className="bg-[var(--wird-surface-muted)] p-3.5 rounded-xl border border-[var(--wird-border)] space-y-1.5 text-xs text-[var(--wird-text)]">
                <div className="font-bold text-[11px] text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">خطوات التطبيق:</div>
                {m.tips.map((tip, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[11px] leading-relaxed">
                    <span className="text-[var(--wird-accent)] font-bold">•</span>
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* VIEW 3: MUTASHABIHAT RULES */}
      {selectedTopic === 'mutashabihat_rules' && (
        <div className="space-y-4">
          <p className="rounded-xl border border-[var(--wird-border-gold)] bg-[var(--wird-accent-soft)] px-4 py-2.5 text-[11px] leading-6 text-[var(--wird-text)]">
            هذه الملاحظات وسائل تذكّر مساعدة وليست قواعد قطعية لضبط ألفاظ القرآن؛ المرجع دائماً المصحف المعتمد والمراجعة على شيخ متقن.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mnemonicRules.map((rule, idx) => (
              <div key={idx} className="wird-card rounded-2xl p-5 border border-[var(--wird-border-gold)] space-y-2">
                <div className="font-bold text-sm text-[var(--wird-accent-hover)] dark:text-[var(--wird-accent)] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[var(--wird-accent)]" />
                  <span>{rule.rule}</span>
                </div>
                <p className="text-xs text-[var(--wird-muted)] leading-relaxed">
                  {rule.explanation}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 4: CALCULATOR */}
      {selectedTopic === 'calculator' && (
        <div className="wird-card rounded-2xl p-5 sm:p-6 space-y-5">
          <div>
            <h3 className="font-bold text-base text-[var(--wird-text)] flex items-center gap-2">
              <Calculator className="w-5 h-5 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
              <span>حاسبة التخطيط القرآني التقديرية</span>
            </h3>
            <p className="text-xs text-[var(--wird-muted)] mt-1">
              احسب الزمن المتوقع لإتمام هدفك القرآني بحسب الوقت المتاح يومياً
            </p>
          </div>

          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[var(--wird-text)] font-semibold mb-1.5">
                  الهدف القرآني المراد حفظه:
                </label>
                <select
                  aria-label="الهدف القرآني المراد حفظه"
                  value={targetAjza}
                  onChange={e => setTargetAjza(Number(e.target.value))}
                  className="w-full min-h-11 px-3 py-2 bg-[var(--wird-surface-muted)] text-[var(--wird-text)] rounded-xl border border-[var(--wird-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-ring)]"
                >
                  <option value={1}>جزء واحد (20 صفحة)</option>
                  <option value={3}>3 أجزاء (60 صفحة)</option>
                  <option value={5}>5 أجزاء (100 صفحة)</option>
                  <option value={10}>10 أجزاء (200 صفحة)</option>
                  <option value={30}>القرآن كاملاً (604 صفحة)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-[var(--wird-text)] font-semibold">
                  الوقت المتاح يومياً (دقائق):
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    aria-label="الوقت المتاح يومياً بالدقائق"
                    min={15}
                    max={180}
                    value={dailyMinutesInput}
                    onChange={e => setDailyMinutesInput(e.target.value)}
                    onBlur={() => setDailyMinutesInput(String(safeDailyMinutes))}
                    className="w-28 min-h-11 px-3 py-2 bg-[var(--wird-surface-muted)] text-[var(--wird-text)] rounded-xl border border-[var(--wird-border)] font-mono tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-ring)]"
                  />
                  {[15, 30, 45, 60, 90].map(mins => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setDailyMinutesInput(String(mins))}
                      aria-pressed={Number(dailyMinutesInput) === mins}
                      className={`min-h-11 px-3 py-2 rounded-xl border font-bold font-mono tabular-nums transition-colors ${
                        Number(dailyMinutesInput) === mins
                          ? 'bg-[var(--wird-primary)] text-white border-[var(--wird-border-gold)]'
                          : 'bg-[var(--wird-surface-muted)] text-[var(--wird-muted)] border-[var(--wird-border)]'
                      }`}
                    >
                      {mins} د
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Result Card */}
          <div className="p-4 sm:p-5 bg-[var(--wird-primary)]/8 dark:bg-[var(--wird-primary)] rounded-2xl border border-[var(--wird-border-gold)] space-y-2.5 text-xs">
            <div className="font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
              الخلاصة التقديرية للحفظ المتزن:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="rounded-xl bg-white/80 dark:bg-[var(--wird-surface-muted)] px-3.5 py-2.5 border border-[var(--wird-border)]">
                <span className="text-[var(--wird-muted)]">المدة التقديرية: </span>
                <span className="font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] font-mono tabular-nums">
                  {estimatedDays} يوماً
                </span>
              </div>
              <div className="rounded-xl bg-white/80 dark:bg-[var(--wird-surface-muted)] px-3.5 py-2.5 border border-[var(--wird-border)]">
                <span className="text-[var(--wird-muted)]">المقدار اليومي المقترح: </span>
                <span className="font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
                  {safeDailyMinutes >= 45 ? 'صفحة كاملة' : safeDailyMinutes >= 25 ? 'نصف صفحة' : '3-5 آيات'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
