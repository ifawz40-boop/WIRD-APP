# WIRD — Owner Actions and External Decisions

**Current owner-action snapshot:** 2026-11-28 (Cloud Sync V4 — Bidirectional Additions & Deletions + Personal Per-Account Cloud Vault)  
**Live technical state:** [CONTINUE_HERE.md](./CONTINUE_HERE.md) · [MASTER_PROJECT_STATE.md](./engineering/MASTER_PROJECT_STATE.md)

> This page lists actions that genuinely require owner approval, external access, or physical-device testing. Dated material below the snapshot is historical unless explicitly revalidated.

## Current observed items

- **Optional Google Drive API activation for Personal Google Drive Vault (`wird-quran-app`, Project `741238306826`):**
  - Built-in Firebase Real-Time Sync V4 (additions + deletions), Live Linked Cloud Files (`iCloud Drive` / `OneDrive` / `Dropbox`), Smart JSON Merge, and `WIRD4` Sync Capsules work immediately with **zero** manual setup.
  - If the owner wants to use the optional **خزنة Google Drive الخاصة بحسابك (`drive.appdata`)** feature in Settings, ensure **Google Drive API** is enabled once on Google Cloud project `wird-quran-app` (`https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=741238306826`). Until enabled, the UI displays a direct 1-click activation link if Google returns `403 accessNotConfigured`.

0. **Complete Prophetic Seerah Digital Book (`feat/seerah-encyclopedia-ibn-kathir`) — PR push/review, CI verification & research-source license boundary:**
   - All 10 phases and all 17 acceptance criteria of `docs/seerah/MASTER_DIRECTIVE.md` (unmodified, SHA-256 `7a1e25cf...1472`) are completed and locally verified (`40` published chapters, `32` published character stories, `79,680` words, `52` verbatim Quran blocks, `43` verbatim Hadith blocks, `814 PASSED | 0 FAILED`, `vite build` PASS, Playwright E2E `4/4 PASS`).
   - **Research-source license note:** Imam Ibn Kathir's *Al-Sīra al-Nabawiyya* (d. 774 AH) is Public Domain; the digital Arabic transcription consulted during Phase 1 research (`0774IbnKathir.Bidaya.Shamela0000930-ara6`) is distributed by OpenITI under **CC BY-NC-SA 4.0** (free non-commercial educational use with attribution). The raw encyclopedia dump (`public/data/seerah-encyclopedia/`) has been removed from the shipped app; the shipped `public/data/seerah/` bundle contains newly authored third-person narrative prose plus verbatim Quranic verses from WIRD's local corpus and verbatim classical Hadith quotations.
   - **Git/CI boundary:** Changes are committed locally on `feat/seerah-encyclopedia-ibn-kathir` only (not pushed/merged to `main` or deployed to Vercel without explicit owner authorization). Upon authorization, push to a GitHub PR and inspect exact-head GitHub Actions `WIRD Quality Gate` (including Java Firestore Rules Emulator) and Vercel Preview before any merge.

1. **GitHub export/PR & CI verification of 2026-11-16 AI Studio workspace fixes:** the 2026-11-16 TypeScript, server typo, React timer cleanup, `NODE_ENV=production` Vite build, non-blocking Service Worker registration, and E2E selector updates exist in the Google AI Studio workspace only and were **not** committed/pushed to GitHub or deployed to Vercel (per explicit owner directive). Push to a feature branch/PR and run the GitHub Quality Gate (which executes `npm run test:firestore-rules` with Java) before promoting to `main`/Vercel.
2. **Production sync flags — owner decision required:** Vercel Production previously reported `VITE_WIRD_REVISIONED_SYNC_ENABLED=true` and `VITE_WIRD_REMOTE_PROJECTION_ENABLED=true` (2026-11-14). Neither value was changed. Decide separately whether to authorize disabling them while release gates are completed. Do not perform sync-related Production actions or toggle either value without explicit approval.
3. **Firebase (`wird-quran-app`) & AI Studio Preview Authorized Domains:** owner confirmed and workspace `firebase-applet-config.json` matches `projectId="wird-quran-app"`, `firestoreDatabaseId=""` (`(default)`), `authDomain="wird-quran-app.firebaseapp.com"`, `appId="1:741238306826:web:3db91a75a7b7dc5dae07f3"`. If testing Google Sign-In directly inside Google AI Studio Preview, add the preview `ais-dev-*.run.app` origin in Firebase Console -> Authentication -> Settings -> Authorized domains. Deployed Production Firestore Rules release remains NOT VERIFIED.
4. **Vercel access protection:** password protection is OFF; SSO protection is ON for all non-custom domains (`wird-app.vercel.app` is excluded). This does not by itself prove anonymous user access; read-only public smoke remains NOT VERIFIED. Do not change protection settings without approval.
5. **GitHub branch protection:** the 2026-11-14 branch-protection API read returned 403 `Resource not accessible by integration`. Current settings are NOT VERIFIED. Do not change branch protection or rulesets without an authorized read and owner decision.
6. **API credentials:** Vercel has sensitive `ISLAMICAPI_API_KEY` and `GEMINI_API_KEY` entries for Preview and Production. Values were not read and upstream validity was not tested. Do not paste secrets into chat or prompts.
7. **Real-device validation:** physical Android/iOS restart, airplane-mode, audio-download and cross-device sync scenarios remain NOT VERIFIED. Prefer automated multi-client/emulator coverage; request owner device testing only when no automated substitute exists.

## Approval boundaries

No Production settings, Vercel secrets, Firebase project/Rules/data, sync flags, user data, deployment promotion, manual deployment, or destructive migration may be changed without the specific owner authorization required by `AGENTS.md` and `CHANGE_CONTROL.md`.

---

## Historical owner actions

تُجمع هنا الخطوات التي تتطلب جهازًا حقيقيًا أو صلاحية مالك. لا توقف الأعمال الآلية المستقلة بسببها.

## حاليًا
1. **قرار بوابتي المزامنة في Production (عاجل):** القراءة غير المفكوكة لمتغيرات Vercel تؤكد أن `VITE_WIRD_REVISIONED_SYNC_ENABLED` و`VITE_WIRD_REMOTE_PROJECTION_ENABLED` موجهان إلى Production وقيمتهما `true`. قرر هل تأذن بتعطيلهما حتى اكتمال بوابات المزامنة؛ السبب أن اختبار A↔B الحقيقي وcutover الآمن لم يثبتا بعد. لم يتم تغيير أي قيمة. لا تُرسل أسرارًا.
2. **Google AI Studio:** تأكد من مزامنة المشروع المتصل بمستودع `xm8eslam-stack/WIRD-APP` وفرع `main` بعد دمج تغييرات الوثائق؛ لا تفترض أن commit GitHub يثبت مزامنة AI Studio.
3. **أجهزة حقيقية:** بعد نشر Production على SHA حديث، اختبر A↔B للمزامنة. يوجد نجاح محدود أبلغ عنه المالك، لكنه لا يغطي crash/offline الطويل.
4. **Offline audio:** بعد اكتمال الميزة، اختر سورة قصيرة واختبر التشغيل بعد قطع الإنترنت. لا إجراء الآن.
5. **سعة الجهاز:** إذا رفض المتصفح persistent storage أو كانت المساحة منخفضة، أفرغ مساحة قبل تنزيل صوت كبير.

## لا تنفذ دون موافقة منفصلة
- تعطيل أو تفعيل أي من بوابتي المزامنة في Production؛ القرار أعلاه مطلوب أولًا.
- تغيير Vercel/Firebase secrets أو environment variables.
- تغيير sync flags أو إعدادات الإنتاج.
- نشر يدوي أو ترقية Production خارج GitHub→Vercel.
- نشر Firestore Rules أو تعديل بيانات مستخدم حقيقية.

## إغلاق الإجراء
سجّل التاريخ والدليل في `CONTINUE_HERE.md` ثم انقله للمكتمل أو احذفه. لا تسجل أسرارًا أو بيانات حساب خاصة.


## لاحقًا — اعتماد Offline والتطبيق
1. **اختبار أجهزة فعلية بعد اجتياز بوابات الكود:** افتح PWA على هاتف Android وهاتف iOS/متصفح Safari عند توفرهما، جهّز الحزمة على اتصال ثابت، ثم فعّل وضع الطيران وأغلق التطبيق وافتحه مجددًا. اختبر القرآن والعبادات الأساسية والتقدم والصوت المحفوظ، ثم أعد الاتصال وتحقق من عدم تكرار أو فقد التغييرات. سجّل الجهاز/النظام/المتصفح ونتائج كل خطوة.
2. **قرار تغليف التطبيق:** لا يلزم الآن. بعد نجاح اختبارات PWA Offline، حدّد المنصات المستهدفة وأولوية الإشعارات والصوت بالخلفية وسياسات المتاجر قبل اختيار Capacitor أو TWA أو Native.
3. **أي قرار Production:** لا تغيّر Firebase Rules أو sync flags أو الأسرار أو بيانات المستخدمين كجزء من هذه الاختبارات دون موافقة مستقلة.


## إضافة متابعة — 2026-11-12

- [ ] **Offline على أجهزة حقيقية:** بعد توفر نسخة Preview قابلة للاختبار، جرّب Android وDesktop: تجهيز الحزمة، إغلاق المتصفح/التطبيق، تفعيل وضع الطيران، إعادة الفتح، قراءة القرآن المحفوظ، حفظ تقدم محلي، تجربة ملف صوت محفوظ فقط، ثم إعادة الاتصال والتحقق من replay مرة واحدة دون فقد أو تكرار. سجّل الجهاز والمتصفح وSHA والنتيجة.
- [ ] **السيرة:** مراجعة بشرية علمية ولغوية لكل claim ومصدر وطبعة/موضع قبل اعتماد أي فصل للنشر. لا يلزم تدخل المالك في تنفيذ shell/UX أو الاختبارات الآلية.
- [ ] **إعدادات الإنتاج:** لا تغيير لقواعد Firestore أو schema/data أو secrets أو sync flags أو Vercel settings ضمن هذا المسار دون موافقة صريحة مستقلة؛ حافظ على الحالة الحالية.

## إضافة متطلبات المالك — 2026-11-12
1. **اعتماد نظام الخطط والسعات:** لم يظهر في main حتى الآن مصدر entitlement/billing موثوق أو تعريف tiers. قبل فرض quota حسب الخطة، حدّد أسماء الخطط الفعلية وما الذي تسمح به كل خطة (عدد الخطط/إجمالي bytes/مزايا sync) أو اعتمد مصدر entitlement خادمي موجودًا. لا نحتاج قرارًا الآن لمواصلة أرشيف IndexedDB والـ chunks؛ لكن لا يجوز لنا اختراع خطط أو أرقام أو الاعتماد على claim يرسله العميل.
2. **طلب API الدرر السنية (اختياري لاحقًا):** لم يُرسل طلب. إذا رغبت باستخدام الموسوعة التاريخية كمرجع بحثي، راجع شروط API الحالية أولًا؛ تتطلب طلب وصول ومراجعة يدوية، إظهار نسبة المصدر ورابطه، تمنع bulk scraping/republication، وتقيّد cache بـ24–48 ساعة. لم يثبت أن الخدمة مجانية أو مناسبة تجاريًا؛ لا تضع أي token في العميل.
3. **مراجعة علمية للسيرة:** اختيار طبعة أساس معتمدة ومراجعة claims/المراجع قبل نشر المحتوى. لا يلزم تدخل المالك في تحسينات القارئ والاختبارات الآلية.


## Immediate owner action — 2026-11-14

Vercel Production currently has both `VITE_WIRD_REVISIONED_SYNC_ENABLED` and `VITE_WIRD_REMOTE_PROJECTION_ENABLED` set to `true`. This conflicts with the required policy that remote sync remain disabled until release gates pass.

No setting has been changed. Explicitly authorize disabling these two flags before any change is made. Until authorization, do not perform sync-related Production actions.
