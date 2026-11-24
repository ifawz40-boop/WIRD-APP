#!/usr/bin/env python3
"""
Phase 2 — Reconstruct the Complete Chronological Seerah Hierarchy
-----------------------------------------------------------------
Constructs the definitive content architecture from the Phase 1 research repository:
  Historical Era (6) -> Main Section (12) -> Chapter (40) -> Narrative Scenes -> Events -> Characters -> Sources
plus the 32-character bidirectional narrative journey blueprint.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
RESEARCH = ROOT / "research"

ERAS = [
    {
        "id": "era-1-roots",
        "order": 1,
        "title": "العصر الأول: جذور الرسالة ومكة قبل الفجر",
        "periodLabel": "من عهد الخليل إبراهيم عليه السلام إلى قبيل البعثة النبوية",
        "summary": "قصة البيت العتيق وبئر زمزم، وتحولات العرب في اليمن والحجاز، وحماية مكة عام الفيل، ثم ميلاد سيد الخلق ﷺ ونشأته الطاهرة في البادية ومكة حتى شبابه وزواجه وبناء الكعبة.",
    },
    {
        "id": "era-2-makkah",
        "order": 2,
        "title": "العصر الثاني: نزول الوحي وميلاد الأمة في مكة",
        "periodLabel": "السنة الأولى للبعثة — السنة الثالثة عشرة للبعثة (610 – 622 م تقريباً)",
        "summary": "من لحظة النور الأولى في غار حراء ودار الأرقم، إلى الصدع بالحق والصبر على الأذى والهجرة إلى الحبشة وحصار الشعب وعام الحزن والطائف ومعجزة الإسراء والمعراج وبيعتي العقبة.",
    },
    {
        "id": "era-3-hijrah-badr",
        "order": 3,
        "title": "العصر الثالث: الهجرة النبوية وتأسيس دولة المدينة ويوم الفرقان",
        "periodLabel": "مطلع الهجرة النبوية — نهاية السنة الثانية للهجرة",
        "summary": "خروج النبي ﷺ وصاحبه الصديق من مكة إلى غار ثور فطيبة، وبناء المسجد النبوي والمؤاخاة ووثيقة المدينة، وتحويل القبلة وفرض الصيام، ثم النصر المؤزر في غزوة بدر الكبرى.",
    },
    {
        "id": "era-4-trials",
        "order": 4,
        "title": "العصر الرابع: سنوات التمحيص والثبات وانكسار الأحزاب",
        "periodLabel": "السنة الثالثة — نهاية السنة الخامسة للهجرة",
        "summary": "امتحان أُحد الدامي ونهوض الصحابة في حمراء الأسد، وتضحيات الشهداء في الرجيع وبئر معونة، وإجلاء بني النضير، ثم صمود المدينة الأسطوري خلف الخندق أمام الأحزاب وحسم غدر قريظة.",
    },
    {
        "id": "era-5-openings",
        "order": 5,
        "title": "العصر الخامس: الفتح المبين وعالمية الرسالة والفتح الأعظم",
        "periodLabel": "السنة السادسة — نهاية السنة الثامنة للهجرة",
        "summary": "من محنة الإفك إلى بيعة الرضوان وصلح الحديبية، ورسائل النبي ﷺ إلى ملوك الأرض، وفتح خيبر، وبطولة مؤتة، ثم دخول مكة فاتحاً متواضعاً وعفوه العام، وثباته يوم حنين ووفاؤه للأنصار.",
    },
    {
        "id": "era-6-completion",
        "order": 6,
        "title": "العصر السادس: تمام النعمة والرحيل إلى الرفيق الأعلى والشمائل الخالدة",
        "periodLabel": "السنة التاسعة — السنة الحادية عشرة للهجرة والشمائل النبوية",
        "summary": "ملحمة الصبر في تبوك، ودخول قبائل العرب في دين الله أفواجاً عام الوفود، وخطبة الوداع الخالدة بعرفات ومنى، ثم مرض النبي ﷺ ولحاقه بالرفيق الأعلى وثبات الصديق، وبيته الطاهر وشمائله الكريمة.",
    },
]

SECTIONS = [
    {"id": "sec-01", "eraId": "era-1-roots", "order": 1, "title": "إرث الخليل وتحولات الجزيرة العربية", "periodLabel": "عهد إبراهيم وإسماعيل — عام الفيل", "summary": "كيف تهيأت مكة والجزيرة العربية لاحتضان الرسالة الخاتمة منذ دعوة إبراهيم عليه السلام حتى حادثة الفيل وعبد المطلب."},
    {"id": "sec-02", "eraId": "era-1-roots", "order": 2, "title": "الفجر المكي ونشأة الصادق الأمين ﷺ", "periodLabel": "عام الفيل — الخامسة والثلاثون من عمره الشريف", "summary": "المولد النبوي الشريف، والرضاعة في بني سعد، وكفالة الجد والعم، وشباب الطهر والأمانة والزواج بخديجة وتجديد الكعبة."},
    {"id": "sec-03", "eraId": "era-2-makkah", "order": 3, "title": "فجر النبوة وطلائع المؤمنين", "periodLabel": "قبيل البعثة — السنة الرابعة للبعثة", "summary": "أشواق الحنفاء وبشارات الكتب، ولحظة الوحي في غار حراء، وجيل دار الأرقم، والصدع بأمر الله على جبل الصفا."},
    {"id": "sec-04", "eraId": "era-2-makkah", "order": 4, "title": "الصبر على البلاء وآفاق الفرج", "periodLabel": "السنة الخامسة — السنة الثالثة عشرة للبعثة", "summary": "المحنة والهجرة إلى الحبشة، وإسلام حمزة وعمر، وحصار الشعب، وعام الحزن والطائف، والإسراء والمعراج، وبيعتا العقبة."},
    {"id": "sec-05", "eraId": "era-3-hijrah-badr", "order": 5, "title": "طريق الهجرة وبناء المجتمع النبوي", "periodLabel": "أواخر العهد المكي — السنة الأولى للهجرة", "summary": "هجرة الصحابة ومكر دار الندوة، ومعية الله في غار ثور وطريق الهجرة، وإرساء دعائم المجتمع والدولة في المدينة."},
    {"id": "sec-06", "eraId": "era-3-hijrah-badr", "order": 6, "title": "السنة الثانية ويوم الفرقان", "periodLabel": "السنة الثانية للهجرة", "summary": "تحويل القبلة وفرض الصيام والسرايا الأولى، ثم ملحمة بدر الكبرى وما أعقبها من تحول استراتيجي في الجزيرة."},
    {"id": "sec-07", "eraId": "era-4-trials", "order": 7, "title": "امتحان أُحد وتضحيات الشهداء", "periodLabel": "السنة الثالثة — السنة الرابعة للهجرة", "summary": "دروس أُحد الجسيمة وثبات النبي ﷺ وحمراء الأسد، وفاجعة الرجيع وبئر معونة، وإجلاء بني النضير."},
    {"id": "sec-08", "eraId": "era-4-trials", "order": 8, "title": "الخندق وانكسار الأحزاب", "periodLabel": "السنة الخامسة للهجرة", "summary": "تحالف القبائل لاستئصال المدينة، وحفر الخندق في البرد والجوع، ونصر الله بريح الصبا، وحكم الله في بني قريظة."},
    {"id": "sec-09", "eraId": "era-5-openings", "order": 9, "title": "من الحديبية إلى خيبر ومؤتة", "periodLabel": "السنة السادسة — جمادى الأولى 8 هـ", "summary": "براءة الصديقة في حادثة الإفك، وصلح الحديبية المبين، ومكاتبة الملوك وفتح خيبر، ورايات الشهادة في مؤتة."},
    {"id": "sec-10", "eraId": "era-5-openings", "order": 10, "title": "الفتح الأعظم وحنين ووفاء الأنصار", "periodLabel": "رمضان — ذو القعدة 8 هـ", "summary": "العودة المظفرة المتواضعة إلى مكة والعفو التاريخي، ثم الثبات يوم حنين وحصار الطائف ولحظة الوفاء الخالدة في الجعرانة."},
    {"id": "sec-11", "eraId": "era-6-completion", "order": 11, "title": "تبوك والوفود وحجة الوداع", "periodLabel": "السنة التاسعة — ذو الحجة 10 هـ", "summary": "جيش العسرة في تبوك وتوبة الثلاثة، وتوافد قبائل العرب للإسلام، وخطبة الوداع الجامعة في عرفات ومنى."},
    {"id": "sec-12", "eraId": "era-6-completion", "order": 12, "title": "الرفيق الأعلى والبيت النبوي والشمائل الخالدة", "periodLabel": "السنة الحادية عشرة للهجرة — الإرث النبوي الخالد", "summary": "مرض الوفاة واللحاق بالرفيق الأعلى وثبات أبي بكر، والغسل والدفن وميراث النبوة، وأمهات المؤمنين وآل البيت وشمائله ﷺ."},
]

# 40 Full-Length Chronological Chapters covering 100% of the 4 volumes
CHAPTERS_SPEC: list[dict[str, Any]] = [
    # SEC 01
    {
        "id": "ch-01", "sectionId": "sec-01", "order": 1,
        "title": "دعوة الخليل في الوادي المبارك",
        "subtitle": "إسماعيل وزمزم ورفع قواعد البيت العتيق وأنساب العرب",
        "periodLabel": "عهد إبراهيم وإسماعيل عليهما السلام", "datePrecision": "range",
        "sourceRefs": [{"volume": 1, "startPage": 1, "endPage": 103}],
        "quranQuotes": ["q-ibrahim-valley", "q-ibrahim-kaaba"],
        "hadithQuotes": ["h-arab-ismail-ramy"],
        "disputes": ["disp-arab-qahtan", "disp-zabih"],
        "characters": ["abd-al-muttalib"],
        "places": ["makkah", "zamzam"],
        "sources": ["src-quran", "src-bukhari", "src-ibn-ishaq", "src-ibn-kathir"],
        "scenePlan": [
            "في وادٍ غير ذي زرع: هاجر وإسماعيل وتفجّر ماء زمزم وقدوم جُرهم",
            "رفع قواعد الكعبة المشرفة ودعاء الخليل ببعثة النبي الخاتم",
            "شجرة العرب بين القحطانية والعدنانية ومكانة بني إسماعيل في الحجاز",
        ],
    },
    {
        "id": "ch-02", "sectionId": "sec-01", "order": 2,
        "title": "عروش اليمن وسيل العرم وأصحاب الأخدود",
        "subtitle": "تحولات الممالك الجنوبية وتصدّع العالم القديم قبل الإسلام",
        "periodLabel": "قرون ما قبل البعثة", "datePrecision": "approximate",
        "sourceRefs": [{"volume": 1, "startPage": 8, "endPage": 55}],
        "quranQuotes": ["q-saba-flood", "q-ashab-ukhdud"],
        "hadithQuotes": [],
        "disputes": [],
        "characters": [],
        "places": ["makkah"],
        "sources": ["src-quran", "src-muslim", "src-ibn-ishaq", "src-ibn-kathir"],
        "scenePlan": [
            "جنّتا مأرب وسيل العرم وتفرّق قبائل الأزد في أنحاء الجزيرة",
            "رؤيا ربيعة بن نصر ومسير تُبّع وتعظيمه للبيت الحرام",
            "محرقة الأخدود بنجران وتعاقب الأحباش والفرس على اليمن",
        ],
    },
    {
        "id": "ch-03", "sectionId": "sec-01", "order": 3,
        "title": "عام الفيل وحفظ البيت الحرام",
        "subtitle": "زحف أبرهة لهدم الكعبة وموقف عبد المطلب المهيب وآية الطير الأبابيل",
        "periodLabel": "عام الفيل (نحو 570 – 571 م)", "datePrecision": "approximate",
        "sourceRefs": [{"volume": 1, "startPage": 28, "endPage": 47}],
        "quranQuotes": ["q-surah-fil", "q-quraysh-ilaf"],
        "hadithQuotes": [],
        "disputes": [],
        "characters": ["abd-al-muttalib"],
        "places": ["makkah"],
        "sources": ["src-quran", "src-bukhari", "src-muslim", "src-ibn-ishaq", "src-ibn-kathir"],
        "scenePlan": [
            "القُلّيس في صنعاء وقسم أبرهة الأشرم على هدم الكعبة",
            "لِقاء عبد المطلب وأبرهة: للبيت ربٌّ يحميه وبرود الفيل محمود",
            "طير أبابيل وعصف مأكول: هيبة الحرم وتمهيد الأرض لميلاد النبي ﷺ",
        ],
    },
    {
        "id": "ch-04", "sectionId": "sec-01", "order": 4,
        "title": "قريش وسدانة الكعبة ونذر الذبيح",
        "subtitle": "قصيّ بن كلاب وحفر عبد المطلب لبئر زمزم وزواج عبد الله بآمنة",
        "periodLabel": "القرن السابق للمولد النبوي الشريف", "datePrecision": "approximate",
        "sourceRefs": [{"volume": 1, "startPage": 82, "endPage": 180}],
        "quranQuotes": ["q-quraysh-ilaf"],
        "hadithQuotes": [],
        "disputes": ["disp-zabih"],
        "characters": ["abd-al-muttalib"],
        "places": ["makkah", "zamzam", "abwa"],
        "sources": ["src-ibn-ishaq", "src-ibn-hisham", "src-bayhaqi", "src-ibn-kathir"],
        "scenePlan": [
            "جمع قصيّ لقريش وتأسيس السقاية والرفادة ودار الندوة",
            "رؤيا عبد المطلب وإعادة حفر زمزم بعد دروسها قروناً",
            "نذر الذبيح وفداء عبد الله بالمائة من الإبل وزواجه بآمنة بنت وهب",
        ],
    },
    # SEC 02
    {
        "id": "ch-05", "sectionId": "sec-02", "order": 5,
        "title": "مولد النور ﷺ في عام الفيل",
        "subtitle": "النسب المصطفى وإشراق فجر الاثنين المبارك بمكة المكرمة",
        "periodLabel": "ربيع الأول من عام الفيل", "datePrecision": "approximate",
        "sourceRefs": [{"volume": 1, "startPage": 181, "endPage": 222}],
        "quranQuotes": ["q-anbiya-mercy"],
        "hadithQuotes": ["h-lineage-selection", "h-birth-monday"],
        "disputes": ["disp-birth-date"],
        "characters": ["abd-al-muttalib"],
        "places": ["makkah"],
        "sources": ["src-muslim", "src-ahmad", "src-ibn-ishaq", "src-bayhaqi", "src-ibn-kathir"],
        "scenePlan": [
            "سلسلة الاصطفاء: طهارة النسب الشريف من عدنان إلى هاشم وعبد الله",
            "رحيل عبد الله شاباً وميلاد محمد ﷺ يوم الاثنين من عام الفيل",
            "فرحة عبد المطلب بالمولود المبارك وتسميته محمداً وما رُوي من البشائر",
        ],
    },
    {
        "id": "ch-06", "sectionId": "sec-02", "order": 6,
        "title": "في ديار بني سعد",
        "subtitle": "حليمة السعدية وبركة البادية وحادثة شق الصدر الشريف",
        "periodLabel": "السنوات الأربع الأولى من عمره ﷺ", "datePrecision": "approximate",
        "sourceRefs": [{"volume": 1, "startPage": 223, "endPage": 245}],
        "quranQuotes": ["q-sharh-chest"],
        "hadithQuotes": ["h-halimah-chest"],
        "disputes": [],
        "characters": ["hamzah-ibn-abd-al-muttalib"],
        "places": ["makkah", "badiyat-bani-sad"],
        "sources": ["src-muslim", "src-ibn-ishaq", "src-ibn-hisham", "src-bayhaqi", "src-ibn-kathir"],
        "scenePlan": [
            "رحلة المراضع إلى مكة وكيف غيّر اليتيم المبارك حال دار حليمة السعدية",
            "فصاحة اللسان وصفاء الفطرة في مضارب بني سعد",
            "حادثة شق الصدر الشريف وإشفاق حليمة وردّته آمناً إلى أمه بمكة",
        ],
    },
    {
        "id": "ch-07", "sectionId": "sec-02", "order": 7,
        "title": "اليتم والكنف الرحيم",
        "subtitle": "وداع الأم بالأبواء ورحيل الجد عبد المطلب وحنان العم أبي طالب",
        "periodLabel": "من السادسة إلى الثانية عشرة من عمره ﷺ تقريباً", "datePrecision": "approximate",
        "sourceRefs": [{"volume": 1, "startPage": 246, "endPage": 254}],
        "quranQuotes": ["q-duha-orphan"],
        "hadithQuotes": [],
        "disputes": ["disp-mother-passing-age"],
        "characters": ["abd-al-muttalib", "abu-talib"],
        "places": ["makkah", "abwa"],
        "sources": ["src-quran", "src-muslim", "src-ibn-ishaq", "src-ibn-sad", "src-ibn-kathir"],
        "scenePlan": [
            "رحلة الوفاء إلى أخوال أبيه ووفاة آمنة بالأبواء وحضن أم أيمن",
            "على فراش عبد المطلب تحت ظل الكعبة ثم الفقد الثاني في الثامنة",
            "كفالة أبي طالب ورعي الغنم بمكة وصون الله له في صباه ورحلة الشام",
        ],
    },
    {
        "id": "ch-08", "sectionId": "sec-02", "order": 8,
        "title": "شباب الصادق الأمين وزواجه وبناء الكعبة",
        "subtitle": "حلف الفضول والبيت الطاهر مع خديجة وحكمته ﷺ في وضع الحجر الأسود",
        "periodLabel": "من العشرين إلى الخامسة والثلاثين من عمره ﷺ", "datePrecision": "approximate",
        "sourceRefs": [{"volume": 1, "startPage": 255, "endPage": 285}],
        "quranQuotes": [],
        "hadithQuotes": ["h-hilf-fudul"],
        "disputes": ["disp-khadijah-age"],
        "characters": ["khadijah-bint-khuwaylid", "ali-ibn-abi-talib", "zayd-ibn-harithah"],
        "places": ["makkah"],
        "sources": ["src-bukhari", "src-muslim", "src-ahmad", "src-ibn-ishaq", "src-bayhaqi", "src-ibn-kathir"],
        "scenePlan": [
            "حرب الفجار وحلف الفضول في دار ابن جدعان نصرةً لكل مظلوم",
            "التجارة بأموال خديجة بنت خويلد والزواج المبارك وميلاد الذرية الطاهرة",
            "تجديد قريش لبناء الكعبة والتحكيم النبوي الحكيم الذي حقن دماء القبائل",
        ],
    },
    # SEC 03
    {
        "id": "ch-09", "sectionId": "sec-03", "order": 9,
        "title": "بشارات الأنبياء وأشواق الحنفاء",
        "subtitle": "زيد بن عمرو بن نفيل وبحث القلوب الصادقة عن فجر التوحيد",
        "periodLabel": "السنوات الممهدة للمبعث النبوي الشريف", "datePrecision": "range",
        "sourceRefs": [{"volume": 1, "startPage": 104, "endPage": 165}, {"volume": 1, "startPage": 286, "endPage": 384}],
        "quranQuotes": [],
        "hadithQuotes": ["h-stone-salutation"],
        "disputes": [],
        "characters": ["salman-al-farisi"],
        "places": ["makkah", "ghar-hira"],
        "sources": ["src-bukhari", "src-muslim", "src-ibn-ishaq", "src-bayhaqi", "src-ibn-kathir"],
        "scenePlan": [
            "غرباء التوحيد في ليل الجاهلية: قس بن ساعدة وزيد بن عمرو بن نفيل عند الكعبة",
            "بشارات أهل الكتاب ورحلة الباحثين عن الحقيقة كسلمان الفارسي",
            "الرؤيا الصادقة كفلق الصبح وحب الخلوة والتأمل في غار حراء",
        ],
    },
    {
        "id": "ch-10", "sectionId": "sec-03", "order": 10,
        "title": "في غار حراء: اقرأ باسم ربك",
        "subtitle": "لحظة اتصال السماء بالأرض وتثبيت خديجة وبشارة ورقة بن نوفل",
        "periodLabel": "رمضان — السنة الأولى للبعثة (تمام الأربعين)", "datePrecision": "exact",
        "sourceRefs": [{"volume": 1, "startPage": 385, "endPage": 429}],
        "quranQuotes": ["q-alaq-iqra", "q-muddaththir-arise"],
        "hadithQuotes": ["h-hira-gabriel", "h-khadijah-comfort", "h-waraqah-namus"],
        "disputes": [],
        "characters": ["khadijah-bint-khuwaylid"],
        "places": ["ghar-hira", "makkah"],
        "sources": ["src-quran", "src-bukhari", "src-muslim", "src-ahmad", "src-ibn-kathir"],
        "scenePlan": [
            "ليلة النور في غار حراء: ضمّة جبريل الثلاث ونزول مطلع سورة العلق",
            "«زملوني زملوني»: كلمات خديجة الخالدة وشهادة ورقة بن نوفل بالناموس الأكبر",
            "فترة الوحي وشوق النبي ﷺ ثم نزول ﴿يا أيها المدثر قم فأنذر﴾",
        ],
    },
    {
        "id": "ch-11", "sectionId": "sec-03", "order": 11,
        "title": "الرعيل الأول ودار الأرقم",
        "subtitle": "إسلام السابقين الأولين وبناء النواة الإيمانية في سرية وحكمة",
        "periodLabel": "السنوات الأولى إلى الثالثة للبعثة", "datePrecision": "range",
        "sourceRefs": [{"volume": 1, "startPage": 430, "endPage": 454}],
        "quranQuotes": [],
        "hadithQuotes": [],
        "disputes": ["disp-first-believer"],
        "characters": [
            "khadijah-bint-khuwaylid", "abu-bakr-al-siddiq", "ali-ibn-abi-talib",
            "zayd-ibn-harithah", "uthman-ibn-affan", "zubayr-ibn-al-awwam",
            "abd-al-rahman-ibn-awf", "sad-ibn-abi-waqqas", "talhah-ibn-ubaydillah",
            "abu-ubaydah-ibn-al-jarrah", "abdullah-ibn-masud", "bilal-ibn-rabah", "ammar-ibn-yasir",
        ],
        "places": ["makkah", "dar-al-arqam"],
        "sources": ["src-bukhari", "src-muslim", "src-ibn-ishaq", "src-ibn-sad", "src-ibn-kathir"],
        "scenePlan": [
            "السبق الأول بلا تردد: خديجة والصديق وعلي وزيد بن حارثة",
            "دعوة الصديق الهادئة وإسلام كبار العشرة المبشرين بالجنة وأبي ذر وضماد",
            "دار الأرقم على الصفا: مدرسة القرآن والتربية وصلاة المؤمنين في شعاب مكة",
        ],
    },
    {
        "id": "ch-12", "sectionId": "sec-03", "order": 12,
        "title": "الصدع بالحق على الصفا ومجادلة قريش",
        "subtitle": "إنذار العشيرة الأقربين ومواجهة أبي لهب وسفارات قريش إلى أبي طالب",
        "periodLabel": "السنة الرابعة للبعثة تقريباً", "datePrecision": "approximate",
        "sourceRefs": [{"volume": 1, "startPage": 455, "endPage": 508}],
        "quranQuotes": ["q-shuara-clan", "q-hijr-proclaim", "q-masad-abu-lahab"],
        "hadithQuotes": ["h-safa-call", "h-fatimah-rescue-self"],
        "disputes": [],
        "characters": ["abu-talib", "fatimah-al-zahra", "abu-bakr-al-siddiq", "abdullah-ibn-masud"],
        "places": ["makkah"],
        "sources": ["src-quran", "src-bukhari", "src-muslim", "src-ibn-ishaq", "src-ibn-kathir"],
        "scenePlan": [
            "جمع بني عبد المطلب والنداء المزلزل من فوق جبل الصفا",
            "وفود قريش إلى أبي طالب وحرب الدعاية والاستهزاء وحيرة الوليد بن المغيرة",
            "جهر ابن مسعود بالقرآن عند المقام وثبات النبي ﷺ تحت حماية ربه",
        ],
    },
    # SEC 04
    {
        "id": "ch-13", "sectionId": "sec-04", "order": 13,
        "title": "ثبات المستضعفين والهجرة إلى أرض الحبشة",
        "subtitle": "رمضاء مكة وصمود بلال وآل ياسر ومناظرة جعفر في بلاط النجاشي",
        "periodLabel": "السنة الخامسة للبعثة", "datePrecision": "exact",
        "sourceRefs": [{"volume": 2, "startPage": 3, "endPage": 42}],
        "quranQuotes": ["q-maryam-jaafar"],
        "hadithQuotes": ["h-jaafar-najashi"],
        "disputes": [],
        "characters": [
            "bilal-ibn-rabah", "ammar-ibn-yasir", "abu-bakr-al-siddiq",
            "uthman-ibn-affan", "jafar-ibn-abi-talib", "umm-salamah",
            "zubayr-ibn-al-awwam", "ashamah-al-najashi",
        ],
        "places": ["makkah", "habashah"],
        "sources": ["src-quran", "src-bukhari", "src-ahmad", "src-ibn-ishaq", "src-bayhaqi", "src-ibn-kathir"],
        "scenePlan": [
            "المحنة القاسية في بطحاء مكة: بلال وآل ياسر وعين الرحمة النبوية وعتق الصديق",
            "الإذن بالهجرة إلى الملك الذي لا يُظلم عنده أحد وخروج الرعيلين إلى الحبشة",
            "مكيدة عمرو بن العاص ودموع النجاشي أصحمة عند سماع سورة مريم من جعفر",
        ],
    },
    {
        "id": "ch-14", "sectionId": "sec-04", "order": 14,
        "title": "عزّ الإسلام وميثاق الحصار",
        "subtitle": "إسلام حمزة بن عبد المطلب وعمر بن الخطاب وثلاث سنين في شعب أبي طالب",
        "periodLabel": "السنة السادسة — العاشرة للبعثة", "datePrecision": "range",
        "sourceRefs": [{"volume": 1, "startPage": 445, "endPage": 447}, {"volume": 2, "startPage": 32, "endPage": 92}],
        "quranQuotes": [],
        "hadithQuotes": [],
        "disputes": [],
        "characters": ["hamzah-ibn-abd-al-muttalib", "umar-ibn-al-khattab", "abu-talib", "abu-bakr-al-siddiq", "khadijah-bint-khuwaylid"],
        "places": ["makkah", "shib-abi-talib"],
        "sources": ["src-bukhari", "src-ahmad", "src-ibn-ishaq", "src-ibn-hisham", "src-ibn-kathir"],
        "scenePlan": [
            "حمية أسد الله حمزة ودعاء النبي ﷺ الذي فتح قلب الفاروق عمر بن الخطاب",
            "صحيفة المقاطعة الجائرة واجتماع بني هاشم وبني المطلب في الشعب ثلاث سنين",
            "جوار ابن الدغنة للصديق وسعي أشراف من قريش وأثر الأرضة في نقض الصحيفة",
        ],
    },
    {
        "id": "ch-15", "sectionId": "sec-04", "order": 15,
        "title": "عام الحزن والرحلة إلى الطائف",
        "subtitle": "فقد أبي طالب وخديجة ودماء القدمين الشريفتين ورحمة تأبى إطباق الأخشبين",
        "periodLabel": "السنة العاشرة للبعثة تقريباً", "datePrecision": "approximate",
        "sourceRefs": [{"volume": 2, "startPage": 122, "endPage": 175}],
        "quranQuotes": ["q-ahqaf-jinn"],
        "hadithQuotes": ["h-taif-mountains-angel"],
        "disputes": ["disp-sorrow-year-term"],
        "characters": ["abu-talib", "khadijah-bint-khuwaylid", "zayd-ibn-harithah", "aishah-bint-abi-bakr"],
        "places": ["makkah", "taif"],
        "sources": ["src-quran", "src-bukhari", "src-muslim", "src-ibn-ishaq", "src-ibn-kathir"],
        "scenePlan": [
            "الفقد المزدوج: رحيل الحامي الخارجي أبي طالب والسكن الداخلي خديجة رضي الله عنها",
            "المسير مع زيد بن حارثة إلى ثقيف في الطائف وردّهم القاسي واستراحة بستان عتبة وشيبة",
            "موقف ملك الجبال الخالد وإسلام عداس واستماع نفر الجن للقرآن في بطن نخلة",
        ],
    },
    {
        "id": "ch-16", "sectionId": "sec-04", "order": 16,
        "title": "الإسراء والمعراج من المسجد الحرام إلى سدرة المنتهى",
        "subtitle": "تكرمة السماء بعد جفاء الأرض وفرض الصلوات الخمس وتصديق الصديق",
        "periodLabel": "أواخر العهد المكي قبل الهجرة", "datePrecision": "disputed",
        "sourceRefs": [{"volume": 2, "startPage": 93, "endPage": 121}],
        "quranQuotes": ["q-isra-opening", "q-najm-prostration"],
        "hadithQuotes": ["h-isra-buraq"],
        "disputes": ["disp-isra-timing-body"],
        "characters": ["abu-bakr-al-siddiq"],
        "places": ["makkah", "bayt-al-maqdis"],
        "sources": ["src-quran", "src-bukhari", "src-muslim", "src-ahmad", "src-ibn-kathir"],
        "scenePlan": [
            "على البراق من المسجد الحرام إلى بيت المقدس وإمامة النبي ﷺ لإخوانه الأنبياء",
            "العروج في السموات العلا إلى سدرة المنتهى وهدية الصلوات الخمس للأمة",
            "امتحان الإيمان صبيحة الإسراء بمكة ووصف بيت المقدس وموقف أبي بكر الصديق",
        ],
    },
    {
        "id": "ch-17", "sectionId": "sec-04", "order": 17,
        "title": "أنصار الله: بيعتا العقبة وميلاد وطن النصرة",
        "subtitle": "نداء المواسم وبذرة الإيمان في يثرب وسفارة مصعب بن عمير والبيعة الكبرى",
        "periodLabel": "المواسم الثلاثة قبل الهجرة (11 – 13 للبعثة)", "datePrecision": "exact",
        "sourceRefs": [{"volume": 2, "startPage": 155, "endPage": 212}],
        "quranQuotes": [],
        "hadithQuotes": ["h-aqabah-first"],
        "disputes": [],
        "characters": [
            "asad-ibn-zurarah", "musab-ibn-umayr", "sad-ibn-muadh",
            "sad-ibn-ubadah", "nusaybah-bint-kab", "muadh-ibn-jabal", "al-abbas-ibn-abd-al-muttalib",
        ],
        "places": ["makkah", "aqabah", "madinah-masjid"],
        "sources": ["src-bukhari", "src-muslim", "src-ahmad", "src-ibn-ishaq", "src-ibn-kathir"],
        "scenePlan": [
            "عرض الدعوة على قبائل العرب ثم لقاء النفر الستة من الخزرج عند العقبة",
            "بيعة العقبة الأولى ومصعب بن عمير في يثرب وإسلام سعد بن معاذ وأسيد بن حضير",
            "ليل العقبة الثانية: ثلاثة وسبعون رجلاً وامرأتان يبايعون على النصرة والدم",
        ],
    },
    # SEC 05
    {
        "id": "ch-18", "sectionId": "sec-05", "order": 18,
        "title": "طلائع المهاجرين ومكر دار الندوة",
        "subtitle": "مفارقة الأوطان والأموال واجتماع قريش على القتل وفداء علي على الفراش",
        "periodLabel": "أواخر السنة الثالثة عشرة للبعثة", "datePrecision": "exact",
        "sourceRefs": [{"volume": 2, "startPage": 213, "endPage": 238}],
        "quranQuotes": ["q-anfal-plot"],
        "hadithQuotes": [],
        "disputes": [],
        "characters": ["umar-ibn-al-khattab", "umm-salamah", "abu-bakr-al-siddiq", "ali-ibn-abi-talib"],
        "places": ["makkah", "madinah-masjid"],
        "sources": ["src-quran", "src-bukhari", "src-ahmad", "src-ibn-ishaq", "src-ibn-kathir"],
        "scenePlan": [
            "قوافل التضحية: صهيب الرومي وأم سلمة وأبو سلمة وعمر بن الخطاب في طريق الهجرة",
            "«الصحبة يا رسول الله»: دموع الفرح في دار أبي بكر ومؤامرة السيوف المجتمعة في دار الندوة",
            "خروج النبي ﷺ من بين المحاصرين ومبيت علي بن أبي طالب لأداء الودائع والأمانات",
        ],
    },
    {
        "id": "ch-19", "sectionId": "sec-05", "order": 19,
        "title": "في غار ثور وعلى طريق الهجرة",
        "subtitle": "«ما ظنك باثنين الله ثالثهما» ومطاردة سراقة بن مالك والوصول إلى قباء",
        "periodLabel": "صفر – ربيع الأول، السنة الأولى للهجرة", "datePrecision": "approximate",
        "sourceRefs": [{"volume": 2, "startPage": 239, "endPage": 266}],
        "quranQuotes": ["q-tawbah-cave", "q-tawbah-quba"],
        "hadithQuotes": ["h-hijrah-two-companions"],
        "disputes": ["disp-hijrah-dates"],
        "characters": ["abu-bakr-al-siddiq", "aishah-bint-abi-bakr", "ali-ibn-abi-talib"],
        "places": ["ghar-thawr", "quba"],
        "sources": ["src-quran", "src-bukhari", "src-muslim", "src-ibn-ishaq", "src-ibn-kathir"],
        "scenePlan": [
            "ثلاث ليالٍ في غار ثور: خوف الصديق وسكينة النبوة وخطة عبد الله وأسماء وعامر بن فهيرة",
            "على طريق الساحل: خيمة أم معبد الخزاعية وغوص قوائم فرس سراقة وبشارة سواري كسرى",
            "ترقّب أهل يثرب على الحرّة وإشراق الركب النبوي في بني عمرو بن عوف بقباء",
        ],
    },
    {
        "id": "ch-20", "sectionId": "sec-05", "order": 20,
        "title": "إشراق المدينة المنورة",
        "subtitle": "بناء المسجد النبوي ودار أبي أيوب والمؤاخاة ووثيقة المدينة",
        "periodLabel": "السنة الأولى للهجرة", "datePrecision": "exact",
        "sourceRefs": [{"volume": 2, "startPage": 267, "endPage": 341}],
        "quranQuotes": ["q-hashr-ansar"],
        "hadithQuotes": ["h-madinah-salam"],
        "disputes": [],
        "characters": [
            "abu-ayyub-al-ansari", "asad-ibn-zurarah", "abd-al-rahman-ibn-awf",
            "bilal-ibn-rabah", "salman-al-farisi", "zubayr-ibn-al-awwam",
        ],
        "places": ["quba", "madinah-masjid"],
        "sources": ["src-quran", "src-bukhari", "src-muslim", "src-tirmidhi", "src-ibn-ishaq", "src-ibn-kathir"],
        "scenePlan": [
            "دعوها فإنها مأمورة: برود الناقة عند مربد الغلامين اليتيمين ونزوله ﷺ في دار أبي أيوب",
            "بناء المسجد النبوي ومشروعية الأذان برؤيا عبد الله بن زيد وصوت بلال الندي",
            "المؤاخاة الفريدة بين المهاجرين والأنصار وكتابة الصحيفة ودعاء النبي ﷺ لبركة المدينة",
        ],
    },
    # SEC 06
    {
        "id": "ch-21", "sectionId": "sec-06", "order": 21,
        "title": "تحويل القبلة وفرض الصيام وطلائع السرايا",
        "subtitle": "استقلال هوية الأمة وبدايات الدفع المأذون به قبل بدر",
        "periodLabel": "السنة الأولى — شعبان 2 هـ", "datePrecision": "exact",
        "sourceRefs": [{"volume": 2, "startPage": 338, "endPage": 379}],
        "quranQuotes": ["q-baqarah-qiblah", "q-baqarah-fasting", "q-hajj-permission"],
        "hadithQuotes": [],
        "disputes": [],
        "characters": ["hamzah-ibn-abd-al-muttalib", "sad-ibn-abi-waqqas"],
        "places": ["madinah-masjid", "abwa", "makkah"],
        "sources": ["src-quran", "src-bukhari", "src-muslim", "src-ibn-ishaq", "src-ibn-kathir"],
        "scenePlan": [
            "تقليب الوجه في السماء واستجابة الله بتحويل القبلة إلى المسجد الحرام وفرض صيام رمضان",
            "الإذن بالقتال وأول البعوث والمغازي: سيف البحر ورابغ والأبواء وبواط والعشيرة",
            "سرية عبد الله بن جحش إلى بطن نخلة وما نزل فيها من القرآن الحاسم",
        ],
    },
    {
        "id": "ch-22", "sectionId": "sec-06", "order": 22,
        "title": "يوم الفرقان: غزوة بدر الكبرى",
        "subtitle": "مشورة المهاجرين والأنصار ومناجاة العريش وتنزل الملائكة في السابع عشر من رمضان",
        "periodLabel": "رمضان، السنة الثانية للهجرة", "datePrecision": "exact",
        "sourceRefs": [{"volume": 2, "startPage": 380, "endPage": 468}],
        "quranQuotes": ["q-anfal-badr-dua", "q-imran-badr-victory", "q-anfal-furqan"],
        "hadithQuotes": ["h-badr-consultation", "h-badr-miqdad", "h-badr-sad-muadh", "h-badr-munajat"],
        "disputes": ["disp-badr-numbers"],
        "characters": [
            "abu-bakr-al-siddiq", "umar-ibn-al-khattab", "ali-ibn-abi-talib",
            "hamzah-ibn-abd-al-muttalib", "sad-ibn-muadh", "sad-ibn-ubadah",
            "musab-ibn-umayr", "bilal-ibn-rabah", "abdullah-ibn-masud", "abd-al-rahman-ibn-awf",
        ],
        "places": ["badr", "madinah-masjid"],
        "sources": ["src-quran", "src-bukhari", "src-muslim", "src-ibn-ishaq", "src-ibn-hisham", "src-ibn-kathir"],
        "scenePlan": [
            "نجاة العير وإصرار أبي جهل على البغي، وموقف المشورة الخالد للمقداد وسعد بن معاذ وسعد بن عبادة",
            "ليلة السكينة والمطر ومناجاة النبي ﷺ الضارعة في العريش وأبو بكر يردّ رداءه",
            "المبارزة والتحام الصفوف وإمداد السماء ومصارع صناديد قريش يوم الفرقان",
        ],
    },
    {
        "id": "ch-23", "sectionId": "sec-06", "order": 23,
        "title": "أصداء بدر في المدينة ومكة والحبشة",
        "subtitle": "البشائر والرفق بالأسرى وفداؤهم بالتعليم وهجرة زينب وبنو قينقاع",
        "periodLabel": "رمضان – ذو الحجة، السنة الثانية للهجرة", "datePrecision": "exact",
        "sourceRefs": [{"volume": 2, "startPage": 469, "endPage": 546}],
        "quranQuotes": [],
        "hadithQuotes": [],
        "disputes": [],
        "characters": ["zayd-ibn-harithah", "abu-bakr-al-siddiq", "umar-ibn-al-khattab", "uthman-ibn-affan", "ashamah-al-najashi"],
        "places": ["badr", "madinah-masjid", "makkah", "habashah"],
        "sources": ["src-bukhari", "src-muslim", "src-ahmad", "src-ibn-ishaq", "src-ibn-kathir"],
        "scenePlan": [
            "بشير النصر إلى المدينة ووفاة رقية بنت رسول الله ﷺ وفرح النجاشي بوقعة بدر",
            "مشورة أسرى بدر ومعاملتهم الكريمة وفداء الفقراء بتعليم أبناء المدينة القراءة والكتابة",
            "قلادة أم المؤمنين خديجة وهجرة زينب بنت رسول الله ﷺ ونقض بني قينقاع للعهد",
        ],
    },
    # SEC 07
    {
        "id": "ch-24", "sectionId": "sec-07", "order": 24,
        "title": "يوم أُحد: من النصر الأول إلى الامتحان العصيب",
        "subtitle": "وصية النبي ﷺ للرماة ومفاجأة الالتفاف وثبات الجبل النبوي وسط المحنة",
        "periodLabel": "شوال، السنة الثالثة للهجرة", "datePrecision": "exact",
        "sourceRefs": [{"volume": 3, "startPage": 3, "endPage": 76}],
        "quranQuotes": ["q-imran-uhud-test", "q-imran-prophet-mercy"],
        "hadithQuotes": ["h-uhud-archers-order", "h-uhud-allahu-ala"],
        "disputes": ["disp-uhud-rumors-abu-sufyan"],
        "characters": [
            "hamzah-ibn-abd-al-muttalib", "musab-ibn-umayr", "talhah-ibn-ubaydillah",
            "sad-ibn-abi-waqqas", "abu-ubaydah-ibn-al-jarrah", "nusaybah-bint-kab",
            "ali-ibn-abi-talib", "abu-bakr-al-siddiq", "umar-ibn-al-khattab",
        ],
        "places": ["uhud", "madinah-masjid"],
        "sources": ["src-quran", "src-bukhari", "src-muslim", "src-ibn-ishaq", "src-ibn-kathir"],
        "scenePlan": [
            "خروج جيش قريش للثأر ومشورة البقاء أو الخروج وانخذال عبد الله بن أبيّ بثلث الجيش",
            "ترتيب الصفوف عند أُحد والوصية الصارمة لعبد الله بن جبير على جبل الرماة وبداية الانتصار",
            "ترك الموقع وإشاعة مقتل النبي ﷺ، وفدائية طلحة وسعد وأبي دجانة وأم عمارة وجراح الوجه الشريف",
        ],
    },
    {
        "id": "ch-25", "sectionId": "sec-07", "order": 25,
        "title": "شهداء أُحد وغزوة حمراء الأسد",
        "subtitle": "وداع حمزة ومصعب وسبعين من الأبرار وخروج الجرحى لاسترداد الهيبة",
        "periodLabel": "شوال، السنة الثالثة للهجرة", "datePrecision": "exact",
        "sourceRefs": [{"volume": 3, "startPage": 77, "endPage": 122}],
        "quranQuotes": ["q-imran-martyrs", "q-imran-hamra-asad"],
        "hadithQuotes": ["h-uhud-musab-shroud"],
        "disputes": [],
        "characters": ["hamzah-ibn-abd-al-muttalib", "musab-ibn-umayr", "fatimah-al-zahra", "ali-ibn-abi-talib", "zubayr-ibn-al-awwam"],
        "places": ["uhud", "madinah-masjid"],
        "sources": ["src-quran", "src-bukhari", "src-muslim", "src-ahmad", "src-ibn-kathir"],
        "scenePlan": [
            "وقوف النبي ﷺ على سيد الشهداء حمزة ونمرة مصعب بن عمير وتقديم الأكثر قرآناً في اللحد",
            "إيمان نساء الأنصار العجيب عند أبواب المدينة ومداواة فاطمة الزهراء لجراح أبيها ﷺ",
            "نداء الغد إلى حمراء الأسد: خروج المثخنين بالجراح وانكفاء جيش أبي سفيان",
        ],
    },
    {
        "id": "ch-26", "sectionId": "sec-07", "order": 26,
        "title": "فاجعة الرجيع وبئر معونة وإجلاء بني النضير",
        "subtitle": "بطولة خبيب وعاصم ونداء «فزت ورب الكعبة» ونزول سورة الحشر",
        "periodLabel": "السنة الرابعة للهجرة", "datePrecision": "exact",
        "sourceRefs": [{"volume": 3, "startPage": 123, "endPage": 176}],
        "quranQuotes": ["q-hashr-banu-nadir"],
        "hadithQuotes": ["h-bir-maunah-haram"],
        "disputes": ["disp-dhat-al-riqa-date"],
        "characters": ["abu-bakr-al-siddiq", "umar-ibn-al-khattab", "ali-ibn-abi-talib"],
        "places": ["bir-maunah", "madinah-masjid"],
        "sources": ["src-quran", "src-bukhari", "src-muslim", "src-ibn-ishaq", "src-bayhaqi", "src-ibn-kathir"],
        "scenePlan": [
            "غدر الرجيع وحماية الدبْر لجسد عاصم بن ثابت وصلاتَا خبيب بن عدي قبل استشهاده بمكة",
            "فاجعة القراء السبعين في بئر معونة وحزن النبي ﷺ وقنوته شهراً",
            "مؤامرة بني النضير لإلقاء الصخرة على النبي ﷺ وإجلاؤهم وغزوة ذات الرقاع وبدر الموعد",
        ],
    },
    # SEC 08
    {
        "id": "ch-27", "sectionId": "sec-08", "order": 27,
        "title": "غزوة الخندق (الأحزاب)",
        "subtitle": "عشرة آلاف محاصر ومشورة سلمان الفارسي وبشارات الفتح من بطن الصخرة",
        "periodLabel": "شوال، السنة الخامسة للهجرة", "datePrecision": "approximate",
        "sourceRefs": [{"volume": 3, "startPage": 177, "endPage": 222}],
        "quranQuotes": ["q-ahzab-trench", "q-ahzab-uswah"],
        "hadithQuotes": ["h-khandaq-chant", "h-khandaq-dua-ahzab"],
        "disputes": ["disp-khandaq-date"],
        "characters": [
            "salman-al-farisi", "ali-ibn-abi-talib", "zubayr-ibn-al-awwam",
            "sad-ibn-muadh", "sad-ibn-ubadah", "umar-ibn-al-khattab",
        ],
        "places": ["khandaq", "madinah-masjid"],
        "sources": ["src-quran", "src-bukhari", "src-muslim", "src-ahmad", "src-ibn-ishaq", "src-ibn-kathir"],
        "scenePlan": [
            "تحزب قريش وغطفان بتحريض حييّ بن أخطب ومشورة سلمان بحفر الخندق والتراب يغطي بطن النبي ﷺ",
            "نقض قريظة للعهد وبلوغ القلوب الحناجر وبطولة علي أمام عمرو بن عبد ود وموقف السعدين في الثمار",
            "تدبير نعيم بن مسعود ودعاء مسجد الأحزاب وهبوب ريح الصبا في الليلة الشاتية ورحيل الأحزاب",
        ],
    },
    {
        "id": "ch-28", "sectionId": "sec-08", "order": 28,
        "title": "غزوة بني قريظة وحكم سعد بن معاذ",
        "subtitle": "وضع السلاح في بيت أم سلمة فقطع الخيانة واهتزاز العرش لموت سعد",
        "periodLabel": "ذو القعدة، السنة الخامسة للهجرة", "datePrecision": "exact",
        "sourceRefs": [{"volume": 3, "startPage": 223, "endPage": 284}],
        "quranQuotes": ["q-ahzab-qurayzah"],
        "hadithQuotes": ["h-qurayzah-hukm"],
        "disputes": [],
        "characters": ["sad-ibn-muadh", "ali-ibn-abi-talib", "aishah-bint-abi-bakr", "umm-salamah"],
        "places": ["madinah-masjid", "khandaq"],
        "sources": ["src-quran", "src-bukhari", "src-muslim", "src-ibn-ishaq", "src-ibn-kathir"],
        "scenePlan": [
            "«أوقد وضعت السلاح يا رسول الله؟»: لا يصلينّ أحد العصر إلا في بني قريظة",
            "نزول قريظة على حكم سعد بن معاذ رضي الله عنه وحكمه العادل الفاصل",
            "انفجار جرح سعد بن معاذ استجابة لدعائه ووفاته الشريفة وتشييع الملائكة له",
        ],
    },
    # SEC 09
    {
        "id": "ch-29", "sectionId": "sec-09", "order": 29,
        "title": "غزوة بني المصطلق وحديث الإفك",
        "subtitle": "وأد الفتنة القبلية ومحنة البيت النبوي وبراءة الصديقة بقرآن يتلى",
        "periodLabel": "شعبان، السنة السادسة للهجرة (وقيل الخامسة)", "datePrecision": "disputed",
        "sourceRefs": [{"volume": 3, "startPage": 285, "endPage": 311}],
        "quranQuotes": ["q-nur-ifk"],
        "hadithQuotes": [],
        "disputes": ["disp-banu-mustaliq-date"],
        "characters": ["aishah-bint-abi-bakr", "abu-bakr-al-siddiq", "umar-ibn-al-khattab", "ali-ibn-abi-talib", "sad-ibn-muadh"],
        "places": ["madinah-masjid"],
        "sources": ["src-quran", "src-bukhari", "src-muslim", "src-ibn-ishaq", "src-ibn-kathir"],
        "scenePlan": [
            "وقعة المريسيع وإخماد النبي ﷺ لنعرة الجاهلية ومقولة ابن أبيّ الخبيثة وحكمة المسير المتواصل",
            "شهر الدموع والابتلاء: انقطاع عقد عائشة وافتراء أهل الإفك وثبات البيت النبوي وبيت الصديق",
            "«أبشري يا عائشة، أما الله فقد برّأك»: نزول آيات سورة النور وعفو أبي بكر عن مسطح",
        ],
    },
    {
        "id": "ch-30", "sectionId": "sec-09", "order": 30,
        "title": "بيعة الرضوان وصلح الحديبية",
        "subtitle": "بروك القصواء والبيعة تحت الشجرة وحكمة أم سلمة وسورة الفتح المبين",
        "periodLabel": "ذو القعدة، السنة السادسة للهجرة", "datePrecision": "exact",
        "sourceRefs": [{"volume": 3, "startPage": 312, "endPage": 343}],
        "quranQuotes": ["q-fath-opening", "q-fath-ridwan"],
        "hadithQuotes": ["h-hudaybiyyah-camel"],
        "disputes": [],
        "characters": ["uthman-ibn-affan", "umar-ibn-al-khattab", "abu-bakr-al-siddiq", "ali-ibn-abi-talib", "umm-salamah"],
        "places": ["hudaybiyyah", "makkah"],
        "sources": ["src-quran", "src-bukhari", "src-muslim", "src-ahmad", "src-ibn-kathir"],
        "scenePlan": [
            "الخروج معتمراً لا يريد قتالاً وبروك القصواء وسفارة عثمان بن عفان وبيعة الرضوان تحت الشجرة",
            "كتابة شروط الصلح مع سهيل بن عمرو ومراجعة عمر بن الخطاب وتطابق جواب النبي ﷺ وجواب أبي بكر",
            "مشورة أم المؤمنين أم سلمة الملهمة في التحلل ونزول ﴿إنا فتحنا لك فتحا مبينا﴾ في طريق العودة",
        ],
    },
    {
        "id": "ch-31", "sectionId": "sec-09", "order": 31,
        "title": "رسائل النبي ﷺ إلى الملوك وفتح خيبر وعمرة القضاء",
        "subtitle": "كتب الدعوة العالمية وحوار هرقل وأبي سفيان وراية علي وقدوم جعفر",
        "periodLabel": "أواخر السنة السادسة — ذو القعدة 7 هـ", "datePrecision": "exact",
        "sourceRefs": [{"volume": 3, "startPage": 344, "endPage": 454}, {"volume": 3, "startPage": 494, "endPage": 515}],
        "quranQuotes": ["q-imran-letters"],
        "hadithQuotes": ["h-khaybar-ali-banner"],
        "disputes": [],
        "characters": ["ali-ibn-abi-talib", "jafar-ibn-abi-talib", "ashamah-al-najashi", "khalid-ibn-al-walid"],
        "places": ["khaybar", "makkah", "madinah-masjid", "habashah"],
        "sources": ["src-quran", "src-bukhari", "src-muslim", "src-ibn-ishaq", "src-bayhaqi", "src-ibn-kathir"],
        "scenePlan": [
            "رسل النبي ﷺ إلى هرقل وكسرى والمقوقس والنجاشي، وشهادة أبي سفيان المذهلة في بلاط قيصر",
            "المسير إلى حصون خيبر وإعطاء الراية لعلي بن أبي طالب وفرحة اللقاء بقدوم جعفر ومهاجري الحبشة",
            "معجزة الشاة المسمومة وعمرة القضاء في العام السابع وإسلام خالد بن الوليد وعمرو بن العاص",
        ],
    },
    {
        "id": "ch-32", "sectionId": "sec-09", "order": 32,
        "title": "يوم مؤتة على مشارف الشام",
        "subtitle": "ثلاثة آلاف أمام جحافل الروم واستشهاد الأمراء الثلاثة وانسحاب خالد العبقري",
        "periodLabel": "جمادى الأولى، السنة الثامنة للهجرة", "datePrecision": "exact",
        "sourceRefs": [{"volume": 3, "startPage": 455, "endPage": 493}, {"volume": 3, "startPage": 516, "endPage": 525}],
        "quranQuotes": [],
        "hadithQuotes": ["h-mutah-khalid", "h-ashamah-prayer"],
        "disputes": [],
        "characters": ["zayd-ibn-harithah", "jafar-ibn-abi-talib", "khalid-ibn-al-walid"],
        "places": ["mutah", "madinah-masjid"],
        "sources": ["src-bukhari", "src-ibn-ishaq", "src-bayhaqi", "src-ibn-kathir"],
        "scenePlan": [
            "مقتل السفير الحارث بن عمير الأزدي وتجهيز جيش مؤتة بوصايا الرحمة النبوية وترتيب الأمراء الثلاثة",
            "ملحمة الراية الخالدة: استشهاد زيد فجعفر الطيار فعبد الله بن رواحة ودموع النبي ﷺ وهو ينعاهم بالمدينة",
            "راية سيف الله المسلول خالد بن الوليد وإنقاذ الجيش وسرية ذات السلاسل وصلاة الغائب على النجاشي",
        ],
    },
    # SEC 10
    {
        "id": "ch-33", "sectionId": "sec-10", "order": 33,
        "title": "الفتح الأعظم: دخول مكة والعفو العام",
        "subtitle": "تواضع الفاتح على راحلته وتطهير الكعبة من الأصنام و«اذهبوا فأنتم الطلقاء»",
        "periodLabel": "رمضان، السنة الثامنة للهجرة", "datePrecision": "exact",
        "sourceRefs": [{"volume": 3, "startPage": 526, "endPage": 609}],
        "quranQuotes": ["q-isra-truth-came", "q-nasr-surah"],
        "hadithQuotes": ["h-fath-tulaqa"],
        "disputes": ["disp-fath-makkah-force-peace"],
        "characters": [
            "abu-bakr-al-siddiq", "umar-ibn-al-khattab", "ali-ibn-abi-talib",
            "al-abbas-ibn-abd-al-muttalib", "khalid-ibn-al-walid", "zubayr-ibn-al-awwam", "bilal-ibn-rabah",
        ],
        "places": ["mar-al-zahran", "makkah"],
        "sources": ["src-quran", "src-bukhari", "src-muslim", "src-ahmad", "src-ibn-ishaq", "src-ibn-kathir"],
        "scenePlan": [
            "غدر بني بكر بخزاعة وكتاب حاطب بن أبي بلتعة وعشرة آلاف شعلة تضيء ليل مرّ الظهران وإسلام أبي سفيان",
            "دخول مكة مطأطئاً رأسه تواضعاً لله وتأمين الدور وتطهير البيت العتيق من ثلاثمائة وستين صنماً",
            "أذان بلال فوق الكعبة وردّ المفتاح لعثمان بن طلحة والعفو النبوي الأعظم عن قريش وإسلام أبي قحافة",
        ],
    },
    {
        "id": "ch-34", "sectionId": "sec-10", "order": 34,
        "title": "يوم حنين وحصار الطائف ووفاء الأنصار بالجعرانة",
        "subtitle": "درس الكثرة وثبات النبي ﷺ على بغلته البيضاء ودموع الأنصار تحت القبة",
        "periodLabel": "شوال – ذو القعدة، السنة الثامنة للهجرة", "datePrecision": "exact",
        "sourceRefs": [{"volume": 3, "startPage": 610, "endPage": 712}],
        "quranQuotes": ["q-tawbah-hunayn"],
        "hadithQuotes": ["h-hunayn-prophecy", "h-hunayn-ansar"],
        "disputes": [],
        "characters": ["al-abbas-ibn-abd-al-muttalib", "abu-bakr-al-siddiq", "ali-ibn-abi-talib", "sad-ibn-ubadah"],
        "places": ["hunayn-jiiranah", "taif", "madinah-masjid"],
        "sources": ["src-quran", "src-bukhari", "src-muslim", "src-ibn-ishaq", "src-ibn-kathir"],
        "scenePlan": [
            "كمين هوازن وثقيف في غبش وادي حنين وثبات النبي ﷺ وحده ينادي «أنا النبي لا كذب» ونداء العباس",
            "غزوة أوطاس وحصار الطائف وردّ السبي إكراماً للشيماء أخته ﷺ من الرضاعة وإسلام مالك بن عوف",
            "تأليف القلوب بالجعرانة واللقاء الخالد مع الأنصار: «ألا ترضون أن ترجعوا برسول الله إلى رحالكم؟»",
        ],
    },
    # SEC 11
    {
        "id": "ch-35", "sectionId": "sec-11", "order": 35,
        "title": "غزوة تبوك (جيش العسرة) وتوبة الثلاثة",
        "subtitle": "سباق الإنفاق في القيظ والرحيل إلى تخوم الشام وصدق كعب بن مالك وصاحبيه",
        "periodLabel": "رجب – ذو الحجة، السنة التاسعة للهجرة", "datePrecision": "exact",
        "sourceRefs": [{"volume": 4, "startPage": 3, "endPage": 75}],
        "quranQuotes": ["q-tawbah-tabuk"],
        "hadithQuotes": ["h-tabuk-ali-harun"],
        "disputes": [],
        "characters": ["uthman-ibn-affan", "abu-bakr-al-siddiq", "umar-ibn-al-khattab", "ali-ibn-abi-talib", "abd-al-rahman-ibn-awf"],
        "places": ["tabuk", "madinah-masjid", "makkah"],
        "sources": ["src-quran", "src-bukhari", "src-muslim", "src-ahmad", "src-ibn-kathir"],
        "scenePlan": [
            "الامتحان الصعب في الحر وطيب الثمار، وسباق الصديق والفاروق وعثمان ذي النورين ودموع البكّائين",
            "المسير عبر الحِجر إلى تبوك وهيبة الروم ومصالحة أيلة ودومة الجندل وهدم مسجد الضرار",
            "خمسون ليلة من الصدق المرّ ثم بشارة السماء بتوبة الله على الثلاثة الذين خُلّفوا وحج أبي بكر ببراءة",
        ],
    },
    {
        "id": "ch-36", "sectionId": "sec-11", "order": 36,
        "title": "عام الوفود ودخول العرب في دين الله أفواجاً",
        "subtitle": "وفود ثقيف وتميم ونجران وعبد القيس وطيئ وبعوث القضاة والمعلمين إلى اليمن",
        "periodLabel": "السنة التاسعة — العاشرة للهجرة", "datePrecision": "exact",
        "sourceRefs": [{"volume": 4, "startPage": 76, "endPage": 210}],
        "quranQuotes": ["q-nasr-surah"],
        "hadithQuotes": [],
        "disputes": [],
        "characters": ["abu-ubaydah-ibn-al-jarrah", "ali-ibn-abi-talib", "khalid-ibn-al-walid", "muadh-ibn-jabal"],
        "places": ["madinah-masjid"],
        "sources": ["src-quran", "src-bukhari", "src-muslim", "src-ibn-ishaq", "src-bayhaqi", "src-ibn-kathir"],
        "scenePlan": [
            "إسلام ثقيف طوعاً بعد امتناع، ووفود بني تميم وعبد القيس وسؤال ضمام بن ثعلبة الصريح",
            "كرم النبوة مع عدي بن حاتم الطائي، ومحاورة وفد نصارى نجران وبعث أمين الأمة أبي عبيدة معهم",
            "توحّد الجزيرة على الإسلام ووصية النبي ﷺ لمعاذ بن جبل وأبي موسى الأشعري وعليّ في اليمن",
        ],
    },
    {
        "id": "ch-37", "sectionId": "sec-11", "order": 37,
        "title": "حجة الوداع: البلاغ الأعظم وإكمال الدين",
        "subtitle": "مائة ألف حاج في صعيد عرفات ومنى وميثاق حرمة الدماء وحقوق النساء والإخاء",
        "periodLabel": "ذو القعدة – ذو الحجة، السنة العاشرة للهجرة", "datePrecision": "exact",
        "sourceRefs": [{"volume": 4, "startPage": 211, "endPage": 426}],
        "quranQuotes": ["q-maidah-perfection"],
        "hadithQuotes": ["h-farewell-sanctity", "h-farewell-book-allah", "h-farewell-women-trust"],
        "disputes": ["disp-farewell-ihram", "disp-ghadir-khumm"],
        "characters": ["abu-bakr-al-siddiq", "umar-ibn-al-khattab", "ali-ibn-abi-talib", "aishah-bint-abi-bakr", "fatimah-al-zahra", "bilal-ibn-rabah"],
        "places": ["makkah", "arafat-mina", "madinah-masjid"],
        "sources": ["src-quran", "src-muslim", "src-bukhari", "src-ahmad", "src-abu-dawud", "src-ibn-kathir"],
        "scenePlan": [
            "خروج النبي ﷺ لحجته الوحيدة وتلبيته الخاشعة ودخول مكة وبيان المناسك لأمته: «لتأخذوا مناسككم»",
            "يوم عرفة الأعظم: خطبة بطن الوادي الجامعة ونزول ﴿اليوم أكملت لكم دينكم﴾ وبكاء عمر",
            "المبيت بمزدلفة وخطبة منى في أيام التشريق وماء خُمّ والعودة الأخيرة إلى المدينة المنورة",
        ],
    },
    # SEC 12
    {
        "id": "ch-38", "sectionId": "sec-12", "order": 38,
        "title": "الرحيل إلى الرفيق الأعلى وثبات الصديق",
        "subtitle": "إشارات التوديع وإمامة أبي بكر وضحى الاثنين في حجرة عائشة وكلمة الصديق الفاصلة",
        "periodLabel": "صفر – ربيع الأول، السنة الحادية عشرة للهجرة", "datePrecision": "exact",
        "sourceRefs": [{"volume": 4, "startPage": 427, "endPage": 504}],
        "quranQuotes": ["q-zumar-mortality", "q-imran-muhammad-messenger"],
        "hadithQuotes": ["h-illness-abu-bakr-imam", "h-rafiq-al-ala", "h-siddiq-steadfast"],
        "disputes": ["disp-wafat-day-number"],
        "characters": [
            "abu-bakr-al-siddiq", "umar-ibn-al-khattab", "aishah-bint-abi-bakr",
            "fatimah-al-zahra", "ali-ibn-abi-talib", "al-abbas-ibn-abd-al-muttalib",
        ],
        "places": ["madinah-masjid", "hujrat-aishah"],
        "sources": ["src-quran", "src-bukhari", "src-muslim", "src-ahmad", "src-ibn-kathir"],
        "scenePlan": [
            "استغفار البقيع وتجهيز جيش أسامة بن زيد وبداية شكوى النبي ﷺ واستئذانه أن يُمرّض في بيت عائشة",
            "«مروا أبا بكر فليصلّ بالناس» وسراره لفاطمة الزهراء وإطلالته المشرقة الأخيرة على صفوف المصلين",
            "«بل الرفيق الأعلى» ضحى الاثنين، وذهول عمر، وتقبيل الصديق للجبين الطاهر وخطبته التي ثبتت الأمة",
        ],
    },
    {
        "id": "ch-39", "sectionId": "sec-12", "order": 39,
        "title": "الغسل والدفن الشريف وميراث النبوة",
        "subtitle": "السقيفة ووحدة الكلمة والتغسيل والصلاة فرادى والمرقد الطاهر في حجرة عائشة",
        "periodLabel": "ربيع الأول، السنة الحادية عشرة للهجرة", "datePrecision": "exact",
        "sourceRefs": [{"volume": 4, "startPage": 505, "endPage": 578}],
        "quranQuotes": [],
        "hadithQuotes": ["h-prophets-inheritance"],
        "disputes": [],
        "characters": [
            "abu-bakr-al-siddiq", "umar-ibn-al-khattab", "abu-ubaydah-ibn-al-jarrah",
            "sad-ibn-ubadah", "ali-ibn-abi-talib", "al-abbas-ibn-abd-al-muttalib",
            "aishah-bint-abi-bakr", "fatimah-al-zahra",
        ],
        "places": ["hujrat-aishah", "madinah-masjid"],
        "sources": ["src-bukhari", "src-muslim", "src-ahmad", "src-ibn-ishaq", "src-ibn-kathir"],
        "scenePlan": [
            "حفظ وحدة الأمة في سقيفة بني ساعدة واجتماع المهاجرين والأنصار على بيعة أبي بكر الصديق",
            "غسل الجسد الشريف في قميصه وصلاة المسلمين عليه أفواجاً فرادى بلا إمام ودفنه حيث قُبض",
            "حزن الصحابة ودرعه المرهونة وبيان «لا نورث، ما تركناه صدقة»: ميراث العلم والهدى للعالمين",
        ],
    },
    {
        "id": "ch-40", "sectionId": "sec-12", "order": 40,
        "title": "البيت النبوي الطاهر وشمائله ﷺ الخالدة",
        "subtitle": "أمهات المؤمنين وأولاده وكتّاب الوحي وخلقه العظيم ورحمته وهيبته الشريفة",
        "periodLabel": "الصورة الجامعة لحياة النبي ﷺ وإرثه الخالد", "datePrecision": "exact",
        "sourceRefs": [{"volume": 4, "startPage": 579, "endPage": 717}],
        "quranQuotes": ["q-qalam-character", "q-tawbah-compassion", "q-ahzab-salawat"],
        "hadithQuotes": [],
        "disputes": [],
        "characters": [
            "khadijah-bint-khuwaylid", "aishah-bint-abi-bakr", "umm-salamah",
            "fatimah-al-zahra", "zayd-ibn-harithah", "ali-ibn-abi-talib", "bilal-ibn-rabah",
        ],
        "places": ["madinah-masjid", "hujrat-aishah"],
        "sources": ["src-quran", "src-bukhari", "src-muslim", "src-tirmidhi", "src-ibn-sad", "src-ibn-kathir"],
        "scenePlan": [
            "بيوت النور والبساطة: أمهات المؤمنين وأولاده ﷺ ومحبّته للسبطين الحسن والحسين",
            "كتّاب الوحي ورسله ومواليه وخدمه الذين شهدوا بتواضعه وحلمه في بيته عشر سنين",
            "الشمائل المحمدية الجامعة: صفته الخَلقية والخُلُقية وآثاره الشريفة ودوام الصلاة والسلام عليه ﷺ",
        ],
    },
]


def main() -> None:
    chars_cat = json.loads((RESEARCH / "characters" / "characters_catalog.json").read_text(encoding="utf-8"))["characters"]
    q_quotes = {q["quoteId"]: q for q in json.loads((RESEARCH / "quotations" / "quran_quotations.json").read_text(encoding="utf-8"))["quotations"]}
    h_quotes = {h["quoteId"]: h for h in json.loads((RESEARCH / "quotations" / "hadith_and_athar_quotations.json").read_text(encoding="utf-8"))["quotations"]}
    disputes = {d["disputeId"]: d for d in json.loads((RESEARCH / "conflicts_and_uncertainties" / "historical_disputes_register.json").read_text(encoding="utf-8"))["disputes"]}
    sources = {s["id"]: s for s in json.loads((RESEARCH / "source_references" / "classical_sources_registry.json").read_text(encoding="utf-8"))["sources"]}
    places = {p["id"]: p for p in json.loads((RESEARCH / "chronology" / "places_catalog.json").read_text(encoding="utf-8"))["places"]}
    char_ids = {c["id"] for c in chars_cat}

    # Validate referential integrity of every chapter spec
    chapters_out = []
    char_to_chapters: dict[str, list[str]] = {c["id"]: [] for c in chars_cat}

    for idx, ch in enumerate(CHAPTERS_SPEC):
        assert ch["order"] == idx + 1, f"Order mismatch on {ch['id']}"
        for qid in ch["quranQuotes"]:
            assert qid in q_quotes, f"Unknown quran quote {qid} in {ch['id']}"
        for hid in ch["hadithQuotes"]:
            assert hid in h_quotes, f"Unknown hadith quote {hid} in {ch['id']}"
        for did in ch["disputes"]:
            assert did in disputes, f"Unknown dispute {did} in {ch['id']}"
        for cid in ch["characters"]:
            assert cid in char_ids, f"Unknown character {cid} in {ch['id']}"
            char_to_chapters[cid].append(ch["id"])
        for pid in ch["places"]:
            assert pid in places, f"Unknown place {pid} in {ch['id']}"
        for sid in ch["sources"]:
            assert sid in sources, f"Unknown source {sid} in {ch['id']}"

        prev_id = CHAPTERS_SPEC[idx - 1]["id"] if idx > 0 else None
        next_id = CHAPTERS_SPEC[idx + 1]["id"] if idx < len(CHAPTERS_SPEC) - 1 else None
        chapters_out.append({
            **ch,
            "previousChapterId": prev_id,
            "nextChapterId": next_id,
        })

    # Ensure every one of the 32 characters is linked to at least 1 chapter bidirectionally
    for c in chars_cat:
        if not char_to_chapters[c["id"]]:
            raise AssertionError(f"Character {c['id']} has zero linked chapters!")

    blueprint = {
        "schemaVersion": 1,
        "bookVersion": "3.0.0",
        "title": "السيرة النبوية الشريفة — الحكاية التاريخية الكاملة الموثقة",
        "subtitle": "سرد تاريخي عربي متصل من إرث الخليل ومكة قبل البعثة إلى حجة الوداع والرفيق الأعلى والشمائل النبوية",
        "primaryResearchSource": "السيرة النبوية للإمام الحافظ ابن كثير الدمشقي (ت 774 هـ) — الأجزاء الأربعة الكاملة",
        "totalEras": len(ERAS),
        "totalSections": len(SECTIONS),
        "totalChapters": len(chapters_out),
        "totalPlannedScenes": sum(len(c["scenePlan"]) for c in chapters_out),
        "eras": ERAS,
        "sections": SECTIONS,
        "chapters": chapters_out,
    }
    (RESEARCH / "chronology" / "seerah_book_blueprint.json").write_text(
        json.dumps(blueprint, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    # Build Character Journeys Blueprint (32 historically significant personalities)
    char_journeys = []
    ch_map = {c["id"]: c for c in chapters_out}
    for order_idx, c in enumerate(chars_cat, start=1):
        linked_ch_ids = char_to_chapters[c["id"]]
        char_journeys.append({
            "id": c["id"],
            "order": order_idx,
            "name": c["name"],
            "epithet": c["epithet"],
            "category": c["category"],
            "summary": c["summary"],
            "totalEncyclopediaMentions": c["totalMentions"],
            "encyclopediaPagesCount": c["pagesCount"],
            "firstEncyclopediaAppearance": c["firstAppearance"],
            "linkedChapterIds": linked_ch_ids,
            "linkedChapterTitles": [
                {"chapterId": cid, "order": ch_map[cid]["order"], "title": ch_map[cid]["title"]}
                for cid in linked_ch_ids
            ],
        })

    (RESEARCH / "characters" / "character_journeys_blueprint.json").write_text(
        json.dumps(
            {
                "schemaVersion": 1,
                "totalCharacters": len(char_journeys),
                "characters": char_journeys,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    print(
        f"[Phase 2 DONE] Eras={len(ERAS)}, Sections={len(SECTIONS)}, Chapters={len(chapters_out)}, "
        f"Scenes={sum(len(c['scenePlan']) for c in chapters_out)}, Characters={len(char_journeys)} "
        f"(100% bidirectionally linked)"
    )


if __name__ == "__main__":
    main()
