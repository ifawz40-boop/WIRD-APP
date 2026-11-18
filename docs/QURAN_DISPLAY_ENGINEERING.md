# Quran display engineering audit and staged design

## Current renderer map (2026-11-08)

| Surface | Text source / composition | Font and direction | Ayah, audio, and tafsir linkage |
|---|---|---|---|
| Mushaf page (`QuranMushafReader`) | Local `completeQuranData.json` split into per-surah chunks; `QURAN_PAGE_INDEX` selects ayah ranges, then React inserts natural-flow buttons, surah banners, basmala, and audio buttons. It is a 604-page navigation index, not printed page line data. | Google Fonts Amiri, RTL inherited from document; no page glyph font. | Each button keeps `number/surahNumber/numberInSurah`; audio queue uses sorted ayahs; selection opens `TafsirSheet`. |
| Library study view (`QuranLibraryView`) | Same local ayah records, rendered one article per ayah. | Amiri; RTL inherited; `tracking-wide` was applied to the Quran paragraph and has been removed. | Audio, tafsir, copy, and session actions use the selected ayah coordinate. |
| Memorization/revision session (`MemorizationSessionView`) | Same local ayah record. Word-masking splits only at whitespace into clickable word spans; this preserves each word's internal code point sequence but changes word spacing/layout. | Amiri; RTL inherited. | Audio and `SessionTafsirPanel` use `currentAyah`; repeat and playback rate are separate preferences. |
| Tafsir (`TafsirSheet`, `SessionTafsirPanel`) | Canonical ayah text plus provider tafsir text. | Amiri; RTL inherited. | Tafsir request uses surah and ayah; related hadith follows the same coordinate. |
| Dashboard, revision weak-ayah cards, ruqyah, memorization tests, advisor | Mostly local `Ayah.text`; ruqyah resolver replaces untrusted provider Quran strings with canonical local data. Test prompts and summaries interpolate canonical strings. | Mostly `.font-quran` (Amiri); several have their own font size/line-height. | Identity varies by surface; links are generally coordinate-driven. These remain migration targets for the shared display primitive.

## Verified facts and root-cause assessment

- Canonical stored data is Tanzil `quran-uthmani`, Hafs, with a separately checked-in reference corpus. Existing test `Independent Tanzil Character-by-Character Verification` compares text and metadata exactly; the full suite passed 584/584 before this change.
- Surah 41, ayah 7 is stored exactly as `ٱلَّذِينَ لَا يُؤْتُونَ ٱلزَّكَوٰةَ وَهُم بِٱلْءَاخِرَةِ هُمْ كَٰفِرُونَ`. The suspicious sequence includes U+0621 HAMZA followed by U+0627 ALEF after U+0642 SUKUN in `ٱلْءَاخِرَةِ`; it is not safe to rewrite as a Unicode cleanup. The quoted malformed example is not the stored verse string.
- `index.html` loads Google Fonts Amiri and Cairo only. `.font-quran` names Amiri before `Amiri Quran`, but the latter is not actually loaded. Amiri is a literary Naskh typeface, not a page-specific Madinah Mushaf face.
- Quran body text had `tracking-wide` on the study view; letter-spacing on connected Arabic can degrade joining/mark placement. The shared `.quran-text` primitive now isolates RTL direction and restores normal letter/word spacing while leaving canonical text byte-for-byte unchanged. This is a likely contributing renderer defect, not proof of the exact historical screenshot/root cause.
- The current reader's page ranges establish page/ayah navigation only. Natural browser wrapping, inserted controls, banners, and extra basmala cannot preserve the 15 printed lines or exact page composition.

## Source and font comparison

| Option | Best fit | Evidence / constraint | Decision |
|---|---|---|---|
| Amiri | Connected Arabic text; OFL font | Upstream Amiri project describes a Naskh typeface and publishes it under SIL OFL 1.1. Amiri Quran is a separately built subset/configuration, not currently loaded by the app. | Acceptable fallback; not claim of page-faithful rendering. |
| Amiri Quran | Quran typesetting with Amiri-specific feature settings | Upstream build documents `AmiriQuranColored` as a tailored subset with defaults/features intended for Quran typesetting. Asset/version and webfont availability must be pinned and validated before adoption. | Evaluate in typography lab, do not silently alias to Amiri. |
| Uthmanic Hafs / QPC Hafs | Unicode ayah/connected reading | Quran Foundation documents a compatible Unicode font and recommends it for simple Unicode rendering. A compatible source string is required; the current Tanzil string must not be assumed equivalent to QPC text without exact comparison. | Preferred candidate for connected view after provenance/coverage and visual regression tests. |
| QCF V2 | Exact 604-page glyph-based Madinah Mushaf | Quran Foundation documents page-specific glyph fonts (one per page), `code_v2`, page number and a 15-line page layout. The repo currently has none of `code_v2`, word records, line numbers, or per-page font assets. | Target for paper-like mode only after a licensed, versioned static dataset is obtained and validated. Do not fake it with natural wrapping. |
| QUL downloadable QPC V2 + KFGQPC V2 layout (1421H) | Local exact line layout and matching page glyphs | QUL offers downloadable JSON/SQLite, documents line rows and word IDs, and explicitly says its resources are packages rather than a public API. However, the resource-specific license screens for the QPC V2 script, 1421H layout, and QPC V2 fonts currently state that copyright information is unavailable. | Best technical fit; not vendored pending rights clarification. QUL's general FAQ says to review each resource license, not that all resources share an open license. |
| KFGQPC official data | Official Unicode and layout-oriented resources | Official King Fahd Quran Complex platform describes Unicode Uthmanic text for ayah display and publishes richer page/line metadata; its Unicode font alone does not reproduce an entire printed page. | Evaluate as an authoritative layout/data candidate; verify downloadable package terms before bundling. |

Tanzil text is to remain verbatim and attributed under its published CC BY 3.0 terms. Quran Foundation's renderer documentation says production API calls require server-issued client credentials; this phase does not add an API, credentials, or new Quran content endpoint. QUL downloads could avoid runtime API access, but the QPC resource license screens presently do not provide rights needed for a safe production bundle. The official King Fahd Complex usage page allows expressly listed digital Mushaf formats for websites and software, and its developer portal documents Unicode text plus `line_start`/`line_end`; the official vector copy is not itself a ready-to-render web page asset. Reuse OSS as reference only; check each asset's license independently before vendoring.

## Staged target architecture

1. **Canonical data:** immutable Tanzil ayah text and verified coordinate metadata; no UI normalization or OCR. Add independent reference regression tests for text and stable coordinates.
2. **Connected text renderer:** one small `QuranText` primitive for lang/dir/isolation/Arabic spacing and predictable wrapping; word masking may segment only at complete whitespace-delimited words. Shared rendering now covers library reading, connected reading, page-style reading, tafsir, memorization, dashboard preview, weak-ayah revision, and canonical ruqyah output.
3. **Reading mode:** continuous selectable ayahs with per-ayah audio and tafsir linkage exists alongside the card study view. Selected or played ayahs persist as the last reading position, with a direct restore action.
4. **Paper Mushaf mode:** per-page QCF V2 renderer only when a verified line/word/glyph dataset and licensed 604 fonts are locally available; otherwise disclose the existing reflow mode instead of representing it as a facsimile. Ayah hit regions must come from validated word/line geometry or be omitted.
5. **Shared interaction:** one coordinate-based action controller for playback, tafsir, bookmark, range selection, memorization, and review; adapt to a compact mobile sheet and desktop panel.
6. **Rollout gates:** exact source match; all-page layout/coordinate completeness; per-font glyph coverage; browser screenshots for hamza, high marks, waqf, joining and fallback; keyboard, touch and screen-reader checks; then staged rollout.

## Current phase scope and known limits

Current implementation includes the non-mutating shared text primitive, RTL/spacing rules, connected selectable reading with saved-position restoration, an interactive typography lab with local corpus samples, and unit/browser regression coverage for 41:7. The lab only enables Amiri and system serif fallback; Amiri Quran, Uthmanic Hafs, and QCF V2 stay visibly unavailable because their assets/text mapping are not installed. The page-style reader now discloses that line distribution can differ from print. It still does not render true QCF page glyphs, exact line layout, or page-accurate word hit regions. QUL resource licenses and the official asset package must be resolved before that stage. CI's responsive Chromium smoke is not a replacement for visual typography review in Safari/iOS/Android or real devices. Existing cloud sync, production secrets, Firebase settings, and deployment configuration remain untouched.


## Tanzil Simple display layer (2026-11-08)

- A separate verbatim source is checked in at `src/data/sources/tanzil/quran-simple-1.1.xml`: Tanzil Quran Text (Simple), Version 1.1, Copyright (C) 2007-2026 Tanzil Project, CC BY 3.0. The original copyright/license block is retained in the source file, and every generated JSON chunk repeats the Tanzil copyright, version, license, and source URL metadata.
- The importer validates 114 ordered surahs, 6,236 ayahs, unique surah/ayah coordinates, contiguous local ayah indexes, exact coordinate coverage against the existing canonical corpus, non-empty strings, and required source attribution. It also verifies the imported source's SHA-256 against the uploaded file, and reports diacritic/waqf marker counts.
- Build/test preparation generates 114 independent JSON files under `src/data/quran-simple-surahs/`. Each chunk preserves every ayah coordinate and verbatim text plus the separate official `bismillah` attribute for surahs 2–8 and 10–114. The validator requires exactly 112 separate basmalas, rejects one on Al-Fatihah or At-Tawbah, and checks the 41:7 Imla’ei regression string. These are local build artifacts generated from the checked-in XML and loaded by a per-surah Vite glob; no Quran text API is called at runtime.
- The Uthmani source `completeQuranData.json` remains untouched. Memorization-test generation also uses the lazy coordinate loader, so opening that page does not import the entire Quran corpus. Display components request Simple text by surah/ayah coordinate; audio, tafsir, progress, bookmarks, and memorization identities continue to use the original coordinates.
- The generated report is `src/data/quranSimpleValidationReport.json`. Any source checksum, coordinate, count, or integrity failure blocks the prebuild/pretest/prelint pipeline.


## Verification snapshot

The GitHub Actions run for the validated implementation reported 588 automated assertions passed, 31 Firestore Rules Emulator tests passed, and 46 desktop/mobile Playwright tests passed. TypeScript, dependency audit, native API smoke, approved Quran audio CDN checks, production build, and server startup smoke also passed. The Tanzil validator reported 114 surahs, 6,236 ayahs, and 6,236 unique coordinate matches with no reported discrepancies. The same gates must be rerun on the final commit before merge.


## Printed Mushaf facsimile implementation (2026-11-10)

The first implementation of a true printed-page mode is now isolated behind an explicit reader choice:

- **Printed page:** one pinned Hafs/KFGQPC SVG page from Quran.ws release v1.1.1, with its native ayah hit regions.
- **Flexible text:** the existing WIRD-local Quran text renderer remains available as the offline-safe fallback.

Important correction to the earlier source comparison: the QUL 1421H layout and QPC V2 font resources remain excluded because their resource-specific license details were not clear enough to vendor. The selected vector archive uses KFGQPC's official 1441H digital artwork and its own CC BY 4.0 ayah geometry layer. KFGQPC's published rights permit free digital publishing and software/web use. See `docs/THIRD_PARTY_QURAN_FACSIMILE.md` for exact provenance and boundaries.

Implementation rules:
- SVG vector paths are not a Quran text source. They contain no selectable Unicode Quran text.
- WIRD's existing local corpus remains authoritative for all ayah text and application behavior.
- The reader sanitizes the fetched SVG with a strict element/attribute allowlist, then checks that every embedded ayah coordinate matches exactly one local ayah for the selected page. Any mismatch or source failure returns the user to the flexible local text view.
- The native SVG `.ayahPolygon` path is used for hit-testing; this avoids trying to convert the sidecar's two geometry encodings (path commands on pages 3–604 and point lists on the opening spread) into a single invented geometry format.
- The original per-file `viewBox` is retained, and the opening spread is fitted to its actual rendered ink after layout.
- A separate service-worker cache stores only recently viewed pinned Hafs/KFGQPC SVG pages, with a strict 24-file bound.

The feature is not yet approved as the default reader mode. Required remaining gates: exact local coordinate coverage across all 604 pages, opening-spread and dense-page visual review, actual device testing on iPadOS/Android, and first-load/offline cache verification. Until those gates pass, the flexible local-text mode remains the default and permanent fallback.


## 2026-11-17 — Printed Mushaf facing-page mode

- The printed facsimile reader now has a local preference key: wird.quran.pageDisplayMode.v1.
- Default mode is one page. Facing spread mode treats the odd/lower page as the right-hand page and the next page as the left-hand page; page 603 therefore pairs with page 604.
- In spread mode, page jumps normalize to the correct right-hand spread start, navigation and touch swipes move by two pages, and page labels show both visible page numbers.
- Both page SVGs are independently validated against WIRD's local ayah data through QuranMushafFacsimilePage; page art is never used as a Quran text source.
- Audio queue order is right page then left page. Playback and auto-continue wait until the left page's ayah map is available. Switching display mode stops active playback to avoid stale queue semantics.
- On narrow screens the spread remains side-by-side in a horizontally scrollable 640px minimum-width surface rather than shrinking Arabic text to unreadable columns.
- E2E coverage was added for one/two-page switching, left/right order, two-page stepping, preference persistence and offline opening. No local run is claimed; see PR #385 and exact-head CI.
- Opposite-page Tafsir is intentionally not implemented in this change. It must be a separate task with a complete, source-attributed local corpus and independently controlled Quran/Tafsir side modes.



## 2026-11-17 — Opposite-page Tafsir mode

- The facing Mushaf spread has separate content selectors for the left and right pages. Both default to Quran; selecting Tafsir on one side forces Quran on the opposite side so the user always has a Quran page to read.
- Selecting an ayah on the Quran page updates the Tafsir page on the opposite side. The Tafsir page displays all ayahs from that source page and highlights/scrolls to the focused ayah. The direction can be reversed.
- Tafsir display is backed only by the complete local QuranEnc Arabic al-Muyassar corpus; no online request is made while reading. An incomplete corpus is not displayed.
- Source key: arabic_moyassar; publisher: King Fahd Complex; catalogue edition V1.0.1 (2026-11-09). See docs/TAFSIR_OFFLINE_SOURCE.md for endpoint, payload, terms and validation.
- PR #386 adds the download/storage/display path; it remains Draft / NOT VERIFIED until exact-head CI and offline E2E pass.


- Follow-up refinement: previous/next controls also appear directly beneath each Tafsir ayah. Navigating from a Tafsir ayah targets the canonical Quran page; if that page was the Tafsir side, the two page roles swap so Quran remains the reading surface.
- When one spread side is Tafsir, audio is restricted to the opposite Quran page; when both sides are Quran, audio follows the full right-to-left spread order. Changing page roles stops the previous audio queue.


## 2026-11-18 — Release integration correction

- The integrated main reader mounts `TafsirMushafPage` in either side of `PrintedMushafSpread`. Each side can show Quran or the complete Tafsir for the opposite Quran page; the other side remains Quran, and only one Tafsir side is active in a visible spread.
- Page-side preferences are device-local and keyed by source page, so navigating between pages restores the appropriate Tafsir side. The full 114-surah local package is required before complete-page Tafsir text is shown; partial packages offer resume rather than being advertised as complete.
- Offline Tafsir fallback in the current integration is limited to the selected Tafsir Muyassar edition and requires the full 114-surah package to pass source-version/manifest validation. A partial package is resumable but is not advertised as complete or used as a full offline edition.
- The selected printed-page source is pinned to `quran-ws/quran-svg` commit `3ff27b46cecb0c0519d77531d9c868a579d1f623`, edition `hafs-kfqc`. The upstream project states CC BY 4.0 for the ayah geometry/metadata (with product-use attribution waiver) and identifies the page artwork as King Fahd Complex material whose stated rights permit digital/software/web use; physical commercial Mushaf printing is outside this app's scope. See `docs/THIRD_PARTY_QURAN_FACSIMILE.md` and upstream licensing documentation.
- The verification snapshot above is historical evidence for its own earlier SHA only. It is not evidence for the current integration branch. The current release must pass all exact-head checks and 604-page coverage validation before merge.
- The latest integration preserves the flexible WIRD-local Quran text renderer as the fallback. Printed SVGs supply only page artwork and ayah hit regions; WIRD's canonical local Quran dataset remains the only Quran text source.
