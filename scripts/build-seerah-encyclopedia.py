#!/usr/bin/env python3
"""
WIRD Seerah Encyclopedia Builder
--------------------------------
Builds the chunked, offline-first JSON corpus for:
  «السيرة النبوية» للإمام الحافظ عماد الدين أبي الفداء إسماعيل بن عمر بن كثير (ت 774 هـ)
matching page-for-page the 4-volume printed edition in seerah-sources/:
  - Vol 1: 01_10169_compressed.pdf (pp. 1–508)
  - Vol 2: 02_10170_compressed.pdf (pp. 3–546)
  - Vol 3: 03_10171_compressed.pdf (pp. 3–712)
  - Vol 4: 04_10172_compressed.pdf (pp. 3–717)

Source text: OpenITI verified UTF-8 transcription (0774IbnKathir.Bidaya.Shamela0000930-ara6),
strictly starting at Ibn Kathir's classical matn («ذكر أخبار العرب», Vol 1 p. 1) and excluding
the modern 1964 editor preface.
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = PROJECT_ROOT / "public" / "data" / "seerah-encyclopedia"
CHUNKS_DIR = OUTPUT_DIR / "chunks"
SEARCH_DIR = OUTPUT_DIR / "search"

DEFAULT_SOURCE_CANDIDATES = [
    Path(os.environ.get("SEERAH_OPENITI_SOURCE", "")) if os.environ.get("SEERAH_OPENITI_SOURCE") else None,
    Path(r"C:\Users\zvjvb\.gemini\antigravity\brain\245f5f5d-eb39-4bc2-9777-6e4de81b734c\scratch\0774IbnKathir.Bidaya.Shamela0000930-ara6.txt"),
]

PAGES_PER_CHUNK = 25

VOLUME_METADATA: dict[int, dict[str, Any]] = {
    1: {
        "volume": 1,
        "title": "المجلد الأول: أخبار العرب والمولد والبعثة والدعوة بمكة",
        "shortTitle": "المجلد الأول",
        "periodLabel": "ما قبل البعثة — السنة الخامسة للبعثة",
        "summary": "أخبار العرب العاربة والمستعربة، قصة الفيل، نسب النبي ﷺ الشريف، مولده ورضاعه ونشأته، تجديد بناء الكعبة، بدء الوحي في حراء، والجهر بالدعوة ومجادلة قريش.",
        "sourcePdfName": "01_10169_compressed.pdf",
        "sourcePdfTotalPages": 536,
    },
    2: {
        "volume": 2,
        "title": "المجلد الثاني: الهجرة إلى الحبشة والإسراء والهجرة النبوية وغزوة بدر",
        "shortTitle": "المجلد الثاني",
        "periodLabel": "الهجرة إلى الحبشة — نهاية السنة الثانية للهجرة",
        "summary": "الهجرة إلى الحبشة، حصار الشعب، الإسراء والمعراج، وفاة أبي طالب وخديجة، الرحلة إلى الطائف، إسلام الأنصار وبيعتا العقبة، الهجرة النبوية وبناء المدينة، وغزوة بدر الكبرى.",
        "sourcePdfName": "02_10170_compressed.pdf",
        "sourcePdfTotalPages": 564,
    },
    3: {
        "volume": 3,
        "title": "المجلد الثالث: من غزوة أحد إلى الخندق والحديبية وخيبر وفتح مكة وحنين",
        "shortTitle": "المجلد الثالث",
        "periodLabel": "السنة الثالثة — نهاية السنة الثامنة للهجرة",
        "summary": "أحداث السنوات 3 إلى 8 هـ: غزوة أحد، بئر معونة، بني النضير، الخندق وبني قريظة، صلح الحديبية، فتح خيبر، عمرة القضاء، غزوة مؤتة، كتب النبي ﷺ إلى الملوك، فتح مكة الأعظم، حنين والطائف.",
        "sourcePdfName": "03_10171_compressed.pdf",
        "sourcePdfTotalPages": 732,
    },
    4: {
        "volume": 4,
        "title": "المجلد الرابع: غزوة تبوك والوفود وحجة الوداع ووفاته ﷺ وأزواجه وآثاره",
        "shortTitle": "المجلد الرابع",
        "periodLabel": "السنة التاسعة — السنة الحادية عشرة للهجرة والآثار الشريفة",
        "summary": "غزوة تبوك، حج أبي بكر ونزول براءة، عام الوفود، بعث اليمن، كتاب حجة الوداع الكامل، مرض النبي ﷺ ووفاته إلى الرفيق الأعلى، أزواجه وأولاده وخدمه وكتابه وآثاره الشريفة.",
        "sourcePdfName": "04_10172_compressed.pdf",
        "sourcePdfTotalPages": 734,
    },
}

# Curated canonical anchors ensuring major landmarks without explicit ### markers are cleanly indexed
CURATED_ANCHORS: dict[tuple[int, int], tuple[str, str]] = {
    # Volume 1
    (1, 1): ("ذكر أخبار العرب وأنسابهم", "ما قبل البعثة"),
    (1, 27): ("خروج الملك باليمن من حمير إلى الحبشة", "ما قبل البعثة"),
    (1, 29): ("قصة أبرهة الأشرم وحادثة الفيل", "عام الفيل"),
    (1, 42): ("خروج الملك عن الحبشة ورجوعه إلى سيف بن ذي يزن", "ما قبل البعثة"),
    (1, 56): ("باب ذكر بني إسماعيل وهم عرب الحجاز", "ما قبل البعثة"),
    (1, 82): ("أصول أنساب قبائل عرب الحجاز إلى عدنان", "ما قبل البعثة"),
    (1, 104): ("أحداث الجاهلية ومشاهير العرب قبل الإسلام", "ما قبل البعثة"),
    (1, 153): ("ذكر زيد بن عمرو بن نفيل وأخبار الحنفاء", "ما قبل البعثة"),
    (1, 166): ("حفر زمزم ونذر عبد المطلب وتزويج عبد الله", "ما قبل البعثة"),
    (1, 181): ("كتاب سيرة رسول الله ﷺ ونسبه الشريف", "النسب الشريف"),
    (1, 198): ("باب مولد رسول الله ﷺ والآيات ليلة مولده", "المولد النبوي"),
    (1, 223): ("حواضنه ومراضعه ﷺ ورضاعه من حليمة السعدية", "الطفولة والرضاعة"),
    (1, 250): ("منشؤه ﷺ وحرب الفجار وحلف الفضول", "الشباب"),
    (1, 262): ("تزويجه ﷺ خديجة بنت خويلد رضي الله عنها", "الشباب"),
    (1, 270): ("تجديد قريش بناء الكعبة قبل المبعث بخمس سنين", "الشباب"),
    (1, 286): ("كتاب مبعث رسول الله ﷺ والبشارات بنبوته", "البشارات والبعثة"),
    (1, 341): ("باب هواتف الجان وإرهاصات النبوة", "البشارات والبعثة"),
    (1, 385): ("باب كيفية بدء الوحي وعمره ﷺ وقت بعثته", "بدء الوحي"),
    (1, 415): ("منع الشياطين من استراق السمع وكيفية إتيان الوحي", "بدء الوحي"),
    (1, 445): ("إسلام السابقين: حمزة وأبي ذر وضماد رضي الله عنهم", "الدعوة السرية"),
    (1, 455): ("أمر الله رسوله ﷺ بإبلاغ الرسالة والجهر بالدعوة", "الجهر بالدعوة"),
    (1, 472): ("تأليب الملأ من قريش وموقف أبي طالب", "الجهر بالدعوة"),
    (1, 498): ("باب مجادلة المشركين رسول الله ﷺ", "الدعوة بمكة"),
    # Volume 2
    (2, 3): ("باب هجرة الصحابة من مكة إلى أرض الحبشة", "الهجرة إلى الحبشة"),
    (2, 32): ("إسلام عمر بن الخطاب رضي الله عنه", "الدعوة بمكة"),
    (2, 43): ("الصحيفة وحصار بني هاشم في شعب أبي طالب", "حصار الشعب"),
    (2, 63): ("عزم أبي بكر الصديق على الهجرة ونقض الصحيفة", "حصار الشعب"),
    (2, 93): ("فصل في الإسراء والمعراج وما رأى ﷺ من الآيات", "الإسراء والمعراج"),
    (2, 122): ("وفاة أبي طالب ثم أم المؤمنين خديجة رضي الله عنها", "عام الحزن"),
    (2, 139): ("تزويجه ﷺ سودة وعائشة رضي الله عنهما", "عام الحزن"),
    (2, 149): ("رحلة النبي ﷺ إلى أهل الطائف ودعوتهم", "رحلة الطائف"),
    (2, 155): ("عرض النبي ﷺ نفسه على القبائل في مواسم الحج", "عرض الدعوة"),
    (2, 176): ("باب بدء إسلام الأنصار وبيعتي العقبة الأولى والثانية", "بيعتا العقبة"),
    (2, 213): ("باب بدء هجرة الصحابة من مكة إلى المدينة", "الهجرة إلى المدينة"),
    (2, 232): ("باب هجرة رسول الله ﷺ بنفسه الكريمة إلى المدينة", "الهجرة النبوية"),
    (2, 267): ("دخوله ﷺ المدينة وبناء المسجد النبوي وخطبته الأولى", "السنة 1 هـ"),
    (2, 315): ("حمى المدينة والمؤاخاة بين المهاجرين والأنصار", "السنة 1 هـ"),
    (2, 342): ("أحداث السنة الثانية للهجرة وتحويل القبلة", "السنة 2 هـ"),
    (2, 352): ("أول المغازي والسرايا: الأبواء وبواط والعشيرة ونخلة", "السنة 2 هـ"),
    (2, 377): ("فريضة صيام رمضان وغزوة بدر العظمى — يوم الفرقان", "غزوة بدر 2 هـ"),
    (2, 438): ("مقتل صناديد قريش ومسألة الأسرى والفداء", "غزوة بدر 2 هـ"),
    (2, 469): ("رجوعه ﷺ من بدر ووصول الخبر لمكة وفرح النجاشي", "غزوة بدر 2 هـ"),
    (2, 516): ("هجرة زينب بنت رسول الله ﷺ وأشعار غزوة بدر", "السنة 2 هـ"),
    (2, 539): ("غزوة بني سليم وجمل من حوادث السنة الثانية", "السنة 2 هـ"),
    # Volume 3
    (3, 3): ("السنة الثالثة للهجرة: غزوة ذي أمر والفرع وسرية زيد", "السنة 3 هـ"),
    (3, 18): ("غزوة أحد في شوال سنة ثلاث للهجرة", "غزوة أحد 3 هـ"),
    (3, 57): ("ثبات النبي ﷺ يوم أحد ودعاؤه والصلاة على الشهداء", "غزوة أحد 3 هـ"),
    (3, 97): ("غزوة حمراء الأسد وأشعار يوم أحد", "غزوة أحد 3 هـ"),
    (3, 123): ("غزوة الرجيع وسرية بئر معونة في السنة الرابعة", "السنة 4 هـ"),
    (3, 145): ("غزوة بني النضير ونزول سورة الحشر", "السنة 4 هـ"),
    (3, 156): ("غزوة ذات الرقاع وبدر الآخرة وحوادث السنة الرابعة", "السنة 4 هـ"),
    (3, 177): ("السنة الخامسة للهجرة: دومة الجندل وغزوة الخندق (الأحزاب)", "غزوة الخندق 5 هـ"),
    (3, 213): ("دعاؤه ﷺ على الأحزاب وهزيمتهم بريح الصبا", "غزوة الخندق 5 هـ"),
    (3, 223): ("غزوة بني قريظة وحكم سعد بن معاذ رضي الله عنه", "السنة 5 هـ"),
    (3, 273): ("زواجه ﷺ ونزول آية الحجاب وأحداث السنة الخامسة", "السنة 5 هـ"),
    (3, 285): ("السنة السادسة للهجرة: ذو قرد وغزوة بني المصطلق (المريسيع)", "السنة 6 هـ"),
    (3, 312): ("غزوة وصلح الحديبية وبيعة الرضوان", "صلح الحديبية 6 هـ"),
    (3, 338): ("سرايا وحوادث السنة السادسة للهجرة", "السنة 6 هـ"),
    (3, 344): ("السنة السابعة للهجرة: غزوة خيبر وفتح حصونها", "غزوة خيبر 7 هـ"),
    (3, 389): ("قدوم جعفر بن أبي طالب وقصة الشاة المسمومة وشهداء خيبر", "غزوة خيبر 7 هـ"),
    (3, 417): ("سرايا السنة السابعة وعمرة القضاء", "السنة 7 هـ"),
    (3, 455): ("غزوة مؤتة واستشهاد زيد وجعفر وعبد الله بن رواحة", "غزوة مؤتة 8 هـ"),
    (3, 494): ("كتاب بعث النبي ﷺ وكتبه إلى ملوك الآفاق", "المكاتبات 7–8 هـ"),
    (3, 516): ("غزوة ذات السلاسل وسرية سيف البحر", "السنة 8 هـ"),
    (3, 526): ("غزوة الفتح الأعظم — فتح مكة في رمضان سنة ثمان", "فتح مكة 8 هـ"),
    (3, 575): ("دخوله ﷺ الكعبة وعفوه عن قريش ومدة إقامته بمكة", "فتح مكة 8 هـ"),
    (3, 610): ("غزوة هوازن يوم حنين وأوطاس", "غزوة حنين 8 هـ"),
    (3, 652): ("غزوة الطائف وقسمة غنائم حنين بالجعرانة", "غزوة الطائف 8 هـ"),
    (3, 683): ("قدوم مالك بن عوف والشيماء وحوادث ختام السنة الثامنة", "السنة 8 هـ"),
    # Volume 4
    (4, 3): ("السنة التاسعة للهجرة: غزوة تبوك (جيش العسرة)", "غزوة تبوك 9 هـ"),
    (4, 26): ("المتخلفون وقصة الثلاثة الذين خُلّفوا وحوادث ما بعد تبوك", "غزوة تبوك 9 هـ"),
    (4, 64): ("موت عبد الله بن أبي وحج أبي بكر الصديق ونزول سورة براءة", "السنة 9 هـ"),
    (4, 76): ("كتاب الوفود الواردين إلى رسول الله ﷺ (بني تميم ونجران)", "عام الوفود 9–10 هـ"),
    (4, 121): ("وفود القبائل العربية: طيئ وعبد القيس ودوس وبني حنيفة وغيرها", "عام الوفود 9–10 هـ"),
    (4, 170): ("تتمة وفود العرب: أسد وعبس وفزارة وكنانة وسليم وخولان", "عام الوفود 9–10 هـ"),
    (4, 188): ("السنة العاشرة للهجرة: بعث خالد وعلي رضي الله عنهما إلى اليمن", "السنة 10 هـ"),
    (4, 211): ("كتاب حجة الوداع: خروجه ﷺ وإهلاله وتفصيل النسك", "حجة الوداع 10 هـ"),
    (4, 283): ("تلبية النبي ﷺ وحديث جابر الكامل في صفة حجته", "حجة الوداع 10 هـ"),
    (4, 300): ("دخوله ﷺ مكة والطواف والسعي والوقوف بعرفة", "حجة الوداع 10 هـ"),
    (4, 353): ("ما نزل بعرفة والإفاضة إلى المزدلفة ورمي الجمار وخطبة منى", "حجة الوداع 10 هـ"),
    (4, 414): ("خطبة غدير خم والرجوع إلى المدينة المنورة", "حجة الوداع 10 هـ"),
    (4, 427): ("السنة الحادية عشرة للهجرة وبدايات مرض رسول الله ﷺ", "السنة 11 هـ"),
    (4, 459): ("أمره ﷺ أبا بكر بالصلاة بالناس ووفاته إلى الرفيق الأعلى", "وفاة النبي ﷺ"),
    (4, 484): ("اجتماع السقيفة وبيعة أبي بكر الصديق رضي الله عنه", "وفاة النبي ﷺ"),
    (4, 505): ("وقت وفاته ﷺ وغسله وتكفينه والصلاة عليه ودفنه وصفته", "وفاة النبي ﷺ"),
    (4, 543): ("مصيبة المسلمين بوفاته ﷺ والتعزية وبيان «لا نورث»", "وفاة النبي ﷺ"),
    (4, 579): ("باب ذكر زوجاته أمهات المؤمنين وأولاده ﷺ", "آل البيت والشمائل"),
    (4, 616): ("باب ذكر خدمه ومواليه وكتابه وأمنائه ﷺ", "آل البيت والشمائل"),
    (4, 670): ("تتمة ذكر خدمه ورسله وأمرائه ﷺ", "آل البيت والشمائل"),
    (4, 701): ("باب ما يذكر من آثار النبي ﷺ وسلاحه ومراكبه الشريفة", "آثار النبي ﷺ"),
}

# Cross-links from WIRD's 16 curated narrative chapters to Ibn Kathir's Encyclopedia
CURATED_CHAPTER_LINKS: dict[str, dict[str, Any]] = {
    "ch-1-arabia-makkah": {"volume": 1, "page": 1, "label": "ج 1 · ص 1 — ذكر أخبار العرب وأنسابهم"},
    "ch-2-birth-upbringing": {"volume": 1, "page": 198, "label": "ج 1 · ص 198 — باب مولد رسول الله ﷺ"},
    "ch-3-youth-trustworthy": {"volume": 1, "page": 250, "label": "ج 1 · ص 250 — نشأته وحرب الفجار وزواجه وبناء الكعبة"},
    "ch-4-revelation-hira": {"volume": 1, "page": 385, "label": "ج 1 · ص 385 — باب كيفية بدء الوحي"},
    "ch-5-public-call-abyssinia": {"volume": 2, "page": 3, "label": "ج 2 · ص 3 — هجرة الصحابة إلى أرض الحبشة"},
    "ch-6-sorrow-taif-isra": {"volume": 2, "page": 93, "label": "ج 2 · ص 93 — الإسراء والمعراج وعام الحزن والطائف"},
    "ch-7-aqabah-pledges": {"volume": 2, "page": 176, "label": "ج 2 · ص 176 — بدء إسلام الأنصار وبيعتا العقبة"},
    "ch-8-hijrah-journey": {"volume": 2, "page": 232, "label": "ج 2 · ص 232 — هجرة رسول الله ﷺ إلى المدينة"},
    "ch-9-madinah-foundation": {"volume": 2, "page": 267, "label": "ج 2 · ص 267 — دخوله ﷺ المدينة وبناء المسجد والمؤاخاة"},
    "ch-10-badr": {"volume": 2, "page": 377, "label": "ج 2 · ص 377 — غزوة بدر العظمى يوم الفرقان"},
    "ch-11-uhud-khandaq": {"volume": 3, "page": 18, "label": "ج 3 · ص 18 — غزوة أحد ثم غزوة الخندق"},
    "ch-12-hudaybiyyah-letters": {"volume": 3, "page": 312, "label": "ج 3 · ص 312 — صلح الحديبية وكتبه ﷺ إلى الملوك"},
    "ch-13-fath-makkah": {"volume": 3, "page": 526, "label": "ج 3 · ص 526 — غزوة الفتح الأعظم (فتح مكة)"},
    "ch-14-farewell-pilgrimage": {"volume": 4, "page": 211, "label": "ج 4 · ص 211 — كتاب حجة الوداع"},
    "ch-15-passing-rafiq-ala": {"volume": 4, "page": 459, "label": "ج 4 · ص 459 — مرض النبي ﷺ ووفاته إلى الرفيق الأعلى"},
    "ch-16-shamail-legacy": {"volume": 4, "page": 579, "label": "ج 4 · ص 579 — أزواجه وأولاده وخدمه وآثاره الشريفة"},
}

ARABIC_DIACRITICS_RE = re.compile(r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]")


def normalize_arabic_search(text: str) -> str:
    s = ARABIC_DIACRITICS_RE.sub("", text)
    s = re.sub(r"[أإآٱ]", "ا", s)
    s = s.replace("ى", "ي").replace("ة", "ه").replace("ؤ", "و").replace("ئ", "ي")
    s = re.sub(r"[^\u0621-\u063A\u0641-\u064A0-9\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def clean_paragraph(line: str) -> str:
    s = line.strip()
    # Strip OpenITI structural prefixes
    s = re.sub(r"^###\s*\|+\s*", "", s)
    s = re.sub(r"^#\s*", "", s)
    # Strip OpenITI milestone markers
    s = re.sub(r"\s*ms\d+\s*", " ", s)
    # Strip print signature footers like (1 / 1 السيرة) or (2 / 4 السيرة)
    s = re.sub(r"\(\s*\d+\s*/\s*\d+\s*السيرة\s*\)", "", s)
    # Strip isolated print footnote markers like (1) or (2) when surrounded by spaces/punctuation
    s = re.sub(r"\s*\(\d{1,2}\)\s*", " ", s)
    # Normalize whitespace and stray punctuation spacing
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r"\s+([،؛:.!؟])", r"\1", s)
    return s


def find_source_file() -> Path:
    if len(sys.argv) > 1:
        p = Path(sys.argv[1])
        if p.exists():
            return p
    for cand in DEFAULT_SOURCE_CANDIDATES:
        if cand and cand.exists():
            return cand
    raise FileNotFoundError(
        "OpenITI source file not found. Pass its path as CLI arg or set SEERAH_OPENITI_SOURCE."
    )


def build() -> None:
    source_path = find_source_file()
    print(f"[Seerah Builder] Reading verified OpenITI source: {source_path}")
    raw = source_path.read_text(encoding="utf-8")

    start_marker = "### | ذكر أخبار العرب"
    start_idx = raw.find(start_marker)
    if start_idx == -1:
        raise ValueError(f"Could not find start marker {start_marker!r} in source file.")

    # Slice strictly from Ibn Kathir's matn (excluding the 1964 modern editor preface)
    book = raw[start_idx:]
    book = book.replace("\r\n", "\n")
    # Rejoin OpenITI wrapped lines
    book = re.sub(r"\n~~", " ", book)

    # Split by PageVxxPyyy markers (OpenITI places page marker at the END of each printed page)
    tokens = re.split(r"(PageV\d+P\d+)", book)
    raw_pages: list[dict[str, Any]] = []
    for i in range(0, len(tokens) - 1, 2):
        page_text = tokens[i]
        marker = tokens[i + 1]
        m = re.match(r"PageV(\d+)P(\d+)", marker)
        if not m:
            continue
        vol = int(m.group(1))
        page_num = int(m.group(2))
        if vol not in (1, 2, 3, 4):
            continue

        paragraphs: list[str] = []
        for line in page_text.splitlines():
            cleaned = clean_paragraph(line)
            if not cleaned:
                continue
            # Drop standalone separator lines like "* * *"
            if cleaned in ("*", "* *", "* * *", "-", "---"):
                continue
            paragraphs.append(cleaned)

        if not paragraphs:
            # Preserve page continuity if a page had only a title or blank separator
            paragraphs = [f"(صفحة {page_num} من المجلد {vol})"]

        raw_pages.append({
            "volume": vol,
            "page": page_num,
            "paragraphs": paragraphs,
        })

    # Deduplicate/sort per volume cleanly
    pages_by_vol: dict[int, list[dict[str, Any]]] = {1: [], 2: [], 3: [], 4: []}
    seen_vp: set[tuple[int, int]] = set()
    for pg in raw_pages:
        key = (pg["volume"], pg["page"])
        if key in seen_vp:
            # Merge paragraphs into existing page entry if marker repeated
            existing = next(x for x in pages_by_vol[pg["volume"]] if x["page"] == pg["page"])
            existing["paragraphs"].extend(pg["paragraphs"])
            continue
        seen_vp.add(key)
        pages_by_vol[pg["volume"]].append(pg)

    for v in (1, 2, 3, 4):
        pages_by_vol[v].sort(key=lambda x: x["page"])

    # Prepare output directories (clean stale files)
    CHUNKS_DIR.mkdir(parents=True, exist_ok=True)
    SEARCH_DIR.mkdir(parents=True, exist_ok=True)
    for old in list(CHUNKS_DIR.glob("*.json")) + list(SEARCH_DIR.glob("*.json")):
        old.unlink()

    toc_sections: list[dict[str, Any]] = []
    volumes_manifest: list[dict[str, Any]] = []
    page_to_section: dict[tuple[int, int], str] = {}
    page_to_chunk: dict[tuple[int, int], str] = {}

    total_pages = 0
    total_words = 0
    total_chunks = 0

    for v in (1, 2, 3, 4):
        v_pages = pages_by_vol[v]
        if not v_pages:
            raise ValueError(f"Volume {v} has zero pages!")

        # Build sorted anchors for this volume from CURATED_ANCHORS
        v_anchors = sorted(
            [(p, title, era) for (av, p), (title, era) in CURATED_ANCHORS.items() if av == v],
            key=lambda x: x[0],
        )
        # Ensure first page is anchored
        if not v_anchors or v_anchors[0][0] > v_pages[0]["page"]:
            v_anchors.insert(0, (v_pages[0]["page"], VOLUME_METADATA[v]["title"], VOLUME_METADATA[v]["periodLabel"]))

        # Assign every page in this volume to its chunk (25 pages/chunk)
        v_chunks: list[dict[str, Any]] = []
        for idx in range(0, len(v_pages), PAGES_PER_CHUNK):
            slice_pages = v_pages[idx : idx + PAGES_PER_CHUNK]
            chunk_num = (idx // PAGES_PER_CHUNK) + 1
            chunk_id = f"vol-{v}-chunk-{chunk_num:02d}"
            for pg in slice_pages:
                page_to_chunk[(v, pg["page"])] = chunk_id
            v_chunks.append({
                "chunkId": chunk_id,
                "volume": v,
                "startPage": slice_pages[0]["page"],
                "endPage": slice_pages[-1]["page"],
                "pages": slice_pages,
            })

        # Build sections for this volume
        v_sections: list[dict[str, Any]] = []
        for s_idx, (start_p, title, era) in enumerate(v_anchors):
            next_start_p = v_anchors[s_idx + 1][0] if s_idx + 1 < len(v_anchors) else 10**9
            sec_pages = [pg for pg in v_pages if start_p <= pg["page"] < next_start_p]
            if not sec_pages:
                # Fallback: pick nearest page >= start_p
                later = [pg for pg in v_pages if pg["page"] >= start_p]
                if not later:
                    continue
                sec_pages = [later[0]]

            sec_id = f"v{v}-sec-{len(v_sections) + 1:03d}"
            sec_words = sum(len(" ".join(pg["paragraphs"]).split()) for pg in sec_pages)
            sec_chunks = list(dict.fromkeys(page_to_chunk[(v, pg["page"])] for pg in sec_pages))

            for pg in sec_pages:
                pg["sectionId"] = sec_id
                page_to_section[(v, pg["page"])] = sec_id

            sec_obj = {
                "id": sec_id,
                "volume": v,
                "order": len(v_sections) + 1,
                "globalOrder": len(toc_sections) + 1,
                "title": title,
                "eraTag": era,
                "startPage": sec_pages[0]["page"],
                "endPage": sec_pages[-1]["page"],
                "pageCount": len(sec_pages),
                "wordCount": sec_words,
                "chunkId": sec_chunks[0],
                "chunkIds": sec_chunks,
            }
            v_sections.append(sec_obj)
            toc_sections.append(sec_obj)

        # Ensure every page has a sectionId (safety guard)
        for pg in v_pages:
            if "sectionId" not in pg:
                pg["sectionId"] = v_sections[0]["id"]
                page_to_section[(v, pg["page"])] = v_sections[0]["id"]

        # Write chunks for this volume
        for ch in v_chunks:
            chunk_payload = {
                "chunkId": ch["chunkId"],
                "volume": ch["volume"],
                "startPage": ch["startPage"],
                "endPage": ch["endPage"],
                "pages": [
                    {
                        "page": pg["page"],
                        "sectionId": pg["sectionId"],
                        "paragraphs": pg["paragraphs"],
                    }
                    for pg in ch["pages"]
                ],
            }
            out_chunk = CHUNKS_DIR / f"{ch['chunkId']}.json"
            out_chunk.write_text(
                json.dumps(chunk_payload, ensure_ascii=False, separators=(",", ":")),
                encoding="utf-8",
            )

        # Write search index for this volume
        search_entries = []
        v_word_count = 0
        for pg in v_pages:
            joined = " ".join(pg["paragraphs"])
            v_word_count += len(joined.split())
            search_entries.append({
                "p": pg["page"],
                "s": pg["sectionId"],
                "c": page_to_chunk[(v, pg["page"])],
                "t": normalize_arabic_search(joined),
                "x": joined[:260],
            })

        out_search = SEARCH_DIR / f"vol-{v}-search.json"
        out_search.write_text(
            json.dumps(
                {"volume": v, "pageCount": len(v_pages), "entries": search_entries},
                ensure_ascii=False,
                separators=(",", ":"),
            ),
            encoding="utf-8",
        )

        # Map each page number -> chunkId for instant "Jump to Page" lookup
        page_chunk_ranges = [
            {
                "chunkId": ch["chunkId"],
                "startPage": ch["startPage"],
                "endPage": ch["endPage"],
            }
            for ch in v_chunks
        ]

        v_meta = VOLUME_METADATA[v]
        volumes_manifest.append({
            **v_meta,
            "firstPage": v_pages[0]["page"],
            "lastPage": v_pages[-1]["page"],
            "pageCount": len(v_pages),
            "sectionCount": len(v_sections),
            "wordCount": v_word_count,
            "chunkCount": len(v_chunks),
            "chunks": page_chunk_ranges,
            "searchIndexPath": f"/data/seerah-encyclopedia/search/vol-{v}-search.json",
        })

        total_pages += len(v_pages)
        total_words += v_word_count
        total_chunks += len(v_chunks)
        print(
            f"  [Vol {v}] pages={len(v_pages)} (p.{v_pages[0]['page']}..p.{v_pages[-1]['page']}), "
            f"sections={len(v_sections)}, chunks={len(v_chunks)}, words={v_word_count:,}"
        )

    # Resolve exact sectionId and chunkId for curatedChapterLinks
    resolved_links: dict[str, dict[str, Any]] = {}
    for ch_id, spec in CURATED_CHAPTER_LINKS.items():
        v = spec["volume"]
        p = spec["page"]
        # Find exact or nearest page in volume
        v_pages = pages_by_vol[v]
        target_pg = next((pg for pg in v_pages if pg["page"] >= p), v_pages[0])
        resolved_links[ch_id] = {
            "volume": v,
            "page": target_pg["page"],
            "sectionId": target_pg["sectionId"],
            "chunkId": page_to_chunk[(v, target_pg["page"])],
            "label": spec["label"],
        }

    manifest = {
        "schemaVersion": 1,
        "encyclopediaVersion": "2.0.0",
        "title": "السيرة النبوية لابن كثير — الموسوعة الكاملة (4 مجلدات)",
        "classicalWork": "السيرة النبوية (من البداية والنهاية)",
        "author": "الإمام الحافظ عماد الدين أبو الفداء إسماعيل بن عمر بن كثير القرشي الدمشقي (ت 774 هـ)",
        "editionAlignment": "مطابقة لترقيم طبعة المجلدات الأربعة (ملفات seerah-sources/) — مستبعد منها مقدمة المحقق المعاصر وحصرياً متن الحافظ ابن كثير التراثي",
        "licenseNotice": "المتن الأصلي للحافظ ابن كثير (ت 774 هـ) في الملكية العامة (Public Domain). النص الرقمي مأخوذ من مبادرة OpenITI (0774IbnKathir.Bidaya.Shamela0000930-ara6) بترخيص CC BY-NC-SA 4.0 للاستخدام التعليمي غير التجاري مع العزو.",
        "totalVolumes": 4,
        "totalPages": total_pages,
        "totalSections": len(toc_sections),
        "totalWords": total_words,
        "totalChunks": total_chunks,
        "volumes": volumes_manifest,
        "curatedChapterLinks": resolved_links,
    }

    (OUTPUT_DIR / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (OUTPUT_DIR / "toc.json").write_text(
        json.dumps(
            {
                "schemaVersion": 1,
                "encyclopediaVersion": "2.0.0",
                "totalSections": len(toc_sections),
                "sections": toc_sections,
            },
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )

    # Calculate total footprint
    total_bytes = sum(f.stat().st_size for f in OUTPUT_DIR.rglob("*.json"))
    print(
        f"[Seerah Builder] DONE! 4 volumes, {total_pages:,} pages, {len(toc_sections)} sections, "
        f"{total_chunks} chunks, {total_words:,} words, disk={total_bytes / (1024 * 1024):.2f} MB"
    )


if __name__ == "__main__":
    build()
