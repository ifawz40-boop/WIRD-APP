export type AdhkarCategory =
  | 'morning'
  | 'evening'
  | 'after_prayer'
  | 'sleeping'
  | 'waking_up'
  | 'quranic_duas'
  | 'prophetic_duas'
  | 'istighfar';

export interface AdhkarCategoryMeta {
  id: AdhkarCategory;
  label: string;
  shortLabel: string;
  description: string;
  recommendedTimeAr: string;
}

export interface AdhkarItem {
  id: string;
  title: string;
  categories: AdhkarCategory[];
  kind: 'quran' | 'hadith';
  /** Canonical Arabic text with full diacritics. For kind === 'quran', runtime also resolves verified local Quran chunks. */
  text: string;
  surahNumber?: number;
  surahName?: string;
  startAyah?: number;
  endAyah?: number;
  repeatTarget: number;
  /** Optional category-specific Sunnah repetition target (e.g., Mu'awwidhat are 1x after obligatory prayers vs 3x morning/evening/sleep). */
  repeatTargetByCategory?: Partial<Record<AdhkarCategory, number>>;
  virtue: string;
  source: string;
  grade: 'قرآن كريم' | 'متفق عليه' | 'صحيح' | 'حسن';
}

export const LEGACY_ADHKAR_ITEM_ID_ALIASES: Record<string, string> = {
  'adhkar-sleep-bismika-ربي-wadatu': 'adhkar-sleep-bismika-rabbi-wadatu'
};

export function getAdhkarRepeatTarget(item: AdhkarItem, category?: AdhkarCategory): number {
  if (category && item.repeatTargetByCategory && typeof item.repeatTargetByCategory[category] === 'number') {
    return item.repeatTargetByCategory[category]!;
  }
  return item.repeatTarget;
}

export const ADHKAR_CATEGORIES: AdhkarCategoryMeta[] = [
  {
    id: 'morning',
    label: 'أذكار الصباح',
    shortLabel: 'الصباح',
    description: 'حصن المسلم في مطلع اليوم لحفظ القلب والبدن والرزق',
    recommendedTimeAr: 'من بعد صلاة الفجر إلى طلوع الشمس (ويمتد وقتها إلى الزوال)'
  },
  {
    id: 'evening',
    label: 'أذكار المساء',
    shortLabel: 'المساء',
    description: 'أذكار التحصين والسكينة في ختام النهار وإقبال الليل',
    recommendedTimeAr: 'من بعد صلاة العصر إلى غروب الشمس (ويمتد وقتها إلى ثلث الليل)'
  },
  {
    id: 'after_prayer',
    label: 'أذكار بعد الصلاة',
    shortLabel: 'بعد الصلاة',
    description: 'الأذكار المشروعة دبر الصلوات المكتوبة كما ثبتت في السنة',
    recommendedTimeAr: 'عقب السلام من كل صلاة مفروضة'
  },
  {
    id: 'sleeping',
    label: 'أذكار النوم',
    shortLabel: 'النوم',
    description: 'ما يقال عند الإيواء إلى الفراش للتحصين والختم بالتوحيد',
    recommendedTimeAr: 'عند الاضطجاع على الفراش قبل النوم'
  },
  {
    id: 'waking_up',
    label: 'أذكار الاستيقاظ',
    shortLabel: 'الاستيقاظ',
    description: 'حمد الله على رد الروح والعافية في مستهل اليقظة',
    recommendedTimeAr: 'فور الاستيقاظ من النوم'
  },
  {
    id: 'quranic_duas',
    label: 'أدعية قرآنية جامعة',
    shortLabel: 'أدعية قرآنية',
    description: 'جوامع الدعاء من آيات القرآن الكريم مع التلاوة الصوتية',
    recommendedTimeAr: 'في كل وقت، وفي السجود وأدبار الصلوات'
  },
  {
    id: 'prophetic_duas',
    label: 'أدعية نبوية مأثورة',
    shortLabel: 'أدعية نبوية',
    description: 'جوامع دعاء النبي ﷺ في صلاح الدين والدنيا والآخرة',
    recommendedTimeAr: 'في أوقات الإجابة وسائر اليوم'
  },
  {
    id: 'istighfar',
    label: 'الاستغفار والتسبيح',
    shortLabel: 'الاستغفار',
    description: 'الباقيات الصالحات وصيغ الاستغفار والتسبيح اليومية',
    recommendedTimeAr: 'مطلق الذكر في سائر الأوقات'
  }
];

export const ADHKAR_ITEMS: AdhkarItem[] = [
  // 1. Quranic Adhkar (Morning, Evening, After Prayer, Sleeping)
  {
    id: 'adhkar-ayat-alkursi',
    title: 'آية الكرسي',
    categories: ['morning', 'evening', 'after_prayer', 'sleeping'],
    kind: 'quran',
    surahNumber: 2,
    surahName: 'البقرة',
    startAyah: 255,
    endAyah: 255,
    text: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ ۚ لَّهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ ۗ مَن ذَا الَّذِي يَشْفَعُ عِندَهُ إِلَّا بِإِذْنِهِ ۚ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ ۖ وَلَا يُحِيطُونَ بِشَيْءٍ مِّنْ عِلْمِهِ إِلَّا بِمَا شَاءَ ۚ وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالْأَرْضَ ۖ وَلَا يَئُودُهُ حِفْظُهُمَا ۚ وَهُوَ الْعَلِيُّ الْعَظِيمُ',
    repeatTarget: 1,
    virtue: 'من قرأها دبر كل صلاة مكتوبة لم يمنعه من دخول الجنة إلا أن يموت، ومن قرأها عند النوم لم يزل عليه من الله حافظ.',
    source: 'صحيح البخاري 2311؛ السنن الكبرى للنسائي 9928',
    grade: 'قرآن كريم'
  },
  {
    id: 'adhkar-baqarah-last2',
    title: 'خواتيم سورة البقرة',
    categories: ['evening', 'sleeping'],
    kind: 'quran',
    surahNumber: 2,
    surahName: 'البقرة',
    startAyah: 285,
    endAyah: 286,
    text: 'آمَنَ الرَّسُولُ بِمَا أُنزِلَ إِلَيْهِ مِن رَّبِّهِ وَالْمُؤْمِنُونَ ۚ كُلٌّ آمَنَ بِاللَّهِ وَمَلَائِكَتِهِ وَكُتُبِهِ وَرُسُلِهِ لَا نُفَرِّقُ بَيْنَ أَحَدٍ مِّن رُّسُلِهِ ۚ وَقَالُوا سَمِعْنَا وَأَطَعْنَا ۖ غُفْرَانَكَ رَبَّنَا وَإِلَيْكَ الْمَصِيرُ * لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا ۚ لَهَا مَا كَسَبَتْ وَعَلَيْهَا مَا اكْتَسَبَتْ ۗ رَبَّنَا لَا تُؤَاخِذْنَا إِن نَّسِينَا أَوْ أَخْطَأْنَا ۚ رَبَّنَا وَلَا تَحْمِلْ عَلَيْنَا إِصْرًا كَمَا حَمَلْتَهُ عَلَى الَّذِينَ مِن قَبْلِنَا ۚ رَبَّنَا وَلَا تُحَمِّلْنَا مَا لَا طَاقَةَ لَنَا بِهِ ۖ وَاعْفُ عَنَّا وَاغْفِرْ لَنَا وَارْحَمْنَا ۚ أَنتَ مَوْلَانَا فَانصُرْنَا عَلَى الْقَوْمِ الْكَافِرِينَ',
    repeatTarget: 1,
    virtue: 'من قرأ بالآيتين من آخر سورة البقرة في ليلة كفتاه.',
    source: 'صحيح البخاري 5009؛ صحيح مسلم 808',
    grade: 'قرآن كريم'
  },
  {
    id: 'adhkar-ikhlas',
    title: 'سورة الإخلاص',
    categories: ['morning', 'evening', 'after_prayer', 'sleeping'],
    kind: 'quran',
    surahNumber: 112,
    surahName: 'الإخلاص',
    startAyah: 1,
    endAyah: 4,
    text: 'قُلْ هُوَ اللَّهُ أَحَدٌ * اللَّهُ الصَّمَدُ * لَمْ يَلِدْ وَلَمْ يُولَدْ * وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ',
    repeatTarget: 3,
    repeatTargetByCategory: { after_prayer: 1 },
    virtue: 'تُقرأ ثلاث مرات مع المعوذتين في الصباح والمساء فتكفيك من كل شيء (أبو داود 5082، الترمذي 3575)، وثلاث مرات عند النوم مع النفث والمسح (البخاري 5017)، ومرة واحدة دبر كل صلاة مكتوبة (أبو داود 1523، النسائي 1336؛ وتُثَلّث بعد الفجر والمغرب لاندراج وقتهما في أذكار الصباح والمساء).',
    source: 'صحيح البخاري 5017؛ سنن أبي داود 1523 و5082؛ سنن الترمذي 2903 و3575؛ سنن النسائي 1336',
    grade: 'قرآن كريم'
  },
  {
    id: 'adhkar-falaq',
    title: 'سورة الفلق',
    categories: ['morning', 'evening', 'after_prayer', 'sleeping'],
    kind: 'quran',
    surahNumber: 113,
    surahName: 'الفلق',
    startAyah: 1,
    endAyah: 5,
    text: 'قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ * مِن شَرِّ مَا خَلَقَ * وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ * وَمِن شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ * وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ',
    repeatTarget: 3,
    repeatTargetByCategory: { after_prayer: 1 },
    virtue: 'من المعوذات التي يُتحصن بها ثلاث مرات في الصباح والمساء (أبو داود 5082، الترمذي 3575) وعند النوم (البخاري 5017)، ومرة واحدة دبر كل صلاة مكتوبة (أبو داود 1523، النسائي 1336؛ وتُثَلّث بعد الفجر والمغرب لاندراج وقتهما في أذكار الصباح والمساء).',
    source: 'صحيح البخاري 5017؛ سنن أبي داود 1523 و5082؛ سنن الترمذي 2903 و3575؛ سنن النسائي 1336',
    grade: 'قرآن كريم'
  },
  {
    id: 'adhkar-nas',
    title: 'سورة الناس',
    categories: ['morning', 'evening', 'after_prayer', 'sleeping'],
    kind: 'quran',
    surahNumber: 114,
    surahName: 'الناس',
    startAyah: 1,
    endAyah: 6,
    text: 'قُلْ أَعُوذُ بِرَبِّ النَّاسِ * مَلِكِ النَّاسِ * إِلَٰهِ النَّاسِ * مِن شَرِّ الْوَسْوَاسِ الْخَنَّاسِ * الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ * مِنَ الْجِنَّةِ وَالنَّاسِ',
    repeatTarget: 3,
    repeatTargetByCategory: { after_prayer: 1 },
    virtue: 'من المعوذات الكافية بإذن الله من كل شر: ثلاث مرات في الصباح والمساء (أبو داود 5082، الترمذي 3575) وعند النوم (البخاري 5017)، ومرة واحدة دبر كل صلاة مكتوبة (أبو داود 1523، النسائي 1336؛ وتُثَلّث بعد الفجر والمغرب لاندراج وقتهما في أذكار الصباح والمساء).',
    source: 'صحيح البخاري 5017؛ سنن أبي داود 1523 و5082؛ سنن الترمذي 2903 و3575؛ سنن النسائي 1336',
    grade: 'قرآن كريم'
  },

  // 2. Morning & Evening Prophetic Adhkar
  {
    id: 'adhkar-sayyid-istighfar',
    title: 'سيد الاستغفار',
    categories: ['morning', 'evening', 'istighfar'],
    kind: 'hadith',
    text: 'اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَٰهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَىٰ عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ لَكَ بِذَنْبِي فَاغْفِرْ لِي، فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ.',
    repeatTarget: 1,
    virtue: 'من قالها من النهار موقناً بها فمات من يومه قبل أن يمسي فهو من أهل الجنة، ومن قالها من الليل وهو موقن بها فمات قبل أن يصبح فهو من أهل الجنة.',
    source: 'صحيح البخاري 6306',
    grade: 'صحيح'
  },
  {
    id: 'adhkar-asbahna-mulk',
    title: 'أصبحنا وأصبح الملك لله',
    categories: ['morning'],
    kind: 'hadith',
    text: 'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ وَالْحَمْدُ لِلَّهِ، لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ، رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَٰذَا الْيَوْمِ وَخَيْرَ مَا بَعْدَهُ، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَٰذَا الْيَوْمِ وَشَرِّ مَا بَعْدَهُ، رَبِّ أَعُوذُ بِكَ مِنَ الْكَسَلِ وَسُوءِ الْكِبَرِ، رَبِّ أَعُوذُ بِكَ مِنْ عَذَابٍ فِي النَّارِ وَعَذَابٍ فِي الْقَبْرِ.',
    repeatTarget: 1,
    virtue: 'تفويض الأمر لله في مستهل الصباح وسؤاله خير اليوم والاستعاذة من شره.',
    source: 'صحيح مسلم 2723',
    grade: 'صحيح'
  },
  {
    id: 'adhkar-amsayna-mulk',
    title: 'أمسينا وأمسى الملك لله',
    categories: ['evening'],
    kind: 'hadith',
    text: 'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ وَالْحَمْدُ لِلَّهِ، لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ، رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَٰذِهِ اللَّيْلَةِ وَخَيْرَ مَا بَعْدَهَا، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَٰذِهِ اللَّيْلَةِ وَشَرِّ مَا بَعْدَهَا، رَبِّ أَعُوذُ بِكَ مِنَ الْكَسَلِ وَسُوءِ الْكِبَرِ، رَبِّ أَعُوذُ بِكَ مِنْ عَذَابٍ فِي النَّارِ وَعَذَابٍ فِي الْقَبْرِ.',
    repeatTarget: 1,
    virtue: 'إعلان التوحيد والافتقار إلى الله عند إقبال الليل وسؤاله خير الليلة وما بعدها.',
    source: 'صحيح مسلم 2723',
    grade: 'صحيح'
  },
  {
    id: 'adhkar-bika-asbahna',
    title: 'اللهم بك أصبحنا وبك أمسينا',
    categories: ['morning'],
    kind: 'hadith',
    text: 'اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ النُّشُورُ.',
    repeatTarget: 1,
    virtue: 'تجديد الإيمان بالبعث والنشور والتوكل على الله في مطلع النهار.',
    source: 'سنن الترمذي 3391؛ سنن أبي داود 5068 (صحيح، الألباني)',
    grade: 'صحيح'
  },
  {
    id: 'adhkar-bika-amsayna',
    title: 'اللهم بك أمسينا وبك أصبحنا',
    categories: ['evening'],
    kind: 'hadith',
    text: 'اللَّهُمَّ بِكَ أَمْسَيْنَا، وَبِكَ أَصْبَحْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ الْمَصِيرُ.',
    repeatTarget: 1,
    virtue: 'تجديد التوكل على الله وتذكر المصير إليه عند المساء.',
    source: 'سنن الترمذي 3391؛ سنن أبي داود 5068 (صحيح، الألباني)',
    grade: 'صحيح'
  },
  {
    id: 'adhkar-bismillah-la-yadurru',
    title: 'بسم الله الذي لا يضر مع اسمه شيء',
    categories: ['morning', 'evening'],
    kind: 'hadith',
    text: 'بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ.',
    repeatTarget: 3,
    virtue: 'ما من عبد يقولها في صباح كل يوم ومساء كل ليلة ثلاث مرات فيضره شيء.',
    source: 'سنن أبي داود 5088؛ سنن الترمذي 3388 (صحيح، الألباني)',
    grade: 'صحيح'
  },
  {
    id: 'adhkar-kalimat-tammat',
    title: 'أعوذ بكلمات الله التامات من شر ما خلق',
    categories: ['evening'],
    kind: 'hadith',
    text: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ.',
    repeatTarget: 3,
    virtue: 'ثبتت في المساء بلفظ «أما لو قلت حين أمسيت... لم تضرك» (صحيح مسلم 2709)، وجاء التقييد بثلاث مرات في المساء في سنن الترمذي (3604) ومسند أحمد (7898): «من قال حين يمسي ثلاث مرات... لم تضره حُمة تلك الليلة»، وتقال أيضاً عند نزول منزل فيحفظه الله حتى يرتحل منه (صحيح مسلم 2708).',
    source: 'صحيح مسلم 2708 و2709؛ سنن الترمذي 3604؛ مسند أحمد 7898',
    grade: 'صحيح'
  },
  {
    id: 'adhkar-afiyah',
    title: 'سؤال العفو والعافية في الدنيا والآخرة',
    categories: ['morning', 'evening', 'prophetic_duas'],
    kind: 'hadith',
    text: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي الدُّنْيَا وَالْآخِرَةِ، اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي دِينِي وَدُنْيَايَ وَأَهْلِي وَمَالِي، اللَّهُمَّ اسْتُرْ عَوْرَاتِي، وَآمِنْ رَوْعَاتِي، اللَّهُمَّ احْفَظْنِي مِنْ بَيْنِ يَدَيَّ، وَمِنْ خَلْفِي، وَعَنْ يَمِينِي، وَعَنْ شِمَالِي، وَمِنْ فَوْقِي، وَأَعُوذُ بِعَظَمَتِكَ أَنْ أُغْتَالَ مِنْ تَحْتِي.',
    repeatTarget: 1,
    virtue: 'لم يكن رسول الله ﷺ يدع هؤلاء الدعوات حين يمسي وحين يصبح.',
    source: 'سنن أبي داود 5074؛ سنن ابن ماجه 3871 (صحيح، الألباني)',
    grade: 'صحيح'
  },
  {
    id: 'adhkar-subhanallah-100',
    title: 'سبحان الله وبحمده (مائة مرة)',
    categories: ['morning', 'evening', 'istighfar'],
    kind: 'hadith',
    text: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ.',
    repeatTarget: 100,
    virtue: 'من قال حين يصبح وحين يمسي: سبحان الله وبحمده مائة مرة، حُطَّت خطاياه وإن كانت مثل زبد البحر، ولم يأت أحد يوم القيامة بأفضل مما جاء به إلا أحد قال مثل ما قال أو زاد عليه.',
    source: 'صحيح البخاري 6405؛ صحيح مسلم 2692',
    grade: 'متفق عليه'
  },

  // 3. After Prayer Adhkar
  {
    id: 'adhkar-after-prayer-istighfar-salam',
    title: 'الاستغفار ثلاثاً واللهم أنت السلام',
    categories: ['after_prayer'],
    kind: 'hadith',
    text: 'أَسْتَغْفِرُ اللَّهَ (ثَلَاثًا) — اللَّهُمَّ أَنْتَ السَّلَامُ وَمِنْكَ السَّلَامُ، تَبَارَكْتَ يَا ذَا الْجَلَالِ وَالْإِكْرَامِ.',
    repeatTarget: 1,
    virtue: 'كان رسول الله ﷺ إذا انصرف من صلاته استغفر ثلاثاً وقال هذا الذكر.',
    source: 'صحيح مسلم 591',
    grade: 'صحيح'
  },
  {
    id: 'adhkar-after-prayer-tahlil',
    title: 'لا إله إلا الله وحده لا شريك له (بعد الصلاة)',
    categories: ['after_prayer'],
    kind: 'hadith',
    text: 'لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ، اللَّهُمَّ لَا مَانِعَ لِمَا أَعْطَيْتَ، وَلَا مُعْطِيَ لِمَا مَنَعْتَ، وَلَا يَنْفَعُ ذَا الْجَدِّ مِنْكَ الْجَدُّ.',
    repeatTarget: 1,
    virtue: 'كان النبي ﷺ يقولها في دبر كل صلاة مكتوبة.',
    source: 'صحيح البخاري 844؛ صحيح مسلم 593',
    grade: 'متفق عليه'
  },
  {
    id: 'adhkar-after-prayer-tasbih-33',
    title: 'سبحان الله (ثلاثاً وثلاثين)',
    categories: ['after_prayer', 'istighfar'],
    kind: 'hadith',
    text: 'سُبْحَانَ اللَّهِ.',
    repeatTarget: 33,
    virtue: 'من سبح الله في دبر كل صلاة ثلاثاً وثلاثين، وحمد الله ثلاثاً وثلاثين، وكبر الله ثلاثاً وثلاثين، وقال تمام المائة: لا إله إلا الله وحده لا شريك له... غفرت خطاياه وإن كانت مثل زبد البحر.',
    source: 'صحيح مسلم 597',
    grade: 'صحيح'
  },
  {
    id: 'adhkar-after-prayer-tahmid-33',
    title: 'الحمد لله (ثلاثاً وثلاثين)',
    categories: ['after_prayer', 'istighfar'],
    kind: 'hadith',
    text: 'الْحَمْدُ لِلَّهِ.',
    repeatTarget: 33,
    virtue: 'الركن الثاني من تسبيحات دبر الصلاة المكتوبة.',
    source: 'صحيح مسلم 597',
    grade: 'صحيح'
  },
  {
    id: 'adhkar-after-prayer-takbir-33',
    title: 'الله أكبر (ثلاثاً وثلاثين)',
    categories: ['after_prayer', 'istighfar'],
    kind: 'hadith',
    text: 'اللَّهُ أَكْبَرُ.',
    repeatTarget: 33,
    virtue: 'الركن الثالث من تسبيحات دبر الصلاة المكتوبة ثم يُختم بتمام المائة بالتوحيد.',
    source: 'صحيح مسلم 597',
    grade: 'صحيح'
  },
  {
    id: 'adhkar-after-prayer-ainni',
    title: 'اللهم أعني على ذكرك وشكرك وحسن عبادتك',
    categories: ['after_prayer', 'prophetic_duas'],
    kind: 'hadith',
    text: 'اللَّهُمَّ أَعِنِّي عَلَىٰ ذِكْرِكَ، وَشُكْرِكَ، وَحُسْنِ عِبَادَتِكَ.',
    repeatTarget: 1,
    virtue: 'وصية النبي ﷺ لمعاذ بن جبل رضي الله عنه ألا يدعهن دبر كل صلاة.',
    source: 'سنن أبي داود 1522؛ سنن النسائي 1303 (صحيح، الألباني)',
    grade: 'صحيح'
  },

  // 4. Sleeping & Waking Up Adhkar
  {
    id: 'adhkar-sleep-bismika-amutu',
    title: 'باسمك اللهم أموت وأحيا',
    categories: ['sleeping'],
    kind: 'hadith',
    text: 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا.',
    repeatTarget: 1,
    virtue: 'كان النبي ﷺ إذا أوى إلى فراشه قالها.',
    source: 'صحيح البخاري 6324',
    grade: 'صحيح'
  },
  {
    id: 'adhkar-sleep-bismika-rabbi-wadatu',
    title: 'باسمك ربي وضعت جنبي وبك أرفعه',
    categories: ['sleeping'],
    kind: 'hadith',
    text: 'بِاسْمِكَ رَبِّي وَضَعْتُ جَنْبِي، وَبِكَ أَرْفَعُهُ، فَإِنْ أَمْسَكْتَ نَفْسِي فَارْحَمْهَا، وَإِنْ أَرْسَلْتَهَا فَاحْفَظْهَا بِمَا تَحْفَظُ بِهِ عِبَادَكَ الصَّالِحِينَ.',
    repeatTarget: 1,
    virtue: 'يقال عند الاضطجاع على الفراش بعد نفضه.',
    source: 'صحيح البخاري 6320؛ صحيح مسلم 2714',
    grade: 'متفق عليه'
  },
  {
    id: 'adhkar-sleep-aslamtu-nafsi',
    title: 'اللهم أسلمت نفسي إليك وفوضت أمري إليك',
    categories: ['sleeping'],
    kind: 'hadith',
    text: 'اللَّهُمَّ أَسْلَمْتُ نَفْسِي إِلَيْكَ، وَفَوَّضْتُ أَمْرِي إِلَيْكَ، وَوَجَّهْتُ وَجْهِي إِلَيْكَ، وَأَلْجَأْتُ ظَهْرِي إِلَيْكَ، رَغْبَةً وَرَهْبَةً إِلَيْكَ، لَا مَلْجَأَ وَلَا مَنْجَا مِنْكَ إِلَّا إِلَيْكَ، آمَنْتُ بِكِتَابِكَ الَّذِي أَنْزَلْتَ، وَبِنَبِيِّكَ الَّذِي أَرْسَلْتَ.',
    repeatTarget: 1,
    virtue: 'اجعلهن آخر ما تقول، فإن مت من ليلتك مت على الفطرة.',
    source: 'صحيح البخاري 247؛ صحيح مسلم 2710',
    grade: 'متفق عليه'
  },
  {
    id: 'adhkar-wake-alhamdulillah-ahyana',
    title: 'الحمد لله الذي أحيانا بعدما أماتنا',
    categories: ['waking_up'],
    kind: 'hadith',
    text: 'الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ.',
    repeatTarget: 1,
    virtue: 'كان النبي ﷺ إذا استيقظ من منامه قال هذا الذكر.',
    source: 'صحيح البخاري 6312',
    grade: 'صحيح'
  },
  {
    id: 'adhkar-wake-afani-fi-jasadi',
    title: 'الحمد لله الذي عافاني في جسدي ورد علي روحي',
    categories: ['waking_up'],
    kind: 'hadith',
    text: 'الْحَمْدُ لِلَّهِ الَّذِي عَافَانِي فِي جَسَدِي، وَرَدَّ عَلَيَّ رُوحِي، وَأَذِنَ لِي بِذِكْرِهِ.',
    repeatTarget: 1,
    virtue: 'شكر الله عند الاستيقاظ على نعمة العافية والتوفيق للذكر.',
    source: 'سنن الترمذي 3401 (حسن، الألباني)',
    grade: 'حسن'
  },

  // 5. Quranic Duas (Verified Local Corpus Coordinates + Audio)
  {
    id: 'dua-quran-rabbana-atina',
    title: 'ربنا آتنا في الدنيا حسنة وفي الآخرة حسنة',
    categories: ['quranic_duas'],
    kind: 'quran',
    surahNumber: 2,
    surahName: 'البقرة',
    startAyah: 201,
    endAyah: 201,
    text: 'وَمِنْهُم مَّن يَقُولُ رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ',
    repeatTarget: 3,
    virtue: 'كان أكثر دعاء النبي ﷺ: ربنا آتنا في الدنيا حسنة وفي الآخرة حسنة وقنا عذاب النار.',
    source: 'القرآن الكريم، البقرة 201؛ صحيح البخاري 6389',
    grade: 'قرآن كريم'
  },
  {
    id: 'dua-quran-la-tuzigh',
    title: 'ربنا لا تزغ قلوبنا بعد إذ هديتنا',
    categories: ['quranic_duas'],
    kind: 'quran',
    surahNumber: 3,
    surahName: 'آل عمران',
    startAyah: 8,
    endAyah: 8,
    text: 'رَبَّنَا لَا تُزِغْ قُلُوبَنَا بَعْدَ إِذْ هَدَيْتَنَا وَهَبْ لَنَا مِن لَّدُنكَ رَحْمَةً ۚ إِنَّكَ أَنتَ الْوَهَّابُ',
    repeatTarget: 3,
    virtue: 'دعاء الراسخين في العلم لسؤال الثبات على الهداية والرحمة.',
    source: 'القرآن الكريم، آل عمران 8',
    grade: 'قرآن كريم'
  },
  {
    id: 'dua-quran-yunus',
    title: 'لا إله إلا أنت سبحانك إني كنت من الظالمين',
    categories: ['quranic_duas', 'istighfar'],
    kind: 'quran',
    surahNumber: 21,
    surahName: 'الأنبياء',
    startAyah: 87,
    endAyah: 87,
    text: 'وَذَا النُّونِ إِذ ذَّهَبَ مُغَاضِبًا فَظَنَّ أَن لَّن نَّقْدِرَ عَلَيْهِ فَنَادَىٰ فِي الظُّلُمَاتِ أَن لَّا إِلَٰهَ إِلَّا أَنتَ سُبْحَانَكَ إِنِّي كُنتُ مِنَ الظَّالِمِينَ',
    repeatTarget: 3,
    virtue: 'دعوة ذي النون إذ دعا وهو في بطن الحوت، فإنه لم يدع بها رجل مسلم في شيء قط إلا استجاب الله له.',
    source: 'القرآن الكريم، الأنبياء 87؛ سنن الترمذي 3505 (صحيح، الألباني)',
    grade: 'قرآن كريم'
  },
  {
    id: 'dua-quran-ishrah-sadri',
    title: 'رب اشرح لي صدري ويسر لي أمري',
    categories: ['quranic_duas'],
    kind: 'quran',
    surahNumber: 20,
    surahName: 'طه',
    startAyah: 25,
    endAyah: 28,
    text: 'قَالَ رَبِّ اشْرَحْ لِي صَدْرِي * وَيَسِّرْ لِي أَمْرِي * وَاحْلُلْ عُقْدَةً مِّن لِّسَانِي * يَفْقَهُوا قَوْلِي',
    repeatTarget: 1,
    virtue: 'دعاء كليم الله موسى عليه السلام لشرح الصدر وتيسير الأمر والبيان.',
    source: 'القرآن الكريم، طه 25-28',
    grade: 'قرآن كريم'
  },
  {
    id: 'dua-quran-hab-lana',
    title: 'ربنا هب لنا من أزواجنا وذرياتنا قرة أعين',
    categories: ['quranic_duas'],
    kind: 'quran',
    surahNumber: 25,
    surahName: 'الفرقان',
    startAyah: 74,
    endAyah: 74,
    text: 'وَالَّذِينَ يَقُولُونَ رَبَّنَا هَبْ لَنَا مِنْ أَزْوَاجِنَا وَذُرِّيَّاتِنَا قُرَّةَ أَعْيُنٍ وَاجْعَلْنَا لِلْمُتَّقِينَ إِمَامًا',
    repeatTarget: 1,
    virtue: 'من دعاء عباد الرحمن لصلاح الأهل والذرية والإمامة في الخير.',
    source: 'القرآن الكريم، الفرقان 74',
    grade: 'قرآن كريم'
  },

  // 6. Prophetic Duas & Istighfar
  {
    id: 'dua-prophetic-muqallib-alqulub',
    title: 'يا مقلب القلوب ثبت قلبي على دينك',
    categories: ['prophetic_duas'],
    kind: 'hadith',
    text: 'يَا مُقَلِّبَ الْقُلُوبِ ثَبِّتْ قَلْبِي عَلَىٰ دِينِكَ.',
    repeatTarget: 3,
    virtue: 'كان أكثر دعاء النبي ﷺ، وقال: إن القلوب بين إصبعين من أصابع الله يقلبها كيف يشاء.',
    source: 'سنن الترمذي 2140 (صحيح، الألباني)',
    grade: 'صحيح'
  },
  {
    id: 'dua-prophetic-hamm-hazan',
    title: 'الاستعاذة من الهم والحزن والعجز والكسل',
    categories: ['prophetic_duas', 'morning', 'evening'],
    kind: 'hadith',
    text: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحَزَنِ، وَالْعَجْزِ وَالْكَسَلِ، وَالْبُخْلِ وَالْجُبْنِ، وَضَلَعِ الدَّيْنِ، وَغَلَبَةِ الرِّجَالِ.',
    repeatTarget: 1,
    virtue: 'من أجمع الأدعية النبوية التي كان رسول الله ﷺ يكثر منها لدفع كرب الدنيا.',
    source: 'صحيح البخاري 6369',
    grade: 'صحيح'
  },
  {
    id: 'dua-prophetic-huda-tuqa',
    title: 'اللهم إني أسألك الهدى والتقى والعفاف والغنى',
    categories: ['prophetic_duas'],
    kind: 'hadith',
    text: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْهُدَىٰ وَالتُّقَىٰ، وَالْعَفَافَ وَالْغِنَىٰ.',
    repeatTarget: 1,
    virtue: 'دعاء جامع لصلاح الباطن والظاهر والاستغناء بالله عمن سواه.',
    source: 'صحيح مسلم 2721',
    grade: 'صحيح'
  },
  {
    id: 'adhkar-istighfar-100',
    title: 'أستغفر الله وأتوب إليه (مائة مرة)',
    categories: ['istighfar'],
    kind: 'hadith',
    text: 'أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ.',
    repeatTarget: 100,
    virtue: 'قال رسول الله ﷺ: والله إني لأستغفر الله وأتوب إليه في اليوم أكثر من سبعين مرة (وفي رواية مسلم: مائة مرة).',
    source: 'صحيح البخاري 6307؛ صحيح مسلم 2702',
    grade: 'متفق عليه'
  },
  {
    id: 'adhkar-subhanallah-wa-bihamdihi-azim',
    title: 'سبحان الله وبحمده سبحان الله العظيم',
    categories: ['istighfar'],
    kind: 'hadith',
    text: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ الْعَظِيمِ.',
    repeatTarget: 10,
    virtue: 'كلمتان خفيفتان على اللسان، ثقيلتان في الميزان، حبيبتان إلى الرحمن.',
    source: 'صحيح البخاري 6406؛ صحيح مسلم 2694',
    grade: 'متفق عليه'
  }
];

export const FREE_TASBIH_PRESETS: Array<{ id: string; phrase: string; defaultTarget: number; virtue: string }> = [
  {
    id: 'subhanallah_wabihamdihi',
    phrase: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ',
    defaultTarget: 100,
    virtue: 'حُطَّت خطاياه وإن كانت مثل زبد البحر (متفق عليه)'
  },
  {
    id: 'astaghfirullah',
    phrase: 'أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ',
    defaultTarget: 100,
    virtue: 'سنة النبي ﷺ في الاستغفار اليومي (متفق عليه)'
  },
  {
    id: 'baqiyat_salihat',
    phrase: 'سُبْحَانَ اللَّهِ، وَالْحَمْدُ لِلَّهِ، وَلَا إِلَٰهَ إِلَّا اللَّهُ، وَاللَّهُ أَكْبَرُ',
    defaultTarget: 33,
    virtue: 'أحب الكلام إلى الله أربع (صحيح مسلم 2137)'
  },
  {
    id: 'salawat',
    phrase: 'اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَىٰ نَبِيِّنَا مُحَمَّدٍ',
    defaultTarget: 10,
    virtue: 'من صلى عليَّ صلاة صلى الله عليه بها عشراً (صحيح مسلم 384)'
  },
  {
    id: 'hawqalah',
    phrase: 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ',
    defaultTarget: 33,
    virtue: 'كنز من كنوز الجنة (متفق عليه)'
  }
];

export function getAdhkarItemsByCategory(category: AdhkarCategory): AdhkarItem[] {
  return ADHKAR_ITEMS.filter(item => item.categories.includes(category));
}

export function getRecommendedAdhkarCategoryForHour(hour24: number): AdhkarCategory {
  if (hour24 >= 4 && hour24 < 15) return 'morning';
  if (hour24 >= 15 && hour24 < 22) return 'evening';
  return 'sleeping';
}
