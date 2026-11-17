# GOOGLE AI STUDIO — Current handoff overlay — 2026-11-17

> This is the current operational overlay. It supersedes older SHA/deployment/PR status below. Workspace edits in Google AI Studio are NOT yet pushed to GitHub or deployed to Vercel.

- **Date:** 2026-11-17
- **Environment:** Google AI Studio (`/app/applet`)
- **Repository:** `xm8eslam-stack/WIRD-APP` · **Expected base branch:** `main` (last refreshed snapshot: `f264e4bdea7496090f60940e9e8db03e2fb15696` / code merge `d265bdf37e9410ad6cd99273bb595526dce63b50`)
- **Firebase Config Verified (`firebase-applet-config.json`):** `projectId="wird-quran-app"`, `firestoreDatabaseId=""` (`(default)`), `authDomain="wird-quran-app.firebaseapp.com"`, `appId="1:741238306826:web:3db91a75a7b7dc5dae07f3"`.
- **Modified files (workspace local only):**
  - App/API/Server/Build/PWA/Services (2026-11-16 + 2026-11-17): `package.json`, `src/main.tsx`, `public/sw.js`, `api/advisor.ts`, `server.ts`, `src/services/authService.ts`, `src/services/advisorService.ts`, `src/components/brand/BrandDesignShowcase.tsx`, `src/components/settings/SettingsView.tsx`, `src/components/assistant/QuranAdvisorView.tsx`, `src/components/ruqyah/RuqyahView.tsx`, `src/components/plans/PlanningEngineWizard.tsx`
  - Unit & E2E tests: `src/tests/geminiSecurity.test.ts`, `src/tests/firebaseAuth.test.ts`, `e2e/advisor-ux.spec.ts`, `e2e/plans-ux.spec.ts`, `e2e/ruqyah-ux.spec.ts`, `e2e/memorization-audio-repeat.spec.ts`, `e2e/memorization-session-display-ux.spec.ts`, `e2e/progress-ux.spec.ts`, `e2e/wird-navigation-tafsir.spec.ts`
  - Documentation reconciled: `docs/CONTINUE_HERE.md`, `docs/engineering/MASTER_PROJECT_STATE.md`, `docs/engineering/RELEASE_CHECKLIST.md`, `docs/OWNER_ACTIONS.md`, `docs/engineering/WORK_LOG.md`, `docs/agent-handoffs/LATEST-GOOGLE-STUDIO.md`
- **Root causes addressed:**
  1. `NODE_ENV=development` exported by the Studio container caused `vite build` to emit `jsxDEV` transforms and set `import.meta.env.PROD=false`, suppressing Service Worker registration -> pinned `NODE_ENV=production vite build` in `package.json`.
  2. External font stylesheets stalled `window.load` and blocked `precacheQuranFont()` in SW install -> moved SW registration to ready DOM / `DOMContentLoaded` (`src/main.tsx`) and made font precaching non-blocking after shell precache (`public/sw.js`).
  3. TypeScript narrowing on `userData` in `api/advisor.ts`, Arabic rate-limit copy typo in `server.ts`, Persian typo (`کاربر` -> `مستخدم`) in `src/services/authService.ts` null-user guards, and uncleaned timers in `BrandDesignShowcase.tsx` (`copyTimerRef`) and `RuqyahView.tsx` (`autoAdvanceTimerRef`).
  4. `SettingsView.tsx` exposed resolution buttons for `weakVerses`/`activityEvents` conflicts that fail closed in `syncConflictResolutionService.ts` -> wired `containsUnsafeFullSnapshotProjection()` directly into conflict UI.
  5. `QuranAdvisorView.tsx` calculator rendered `NaN يوماً` when daily minutes input was cleared/invalid and computed 600 instead of 604 pages for full Quran (`30` ajza); also lacked unmount guard on `checkStatus()` and `maxLength={500}` matching server limit. `AdvisorService` sent unbounded chat histories exceeding the 4,096-byte server cap and didn't clean abort timeouts in `finally` blocks -> added `buildBoundedChatPayload()` and `finally { clearTimeout(timeoutId); }`.
  6. `PlanningEngineWizard.tsx` allowed `0`/`NaN` in `paceQuantity` inputs while editing -> added `safePaceQuantity`, preview validation, and `onBlur` normalization.
- **Tests executed & observed (final state):**
  - `npx tsc --noEmit`: **PASS**
  - `npm test`: **PASS** (`733 PASSED | 0 FAILED`)
  - `npm run build`: **PASS** (`2.07s`; chunks < 500 kB; `/sw.js` active without `jsxDEV`; 9-asset shell manifest + 252 lazy assets)
  - `npm run mushaf:validate-coverage`: **PASS** (604 SVG pages / 6,236 unique local ayahs mapped once)
  - `npm run smoke:api-imports` & `npm run smoke:server`: **PASS**
  - Desktop + Mobile Playwright (all 18 `e2e/*.spec.ts` files): **PASS** (`164` passed, `2` intentionally skipped, `0` failed; covers offline shell reload, 252-asset full offline preparation, and calculator `NaN` regression)
  - `npm run test:firestore-rules`: **BLOCKED** (Java runtime not installed in Studio container: `Could not spawn java -version`)
- **Commit / Push / Deployment status:** NOT COMMITTED / NOT PUSHED / NOT DEPLOYED TO VERCEL (explicit owner directive: `"التحديث متنشرش على فيرسل"`).
- **Status:** Partial (workspace implementation & local verification complete; GitHub PR/CI with Java Firestore Emulator and Production deployment remain external next steps).
- **Next recommended step:** Export/push workspace changes to a GitHub feature branch/PR, run full Quality Gate CI (including Firestore Rules Emulator), add preview origin (`ais-dev-*.run.app`) to Firebase Console Authorized Domains if preview login is needed, and await owner approval on Vercel sync flags before Production rollout.

---


# أولوية تسليم جديدة — Offline-first / app readiness (2026-11-12)

- اجعل Offline-first مسارًا رئيسيًا متوازيًا مع القرآن والعبادات والسيرة وUX والمزامنة.
- اقرأ docs/offline/OFFLINE_FIRST_ARCHITECTURE.md وAPP_READINESS_ROADMAP_AR.md وOFFLINE_CAPABILITY_MATRIX_AR.md.
- PWA الحالي هو الأساس؛ حافظ على service worker وحزمة التحضير والتخزين المحلي. لا تعِد كتابة هذه الطبقات دون سبب مقاس.
- راجع public asset manifest، lazy route coverage، navigation timeout، StorageManager مقابل persist support، cache namespaces، وAuthGate offline restoration.
- اختبر local-first behavior بعد restart وفي airplane mode، مع quota/eviction/update. لا تدّعِ اكتمالًا دون browser/device evidence.
- الشبكات الخارجية وFirebase/Auth والـ API الحي والمحتوى غير المحفوظ تحتاج اتصالًا. لا تخزن tokens أو بيانات مستخدم في shared caches.
- الصوت المثبت ليس cache انتهازيًا؛ راجع الحقوق قبل التنزيل. EveryAyah stream-only حاليًا.
- Capacitor/TWA/native مؤجل حتى نجاح PWA offline gates.
- PR #366 للكود وPR #363 للوثائق؛ لا تعدّل نفس الملفات بين الفرعين. افحص exact SHA/checks/deployment قبل الدمج.

---

# WIRD — Google AI Studio handoff (live checkpoint 2026-11-12 01:31 +02:00)

- GitHub `main` remains `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`; Vercel Production deployment `dpl_DKfbfqsBHqzS95CoTdYZCtPPPZwu` is READY on the exact same SHA. This is deployment evidence only.
- Main Quality Gate run `43079260528` failed before steps/logs (`BlobNotFound`); no test-level diagnosis or pass.
- PR #363 last checked head `acdfeef4e4baf99251e4768bbbc808fabab4f130`, base `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`, OPEN / DRAFT / HOLD. Exact-head run `43120106137` / job `130858118105` failed before steps (`steps=null`); logs `BlobNotFound`; one annotation could not be retrieved. No test-level diagnosis.
- Vercel Preview deployment `dpl_CcBtjR4TRcqJd9pNwSZTvkgS2LHA` is READY on that exact PR head. The current documentation update creates a new head; re-fetch its checks. Preview does not replace CI or Production.
- PR #361/#362/#354 are merged. #358/#359 remain overlapping unmerged Drafts; #362 fixes their guest-entry test helper, but unified storage implementation is still not built. #364 remains Draft with unresolved no-steps CI; PR #2 is 115 ahead / 469 behind and must not merge wholesale.
- Production sync flags were observed true; do not change them without explicit owner approval.
- Google AI Studio synchronization itself is NOT VERIFIED.
- Seerah remains a planned continuous book (parts → chapters → narrative scenes), with claim-level sources and optional contextual aids. See Seerah §§16–17 and UX §§6–7.


---
## Seerah API research — follow-up 2026-11-11

- Read the actual Islamic Network People/Events OpenAPI JSON. People records support language-keyed biographies, dates, person type, linked event/quote/story aggregates and related people; Arabic may be absent per record. Events is calendar-oriented and uses Hijri month/day anniversaries distinct from the optional historical year; do not treat it as a complete chronological Seerah source.
- SeerahBook is a read-only graph with per-IP limits and provenance, but its content is based on a specific lecture series; its own About page labels approximate/disputed/weak reports and possible dramatized wording. Never present reconstructed wording as verbatim quotation.
- Dorar's official API terms prohibit bulk download/republication, require attribution + clickable source URL and server-side token, limit cache to 24–48h, 60 req/min, and require approval/preview review. It cannot be used as a permanent offline corpus.
- WIRD should publish from its own reviewed/versioned Seerah Content Registry; APIs are discovery/verification adapters only until rights for offline/republication are confirmed.
- Read `docs/SEERAH_LEARNING_PLAN_AR.md` section 14 and `docs/DEVELOPMENT_ROADMAP.md` before implementing.
- CI retry evidence for previous PR #363 head: run `43051925917` failed with no recorded steps/logs; rerun job `130632989788` failed the same way. Do not treat as test-level failure or pass. Re-fetch the new PR head and exact-head gate.
- No runtime integration, API content ingestion, secrets, Firebase changes, production changes or deployment was performed.

---

# Follow-up handoff — 2026-11-11 (Seerah learning roadmap)

> This section supersedes earlier status snapshots only for the new Seerah feature direction. Re-fetch live repository/PR/CI/deployment state before acting.

- New specialist plan: `docs/SEERAH_LEARNING_PLAN_AR.md`.
- Product priority: Quran memorization/revision remains first; Seerah of the Prophet ﷺ and Companions is the second core learning feature.
- The planned experience is a connected historical book (parts → linked chapters → narrative scenes). Optional people/place cards, sourced maps and timeline, reflection prompts, and chapter/part comprehension checks support the story without interrupting continuous reading. Save reading position and content version locally; offline access applies only to approved content.
- API research is preliminary: SeerahBook (read-only people/events/place graph, based on a specific lecture series), Dorar Historical Encyclopedia API (manual approval and bearer token), and Islamic Network People/Events (Early Access). No provider is approved or integrated.
- Do not ingest/publish API data automatically. Every claim and quiz item needs source references and editorial review; no AI-authored historical/religious content, no unlicensed book reproduction, and no depictions of the Prophet ﷺ or Companions.
- Read `docs/CONTINUE_HERE.md`, `docs/DEVELOPMENT_ROADMAP.md`, and `docs/SEERAH_LEARNING_PLAN_AR.md` before planning this feature.
- Documentation-only changes are on PR #363 branch `docs/wird-docs-roadmap-reconciled-20261111`; exact current head and CI must be fetched before any merge decision. Production and Google AI Studio sync are not proven by these commits.
- No runtime code, Firebase/Firestore, production data/settings, secrets, sync flags, or deployment configuration changed.

---

# GOOGLE AI STUDIO — Latest handoff (2026-11-11 16:30 +02:00)

Repository: `xm8eslam-stack/WIRD-APP`; source branch expected: `main`.
Latest main SHA: `2c9aa9722592ae7f9f0f317cc15cf9fe6ffd6cfe`.
PR #362 merged (`cfe9458e55bd4e66a51e57ce5a5c16e83b65becd`): guest-entry hydration test helper.
PR #361 merged (`2c9aa9722592ae7f9f0f317cc15cf9fe6ffd6cfe`): EveryAyah stays stream-only; legacy cached entries pruned.
PR #360 closed as superseded; replacement docs PR #363 remains Draft. Its first Quality Gate run and rerun failed before job steps/logs appeared; do not treat as passed.
PR #356 closed as superseded; pure range planner is already in main from #355; unique activity cutover protocol was preserved in the sync design document.
PR #358/#359 remain unmerged and overlap in manifest responsibilities. Follow `docs/offline/OFFLINE_AUDIO_STORAGE_CONTRACT.md`; do not merge either unchanged.
Production source SHA/live smoke and Google AI Studio sync remain NOT VERIFIED.

> Read `AGENTS.md`, then `docs/CONTINUE_HERE.md`, `docs/DEVELOPMENT_ROADMAP.md`, and `docs/DOCUMENTATION_CATALOG.md` before making changes.

---
## PR #363 — الحالة الحية

- PR #363 مفتوح كـ Draft على الفرع `docs/wird-docs-roadmap-reconciled-20261111`، مبني على main الحالي `2c9aa9722592ae7f9f0f317cc15cf9fe6ffd6cfe`.
- أول Quality Gate run `43039009676` فشل على job واحد؛ إعادة التشغيل attempt 2 انتهت بالفشل خلال ثوانٍ دون أي job steps أو logs متاحة. هذا ليس نجاحًا ولا فشل اختبار موثقًا؛ CI غير محسوم.
- لا تدمج حتى يعمل Quality Gate على الرأس النهائي وتظهر كل خطوات الاختبار.

---
# WIRD — أحدث حالة موثقة

آخر تحقق من GitHub: 2026-11-11 16:15 +02:00
آخر main: `2c9aa9722592ae7f9f0f317cc15cf9fe6ffd6cfe`.
PR #362 مدمج: `cfe9458e55bd4e66a51e57ce5a5c16e83b65becd` — إصلاح انتظار guest-entry hydration، Quality Gate PASS.