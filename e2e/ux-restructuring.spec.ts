import { expect, test } from '@playwright/test';

const makePageSvg = (surah: number, ayahs: number[]) => {
  const markers = ayahs
    .map(
      (ayah, idx) =>
        `<path class="ayahPolygon" fill-opacity="0" id="verse-${ayah}" ayah="${ayah}" surah="${surah}" d="M 20 ${18 + idx * 30} L 200 ${18 + idx * 30} L 200 ${42 + idx * 30} L 20 ${42 + idx * 30} Z"/>`
    )
    .join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 400"><g id="content"><path d="M 10 10 L 230 10 L 230 390 L 10 390 Z" fill="#102d29"/></g><g id="ayah_markers">${markers}</g></svg>`;
};

test.describe('WIRD Master UX Restructuring E2E', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await page.addInitScript(({ p1, p2, p3, p4, seedUnifiedPlans }) => {
      if (seedUnifiedPlans) {
        const d = new Date();
        const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const futureStr = '2099-12-31';
        const makePlan = (id: string, title: string, date: string, surahNumber: number, surahName: string) => ({
          id,
          title,
          createdAt: new Date().toISOString(),
          isActive: true,
          isPaused: false,
          input: {
            title,
            startSurah: surahNumber,
            startAyah: 1,
            endSurah: surahNumber,
            endAyah: 5,
            level: 'intermediate',
            dailyAvailableMinutes: 20,
            dailyRevisionMinutes: 10,
            paceType: 'verses_per_day',
            paceQuantity: 5,
            activeDays: [0, 1, 2, 3, 4, 5, 6],
            restDays: [],
            startDate: date,
            schedulePreference: 'single_session'
          },
          totalUnits: 5,
          completedUnits: 0,
          completionPercentage: 0,
          totalVersesCount: 5,
          estimatedEndDate: date,
          estimatedDurationDays: 1,
          averageDailyMinutes: 20,
          weeklyHoursAverage: 2,
          pacingStatus: 'on_track',
          schedule: [
            {
              id: `${id}-day-1`,
              dayNumber: 1,
              date,
              dayNameAr: 'اليوم',
              isRestDay: false,
              status: 'pending',
              totalEstimatedMinutes: 20,
              memorizationTask: {
                id: `${id}-mem-1`,
                type: 'memorization',
                surahNumber,
                surahName,
                startAyah: 1,
                endAyah: 5,
                versesCount: 5,
                pagesCount: 1,
                estimatedMinutes: 20,
                completed: false,
                description: `حفظ ${surahName} 1-5`
              }
            }
          ]
        });

        localStorage.setItem(
          'wird_engine_plans',
          JSON.stringify([
            makePlan('plan-a', 'خطة جزء عمّ الأولى', todayStr, 78, 'النبأ'),
            makePlan('plan-b', 'خطة سورة الملك الثانية', todayStr, 67, 'الملك'),
            makePlan('plan-future', 'خطة مستقبلية مؤجلة', futureStr, 36, 'يس')
          ])
        );
      }

      const originalFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const url = typeof input === 'string' ? input : input instanceof Request ? input.url : '';
        if (url.endsWith('/mushafs/hafs/kfqc/svg/001.svg')) {
          return new Response(p1, { status: 200, headers: { 'content-type': 'image/svg+xml' } });
        }
        if (url.endsWith('/mushafs/hafs/kfqc/svg/002.svg')) {
          return new Response(p2, { status: 200, headers: { 'content-type': 'image/svg+xml' } });
        }
        if (url.endsWith('/mushafs/hafs/kfqc/svg/003.svg')) {
          return new Response(p3, { status: 200, headers: { 'content-type': 'image/svg+xml' } });
        }
        if (url.endsWith('/mushafs/hafs/kfqc/svg/004.svg')) {
          return new Response(p4, { status: 200, headers: { 'content-type': 'image/svg+xml' } });
        }
        if (url.includes('api.quran.com/api/v4/tafsirs/')) {
          return new Response(
            JSON.stringify({
              tafsir: {
                text: '<p>تفسير ميسر للآية المختارة للتحقق من العرض التفاعلي.</p>',
                resource_name: 'التفسير الميسر'
              }
            }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          );
        }
        return originalFetch(input, init);
      };
    }, {
      p1: makePageSvg(1, [1, 2, 3, 4, 5, 6, 7]),
      p2: makePageSvg(2, [1, 2, 3, 4, 5]),
      p3: makePageSvg(2, [6, 7, 8, 9, 10]),
      p4: makePageSvg(2, [17, 18, 19, 20]),
      seedUnifiedPlans: testInfo.title.includes('unified وردك اليوم')
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
    await expect(page.getByRole('heading', { name: /السلام عليكم ورحمة الله/ })).toBeVisible();
  });

  test('two-page printed Mushaf spread & dual-option Tafsir remember preferences per surface', async ({ page, isMobile }) => {
    await page.goto('/#/library');
    await page.getByRole('button', { name: 'فتح المصحف بالصفحات (604)' }).click();
    await page.getByRole('button', { name: 'الصفحة المطبوعة' }).click();

    if (isMobile) {
      await expect(page.getByText('الصفحة 1', { exact: true })).toBeVisible();
      await expect(page.getByRole('group', { name: 'صفحة المصحف المطبوعة رقم 2' })).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      return;
    }

    await expect(page.getByText('الصفحتان 1 – 2')).toBeVisible();
    await expect(page.getByRole('group', { name: 'صفحة المصحف المطبوعة رقم 1' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'صفحة المصحف المطبوعة رقم 2' })).toBeVisible();

    // Open Tafsir on page 1 -> verify both slide-over panel & opposite-page replacement + return button
    await page.getByRole('button', { name: 'تفسير الآية 2 من سورة الفاتحة' }).click();
    await expect(page.getByRole('button', { name: 'الآية التالية' })).toBeVisible();

    // Switch to slide-over side panel (keeps both facing pages visible)
    const panelBtn = page.getByRole('button', { name: 'لوحة جانبية' });
    await panelBtn.click();
    await expect(page.getByRole('complementary', { name: 'لوحة التفسير الجانبية' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'صفحة المصحف المطبوعة رقم 2' })).toBeVisible();

    // Switch to opposite-page replacement and verify "العودة لصفحة المصحف"
    await page.getByRole('button', { name: 'استبدال المقابلة' }).click();
    await expect(page.locator('section[aria-label="التفسير بدلاً من الصفحة المقابلة"]')).toBeVisible();
    await page.getByRole('button', { name: 'العودة لصفحة المصحف' }).click();
    await expect(page.getByRole('group', { name: 'صفحة المصحف المطبوعة رقم 2' })).toBeVisible();

    // Toggle to single-page spread in library and verify session keeps its independent preference
    await page.getByRole('button', { name: 'صفحة واحدة' }).click();
    await expect(page.getByText('الصفحة 1', { exact: true })).toBeVisible();

    await page.goto('/#/session?surah=1&start=1&end=7&mode=memorize');
    await page.getByRole('button', { name: 'مصحف مطبوع' }).click();
    await expect(page.getByText('الصفحتان 1 – 2')).toBeVisible();
  });

  test('connected-first session default supports inline word masking and anti-shortcut 5-stage recall gate', async ({ page }) => {
    await page.goto('/#/session?surah=1&start=1&end=3&mode=memorize');

    // Default view is Connected ("كل آيات الجلسة" / "صفحة متصلة")
    const pageList = page.getByRole('region', { name: 'كل آيات الجلسة' });
    await expect(pageList).toBeVisible();
    await expect(pageList.getByRole('button', { name: 'صفحة متصلة' })).toHaveAttribute('aria-pressed', 'true');

    // Inline word masking works directly inside Connected view
    await page.getByRole('button', { name: 'إخفاء تام' }).click();
    await expect(page.locator('#active-connected-ayah')).toBeVisible();
    const maskedWord = page.getByRole('button', { name: 'إظهار الكلمة رقم 1' });
    await expect(maskedWord).toBeVisible();
    await maskedWord.click();
    await expect(page.getByRole('button', { name: 'إظهار الكلمة رقم 1' })).toHaveCount(0);

    // Enable 5-stage Cumulative Linking & test recall gate blocks shortcutting
    await page.getByRole('button', { name: 'الربط التراكمي والمنهجي' }).click();
    await expect(page.getByText('المتقنة 0/3')).toBeVisible();

    await page.getByRole('button', { name: 'تثبيت الإتقان والانتقال للتالية' }).click();
    await expect(page.getByRole('alert')).toContainText('تحقق من الاسترجاع بدون نظر');
    await expect(page.getByText('المتقنة 0/3')).toBeVisible();

    // Verify recall -> unlock mastery -> confirm & reload durability
    await page.getByRole('button', { name: 'تحقق من الاسترجاع بدون نظر' }).click();
    await page.getByRole('button', { name: 'تثبيت الإتقان والانتقال للتالية' }).click();
    await expect(page.getByText('المتقنة 1/3')).toBeVisible();

    await page.reload();
    await expect(page.getByText('المتقنة 1/3')).toBeVisible();
  });

  test('reciter changes sync immediately across Session, Library, and Ruqyah and persist', async ({ page }) => {
    await page.goto('/#/session?surah=1&start=1&end=3&mode=memorize');
    await page.getByRole('button', { name: /إعدادات العرض والصوت/ }).click();

    const sessionReciterSelect = page.getByRole('combobox', { name: 'اختيار القارئ في الجلسة' });
    await sessionReciterSelect.selectOption('husary');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('wird.audio.preferredReciter.v1'))).toBe('husary');

    // Ruqyah reflects synced Husary reciter immediately
    await page.goto('/#/ruqyah');
    await expect(page.getByRole('combobox', { name: 'اختيار قارئ الرقية' })).toHaveValue('ar.husary');

    // Change in Ruqyah to Abdul Basit -> reflects back in Session
    await page.getByRole('combobox', { name: 'اختيار قارئ الرقية' }).selectOption('ar.abdulbasit');
    await page.goto('/#/session?surah=1&start=1&end=3&mode=memorize');
    const returnDisplayToggle = page.getByRole('button', { name: /إعدادات العرض والصوت/ });
    if ((await returnDisplayToggle.getAttribute('aria-expanded')) !== 'true') {
      await returnDisplayToggle.click();
    }
    await expect(page.getByRole('combobox', { name: 'اختيار القارئ في الجلسة' })).toHaveValue('abdulbasit');
  });

  test('unified وردك اليوم shows all active plan due tasks without showing future tasks as due today', async ({ page }) => {
    const hubSection = page.getByRole('region', { name: 'وردك اليوم' });
    await expect(hubSection).toContainText('خطة جزء عمّ الأولى');
    await expect(hubSection).toContainText('خطة سورة الملك الثانية');
    await expect(hubSection).not.toContainText('خطة مستقبلية مؤجلة');
    await expect(page.getByRole('progressbar')).toHaveCount(9);
  });

  test('opposite-page Tafsir navigation steps one page at a time (1 -> 2 -> 3 -> 2) without skipping page 2', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Two-page spread opposite Tafsir is desktop-only (>=768px)');
    await page.goto('/#/library');
    await page.getByRole('button', { name: 'فتح المصحف بالصفحات (604)' }).click();
    await page.getByRole('button', { name: 'الصفحة المطبوعة' }).click();

    await expect(page.getByRole('group', { name: 'صفحة المصحف المطبوعة رقم 1' })).toBeVisible();
    await page.getByRole('button', { name: 'تفسير الآية 1 من سورة الفاتحة' }).click();
    await page.getByRole('button', { name: 'استبدال المقابلة' }).click();
    await expect(page.locator('section[aria-label="التفسير بدلاً من الصفحة المقابلة"]')).toBeVisible();
    await expect(page.getByText('الصفحة 1 · التفسير مقابلها')).toBeVisible();

    // Advance Next -> must reveal page 2 (NOT jump to page 3) and offer quick sync Tafsir for page 2
    await page.getByRole('button', { name: 'الصفحة التالية' }).click();
    await expect(page.getByRole('group', { name: 'صفحة المصحف المطبوعة رقم 2' })).toBeVisible();
    await expect(page.getByText('الصفحة 2 · التفسير مقابلها')).toBeVisible();
    const syncPage2Btn = page.locator('section[aria-label="التفسير بدلاً من الصفحة المقابلة"]').getByRole('button', { name: 'تفسير صفحة 2' });
    await expect(syncPage2Btn).toBeVisible();

    // Sync Tafsir to page 2 -> updates opposite slot cleanly while page 2 stays visible
    await syncPage2Btn.click();
    await expect(page.locator('section[aria-label="التفسير بدلاً من الصفحة المقابلة"]')).toContainText('البقرة');

    // Advance Next again -> moves to page 3, and Previous returns to page 2
    await page.getByRole('button', { name: 'الصفحة التالية' }).click();
    await expect(page.getByRole('group', { name: 'صفحة المصحف المطبوعة رقم 3' })).toBeVisible();
    await page.getByRole('button', { name: 'الصفحة السابقة' }).click();
    await expect(page.getByRole('group', { name: 'صفحة المصحف المطبوعة رقم 2' })).toBeVisible();
  });

  test('memorization session completion button opens centered modal for cumulative linking and persists completion', async ({ page }) => {
    await page.goto('/#/session?surah=1&start=1&end=2&mode=memorize');

    // Enable Cumulative Linking and verify explicit top completion button opens accessible centered modal
    await page.getByRole('button', { name: 'الربط التراكمي والمنهجي' }).click();
    await page.getByRole('button', { name: 'إنهاء وإتمام الجلسة' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('تأكيد إتمام كامل المقطع');

    await dialog.getByRole('button', { name: 'تأكيد إتمام كامل المقطع' }).click();
    await expect(page.getByRole('heading', { name: /أتممت وِرد الحفظ اليومي بنجاح/ })).toBeVisible();
  });

  test('printed Mushaf in memorization session highlights range, navigates safely, and returns to active ayah', async ({ page, isMobile }) => {
    await page.goto('/#/session?surah=1&start=1&end=5&mode=memorize');
    await page.getByRole('button', { name: 'مصحف مطبوع' }).click();

    // Highlighted session ayahs present; clicking ayah selects without forcing Tafsir panel open
    await expect(page.locator('[data-session-ayah="true"]').first()).toBeVisible();
    await page.getByRole('button', { name: 'تفسير الآية 3 من سورة الفاتحة' }).click();
    await expect(page.locator('section[aria-label="التفسير بدلاً من الصفحة المقابلة"]')).toHaveCount(0);
    await expect(page.getByRole('complementary', { name: 'لوحة التفسير الجانبية' })).toHaveCount(0);

    // Explicit Tafsir button opens Tafsir for the active ayah
    await page.getByRole('button', { name: 'تفسير الآية الحالية' }).click();
    if (isMobile) {
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByRole('button', { name: 'إغلاق التفسير' }).click();
    } else {
      await expect(page.getByRole('complementary', { name: 'لوحة التفسير الجانبية' })).toBeVisible();
      await page.getByRole('button', { name: 'إغلاق التفسير' }).click();
    }

    // Browse forward inside Printed Mushaf -> return banner brings user right back to session ayah
    await page.getByRole('button', { name: 'صفحة المصحف التالية في الجلسة' }).click();
    await expect(page.getByRole('button', { name: /العودة إلى آية الجلسة/ })).toBeVisible();
    await page.getByRole('button', { name: /العودة إلى آية الجلسة/ }).click();
    await expect(page.getByRole('group', { name: 'صفحة المصحف المطبوعة رقم 1' })).toBeVisible();
  });

  test('multi-Khatma creation, saving progress in Printed Mushaf, undo, and instant resume from Dashboard', async ({ page }) => {
    await page.goto('/#/library');

    // Create first reading khatma with defaults
    await page.getByRole('button', { name: 'بدء ختمة جديدة' }).click();
    await expect(page.getByRole('progressbar', { name: 'تقدم ختمة القراءة' })).toBeVisible();

    // Create second reading khatma with custom name
    await page.getByRole('button', { name: 'إنشاء ختمة جديدة' }).click();
    await page.getByRole('textbox', { name: 'اسم ختمة القراءة' }).fill('ختمة التثبيت اليومي');
    await page.getByRole('button', { name: 'بدء ختمة جديدة' }).click();
    await expect(page.getByRole('tablist', { name: 'الختمات النشطة' }).getByRole('tab')).toHaveCount(2);

    // Continue active khatma inside Mushaf -> Printed mode keeps save bar visible, marks & undoes cleanly
    await page.getByRole('button', { name: /متابعة القراءة/ }).click();
    await page.getByRole('button', { name: 'الصفحة المطبوعة' }).click();

    await page.getByRole('button', { name: 'تسجيل الصفحة كمقروءة' }).click();
    await expect(page.getByRole('button', { name: 'تم تسجيل الصفحة كمقروءة' })).toBeVisible();
    await page.getByRole('button', { name: 'تراجع' }).click();
    await expect(page.getByRole('button', { name: 'تسجيل الصفحة كمقروءة' })).toBeVisible();

    // Navigate to page 2 and verify quick Dashboard resume returns straight to Mushaf reader
    await page.getByRole('button', { name: 'الصفحة التالية' }).click();
    await page.reload();

    await page.goto('/#/dashboard');
    const quickResumeBtn = page.getByRole('region', { name: 'ختمات القراءة المتعددة والاستكمال السريع' }).getByRole('button', { name: /استكمال · ص/ }).first();
    await expect(quickResumeBtn).toBeVisible();
    await quickResumeBtn.click();
    await expect(page.getByRole('region', { name: 'متابعة ورد القراءة والختمة' })).toBeVisible();
  });
});
