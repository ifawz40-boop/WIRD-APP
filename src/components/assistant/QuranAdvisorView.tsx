import React, { useState, useEffect, useRef } from 'react';
import {
  Compass,
  BookOpen,
  Calculator,
  ShieldCheck,
  Send,
  Bot,
  User,
  Check,
  Copy,
  RotateCcw,
  RefreshCw,
  Trash2
} from 'lucide-react';
import { UserProfile, MemorizationPlan, DailyLog } from '../../types/quran';
import {
  AdvisorService,
  AdvisorStatus,
  AdvisorChatTurn,
  clearAdvisorChat,
  loadSavedAdvisorChat,
  saveAdvisorChat,
  type AnonymousAdvisorMetrics
} from '../../services/advisorService';
import { RetentionService } from '../../services/retentionService';
import { StorageService } from '../../services/storageService';
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
}) => {
  const currentScope = StorageService.getStorageScope();
  const [selectedTopic, setSelectedTopic] = useState<'ai_advisor' | 'methods' | 'mutashabihat_rules' | 'calculator'>('ai_advisor');
  const [advisorStatus, setAdvisorStatus] = useState<AdvisorStatus | null>(null);
  const [userQuery, setUserQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedTurnIndex, setCopiedTurnIndex] = useState<number | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const [targetAjza, setTargetAjza] = useState<number>(3);
  const [dailyMinutesInput, setDailyMinutesInput] = useState<string>('30');
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const parsedDailyMinutes = Number(dailyMinutesInput);
  const safeDailyMinutes = Number.isFinite(parsedDailyMinutes) && parsedDailyMinutes > 0
    ? Math.min(180, Math.max(15, Math.round(parsedDailyMinutes)))
    : 30;
  const targetPages = targetAjza === 30 ? 604 : Math.max(20, targetAjza * 20);
  const estimatedDays = Math.round(targetPages / Math.max(0.5, safeDailyMinutes / 30));

  const [chatMessages, setChatMessages] = useState<AdvisorChatTurn[]>(() => loadSavedAdvisorChat());

  // Re-hydrate scoped chat history if user switches Guest / Authenticated account
  useEffect(() => {
    setChatMessages(loadSavedAdvisorChat());
  }, [currentScope]);

  // Persist chat history whenever messages update
  useEffect(() => {
    saveAdvisorChat(chatMessages);
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

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

  const buildCurrentAnonymousMetrics = (): AnonymousAdvisorMetrics => {
    const userProfile = profile || StorageService.getProfile();
    const portions = RetentionService.getPortions();
    const weakVerses = RetentionService.getWeakVerses();
    const activePlan = plans.find(p => p.isActive) || plans[0];
    const recentLogs = logs.slice(-7);
    const activeDays = recentLogs.filter(l => (l.minutesSpent || 0) > 0).length;
    return {
      goal: userProfile.memorizationGoal || 'حفظ القرآن الكريم',
      activePlanTitle: activePlan?.title || 'خطة الحفظ',
      memorizedAyahsCount: portions
        .filter(p => p.status !== 'not_memorized')
        .reduce((s, p) => s + (p.endAyah - p.startAyah + 1), 0),
      weakVersesCount: weakVerses.length,
      retentionScore: Math.round((activeDays / 7) * 100),
      dueRevisionsCount: portions.filter(p => p.nextDueDate <= new Date().toISOString().split('T')[0]).length
    };
  };

  const quickActions = [
    {
      id: 'analyze_history',
      title: 'تحليل وتيرة الحفظ والمراجعة',
      desc: 'فحص معدل الإنجاز والانتظام الفعلي',
      contextType: 'general',
      prompt: 'قم بتحليل سجلي القرآني للأسبوع الماضي وحدد نمط الالتزام وأهم نقاط القوة والتحسين.'
    },
    {
      id: 'missed_tasks',
      title: 'تشخيص أسباب صعوبة الالتزام',
      desc: 'معالجة الانقطاع والتفويت بهدوء',
      contextType: 'workload',
      prompt: 'ما هي الأسباب المحتملة لصعوبة الالتزام بالخطة، وكيف أتفادى تفويت المهام القرآنية؟'
    },
    {
      id: 'workload_adjust',
      title: 'تعديل واقعي لحجم الورد اليومي',
      desc: 'موازنة الحفظ والمراجعة مع وقتك',
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
      desc: 'قراءة الدقائق والآيات والأوجه',
      contextType: 'weekly_summary',
      prompt: 'قدم لي ملخصاً إحصائياً دقيقاً لإنجازي الأسبوعي مع نصيحة منهجية للمرحلة القادمة.'
    },
    {
      id: 'session_organizer',
      title: 'توزيع جلسة الحفظ (30 دقيقة)',
      desc: 'تطبيق معادلة المراجعة قبل الجديد',
      contextType: 'session',
      prompt: 'كيف أنظم جلسة الحفظ اليومية في 30 دقيقة لتحقيق أقصى درجات الرسوخ ومنع التفلت؟'
    }
  ];

  const handleRunQuickAction = async (action: typeof quickActions[0]) => {
    if (isLoading) return;
    setLastFailedPrompt(null);

    const userMsg = action.prompt;
    const newMsgs: AdvisorChatTurn[] = [...chatMessages, { sender: 'user', text: userMsg, timestamp: 'الآن' }];
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
        userMsg,
        chatMessages
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
      setLastFailedPrompt(userMsg);
      setChatMessages([
        ...newMsgs,
        {
          sender: 'advisor',
          text: 'تعذر إكمال التحليل الآن. بياناتك المحلية محفوظة بالكامل؛ يمكنك إعادة المحاولة.',
          isFallback: true,
          timestamp: 'الآن'
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendPromptText = async (rawQuery: string) => {
    const query = rawQuery.trim();
    if (!query || isLoading) return;
    setLastFailedPrompt(null);

    const newMsgs: AdvisorChatTurn[] = [...chatMessages, { sender: 'user', text: query, timestamp: 'الآن' }];
    setChatMessages(newMsgs);
    setIsLoading(true);

    try {
      const metrics = buildCurrentAnonymousMetrics();
      const response = await AdvisorService.sendChatMessage(query, chatMessages, metrics);
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
      setLastFailedPrompt(query);
      setChatMessages([
        ...newMsgs,
        {
          sender: 'advisor',
          text: 'تعذر إرسال الرسالة الآن. لم تتأثر بيانات الحفظ؛ اضغط إعادة المحاولة عند استقرار الاتصال.',
          isFallback: true,
          timestamp: 'الآن'
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendCustomMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userQuery.trim() || isLoading) return;
    const q = userQuery.trim();
    setUserQuery('');
    await sendPromptText(q);
  };

  const handleClearConversation = () => {
    setLastFailedPrompt(null);
    setChatMessages(clearAdvisorChat());
  };

  const handleCopyTurn = (text: string, idx: number) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(text);
      setCopiedTurnIndex(idx);
      window.setTimeout(() => {
        setCopiedTurnIndex(prev => (prev === idx ? null : prev));
      }, 2000);
    }
  };

  const methodologies = [
    {
      title: 'طريقة التكرار الشنقيطية',
      description: 'قراءة الآية أو المقطع بصوت مسموع من 15 إلى 30 مرة متتالية حتى تنطبع في الذاكرة السمعية والبصرية، مع عدم تجاوز الآية إلا بعد ربطها بسابقتها.',
      tag: 'الأعلى رسوخاً',
      tips: [
        'اقرأ الآية الأولى 10 مرات نظراً من المصحف بتركيز تام.',
        'اقرأها 10 مرات غيباً مع التثبت من كل حركة.',
        'انتقل للآية التالية وكررها بالقدر ذاته.',
        'اربط الآيتين معاً واقرأهما 5 مرات متتابعة قبل التجاوز.'
      ]
    },
    {
      title: 'قاعدة المراجعة قبل الحفظ الجديد',
      description: 'أكبر أسباب التفلت البدء بالجديد وإهمال الماضي. اجعل ثلثي وقت الجلسة لورد الماضي (المراجعة الصغرى والكبرى) ثم اختم بالحفظ الجديد.',
      tag: 'وقاية من التفلت',
      tips: [
        'خصص 70% من وقت جلستك للمراجعة والتثبيت.',
        'خصص 30% فقط للحفظ الجديد.',
        'ما حُفظ في أسبوع يُراجع يومياً طوال الأسبوع التالي.'
      ]
    },
    {
      title: 'الحفظ المقترن بالسماع المتقن',
      description: 'الاستماع لقارئ متقن كالشيخ الحصري أو المنشاوي قبل البدء بالحفظ لتجنب اللحن الخفي والجلي وترسيخ الوقف والابتداء.',
      tag: 'لتصحيح التلاوة',
      tips: [
        'استمع للمقطع المقرر 3 مرات قبل حفظه.',
        'ردد مع القارئ بصوت خافت مع متابعة الرسم في المصحف.',
        'اختبر نفسك غيباً عبر إخفاء الكلمات في جلسة الحفظ.'
      ]
    }
  ];

  const mnemonicRules = [
    {
      rule: 'قاعدة المجاورة والموافقة',
      explanation: 'تأتي الآية موافقة للفظ الأقرب إليها في السياق ذاته أو الآية التي سبقتها مباشرة.'
    },
    {
      rule: 'قاعدة الزيادة لموضع التفصيل',
      explanation: 'إذا ورد لفظ مختصر في موضع ومفصل بزيادة حرف أو كلمة في موضع آخر، فالزيادة غالباً في السورة الأطول أو السياق الأكثر تفصيلاً.'
    },
    {
      rule: 'قاعدة الترتيب الهجائي',
      explanation: 'في كثير من الألفاظ المتشابهة في المصحف، يتقدم الموضع المبدوء بالحرف الأسبق هجائياً.'
    },
    {
      rule: 'قاعدة الربط البصري بمواضع الصفحة',
      explanation: 'تثبيت موقع الآية في أعلى الوجه أو وسطه أو ختامه يمنع التردد والالتباس أثناء التلاوة غيباً.'
    }
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* 1. Calm Editorial Header & Navigation */}
      <div className="wird-card rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-[var(--wird-text)] flex items-center gap-2 font-editorial-ar">
              <Compass className="w-5 h-5 text-[var(--wird-primary)] dark:text-[var(--wird-accent)] shrink-0" />
              <span>المستشار القرآني ومنهجيات الحفظ والتثبيت</span>
            </h2>
            <p className="text-xs text-[var(--wird-muted)] mt-1">
              تحليل منهجي مبني على بيانات حفظك الفعلية وخلاصة قواعد الإقراء والتكرار المتباعد
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 text-xs font-semibold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
            <span>
              {advisorStatus?.available ? 'متصل — Gemini 4 Hydrogen' : 'يعمل محلياً دون اتصال'}
            </span>
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
                  ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] border-transparent font-bold'
                  : 'bg-[var(--wird-surface-muted)] border-[var(--wird-border)] text-[var(--wird-muted)] hover:text-[var(--wird-text)]'
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
                  ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] border-transparent font-bold'
                  : 'bg-[var(--wird-surface-muted)] border-[var(--wird-border)] text-[var(--wird-muted)] hover:text-[var(--wird-text)]'
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
                  ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] border-transparent font-bold'
                  : 'bg-[var(--wird-surface-muted)] border-[var(--wird-border)] text-[var(--wird-muted)] hover:text-[var(--wird-text)]'
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
                  ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] border-transparent font-bold'
                  : 'bg-[var(--wird-surface-muted)] border-[var(--wird-border)] text-[var(--wird-muted)] hover:text-[var(--wird-text)]'
              }`}
            >
              <Calculator className="w-4 h-4" />
              <span>حاسبة التخطيط القرآني</span>
            </button>
          </div>
        </HorizontalScrollRail>
      </div>

      {/* VIEW 1: AI ADVISOR & PERSISTED CONVERSATION */}
      {selectedTopic === 'ai_advisor' && (
        <div className="space-y-4">
          <p className="rounded-xl border border-[var(--wird-border-gold)] bg-[var(--wird-accent-soft)] px-4 py-2.5 text-[11px] leading-6 text-[var(--wird-text)]">
            المستشار مخصص لتنظيم الحفظ والمراجعة فقط؛ لا تعتمد عليه في نقل نص القرآن أو تفسيره أو إصدار أحكام شرعية.
          </p>

          {/* Quick Action Capabilities */}
          <div className="wird-card rounded-2xl p-5 space-y-3">
            <div className="text-xs font-bold text-[var(--wird-text)] flex flex-wrap items-center justify-between gap-2">
              <span>استشارات منهجية سريعة بنقرة واحدة</span>
              <span className="text-[11px] font-normal text-[var(--wird-muted)]">تستند إلى مؤشراتك المحفوظة</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {quickActions.map(action => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => void handleRunQuickAction(action)}
                  disabled={isLoading}
                  className="min-h-11 p-3.5 bg-[var(--wird-surface-muted)] hover:border-[var(--wird-border-strong)] rounded-xl border border-[var(--wird-border)] text-right transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-ring)]"
                >
                  <div className="font-bold text-xs text-[var(--wird-text)]">
                    {action.title}
                  </div>
                  <div className="text-[11px] text-[var(--wird-muted)] mt-0.5">
                    {action.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Chat Workspace */}
          <div className="wird-card rounded-2xl p-4 sm:p-5 flex flex-col min-h-[440px] max-h-[620px]">
            <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-[var(--wird-border)]">
              <span className="text-xs font-bold text-[var(--wird-text)]">
                سجل الاستشارة المحفوظ ({chatMessages.length})
              </span>
              {chatMessages.length > 1 && (
                <button
                  type="button"
                  onClick={handleClearConversation}
                  disabled={isLoading}
                  className="min-h-9 px-3 py-1 rounded-lg bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] hover:border-[var(--wird-border-strong)] text-[11px] font-semibold text-[var(--wird-muted)] hover:text-[var(--wird-text)] inline-flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>محادثة جديدة</span>
                </button>
              )}
            </div>

            {/* Messages Thread */}
            <div
              ref={chatScrollRef}
              role="log"
              aria-label="محادثة المستشار القرآني"
              aria-live="polite"
              aria-relevant="additions"
              className="flex-1 overflow-y-auto space-y-4 px-1"
            >
              {chatMessages.map((msg, idx) => {
                const isUser = msg.sender === 'user';
                return (
                  <div
                    key={idx}
                    className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        isUser
                          ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)]'
                          : 'bg-[var(--wird-surface-muted)] text-[var(--wird-primary)] dark:text-[var(--wird-accent)] border border-[var(--wird-border)]'
                      }`}
                    >
                      {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>

                    <div
                      className={`p-4 rounded-2xl max-w-[86%] text-xs sm:text-[13px] leading-relaxed space-y-2 ${
                        isUser
                          ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] rounded-tl-xs font-medium'
                          : 'bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] text-[var(--wird-text)] rounded-tr-xs'
                      }`}
                    >
                      <div className="whitespace-pre-line leading-7">
                        {msg.text}
                      </div>

                      {!isUser && (
                        <div className="pt-2 border-t border-[var(--wird-border)] flex items-center justify-between gap-3 text-[10px] text-[var(--wird-muted)]">
                          <span>
                            {msg.isFallback
                              ? 'تم التحليل عبر المحرك المنهجي المحلي'
                              : 'تحليل سياقي عبر Gemini 4 Hydrogen'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyTurn(msg.text, idx)}
                            aria-label="نسخ رد المستشار"
                            className="inline-flex items-center gap-1 hover:text-[var(--wird-text)] transition-colors"
                          >
                            {copiedTurnIndex === idx ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                <span>تم النسخ</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>نسخ</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {isLoading && (
                <div role="status" className="flex items-center gap-2 text-xs text-[var(--wird-muted)] py-2">
                  <RefreshCw className="w-3.5 h-3.5 text-[var(--wird-accent)] animate-spin" />
                  <span>يحلل المستشار سؤالك ومؤشرات تقدمك...</span>
                </div>
              )}

              {lastFailedPrompt && !isLoading && (
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => void sendPromptText(lastFailedPrompt)}
                    className="min-h-9 px-3 py-1.5 rounded-xl border border-[var(--wird-border-gold)] bg-[var(--wird-accent-soft)] text-xs font-bold text-[var(--wird-text)] inline-flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>إعادة محاولة آخر سؤال</span>
                  </button>
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
                placeholder="اكتب سؤالك عن خطتك، علاج النسيان، أو ضبط المتشابهات..."
                disabled={isLoading}
                className="flex-1 min-h-11 px-4 py-2.5 bg-[var(--wird-surface-muted)] rounded-xl border border-[var(--wird-border)] text-xs sm:text-sm text-[var(--wird-text)] placeholder:text-[var(--wird-muted)]/70 focus:outline-none focus:ring-2 focus:ring-[var(--wird-ring)]"
              />
              <button
                type="submit"
                disabled={isLoading || !userQuery.trim()}
                aria-label="إرسال الرسالة"
                className="min-h-11 min-w-11 p-2.5 bg-[var(--wird-primary)] hover:bg-[var(--wird-primary-hover)] disabled:opacity-50 text-[var(--wird-primary-ink)] rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-ring)]"
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
                <h3 className="font-bold text-base text-[var(--wird-text)] font-editorial-ar">
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
              <div key={idx} className="wird-card rounded-2xl p-5 space-y-2">
                <div className="font-bold text-sm text-[var(--wird-primary)] dark:text-[var(--wird-accent)] flex items-center gap-2">
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
                          ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] border-transparent'
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

          {/* Result Summary */}
          <div className="p-4 sm:p-5 bg-[var(--wird-surface-muted)] rounded-2xl border border-[var(--wird-border)] space-y-2.5 text-xs">
            <div className="font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
              الخلاصة التقديرية للحفظ المتزن:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="rounded-xl bg-[var(--wird-surface)] px-3.5 py-2.5 border border-[var(--wird-border)]">
                <span className="text-[var(--wird-muted)]">المدة التقديرية: </span>
                <span className="font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] font-mono tabular-nums">
                  {estimatedDays} يوماً
                </span>
              </div>
              <div className="rounded-xl bg-[var(--wird-surface)] px-3.5 py-2.5 border border-[var(--wird-border)]">
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
