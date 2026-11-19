# WIRD Ruqyah — Sunni Source and Content Policy

Last reviewed: 2026-11-07 — audio source review updated

## Non-negotiable rule

WIRD distinguishes its own curated religious corpus from attributed third-party educational material. The project owner has explicitly approved IslamicAPI as a trusted provider for the optional Ruqyah topic library, including its category labels and article blocks. Display that material with clear IslamicAPI attribution; do not describe it as independently verified or as a WIRD-authored fatwa. Do not turn provider text into medical diagnosis or guaranteed treatment claims. Do not present this software as a mufti or a medical diagnostic tool.

## Allowed source hierarchy

1. **Quran:** the core Mushaf, recitation lists, and Quran locator views display Arabic text only from WIRD's verified canonical Quran corpus (`src/data/verifiedAyahs`). IslamicAPI article blocks may contain quoted Arabic within an attributed educational article; those blocks remain clearly identified as provider article content and are not treated as the canonical Mushaf or used to populate Quran reading/audio controls.
2. **Hadith:** prefer the primary recognized Sunni hadith collections. For grading or disputed reports, show the named hadith scholar and exact grading, with a traceable reference. Use the Dorar Hadith Encyclopedia as an index to locate the primary narration and named grading; Dorar itself is not a substitute for identifying the hadith scholar.
3. **Fiqh/adab/health guidance:** include only after review against a named, recognized Sunni scholar/institution or authoritative medical guidance, with clear attribution. Otherwise omit.
4. **Audio:** full-program recordings require human review of the reciter identity, complete recording contents, source chain, and usage permissions. Ayah-addressable provider CDN files may be used only when the provider explicitly documents and licenses the reciter edition, maps each asset to a canonical ayah coordinate, identifies the source host and rights chain, and representative live files pass media-type and byte-range checks. This is provider-declared ayah mapping, not a claim that every file has been independently human-listened to; disclose that limitation. A filename, API catalogue, or reciter name alone is not verification.

## Current content references checked

- Al-Fatihah as Ruqyah: Sahih al-Bukhari 5736; Dorar record: https://dorar.net/hadith/sharh/11309
- Ruqyah must be free of shirk: Sahih Muslim 2200; Dorar record: https://dorar.net/h/03Vvfh7h
- Ruqyah wording from Jibril: Sahih Muslim 2186; Dorar record: https://dorar.net/hadith/sharh/17903
- Healing supplication: Sahih al-Bukhari 5750; Dorar record: https://dorar.net/hadith/sharh/2293
- Seeking refuge for al-Hasan and al-Husayn: Sahih al-Bukhari 3371; Dorar record: https://dorar.net/h/mfzXHm4C
- Morning/evening remembrance "Bismillah alladhi la yadurru": Sunan Abi Dawud 5088, graded Sahih by al-Albani; Dorar record: https://dorar.net/h/0nQmCpgK
- The three protective surahs morning/evening: Sunan Abi Dawud 5082, graded Hasan by al-Albani; Dorar record: https://dorar.net/h/xgBR2fIt
- Pain supplication: Sahih Muslim 2202; Dorar record: https://dorar.net/hadith/sharh/64180
- Ayat al-Kursi before sleep: Sahih al-Bukhari 2311 is cited as a suspended narration (mu'allaq) in the Bukhari placement; Dorar notes connected routes in al-Nasa'i and Ibn Khuzaymah: https://dorar.net/hadith/sharh/1766
- Combining Ruqyah and medical treatment: Shaykh Ibn Baz, *هل يترك العلاج ويكتفى بالتوكل على الله؟* — the fatwa states that combining treatment and supplication is better and that taking medical means is legislated: https://binbaz.org.sa/fatwas/16834/هل-يترك-العلاج-ويكتفى-بالتوكل-على-الله

Quran text and verse ranges remain checked against WIRD's canonical corpus. The Quran passages selected for general recitation are not represented as fixed-count prescriptions unless a sound narration explicitly establishes a count.

## Explicitly blocked sources/features

- IslamicAPI's `from-sunnah` content is not rendered or proxied. The `instant-category` endpoint remains blocked. For `instant` + `from-quran`, the server validates coordinates and returns only an item ID plus normalized numeric coordinates; provider-authored titles, Arabic, references, introductions, translations, and category labels are stripped. The separately gated `topic-category` and `topic` endpoints are handled under the owner-approved educational-content policy below.
- IslamicAPI educational topic and category endpoints are available only when the server-side `RUQYAH_TOPICS_ENABLED` flag is exactly `true`. The proxy accepts only the 13 documented topic slugs, validates the documented article-block schema, bounds payload size, strips unknown fields, and renders all provider content as escaped text with IslamicAPI attribution. This is the owner's approved third-party educational source; it is not represented as independent scholarly verification.
- IslamicAPI full-program recordings are not playable. Their reciter, complete contents, and source/rights chain have not been independently verified.
- Al Furqan's dynamic reciter catalogue/audio endpoint remains blocked. Its public API documentation identifies EveryAyah.com as the audio data source, but WIRD has not independently completed the reciter-specific rights and exact-asset review required by this policy.
- **Approved limited audio source: Al Quran Cloud, ayah-level streaming only.** Its current terms state that recitations are licensed to Al Quran Cloud by reciters or their estates for free, non-commercial redistribution, and explicitly permit streaming/embedding/download for personal and educational use. The terms also state that copyrights remain with the reciters and a reciter may request removal. WIRD limits this integration to educational streaming and does not download, bundle, mirror, or redistribute audio files. Terms: https://alquran.cloud/terms-and-conditions
- The Al Quran Cloud CDN documentation lists the fixed edition IDs and named reciters used by WIRD, describes the ayah-number URL pattern, and documents the source CDN. Documentation: https://alquran.cloud/cdn
- Al Quran Cloud's terms also state that its Quran audio was originally retrieved from GlobalQuran.com and that audio files remain copyrighted by their respective rights holders. WIRD streams from the provider CDN only and does not rehost these files. Provider directory/bitrate inventory: https://cdn.islamic.network/quran/info/by-ayah/info.txt
- The only enabled API edition IDs are `ar.husary`, `ar.minshawi`, `ar.abdulbasit`, `ar.sudais`, `ar.shuraim`, `ar.ajamy`, and `ar.alafasy`. The curated API-to-CDN mapping is: `ar.abdulbasit` → `ar.abdulbasitmurattal` (192 kbps), `ar.sudais` → `ar.abdurrahmaansudais` (192 kbps), `ar.shuraim` → `ar.saoodshuraym` (64 kbps), and `ar.ajamy` → `ar.ahmedajamy` (64 kbps); Husary, Minshawi, and Alafasy use matching edition/folder names at 128 kbps. These directory names and available bitrates were cross-checked against Al Quran Cloud's published `info.txt` inventory. The list is curated in code and is not populated from arbitrary provider data.
- Playback is limited to individual Quran ayahs resolved from WIRD's verified local Quran corpus. The audio URL builder accepts only the fixed HTTPS CDN host, the reviewed edition allowlist, and global ayah numbers 1–6236. Provider audio never supplies or changes the displayed Quran text.
- The provider's terms and CDN documentation establish its declared licensing, edition attribution, and ayah mapping. CI additionally probes the first ayah for each of the seven approved editions, plus the final canonical ayah for Alafasy, for MPEG content type and HTTP byte-range support. These checks do **not** constitute independent human listening review of every recording; the implementation therefore does not make an independent claim that every file has been acoustically audited.
- Full-program recordings containing supplications remain disabled because no complete recording has passed content, reciter, and rights verification. No silent fallback to another recording is allowed.
- Unreviewed optional content without an adequate evidence trail has been removed from the core content list.

## Implementation safeguards

- Backend allowlist accepts only `from-quran` for IslamicAPI instant content.
- API response Quran strings are never displayed; WIRD resolves the returned surah/ayah reference into `VERIFIED_AYAHS`.
- Tests assert third-party Sunnah text is rejected before upstream access.
- Tests assert topic endpoints are disabled when the server flag is off, allowlisted topic categories/articles pass through the bounded sanitizer when enabled, unknown topic slugs are rejected, and Quran locator responses continue to strip all provider-authored text.
- Tests assert the Al Quran Cloud catalogue returns only the seven curated edition IDs and rejects unknown providers, IDs, malformed responses, and invalid ayah coordinates.
- Tests assert audio URLs can only target the fixed HTTPS CDN host and only global ayah numbers 1–6236.
- CI probes the first ayah for each of the seven approved editions and the final Alafasy ayah for a valid MPEG response and byte-range streaming.
- UI tests cover section playlists, individual ayah playback, pause/resume/stop, navigation cleanup, and isolation from reading-progress counters.
- Full-program recordings containing supplications remain without playable URLs.
- No external source should be added to user-visible content without a matching test and a source record in this document.

## Review workflow for any future addition

1. Identify the primary source and exact reference.
2. Verify the Arabic text character-by-character against the primary collection or canonical Quran.
3. Record the narrator, collection, number, and named grading scholar where applicable.
4. Check the ruling/interpretation with a recognized Sunni scholar or institution; do not derive rulings from an API summary.
5. Check content rights and attribution separately from religious authenticity.
6. Add a regression test that prevents unreviewed content from entering the user interface and add the exact approved reference to the source allowlist.
7. Only then enable the content through a reviewed pull request.
