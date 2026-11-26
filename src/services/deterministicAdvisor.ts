import { DailyLog, UserProfile, PortionStatusRecord, WeakVerseItem } from '../types/quran';

export interface PerformanceAnalysisReport {
  title: string;
  completionRate: number; // 0-100%
  missedTasksPattern: string;
  difficultyReasons: string[];
  suggestedWorkloadAdjustments: string[];
  revisionPriorities: string[];
  weeklySummary: {
    totalMinutes: number;
    totalAyahsMemorized: number;
    totalPagesReviewed: number;
    consistencyScore: string;
    bestDay: string;
  };
  practicalRecommendations: string[];
}

export type DetectedUserIntent =
  | 'religious_boundary'
  | 'forgetting_retention'
  | 'mutashabihat'
  | 'backlog_recovery'
  | 'motivation_consistency'
  | 'schedule_planning'
  | 'tajweed_recitation'
  | 'beginners_children'
  | 'general_methodology';

export function detectAdvisorQueryIntent(query: string): DetectedUserIntent {
  const q = query.trim().toLowerCase();
  if (/ما حكم|حلال|حرام|فتوى|يجوز|تفسير آية|معنى آية|اشرح لي آية/.test(q)) {
    return 'religious_boundary';
  }
  if (/متشابه|لبس|خلط|بتلخبط|أتلخبط|تلخبط|أخطئ بين|فرق بين/.test(q)) {
    return 'mutashabihat';
  }
  if (/نسيان|أنسى|بنسى|نسيت|تفلت|يتفلت|ضعف|تثبيت|أثبت|رسوخ/.test(q)) {
    return 'forgetting_retention';
  }
  if (/تراكم|فائت|فاتني|انقطعت|انقطاع|متأخر|مش لاحق|توقفت/.test(q)) {
    return 'backlog_recovery';
  }
  if (/فتور|كسل|همة|شغف|ألتزم|انتظام|ملل|استمرار/.test(q)) {
    return 'motivation_consistency';
  }
  if (/تجويد|مخارج|أحكام النون|مدود|قراءة صحيحة|ترتيل/.test(q)) {
    return 'tajweed_recitation';
  }
  if (/أطفال|طفل|ابني|بنتي|مبتدئ|كبير في السن/.test(q)) {
    return 'beginners_children';
  }
  if (/وقت|تنظيم|جلسة|جدول|خطة|كم أحفظ|مقدار|الفجر/.test(q)) {
    return 'schedule_planning';
  }
  return 'general_methodology';
}

export const DeterministicAdvisorEngine = {
  /**
   * 1. Analyze memorization & revision history and identify patterns of missed tasks
   */
  analyzeHistory(
    logs: DailyLog[],
    _profile: UserProfile,
    portions: PortionStatusRecord[],
    weakVerses: WeakVerseItem[]
  ): PerformanceAnalysisReport {
    const recentLogs = logs.slice(-7);
    const totalMinutes = recentLogs.reduce((sum, l) => sum + (l.minutesSpent || 0), 0);
    const totalAyahs = recentLogs.reduce((sum, l) => sum + (l.memorizedAyahsCount || 0), 0);
    const totalPages = recentLogs.reduce((sum, l) => sum + (l.reviewedPagesCount || 0), 0);

    const activeDaysCount = recentLogs.filter(l => (l.minutesSpent || 0) > 0).length;
    const completionRate = Math.round((activeDaysCount / 7) * 100);

    let missedPattern = 'الالتزام منتظم ومستقر في معظم أيام الأسبوع.';
    const difficultyReasons: string[] = [];
    const workloadAdjustments: string[] = [];

    if (completionRate < 50) {
      missedPattern = 'انقطاعات متكررة خلال الأسبوع (أقل من نصف الأيام المستهدفة)، مما يعرض المحفوظ السابق للتفلت.';
      difficultyReasons.push('المقدار اليومي للحفظ الجديد أكبر من الوقت الفعلي المتاح في يومك.');
      difficultyReasons.push('غياب موعد ثابت مقترن بشعيرة يومية كصلاة الفجر أو المغرب.');
      workloadAdjustments.push('تخفيض الحفظ الجديد إلى 3 إلى 5 آيات فقط يومياً لضمان الاتصال اليومي بالقرآن.');
      workloadAdjustments.push('تثبيت جلسة مركزة من 15 دقيقة في موعد واحد لا يتغير بدلاً من الجلسات الطويلة المتقطعة.');
    } else if (completionRate < 75) {
      missedPattern = 'انتظام متوسط مع انقطاع يومين تقريباً في الأسبوع.';
      difficultyReasons.push('تراكم ورد المراجعة عند فوات يوم واحد يولّد ثقلاً نفسياً يؤخر البدء في اليوم التالي.');
      workloadAdjustments.push('اعتماد مبدأ «قليل دائم خير من كثير منقطع» وتخصيص يوم في الأسبوع للمراجعة الخفيفة دون حفظ جديد.');
    } else {
      missedPattern = 'مواظبة راسخة ونسبة التزام تتجاوز 75% من الأيام المستهدفة.';
      workloadAdjustments.push('الاستمرار على الوتيرة الحالية مع القراءة بالمحفوظ الجديد في السنن الرواتب وقيام الليل.');
    }

    const weakPortions = portions.filter(p => p.status === 'weak');
    const needsRevPortions = portions.filter(p => p.status === 'needs_revision');

    if (weakPortions.length > 0) {
      difficultyReasons.push(`وجود ${weakPortions.length} مقاطع مصنفة ضمن المتعثر؛ والجمع بينها وبين حفظ جديد يشتت التركيز.`);
      workloadAdjustments.push('إيقاف الحفظ الجديد مؤقتاً ليومين وتوجيه كامل الوقت لتصفية المقاطع المتعثرة بالتكرار المتصل.');
    }

    const revisionPriorities: string[] = [];
    if (weakPortions.length > 0) {
      weakPortions.slice(0, 3).forEach(p => {
        revisionPriorities.push(`سورة ${p.surahName} (الآيات ${p.startAyah}–${p.endAyah}) — أولوية عاجلة لتكرار التعثر فيها.`);
      });
    }
    if (weakVerses.length > 0) {
      const topWeak = [...weakVerses].sort((a, b) => b.mistakeCount - a.mistakeCount)[0];
      revisionPriorities.push(`الآية ${topWeak.ayahNumber} من سورة ${topWeak.surahName} (سُجّل التعثر فيها ${topWeak.mistakeCount} مرات).`);
    }
    if (needsRevPortions.length > 0 && revisionPriorities.length < 3) {
      needsRevPortions.slice(0, 2).forEach(p => {
        revisionPriorities.push(`تثبيت مقطع سورة ${p.surahName} (${p.startAyah}–${p.endAyah}) قبل حلول الفاصل التالي.`);
      });
    }
    if (revisionPriorities.length === 0) {
      revisionPriorities.push('مراجعة المقاطع المتقنة دورياً وفق جدول التكرار المتباعد لصيانتها من النسيان.');
    }

    const practicalRecommendations: string[] = [
      'توزيع وقت الجلسة: 70% للمراجعة الصغرى والكبرى، و30% فقط للحفظ الجديد.',
      'القراءة بصوت مسموع وترتيل هادئ لإشراك السمع والبصر واللسان معاً.',
      'الربط المباشر بين أواخر المقاطع وأوائل ما بعدها لمنع الانقطاع أثناء التسميع.'
    ];

    let consistencyScore = 'ممتاز (ثابت)';
    if (completionRate < 50) consistencyScore = 'يحتاج تثبيتاً';
    else if (completionRate < 80) consistencyScore = 'جيد (متوسط)';

    return {
      title: 'تقرير التحليل المنهجي لوتيرة الحفظ والمراجعة',
      completionRate,
      missedTasksPattern: missedPattern,
      difficultyReasons: difficultyReasons.length > 0 ? difficultyReasons : ['الخطة متوازنة ومتوافقة مع وتيرتك الحالية.'],
      suggestedWorkloadAdjustments: workloadAdjustments,
      revisionPriorities,
      weeklySummary: {
        totalMinutes,
        totalAyahsMemorized: totalAyahs,
        totalPagesReviewed: totalPages,
        consistencyScore,
        bestDay: activeDaysCount > 0 ? 'أيام الانتظام المسجلة' : 'لم يُسجل بعد'
      },
      practicalRecommendations
    };
  },

  /**
   * 2. Deep, intent-aware pedagogical answers in refined Arabic (100% offline capable)
   */
  answerQuestion(query: string): string {
    const intent = detectAdvisorQueryIntent(query);

    switch (intent) {
      case 'religious_boundary':
        return `تنبيه منهجي وأمين:
المستشار القرآني في «وِرد» مخصص حصراً لخطط الحفظ ومنهجيات التثبيت وضبط المتشابهات، ولا يُصدر فتاوى فقهية ولا يفسر الآيات بالرأي صيانةً لكلام الله تعالى.

الخطوة العملية المقترحة:
1. لمعرفة تفسير الآية بدقة: افتح قسم «القرآن والمصحف» واضغط على الآية لفتح نافذة التفسير الموثق من أمهات كتب التفسير المعتمدة.
2. للمسائل الفقهية والأحكام الشرعية: يُرجع فيها إلى العلماء والجهات الإفتائية المختصة.`;

      case 'forgetting_retention':
        return `تشخيص الحالة:
تفلت المحفوظ أمر طبيعي إذا غلبت كمية الحفظ الجديد نصيب المراجعة، أو حُفظ المقطع بالتكرار البصري الصامت دون ربط سمعي وصلاتي.

الخطوات العملية للترسيخ:
1. التكرار المرحلي المركز: اقرأ المقطع 10 مرات نظراً من المصحف بصوت مسموع بتركيز، ثم 10 مرات غيباً مع وصل آخر كل آية بأول التي تليها.
2. قاعدة المراجعة الصغرى: كل ما حفظته خلال آخر أسبوعين يجب أن يمر معك يومياً قبل الشروع في سطر واحد جديد.
3. التثبيت بالصلاة: اقرأ محفوظك الجديد في السنن الرواتب وقيام الليل؛ فما قُرئ به في المحراب رسخ في الصدر.`;

      case 'mutashabihat':
        return `تشخيص الحالة:
الالتباس بين الآيات المتشابهة ينشأ غالباً من حفظ كل موضع بمعزل عن شبيهه دون عقد مقارنة بصرية ومعنوية بينهما.

الخطوات العملية لضبط المتشابهات:
1. جمع النظائر في ورقة واحدة أو من قسم «المراجعة والتثبيت»: ضع الآيتين المتشابهتين أمامك وحدد الكلمة الفارقة بدقة.
2. قاعدة الربط بسياق السورة: تأمل المعنى العام للسورة، فغالباً ما توافق خاتمة الآية جو السورة ومقصدها.
3. قاعدة العناية بالموضع الفريد: أتقن الموضع الأقل تكراراً في المصحف، فيستقر في ذهنك أن ما سواه على الأصل الشائع.`;

      case 'backlog_recovery':
        return `تشخيص الحالة:
تراكم المهام بعد انقطاع يولد شعوراً بالثقل إذا حاولت قضاء كل ما فات في جلسة واحدة.

خطة الاستدراك الهادئة:
1. أوقف الحفظ الجديد لمدة 3 أيام دون تردد؛ فحفظ رأس المال مقدم على طلب الربح.
2. قسّم المقاطع المتراكمة إلى حصص قصيرة (15 دقيقة صباحاً و15 دقيقة مساءً) بدل جلسة طويلة مرهقة.
3. استخدم خيار «إعادة التوازن أو الإزاحة المرنة» في لوحة خطط الحفظ لتوزيع الأيام الفائتة تلقائياً دون ضغط.`;

      case 'motivation_consistency':
        return `تشخيص الحالة:
فتور الهمة يعترض كل سالك، وعلاجه لا يكون بانتظار النشاط بل بتخفيف العبء وتثبيت الحد الأدنى اليومي.

خطوات استعادة الانتظام:
1. اعتمد «ورد الطوارئ»: في أيام الانشغال أو الفتور، لا تترك المصحف أبداً ولو بمراجعة وجه واحد فقط في خمس دقائق.
2. اربط الورد بعادة راسخة لا تتخلف (عقب صلاة الفجر أو بعد صلاة المغرب مباشرة قبل الانشغال بالهاتف).
3. استعن بالاستماع لقارئ متقن عبر مشغل «وِرد» لتهيئة القلب قبل فتح المصحف.`;

      case 'tajweed_recitation':
        return `تشخيص الحالة:
إتقان التجويد ومخارج الحروف شرط لصحة الحفظ؛ لأن من حفظ بلحنٍ شقّ عليه تعديله لاحقاً.

الخطوات العملية لتصحيح التلاوة:
1. استمع للمقطع المقرر 3 مرات على الأقل بصوت الشيخ محمود خليل الحصري أو الشيخ محمد صديق المنشاوي قبل البدء بحفظه.
2. اقرأ المقطع على شيخ متقن أو حلقة تصحيح تلاوة؛ فالتلقي بالمشافهة أصل لا يغني عنه التطبيق.
3. تريّث في القراءة عند الحفظ الجديد (مرتبة التحقيق) لتستقر الحركات والمدود في الذاكرة السمعية.`;

      case 'beginners_children':
        return `منهجية التدرج للمبتدئين والناشئة:
1. البداية بقصار المفصل مع التلقين الصوتي الترديدي آيةً آية بصوت قارئ واضح المخارج.
2. قصر مدة الجلسة (10 إلى 15 دقيقة يومياً) واقتصار المقدار على آيتين إلى أربع آيات متقنة.
3. توظيف أداة «إخفاء الكلمات التدريجي» في جلسة الحفظ لتحويل التسميع إلى تدريب تفاعلي محبب.
4. عدم الانتقال لسورة جديدة إلا بعد سماع السورة السابقة كاملةً غيباً دون تردد.`;

      case 'schedule_planning':
        return `الهيكل المتوازن لجلسة الحفظ اليومية (30 دقيقة):
1. التهيئة السمعية (4 دقائق): الاستماع للمقطع الجديد من قارئ معتمد مع المتابعة بالعين في المصحف.
2. المراجعة أولاً (16 دقيقة): مراجعة المحفوظ القريب والمقاطع المستحقة في جدول التكرار المتباعد.
3. الحفظ الجديد (8 دقائق): تقسيم الوجه إلى مقاطع قصيرة وتكرار كل آية وربطها بما قبلها.
4. التثبيت الختامي (2 دقيقتان): تسميع المقطع الجديد كاملاً غيباً من أوله إلى آخره في سياق متصل.`;

      case 'general_methodology':
      default:
        return `خلاصة منهج الحفظ الراسخ في «وِرد»:
يقوم الإتقان القرآني على ثلاث دعائم متكاملة: تصحيح التلاوة سماعاً ومشافهة، وتقديم المراجعة اليومية على الحفظ الجديد بنسبة 70% إلى 30%، والمواظبة اليومية في وقت ثابت وإن قلّ المقدار.

يمكنك اختيار أحد التحليلات السريعة أعلاه لفحص سجل التزامك الفعلي، أو كتابة سؤالك التفصيلي عن جدولك أو السورة التي تحفظها حالياً.`;
    }
  }
};
