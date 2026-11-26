import { MutashabihItem } from '../types/quran';

export const MUTASHABIHAT_DATA: MutashabihItem[] = [
  {
    id: 'mut-1',
    title: 'هدى للمتقين · هدى وبشرى للمؤمنين',
    surah1: {
      name: 'البقرة',
      surahNumber: 2,
      ayahNumber: 2,
      text: 'ذَٰلِكَ الْكِتَابُ لَا رَيْبَ ۛ فِيهِ ۛ هُدًى لِّلْمُتَّقِينَ'
    },
    surah2: {
      name: 'النمل',
      surahNumber: 27,
      ayahNumber: 2,
      text: 'هُدًى وَبُشْرَىٰ لِلْمُؤْمِنِينَ'
    },
    distinctionRule:
      'في البقرة جاءت بلفظ (للمتقين) لأن السورة فصّلت صفات المتقين في أولها، أما في النمل فاقترنت بالبشرى للمؤمنين لأنها عقبت على إلقاء القرآن بالبشارة.',
    difficulty: 'easy'
  },
  {
    id: 'mut-2',
    title: 'ختم الله على قلوبهم · وختم على قلوبكم',
    surah1: {
      name: 'البقرة',
      surahNumber: 2,
      ayahNumber: 7,
      text: 'خَتَمَ اللَّهُ عَلَىٰ قُلُوبِهِمْ وَعَلَىٰ سَمْعِهِمْ ۖ وَعَلَىٰ أَبْصَارِهِمْ غِشَاوَةٌ'
    },
    surah2: {
      name: 'الأنعام',
      surahNumber: 6,
      ayahNumber: 46,
      text: 'قُلْ أَرَأَيْتُمْ إِنْ أَخَذَ اللَّهُ سَمْعَكُمْ وَأَبْصَارَكُمْ وَخَتَمَ عَلَىٰ قُلُوبِكُم مَّنْ إِلَٰهٌ غَيْرُ اللَّهِ يَأْتِيكُم بِهِ'
    },
    distinctionRule:
      'في البقرة بُدئ بالقلب ثم السمع ثم الأبصار، وفي الأنعام بُدئ بالسمع والأبصار ثم عُطف الختم على القلوب بعد ذلك بحرف الواو.',
    difficulty: 'medium'
  },
  {
    id: 'mut-3',
    title: 'والله يرزق من يشاء · إن الله يرزق من يشاء بغير حساب',
    surah1: {
      name: 'البقرة',
      surahNumber: 2,
      ayahNumber: 212,
      text: 'زُيِّنَ لِلَّذِينَ كَفَرُوا الْحَيَاةُ الدُّنْيَا وَيَسْخَرُونَ مِنَ الَّذِينَ آمَنُوا ۘ وَالَّذِينَ اتَّقَوْا فَوْقَهُمْ يَوْمَ الْقِيَامَةِ ۗ وَاللَّهُ يَرْزُقُ مَن يَشَاءُ بِغَيْرِ حِسَابٍ'
    },
    surah2: {
      name: 'آل عمران',
      surahNumber: 3,
      ayahNumber: 37,
      text: 'فَتَقَبَّلَهَا رَبُّهَا بِقَبُولٍ حَسَنٍ وَأَنبَتَهَا نَبَاتًا حَسَنًا وَكَفَّلَهَا زَكَرِيَّا ۖ كُلَّمَا دَخَلَ عَلَيْهَا زَكَرِيَّا الْمِحْرَابَ وَجَدَ عِندَهَا رِزْقًا ۖ قَالَ يَا مَرْيَمُ أَنَّىٰ لَكِ هَٰذَا ۖ قَالَتْ هُوَ مِنْ عِندِ اللَّهِ ۖ إِنَّ اللَّهَ يَرْزُقُ مَن يَشَاءُ بِغَيْرِ حِسَابٍ'
    },
    distinctionRule:
      'في البقرة جاءت بالواو (وَاللَّهُ يَرْزُقُ)، وفي آل عمران جاءت بـ (إِنَّ اللَّهَ يَرْزُقُ) على لسان مريم عليها السلام استئنافاً وتوكيداً لقدرة الله.',
    difficulty: 'medium'
  },
  {
    id: 'mut-4',
    title: 'فانفجرت منه اثنتا عشرة عيناً · فانبجست منه',
    surah1: {
      name: 'البقرة',
      surahNumber: 2,
      ayahNumber: 60,
      text: 'وَإِذِ اسْتَسْقَىٰ مُوسَىٰ لِقَوْمِهِ فَقُلْنَا اضْرِب بِّعَصَاكَ الْحَجَرَ ۖ فَانفَجَرَتْ مِنْهُ اثْنَتَا عَشْرَةَ عَيْنًا'
    },
    surah2: {
      name: 'الأعراف',
      surahNumber: 7,
      ayahNumber: 160,
      text: 'وَأَوْحَيْنَا إِلَىٰ مُوسَىٰ إِذِ اسْتَسْقَاهُ قَوْمُهُ أَنِ اضْرِب بِّعَصَاكَ الْحَجَرَ ۖ فَانبَجَسَتْ مِنْهُ اثْنَتَا عَشْرَةَ عَيْنًا'
    },
    distinctionRule:
      'الانفجار أشد خروجاً للماء وهو في البقرة لمقام التفضيل والإنعام التام، والانبجاس أقل وهو بداية النبع في الأعراف في سياق سرد قصة خروجهم من مصر.',
    difficulty: 'advanced'
  },
  {
    id: 'mut-5',
    title: 'ألم تر أن الله يسجد له · ألم تر أن الله يسبح له',
    surah1: {
      name: 'الحج',
      surahNumber: 22,
      ayahNumber: 18,
      text: 'أَلَمْ تَرَ أَنَّ اللَّهَ يَسْجُدُ لَهُ مَن فِي السَّمَاوَاتِ وَمَن فِي الْأَرْضِ وَالشَّمْسُ وَالْقَمَرُ وَالنُّجُومُ'
    },
    surah2: {
      name: 'النور',
      surahNumber: 24,
      ayahNumber: 41,
      text: 'أَلَمْ تَرَ أَنَّ اللَّهَ يُسَبِّحُ لَهُ مَن فِي السَّمَاوَاتِ وَالْأَرْضِ وَالطَّيْرُ صَافَّاتٍ'
    },
    distinctionRule:
      'في سورة الحج جاء (يسجد) فناسبها الخضوع ومقام مناسك الحج، وفي النور جاء (يسبح) فناسبها نور التوحيد وتسبيح الطير والكون.',
    difficulty: 'advanced'
  },
  {
    id: 'mut-6',
    title: 'أولم يروا إلى الطير فوقهم صافات · صافات ويقبضن',
    surah1: {
      name: 'الملك',
      surahNumber: 67,
      ayahNumber: 19,
      text: 'أَوَلَمْ يَرَوْا إِلَى الطَّيْرِ فَوْقَهُمْ صَافَّاتٍ وَيَقْبِضْنَ ۚ مَا يُمْسِكُهُنَّ إِلَّا الرَّحْمَٰنُ ۚ إِنَّهُ بِكُلِّ شَيْءٍ بَصِيرٌ'
    },
    surah2: {
      name: 'النور',
      surahNumber: 24,
      ayahNumber: 41,
      text: 'أَلَمْ تَرَ أَنَّ اللَّهَ يُسَبِّحُ لَهُ مَن فِي السَّمَاوَاتِ وَالْأَرْضِ وَالطَّيْرُ صَافَّاتٍ ۖ كُلٌّ قَدْ عَلِمَ صَلَاتَهُ وَتَسْبِيحَهُ'
    },
    distinctionRule:
      'في سورة الملك زيد لفظ (فوقهم صافات ويقبضن) وختمت بـ (إنه بكل شيء بصير) موافقة لذكر الإبصار والنظر في أول الآية (أولم يروا).',
    difficulty: 'easy'
  },
  {
    id: 'mut-7',
    title: 'ويقولون متى هذا الوعد إن كنتم صادقين (الملك ويس)',
    surah1: {
      name: 'الملك',
      surahNumber: 67,
      ayahNumber: 25,
      text: 'وَيَقُولُونَ مَتَىٰ هَٰذَا الْوَعْدُ إِن كُنتُمْ صَادِقِينَ'
    },
    surah2: {
      name: 'يس',
      surahNumber: 36,
      ayahNumber: 48,
      text: 'وَيَقُولُونَ مَتَىٰ هَٰذَا الْوَعْدُ إِن كُنتُمْ صَادِقِينَ'
    },
    distinctionRule:
      'الآية متطابقة لفظاً في ستة مواضع (يونس، الأنبياء، النمل، سبأ، يس، الملك)، ويُضبط ما بعدها: في يس (ما ينظرون إلا صيحة واحدة)، وفي الملك (قل إنما العلم عند الله وإنما أنا نذير مبين).',
    difficulty: 'medium'
  },
  {
    id: 'mut-8',
    title: 'ما اتخذ الله من ولد (الكهف ومريم والمؤمنون)',
    surah1: {
      name: 'الكهف',
      surahNumber: 18,
      ayahNumber: 4,
      text: 'وَيُنذِرَ الَّذِينَ قَالُوا اتَّخَذَ اللَّهُ وَلَدًا'
    },
    surah2: {
      name: 'المؤمنون',
      surahNumber: 23,
      ayahNumber: 91,
      text: 'مَا اتَّخَذَ اللَّهُ مِن وَلَدٍ وَمَا كَانَ مَعَهُ مِنْ إِلَٰهٍ'
    },
    distinctionRule:
      'في مطلع الكهف جاءت بلفظ الإنذار من القرآن (وينذر الذين قالوا اتخذ الله ولداً) ثم عقبتها (ما لهم به من علم ولا لآبائهم).',
    difficulty: 'easy'
  },
  {
    id: 'mut-9',
    title: 'فأصبح يقلب كفيه · فأصبحوا لا يرى إلا مساكنهم',
    surah1: {
      name: 'الكهف',
      surahNumber: 18,
      ayahNumber: 42,
      text: 'وَأُحِيطَ بِثَمَرِهِ فَأَصْبَحَ يُقَلِّبُ كَفَّيْهِ عَلَىٰ مَا أَنفَقَ فِيهَا وَهِيَ خَاوِيَةٌ عَلَىٰ عُرُوشِهَا'
    },
    surah2: {
      name: 'البقرة',
      surahNumber: 2,
      ayahNumber: 259,
      text: 'أَوْ كَالَّذِي مَرَّ عَلَىٰ قَرْيَةٍ وَهِيَ خَاوِيَةٌ عَلَىٰ عُرُوشِهَا'
    },
    distinctionRule:
      'اقترن وصف (وهي خاوية على عروشها) بالجنة الهالكة في الكهف مفردةً مؤنثة، وبالقرية في البقرة والحج.',
    difficulty: 'medium'
  },
  {
    id: 'mut-10',
    title: 'إن هذا إلا أساطير الأولين · إن هذا إلا سحر يؤثر',
    surah1: {
      name: 'المدثر',
      surahNumber: 74,
      ayahNumber: 24,
      text: 'فَقَالَ إِنْ هَٰذَا إِلَّا سِحْرٌ يُؤْثَرُ'
    },
    surah2: {
      name: 'المطففين',
      surahNumber: 83,
      ayahNumber: 13,
      text: 'إِذَا تُتْلَىٰ عَلَيْهِ آيَاتُنَا قَالَ أَسَاطِيرُ الْأَوَّلِينَ'
    },
    distinctionRule:
      'في المطففين والقلم جاءت مجردة دون (إن هذا إلا): (قال أساطير الأولين)، بينما في المدثر جاءت (إن هذا إلا سحر يؤثر · إن هذا إلا قول البشر).',
    difficulty: 'medium'
  }
];

/**
 * Finds Mutashabihat entries strictly matching this Ayah or within the same Surah
 * so Hifz students can review verbal similarities right from the Tafsir/Tadabbur pane.
 */
export function findMutashabihatForAyah(
  surahNumber: number,
  ayahNumber: number
): { exactMatches: MutashabihItem[]; surahMatches: MutashabihItem[] } {
  const exactMatches: MutashabihItem[] = [];
  const surahMatches: MutashabihItem[] = [];

  for (const item of MUTASHABIHAT_DATA) {
    const isExact1 = item.surah1.surahNumber === surahNumber && item.surah1.ayahNumber === ayahNumber;
    const isExact2 = item.surah2.surahNumber === surahNumber && item.surah2.ayahNumber === ayahNumber;
    if (isExact1 || isExact2) {
      exactMatches.push(item);
    } else if (item.surah1.surahNumber === surahNumber || item.surah2.surahNumber === surahNumber) {
      surahMatches.push(item);
    }
  }

  return { exactMatches, surahMatches };
}
