import { DeterministicAdvisorEngine, PerformanceAnalysisReport } from './deterministicAdvisor';
import { DailyLog, UserProfile, PortionStatusRecord, WeakVerseItem, MemorizationPlan } from '../types/quran';
import { StorageService } from './storageService';

export interface AdvisorStatus {
  available: boolean;
  mode: 'gemini_free' | 'deterministic_fallback';
  model: string;
  message: string;
}

export interface AdvisorChatTurn {
  id?: string;
  sender: 'user' | 'advisor';
  text: string;
  isFallback?: boolean;
  timestamp?: string;
}

export interface AdvisorResponse {
  success: boolean;
  text: string;
  isFallback: boolean;
  code?: 'SUCCESS' | 'QUOTA_EXHAUSTED' | 'RATE_LIMITED' | 'KEY_MISSING' | 'FALLBACK_USED';
  report?: PerformanceAnalysisReport;
}

export interface AnonymousAdvisorMetrics {
  goal?: string;
  activePlanTitle?: string;
  memorizedAyahsCount?: number;
  weakVersesCount?: number;
  retentionScore?: number;
  dueRevisionsCount?: number;
}

const ADVISOR_CHAT_STORAGE_KEY = 'wird.advisor.chat.v1';
const MAX_PERSISTED_CHAT_TURNS = 40;
const MAX_CHAT_WIRE_BYTES = 3600;
const MAX_CHAT_HISTORY_ITEMS = 6;
const MAX_CHAT_HISTORY_ITEM_CHARS = 220;

export const INITIAL_ADVISOR_GREETING: AdvisorChatTurn = {
  id: 'welcome',
  sender: 'advisor',
  text: 'مرحباً بك في المستشار القرآني لمنصة «وِرد». يمكنني تحليل وتيرة حفظك ومراجعتك، تشخيص أسباب التفلت أو التراكم، اقتراح تعديل واقعي لجدولك اليومي، ومساعدتك في ضبط المتشابهات وفق منهجيات الإقراء المعتمدة.',
  timestamp: 'الآن'
};

export function loadSavedAdvisorChat(): AdvisorChatTurn[] {
  try {
    const scopedKey = StorageService.resolveScopedKey(ADVISOR_CHAT_STORAGE_KEY);
    if (typeof localStorage === 'undefined') return [INITIAL_ADVISOR_GREETING];
    const raw = localStorage.getItem(scopedKey);
    if (!raw) return [INITIAL_ADVISOR_GREETING];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [INITIAL_ADVISOR_GREETING];
    const valid = parsed
      .filter(
        (item): item is AdvisorChatTurn =>
          Boolean(
            item &&
              typeof item === 'object' &&
              (item.sender === 'user' || item.sender === 'advisor') &&
              typeof item.text === 'string' &&
              item.text.trim().length > 0
          )
      )
      .slice(-MAX_PERSISTED_CHAT_TURNS);
    return valid.length > 0 ? valid : [INITIAL_ADVISOR_GREETING];
  } catch {
    return [INITIAL_ADVISOR_GREETING];
  }
}

export function saveAdvisorChat(turns: AdvisorChatTurn[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const scopedKey = StorageService.resolveScopedKey(ADVISOR_CHAT_STORAGE_KEY);
    const bounded = turns.slice(-MAX_PERSISTED_CHAT_TURNS);
    localStorage.setItem(scopedKey, JSON.stringify(bounded));
  } catch {
    // Ignore quota errors on auxiliary chat log
  }
}

export function clearAdvisorChat(): AdvisorChatTurn[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const scopedKey = StorageService.resolveScopedKey(ADVISOR_CHAT_STORAGE_KEY);
      localStorage.removeItem(scopedKey);
    }
  } catch {
    // Ignore restricted storage
  }
  return [INITIAL_ADVISOR_GREETING];
}

export function buildBoundedChatPayload(
  message: string,
  history: Array<{ sender: 'user' | 'advisor'; text: string }>,
  userData?: AnonymousAdvisorMetrics
): {
  message: string;
  history: Array<{ sender: 'user' | 'advisor'; text: string }>;
  userData?: AnonymousAdvisorMetrics;
} {
  const safeMessage = message.trim().slice(0, 500);
  const encoder = new TextEncoder();
  const boundedHistory = (Array.isArray(history) ? history : [])
    .filter(
      item =>
        item &&
        (item.sender === 'user' || item.sender === 'advisor') &&
        typeof item.text === 'string' &&
        item.text.trim().length > 0
    )
    .slice(-MAX_CHAT_HISTORY_ITEMS)
    .map(item => ({
      sender: item.sender,
      text: item.text.trim().slice(0, MAX_CHAT_HISTORY_ITEM_CHARS)
    }));

  const safeUserData: AnonymousAdvisorMetrics | undefined = userData
    ? {
        goal: typeof userData.goal === 'string' ? userData.goal.slice(0, 60) : undefined,
        activePlanTitle:
          typeof userData.activePlanTitle === 'string' ? userData.activePlanTitle.slice(0, 40) : undefined,
        memorizedAyahsCount: Number(userData.memorizedAyahsCount) || 0,
        weakVersesCount: Number(userData.weakVersesCount) || 0,
        retentionScore: Number(userData.retentionScore) || 0,
        dueRevisionsCount: Number(userData.dueRevisionsCount) || 0
      }
    : undefined;

  while (boundedHistory.length > 0) {
    const candidate = safeUserData
      ? { message: safeMessage, history: boundedHistory, userData: safeUserData }
      : { message: safeMessage, history: boundedHistory };
    if (encoder.encode(JSON.stringify(candidate)).length <= MAX_CHAT_WIRE_BYTES) {
      break;
    }
    boundedHistory.shift();
  }

  return safeUserData
    ? { message: safeMessage, history: boundedHistory, userData: safeUserData }
    : { message: safeMessage, history: boundedHistory };
}

export const AdvisorService = {
  async checkStatus(): Promise<AdvisorStatus> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    try {
      const res = await fetch('/api/advisor/status', {
        signal: controller.signal
      });

      if (res.ok) {
        const data = await res.json();
        if (data.available) {
          return {
            available: true,
            mode: 'gemini_free',
            model: `${data.model || 'gemini-2.5-flash'} (Free Tier)`,
            message: 'المستشار الذكي متصل بنموذج Gemini 2.5 Flash المجاني'
          };
        }
      }

      return {
        available: false,
        mode: 'deterministic_fallback',
        model: 'المحرك التحليلي المحلي',
        message: 'يعمل في النمط التحليلي المحلي دون اتصال أو مفاتيح'
      };
    } catch {
      return {
        available: false,
        mode: 'deterministic_fallback',
        model: 'المحرك التحليلي المحلي',
        message: 'يعمل في النمط التحليلي المحلي دون اتصال أو مفاتيح'
      };
    } finally {
      clearTimeout(timeoutId);
    }
  },

  async analyzeProgress(
    contextType: string,
    logs: DailyLog[],
    profile: UserProfile,
    plans: MemorizationPlan[],
    portions: PortionStatusRecord[],
    weakVerses: WeakVerseItem[],
    customQuery?: string,
    history?: Array<{ sender: 'user' | 'advisor'; text: string }>
  ): Promise<AdvisorResponse> {
    const deterministicReport = DeterministicAdvisorEngine.analyzeHistory(logs, profile, portions, weakVerses);

    let fallbackText = '';
    if (contextType === 'workload') {
      fallbackText = `تحليل وتعديل حجم الحفظ اليومي:
• نمط الإنجاز الحالي: ${deterministicReport.missedTasksPattern}
• الأسباب المرصودة: ${deterministicReport.difficultyReasons.join(' — ')}
• التعديل المقترح:
• ${deterministicReport.suggestedWorkloadAdjustments.join('\n• ')}`;
    } else if (contextType === 'priorities') {
      fallbackText = `أولويات المراجعة والتثبيت العاجلة:
${deterministicReport.revisionPriorities.map((p, i) => `${i + 1}. ${p}`).join('\n')}

توجيه منهجي: قدّم مراجعة هذه المقاطع في مستهل جلسة اليوم قبل الشروع في أي حفظ جديد.`;
    } else if (contextType === 'weekly_summary') {
      fallbackText = `ملخص الإنجاز الأسبوعي:
• إجمالي دقائق التعاهد: ${deterministicReport.weeklySummary.totalMinutes} دقيقة.
• الآيات المحفوظة: ${deterministicReport.weeklySummary.totalAyahsMemorized} آية.
• الأوجه المراجعة: ${deterministicReport.weeklySummary.totalPagesReviewed} وجه.
• مؤشر الثبات والاستمرارية: ${deterministicReport.weeklySummary.consistencyScore}.`;
    } else {
      fallbackText = `تقرير التحليل القرآني الشامل:
• نمط الالتزام: ${deterministicReport.missedTasksPattern}
• التوصيات العملية:
${deterministicReport.practicalRecommendations.map(r => `• ${r}`).join('\n')}
• أولويات التثبيت:
${deterministicReport.revisionPriorities.map(p => `• ${p}`).join('\n')}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    try {
      const activePlan = plans.find(p => p.isActive) || plans[0];
      const safeCustomQuery = typeof customQuery === 'string' ? customQuery.trim().slice(0, 500) : undefined;
      const metrics: AnonymousAdvisorMetrics = {
        goal: profile.memorizationGoal || 'حفظ القرآن الكريم',
        activePlanTitle: activePlan?.title || 'خطة الحفظ',
        memorizedAyahsCount: portions
          .filter(p => p.status !== 'not_memorized')
          .reduce((s, p) => s + (p.endAyah - p.startAyah + 1), 0),
        weakVersesCount: weakVerses.length,
        retentionScore: deterministicReport.completionRate || 0,
        dueRevisionsCount: portions.filter(p => p.nextDueDate <= new Date().toISOString().split('T')[0]).length
      };
      const bounded = buildBoundedChatPayload(safeCustomQuery || '', history || [], metrics);

      const res = await fetch('/api/advisor/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contextType,
          query: bounded.message || undefined,
          history: bounded.history,
          userData: bounded.userData
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.text) {
          return {
            success: true,
            text: data.text,
            isFallback: false,
            code: 'SUCCESS',
            report: deterministicReport
          };
        }
        if (data.code === 'QUOTA_EXHAUSTED') {
          return {
            success: true,
            text: fallbackText,
            isFallback: true,
            code: 'QUOTA_EXHAUSTED',
            report: deterministicReport
          };
        }
      }
    } catch {
      // Offline or timeout — gracefully serve deterministic report
    } finally {
      clearTimeout(timeoutId);
    }

    return {
      success: true,
      text: fallbackText,
      isFallback: true,
      code: 'FALLBACK_USED',
      report: deterministicReport
    };
  },

  async sendChatMessage(
    message: string,
    history: Array<{ sender: 'user' | 'advisor'; text: string }>,
    userData?: AnonymousAdvisorMetrics
  ): Promise<AdvisorResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    try {
      const payload = buildBoundedChatPayload(message, history, userData);

      const res = await fetch('/api/advisor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.text) {
          return {
            success: true,
            text: data.text,
            isFallback: false,
            code: 'SUCCESS'
          };
        }
        if (data.code === 'RATE_LIMITED') {
          return {
            success: true,
            text: DeterministicAdvisorEngine.answerQuestion(message),
            isFallback: true,
            code: 'RATE_LIMITED'
          };
        }
      }
    } catch {
      // Offline or network timeout — fall back cleanly
    } finally {
      clearTimeout(timeoutId);
    }

    const fallbackAnswer = DeterministicAdvisorEngine.answerQuestion(message);
    return {
      success: true,
      text: fallbackAnswer,
      isFallback: true,
      code: 'FALLBACK_USED'
    };
  }
};
