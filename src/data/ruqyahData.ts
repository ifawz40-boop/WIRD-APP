export type RuqyahCategory =
  | 'guidelines'
  | 'brief'
  | 'medium'
  | 'full'
  | 'eye_envy'
  | 'illness'
  | 'magic_protection'
  | 'children_home'
  | 'anxiety_sleep';

export type RuqyahItemType = 'quran' | 'dua' | 'guideline';

export interface RuqyahCategoryMeta {
  id: RuqyahCategory;
  label: string;
  shortDuration: string;
  description: string;
  focusHint: string;
}

export interface RuqyahItem {
  id: string;
  categories: RuqyahCategory[];
  type: RuqyahItemType;
  title: string;
  surahNumber?: number;
  surahName?: string;
  verseRange?: string;
  text: string;
  repeatTarget: number | null;
  source?: string;
  explanation?: string;
}

export interface RuqyahProgramAudio {
  id: 'brief-ruqya' | 'a-medium-ruqya' | 'a-long-ruqya';
  name: string;
  description: string;
  audioUrl: string;
}

export interface RuqyahAudioSessionTrack {
  itemId: string;
  repeatCount?: number;
}

export interface RuqyahAudioSession {
  id: string;
  title: string;
  subtitle: string;
  durationBadge: string;
  estimatedMinutes: number;
  focusLabel: string;
  description: string;
  tracks: RuqyahAudioSessionTrack[];
}

export const RUQYAH_CATEGORIES: RuqyahCategoryMeta[] = [
  {
    id: 'brief',
    label: 'الرقية المختصرة',
    shortDuration: 'مختصر',
    description: 'أصول الرقية اليومية الثابتة من الفاتحة وآية الكرسي وخواتيم البقرة والمعوذات وجوامع الأدعية النبوية.',
    focusHint: 'للوِرد اليومي السريع والتحصين المستمر'
  },
  {
    id: 'medium',
    label: 'الرقية المتوسطة',
    shortDuration: 'متوسط',
    description: 'توسّع متوازن يضم أوائل البقرة وآيات إبطال السحر وخواتيم الحشر وجوامع الاستعاذات النبوية.',
    focusHint: 'للقراءة اليومية المتأنية والسكينة'
  },
  {
    id: 'full',
    label: 'الرقية المطولة الكاملة',
    shortDuration: 'مطول',
    description: 'المجموعة الشاملة من آيات الرقية والشفاء والسكينة والحفظ والأدعية النبوية الصحيحة.',
    focusHint: 'لجلسة الرقية الكاملة والمتكاملة'
  },
  {
    id: 'eye_envy',
    label: 'رقية العين والحسد',
    shortDuration: 'مخصّص',
    description: 'آيات التحصين والمعوذات وآيتا سورة القلم ورقية جبريل عليه السلام وتعويذات النبي ﷺ من العين والحسد.',
    focusHint: 'للوقاية والاستشفاء من العين والحسد'
  },
  {
    id: 'illness',
    label: 'رقية المرض والألم',
    shortDuration: 'مخصّص',
    description: 'آيات الشفاء الست في القرآن الكريم وأدعية عيادة المريض ووضع اليد على موضع الألم.',
    focusHint: 'عند الشكوى والمرض وعيادة المريض'
  },
  {
    id: 'magic_protection',
    label: 'رقية السحر والحفظ',
    shortDuration: 'مخصّص',
    description: 'آيات إبطال كيد السحرة من البقرة والأعراف ويونس وطه وأوائل الصافات والتحصين النبوي الشامل.',
    focusHint: 'للتحصين الشرعي والتوكل على الله'
  },
  {
    id: 'children_home',
    label: 'تحصين الأبناء والمنزل',
    shortDuration: 'يومي',
    description: 'تعويذ النبي ﷺ للحسن والحسين وآية الكرسي وخواتيم البقرة وأذكار الحفظ صباحاً ومساءً وعند النوم.',
    focusHint: 'لتحصين الأهل والأبناء والبيت'
  },
  {
    id: 'anxiety_sleep',
    label: 'السكينة والطمأنينة والهم',
    shortDuration: 'طمأنينة',
    description: 'آيات السكينة وانشراح الصدر ودعاء الكرب العظيم والاستعاذة من الهم والحزن والفزع في النوم.',
    focusHint: 'لتفريج الهم والضيق وقبل النوم'
  },
  {
    id: 'guidelines',
    label: 'آداب وإرشادات الرقية',
    shortDuration: 'إرشادات',
    description: 'الضوابط الشرعية الصحيحة للرقية بالقرآن والسنة والجمع بين التوكل والتداوي المشروع.',
    focusHint: 'ضوابط وآداب مهمة قبل الرقية'
  }
];

/**
 * Reserved full-program audio slots. Third-party full-program recordings stay
 * disabled until their reciter, complete contents, and source chain are verified.
 */
export const RUQYAH_PROGRAM_AUDIO: RuqyahProgramAudio[] = [
  {
    id: 'brief-ruqya',
    name: 'الرقية المختصرة',
    description: 'التسجيل الكامل موقوف لحين التحقق من القارئ والمحتوى والمصدر.',
    audioUrl: ''
  },
  {
    id: 'a-medium-ruqya',
    name: 'الرقية المتوسطة',
    description: 'التسجيل الكامل موقوف لحين التحقق من القارئ والمحتوى والمصدر.',
    audioUrl: ''
  },
  {
    id: 'a-long-ruqya',
    name: 'الرقية المطولة',
    description: 'التسجيل الكامل موقوف لحين التحقق من القارئ والمحتوى والمصدر.',
    audioUrl: ''
  }
];

export const RUQYAH_GUIDELINES: RuqyahItem[] = [
  {
    id: 'g-1',
    categories: ['guidelines'],
    type: 'guideline',
    title: 'إخلاص النية لله واليقين بالشفاء',
    text: 'أن يعتقد الراقي والمسترقي أن الشفاء من عند الله وحده، وأن الرقية سبب شرعي لا تؤثر بنفسها بل بإذن الله تعالى.',
    repeatTarget: null,
    source: 'القرآن الكريم، الشعراء 80',
    explanation: 'قال الله تعالى: ﴿وَإِذَا مَرِضْتُ فَهُوَ يَشْفِينِ﴾ [الشعراء: 80]'
  },
  {
    id: 'g-3',
    categories: ['guidelines'],
    type: 'guideline',
    title: 'وضع اليد والنفث والمسح',
    text: 'كان النبي ﷺ إذا أوى إلى فراشه جمع كفيه ونفث فيهما وقرأ الإخلاص والفلق والناس، ثم مسح بهما ما استطاع من جسده، ويفعل ذلك ثلاث مرات.',
    repeatTarget: 1,
    source: 'صحيح البخاري 5017',
    explanation: 'هذه صفة ثابتة عند النوم، ولا يلزم تعميمها على كل موضع أو هيئة من هيئات الرقية.'
  },
  {
    id: 'g-4',
    categories: ['guidelines'],
    type: 'guideline',
    title: 'الجمع بين الرقية والتداوي',
    text: 'اجمع بين الرقية والدعاء والتداوي؛ فالأخذ بالأسباب الطبية لا ينافي التوكل على الله.',
    repeatTarget: null,
    source: 'ابن باز: هل يترك العلاج ويكتفى بالتوكل على الله؟',
    explanation: 'ذكر الشيخ ابن باز أن الجمع بين العلاج والدعاء أفضل، وأن التداوي من الأخذ بالأسباب المشروعة.'
  },
  {
    id: 'g-5',
    categories: ['guidelines'],
    type: 'guideline',
    title: 'اجتناب الرقى التي تشتمل على شرك أو ألفاظ مجهولة',
    text: 'تكون الرقية بآيات القرآن والأدعية المشروعة والكلام المفهوم، وتخلو من الاستعانة بغير الله أو الطلاسم.',
    repeatTarget: null,
    source: 'صحيح مسلم 2200',
    explanation: 'قال النبي ﷺ: «لا بأس بالرقى ما لم يكن فيه شرك».'
  },
  {
    id: 'g-6',
    categories: ['guidelines'],
    type: 'guideline',
    title: 'الأولى أن يرقي المسلم نفسه وأهله',
    text: 'رقية الإنسان لنفسه ولأهله وأولاده أعظم إخلاصاً وأقرب للتوكل من طلب الرقية من الغير، وإن جاز طلبها عند الحاجة.',
    repeatTarget: null,
    source: 'صحيح البخاري 5752؛ صحيح مسلم 220',
    explanation: 'من صفات السبعين ألفاً الذين يدخلون الجنة بغير حساب أنهم لا يسترقون وعلى ربهم يتوكلون، مع مشروعية أن يرقي الإنسان نفسه وأهله.'
  },
  {
    id: 'g-7',
    categories: ['guidelines'],
    type: 'guideline',
    title: 'تحصين البيت بتلاوة سورة البقرة',
    text: 'اجعلوا لبيوتكم نصيباً من تلاوة القرآن وسورة البقرة، فإن البيت الذي تُقرأ فيه سورة البقرة ينفر منه الشيطان.',
    repeatTarget: null,
    source: 'صحيح مسلم 780',
    explanation: 'قال النبي ﷺ: «لا تجعلوا بيوتكم مقابر، إن الشيطان ينفر من البيت الذي تُقرأ فيه سورة البقرة».'
  }
];

export const RUQYAH_ITEMS: RuqyahItem[] = [
  // --- القرآن الكريم ---
  {
    id: 'q-fatihah',
    categories: ['brief', 'medium', 'full', 'eye_envy', 'illness', 'magic_protection', 'children_home', 'anxiety_sleep'],
    type: 'quran',
    title: 'سورة الفاتحة',
    surahNumber: 1,
    surahName: 'الفاتحة',
    verseRange: '1-7',
    text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ ۞ الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ ۞ الرَّحْمَٰنِ الرَّحِيمِ ۞ مَالِكِ يَوْمِ الدِّينِ ۞ إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ ۞ اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ ۞ صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ',
    repeatTarget: null,
    source: 'صحيح البخاري 5736',
    explanation: 'ثبتت مشروعية قراءة الفاتحة في الرقية في حديث أبي سعيد الخدري، ولم يحدد الحديث عددًا ثابتًا لتكرارها.',
  },
  {
    id: 'q-baqarah-1-5',
    categories: ['medium', 'full', 'magic_protection', 'children_home'],
    type: 'quran',
    title: 'أوائل سورة البقرة',
    surahNumber: 2,
    surahName: 'البقرة',
    verseRange: '1-5',
    text: 'الم ۞ ذَٰلِكَ الْكِتَابُ لَا رَيْبَ ۛ فِيهِ ۛ هُدًى لِّلْمُتَّقِينَ ۞ الَّذِينَ يُؤْمِنُونَ بِالْغَيْبِ وَيُقِيمُونَ الصَّلَاةَ وَمِمَّا رَزَقْنَاهُمْ يُنفِقُونَ ۞ وَالَّذِينَ يُؤْمِنُونَ بِمَا أُنزِلَ إِلَيْكَ وَمَا أُنزِلَ مِن قَبْلِكَ وَبِالْآخِرَةِ هُمْ يُوقِنُونَ ۞ أُولَٰئِكَ عَلَىٰ هُدًى مِّن رَّبِّهِمْ ۖ وَأُولَٰئِكَ هُمُ الْمُفْلِحُونَ',
    repeatTarget: null,
    source: 'القرآن الكريم، البقرة 1-5',
    explanation: 'آيات من القرآن الكريم تُقرأ ضمن الرقية العامة، دون تخصيصها بعدد أو ادعاء أثر مستقل لها.',
  },
  {
    id: 'q-baqarah-102',
    categories: ['full', 'magic_protection'],
    type: 'quran',
    title: 'آية إبطال ضرر السحر بإذن الله',
    surahNumber: 2,
    surahName: 'البقرة',
    verseRange: '102',
    text: 'وَاتَّبَعُوا مَا تَتْلُو الشَّيَاطِينُ عَلَىٰ مُلْكِ سُلَيْمَانَ...',
    repeatTarget: null,
    source: 'القرآن الكريم، البقرة 102',
    explanation: 'تقرر الآية قاعدة التوحيد العظيمة: ﴿وَمَا هُم بِضَارِّينَ بِهِ مِنْ أَحَدٍ إِلَّا بِإِذْنِ اللَّهِ﴾، ولا يثبت لها عدد تكرار مخصوص.',
  },
  {
    id: 'q-kursi',
    categories: ['brief', 'medium', 'full', 'eye_envy', 'illness', 'magic_protection', 'children_home', 'anxiety_sleep'],
    type: 'quran',
    title: 'آية الكرسي',
    surahNumber: 2,
    surahName: 'البقرة',
    verseRange: '255',
    text: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ ۚ لَّهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ ۗ مَن ذَا الَّذِي يَشْفَعُ عِندَهُ إِلَّا بِإِذْنِهِ ۚ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ ۖ وَلَا يُحِيطُونَ بِشَيْءٍ مِّنْ عِلْمِهِ إِلَّا بِمَا شَاءَ ۚ وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالْأَرْضَ ۖ وَلَا يَئُودُهُ حِفْظُهُمَا ۚ وَهُوَ الْعَلِيُّ الْعَظِيمُ',
    repeatTarget: null,
    source: 'صحيح البخاري 2311 (معلّق؛ وُصل عند النسائي وابن خزيمة)',
    explanation: 'ثبت فضل قراءتها عند النوم، ولا يثبت في هذا الحديث تكرارها ثلاث مرات.',
  },
  {
    id: 'q-baqarah-256-257',
    categories: ['medium', 'full', 'magic_protection'],
    type: 'quran',
    title: 'آيات من سورة البقرة',
    surahNumber: 2,
    surahName: 'البقرة',
    verseRange: '256-257',
    text: 'لَا إِكْرَاهَ فِي الدِّينِ ۖ قَد تَّبَيَّنَ الرُّشْدُ مِنَ الْغَيِّ ۚ فَمَن يَكْفُرْ بِالطَّاغُوتِ وَيُؤْمِن بِاللَّهِ فَقَدِ اسْتَمْسَكَ بِالْعُرْوَةِ الْوُثْقَىٰ لَا انفِصَامَ لَهَا ۗ وَاللَّهُ سَمِيعٌ عَلِيمٌ ۞ اللَّهُ وَلِيُّ الَّذِينَ آمَنُوا يُخْرِجُهُم مِّنَ الظُّلُمَاتِ إِلَى النُّورِ ۖ وَالَّذِينَ كَفَرُوا أَوْلِيَاؤُهُمُ الطَّاغُوتُ يُخْرِجُونَهُم مِّنَ النُّورِ إِلَى الظُّلُمَاتِ ۗ أُولَٰئِكَ أَصْحَابُ النَّارِ ۖ هُمْ فِيهَا خَالِدُونَ',
    repeatTarget: null,
    source: 'القرآن الكريم، البقرة 256-257',
    explanation: 'آيات قرآنية تُقرأ ضمن عموم القرآن، دون عدد مخصوص ثابت للرقية.',
  },
  {
    id: 'q-baqarah-last2',
    categories: ['brief', 'medium', 'full', 'eye_envy', 'illness', 'magic_protection', 'children_home', 'anxiety_sleep'],
    type: 'quran',
    title: 'خواتيم سورة البقرة',
    surahNumber: 2,
    surahName: 'البقرة',
    verseRange: '285-286',
    text: 'آمَنَ الرَّسُولُ بِمَا أُنزِلَ إِلَيْهِ مِن رَّبِّهِ وَالْمُؤْمِنُونَ ۚ كُلٌّ آمَنَ بِاللَّهِ وَمَلَائِكَتِهِ وَكُتُبِهِ وَرُسُلِهِ لَا نُفَرِّقُ بَيْنَ أَحَدٍ مِّن رُّسُلِهِ ۚ وَقَالُوا سَمِعْنَا وَأَطَعْنَا ۖ غُفْرَانَكَ رَبَّنَا وَإِلَيْكَ الْمَصِيرُ ۞ لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا ۚ لَهَا مَا كَسَبَتْ وَعَلَيْهَا مَا اكْتَسَبَتْ ۗ رَبَّنَا لَا تُؤَاخِذْنَا إِن نَّسِينَا أَوْ أَخْطَأْنَا ۚ رَبَّنَا وَلَا تَحْمِلْ عَلَيْنَا إِصْرًا كَمَا حَمَلْتَهُ عَلَى الَّذِينَ مِن قَبْلِنَا ۚ رَبَّنَا وَلَا تُحَمِّلْنَا مَا لَا طَاقَةَ لَنَا بِهِ ۖ وَاعْفُ عَنَّا وَاغْفِرْ لَنَا وَارْحَمْنَا ۚ أَنتَ مَوْلَانَا فَانصُرْنَا عَلَى الْقَوْمِ الْكَافِرِينَ',
    repeatTarget: null,
    source: 'صحيح البخاري 5009؛ صحيح مسلم 808a',
    explanation: 'ثبت أن من قرأ الآيتين في ليلة كفتاه؛ ولا يذكر الحديث تكرارهما ثلاث مرات.',
  },
  {
    id: 'q-ali-imran-18-19',
    categories: ['medium', 'full', 'eye_envy'],
    type: 'quran',
    title: 'شهادة التوحيد من آل عمران',
    surahNumber: 3,
    surahName: 'آل عمران',
    verseRange: '18-19',
    text: 'شَهِدَ اللَّهُ أَنَّهُ لَا إِلَٰهَ إِلَّا هُوَ...',
    repeatTarget: null,
    source: 'القرآن الكريم، آل عمران 18-19',
    explanation: 'آيات في تعظيم التوحيد وتجديد الإيمان تُقرأ ضمن عموم الرقية بالقرآن دون عدد مخصوص.',
  },
  {
    id: 'q-araf-54-56',
    categories: ['full', 'magic_protection', 'anxiety_sleep'],
    type: 'quran',
    title: 'آيات العظمة والدعاء من الأعراف',
    surahNumber: 7,
    surahName: 'الأعراف',
    verseRange: '54-56',
    text: 'إِنَّ رَبَّكُمُ اللَّهُ الَّذِي خَلَقَ السَّمَاوَاتِ وَالْأَرْضَ...',
    repeatTarget: null,
    source: 'القرآن الكريم، الأعراف 54-56',
    explanation: 'آيات جليلة في ربوبية الله تعالى واللجوء إليه بالدعاء تضرعاً وخفية، دون عدد تكرار مخصوص.',
  },
  {
    id: 'q-araf-magic',
    categories: ['medium', 'full', 'magic_protection'],
    type: 'quran',
    title: 'آيات من سورة الأعراف',
    surahNumber: 7,
    surahName: 'الأعراف',
    verseRange: '117-122',
    text: 'وَأَوْحَيْنَا إِلَىٰ مُوسَىٰ أَنْ أَلْقِ عَصَاكَ ۖ فَإِذَا هِيَ تَلْقَفُ مَا يَأْفِكُونَ ۞ فَوَقَعَ الْحَقُّ وَبَطَلَ مَا كَانُوا يَعْمَلُونَ ۞ فَغُلِبُوا هُنَالِكَ وَانقَلَبُوا صَاغِرِينَ ۞ وَأُلْقِيَ السَّحَرَةُ سَاجِدِينَ ۞ قَالُوا آمَنَّا بِرَبِّ الْعَالَمِينَ ۞ رَبِّ مُوسَىٰ وَهَارُونَ',
    repeatTarget: null,
    source: 'القرآن الكريم، الأعراف 117-122',
    explanation: 'آيات من قصة موسى عليه السلام. تُقرأ من القرآن دون تخصيص عدد أو الجزم بأنها وصفة مستقلة لإبطال السحر.',
  },
  {
    id: 'q-tawbah-14',
    categories: ['full', 'illness'],
    type: 'quran',
    title: 'آية شفاء الصدور من سورة التوبة',
    surahNumber: 9,
    surahName: 'التوبة',
    verseRange: '14',
    text: 'قَاتِلُوهُمْ يُعَذِّبْهُمُ اللَّهُ بِأَيْدِيكُمْ وَيُخْزِهِمْ وَيَنصُرْكُمْ عَلَيْهِمْ وَيَشْفِ صُدُورَ قَوْمٍ مُّؤْمِنِينَ',
    repeatTarget: null,
    source: 'القرآن الكريم، التوبة 14',
    explanation: 'إحدى الآيات التي ورد فيها ذكر الشفاء في القرآن الكريم، وتُقرأ ضمن عموم الرقية بالقرآن دون عدد محدد.',
  },
  {
    id: 'q-yunus-57',
    categories: ['medium', 'full', 'illness', 'anxiety_sleep'],
    type: 'quran',
    title: 'آية الشفاء والموعظة من سورة يونس',
    surahNumber: 10,
    surahName: 'يونس',
    verseRange: '57',
    text: 'يَا أَيُّهَا النَّاسُ قَدْ جَاءَتْكُم مَّوْعِظَةٌ مِّن رَّبِّكُمْ وَشِفَاءٌ لِّمَا فِي الصُّدُورِ وَهُدًى وَرَحْمَةٌ لِّلْمُؤْمِنِينَ',
    repeatTarget: null,
    source: 'القرآن الكريم، يونس 57',
    explanation: 'تبيّن أن القرآن شفاء لما في الصدور وهدى ورحمة للمؤمنين، وتُقرأ بلا عدد مخصوص.',
  },
  {
    id: 'q-yunus-magic',
    categories: ['medium', 'full', 'magic_protection'],
    type: 'quran',
    title: 'آيات من سورة يونس',
    surahNumber: 10,
    surahName: 'يونس',
    verseRange: '81-82',
    text: 'فَلَمَّا أَلْقَوْا قَالَ مُوسَىٰ مَا جِئْتُم بِهِ السِّحْرُ ۖ إِنَّ اللَّهَ سَيُبْطِلُهُ ۖ إِنَّ اللَّهَ لَا يُصْلِحُ عَمَلَ الْمُفْسِدِينَ ۞ وَيُحِقُّ اللَّهُ الْحَقَّ بِكَلِمَاتِهِ وَلَوْ كَرِهَ الْمُجْرِمُونَ',
    repeatTarget: null,
    source: 'القرآن الكريم، يونس 81-82',
    explanation: 'آيات من القرآن الكريم، ولا يثبت لها عدد مخصوص أو أثر مستقل خارج عموم الرقية بالقرآن.',
  },
  {
    id: 'q-rad-28',
    categories: ['medium', 'full', 'anxiety_sleep'],
    type: 'quran',
    title: 'آية طمأنينة القلوب بذكر الله',
    surahNumber: 13,
    surahName: 'الرعد',
    verseRange: '28',
    text: 'الَّذِينَ آمَنُوا وَتَطْمَئِنُّ قُلُوبُهُم بِذِكْرِ اللَّهِ ۗ أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ',
    repeatTarget: null,
    source: 'القرآن الكريم، الرعد 28',
    explanation: 'آية عظيمة في السكينة والطمأنينة بذكر الله تعالى، تُقرأ ضمن عموم القرآن دون عدد محدد.',
  },
  {
    id: 'q-nahl-69',
    categories: ['full', 'illness'],
    type: 'quran',
    title: 'آية الشفاء من سورة النحل',
    surahNumber: 16,
    surahName: 'النحل',
    verseRange: '69',
    text: 'ثُمَّ كُلِي مِن كُلِّ الثَّمَرَاتِ فَاسْلُكِي سُبُلَ رَبِّكِ ذُلُلًا...',
    repeatTarget: null,
    source: 'القرآن الكريم، النحل 69',
    explanation: 'من الآيات الواردة فيها لفظ الشفاء، تُقرأ ضمن عموم الرقية بالقرآن الكريم.',
  },
  {
    id: 'q-isra-healing',
    categories: ['medium', 'full', 'illness'],
    type: 'quran',
    title: 'آية الشفاء والرحمة',
    surahNumber: 17,
    surahName: 'الإسراء',
    verseRange: '82',
    text: 'وَنُنَزِّلُ مِنَ الْقُرْآنِ مَا هُوَ شِفَاءٌ وَرَحْمَةٌ لِّلْمُؤْمِنِينَ ۙ وَلَا يَزِيدُ الظَّالِمِينَ إِلَّا خَسَارًا',
    repeatTarget: null,
    source: 'القرآن الكريم، الإسراء 82',
    explanation: 'تصف الآية القرآن بأنه شفاء ورحمة للمؤمنين، ولا تجعل منها وصفة علاجية بعدد محدد.',
  },
  {
    id: 'q-ta-ha-magic',
    categories: ['medium', 'full', 'magic_protection'],
    type: 'quran',
    title: 'آية من سورة طه',
    surahNumber: 20,
    surahName: 'طه',
    verseRange: '69',
    text: 'وَأَلْقِ مَا فِي يَمِينِكَ تَلْقَفْ مَا صَنَعُوا ۖ إِنَّمَا صَنَعُوا كَيْدُ سَاحِرٍ ۖ وَلَا يُفْلِحُ السَّاحِرُ حَيْثُ أَتَىٰ',
    repeatTarget: null,
    source: 'القرآن الكريم، طه 69',
    explanation: 'آية من القرآن الكريم، تُقرأ دون تحديد عدد مخصوص لم يثبت به دليل.',
  },
  {
    id: 'q-muminun-115-118',
    categories: ['full', 'magic_protection'],
    type: 'quran',
    title: 'خواتيم سورة المؤمنون',
    surahNumber: 23,
    surahName: 'المؤمنون',
    verseRange: '115-118',
    text: 'أَفَحَسِبْتُمْ أَنَّمَا خَلَقْنَاكُمْ عَبَثًا وَأَنَّكُمْ إِلَيْنَا لَا تُرْجَعُونَ...',
    repeatTarget: null,
    source: 'القرآن الكريم، المؤمنون 115-118',
    explanation: 'آيات عظيمة في تنزيه الله تعالى والدعاء بالرحمة والمغفرة، تُقرأ ضمن عموم القرآن دون عدد محدد.',
  },
  {
    id: 'q-shuara-78-82',
    categories: ['full', 'illness'],
    type: 'quran',
    title: 'آيات الشفاء من سورة الشعراء',
    surahNumber: 26,
    surahName: 'الشعراء',
    verseRange: '78-82',
    text: 'الَّذِي خَلَقَنِي فَهُوَ يَهْدِينِ ۞ وَالَّذِي هُوَ يُطْعِمُنِي وَيَسْقِينِ ۞ وَإِذَا مَرِضْتُ فَهُوَ يَشْفِينِ...',
    repeatTarget: null,
    source: 'القرآن الكريم، الشعراء 78-82',
    explanation: 'توحيد الله تعالى بالخلق والرزق والشفاء على لسان إبراهيم عليه السلام، دون عدد تكرار مخصوص.',
  },
  {
    id: 'q-saffat-1-10',
    categories: ['full', 'magic_protection'],
    type: 'quran',
    title: 'أوائل سورة الصافات',
    surahNumber: 37,
    surahName: 'الصافات',
    verseRange: '1-10',
    text: 'وَالصَّافَّاتِ صَفًّا...',
    repeatTarget: null,
    source: 'القرآن الكريم، الصافات 1-10',
    explanation: 'آيات في حفظ السماء من كل شيطان مارد وتوحيد رب السماوات والأرض، تُقرأ ضمن عموم الرقية بالقرآن.',
  },
  {
    id: 'q-fussilat-44',
    categories: ['full', 'illness'],
    type: 'quran',
    title: 'آية الهدى والشفاء من سورة فصلت',
    surahNumber: 41,
    surahName: 'فصلت',
    verseRange: '44',
    text: 'قُلْ هُوَ لِلَّذِينَ آمَنُوا هُدًى وَشِفَاءٌ...',
    repeatTarget: null,
    source: 'القرآن الكريم، فصلت 44',
    explanation: 'تقرير أن القرآن الكريم هدى وشفاء للمؤمنين، وتُقرأ ضمن عموم الرقية بالقرآن بلا عدد محدد.',
  },
  {
    id: 'q-fath-4',
    categories: ['medium', 'full', 'anxiety_sleep'],
    type: 'quran',
    title: 'آية إنزال السكينة من سورة الفتح',
    surahNumber: 48,
    surahName: 'الفتح',
    verseRange: '4',
    text: 'هُوَ الَّذِي أَنزَلَ السَّكِينَةَ فِي قُلُوبِ الْمُؤْمِنِينَ لِيَزْدَادُوا إِيمَانًا مَّعَ إِيمَانِهِمْ...',
    repeatTarget: null,
    source: 'القرآن الكريم، الفتح 4',
    explanation: 'من آيات السكينة في القرآن الكريم، تُقرأ لطلب الطمأنينة وانشراح القلب دون عدد تكرار مخصوص.',
  },
  {
    id: 'q-hashr-21-24',
    categories: ['medium', 'full', 'eye_envy', 'magic_protection'],
    type: 'quran',
    title: 'خواتيم سورة الحشر',
    surahNumber: 59,
    surahName: 'الحشر',
    verseRange: '21-24',
    text: 'لَوْ أَنزَلْنَا هَٰذَا الْقُرْآنَ عَلَىٰ جَبَلٍ لَّرَأَيْتَهُ خَاشِعًا مُّتَصَدِّعًا مِّنْ خَشْيَةِ اللَّهِ...',
    repeatTarget: null,
    source: 'القرآن الكريم، الحشر 21-24',
    explanation: 'آيات جليلة في أسماء الله الحسنى وعظمة القرآن الكريم، تُقرأ ضمن عموم الرقية بالقرآن دون عدد محدد.',
  },
  {
    id: 'q-qalam-51-52',
    categories: ['medium', 'full', 'eye_envy'],
    type: 'quran',
    title: 'آيتا سورة القلم في العين',
    surahNumber: 68,
    surahName: 'القلم',
    verseRange: '51-52',
    text: 'وَإِن يَكَادُ الَّذِينَ كَفَرُوا لَيُزْلِقُونَكَ بِأَبْصَارِهِمْ لَمَّا سَمِعُوا الذِّكْرَ وَيَقُولُونَ إِنَّهُ لَمَجْنُونٌ ۞ وَمَا هُوَ إِلَّا ذِكْرٌ لِّلْعَالَمِينَ',
    repeatTarget: null,
    source: 'القرآن الكريم، القلم 51-52',
    explanation: 'مما جرت عادة أهل العلم بقراءته ضمن آيات القرآن في رقية العين، دون اعتقاد عدد ثابت أو تخصيص لم يثبت بنص.',
  },
  {
    id: 'q-sharh',
    categories: ['medium', 'full', 'anxiety_sleep'],
    type: 'quran',
    title: 'سورة الشرح',
    surahNumber: 94,
    surahName: 'الشرح',
    verseRange: '1-8',
    text: 'أَلَمْ نَشْرَحْ لَكَ صَدْرَكَ...',
    repeatTarget: null,
    source: 'القرآن الكريم، الشرح 1-8',
    explanation: 'سورة مباركة في انشراح الصدر وتيسير العسر والتوجه إلى الله بالرغبة، دون عدد محدد.',
  },
  {
    id: 'q-kafirun',
    categories: ['medium', 'full', 'magic_protection', 'children_home'],
    type: 'quran',
    title: 'سورة الكافرون',
    surahNumber: 109,
    surahName: 'الكافرون',
    verseRange: '1-6',
    text: 'قُلْ يَا أَيُّهَا الْكَافِرُونَ...',
    repeatTarget: null,
    source: 'سنن أبي داود 5055 (صحيح، الألباني)',
    explanation: 'ثبت فضل قراءتها عند النوم فإنها براءة من الشرك، ولم يثبت لها عدد تكرار مخصوص في الرقية.',
  },
  {
    id: 'q-ikhlas',
    categories: ['brief', 'medium', 'full', 'eye_envy', 'illness', 'magic_protection', 'children_home', 'anxiety_sleep'],
    type: 'quran',
    title: 'سورة الإخلاص',
    surahNumber: 112,
    surahName: 'الإخلاص',
    verseRange: '1-4',
    text: 'قُلْ هُوَ اللَّهُ أَحَدٌ ۞ اللَّهُ الصَّمَدُ ۞ لَمْ يَلِدْ وَلَمْ يُولَدْ ۞ وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ',
    repeatTarget: 3,
    source: 'صحيح البخاري 5017؛ سنن أبي داود 5082 (حسن، الألباني)',
    explanation: 'تقرأ مع سورتي الفلق والناس ثلاث مرات صباحًا ومساءً، وثبت قراءتها قبل النوم مع النفث والمسح.',
  },
  {
    id: 'q-falaq',
    categories: ['brief', 'medium', 'full', 'eye_envy', 'illness', 'magic_protection', 'children_home', 'anxiety_sleep'],
    type: 'quran',
    title: 'سورة الفلق',
    surahNumber: 113,
    surahName: 'الفلق',
    verseRange: '1-5',
    text: 'قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ ۞ مِن شَرِّ مَا خَلَقَ ۞ وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ ۞ وَمِن شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ ۞ وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ',
    repeatTarget: 3,
    source: 'صحيح البخاري 5017؛ سنن أبي داود 5082 (حسن، الألباني)',
    explanation: 'تقرأ مع سورتي الإخلاص والناس ثلاث مرات صباحًا ومساءً، وثبتت قراءتها قبل النوم مع النفث والمسح.',
  },
  {
    id: 'q-nas',
    categories: ['brief', 'medium', 'full', 'eye_envy', 'illness', 'magic_protection', 'children_home', 'anxiety_sleep'],
    type: 'quran',
    title: 'سورة الناس',
    surahNumber: 114,
    surahName: 'الناس',
    verseRange: '1-6',
    text: 'قُلْ أَعُوذُ بِرَبِّ النَّاسِ ۞ مَلِكِ النَّاسِ ۞ إِلَٰهِ النَّاسِ ۞ مِن شَرِّ الْوَسْوَاسِ الْخَنَّاسِ ۞ الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ ۞ مِنَ الْجِنَّةِ وَالنَّاسِ',
    repeatTarget: 3,
    source: 'صحيح البخاري 5017؛ سنن أبي داود 5082 (حسن، الألباني)',
    explanation: 'تقرأ مع سورتي الإخلاص والفلق ثلاث مرات صباحًا ومساءً، وثبتت قراءتها قبل النوم مع النفث والمسح.',
  },

  // --- الأدعية والأذكار النبوية ---
  {
    id: 'd-1',
    categories: ['brief', 'medium', 'full', 'eye_envy', 'illness'],
    type: 'dua',
    title: 'دعاء الشفاء للمريض',
    text: 'أَذْهِبِ الْبَأْسَ رَبَّ النَّاسِ، وَاشْفِ أَنْتَ الشَّافِي، لَا شِفَاءَ إِلَّا شِفَاؤُكَ، شِفَاءً لَا يُغَادِرُ سَقَمًا.',
    repeatTarget: null,
    source: 'صحيح البخاري 5750',
    explanation: 'كان النبي ﷺ يمسح بيده اليمنى على موضع الألم ويقول هذا الدعاء، ولم يحدد الحديث عددًا لتكراره.'
  },
  {
    id: 'd-2',
    categories: ['brief', 'medium', 'full', 'eye_envy', 'illness', 'magic_protection'],
    type: 'dua',
    title: 'دعاء الرقية النبوي',
    text: 'بِسْمِ اللَّهِ أَرْقِيكَ، مِنْ كُلِّ شَيْءٍ يُؤْذِيكَ، مِنْ شَرِّ كُلِّ نَفْسٍ أَوْ عَيْنِ حَاسِدٍ، اللَّهُ يَشْفِيكَ، بِسْمِ اللَّهِ أَرْقِيكَ.',
    repeatTarget: null,
    source: 'صحيح مسلم 2186',
    explanation: 'دعاء رقية قاله جبريل للنبي ﷺ، ولم يحدد الحديث عددًا ثابتًا لتكراره.'
  },
  {
    id: 'd-9',
    categories: ['medium', 'full', 'eye_envy', 'illness'],
    type: 'dua',
    title: 'رقية جبريل الثانية من الداء والعين',
    text: 'بِسْمِ اللَّهِ يُبْرِيكَ، وَمِنْ كُلِّ دَاءٍ يَشْفِيكَ، وَمِنْ شَرِّ حَاسِدٍ إِذَا حَسَدَ، وَشَرِّ كُلِّ ذِي عَيْنٍ.',
    repeatTarget: null,
    source: 'صحيح مسلم 2185',
    explanation: 'ثبت في صحيح مسلم عن عائشة رضي الله عنها أن جبريل عليه السلام رقى النبي ﷺ بهذا اللفظ.'
  },
  {
    id: 'd-3',
    categories: ['brief', 'medium', 'full', 'eye_envy', 'illness', 'children_home'],
    type: 'dua',
    title: 'دعاء الاستعاذة من الشيطان والعين',
    text: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّةِ، مِنْ كُلِّ شَيْطَانٍ وَهَامَّةٍ، وَمِنْ كُلِّ عَيْنٍ لَامَّةٍ.',
    repeatTarget: null,
    source: 'صحيح البخاري 3371',
    explanation: 'كان النبي ﷺ يعوذ به الحسن والحسين، ولم يحدد الحديث عددًا معينًا لتكراره.'
  },
  {
    id: 'd-4',
    categories: ['brief', 'medium', 'full', 'eye_envy', 'illness', 'magic_protection', 'children_home'],
    type: 'dua',
    title: 'ذكر الحفظ صباحًا ومساءً',
    text: 'بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ، وَهُوَ السَّمِيعُ الْعَلِيمُ.',
    repeatTarget: 3,
    source: 'سنن أبي داود 5088 (صحيح، الألباني)؛ حصن المسلم 86',
    explanation: 'هذا من أذكار الصباح والمساء، ويقال ثلاث مرات في كل منهما؛ وليس عددًا عامًا لكل رقية.'
  },
  {
    id: 'd-6',
    categories: ['full', 'illness'],
    type: 'dua',
    title: 'دعاء الألم النبوي',
    text: 'أَعُوذُ بِاللَّهِ وَقُدْرَتِهِ مِنْ شَرِّ مَا أَجِدُ وَأُحَاذِرُ',
    repeatTarget: 7,
    source: 'صحيح مسلم 2202',
    explanation: 'ضع يدك على موضع الألم، وقل «بسم الله» ثلاث مرات، ثم قل الدعاء المعروض سبع مرات.'
  },
  {
    id: 'd-8',
    categories: ['medium', 'full', 'illness'],
    type: 'dua',
    title: 'دعاء عيادة المريض سبع مرات',
    text: 'أَسْأَلُ اللَّهَ الْعَظِيمَ رَبَّ الْعَرْشِ الْعَظِيمِ أَنْ يَشْفِيَكَ.',
    repeatTarget: 7,
    source: 'سنن أبي داود 3106؛ سنن الترمذي 2083 (صحيح، الألباني)',
    explanation: 'من عاد مريضاً لم يحضر أجله فقال عنده سبع مرات: أسأل الله العظيم رب العرش العظيم أن يشفيك إلا عافاه الله من ذلك المرض.'
  },
  {
    id: 'd-10',
    categories: ['full', 'illness'],
    type: 'dua',
    title: 'الرقية الواردة في القرحة والوجع',
    text: 'بِسْمِ اللَّهِ تُرْبَةُ أَرْضِنَا، بِرِيقَةِ بَعْضِنَا، يُشْفَى سَقِيمُنَا، بِإِذْنِ رَبِّنَا.',
    repeatTarget: null,
    source: 'صحيح البخاري 5745؛ صحيح مسلم 2194',
    explanation: 'كان النبي ﷺ إذا اشتكى الإنسان الشيء أو كانت به قرحة أو جرح وضع سبابته بالأرض ثم رفعها وقال هذا الدعاء.'
  },
  {
    id: 'd-11',
    categories: ['medium', 'full', 'magic_protection', 'children_home'],
    type: 'dua',
    title: 'الاستعاذة بكلمات الله التامات',
    text: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ.',
    repeatTarget: 3,
    source: 'صحيح مسلم 2708 و2709؛ سنن الترمذي 3604',
    explanation: 'ثبت قولها ثلاث مرات عند المساء، كما ثبت قولها عند نزول منزل في سفر أو غيره فلا يضره شيء حتى يرتحل.'
  },
  {
    id: 'd-12',
    categories: ['medium', 'full', 'anxiety_sleep', 'children_home'],
    type: 'dua',
    title: 'دعاء الفزع والقلق في النوم',
    text: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ غَضَبِهِ وَعِقَابِهِ وَشَرِّ عِبَادِهِ، وَمِنْ هَمَزَاتِ الشَّيَاطِينِ وَأَنْ يَحْضُرُونِ.',
    repeatTarget: null,
    source: 'سنن أبي داود 3893؛ سنن الترمذي 3528 (حسن، الألباني)',
    explanation: 'علّمه النبي ﷺ لأصحابه عند الفزع في النوم، ولم يُقيَّد بعدد ثابت في الحديث.'
  },
  {
    id: 'd-13',
    categories: ['medium', 'full', 'anxiety_sleep'],
    type: 'dua',
    title: 'دعاء الكرب العظيم',
    text: 'لَا إِلَٰهَ إِلَّا اللَّهُ الْعَظِيمُ الْحَلِيمُ، لَا إِلَٰهَ إِلَّا اللَّهُ رَبُّ الْعَرْشِ الْعَظِيمِ، لَا إِلَٰهَ إِلَّا اللَّهُ رَبُّ السَّمَاوَاتِ وَرَبُّ الْأَرْضِ وَرَبُّ الْعَرْشِ الْكَرِيمِ.',
    repeatTarget: null,
    source: 'صحيح البخاري 6346؛ صحيح مسلم 2730',
    explanation: 'كان النبي ﷺ يقول هذا الدعاء العظيم عند الكرب والشدة.'
  },
  {
    id: 'd-14',
    categories: ['medium', 'full', 'illness', 'children_home'],
    type: 'dua',
    title: 'دعاء العافية في البدن والسمع والبصر',
    text: 'اللَّهُمَّ عَافِنِي فِي بَدَنِي، اللَّهُمَّ عَافِنِي فِي سَمْعِي، اللَّهُمَّ عَافِنِي فِي بَصَرِي، لَا إِلَٰهَ إِلَّا أَنْتَ.',
    repeatTarget: 3,
    source: 'سنن أبي داود 5090 (حسن، ابن باز والألباني)',
    explanation: 'ثبت قوله ثلاث مرات حين يصبح وثلاث مرات حين يمسي.'
  },
  {
    id: 'd-15',
    categories: ['full', 'illness'],
    type: 'dua',
    title: 'دعاء التبشير للمريض عند عيادته',
    text: 'لَا بَأْسَ طَهُورٌ إِنْ شَاءَ اللَّهُ.',
    repeatTarget: null,
    source: 'صحيح البخاري 3616 و5656',
    explanation: 'كان النبي ﷺ إذا دخل على مريض يعوده قال له هذا الدعاء المبارك.'
  },
  {
    id: 'd-16',
    categories: ['full', 'anxiety_sleep'],
    type: 'dua',
    title: 'الاستعاذة من الهم والحزن',
    text: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحَزَنِ، وَالْعَجْزِ وَالْكَسَلِ، وَالْجُبْنِ وَالْبُخْلِ، وَضَلَعِ الدَّيْنِ، وَغَلَبَةِ الرِّجَالِ.',
    repeatTarget: null,
    source: 'صحيح البخاري 6369',
    explanation: 'كان النبي ﷺ يُكثر من الاستعاذة بهذه الكلمات الجامعة.'
  },
  {
    id: 'd-17',
    categories: ['medium', 'full', 'anxiety_sleep'],
    type: 'dua',
    title: 'دعاء ذي النون لتفريج الكرب',
    text: 'لَا إِلَٰهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ.',
    repeatTarget: null,
    source: 'القرآن الكريم، الأنبياء 87؛ سنن الترمذي 3505 (صحيح، الألباني)',
    explanation: 'لم يدعُ بها رجل مسلم في شيء قط إلا استجاب الله له.'
  },
  {
    id: 'd-18',
    categories: ['full', 'anxiety_sleep', 'magic_protection'],
    type: 'dua',
    title: 'كفاية الله لمن توكل عليه',
    text: 'حَسْبِيَ اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ عَلَيْهِ تَوَكَّلْتُ وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ.',
    repeatTarget: 7,
    source: 'سنن أبي داود 5081 (موقوفاً على أبي الدرداء؛ صححه الأرنؤوط)',
    explanation: 'من قالها حين يصبح وحين يمسي سبع مرات كفاه الله ما أهمّه.'
  }
];

/**
 * Curated, timed Audio Ruqyah listening sessions composed strictly from verified
 * local Quranic Ruqyah verses and played sequentially via WIRD's approved reciters.
 */
export const AUDIO_RUQYAH_SESSIONS: RuqyahAudioSession[] = [
  {
    id: 'audio-quick-3m',
    title: 'الرقية الصوتية السريعة',
    subtitle: 'التحصين اليومي المختصر',
    durationBadge: '~3 دقائق',
    estimatedMinutes: 3,
    focusLabel: 'تحصين يومي سريع',
    description: 'تلاوة متتابعة مركّزة لأصول التحصين اليومي: الفاتحة، آية الكرسي، خواتيم البقرة، والمعوذات.',
    tracks: [
      { itemId: 'q-fatihah' },
      { itemId: 'q-kursi' },
      { itemId: 'q-baqarah-last2' },
      { itemId: 'q-ikhlas' },
      { itemId: 'q-falaq' },
      { itemId: 'q-nas' }
    ]
  },
  {
    id: 'audio-calm-6m',
    title: 'الرقية الصوتية للسكينة والشفاء',
    subtitle: 'جلسة هادئة لطمأنينة القلب',
    durationBadge: '~6 دقائق',
    estimatedMinutes: 6,
    focusLabel: 'السكينة والشفاء',
    description: 'تلاوة هادئة تجمع أصول الرقية مع آيات الشفاء والطمأنينة وسورة الشرح والمعوذات.',
    tracks: [
      { itemId: 'q-fatihah' },
      { itemId: 'q-baqarah-1-5' },
      { itemId: 'q-kursi' },
      { itemId: 'q-baqarah-last2' },
      { itemId: 'q-yunus-57' },
      { itemId: 'q-rad-28' },
      { itemId: 'q-isra-healing' },
      { itemId: 'q-fath-4' },
      { itemId: 'q-sharh' },
      { itemId: 'q-ikhlas' },
      { itemId: 'q-falaq' },
      { itemId: 'q-nas' }
    ]
  },
  {
    id: 'audio-eye-envy-12m',
    title: 'الرقية الصوتية للعين والحسد',
    subtitle: 'جلسة متوسطة مع تكرار المعوذات ثلاثاً',
    durationBadge: '~12 دقيقة',
    estimatedMinutes: 12,
    focusLabel: 'العين والحسد والتحصين',
    description: 'تلاوة مرتّبة تضم الفاتحة والكرسي وخواتيم البقرة وآل عمران وخواتيم الحشر وآيتي القلم وتكرار المعوذات ثلاثاً.',
    tracks: [
      { itemId: 'q-fatihah' },
      { itemId: 'q-baqarah-1-5' },
      { itemId: 'q-kursi' },
      { itemId: 'q-baqarah-256-257' },
      { itemId: 'q-baqarah-last2' },
      { itemId: 'q-ali-imran-18-19' },
      { itemId: 'q-hashr-21-24' },
      { itemId: 'q-qalam-51-52' },
      { itemId: 'q-kafirun' },
      { itemId: 'q-ikhlas', repeatCount: 3 },
      { itemId: 'q-falaq', repeatCount: 3 },
      { itemId: 'q-nas', repeatCount: 3 }
    ]
  },
  {
    id: 'audio-magic-20m',
    title: 'الرقية الصوتية الشاملة للتحصين',
    subtitle: 'آيات السحر والحفظ وأوائل الصافات',
    durationBadge: '~20 دقيقة',
    estimatedMinutes: 20,
    focusLabel: 'التحصين الشامل',
    description: 'تلاوة متسلسلة شاملة تضم آيات البقرة والأعراف ويونس وطه والمؤمنون وأوائل الصافات وخواتيم الحشر والمعوذات ثلاثاً.',
    tracks: [
      { itemId: 'q-fatihah' },
      { itemId: 'q-baqarah-1-5' },
      { itemId: 'q-baqarah-102' },
      { itemId: 'q-kursi' },
      { itemId: 'q-baqarah-256-257' },
      { itemId: 'q-baqarah-last2' },
      { itemId: 'q-araf-54-56' },
      { itemId: 'q-araf-magic' },
      { itemId: 'q-yunus-magic' },
      { itemId: 'q-ta-ha-magic' },
      { itemId: 'q-muminun-115-118' },
      { itemId: 'q-saffat-1-10' },
      { itemId: 'q-hashr-21-24' },
      { itemId: 'q-kafirun' },
      { itemId: 'q-ikhlas', repeatCount: 3 },
      { itemId: 'q-falaq', repeatCount: 3 },
      { itemId: 'q-nas', repeatCount: 3 }
    ]
  },
  {
    id: 'audio-extended-30m',
    title: 'الرقية الصوتية المطوّلة الكاملة',
    subtitle: 'جميع آيات الرقية والشفاء والسكينة في جلسة واحدة',
    durationBadge: '~30 دقيقة',
    estimatedMinutes: 30,
    focusLabel: 'الجلسة المطوّلة الكاملة',
    description: 'الجلسة الصوتية الأوسع؛ تجمع جميع آيات الرقية والشفاء والسكينة والتحصين من القرآن الكريم مع تكرار المعوذات ثلاثاً ومناسبة لمؤقّت النوم.',
    tracks: [
      { itemId: 'q-fatihah' },
      { itemId: 'q-baqarah-1-5' },
      { itemId: 'q-baqarah-102' },
      { itemId: 'q-kursi' },
      { itemId: 'q-baqarah-256-257' },
      { itemId: 'q-baqarah-last2' },
      { itemId: 'q-ali-imran-18-19' },
      { itemId: 'q-araf-54-56' },
      { itemId: 'q-araf-magic' },
      { itemId: 'q-tawbah-14' },
      { itemId: 'q-yunus-57' },
      { itemId: 'q-yunus-magic' },
      { itemId: 'q-rad-28' },
      { itemId: 'q-nahl-69' },
      { itemId: 'q-isra-healing' },
      { itemId: 'q-ta-ha-magic' },
      { itemId: 'q-muminun-115-118' },
      { itemId: 'q-shuara-78-82' },
      { itemId: 'q-saffat-1-10' },
      { itemId: 'q-fussilat-44' },
      { itemId: 'q-fath-4' },
      { itemId: 'q-hashr-21-24' },
      { itemId: 'q-qalam-51-52' },
      { itemId: 'q-sharh' },
      { itemId: 'q-kafirun' },
      { itemId: 'q-ikhlas', repeatCount: 3 },
      { itemId: 'q-falaq', repeatCount: 3 },
      { itemId: 'q-nas', repeatCount: 3 }
    ]
  }
];

export const getRuqyahItemsByCategory = (cat: RuqyahCategory): RuqyahItem[] => {
  if (cat === 'guidelines') return RUQYAH_GUIDELINES;
  return RUQYAH_ITEMS.filter(item => item.categories.includes(cat));
};

export const getRuqyahCategoryMeta = (cat: RuqyahCategory): RuqyahCategoryMeta => {
  return RUQYAH_CATEGORIES.find(c => c.id === cat) ?? RUQYAH_CATEGORIES[0];
};
