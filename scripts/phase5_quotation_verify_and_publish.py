#!/usr/bin/env python3
"""
Phase 5 — Review C (Sacred Quotation Verbatim Verification), Approval Gate & Production Publisher
-------------------------------------------------------------------------------------------------
1. Verifies all 40 chapters and 32 character stories have completed Review A (Historical)
   and Review B (Arabic Writing Quality).
2. Executes Review C (Religious Quotation Integrity):
   - Verifies every Quranic block byte-for-byte against src/data/completeQuranData.json.
   - Verifies every Hadith block byte-for-byte against research/quotations/hadith_and_athar_quotations.json.
   - Verifies zero ornate Quranic brackets (﴿ ﴾) leaked into unverified narrative paragraphs.
   - Verifies 100% bidirectional character <-> chapter and source/place referential integrity.
3. Advances verified items through: Quotation verification -> Approved -> Published.
4. Publishes the clean, fast, lazy-loaded static bundle under public/data/seerah/:
   - manifest.json
   - chapters/ch-01.json .. ch-40.json
   - characters/characters.json
   - search-index.json
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
RESEARCH = ROOT / "research"
CH_IN_DIR = RESEARCH / "authored_chapters"
CHAR_IN_DIR = RESEARCH / "authored_characters"
QURAN_PATH = ROOT / "src" / "data" / "completeQuranData.json"

PUB_DIR = ROOT / "public" / "data" / "seerah"
PUB_CH_DIR = PUB_DIR / "chapters"
PUB_CHAR_DIR = PUB_DIR / "characters"

ARABIC_DIACRITICS_RE = re.compile(r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]")


def norm_ar(text: str) -> str:
    s = ARABIC_DIACRITICS_RE.sub("", text)
    s = re.sub(r"[أإآٱ]", "ا", s)
    s = s.replace("ى", "ي").replace("ة", "ه").replace("ؤ", "و").replace("ئ", "ي")
    s = re.sub(r"[^\u0621-\u063A\u0641-\u064A0-9\s]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def expected_quran_verbatim(quran_corpus: dict[str, Any], s_num: int, a_start: int, a_end: int) -> str:
    s_ayahs = quran_corpus[str(s_num)]
    selected = [a for a in s_ayahs if a_start <= a["numberInSurah"] <= a_end]
    if len(selected) == 1:
        return selected[0]["text"].strip()
    return " ".join(f"{a['text'].strip()} ﴿{a['numberInSurah']}﴾" for a in selected)


def main() -> None:
    blueprint = json.loads((RESEARCH / "chronology" / "seerah_book_blueprint.json").read_text(encoding="utf-8"))
    quran_corpus = json.loads(QURAN_PATH.read_text(encoding="utf-8"))
    q_bank = {
        q["quoteId"]: q
        for q in json.loads((RESEARCH / "quotations" / "quran_quotations.json").read_text(encoding="utf-8"))["quotations"]
    }
    h_bank = {
        h["quoteId"]: h
        for h in json.loads((RESEARCH / "quotations" / "hadith_and_athar_quotations.json").read_text(encoding="utf-8"))["quotations"]
    }
    sources_list = json.loads((RESEARCH / "source_references" / "classical_sources_registry.json").read_text(encoding="utf-8"))["sources"]
    places_list = json.loads((RESEARCH / "chronology" / "places_catalog.json").read_text(encoding="utf-8"))["places"]
    sources_ids = {s["id"] for s in sources_list}
    places_ids = {p["id"] for p in places_list}

    ch_files = sorted(CH_IN_DIR.glob("ch-*.json"))
    char_files = sorted(CHAR_IN_DIR.glob("*.json"))

    if len(ch_files) != 40:
        raise RuntimeError(f"Expected 40 authored chapters, found {len(ch_files)}")
    if len(char_files) != 32:
        raise RuntimeError(f"Expected 32 authored characters, found {len(char_files)}")

    PUB_CH_DIR.mkdir(parents=True, exist_ok=True)
    PUB_CHAR_DIR.mkdir(parents=True, exist_ok=True)

    chapters: list[dict[str, Any]] = [json.loads(f.read_text(encoding="utf-8")) for f in ch_files]
    chapters.sort(key=lambda x: x["order"])
    characters: list[dict[str, Any]] = [json.loads(f.read_text(encoding="utf-8")) for f in char_files]
    characters.sort(key=lambda x: x["order"])

    ch_ids = {c["id"] for c in chapters}
    char_ids = {c["id"] for c in characters}

    verified_quran_blocks = 0
    verified_hadith_blocks = 0
    total_chapter_words = 0
    total_char_words = 0

    # Verify all 40 chapters
    for idx, ch in enumerate(chapters):
        assert ch["order"] == idx + 1, f"Chapter order broken at {ch['id']}"
        assert ch["reviews"].get("historical") == "passed", f"{ch['id']} missing Historical review"
        assert ch["reviews"].get("language") == "passed", f"{ch['id']} missing Language review"
        assert len(ch["scenes"]) >= 3, f"{ch['id']} must have >= 3 narrative scenes"
        assert ch["wordCount"] >= 450, f"{ch['id']} wordCount too short ({ch['wordCount']})"

        for cid in ch["characterIds"]:
            assert cid in char_ids, f"Unresolved characterId {cid} in {ch['id']}"
        for pid in ch["placeIds"]:
            assert pid in places_ids, f"Unresolved placeId {pid} in {ch['id']}"
        for sid in ch["sourceIds"]:
            assert sid in sources_ids, f"Unresolved sourceId {sid} in {ch['id']}"

        for sc in ch["scenes"]:
            assert len(sc["blocks"]) >= 2, f"Empty scene {sc['id']} in {ch['id']}"
            for blk in sc["blocks"]:
                if blk["type"] == "quran":
                    qid = blk["quoteId"]
                    assert qid in q_bank, f"Unknown quran quoteId {qid} in {ch['id']}"
                    expected = expected_quran_verbatim(
                        quran_corpus, blk["surahNumber"], blk["startAyah"], blk["endAyah"]
                    )
                    assert blk["verbatimText"] == expected, f"Quran verbatim mismatch in {ch['id']} ({qid})!"
                    verified_quran_blocks += 1
                elif blk["type"] == "hadith":
                    hid = blk["quoteId"]
                    assert hid in h_bank, f"Unknown hadith quoteId {hid} in {ch['id']}"
                    assert blk["verbatimText"] == h_bank[hid]["verbatimText"], f"Hadith verbatim mismatch in {ch['id']} ({hid})!"
                    assert h_bank[hid]["verifiedInEncyclopedia"] is True, f"Hadith {hid} not verified in encyclopedia!"
                    verified_hadith_blocks += 1
                else:
                    txt = blk.get("text", "")
                    assert "﴿" not in txt and "﴾" not in txt, f"Unverified Quran brackets leaked in {ch['id']} block {blk['id']}"

        ch["reviews"]["quotation"] = "passed"
        ch["statusHistory"] = [
            "Draft",
            "Historical review",
            "Language review",
            "Quotation verification",
            "Approved",
            "Published",
        ]
        ch["status"] = "Published"
        total_chapter_words += ch["wordCount"]

        # Save updated authored chapter & publish clean chapter JSON
        (CH_IN_DIR / f"{ch['id']}.json").write_text(json.dumps(ch, ensure_ascii=False, indent=2), encoding="utf-8")
        (PUB_CH_DIR / f"{ch['id']}.json").write_text(
            json.dumps(ch, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
        )

    # Verify all 32 character stories + bidirectional links
    for idx, c in enumerate(characters):
        assert c["order"] == idx + 1, f"Character order broken at {c['id']}"
        assert c["reviews"].get("historical") == "passed", f"Character {c['id']} missing Historical review"
        assert c["reviews"].get("language") == "passed", f"Character {c['id']} missing Language review"
        assert len(c["narrativeStoryParagraphs"]) >= 4, f"Character {c['id']} narrative too short"
        assert len(c["linkedChapterIds"]) >= 1, f"Character {c['id']} has no linked chapters"

        for cid in c["linkedChapterIds"]:
            assert cid in ch_ids, f"Character {c['id']} links to missing chapter {cid}"
        for m in c["chronologicalMoments"]:
            assert m["chapterId"] in ch_ids, f"Character {c['id']} moment links to missing chapter {m['chapterId']}"
        for p in c["narrativeStoryParagraphs"]:
            assert "﴿" not in p and "﴾" not in p, f"Unverified Quran brackets in character {c['id']}"

        c["reviews"]["quotation"] = "passed"
        c["statusHistory"] = [
            "Draft",
            "Historical review",
            "Language review",
            "Quotation verification",
            "Approved",
            "Published",
        ]
        c["status"] = "Published"
        total_char_words += c["wordCount"]
        (CHAR_IN_DIR / f"{c['id']}.json").write_text(json.dumps(c, ensure_ascii=False, indent=2), encoding="utf-8")

    # Publish characters bundle
    (PUB_CHAR_DIR / "characters.json").write_text(
        json.dumps({"schemaVersion": 1, "totalCharacters": len(characters), "characters": characters}, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    # Build compact search index across all 40 chapters & 32 characters
    search_items = []
    for ch in chapters:
        body_text = " ".join(
            [ch["title"], ch["subtitle"], ch["openingHook"], ch["historicalContext"], ch["closingBridge"]]
            + [
                (b.get("text") or b.get("verbatimText") or "")
                for sc in ch["scenes"]
                for b in sc["blocks"]
            ]
        )
        search_items.append({
            "kind": "chapter",
            "id": ch["id"],
            "order": ch["order"],
            "sectionId": ch["sectionId"],
            "title": ch["title"],
            "subtitle": ch["subtitle"],
            "periodLabel": ch["periodLabel"],
            "norm": norm_ar(body_text),
            "preview": ch["openingHook"][:200],
        })

    for c in characters:
        c_text = " ".join(
            [c["name"], c["epithet"], c["summary"], c["introduction"], c["backgroundAndContext"], c["relationshipWithProphet"]]
            + c["narrativeStoryParagraphs"]
        )
        search_items.append({
            "kind": "character",
            "id": c["id"],
            "order": c["order"],
            "title": c["name"],
            "subtitle": c["epithet"],
            "periodLabel": c["category"],
            "norm": norm_ar(c_text),
            "preview": c["introduction"][:200],
        })

    (PUB_DIR / "search-index.json").write_text(
        json.dumps({"schemaVersion": 1, "items": search_items}, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    # Publish lightweight manifest.json for instant landing render
    manifest = {
        "schemaVersion": 1,
        "bookVersion": "3.0.0",
        "publishedAt": datetime.now(timezone.utc).isoformat(),
        "title": blueprint["title"],
        "subtitle": blueprint["subtitle"],
        "primaryResearchSource": blueprint["primaryResearchSource"],
        "totalEras": len(blueprint["eras"]),
        "totalSections": len(blueprint["sections"]),
        "totalChapters": len(chapters),
        "totalCharacters": len(characters),
        "totalWords": total_chapter_words + total_char_words,
        "verifiedQuranQuotations": verified_quran_blocks,
        "verifiedHadithQuotations": verified_hadith_blocks,
        "eras": blueprint["eras"],
        "sections": blueprint["sections"],
        "chapters": [
            {
                "id": ch["id"],
                "order": ch["order"],
                "eraId": ch["eraId"],
                "sectionId": ch["sectionId"],
                "title": ch["title"],
                "subtitle": ch["subtitle"],
                "periodLabel": ch["periodLabel"],
                "datePrecision": ch["datePrecision"],
                "wordCount": ch["wordCount"],
                "estimatedReadingMinutes": ch["estimatedReadingMinutes"],
                "sceneCount": len(ch["scenes"]),
                "characterIds": ch["characterIds"],
                "previousChapterId": ch["previousChapterId"],
                "nextChapterId": ch["nextChapterId"],
                "status": ch["status"],
            }
            for ch in chapters
        ],
        "characters": [
            {
                "id": c["id"],
                "order": c["order"],
                "name": c["name"],
                "epithet": c["epithet"],
                "category": c["category"],
                "summary": c["summary"],
                "wordCount": c["wordCount"],
                "estimatedReadingMinutes": c["estimatedReadingMinutes"],
                "linkedChapterIds": c["linkedChapterIds"],
                "status": c["status"],
            }
            for c in characters
        ],
        "places": places_list,
        "sources": sources_list,
    }

    (PUB_DIR / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    # Save Phase 5 Audit Report
    audit_report = {
        "verifiedAt": datetime.now(timezone.utc).isoformat(),
        "totalChaptersApprovedAndPublished": len(chapters),
        "totalCharactersApprovedAndPublished": len(characters),
        "totalChapterWords": total_chapter_words,
        "totalCharacterWords": total_char_words,
        "totalPublishedWords": total_chapter_words + total_char_words,
        "verifiedQuranQuoteBlocks": verified_quran_blocks,
        "verifiedHadithQuoteBlocks": verified_hadith_blocks,
        "allReviewsPassed": True,
    }
    (RESEARCH / "research_reports" / "phase5_editorial_verification.json").write_text(
        json.dumps(audit_report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(
        f"[Phase 5 VERIFIED & PUBLISHED] 40/40 chapters ({total_chapter_words:,} words) + "
        f"32/32 characters ({total_char_words:,} words) = {total_chapter_words + total_char_words:,} words! "
        f"Quran blocks verified={verified_quran_blocks}, Hadith blocks verified={verified_hadith_blocks}."
    )


if __name__ == "__main__":
    main()
