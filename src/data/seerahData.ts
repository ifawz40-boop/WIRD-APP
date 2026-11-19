export const SEERAH_BOOK_VERSION = '1.0.0';

export type SeerahEvidenceGrade = 'ثابت بالصحيح' | 'مشهور في السير' | 'محل خلاف تاريخي';
export type SeerahDatePrecision = 'exact' | 'approximate' | 'range' | 'disputed';

export interface SeerahSourceReference {
  id: string;
  workTitle: string;
  author: string;
  referenceLocator: string;
  sourceType: 'قرآن كريم' | 'حديث صحيح' | 'سيرة ومغازي' | 'شمائل وتراجم';
  rightsStatus: 'verified_public_domain';
  rightsNote: string;
}

export interface SeerahClaim {
  id: string;
  statement: string;
  sourceIds: string[];
  evidenceGrade: SeerahEvidenceGrade;
  datePrecision: SeerahDatePrecision;
  scholarlyNote?: string;
}

export interface SeerahPerson {
  id: string;
  name: string;
  epithet: string;
  category: 'النبي ﷺ' | 'أمهات المؤمنين وآل البيت' | 'الصحابة الكرام' | 'شخصيات السياق التاريخي';
  summary: string;
  chapterIds: string[];
}

export interface SeerahPlace {
  id: string;
  name: string;
  region: string;
  precisionNote: string;
  summary: string;
}

export interface SeerahBodyBlock {
  id: string;
  type: 'paragraph' | 'quote_verified' | 'context_note' | 'uncertainty_note';
  text: string;
  claimIds: string[];
  sourceIds: string[];
}

export interface SeerahScene {
  id: string;
  chapterId: string;
  order: number;
  title: string;
  bodyBlocks: SeerahBodyBlock[];
  personIds: string[];
  placeIds: string[];
}

export interface SeerahQuizQuestion {
  id: string;
  chapterId: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
  claimId: string;
  sourceIds: string[];
}

export interface SeerahChapter {
  id: string;
  partId: string;
  order: number;
  title: string;
  subtitle: string;
  periodLabel: string;
  datePrecision: SeerahDatePrecision;
  intro: string;
  contextNote: string;
  scenes: SeerahScene[];
  closingNarrative: string;
  lessons: string[];
  peopleIds: string[];
  placeIds: string[];
  quizQuestions: SeerahQuizQuestion[];
  previousChapterId: string | null;
  nextChapterId: string | null;
}

export interface SeerahPart {
  id: string;
  order: number;
  title: string;
  subtitle: string;
  periodLabel: string;
  summary: string;
  chapterIds: string[];
}

export const SEERAH_SOURCES: Record<string, SeerahSourceReference> = {
  'src-quran': {
    id: 'src-quran',
    workTitle: 'القرآن الكريم (مصحف المدينة النبوية — رواية حفص عن عاصم)',
    author: 'كلام الله عز وجل',
    referenceLocator: 'سور الفيل، قريش، العلق، المدثر، الإسراء، التوبة، الأنفال، الأحزاب، الفتح، النصر، المائدة',
    sourceType: 'قرآن كريم',
    rightsStatus: 'verified_public_domain',
    rightsNote: 'نص المصحف المحلي الموثق في تطبيق وِرد'
  },
  'src-bukhari': {
    id: 'src-bukhari',
    workTitle: 'الجامع المسند الصحيح المختصر (صحيح البخاري)',
    author: 'الإمام محمد بن إسماعيل البخاري (ت 256هـ)',
    referenceLocator: 'كتاب بدء الوحي، كتاب مناقب الأنصار، كتاب المغازي، كتاب فضائل الصحابة',
    sourceType: 'حديث صحيح',
    rightsStatus: 'verified_public_domain',
    rightsNote: 'تراث إسلامي في الملك العام'
  },
  'src-muslim': {
    id: 'src-muslim',
    workTitle: 'المسند الصحيح المختصر (صحيح مسلم)',
    author: 'الإمام مسلم بن الحجاج النيسابوري (ت 261هـ)',
    referenceLocator: 'كتاب الإيمان، كتاب الجهاد والسير، كتاب الحج، كتاب الفضائل',
    sourceType: 'حديث صحيح',
    rightsStatus: 'verified_public_domain',
    rightsNote: 'تراث إسلامي في الملك العام'
  },
  'src-ibn-hisham': {
    id: 'src-ibn-hisham',
    workTitle: 'السيرة النبوية لابن هشام (عن ابن إسحاق)',
    author: 'أبو محمد عبد الملك بن هشام المعافري (ت 218هـ)',
    referenceLocator: 'الأجزاء 1–4 (ذكر المولد، المبعث، الهجرة، والمغازي)',
    sourceType: 'سيرة ومغازي',
    rightsStatus: 'verified_public_domain',
    rightsNote: 'تراث كلاسيكي في الملك العام؛ صياغة تعليمية محررة مع الإحالة'
  },
  'src-zad-almaad': {
    id: 'src-zad-almaad',
    workTitle: 'زاد المعاد في هدي خير العباد',
    author: 'الإمام شمس الدين ابن قيم الجوزية (ت 751هـ)',
    referenceLocator: 'المجلد الأول والثالث (فصول السيرة والمغازي والهدي النبوي)',
    sourceType: 'سيرة ومغازي',
    rightsStatus: 'verified_public_domain',
    rightsNote: 'تراث كلاسيكي في الملك العام'
  },
  'src-shamail': {
    id: 'src-shamail',
    workTitle: 'الشمائل المحمدية',
    author: 'الإمام أبو عيسى محمد بن عيسى الترمذي (ت 279هـ)',
    referenceLocator: 'أبواب خُلُق رسول الله ﷺ وعبادته وتواضعه ومعيشته',
    sourceType: 'شمائل وتراجم',
    rightsStatus: 'verified_public_domain',
    rightsNote: 'تراث كلاسيكي في الملك العام'
  },
  'src-ibn-saad': {
    id: 'src-ibn-saad',
    workTitle: 'الطبقات الكبرى',
    author: 'محمد بن سعد البصري (ت 230هـ)',
    referenceLocator: 'المجلد الأول والثاني (السيرة والوفود ومرض النبي ﷺ)',
    sourceType: 'شمائل وتراجم',
    rightsStatus: 'verified_public_domain',
    rightsNote: 'تراث كلاسيكي في الملك العام'
  }
};

export const SEERAH_CLAIMS: Record<string, SeerahClaim> = {
  'clm-makkah-sanctuary': {
    id: 'clm-makkah-sanctuary',
    statement: 'كانت مكة المكرمة مركزاً دينياً للعرب لوجود الكعبة المشرفة التي رفع قواعدها إبراهيم وإسماعيل عليهما السلام، وحفظها الله من حملة الفيل.',
    sourceIds: ['src-quran', 'src-ibn-hisham'],
    evidenceGrade: 'ثابت بالصحيح',
    datePrecision: 'approximate'
  },
  'clm-birth-monday-elephant': {
    id: 'clm-birth-monday-elephant',
    statement: 'ثبت في صحيح مسلم أن النبي ﷺ سُئل عن صوم يوم الإثنين فقال: «ذاك يومٌ وُلدتُ فيه، ويومٌ بُعثتُ أو أُنزل عليَّ فيه»، والمشهور أنه وُلد عام الفيل.',
    sourceIds: ['src-muslim', 'src-ibn-hisham'],
    evidenceGrade: 'ثابت بالصحيح',
    datePrecision: 'disputed',
    scholarlyNote: 'ثبت يوم الإثنين وشهر ربيع الأول وعام الفيل عند جمهور أهل السير، واختلف المؤرخون في تحديد رقم اليوم من الشهر (8 أو 9 أو 12 ربيع الأول).'
  },
  'clm-upbringing-kafalah': {
    id: 'clm-upbringing-kafalah',
    statement: 'نشأ النبي ﷺ يتيماً؛ إذ توفي أبوه عبد الله وهو حمل، وأرضعته حليمة السعدية في بادية بني سعد، ثم توفيت أمه آمنة بالأبواء فكفله جده عبد المطلب ثم عمه أبو طالب.',
    sourceIds: ['src-quran', 'src-ibn-hisham', 'src-zad-almaad'],
    evidenceGrade: 'مشهور في السير',
    datePrecision: 'approximate'
  },
  'clm-youth-khadijah-kaaba': {
    id: 'clm-youth-khadijah-kaaba',
    statement: 'عُرف ﷺ في مكة بالصادق الأمين، وشهد حلف الفضول لنصرة المظلوم، وتزوج خديجة بنت خويلد رضي الله عنها، وحكمت قريش برأيه في وضع الحجر الأسود بثوبه فحقن دماءهم.',
    sourceIds: ['src-ibn-hisham', 'src-zad-almaad'],
    evidenceGrade: 'مشهور في السير',
    datePrecision: 'approximate'
  },
  'clm-revelation-iqra': {
    id: 'clm-revelation-iqra',
    statement: 'نزل الوحي على النبي ﷺ في غار حراء بصدر سورة العلق: ﴿اقْرَأْ بِاسْمِ رَبِّكَ الَّذِي خَلَقَ﴾، فثبّتته خديجة رضي الله عنها قائلة: «كلا والله ما يخزيك الله أبداً».',
    sourceIds: ['src-quran', 'src-bukhari', 'src-muslim'],
    evidenceGrade: 'ثابت بالصحيح',
    datePrecision: 'exact'
  },
  'clm-public-call-abyssinia': {
    id: 'clm-public-call-abyssinia',
    statement: 'صدع النبي ﷺ بالدعوة على الصفا بعد مرحلة الدعوة الفردية، واشتد أذى قريش للمستضعفين، فأذن ﷺ لأصحابه بالهجرة إلى الحبشة لما عند النجاشي من العدل.',
    sourceIds: ['src-bukhari', 'src-ibn-hisham'],
    evidenceGrade: 'ثابت بالصحيح',
    datePrecision: 'approximate'
  },
  'clm-sorrow-taif-isra': {
    id: 'clm-sorrow-taif-isra',
    statement: 'توفي أبو طالب وخديجة رضي الله عنها قبل الهجرة بنحو ثلاث سنين، وخرج ﷺ إلى الطائف يدعو ثقيفاً، ثم أكرمه الله بمعجزة الإسراء والمعراج وفُرضت الصلوات الخمس.',
    sourceIds: ['src-quran', 'src-bukhari', 'src-muslim'],
    evidenceGrade: 'ثابت بالصحيح',
    datePrecision: 'approximate',
    scholarlyNote: 'الإسراء والمعراج ثابتان بالقرآن والسنة المتواترة، واختلف المؤرخون في تحديد الشهر والسنة الدقيقة لوقوعهما.'
  },
  'clm-aqabah-pledges': {
    id: 'clm-aqabah-pledges',
    statement: 'بايع وفد الأنصار النبي ﷺ في العقبة الأولى على التوحيد ومكارم الأخلاق وبُعث معهم مصعب بن عمير معلماً، ثم كانت بيعة العقبة الثانية على النصرة والمنعة.',
    sourceIds: ['src-bukhari', 'src-ibn-hisham'],
    evidenceGrade: 'ثابت بالصحيح',
    datePrecision: 'exact'
  },
  'clm-hijrah-journey': {
    id: 'clm-hijrah-journey',
    statement: 'هاجر النبي ﷺ مع صاحبه أبي بكر الصديق رضي الله عنه ومكثا في غار ثور ثلاث ليالٍ حتى هدأ الطلب، ثم وصلا إلى قباء فالمدينة النبوية في ربيع الأول.',
    sourceIds: ['src-quran', 'src-bukhari'],
    evidenceGrade: 'ثابت بالصحيح',
    datePrecision: 'exact'
  },
  'clm-madinah-foundation': {
    id: 'clm-madinah-foundation',
    statement: 'بنى النبي ﷺ المسجد النبوي، وآخى بين المهاجرين والأنصار على الحق والمواساة، وكتب وثيقة المدينة لتنظيم الحقوق والواجبات والدفاع المشترك.',
    sourceIds: ['src-bukhari', 'src-ibn-hisham', 'src-zad-almaad'],
    evidenceGrade: 'ثابت بالصحيح',
    datePrecision: 'exact'
  },
  'clm-badr-furqan': {
    id: 'clm-badr-furqan',
    statement: 'وقعت غزوة بدر الكبرى في رمضان من السنة الثانية للهجرة، وسماها القرآن «يوم الفرقان»، ونصر الله فيها النبي ﷺ وأصحابه وهم قلة على جيش قريش.',
    sourceIds: ['src-quran', 'src-bukhari', 'src-muslim'],
    evidenceGrade: 'ثابت بالصحيح',
    datePrecision: 'exact'
  },
  'clm-uhud-khandaq': {
    id: 'clm-uhud-khandaq',
    statement: 'في شوال سنة 3هـ وقعت غزوة أُحد وظهر فيها أثر مخالفة الرماة للأمر النبوي، وفي سنة 5هـ حفر المسلمون الخندق حول المدينة بمشورة سلمان الفارسي فردّ الله الأحزاب.',
    sourceIds: ['src-quran', 'src-bukhari', 'src-muslim'],
    evidenceGrade: 'ثابت بالصحيح',
    datePrecision: 'exact'
  },
  'clm-hudaybiyyah-fath-mubin': {
    id: 'clm-hudaybiyyah-fath-mubin',
    statement: 'في ذي القعدة سنة 6هـ بايع الصحابة بيعة الرضوان تحت الشجرة وعُقد صلح الحديبية الذي سماه الله فتحاً مبيناً، وتفرغ النبي ﷺ لمكاتبة الملوك ونشر الدعوة.',
    sourceIds: ['src-quran', 'src-bukhari', 'src-muslim'],
    evidenceGrade: 'ثابت بالصحيح',
    datePrecision: 'exact'
  },
  'clm-fath-makkah': {
    id: 'clm-fath-makkah',
    statement: 'في رمضان سنة 8هـ دخل النبي ﷺ مكة فاتحاً متواضعاً لله بعد نقض قريش للعهد، وطهّر البيت الحرام من الأصنام وعفا عن أهل مكة، ثم تتابعت وفود العرب في سنة 9هـ.',
    sourceIds: ['src-quran', 'src-bukhari', 'src-muslim'],
    evidenceGrade: 'ثابت بالصحيح',
    datePrecision: 'exact'
  },
  'clm-farewell-pilgrimage': {
    id: 'clm-farewell-pilgrimage',
    statement: 'في ذي الحجة سنة 10هـ حج النبي ﷺ حجة الوداع وخطب في الناس مقرراً حرمة الدماء والأموال والأعراض وأصول العدل، ونزل قوله تعالى: ﴿الْيَوْمَ أَكْمَلْتُ لَكُمْ دِينَكُمْ﴾.',
    sourceIds: ['src-quran', 'src-bukhari', 'src-muslim'],
    evidenceGrade: 'ثابت بالصحيح',
    datePrecision: 'exact'
  },
  'clm-passing-rafiq-ala': {
    id: 'clm-passing-rafiq-ala',
    statement: 'توفي النبي ﷺ ضحى يوم الإثنين في ربيع الأول سنة 11هـ في حجرة عائشة رضي الله عنها، وثبّت أبو بكر الصديق الأمة بتلاوة قوله تعالى: ﴿وَمَا مُحَمَّدٌ إِلَّا رَسُولٌ قَدْ خَلَتْ مِن قَبْلِهِ الرُّسُلُ﴾.',
    sourceIds: ['src-quran', 'src-bukhari'],
    evidenceGrade: 'ثابت بالصحيح',
    datePrecision: 'exact'
  },
  'clm-shamail-character': {
    id: 'clm-shamail-character',
    statement: 'وصفت عائشة رضي الله عنها خُلُق النبي ﷺ بقولها: «كان خُلُقه القرآن»، وكان أرحم الناس بالضعفاء وأشدهم تواضعاً وفي خدمة أهله، ولم ينتقم لنفسه قط إلا أن تُنتهك حرمة الله.',
    sourceIds: ['src-quran', 'src-bukhari', 'src-muslim', 'src-shamail'],
    evidenceGrade: 'ثابت بالصحيح',
    datePrecision: 'exact'
  }
};

export const SEERAH_PEOPLE: Record<string, SeerahPerson> = {
  'person-prophet': {
    id: 'person-prophet',
    name: 'محمد رسول الله ﷺ',
    epithet: 'خاتم الأنبياء والمرسلين والرحمة المهداة',
    category: 'النبي ﷺ',
    summary: 'محمد بن عبد الله بن عبد المطلب القرشي الهاشمي ﷺ، بعثه الله بالقرآن والسنة هدىً ورحمةً للعالمين.',
    chapterIds: ['ch-1-arabia-makkah', 'ch-2-birth-upbringing', 'ch-3-youth-trustworthy', 'ch-4-revelation-hira', 'ch-5-public-call-abyssinia', 'ch-6-sorrow-taif-isra', 'ch-7-aqabah-pledges', 'ch-8-hijrah-journey', 'ch-9-madinah-foundation', 'ch-10-badr', 'ch-11-uhud-khandaq', 'ch-12-hudaybiyyah-letters', 'ch-13-fath-makkah', 'ch-14-farewell-pilgrimage', 'ch-15-passing-rafiq-ala', 'ch-16-shamail-legacy']
  },
  'person-khadijah': {
    id: 'person-khadijah',
    name: 'خديجة بنت خويلد رضي الله عنها',
    epithet: 'أم المؤمنين وأول من آمن وثبّت النبي ﷺ',
    category: 'أمهات المؤمنين وآل البيت',
    summary: 'زوجه ﷺ الطاهرة العاقلة؛ آزرته بمالها ورأيها وثباتها منذ أول لحظة لنزول الوحي في غار حراء حتى وفاتها قبل الهجرة.',
    chapterIds: ['ch-3-youth-trustworthy', 'ch-4-revelation-hira', 'ch-6-sorrow-taif-isra']
  },
  'person-abu-bakr': {
    id: 'person-abu-bakr',
    name: 'أبو بكر الصديق رضي الله عنه',
    epithet: 'صاحب الغار وخليفة رسول الله ﷺ',
    category: 'الصحابة الكرام',
    summary: 'عبد الله بن أبي قحافة التيمي؛ أسبق الرجال إيماناً، ورفيق الهجرة في غار ثور، وصاحب الموقف الفاصل في تثبيت الأمة يوم وفاة النبي ﷺ.',
    chapterIds: ['ch-4-revelation-hira', 'ch-8-hijrah-journey', 'ch-10-badr', 'ch-15-passing-rafiq-ala']
  },
  'person-aisha': {
    id: 'person-aisha',
    name: 'عائشة بنت أبي بكر رضي الله عنهما',
    epithet: 'أم المؤمنين وفقيهة الأمة وحافظة السنن',
    category: 'أمهات المؤمنين وآل البيت',
    summary: 'نقلت للأمة أدق تفاصيل عبادة النبي ﷺ وشمائله في بيته ومرضه الأخير ووفاته.',
    chapterIds: ['ch-4-revelation-hira', 'ch-15-passing-rafiq-ala', 'ch-16-shamail-legacy']
  },
  'person-musab': {
    id: 'person-musab',
    name: 'مصعب بن عمير رضي الله عنه',
    epithet: 'أول سفير ومقرئ في الإسلام وحامل اللواء',
    category: 'الصحابة الكرام',
    summary: 'بعثه النبي ﷺ بعد بيعة العقبة الأولى يقرئ أهل المدينة القرآن ويفقههم في الدين، واستشهد يوم أُحد.',
    chapterIds: ['ch-7-aqabah-pledges', 'ch-11-uhud-khandaq']
  },
  'person-salman': {
    id: 'person-salman',
    name: 'سلمان الفارسي رضي الله عنه',
    epithet: 'الباحث عن الحق وصاحب مشورة الخندق',
    category: 'الصحابة الكرام',
    summary: 'رحل من بلاد فارس إلى الشام فالحجاز بحثاً عن الحقيقة حتى لقي النبي ﷺ بالمدينة، وأشار بحفر الخندق يوم الأحزاب.',
    chapterIds: ['ch-11-uhud-khandaq']
  }
};

export const SEERAH_PLACES: Record<string, SeerahPlace> = {
  'place-makkah': {
    id: 'place-makkah',
    name: 'مكة المكرمة والمسجد الحرام',
    region: 'الحجاز',
    precisionNote: 'موقع ثابت متواتر',
    summary: 'مهبط الوحي ومولد النبي ﷺ ومقر الكعبة المشرفة وقبلة المسلمين.'
  },
  'place-hira': {
    id: 'place-hira',
    name: 'غار حراء (جبل النور)',
    region: 'شمال شرق مكة المكرمة',
    precisionNote: 'موقع جغرافي معروف بمكة',
    summary: 'الغار الذي كان النبي ﷺ يتحنث فيه الليالي ذوات العدد وفيه نزل أول الوحي.'
  },
  'place-thawr': {
    id: 'place-thawr',
    name: 'غار ثور',
    region: 'جنوب مكة المكرمة',
    precisionNote: 'موقع جغرافي معروف جنوب مكة',
    summary: 'الغار الذي آوى إليه النبي ﷺ وأبو بكر الصديق ثلاث ليالٍ في مستهل رحلة الهجرة.'
  },
  'place-madinah': {
    id: 'place-madinah',
    name: 'المدينة النبوية (طابة)',
    region: 'الحجاز',
    precisionNote: 'موقع ثابت متواتر',
    summary: 'دار الهجرة والنصرة، ومقر المسجد النبوي الشريف وبناء الدولة والمجتمع الإسلامي.'
  },
  'place-badr': {
    id: 'place-badr',
    name: 'وادي بدر',
    region: 'جنوب غرب المدينة النبوية',
    precisionNote: 'موقع معروف بين مكة والمدينة',
    summary: 'موضع غزوة بدر الكبرى (يوم الفرقان) في رمضان سنة 2هـ.'
  },
  'place-hudaybiyyah': {
    id: 'place-hudaybiyyah',
    name: 'الحديبية (الشميسي)',
    region: 'على مشارف الحرم المكي غرب مكة',
    precisionNote: 'موقع معروف على طريق مكة',
    summary: 'موضع بيعة الرضوان وعقد صلح الحديبية في ذي القعدة سنة 6هـ.'
  },
  'place-arafat': {
    id: 'place-arafat',
    name: 'صعيد عرفات',
    region: 'شرق مكة المكرمة',
    precisionNote: 'موقع المشعر الحرام الثابت',
    summary: 'المشعر الذي ألقى فيه النبي ﷺ خطبة الوداع الجامعة ونزلت فيه آية إكمال الدين.'
  }
};

export const SEERAH_PARTS: SeerahPart[] = [
  {
    id: 'part-1-pre-mission',
    order: 1,
    title: 'الجزء الأول: العالم قبل البعثة والميلاد والنشأة',
    subtitle: 'من إرث الخليل إبراهيم عليه السلام في مكة إلى شباب الصادق الأمين ﷺ',
    periodLabel: 'ما قبل البعثة (نحو 571م – 610م)',
    summary: 'يستعرض هذا الجزء السياق الديني والاجتماعي للجزيرة العربية ومكة، ثم المولد الشريف والنشأة النقية التي حفظ الله بها نبيه ﷺ وهيّأه لحمل الرسالة.',
    chapterIds: ['ch-1-arabia-makkah', 'ch-2-birth-upbringing', 'ch-3-youth-trustworthy']
  },
  {
    id: 'part-2-makkan-era',
    order: 2,
    title: 'الجزء الثاني: فجر الوحي والدعوة في مكة',
    subtitle: 'من ليلة غار حراء إلى الصبر على الابتلاء ومعجزة الإسراء والمعراج',
    periodLabel: 'العهد المكي (1 – 13 من البعثة)',
    summary: 'يتتبع هذا الجزء نزول القرآن الكريم في غار حراء، وبناء الجيل الأول على التوحيد، والثبات أمام أذى قريش وحصارها، وهجرة الحبشة، وعام الحزن، ورحلة الإسراء والمعراج.',
    chapterIds: ['ch-4-revelation-hira', 'ch-5-public-call-abyssinia', 'ch-6-sorrow-taif-isra']
  },
  {
    id: 'part-3-hijrah-madinah',
    order: 3,
    title: 'الجزء الثالث: الهجرة النبوية وتأسيس مجتمع المدينة',
    subtitle: 'بيعتا العقبة، رحلة الهجرة، وبناء المسجد والمؤاخاة ووثيقة المدينة',
    periodLabel: 'أواخر العهد المكي وأول العهد المدني (13 بعثة – 1هـ)',
    summary: 'يروي هذا الجزء كيف فتح الله قلوب الأنصار للإسلام في العقبة، ثم رحلة الهجرة المباركة، والأركان الثلاثة التي أقام عليها النبي ﷺ مجتمع المدينة.',
    chapterIds: ['ch-7-aqabah-pledges', 'ch-8-hijrah-journey', 'ch-9-madinah-foundation']
  },
  {
    id: 'part-4-campaigns-peace-fath',
    order: 4,
    title: 'الجزء الرابع: سنوات التدافع والصلح والفتح الأعظم',
    subtitle: 'من يوم الفرقان ببدر وأُحد والخندق إلى صلح الحديبية وفتح مكة',
    periodLabel: 'العهد المدني (2هـ – 9هـ)',
    summary: 'يتناول هذا الجزء الوقائع الفاصلة التي حمت جماعة المسلمين، والحكمة النبوية في صلح الحديبية ومكاتبة الملوك، ثم الفتح الأعظم لمكة ودخول الناس في دين الله أفواجاً.',
    chapterIds: ['ch-10-badr', 'ch-11-uhud-khandaq', 'ch-12-hudaybiyyah-letters', 'ch-13-fath-makkah']
  },
  {
    id: 'part-5-farewell-legacy',
    order: 5,
    title: 'الجزء الخامس: حجة الوداع، الرفيق الأعلى، والشمائل النبوية',
    subtitle: 'كمال الدين، وصايا الوداع، ثبات الصحابة، وهديه ﷺ الخالد',
    periodLabel: 'ختام العهد النبوي (10هـ – 11هـ) وإرثه الممتد',
    summary: 'يختم هذا الجزء رحلة السيرة بحجة الوداع وخطبتها الجامعة، ومرض النبي ﷺ والتحاقه بالرفيق الأعلى، ثم قبس من شمائله وأخلاقه التي بقيت نبراساً للأمة.',
    chapterIds: ['ch-14-farewell-pilgrimage', 'ch-15-passing-rafiq-ala', 'ch-16-shamail-legacy']
  }
];

export const SEERAH_CHAPTERS: SeerahChapter[] = [
  // PART 1
  {
    id: 'ch-1-arabia-makkah',
    partId: 'part-1-pre-mission',
    order: 1,
    title: 'الفصل الأول: مكة والجزيرة العربية قبل البعثة',
    subtitle: 'إرث البيت الحرام وحادثة الفيل والسياق الاجتماعي والديني',
    periodLabel: 'قبيل عام الفيل (نحو 570م)',
    datePrecision: 'approximate',
    intro: 'لفهم عظمة التحول الذي أحدثه الوحي، لا بد من تأمل حال مكة والجزيرة العربية قبل ميلاد النبي ﷺ، وكيف اجتمعت في مكة حرمة البيت الحرام وبقايا الحنيفية مع ما طرأ عليها من الشرك والعصبية القبلية.',
    contextNote: 'تقع مكة في وادٍ غير ذي زرع بالحجاز، لكنها كانت قلب الجزيرة الروحي والتجاري بفضل الكعبة المشرفة التي رفع قواعدها إبراهيم وإسماعيل عليهما السلام.',
    scenes: [
      {
        id: 'sc-1-1-kaaba-heritage',
        chapterId: 'ch-1-arabia-makkah',
        order: 1,
        title: 'المشهد الأول: البيت العتيق وحفظ الله له في عام الفيل',
        personIds: ['person-prophet'],
        placeIds: ['place-makkah'],
        bodyBlocks: [
          {
            id: 'blk-1-1-a',
            type: 'paragraph',
            text: 'كانت الكعبة المشرفة مثابةً للناس وأمناً منذ أن أذن إبراهيم عليه السلام في الناس بالحج، وتولت قريش سدانة البيت وسقاية الحاج ورفادته، فكان لها بذلك شرف ومكانة بين قبائل العرب.',
            claimIds: ['clm-makkah-sanctuary'],
            sourceIds: ['src-quran', 'src-ibn-hisham']
          },
          {
            id: 'blk-1-1-b',
            type: 'paragraph',
            text: 'ومع تقادم العهد دخلت عبادة الأصنام إلى الجزيرة، غير أن الله عز وجل أظهر تعظيم بيته الحرام قبيل مولد نبيه ﷺ حين قصد أبرهة الأشرم هدم الكعبة بجيشه وفيله، فأرسل الله عليهم طيراً أبابيل كماخلّده القرآن في سورة الفيل، فكانت تلك الآية إرهاصاً بقرب حدث عظيم يخرج من هذه البقعة المباركة.',
            claimIds: ['clm-makkah-sanctuary'],
            sourceIds: ['src-quran', 'src-ibn-hisham']
          }
        ]
      }
    ],
    closingNarrative: 'في هذا الجو الذي تطلعت فيه القلوب إلى نور يعيد للبيت الحرام توحيده الخالص، أشرقت مكة بمولد خاتم الأنبياء ﷺ.',
    lessons: [
      'حفظ الله عز وجل للبيت الحرام كان تهيئةً لبعثة خاتم المرسلين ﷺ من مكة.',
      'معرفة حال العالم قبل البعثة تُظهر مقدار النعمة العظمى التي امتن الله بها على البشرية بالقرآن.'
    ],
    peopleIds: ['person-prophet'],
    placeIds: ['place-makkah'],
    quizQuestions: [
      {
        id: 'qz-ch1-1',
        chapterId: 'ch-1-arabia-makkah',
        prompt: 'ما الحدث العظيم الذي وقع بمكة قبيل مولد النبي ﷺ وخلّده القرآن الكريم في سورة مستقلة؟',
        choices: ['حادثة أصحاب الفيل وحماية الله للكعبة', 'فتح مكة الأعظم', 'صلح الحديبية', 'هجرة الحبشة'],
        correctIndex: 0,
        explanation: 'حمى الله الكعبة المشرفة من جيش أبرهة وأصحاب الفيل، وكان ذلك في العام الذي وُلد فيه النبي ﷺ على المشهور عند أهل السير.',
        claimId: 'clm-makkah-sanctuary',
        sourceIds: ['src-quran', 'src-ibn-hisham']
      }
    ],
    previousChapterId: null,
    nextChapterId: 'ch-2-birth-upbringing'
  },
  {
    id: 'ch-2-birth-upbringing',
    partId: 'part-1-pre-mission',
    order: 2,
    title: 'الفصل الثاني: المولد الشريف والنشأة في كنف الرعاية الإلهية',
    subtitle: 'ميلاده ﷺ يوم الإثنين، رضاعته في بني سعد، وكفالة الجد والعم',
    periodLabel: 'عام الفيل – السنة الثامنة من عمره ﷺ',
    datePrecision: 'disputed',
    intro: 'وُلد محمد بن عبد الله بن عبد المطلب ﷺ يتيماً في أشرف بيوت قريش نسباً، فحوطته عناية الله منذ لحظاته الأولى: ﴿أَلَمْ يَجِدْكَ يَتِيمًا فَآوَىٰ﴾.',
    contextNote: 'توفي والده عبد الله بن عبد المطلب بالمدينة وهو عائد من تجارة الشام قبل مولده ﷺ على الصحيح المشهور عند جمهور أهل السير.',
    scenes: [
      {
        id: 'sc-2-1-birth-halimah',
        chapterId: 'ch-2-birth-upbringing',
        order: 1,
        title: 'المشهد الأول: المولد يوم الإثنين والرضاعة في بادية بني سعد',
        personIds: ['person-prophet'],
        placeIds: ['place-makkah'],
        bodyBlocks: [
          {
            id: 'blk-2-1-a',
            type: 'paragraph',
            text: 'وُلد النبي ﷺ بمكة يوم الإثنين في شهر ربيع الأول من عام الفيل، كما ثبت في صحيح مسلم أنه ﷺ سُئل عن صوم يوم الإثنين فقال: «ذاك يومٌ وُلدتُ فيه، ويومٌ بُعثتُ أو أُنزل عليَّ فيه».',
            claimIds: ['clm-birth-monday-elephant'],
            sourceIds: ['src-muslim', 'src-ibn-hisham']
          },
          {
            id: 'blk-2-1-b',
            type: 'uncertainty_note',
            text: 'ضبط التاريخ واختلاف الروايات: اتفق العلماء على ثبوت ولادته ﷺ يوم الإثنين، وجمهورهم على أنه في شهر ربيع الأول عام الفيل، واختلفوا في تعيين رقم اليوم من الشهر بين الثامن والتاسع والثاني عشر؛ لذا يُجزم بيوم الإثنين ويُذكر رقم اليوم بصيغة المشهور لا القطع.',
            claimIds: ['clm-birth-monday-elephant'],
            sourceIds: ['src-muslim', 'src-zad-almaad']
          },
          {
            id: 'blk-2-1-c',
            type: 'paragraph',
            text: 'ودُفع ﷺ إلى حليمة السعدية في بادية بني سعد، فرأت في ديارها البركة والخير منذ قدومه، ونشأ في هواء البادية الصافي ولسانها العربي الفصيح، ثم توفيت أمه آمنة بنت وهب وهو ابن ست سنين بالأبواء، فكفله جده عبد المطلب بعطف بالغ حتى توفي وله ثماني سنين، فانتقلت كفالته إلى عمه أبي طالب.',
            claimIds: ['clm-upbringing-kafalah'],
            sourceIds: ['src-quran', 'src-ibn-hisham', 'src-zad-almaad']
          }
        ]
      }
    ],
    closingNarrative: 'هكذا تدرج ﷺ في اليتم والكفالة ليكون قلبه أرحم القلوب باليتامى والضعفاء، وليعلم الناس أن تربيته وحفظه كانا بعين الله ورعايته.',
    lessons: [
      'الأمانة العلمية تقتضي التفريق بين ما ثبت في الصحيح (ولادته يوم الإثنين) وما كان محل اجتهاد تاريخي (رقم اليوم من الشهر).',
      'نشأة النبي ﷺ يتيماً أورثته رحمةً عظيمةً باليتامى والمستضعفين.'
    ],
    peopleIds: ['person-prophet'],
    placeIds: ['place-makkah'],
    quizQuestions: [
      {
        id: 'qz-ch2-1',
        chapterId: 'ch-2-birth-upbringing',
        prompt: 'ما اليوم الذي ثبت في صحيح مسلم من حديث النبي ﷺ أنه وُلد فيه وبُعث فيه؟',
        choices: ['يوم الإثنين', 'يوم الجمعة', 'يوم الخميس', 'يوم السبت'],
        correctIndex: 0,
        explanation: 'ثبت في صحيح مسلم قول النبي ﷺ عندما سُئل عن صوم يوم الإثنين: «ذاك يومٌ وُلدتُ فيه، ويومٌ بُعثتُ أو أُنزل عليَّ فيه».',
        claimId: 'clm-birth-monday-elephant',
        sourceIds: ['src-muslim']
      }
    ],
    previousChapterId: 'ch-1-arabia-makkah',
    nextChapterId: 'ch-3-youth-trustworthy'
  },
  {
    id: 'ch-3-youth-trustworthy',
    partId: 'part-1-pre-mission',
    order: 3,
    title: 'الفصل الثالث: شباب الصادق الأمين وحلف الفضول وبناء الكعبة',
    subtitle: 'السيرة العطرة قبل النبوة، الزواج بخديجة رضي الله عنها، وتحكيمه في الحجر الأسود',
    periodLabel: 'من سن العشرين إلى الخامسة والثلاثين (قبل البعثة)',
    datePrecision: 'approximate',
    intro: 'شبّ النبي ﷺ محفوظاً من أقذار الجاهلية وأوثانها، عاملاً بيده في رعي الغنم ثم التجارة بأمانة بهرت قريشاً حتى لقّبوه «الصادق الأمين».',
    contextNote: 'كانت هذه السنوات الأربعون قبل الوحي أكبر برهان لأهل مكة على صدقه ﷺ؛ إذ عاش بينهم عمراً كاملاً لم يجرّبوا عليه كذبةً ولا خيانةً قط.',
    scenes: [
      {
        id: 'sc-3-1-amin-khadijah',
        chapterId: 'ch-3-youth-trustworthy',
        order: 1,
        title: 'المشهد الأول: حلف الفضول، الزواج بخديجة، والحكم في الحجر الأسود',
        personIds: ['person-prophet', 'person-khadijah'],
        placeIds: ['place-makkah'],
        bodyBlocks: [
          {
            id: 'blk-3-1-a',
            type: 'paragraph',
            text: 'شهد النبي ﷺ في شبابه «حلف الفضول» في دار عبد الله بن جدعان، حيث تعاهدت بطون من قريش على نصرة المظلوم بمكة حتى تُرد إليه مظلمته، فكان ﷺ يذكر هذا الحلف بعد النبوة بالثناء.',
            claimIds: ['clm-youth-khadijah-kaaba'],
            sourceIds: ['src-ibn-hisham', 'src-zad-almaad']
          },
          {
            id: 'blk-3-1-b',
            type: 'paragraph',
            text: 'وخرج ﷺ في تجارة لخديجة بنت خويلد رضي الله عنها مع غلامها ميسرة، فلما رأت من عظيم أمانته وبركته وسمو خُلقه رغبت في الزواج منه، فكانت نعم الزوجة والمؤازرة. ولما أعادت قريش بناء الكعبة وهو في الخامسة والثلاثين وكادوا يقتتلون على من يضع الحجر الأسود، رضوا بحكم أول داخل فكان هو ﷺ، فبسط رداءه ووضع الحجر بيده ودعا رؤساء القبائل ليرفعوه جميعاً، ثم وضعه بيده الشريفة في موضعه.',
            claimIds: ['clm-youth-khadijah-kaaba'],
            sourceIds: ['src-ibn-hisham', 'src-zad-almaad']
          }
        ]
      }
    ],
    closingNarrative: 'بهذه المكانة الأخلاقية الراسخة والحكمة البالغة، اقترب النبي ﷺ من سن الأربعين، وحُبِّب إليه الخلاء والتأمل في غار حراء.',
    lessons: [
      'الصدق والأمانة وحسن الخلق هي الأساس الذي يسبق حمل الرسالات الكبرى.',
      'الحكمة في جمع الكلمة وإطفاء الفتنة من أبرز معالم شخصيته ﷺ حتى قبل البعثة.'
    ],
    peopleIds: ['person-prophet', 'person-khadijah'],
    placeIds: ['place-makkah'],
    quizQuestions: [
      {
        id: 'qz-ch3-1',
        chapterId: 'ch-3-youth-trustworthy',
        prompt: 'كيف حسم النبي ﷺ النزاع بين قبائل قريش عند إعادة بناء الكعبة ووضع الحجر الأسود؟',
        choices: [
          'وضع الحجر في ثوبه وأشرك زعماء القبائل في رفعه ثم وضعه بيده الشريفة',
          'أجل وضع الحجر إلى العام التالي',
          'خصّ قبيلة واحدة برفعه دون سائر القبائل',
          'ترك الأمر للقرعة بين القبائل'
        ],
        correctIndex: 0,
        explanation: 'أشرك ﷺ جميع القبائل في حمل الثوب الذي وضع فيه الحجر الأسود، ثم وضعه بيده في مكانه، فرضيت النفوس وحُقنت الدماء.',
        claimId: 'clm-youth-khadijah-kaaba',
        sourceIds: ['src-ibn-hisham', 'src-zad-almaad']
      }
    ],
    previousChapterId: 'ch-2-birth-upbringing',
    nextChapterId: 'ch-4-revelation-hira'
  },

  // PART 2
  {
    id: 'ch-4-revelation-hira',
    partId: 'part-2-makkan-era',
    order: 4,
    title: 'الفصل الرابع: غار حراء ونزول الوحي وبدايات الدعوة',
    subtitle: 'لحظة اتصال السماء بالأرض: ﴿اقْرَأْ بِاسْمِ رَبِّكَ الَّذِي خَلَقَ﴾ وتثبيت خديجة رضي الله عنها',
    periodLabel: 'السنة الأولى من البعثة (رمضان، سن الأربعين)',
    datePrecision: 'exact',
    intro: 'في ليلة مباركة من شهر رمضان في غار حراء، تغير مجرى تاريخ الإنسانية بنزول جبريل عليه السلام بأول آيات القرآن الكريم على قلب محمد ﷺ.',
    contextNote: 'روى البخاري ومسلم عن عائشة أم المؤمنين رضي الله عنها تفاصيل بدء الوحي كما كان يبدأ بالرؤيا الصالحة ثم التحنث في غار حراء.',
    scenes: [
      {
        id: 'sc-4-1-hira-khadijah',
        chapterId: 'ch-4-revelation-hira',
        order: 1,
        title: 'المشهد الأول: نزول جبريل في غار حراء وموقف أم المؤمنين خديجة',
        personIds: ['person-prophet', 'person-khadijah', 'person-abu-bakr', 'person-aisha'],
        placeIds: ['place-hira', 'place-makkah'],
        bodyBlocks: [
          {
            id: 'blk-4-1-a',
            type: 'paragraph',
            text: 'جاء الملك إلى النبي ﷺ في غار حراء فقال: «اقرأ»، قال: «ما أنا بقارئ»، فغطّه ثلاث مرات ثم تلا عليه: ﴿اقْرَأْ بِاسْمِ رَبِّكَ الَّذِي خَلَقَ * خَلَقَ الْإِنسَانَ مِنْ عَلَقٍ * اقْرَأْ وَرَبُّكَ الْأَكْرَمُ﴾. فرجع بها رسول الله ﷺ يرجف فؤاده إلى خديجة بنت خويلد رضي الله عنها فقال: «زمّلوني زمّلوني».',
            claimIds: ['clm-revelation-iqra'],
            sourceIds: ['src-quran', 'src-bukhari', 'src-muslim']
          },
          {
            id: 'blk-4-1-b',
            type: 'quote_verified',
            text: 'قالت خديجة رضي الله عنها: «كَلَّا وَاللَّهِ مَا يُخْزِيكَ اللَّهُ أَبَدًا؛ إِنَّكَ لَتَصِلُ الرَّحِمَ، وَتَحْمِلُ الْكَلَّ، وَتَكْسِبُ الْمَعْدُومَ، وَتَقْرِي الضَّيْفَ، وَتُعِينُ عَلَى نَوَائِبِ الْحَقِّ».',
            claimIds: ['clm-revelation-iqra'],
            sourceIds: ['src-bukhari', 'src-muslim']
          },
          {
            id: 'blk-4-1-c',
            type: 'paragraph',
            text: 'ثم نزل قوله تعالى: ﴿يَا أَيُّهَا الْمُدَّثِّرُ * قُمْ فَأَنذِرْ﴾، فبدأت الدعوة الفردية، فآمنت خديجة، وعلي بن أبي طالب، وزيد بن حارثة، وأبو بكر الصديق رضي الله عنهم، واجتمع السابقون الأولون في دار الأرقم بن أبي الأرقم يتدارسون القرآن ويتزكون به.',
            claimIds: ['clm-revelation-iqra'],
            sourceIds: ['src-quran', 'src-bukhari', 'src-ibn-hisham']
          }
        ]
      }
    ],
    closingNarrative: 'تكونت في السنوات الثلاث الأولى نواة صلبة من المؤمنين الذين ربط القرآن قلوبهم بالله، تمهيداً للصدع العلني بالدعوة.',
    lessons: [
      'أول كلمة نزلت من القرآن هي «اقرأ» مقترنةً باسم الرب الخالق، فالعلم والوحي أصل الرسالة.',
      'صنائع المعروف وصلة الرحم وإعانة الضعيف من أعظم أسباب التثبيت عند الشدائد كما استدلت خديجة رضي الله عنها.'
    ],
    peopleIds: ['person-prophet', 'person-khadijah', 'person-abu-bakr', 'person-aisha'],
    placeIds: ['place-hira', 'place-makkah'],
    quizQuestions: [
      {
        id: 'qz-ch4-1',
        chapterId: 'ch-4-revelation-hira',
        prompt: 'بماذا استدلت أم المؤمنين خديجة رضي الله عنها لتثبيت النبي ﷺ عند رجوعه من غار حراء؟',
        choices: [
          'بأخلاقه الكريمة من صلة الرحم وحمل الكلّ وإقراء الضيف وإعانة نوائب الحق',
          'بكثرة ماله وتجارته في قريش',
          'بمنعة قبيلته وسلاحها',
          'ببعده عن الناس واعتزاله للمجتمع'
        ],
        correctIndex: 0,
        explanation: 'استدلت رضي الله عنها بسنّة الله أن من كان واصلاً للرحم معيناً للضعفاء لا يخزيه الله أبداً (متفق عليه).',
        claimId: 'clm-revelation-iqra',
        sourceIds: ['src-bukhari', 'src-muslim']
      }
    ],
    previousChapterId: 'ch-3-youth-trustworthy',
    nextChapterId: 'ch-5-public-call-abyssinia'
  },
  {
    id: 'ch-5-public-call-abyssinia',
    partId: 'part-2-makkan-era',
    order: 5,
    title: 'الفصل الخامس: الجهر بالدعوة والصبر على الابتلاء والهجرة إلى الحبشة',
    subtitle: 'النداء على جبل الصفا، ثبات المستضعفين، واللجوء إلى أرض النجاشي العادل',
    periodLabel: 'السنة الرابعة – السادسة من البعثة',
    datePrecision: 'approximate',
    intro: 'لما نزل قوله تعالى: ﴿وَأَنذِرْ عَشِيرَتَكَ الْأَقْرَبِينَ﴾ وقوله: ﴿فَاصْدَعْ بِمَا تُؤْمَرُ﴾، انتقلت الدعوة إلى الإعلان الصريح بالتوحيد في قلب مكة.',
    contextNote: 'واجهت قريش الدعوة بالتكذيب والإيذاء البدني والنفسي، خاصة لمن لا عشيرة تحميه بمكة.',
    scenes: [
      {
        id: 'sc-5-1-safa-abyssinia',
        chapterId: 'ch-5-public-call-abyssinia',
        order: 1,
        title: 'المشهد الأول: الصدع بالحق على الصفا والهجرة إلى الحبشة',
        personIds: ['person-prophet'],
        placeIds: ['place-makkah'],
        bodyBlocks: [
          {
            id: 'blk-5-1-a',
            type: 'paragraph',
            text: 'صعد النبي ﷺ على الصفا فنادى بطون قريش، وقال لهم: «أرأيتم لو أخبرتكم أن خيلاً بالوادي تريد أن تغير عليكم أكنتم مصدقي؟» قالوا: نعم، ما جربنا عليك إلا صدقاً. قال: «فإني نذير لكم بين يدي عذاب شديد».',
            claimIds: ['clm-public-call-abyssinia'],
            sourceIds: ['src-bukhari', 'src-muslim']
          },
          {
            id: 'blk-5-1-b',
            type: 'paragraph',
            text: 'ولما اشتد البلاء على المؤمنين بمكة، أرشدهم النبي ﷺ إلى الهجرة إلى أرض الحبشة؛ فإن بها ملكاً لا يُظلم عنده أحد، فكانت الهجرة الأولى ثم الثانية إلى الحبشة حفظاً لدينهم ونشراً لكلمة التوحيد.',
            claimIds: ['clm-public-call-abyssinia'],
            sourceIds: ['src-bukhari', 'src-ibn-hisham']
          }
        ]
      }
    ],
    closingNarrative: 'ورغم كل محاولات قريش لرد مهاجري الحبشة وكسر شوكة المسلمين بمكة، ظل القرآن يفتح القلوب حتى أسلم حمزة بن عبد المطلب وعمر بن الخطاب رضي الله عنهما.',
    lessons: [
      'البحث عن بيئة آمنة لإقامة الدين مشروع عند اشتداد الفتنة والاضطهاد.',
      'عدل الحاكم يُحفظ ويُذكر بالخير كما أثنى النبي ﷺ على عدل النجاشي.'
    ],
    peopleIds: ['person-prophet'],
    placeIds: ['place-makkah'],
    quizQuestions: [
      {
        id: 'qz-ch5-1',
        chapterId: 'ch-5-public-call-abyssinia',
        prompt: 'لماذا اختار النبي ﷺ أرض الحبشة لهجرة أصحابه الأوائل من مكة؟',
        choices: [
          'لأن بها ملكاً عادلاً (النجاشي) لا يُظلم عنده أحد',
          'لقربها الشديد من المدينة النبوية',
          'لوجود حلف عسكري بينها وبين قريش',
          'لكثرة قبائل العرب المقيمة فيها آنذاك'
        ],
        correctIndex: 0,
        explanation: 'أرشدهم ﷺ إلى الحبشة لما عُرف به النجاشي من العدل وحماية المظلومين.',
        claimId: 'clm-public-call-abyssinia',
        sourceIds: ['src-ibn-hisham']
      }
    ],
    previousChapterId: 'ch-4-revelation-hira',
    nextChapterId: 'ch-6-sorrow-taif-isra'
  },
  {
    id: 'ch-6-sorrow-taif-isra',
    partId: 'part-2-makkan-era',
    order: 6,
    title: 'الفصل السادس: عام الحزن، رحلة الطائف، ومعجزة الإسراء والمعراج',
    subtitle: 'من أشد ساعات الضيق الأرضي إلى أوسع آفاق التكريم السماوي وفرض الصلاة',
    periodLabel: 'السنة العاشرة – الحادية عشرة من البعثة',
    datePrecision: 'approximate',
    intro: 'بعد نقض صحيفة المقاطعة في شعب أبي طالب، فُجع النبي ﷺ بوفاة عمه أبي طالب الذي كان يحوطه، ووفاة زوجه أم المؤمنين خديجة رضي الله عنها التي كانت سكنه ووزيره.',
    contextNote: 'عندما أُغلقت أبواب مكة توجه ﷺ إلى الطائف التماساً للنصرة، ثم جاءت التسلية الإلهية الكبرى بالإسراء والمعراج.',
    scenes: [
      {
        id: 'sc-6-1-taif-isra',
        chapterId: 'ch-6-sorrow-taif-isra',
        order: 1,
        title: 'المشهد الأول: الصبر في الطائف وتكريم الإسراء والمعراج',
        personIds: ['person-prophet', 'person-khadijah'],
        placeIds: ['place-makkah'],
        bodyBlocks: [
          {
            id: 'blk-6-1-a',
            type: 'paragraph',
            text: 'خرج النبي ﷺ إلى الطائف يدعو ثقيفاً فلم يجيبوه وآذوه، ولما جاءه ملك الجبال يستأذنه أن يطبق عليهم الأخشبين قال ﷺ برحمته البالغة: «بل أرجو أن يخرج الله من أصلابهم من يعبد الله وحده لا يشرك به شيئاً».',
            claimIds: ['clm-sorrow-taif-isra'],
            sourceIds: ['src-bukhari', 'src-muslim']
          },
          {
            id: 'blk-6-1-b',
            type: 'paragraph',
            text: 'عقب تلك المحنة أكرم الله نبيه ﷺ بمعجزة الإسراء من المسجد الحرام إلى المسجد الأقصى حيث أمّ الأنبياء، ثم عُرج به إلى السماوات العلى، وفُرضت هناك الصلوات الخمس لتكون معراج المؤمن وصلته الدائمة بربه: ﴿سُبْحَانَ الَّذِي أَسْرَىٰ بِعَبْدِهِ لَيْلًا مِّنَ الْمَسْجِدِ الْحَرَامِ إِلَى الْمَسْجِدِ الْأَقْصَى﴾.',
            claimIds: ['clm-sorrow-taif-isra'],
            sourceIds: ['src-quran', 'src-bukhari', 'src-muslim']
          },
          {
            id: 'blk-6-1-c',
            type: 'uncertainty_note',
            text: 'ضبط تاريخ الإسراء والمعراج: الواقعة ثابتة بالقرآن والأحاديث الصحيحة المتواترة قبل الهجرة، أما تحديد ليلة بعينها (مثل 27 رجب) فلم يثبت فيه حديث صحيح، واختلف المؤرخون في شهرها وسنتها.',
            claimIds: ['clm-sorrow-taif-isra'],
            sourceIds: ['src-zad-almaad']
          }
        ]
      }
    ],
    closingNarrative: 'وهكذا بعد أن ضاقت مكة والطائف، بدأ النبي ﷺ يعرض نفسه على القبائل في مواسم الحج، حتى قيّض الله له رجالاً من الأنصار من أهل يثرب.',
    lessons: [
      'رحمة النبي ﷺ بقومه وتفاؤله بإيمان ذرياتهم رغم شدة الأذى يوم الطائف.',
      'فرض الصلاة في السماء ليلة المعراج يدل على عظيم منزلتها في الإسلام.'
    ],
    peopleIds: ['person-prophet', 'person-khadijah'],
    placeIds: ['place-makkah'],
    quizQuestions: [
      {
        id: 'qz-ch6-1',
        chapterId: 'ch-6-sorrow-taif-isra',
        prompt: 'ما العبادة العظيمة التي فُرضت على الأمة ليلة المعراج في السماء؟',
        choices: ['الصلوات الخمس', 'صوم رمضان', 'زكاة الأموال', 'حج البيت'],
        correctIndex: 0,
        explanation: 'فُرضت الصلوات الخمس مباشرة في السماء ليلة المعراج كما ثبت في الصحيحين.',
        claimId: 'clm-sorrow-taif-isra',
        sourceIds: ['src-bukhari', 'src-muslim']
      }
    ],
    previousChapterId: 'ch-5-public-call-abyssinia',
    nextChapterId: 'ch-7-aqabah-pledges'
  },

  // PART 3
  {
    id: 'ch-7-aqabah-pledges',
    partId: 'part-3-hijrah-madinah',
    order: 7,
    title: 'الفصل السابع: بيعتا العقبة وسفارة مصعب بن عمير',
    subtitle: 'إسلام طلائع الأنصار وتهيئة المدينة النبوية بالقرآن قبل الهجرة',
    periodLabel: 'السنة 11 – 13 من البعثة (مواسم الحج بمنى)',
    datePrecision: 'exact',
    intro: 'كان دأب النبي ﷺ في مواسم الحج أن يعرض الإسلام على وفود القبائل، حتى لقي نفراً من الخزرج من أهل يثرب عند العقبة بمنى، فشرح الله صدورهم للإيمان.',
    contextNote: 'مهّد القرآن الكريم الطريق إلى المدينة قبل أن يهاجر إليها النبي ﷺ، بفضل بعثة مصعب بن عمير رضي الله عنه معلماً ومقرئاً.',
    scenes: [
      {
        id: 'sc-7-1-aqabah-musab',
        chapterId: 'ch-7-aqabah-pledges',
        order: 1,
        title: 'المشهد الأول: بيعة العقبة الأولى والثانية وانتشار القرآن في يثرب',
        personIds: ['person-prophet', 'person-musab'],
        placeIds: ['place-makkah', 'place-madinah'],
        bodyBlocks: [
          {
            id: 'blk-7-1-a',
            type: 'paragraph',
            text: 'في العام الثاني عشر من البعثة بايع اثنا عشر رجلاً من الأنصار النبي ﷺ بيعة العقبة الأولى على التوحيد ومكارم الأخلاق، وبعث معهم مصعب بن عمير رضي الله عنه يقرئهم القرآن ويفقههم في الدين، فما بقيت دار من دور الأنصار إلا وفيها مسلمون.',
            claimIds: ['clm-aqabah-pledges'],
            sourceIds: ['src-bukhari', 'src-ibn-hisham']
          },
          {
            id: 'blk-7-1-b',
            type: 'paragraph',
            text: 'وفي موسم الحج التالي (السنة 13 من البعثة) قدم ثلاثة وسبعون رجلاً وامرأتان من الأنصار، فبايعوا النبي ﷺ بيعة العقبة الثانية في جوف الليل على أن يمنعوه مما يمنعون منه نساءهم وأبناءهم، وبشّرهم بالجنة، فكانت تلك البيعة نقطة التحول نحو الهجرة.',
            claimIds: ['clm-aqabah-pledges'],
            sourceIds: ['src-bukhari', 'src-ibn-hisham']
          }
        ]
      }
    ],
    closingNarrative: 'بعد بيعة العقبة الثانية أذن النبي ﷺ لأصحابه بالهجرة إلى المدينة، فخرجوا أرسالاً يتركون ديارهم وأموالهم ابتغاء مرضاة الله.',
    lessons: [
      'فتحت المدينة بالقرآن والعلم على يد مصعب بن عمير رضي الله عنه قبل أن تُفتح بالسيف.',
      'صدق بيعة الأنصار وتضحيتهم في نصرة رسول الله ﷺ.'
    ],
    peopleIds: ['person-prophet', 'person-musab'],
    placeIds: ['place-makkah', 'place-madinah'],
    quizQuestions: [
      {
        id: 'qz-ch7-1',
        chapterId: 'ch-7-aqabah-pledges',
        prompt: 'من الصحابي الذي بعثه النبي ﷺ بعد بيعة العقبة الأولى ليقرئ أهل المدينة القرآن ويعلمهم الإسلام؟',
        choices: ['مصعب بن عمير رضي الله عنه', 'سلمان الفارسي رضي الله عنه', 'خالد بن الوليد رضي الله عنه', 'أبو هريرة رضي الله عنه'],
        correctIndex: 0,
        explanation: 'بعث النبي ﷺ مصعب بن عمير رضي الله عنه فكان يُسمى «المقرئ» بالمدينة، وأسلم على يديه سادات الأنصار.',
        claimId: 'clm-aqabah-pledges',
        sourceIds: ['src-ibn-hisham']
      }
    ],
    previousChapterId: 'ch-6-sorrow-taif-isra',
    nextChapterId: 'ch-8-hijrah-journey'
  },
  {
    id: 'ch-8-hijrah-journey',
    partId: 'part-3-hijrah-madinah',
    order: 8,
    title: 'الفصل الثامن: الهجرة النبوية الشريفة من مكة إلى المدينة',
    subtitle: 'التخطيط المحكم، التوكل في غار ثور، وإشراق المدينة بمقدمه ﷺ',
    periodLabel: 'صفر – ربيع الأول، السنة الأولى للهجرة (622م)',
    datePrecision: 'exact',
    intro: 'جمع النبي ﷺ في رحلة الهجرة بين الأخذ بأقصى الأسباب البشرية المتاحة والتوكل المطلق على الله عز وجل: ﴿إِذْ هُمَا فِي الْغَارِ إِذْ يَقُولُ لِصَاحِبِهِ لَا تَحْزَنْ إِنَّ اللَّهَ مَعَنَا﴾.',
    contextNote: 'تآمر الملأ من قريش على قتل النبي ﷺ، فأخبره الوحي بمكرهم، واستبقى علياً رضي الله عنه ليرد الودائع إلى أهلها بمكة.',
    scenes: [
      {
        id: 'sc-8-1-thawr-quba',
        chapterId: 'ch-8-hijrah-journey',
        order: 1,
        title: 'المشهد الأول: غار ثور، الطريق الساحلي، والوصول إلى قباء فالمدينة',
        personIds: ['person-prophet', 'person-abu-bakr'],
        placeIds: ['place-makkah', 'place-thawr', 'place-madinah'],
        bodyBlocks: [
          {
            id: 'blk-8-1-a',
            type: 'paragraph',
            text: 'خرج النبي ﷺ مع صاحبه أبي بكر الصديق رضي الله عنه جنوباً نحو غار ثور خلافاً للطريق المعتاد شمالاً، ومكثا فيه ثلاث ليالٍ، يأتيهما عبد الله بن أبي بكر بأخبار قريش، وعامر بن فهيرة يرعى الغنم ليخفي الآثار.',
            claimIds: ['clm-hijrah-journey'],
            sourceIds: ['src-quran', 'src-bukhari']
          },
          {
            id: 'blk-8-1-b',
            type: 'quote_verified',
            text: 'قال أبو بكر رضي الله عنه: قلتُ للنبي ﷺ وأنا في الغار: لو أن أحدهم نظر تحت قدميه لأبصرنا! فقال: «ما ظنك يا أبا بكر باثنين الله ثالثهما».',
            claimIds: ['clm-hijrah-journey'],
            sourceIds: ['src-bukhari', 'src-muslim']
          },
          {
            id: 'blk-8-1-c',
            type: 'paragraph',
            text: 'ثم سلكا طريق الساحل مع الدليل عبد الله بن أريقط حتى وصلا إلى قباء في شهر ربيع الأول فأسس ﷺ مسجد قباء، ثم دخل المدينة النبوية واستقبله المهاجرون والأنصار بفرح لم تشهد المدينة مثله قط.',
            claimIds: ['clm-hijrah-journey'],
            sourceIds: ['src-bukhari']
          }
        ]
      }
    ],
    closingNarrative: 'بوصوله ﷺ إلى المدينة بدأ التاريخ الهجري للأمة الإسلامية، وانتقلت الدعوة إلى طور بناء المجتمع والدولة.',
    lessons: [
      'التوكل الحقيقي يجمع بين إتقان التخطيط والأخذ بالأسباب وبين يقين القلب بأن الله مع المؤمنين.',
      'أداء الأمانات حتى للخصوم كما استخلف ﷺ علياً لرد ودائع أهل مكة.'
    ],
    peopleIds: ['person-prophet', 'person-abu-bakr'],
    placeIds: ['place-makkah', 'place-thawr', 'place-madinah'],
    quizQuestions: [
      {
        id: 'qz-ch8-1',
        chapterId: 'ch-8-hijrah-journey',
        prompt: 'كم ليلة مكث النبي ﷺ وصاحبه أبو بكر الصديق رضي الله عنه في غار ثور حتى هدأ طلب قريش؟',
        choices: ['ثلاث ليالٍ', 'ليلة واحدة', 'سبع ليالٍ', 'عشر ليالٍ'],
        correctIndex: 0,
        explanation: 'ثبت في صحيح البخاري أنهما كمنا في غار ثور ثلاث ليالٍ قبل الانطلاق في طريق الساحل إلى المدينة.',
        claimId: 'clm-hijrah-journey',
        sourceIds: ['src-bukhari']
      }
    ],
    previousChapterId: 'ch-7-aqabah-pledges',
    nextChapterId: 'ch-9-madinah-foundation'
  },
  {
    id: 'ch-9-madinah-foundation',
    partId: 'part-3-hijrah-madinah',
    order: 9,
    title: 'الفصل التاسع: بناء مجتمع المدينة: المسجد والمؤاخاة ووثيقة المدينة',
    subtitle: 'الأركان الثلاثة لتأسيس الأمة: العبادة والعلم، التكافل الاجتماعي، والنظام الدستوري',
    periodLabel: 'السنة الأولى للهجرة (1هـ)',
    datePrecision: 'exact',
    intro: 'فور استقراره ﷺ في المدينة، شرع في إرساء دعائم المجتمع الجديد على أسس متينة تربط القلوب بالله وتؤلف بين المؤمنين وتنظم العلاقة مع جميع سكان المدينة.',
    contextNote: 'كان المهاجرون قد تركوا ديارهم وأموالهم بمكة، وكانت المدينة تضم الأوس والخزرج وقبائل من اليهود.',
    scenes: [
      {
        id: 'sc-9-1-pillars-madinah',
        chapterId: 'ch-9-madinah-foundation',
        order: 1,
        title: 'المشهد الأول: بناء المسجد النبوي، المؤاخاة، وكتابة الصحيفة',
        personIds: ['person-prophet'],
        placeIds: ['place-madinah'],
        bodyBlocks: [
          {
            id: 'blk-9-1-a',
            type: 'paragraph',
            text: 'كان أول عمل قام به النبي ﷺ بناء المسجد النبوي في الموضع الذي بركت فيه ناقته بعد شراء الأرض من غلامين يتيمين، وشارك ﷺ بيده الشريفة في حمل اللبن مع أصحابه، فكان المسجد موضع الصلاة ومدرسة القرآن ومأوى أهل الصفة ومركز الشورى.',
            claimIds: ['clm-madinah-foundation'],
            sourceIds: ['src-bukhari']
          },
          {
            id: 'blk-9-1-b',
            type: 'paragraph',
            text: 'ثم آخى ﷺ بين المهاجرين والأنصار مؤاخاةً عمليةً تجلت فيها أروع صور الإيثار والعفة، كما في مؤاخاة عبد الرحمن بن عوف وسعد بن الربيع رضي الله عنهما. وكتب ﷺ «صحيفة المدينة» التي أعلنت أن المؤمنين أمة واحدة من دون الناس، وحددت حقوق الجوار والمواطنة والدفاع المشترك عن المدينة.',
            claimIds: ['clm-madinah-foundation'],
            sourceIds: ['src-bukhari', 'src-ibn-hisham', 'src-zad-almaad']
          }
        ]
      }
    ],
    closingNarrative: 'بهذه الدعائم الثلاث تحولت يثرب إلى «المدينة النبوية»، مجتمعاً متماسكاً مستعداً لمواجهة التحديات الكبرى.',
    lessons: [
      'المسجد في الإسلام هو القلب النابض للعبادة والتعلم وبناء الإنسان.',
      'الأخوة الإيمانية الصادقة تقوم على الإيثار من جانب والعفة والعمل من جانب آخر.'
    ],
    peopleIds: ['person-prophet'],
    placeIds: ['place-madinah'],
    quizQuestions: [
      {
        id: 'qz-ch9-1',
        chapterId: 'ch-9-madinah-foundation',
        prompt: 'ما الركائز الثلاث الأولى التي أقام عليها النبي ﷺ مجتمع المدينة النبوية؟',
        choices: [
          'بناء المسجد النبوي، والمؤاخاة بين المهاجرين والأنصار، وكتابة وثيقة المدينة',
          'بناء الحصون العسكرية فقط حول المدينة',
          'إلغاء التجارة والاعتماد على الزراعة وحدها',
          'تأجيل بناء المسجد إلى ما بعد فتح مكة'
        ],
        correctIndex: 0,
        explanation: 'أسس ﷺ المجتمع المدني على بناء المسجد، والمؤاخاة الإيمانية، ووثيقة (صحيفة) المدينة المنظمة للحقوق والواجبات.',
        claimId: 'clm-madinah-foundation',
        sourceIds: ['src-bukhari', 'src-ibn-hisham']
      }
    ],
    previousChapterId: 'ch-8-hijrah-journey',
    nextChapterId: 'ch-10-badr'
  },

  // PART 4
  {
    id: 'ch-10-badr',
    partId: 'part-4-campaigns-peace-fath',
    order: 10,
    title: 'الفصل العاشر: يوم الفرقان — غزوة بدر الكبرى',
    subtitle: 'الشورى، التضرع، ونصر الله للفئة المؤمنة في رمضان سنة 2هـ',
    periodLabel: '17 رمضان، السنة الثانية للهجرة (2هـ)',
    datePrecision: 'exact',
    intro: 'في السنة الثانية للهجرة أُذن للمسلمين في دفع العدوان واسترداد حقوقهم التي صودرت بمكة، فكانت موقعة بدر الكبرى التي فرق الله بها بين الحق والباطل.',
    contextNote: 'خرج المسلمون في بضعة عشر وثلاثمائة رجل لاعتراض عير قريش، فخرجت قريش في نحو ألف مقاتل بطراً ورئاء الناس.',
    scenes: [
      {
        id: 'sc-10-1-badr-victory',
        chapterId: 'ch-10-badr',
        order: 1,
        title: 'المشهد الأول: شورى المهاجرين والأنصار واستجابة الدعاء في بدر',
        personIds: ['person-prophet', 'person-abu-bakr'],
        placeIds: ['place-badr'],
        bodyBlocks: [
          {
            id: 'blk-10-1-a',
            type: 'paragraph',
            text: 'لما علم النبي ﷺ بنجاة القافلة وإصرار جيش قريش على القتال، استشار أصحابه، فتكلم المهاجرون فأحسنوا، ثم قال سعد بن معاذ عن الأنصار: «امضِ يا رسول الله لما أردت فوالذي بعثك بالحق لو استعرضت بنا هذا البحر فخضته لخضناه معك».',
            claimIds: ['clm-badr-furqan'],
            sourceIds: ['src-bukhari', 'src-muslim']
          },
          {
            id: 'blk-10-1-b',
            type: 'paragraph',
            text: 'وبات النبي ﷺ في العريش يناشد ربه ويدعوه بإلحاح، وأبو بكر الصديق خلفه، حتى أنزل الله السكينة والمدد بالملائكة: ﴿إِذْ تَسْتَغِيثُونَ رَبَّكُمْ فَاسْتَجَابَ لَكُمْ﴾، وانتصر المسلمون نصراً مؤزراً، وعاملوا الأسرى بالرفق وقبلوا من بعضهم تعليم أبناء المسلمين القراءة والكتابة فداءً لهم.',
            claimIds: ['clm-badr-furqan'],
            sourceIds: ['src-quran', 'src-bukhari', 'src-muslim']
          }
        ]
      }
    ],
    closingNarrative: 'رفعت غزوة بدر شأن الدولة الإسلامية في الجزيرة العربية، وأثبتت أن النصر من عند الله يؤتيه من يشاء بصبرهم وتقواهم.',
    lessons: [
      'الشورى منهج نبوي أصيل قبل القرارات المصيرية.',
      'الجمع بين إعداد القوة والتضرع الصادق إلى الله هو سبيل النصر.'
    ],
    peopleIds: ['person-prophet', 'person-abu-bakr'],
    placeIds: ['place-badr'],
    quizQuestions: [
      {
        id: 'qz-ch10-1',
        chapterId: 'ch-10-badr',
        prompt: 'بماذا سمّى القرآن الكريم يوم غزوة بدر الكبرى في سورة الأنفال؟',
        choices: ['يوم الفرقان', 'يوم الأحزاب', 'يوم الفتح', 'يوم حنين'],
        correctIndex: 0,
        explanation: 'سماه الله تعالى «يوم الفرقان يوم التقى الجمعان» لأن الله فرق فيه بين الحق والباطل.',
        claimId: 'clm-badr-furqan',
        sourceIds: ['src-quran', 'src-bukhari']
      }
    ],
    previousChapterId: 'ch-9-madinah-foundation',
    nextChapterId: 'ch-11-uhud-khandaq'
  },
  {
    id: 'ch-11-uhud-khandaq',
    partId: 'part-4-campaigns-peace-fath',
    order: 11,
    title: 'الفصل الحادي عشر: دروس أُحد وثبات الخندق (الأحزاب)',
    subtitle: 'خطورة مخالفة الأمر النبوي في أُحد، والابتكار الدفاعي في حصار الأحزاب',
    periodLabel: 'شوال 3هـ – شوال 5هـ',
    datePrecision: 'exact',
    intro: 'تتالت بعد بدر محطات تمحيص عظيمة، علّمت المسلمين في أُحد عاقبة التنازع ومخالفة أمر القائد، وأظهرت في الخندق ثبات الإيمان أمام تحالف القبائل.',
    contextNote: 'نزلت في غزوة أُحد آيات مستفيضة في سورة آل عمران، ونزلت في غزوة الخندق سورة الأحزاب.',
    scenes: [
      {
        id: 'sc-11-1-uhud-archers',
        chapterId: 'ch-11-uhud-khandaq',
        order: 1,
        title: 'المشهد الأول: جبل الرماة يوم أُحد وحفر الخندق يوم الأحزاب',
        personIds: ['person-prophet', 'person-musab', 'person-salman'],
        placeIds: ['place-madinah'],
        bodyBlocks: [
          {
            id: 'blk-11-1-a',
            type: 'paragraph',
            text: 'في غزوة أُحد سنة 3هـ أمر النبي ﷺ خمسين من الرماة بلزوم الجبل وعدم مغادرته إن رأوا النصر أو الهزيمة، فكان النصر للمسلمين أول النهار، حتى ترك أكثر الرماة مواقعهم ظناً أن المعركة انتهت، فالتفت خيل قريش من خلفهم وأصيب المسلمون بقرح شديد واستشهد سبعون من خيار الصحابة منهم حمزة ومصعب بن عمير رضي الله عنهما، وثبت النبي ﷺ ومن معه ثبات الجبال.',
            claimIds: ['clm-uhud-khandaq'],
            sourceIds: ['src-quran', 'src-bukhari', 'src-muslim']
          },
          {
            id: 'blk-11-1-b',
            type: 'paragraph',
            text: 'وفي سنة 5هـ تحزبت قريش وغطفان وغيرهم في عشرة آلاف مقاتل لاستئصال المدينة، فأشار سلمان الفارسي رضي الله عنه بحفر الخندق شمال المدينة، وحفر النبي ﷺ مع أصحابه في البرد والجوع وهو يبشرهم بفتح الشام وفارس واليمن، حتى أرسل الله على الأحزاب ريحاً وجنوداً لم يروها فردّهم بغيظهم لم ينالوا خيراً.',
            claimIds: ['clm-uhud-khandaq'],
            sourceIds: ['src-quran', 'src-bukhari', 'src-muslim']
          }
        ]
      }
    ],
    closingNarrative: 'قال النبي ﷺ بعد انصراف الأحزاب: «الآن نغزوهم ولا يغزوننا، نحن نسير إليهم»، فانتقلت المبادرة الاستراتيجية إلى الدولة الإسلامية.',
    lessons: [
      'طاعة أمر النبي ﷺ والانضباط الجماعي شرط لحفظ النصر.',
      'الانفتاح على الخبرات النافعة كما قبل النبي ﷺ مشورة سلمان الفارسي في حفر الخندق.'
    ],
    peopleIds: ['person-prophet', 'person-musab', 'person-salman'],
    placeIds: ['place-madinah'],
    quizQuestions: [
      {
        id: 'qz-ch11-1',
        chapterId: 'ch-11-uhud-khandaq',
        prompt: 'من الصحابي الذي أشار على النبي ﷺ بحفر الخندق لحماية المدينة يوم الأحزاب؟',
        choices: ['سلمان الفارسي رضي الله عنه', 'أبو ذر الغفاري رضي الله عنه', 'بلال بن رباح رضي الله عنه', 'زيد بن ثابت رضي الله عنه'],
        correctIndex: 0,
        explanation: 'أشار سلمان الفارسي رضي الله عنه بحفر الخندق شمال المدينة فكانت خطة دفاعية أوقفت زحف الأحزاب.',
        claimId: 'clm-uhud-khandaq',
        sourceIds: ['src-bukhari', 'src-ibn-hisham']
      }
    ],
    previousChapterId: 'ch-10-badr',
    nextChapterId: 'ch-12-hudaybiyyah-letters'
  },
  {
    id: 'ch-12-hudaybiyyah-letters',
    partId: 'part-4-campaigns-peace-fath',
    order: 12,
    title: 'الفصل الثاني عشر: صلح الحديبية وبيعة الرضوان ومكاتبة الملوك',
    subtitle: 'الصلح الذي سماه القرآن «فتحاً مبيناً» وانطلاق الدعوة العالمية',
    periodLabel: 'ذو القعدة 6هـ – 7هـ',
    datePrecision: 'exact',
    intro: 'في السنة السادسة للهجرة خرج النبي ﷺ في ألف وأربعمائة من أصحابه معتمراً لا يريد قتالاً، فصدته قريش عند الحديبية، فتمخض ذلك عن أعظم تحول سياسي ودعوي في السيرة.',
    contextNote: 'نزلت سورة الفتح عقب انصرافهم من الحديبية: ﴿إِنَّا فَتَحْنَا لَكَ فَتْحًا مُّبِينًا﴾.',
    scenes: [
      {
        id: 'sc-12-1-ridwan-treaty',
        chapterId: 'ch-12-hudaybiyyah-letters',
        order: 1,
        title: 'المشهد الأول: بيعة الرضوان تحت الشجرة وبنود صلح الحديبية',
        personIds: ['person-prophet'],
        placeIds: ['place-hudaybiyyah', 'place-makkah'],
        bodyBlocks: [
          {
            id: 'blk-12-1-a',
            type: 'paragraph',
            text: 'لما أرسل النبي ﷺ عثمان بن عفان رضي الله عنه إلى قريش ليخبرهم أنه إنما جاء معتمراً وشاع أنه قُتل، دعا النبي ﷺ أصحابه إلى البيعة تحت الشجرة على عدم الفرار، فبايعوه بيعة الرضوان التي أنزل الله فيها: ﴿لَّقَدْ رَضِيَ اللَّهُ عَنِ الْمُؤْمِنِينَ إِذْ يُبَايِعُونَكَ تَحْتَ الشَّجَرَةِ﴾.',
            claimIds: ['clm-hudaybiyyah-fath-mubin'],
            sourceIds: ['src-quran', 'src-bukhari', 'src-muslim']
          },
          {
            id: 'blk-12-1-b',
            type: 'paragraph',
            text: 'ثم عُقد صلح الحديبية على وضع الحرب عشر سنين وأن يرجع المسلمون عامهم ذلك ويعودوا للعمرة في العام القادم، فأتاح هذا الأمن والسلم اختلاط الناس وسماعهم للقرآن، فدخل في الإسلام في سنتين أضعاف من دخل فيه منذ البعثة، وأرسل النبي ﷺ رسله وكتبه إلى هرقل وكسرى والمقوقس والنجاشي وملوك الآفاق يدعوهم إلى الله.',
            claimIds: ['clm-hudaybiyyah-fath-mubin'],
            sourceIds: ['src-quran', 'src-bukhari', 'src-muslim']
          }
        ]
      }
    ],
    closingNarrative: 'أثمر صلح الحديبية انتشاراً واسعاً للإسلام، حتى نقضت قريش وحلفاؤها العهد بالاعتداء على خزاعة، فحان موعد الفتح الأعظم.',
    lessons: [
      'السلم والأمن ميدان خصب لانتشار دعوة الحق بالحجة والقرآن.',
      'بُعد النظر النبوي في قبول شروط الحديبية التي ظهر أنها عين الفتح المبين.'
    ],
    peopleIds: ['person-prophet'],
    placeIds: ['place-hudaybiyyah', 'place-makkah'],
    quizQuestions: [
      {
        id: 'qz-ch12-1',
        chapterId: 'ch-12-hudaybiyyah-letters',
        prompt: 'بماذا وصف القرآن الكريم صلح الحديبية في مطلع سورة الفتح؟',
        choices: ['فتحاً مبيناً', 'هدنة مؤقتة', 'غزوة العسرة', 'يوم الفرقان'],
        correctIndex: 0,
        explanation: 'أنزل الله في صلح الحديبية: ﴿إِنَّا فَتَحْنَا لَكَ فَتْحًا مُّبِينًا﴾ لما ترتب عليه من انتشار الإسلام وأمن الدعوة.',
        claimId: 'clm-hudaybiyyah-fath-mubin',
        sourceIds: ['src-quran', 'src-bukhari']
      }
    ],
    previousChapterId: 'ch-11-uhud-khandaq',
    nextChapterId: 'ch-13-fath-makkah'
  },
  {
    id: 'ch-13-fath-makkah',
    partId: 'part-4-campaigns-peace-fath',
    order: 13,
    title: 'الفصل الثالث عشر: فتح مكة الأعظم وعام الوفود',
    subtitle: 'التواضع عند النصر، تطهير البيت الحرام، والعفو العام في رمضان سنة 8هـ',
    periodLabel: 'رمضان 8هـ – 9هـ',
    datePrecision: 'exact',
    intro: 'بعد ثماني سنوات من الهجرة، عاد النبي ﷺ إلى مكة في عشرة آلاف من أصحابه، لا بزهو الملوك الفاتحين بل بخضوع العبد الشاكر لربه.',
    contextNote: 'نقضت بنو بكر وقريش عهد الحديبية، فسار النبي ﷺ في كتمان تام حتى فاجأ مكة دون إراقة دماء.',
    scenes: [
      {
        id: 'sc-13-1-fath-mercy',
        chapterId: 'ch-13-fath-makkah',
        order: 1,
        title: 'المشهد الأول: دخول مكة خاضعاً لله وتطهير الكعبة والعفو عن قريش',
        personIds: ['person-prophet'],
        placeIds: ['place-makkah'],
        bodyBlocks: [
          {
            id: 'blk-13-1-a',
            type: 'paragraph',
            text: 'دخل النبي ﷺ مكة يوم الفتح في رمضان سنة 8هـ وهو مطأطئ رأسه تواضعاً لله حتى كادت ذقنه تمس رحله، وهو يقرأ سورة الفتح، وأعلن الأمان العام: «من دخل المسجد فهو آمن، ومن دخل دار أبي سفيان فهو آمن، ومن أغلق عليه بابه فهو آمن».',
            claimIds: ['clm-fath-makkah'],
            sourceIds: ['src-quran', 'src-bukhari', 'src-muslim']
          },
          {
            id: 'blk-13-1-b',
            type: 'paragraph',
            text: 'وطاف ﷺ بالبيت وحطّم الأصنام التي كانت حول الكعبة وهو يتلو: ﴿وَقُلْ جَاءَ الْحَقُّ وَزَهَقَ الْبَاطِلُ إِنَّ الْبَاطِلَ كَانَ زَهُوقًا﴾، وأمر بلالاً رضي الله عنه فأذّن فوق الكعبة، وعفا عن أهل مكة، فدخل الناس في دين الله أفواجاً، وتوافدت قبائل العرب إلى المدينة في السنة التاسعة معلنة إسلامها.',
            claimIds: ['clm-fath-makkah'],
            sourceIds: ['src-quran', 'src-bukhari', 'src-muslim']
          }
        ]
      }
    ],
    closingNarrative: 'بفتح مكة زالت دولة الشرك من البيت الحرام إلى الأبد، واستقرت كلمة التوحيد في ربوع الجزيرة العربية.',
    lessons: [
      'التواضع لله والشكر والعفو عند المقدرة هي أخلاق النبوة في ساعة النصر.',
      'تحقق وعد الله لنبيه ﷺ بالعودة إلى مكة ظاهراً منصوراً.'
    ],
    peopleIds: ['person-prophet'],
    placeIds: ['place-makkah'],
    quizQuestions: [
      {
        id: 'qz-ch13-1',
        chapterId: 'ch-13-fath-makkah',
        prompt: 'في أي سنة هجرية وشهر وقع فتح مكة الأعظم؟',
        choices: ['في شهر رمضان من السنة الثامنة للهجرة (8هـ)', 'في شوال من السنة الثالثة للهجرة', 'في محرم من السنة الأولى للهجرة', 'في رجب من السنة الخامسة للهجرة'],
        correctIndex: 0,
        explanation: 'وقع فتح مكة الأعظم في شهر رمضان من السنة الثامنة للهجرة كما ثبت في الصحيحين.',
        claimId: 'clm-fath-makkah',
        sourceIds: ['src-bukhari', 'src-muslim']
      }
    ],
    previousChapterId: 'ch-12-hudaybiyyah-letters',
    nextChapterId: 'ch-14-farewell-pilgrimage'
  },

  // PART 5
  {
    id: 'ch-14-farewell-pilgrimage',
    partId: 'part-5-farewell-legacy',
    order: 14,
    title: 'الفصل الرابع عشر: حجة الوداع وخطبة الوداع وكمال الدين',
    subtitle: 'الميثاق الجامع لحقوق الإنسان والعدل والتوحيد في عرفات ومنى سنة 10هـ',
    periodLabel: 'ذو الحجة، السنة العاشرة للهجرة (10هـ)',
    datePrecision: 'exact',
    intro: 'في السنة العاشرة للهجرة أعلن النبي ﷺ عزمه على الحج، فاجتمع معه أكثر من مائة ألف من المسلمين ليتعلموا منه مناسكهم ويسمعوا وصيته الخالدة للأمة.',
    contextNote: 'سميت حجة الوداع لأن النبي ﷺ ودّع فيها الناس وقال: «لتأخذوا مناسككم، فإني لا أدري لعلي لا أحج بعد حجتي هذه».',
    scenes: [
      {
        id: 'sc-14-1-arafat-sermon',
        chapterId: 'ch-14-farewell-pilgrimage',
        order: 1,
        title: 'المشهد الأول: خطبة الوداع في عرفات ونزول آية إكمال الدين',
        personIds: ['person-prophet'],
        placeIds: ['place-arafat', 'place-makkah'],
        bodyBlocks: [
          {
            id: 'blk-14-1-a',
            type: 'paragraph',
            text: 'وقف النبي ﷺ في عرفات ومنى فخطب في الناس خطبةً جامعة قرر فيها أصول الإسلام العظمى: حرمة الدماء والأموال والأعراض كحرمة يومهم وشهرهم وبلدهم، وإبطال ربا الجاهلية ودمائها، والوصية بالنساء خيراً، والمساواة بين البشر تحت راية التقوى، والاعتصام بكتاب الله وسنته.',
            claimIds: ['clm-farewell-pilgrimage'],
            sourceIds: ['src-bukhari', 'src-muslim']
          },
          {
            id: 'blk-14-1-b',
            type: 'paragraph',
            text: 'واستشهدهم ﷺ قائلاً: «ألا هل بلّغت؟» قالوا: نشهد أنك قد بلغت وأديت ونصحت، فرفع أصبعه إلى السماء وينكتها إلى الناس ويقول: «اللهم اشهد» ثلاث مرات. وفي ذلك الموقف العظيم بعرفة نزل قوله تعالى: ﴿الْيَوْمَ أَكْمَلْتُ لَكُمْ دِينَكُمْ وَأَتْمَمْتُ عَلَيْكُمْ نِعْمَتِي وَرَضِيتُ لَكُمُ الْإِسْلَامَ دِينًا﴾.',
            claimIds: ['clm-farewell-pilgrimage'],
            sourceIds: ['src-quran', 'src-bukhari', 'src-muslim']
          }
        ]
      }
    ],
    closingNarrative: 'رجع النبي ﷺ بعد حجة الوداع إلى المدينة وقد اكتمل البناء وتمّ البلاغ، وأخذ يتهيأ للقاء ربه.',
    lessons: [
      'كمال الشريعة الإسلامية وحفظها لحقوق الدماء والأموال والأعراض والعدل بين الناس.',
      'مسؤولية الأمة في حمل الأمانة وتبليغ الرسالة بعد شهادة الصحابة ببلاغ النبي ﷺ.'
    ],
    peopleIds: ['person-prophet'],
    placeIds: ['place-arafat', 'place-makkah'],
    quizQuestions: [
      {
        id: 'qz-ch14-1',
        chapterId: 'ch-14-farewell-pilgrimage',
        prompt: 'ما الآية الكريمة التي نزلت على النبي ﷺ وهو واقف بعرفة في حجة الوداع؟',
        choices: [
          '﴿الْيَوْمَ أَكْمَلْتُ لَكُمْ دِينَكُمْ وَأَتْمَمْتُ عَلَيْكُمْ نِعْمَتِي وَرَضِيتُ لَكُمُ الْإِسْلَامَ دِينًا﴾',
          '﴿اقْرَأْ بِاسْمِ رَبِّكَ الَّذِي خَلَقَ﴾',
          '﴿يَا أَيُّهَا الْمُدَّثِّرُ قُمْ فَأَنذِرْ﴾',
          '﴿إِنَّا فَتَحْنَا لَكَ فَتْحًا مُّبِينًا﴾'
        ],
        correctIndex: 0,
        explanation: 'نزلت آية إكمال الدين (المائدة: 3) عشية عرفة يوم الجمعة في حجة الوداع كما ثبت في الصحيحين.',
        claimId: 'clm-farewell-pilgrimage',
        sourceIds: ['src-quran', 'src-bukhari', 'src-muslim']
      }
    ],
    previousChapterId: 'ch-13-fath-makkah',
    nextChapterId: 'ch-15-passing-rafiq-ala'
  },
  {
    id: 'ch-15-passing-rafiq-ala',
    partId: 'part-5-farewell-legacy',
    order: 15,
    title: 'الفصل الخامس عشر: الالتحاق بالرفيق الأعلى وثبات الصحابة',
    subtitle: 'الوصية بالصلاة، اختيار الرفيق الأعلى، وموقف أبي بكر الصديق الفاصل سنة 11هـ',
    periodLabel: 'ربيع الأول، السنة الحادية عشرة للهجرة (11هـ)',
    datePrecision: 'exact',
    intro: 'في أواخر صفر ومطلع ربيع الأول من السنة الحادية عشرة للهجرة، بدأ مرض النبي ﷺ الذي اختاره الله فيه إلى جواره بعد أن أدى الأمانة وبلّغ الرسالة.',
    contextNote: 'مكث ﷺ في مرضه في بيت أم المؤمنين عائشة رضي الله عنها بإذن أمهات المؤمنين، وأمر أبا بكر أن يصلي بالناس.',
    scenes: [
      {
        id: 'sc-15-1-rafiq-ala-abubakr',
        chapterId: 'ch-15-passing-rafiq-ala',
        order: 1,
        title: 'المشهد الأول: «بل الرفيق الأعلى» وتثبيت أبي بكر الصديق للأمة',
        personIds: ['person-prophet', 'person-aisha', 'person-abu-bakr'],
        placeIds: ['place-madinah'],
        bodyBlocks: [
          {
            id: 'blk-15-1-a',
            type: 'paragraph',
            text: 'كانت آخر وصايا النبي ﷺ لأمته المحافظة على الصلاة والإحسان إلى الضعفاء، وفي صبيحة يوم الإثنين كشف ستر حجرة عائشة ونظر إلى المسلمين وهم صفوف في صلاة الفجر خلف أبي بكر فتبسم ﷺ سروراً باجتماعهم على الصلاة، ثم فاضت روحه الطاهرة ضحى ذلك اليوم وهو يقول: «اللهم الرفيق الأعلى».',
            claimIds: ['clm-passing-rafiq-ala'],
            sourceIds: ['src-bukhari', 'src-muslim']
          },
          {
            id: 'blk-15-1-b',
            type: 'quote_verified',
            text: 'خطب أبو بكر الصديق رضي الله عنه في الناس بعد أن قبّل النبي ﷺ وقال: «أَمَّا بَعْدُ، فَمَنْ كَانَ مِنْكُمْ يَعْبُدُ مُحَمَّدًا ﷺ فَإِنَّ مُحَمَّدًا قَدْ مَاتَ، وَمَنْ كَانَ مِنْكُمْ يَعْبُدُ اللَّهَ فَإِنَّ اللَّهَ حَيٌّ لَا يَمُوتُ»، وتلا قوله تعالى: ﴿وَمَا مُحَمَّدٌ إِلَّا رَسُولٌ قَدْ خَلَتْ مِن قَبْلِهِ الرُّسُلُ﴾.',
            claimIds: ['clm-passing-rafiq-ala'],
            sourceIds: ['src-quran', 'src-bukhari']
          }
        ]
      }
    ],
    closingNarrative: 'سكنت النفوس بتلاوة أبي بكر الصديق رضي الله عنه للقرآن، واجتمع الصحابة على حفظ الرسالة وإتمام المسيرة.',
    lessons: [
      'ارتباط الأمة بالحي الذي لا يموت سبحانه وبكتابه وسنة نبيه ﷺ.',
      'عظمة مكانة الصلاة التي كانت آخر ما أوصى به النبي ﷺ وسرّ برؤية أمته مجتمعة عليها.'
    ],
    peopleIds: ['person-prophet', 'person-aisha', 'person-abu-bakr'],
    placeIds: ['place-madinah'],
    quizQuestions: [
      {
        id: 'qz-ch15-1',
        chapterId: 'ch-15-passing-rafiq-ala',
        prompt: 'ما الآية التي تلاها أبو بكر الصديق رضي الله عنه لتثبيت الصحابة يوم وفاة النبي ﷺ؟',
        choices: [
          '﴿وَمَا مُحَمَّدٌ إِلَّا رَسُولٌ قَدْ خَلَتْ مِن قَبْلِهِ الرُّسُلُ﴾',
          '﴿إِنَّا أَعْطَيْنَاكَ الْكَوْثَرَ﴾',
          '﴿سُبْحَانَ الَّذِي أَسْرَىٰ بِعَبْدِهِ لَيْلًا﴾',
          '﴿لَقَدْ رَضِيَ اللَّهُ عَنِ الْمُؤْمِنِينَ﴾'
        ],
        correctIndex: 0,
        explanation: 'تلا أبو بكر الصديق رضي الله عنه آية آل عمران (144) فكأن الناس لم يسمعوها حتى تلاها يومئذٍ (صحيح البخاري).',
        claimId: 'clm-passing-rafiq-ala',
        sourceIds: ['src-quran', 'src-bukhari']
      }
    ],
    previousChapterId: 'ch-14-farewell-pilgrimage',
    nextChapterId: 'ch-16-shamail-legacy'
  },
  {
    id: 'ch-16-shamail-legacy',
    partId: 'part-5-farewell-legacy',
    order: 16,
    title: 'الفصل السادس عشر: الشمائل النبوية وأخلاقه وهديه ﷺ',
    subtitle: '«كان خُلُقه القرآن» — رحمته، تواضعه، عبادته، ومعاملته لأهله وأمته',
    periodLabel: 'هديه الدائم وإرثه الخالد ﷺ',
    datePrecision: 'exact',
    intro: 'لا تكتمل قراءة السيرة النبوية بسرد الوقائع التاريخية فحسب، بل بالتعرف على شمائله وأخلاقه ﷺ التي جعلت منه الأسوة الحسنة لكل مؤمن: ﴿لَّقَدْ كَانَ لَكُمْ فِي رَسُولِ اللَّهِ أُسْوَةٌ حَسَنَةٌ﴾.',
    contextNote: 'زكّى الله عز وجل خُلُق نبيه ﷺ في القرآن بقوله: ﴿وَإِنَّكَ لَعَلَىٰ خُلُقٍ عَظِيمٍ﴾.',
    scenes: [
      {
        id: 'sc-16-1-shamail-quran',
        chapterId: 'ch-16-shamail-legacy',
        order: 1,
        title: 'المشهد الأول: خُلُقه القرآن ورحمته وتواضعه وعبادته ﷺ',
        personIds: ['person-prophet', 'person-aisha'],
        placeIds: ['place-madinah'],
        bodyBlocks: [
          {
            id: 'blk-16-1-a',
            type: 'paragraph',
            text: 'سُئلت أم المؤمنين عائشة رضي الله عنها عن خُلُق رسول الله ﷺ فقالت: «كان خُلُقه القرآن»؛ فكان ﷺ قرآناً يمشي على الأرض في صدقه وحلمه ورحمته وعدله، يقوم الليل حتى تتفطر قدماه ويقول: «أفلا أكون عبداً شكوراً».',
            claimIds: ['clm-shamail-character'],
            sourceIds: ['src-quran', 'src-bukhari', 'src-muslim', 'src-shamail']
          },
          {
            id: 'blk-16-1-b',
            type: 'paragraph',
            text: 'وكان ﷺ في بيته في مهنة أهله، يخيط ثوبه ويخصف نعله، ويسلّم على الصبيان، ولا يرد سائلاً، وما خُيّر بين أمرين إلا اختار أيسرهما ما لم يكن إثماً، وما انتقم لنفسه قط إلا أن تُنتهك حرمة الله فينتقم لله بها.',
            claimIds: ['clm-shamail-character'],
            sourceIds: ['src-bukhari', 'src-muslim', 'src-shamail']
          }
        ]
      }
    ],
    closingNarrative: 'وهكذا يبقى صاحب القرآن وطالب العلم على صلة حية بسيرة النبي ﷺ؛ كلما تلا آيةً من كتاب الله تذكر كيف عاشها رسول الله ﷺ وأصحابه الكرام، فصلوات الله وسلامه عليه دائماً أبداً.',
    lessons: [
      'ثمرة حفظ القرآن وتلاوته هي التخلق بأخلاقه اقتداءً بمن كان خُلُقه القرآن ﷺ.',
      'الجمع بين قوة العبادة وقيام الليل وبين التواضع وحسن العشرة مع الأهل والناس.'
    ],
    peopleIds: ['person-prophet', 'person-aisha'],
    placeIds: ['place-madinah'],
    quizQuestions: [
      {
        id: 'qz-ch16-1',
        chapterId: 'ch-16-shamail-legacy',
        prompt: 'بماذا لخّصت أم المؤمنين عائشة رضي الله عنها خُلُق النبي ﷺ في صحيح مسلم؟',
        choices: ['«كان خُلُقه القرآن»', '«كان شديد العزلة عن الناس»', '«كان لا يمازح أهله ولا أصحابه»', '«كان يختار أشد الأمرين دائماً»'],
        correctIndex: 0,
        explanation: 'لخصت رضي الله عنها شمائله كلها بقولها: «فإن خُلُق نبي الله ﷺ كان القرآن» (صحيح مسلم).',
        claimId: 'clm-shamail-character',
        sourceIds: ['src-muslim', 'src-shamail']
      }
    ],
    previousChapterId: 'ch-15-passing-rafiq-ala',
    nextChapterId: null
  }
];

export function getSeerahChapterById(chapterId: string): SeerahChapter | undefined {
  return SEERAH_CHAPTERS.find(ch => ch.id === chapterId);
}

export function getSeerahChaptersByPart(partId: string): SeerahChapter[] {
  return SEERAH_CHAPTERS.filter(ch => ch.partId === partId).sort((a, b) => a.order - b.order);
}
