import { expect, test, type Page } from '@playwright/test';
import { ALL_SURAHS } from '../src/data/quranMeta';
import { getMushafFacsimilePageUrls, MUSHAF_OFFLINE_CACHE_NAME } from '../src/services/mushafFacsimileService';

const quranEncVersionMockedPages = new WeakSet<Page>();

async function enableSpreadIfAvailable(page: Page) {
  const spreadButton = page.getByRole('button', { name: 'صفحتان متقابلتان' });
  if (await spreadButton.isVisible().catch(() => false)) await spreadButton.click();
}

async function mockQuranEncVersion(page: Page) {
  if (quranEncVersionMockedPages.has(page)) return;
  quranEncVersionMockedPages.add(page);
  await page.route(/^https:\/\/quranenc\.com\/api\/v1\/translations\/list\/ar\/?(?:\?.*)?$/, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        translations: [{ key: 'arabic_moyassar', version: '1.0.1', last_update: 1794182400 }]
      })
    });
  });
}


test.describe('WIRD navigation and memorization tafsir UX', () => {
  test.beforeEach(async ({ page }) => {
    // Register the external metadata fixture before app startup or service-worker activity.
    await mockQuranEncVersion(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
  });

  test('mobile navigation keeps core destinations visible and groups secondary pages in More', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const bottomNav = page.getByRole('navigation', { name: 'التنقل السريع' });
    await expect(bottomNav).toBeVisible();
    await expect(bottomNav.getByRole('button', { name: 'الرئيسية' })).toBeVisible();
    await expect(bottomNav.getByRole('button', { name: 'القرآن' })).toBeVisible();
    await expect(bottomNav.getByRole('button', { name: 'الحفظ' })).toBeVisible();
    await expect(bottomNav.getByRole('button', { name: 'المراجعة' })).toBeVisible();

    await bottomNav.getByRole('button', { name: 'المزيد من الأقسام' }).click();
    const drawerNav = page.getByRole('navigation', { name: 'القائمة الرئيسية' });
    await expect(drawerNav).toBeVisible();
    await expect(drawerNav.getByText('الحفظ والتثبيت')).toBeVisible();
    await expect(drawerNav.getByText('المتابعة والمساندة')).toBeVisible();
    await expect(drawerNav.getByRole('button', { name: 'اختبارات الحفظ' })).toBeVisible();
    await expect(drawerNav.getByRole('button', { name: 'الإعدادات' })).toBeVisible();
  });

  test('memorization tafsir is collapsed by default and can be toggled without leaving the session', async ({ page }) => {
    await page.goto('/#/session?surah=67&start=1&end=3&mode=memorize');

    const tafsirToggle = page.locator('section[aria-labelledby="session-tafsir-title"] > button');
    await expect(tafsirToggle).toBeVisible();
    await expect(tafsirToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByLabel('مصدر التفسير في الجلسة')).toHaveCount(0);

    await tafsirToggle.click();
    await expect(tafsirToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByLabel('مصدر التفسير في الجلسة')).toBeVisible();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('wird_session_tafsir_expanded_v1'))).toBe('1');

    await tafsirToggle.click();
    await expect(tafsirToggle).toHaveAttribute('aria-expanded', 'false');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('wird_session_tafsir_expanded_v1'))).toBe('0');
    await expect(page.getByText(/الآية 1 \(نطاق 1–3\)/)).toBeVisible();
  });

  test('Space shortcut ignores focused controls while masked words remain keyboard operable', async ({ page }) => {
    await page.goto('/#/session?surah=67&start=1&end=3&mode=memorize');
    const repeatCounter = page.getByRole('heading', { name: /التكرار والتثبيت/ });
    await expect(repeatCounter).toContainText('0 /');

    await page.getByRole('button', { name: 'إخفاء تام' }).click();
    const maskedWord = page.getByRole('button', { name: 'إظهار الكلمة رقم 1' });
    await expect(maskedWord).toBeVisible();
    await maskedWord.focus();
    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: 'إظهار الكلمة رقم 1' })).toHaveCount(0);
    await expect(repeatCounter).toContainText('0 /');

    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
    await page.keyboard.press('Space');
    await expect(repeatCounter).toContainText('1 /');
  });

  test('session controls keep comfortable touch targets on a phone viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#/session?surah=67&start=1&end=3&mode=memorize');

    await expect(page.getByRole('button', { name: 'إخفاء تام' })).toHaveCSS('min-height', '44px');
    await expect(page.getByRole('button', { name: /\+ تكرار/ })).toHaveCSS('min-height', '44px');
    await page.getByRole('button', { name: /إعدادات العرض والصوت/ }).click();
    await expect(page.getByRole('combobox', { name: 'سرعة تشغيل الصوت' })).toHaveCSS('min-height', '44px');
    const navigation = page.getByRole('group', { name: 'التنقل بين آيات جلسة الحفظ' });
    await expect(navigation.getByRole('button', { name: 'السابقة' })).toHaveCSS('min-height', '56px');
    await expect(navigation.getByRole('button', { name: 'الآية التالية' })).toHaveCSS('min-height', '56px');
  });

  test('Quran study cards expose adjacent ayah controls directly below each ayah', async ({ page }) => {
    await page.getByRole('button', { name: /^(القرآن|القرآن والمصحف)$/ }).click();
    await page.getByRole('button', { name: 'فتح سورة الفاتحة للدراسة' }).click();

    const firstAyahCard = page.locator('#study-ayah-1');
    await expect(firstAyahCard).toBeVisible();
    const navigation = firstAyahCard.getByRole('navigation', { name: 'التنقل بين الآيات' });
    await expect(navigation).toBeVisible();
    await expect(navigation.getByRole('button', { name: 'الآية السابقة' })).toBeDisabled();

    await navigation.getByRole('button', { name: 'الآية التالية' }).click();
    await expect(page.locator('#continuous-ayah-2')).toBeVisible();
  });

  test('Mushaf exposes previous and next ayah controls directly below the displayed page', async ({ page }) => {
    await page.getByRole('button', { name: /^(القرآن|القرآن والمصحف)$/ }).click();
    await page.getByRole('button', { name: 'فتح المصحف بالصفحات (604)' }).click();

    await expect(page.locator('#wird-ayah-1-1')).toBeVisible();
    const navigation = page.getByRole('navigation', { name: 'التنقل بين الآيات' }).last();
    await expect(navigation).toBeVisible();
    await expect(navigation.getByRole('button', { name: 'الآية السابقة' })).toBeDisabled();
    await expect(navigation.getByRole('button', { name: 'الآية التالية' })).toBeEnabled();

    await navigation.getByRole('button', { name: 'الآية التالية' }).click();
    await expect(page.locator('#wird-ayah-1-2')).toBeVisible();
    await expect(navigation).toContainText('1:2');
  });

  test('Mushaf bottom page navigation works in single and facing-spread modes with correct boundaries', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 1280) < 768, 'Facing spread navigation is desktop-only.');

    await page.getByRole('button', { name: /^(القرآن|القرآن والمصحف)$/ }).click();
    await page.getByRole('button', { name: 'فتح المصحف بالصفحات (604)' }).click();

    const navigation = page.getByRole('navigation', { name: 'التنقل بين صفحات المصحف' });
    const previous = navigation.getByRole('button', { name: 'الصفحة السابقة' });
    const next = navigation.getByRole('button', { name: 'الصفحة التالية' });
    await expect(navigation).toContainText('1 / 604');
    await expect(previous).toBeDisabled();
    await expect(next).toBeEnabled();
    await expect(previous).toHaveCSS('min-height', '56px');
    await expect(next).toHaveCSS('min-height', '56px');

    await next.click();
    await expect(navigation).toContainText('2 / 604');
    await previous.click();
    await expect(navigation).toContainText('1 / 604');

    await page.getByRole('spinbutton', { name: 'رقم صفحة المصحف' }).fill('604');
    await page.getByRole('button', { name: 'انتقال إلى رقم الصفحة' }).click();
    await expect(navigation).toContainText('604 / 604');
    await expect(next).toBeDisabled();
    await expect(previous).toBeEnabled();

    await page.getByRole('spinbutton', { name: 'رقم صفحة المصحف' }).fill('1');
    await page.getByRole('button', { name: 'انتقال إلى رقم الصفحة' }).click();
    await page.getByRole('button', { name: 'الصفحة المطبوعة', exact: true }).click();
    const spreadMode = page.getByRole('group', { name: 'نمط صفحات المصحف المطبوع' });
    await spreadMode.getByRole('button', { name: 'صفحتان متقابلتان' }).click();

    await next.click();
    await expect(navigation).toContainText('3 / 604');
    await previous.click();
    await expect(navigation).toContainText('1 / 604');

    await page.getByRole('spinbutton', { name: 'رقم صفحة المصحف' }).fill('603');
    await page.getByRole('button', { name: 'انتقال إلى رقم الصفحة' }).click();
    await expect(navigation).toContainText('603 / 604');
    await expect(next).toBeDisabled();
  });

  test('printed Mushaf can switch between one page and a right-to-left facing spread', async ({ page }) => {
    await page.getByRole('button', { name: /^(القرآن|القرآن والمصحف)$/ }).click();
    await page.getByRole('button', { name: 'فتح المصحف بالصفحات (604)' }).click();
    await page.getByRole('button', { name: 'الصفحة المطبوعة', exact: true }).click();

    const displayMode = page.getByRole('group', { name: 'نمط صفحات المصحف المطبوع' });
    if ((page.viewportSize()?.width ?? 1280) < 768) {
      await expect(displayMode).toHaveCount(0);
      await expect(page.locator('svg[aria-label="صفحة المصحف المطبوعة رقم 1"]')).toBeVisible();
      await expect(page.locator('svg[aria-label="صفحة المصحف المطبوعة رقم 2"]')).toHaveCount(0);
      return;
    }
    await expect(displayMode.getByRole('button', { name: 'صفحة واحدة' })).toHaveAttribute('aria-pressed', 'true');
    await displayMode.getByRole('button', { name: 'صفحتان متقابلتان' }).click();

    const spread = page.getByRole('main', { name: 'صفحتا المصحف 1 و2' });
    await expect(spread).toBeVisible();
    await expect(spread.locator('svg[aria-label="صفحة المصحف المطبوعة رقم 1"]')).toBeVisible();
    await expect(spread.locator('svg[aria-label="صفحة المصحف المطبوعة رقم 2"]')).toBeVisible();
    await expect(spread.locator('[aria-label="الصفحة اليسرى رقم 2"]')).toBeVisible();
    await expect(spread.locator('[aria-label="الصفحة اليمنى رقم 1"]')).toBeVisible();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('wird.quran.pageDisplayMode.v1'))).toBe('spread');

    await page.getByRole('button', { name: 'الصفحتان التاليتان' }).click();
    const nextSpread = page.getByRole('main', { name: 'صفحتا المصحف 3 و4' });
    await expect(nextSpread.locator('svg[aria-label="صفحة المصحف المطبوعة رقم 3"]')).toBeVisible();
    await expect(nextSpread.locator('svg[aria-label="صفحة المصحف المطبوعة رقم 4"]')).toBeVisible();

    await displayMode.getByRole('button', { name: 'صفحة واحدة' }).click();
    await expect(page.getByRole('main', { name: 'صفحة المصحف 3' }).locator('svg[aria-label="صفحة المصحف المطبوعة رقم 3"]')).toBeVisible();
    await expect(page.locator('svg[aria-label="صفحة المصحف المطبوعة رقم 4"]')).toHaveCount(0);
  });

  test('printed Mushaf page opens offline from the explicitly downloaded facsimile cache', async ({ page, context }) => {
    await page.getByRole('button', { name: /^(القرآن|القرآن والمصحف)$/ }).click();
    await page.getByRole('button', { name: 'فتح المصحف بالصفحات (604)' }).click();

    const svgUrl = getMushafFacsimilePageUrls(1).svgUrl;
    const offlineSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g id="ayah_markers">${Array.from({ length: 7 }, (_, index) => `<path class="ayahPolygon" ayah="${index + 1}" surah="1" d="M 1 ${index + 1} L 90 ${index + 1} L 90 99 Z"/>`).join('')}</g></svg>`;
    await page.evaluate(async ({ cacheName, url, markup }) => {
      const cache = await caches.open(cacheName);
      await cache.put(url, new Response(markup, { headers: { 'content-type': 'image/svg+xml; charset=utf-8' } }));
    }, { cacheName: MUSHAF_OFFLINE_CACHE_NAME, url: svgUrl, markup: offlineSvg });

    let externalRequests = 0;
    await page.route(svgUrl, async route => {
      externalRequests++;
      await route.abort('internetdisconnected');
    });
    await context.setOffline(true);
    await page.getByRole('button', { name: 'الصفحة المطبوعة', exact: true }).click();

    await expect(page.locator('svg[aria-label="صفحة المصحف المطبوعة رقم 1"]')).toBeVisible();
    await expect(page.locator('#wird-ayah-1-1')).toBeVisible();
    expect(externalRequests).toBe(0);
  });

  test('Muyassar can be downloaded locally and shown on either opposite Mushaf page while offline', async ({ page, context }) => {
    const requestedSurahs: number[] = [];
    await mockQuranEncVersion(page);
    await page.route('https://quranenc.com/api/v1/translation/sura/arabic_moyassar/**', async route => {
      const surahNumber = Number(new URL(route.request().url()).pathname.split('/').pop());
      requestedSurahs.push(surahNumber);
      const surah = ALL_SURAHS[surahNumber - 1];
      const payload = Array.from({ length: surah.versesCount }, (_, index) => ({
        sura: surahNumber,
        aya: index + 1,
        translation: `تفسير اختباري ${surahNumber}:${index + 1}`,
        footnotes: index === 0 ? [`حاشية اختبارية ${surahNumber}`] : []
      }));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify(payload)
      });
    });

    await page.getByRole('button', { name: /^(القرآن|القرآن والمصحف)$/ }).click();
    await page.getByRole('button', { name: 'فتح المصحف بالصفحات (604)' }).click();
    await page.getByRole('button', { name: 'الصفحة المطبوعة', exact: true }).click();
    await enableSpreadIfAvailable(page);
    if ((page.viewportSize()?.width ?? 1280) < 768) {
      await expect(page.locator('svg[aria-label="صفحة المصحف المطبوعة رقم 1"]')).toBeVisible();
      await expect(page.locator('svg[aria-label="صفحة المصحف المطبوعة رقم 2"]')).toHaveCount(0);
      return;
    }
    await expect(page.locator('svg[aria-label="صفحة المصحف المطبوعة رقم 1"]')).toBeVisible();
    await expect(page.locator('svg[aria-label="صفحة المصحف المطبوعة رقم 2"]')).toBeVisible();

    const leftContent = page.getByRole('group', { name: 'محتوى الصفحة اليسرى' });
    const rightContent = page.getByRole('group', { name: 'محتوى الصفحة اليمنى' });
    await expect(leftContent.getByRole('button', { name: 'القرآن' })).toHaveAttribute('aria-pressed', 'true');
    await expect(rightContent.getByRole('button', { name: 'القرآن' })).toHaveAttribute('aria-pressed', 'true');

    await leftContent.getByRole('button', { name: 'التفسير الميسر' }).first().click();
    const downloadPanel = page.getByRole('region', { name: 'تجهيز التفسير الميسر دون إنترنت' });
    await expect(downloadPanel).toBeVisible();
    await downloadPanel.getByRole('button', { name: 'تنزيل التفسير الميسر كاملًا' }).click();
    await expect(page.getByText('التفسير متاح محليًا دون اتصال.')).toBeVisible({ timeout: 120_000 });
    await expect(page.locator('#wird-tafsir-ayah-1-1')).toContainText('تفسير اختباري 1:1');
    await expect(page.locator('#wird-tafsir-ayah-1-1')).toContainText('حاشية اختبارية 1');
    expect(requestedSurahs).toHaveLength(114);
    expect(new Set(requestedSurahs).size).toBe(114);

    await context.setOffline(true);
    await page.locator('#wird-tafsir-ayah-1-1').getByRole('navigation', { name: 'التنقل بين الآيات' }).getByRole('button', { name: 'الآية التالية' }).click();
    await expect(page.locator('#wird-tafsir-ayah-1-2')).toContainText('تفسير اختباري 1:2');
    await expect(page.locator('#wird-tafsir-ayah-1-2')).toContainText('موضع القراءة');

    await rightContent.getByRole('button', { name: 'التفسير الميسر' }).first().click();
    await expect(page.locator('#wird-tafsir-ayah-2-1')).toContainText('تفسير اختباري 2:1');
    await expect(leftContent.getByRole('button', { name: 'القرآن' })).toHaveAttribute('aria-pressed', 'true');

    // Navigating from Tafsir back to an ayah on its own page must preserve
    // the current facing spread instead of anchoring the spread on page 1's
    // left-hand neighbor and accidentally shifting the two-page view.
    await page.locator('#wird-tafsir-ayah-2-1').getByRole('navigation', { name: 'التنقل بين الآيات' }).getByRole('button', { name: 'الآية السابقة' }).click();
    await expect(page.getByRole('main', { name: 'صفحتا المصحف 1 و2' })).toBeVisible();
    await expect(page.locator('#wird-ayah-1-7')).toBeVisible();
    await expect(rightContent.getByRole('button', { name: 'القرآن' })).toHaveAttribute('aria-pressed', 'true');
    await expect(leftContent.getByRole('button', { name: 'التفسير الميسر' }).first()).toHaveAttribute('aria-pressed', 'true');
    expect(requestedSurahs).toHaveLength(114);
  });

  test('partial Muyassar download resumes from the first missing surah without redownloading verified data', async ({ page }) => {
    const requestedSurahs: number[] = [];
    let failSurahTwoOnce = true;
    await mockQuranEncVersion(page);
    await page.route('https://quranenc.com/api/v1/translation/sura/arabic_moyassar/**', async route => {
      const surahNumber = Number(new URL(route.request().url()).pathname.split('/').at(-1));
      requestedSurahs.push(surahNumber);
      if (surahNumber === 2 && failSurahTwoOnce) {
        failSurahTwoOnce = false;
        await route.fulfill({ status: 503, body: 'temporary test outage' });
        return;
      }
      const surah = ALL_SURAHS[surahNumber - 1];
      const payload = Array.from({ length: surah.versesCount }, (_, index) => ({
        sura: surahNumber,
        aya: index + 1,
        translation: `تفسير استكمال ${surahNumber}:${index + 1}`,
        footnotes: []
      }));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify(payload)
      });
    });

    await page.getByRole('button', { name: /^(القرآن|القرآن والمصحف)$/ }).click();
    await page.getByRole('button', { name: 'فتح المصحف بالصفحات (604)' }).click();
    await page.getByRole('button', { name: 'الصفحة المطبوعة', exact: true }).click();
    await enableSpreadIfAvailable(page);
    await page.getByRole('button', { name: 'التفسير الميسر' }).first().click();

    const downloadPanel = page.getByRole('region', { name: 'تجهيز التفسير الميسر دون إنترنت' });
    await downloadPanel.getByRole('button', { name: 'تنزيل التفسير الميسر كاملًا' }).click();
    await expect(downloadPanel.getByRole('alert')).toContainText('HTTP 503');
    await expect(downloadPanel).toContainText('1 / 114 سورة');
    await downloadPanel.getByRole('button', { name: 'استكمال التنزيل' }).click();

    await expect(page.getByText('التفسير متاح محليًا دون اتصال.')).toBeVisible({ timeout: 120_000 });
    expect(requestedSurahs.filter(number => number === 1)).toHaveLength(1);
    expect(requestedSurahs.filter(number => number === 2)).toHaveLength(2);
    expect(new Set(requestedSurahs).size).toBe(114);
  });

  test('completed offline Tafsir can recheck source version without redownloading stored surahs', async ({ page }) => {
    let catalogueRequests = 0;
    let surahRequests = 0;
    let sourceVersion = '1.0.1';
    await page.route(/^https:\/\/quranenc\.com\/api\/v1\/translations\/list\/ar\/?(?:\?.*)?$/, async route => {
      catalogueRequests++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ translations: [{ key: 'arabic_moyassar', version: sourceVersion, last_update: 1794182400 }] })
      });
    });
    await page.route('https://quranenc.com/api/v1/translation/sura/arabic_moyassar/**', async route => {
      surahRequests++;
      await route.abort();
    });

    await page.evaluate(async (verseCounts) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('wird-offline-tafsir', 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('surahs')) db.createObjectStore('surahs', { keyPath: 'surahNumber' });
          if (!db.objectStoreNames.contains('metadata')) db.createObjectStore('metadata', { keyPath: 'key' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(['surahs', 'metadata'], 'readwrite');
        const surahs = transaction.objectStore('surahs');
        verseCounts.forEach((count, index) => {
          const surahNumber = index + 1;
          const payload = Array.from({ length: count }, (_, verseIndex) => ({
            sura: surahNumber,
            aya: verseIndex + 1,
            translation: `تفسير محفوظ محليًا ${surahNumber}:${verseIndex + 1}`,
            footnotes: []
          }));
          surahs.put({ surahNumber, sourceVersion: '1.0.1', savedAt: new Date().toISOString(), payload });
        });
        transaction.objectStore('metadata').put({
          key: 'manifest', sourceVersion: '1.0.1', downloadedSurahs: verseCounts.map((_, index) => index + 1),
          status: 'complete', updatedAt: new Date().toISOString()
        });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
      database.close();
    }, ALL_SURAHS.map(surah => surah.versesCount));

    await page.getByRole('button', { name: /^(القرآن|القرآن والمصحف)$/ }).click();
    await page.getByRole('button', { name: 'فتح المصحف بالصفحات (604)' }).click();
    await page.getByRole('button', { name: 'الصفحة المطبوعة', exact: true }).click();
    await enableSpreadIfAvailable(page);
    const isMobile = (page.viewportSize()?.width ?? 1280) < 768;
    if (isMobile) {
      await page.getByRole('button', { name: 'التفسير الميسر' }).first().click();
    } else {
      await expect(page.locator('svg[aria-label="صفحة المصحف المطبوعة رقم 1"]')).toBeVisible();
      await expect(page.locator('svg[aria-label="صفحة المصحف المطبوعة رقم 2"]')).toBeVisible();
      const leftContent = page.getByRole('group', { name: 'محتوى الصفحة اليسرى' });
      await expect(leftContent.getByRole('button', { name: 'القرآن' })).toHaveAttribute('aria-pressed', 'true');
      await leftContent.getByRole('button', { name: 'التفسير الميسر' }).first().click();
      await expect(leftContent.getByRole('button', { name: 'التفسير الميسر' }).first()).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('main', { name: 'صفحتا المصحف 1 و2' })).toBeVisible();
    }

    // The Tafsir pane resolves its IndexedDB read asynchronously after the tab is selected.
    // Wait for the completed-state action rather than racing the initial loading placeholder.
    const recheckButton = page.getByRole('button', { name: 'التحقق من تحديث المصدر' });
    await expect(recheckButton).toBeVisible({ timeout: 30_000 });
    const downloadPanel = page.locator('section[aria-label="تجهيز التفسير الميسر دون إنترنت"]');
    await expect(downloadPanel).toContainText('114 / 114 سورة');
    await expect(page.getByText('التفسير متاح محليًا دون اتصال.')).toBeVisible();
    await recheckButton.click();
    await expect(downloadPanel.getByRole('button', { name: 'جارٍ التحقق من إصدار المصدر...' })).toBeVisible();
    await expect(recheckButton).toBeEnabled({ timeout: 30_000 });
    expect(catalogueRequests).toBe(1);
    expect(surahRequests).toBe(0);
    await expect(downloadPanel).toContainText('التفسير محفوظ محليًا دون اتصال.');

    sourceVersion = '1.0.2';
    await recheckButton.click();
    await expect(downloadPanel.getByRole('alert')).toContainText('أصدر QuranEnc نسخة أحدث (1.0.2)');
    await expect(downloadPanel).toContainText('114 / 114 سورة');
    expect(catalogueRequests).toBe(2);
    expect(surahRequests).toBe(0);
  });

  test('corrupted persisted surah is not counted as downloaded and is fetched again on resume', async ({ page }) => {
    const requestedSurahs: number[] = [];
    await mockQuranEncVersion(page);
    await page.route('https://quranenc.com/api/v1/translation/sura/arabic_moyassar/**', async route => {
      const surahNumber = Number(new URL(route.request().url()).pathname.split('/').at(-1));
      requestedSurahs.push(surahNumber);
      const surah = ALL_SURAHS[surahNumber - 1];
      const payload = Array.from({ length: surah.versesCount }, (_, index) => ({
        sura: surahNumber,
        aya: index + 1,
        translation: `تفسير استعادة البيانات ${surahNumber}:${index + 1}`,
        footnotes: []
      }));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify(payload)
      });
    });

    await page.evaluate(async () => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('wird-offline-tafsir', 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('surahs')) {
            db.createObjectStore('surahs', { keyPath: 'surahNumber' });
          }
          if (!db.objectStoreNames.contains('metadata')) {
            db.createObjectStore('metadata', { keyPath: 'key' });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(['surahs', 'metadata'], 'readwrite');
        transaction.objectStore('surahs').put({
          surahNumber: 1,
          sourceVersion: '1.0.1',
          savedAt: new Date().toISOString(),
          payload: [{ sura: 1, aya: 1, translation: 'بيانات تالفة ناقصة', footnotes: [] }]
        });
        transaction.objectStore('metadata').put({
          key: 'manifest',
          sourceVersion: '1.0.1',
          downloadedSurahs: [1],
          status: 'paused',
          updatedAt: new Date().toISOString()
        });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
      database.close();
    });

    await page.getByRole('button', { name: /^(القرآن|القرآن والمصحف)$/ }).click();
    await page.getByRole('button', { name: 'فتح المصحف بالصفحات (604)' }).click();
    await page.getByRole('button', { name: 'الصفحة المطبوعة', exact: true }).click();
    await enableSpreadIfAvailable(page);
    await page.getByRole('button', { name: 'التفسير الميسر' }).first().click();

    const downloadPanel = page.getByRole('region', { name: 'تجهيز التفسير الميسر دون إنترنت' });
    await expect(downloadPanel).toContainText('0 / 114 سورة');
    await downloadPanel.getByRole('button', { name: 'تنزيل التفسير الميسر كاملًا' }).click();

    await expect(page.getByText('التفسير متاح محليًا دون اتصال.')).toBeVisible({ timeout: 120_000 });
    expect(requestedSurahs).toHaveLength(114);
    expect(requestedSurahs[0]).toBe(1);
    expect(new Set(requestedSurahs).size).toBe(114);
    await expect(page.locator('#wird-tafsir-ayah-1-1')).toContainText('تفسير استعادة البيانات 1:1');
  });

  test('incomplete QuranEnc surah payload is rejected and never marked as an offline-ready Tafsir', async ({ page }) => {
    await mockQuranEncVersion(page);
    await page.route('https://quranenc.com/api/v1/translation/sura/arabic_moyassar/**', async route => {
      const surahNumber = Number(new URL(route.request().url()).pathname.split('/').at(-1));
      const payload = [{ sura: surahNumber, aya: 1, translation: 'تفسير غير مكتمل', footnotes: [] }];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify(payload)
      });
    });

    await page.getByRole('button', { name: /^(القرآن|القرآن والمصحف)$/ }).click();
    await page.getByRole('button', { name: 'فتح المصحف بالصفحات (604)' }).click();
    await page.getByRole('button', { name: 'الصفحة المطبوعة', exact: true }).click();
    await enableSpreadIfAvailable(page);
    await page.getByRole('button', { name: 'التفسير الميسر' }).first().click();

    const downloadPanel = page.getByRole('region', { name: 'تجهيز التفسير الميسر دون إنترنت' });
    await downloadPanel.getByRole('button', { name: 'تنزيل التفسير الميسر كاملًا' }).click();
    await expect(downloadPanel.getByRole('alert')).toContainText('عدد آيات تفسير سورة 1 غير مكتمل');
    await expect(downloadPanel).toContainText('0 / 114 سورة');
    await expect(downloadPanel.getByRole('button', { name: 'تنزيل التفسير الميسر كاملًا' })).toBeVisible();
  });

  test('full offline preparation caches lazy Quran assets and cold-starts the mushaf offline after reload', async ({ page, context }) => {
    test.skip((page.viewportSize()?.width ?? 1280) < 768, 'The full asset download is exercised once on desktop; mobile settings reachability is covered separately.');
    test.setTimeout(180_000);

    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

    await page.getByRole('button', { name: 'الإعدادات', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'التجهيز للعمل دون إنترنت' })).toBeVisible();
    await page.getByRole('button', { name: 'تجهيز وِرد لهذا الجهاز' }).click();
    await expect(page.getByRole('status')).toContainText(/اكتمل تنزيل \d+ ملفًا/, { timeout: 150_000 });

    const cacheState = await page.evaluate(async () => {
      const manifestResponse = await fetch('/wird-precache-manifest.json');
      const manifest = await manifestResponse.json();
      const cache = await caches.open('wird-app-content-v1');
      const cachedRequests = await cache.keys();
      const cachedPaths = new Set(cachedRequests.map(request => new URL(request.url).pathname));
      return {
        total: manifest.allAssets.length,
        missing: manifest.allAssets.filter((asset: string) =>
          !cachedPaths.has(new URL(asset, location.origin).pathname)
        )
      };
    });
    expect(cacheState.total).toBeGreaterThan(0);
    expect(cacheState.missing).toEqual([]);

    try {
      await context.setOffline(true);
      // Simulate closing and reopening the app while the device remains offline.
      // The service worker must serve the cached document and every required shell asset.
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
      await expect(page.getByRole('button', { name: /^(القرآن|القرآن والمصحف)$/ })).toBeVisible({ timeout: 15_000 });
      await page.getByRole('button', { name: /^(القرآن|القرآن والمصحف)$/ }).click();
      await page.getByRole('button', { name: 'فتح المصحف بالصفحات (604)' }).click();
      await expect(page.locator('#wird-ayah-1-1')).toBeVisible({ timeout: 15_000 });
      await page.getByRole('button', { name: 'الصفحة المطبوعة', exact: true }).click();
      await enableSpreadIfAvailable(page);
      await expect(page.locator('svg[aria-label="صفحة المصحف المطبوعة رقم 1"]')).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('svg[aria-label="صفحة المصحف المطبوعة رقم 2"]')).toBeVisible({ timeout: 15_000 });
    } finally {
      await context.setOffline(false);
    }
  });

  test('mobile settings exposes the optional offline preparation control', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 1280) >= 768, 'This reachability check targets the mobile More drawer.');
    await page.getByRole('button', { name: 'المزيد من الأقسام' }).click();
    const drawerNav = page.getByRole('navigation', { name: 'القائمة الرئيسية' });
    await drawerNav.getByRole('button', { name: 'الإعدادات', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'التجهيز للعمل دون إنترنت' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'تجهيز وِرد لهذا الجهاز' })).toBeVisible();
  });

  test('related hadith card renders the source matn, book metadata, and explicit grading in RTL', async ({ page }) => {
    await page.route('**/api/hadith-references?**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        verseKey: '1:1',
        source: 'Quran Foundation Hadith References',
        hadiths: [
          {
            name: 'صحيح البخاري', collection: 'bukhari', hadithNumber: '1',
            body: 'مَتْنُ حَدِيثٍ عَرَبِيٍّ بِالتَّشْكِيلِ',
            grades: [{ graded_by: 'ناقد موثق للاختبار', grade: 'صحيح' }], authenticityBasis: 'explicit_grade',
            bookNumber: '1', chapterNumber: '1', chapterTitle: 'بدء الوحي', referenceUrn: 222, urn: 111,
          },
          {
            name: 'صحيح البخاري', collection: 'bukhari', hadithNumber: '1',
            body: 'نسخة مكررة من الإحالة نفسها',
            grades: [{ graded_by: 'ناقد موثق للاختبار', grade: 'صحيح' }], authenticityBasis: 'explicit_grade',
            bookNumber: '1', chapterNumber: '1', chapterTitle: 'بدء الوحي', referenceUrn: 222, urn: 111,
          },
          {
            name: 'صحيح البخاري', collection: 'bukhari', hadithNumber: '1',
            body: 'رواية أخرى لها معرّف مصدر مستقل',
            grades: [{ graded_by: 'ناقد موثق للاختبار', grade: 'صحيح' }], authenticityBasis: 'explicit_grade',
            bookNumber: '1', chapterNumber: '1', chapterTitle: 'بدء الوحي', referenceUrn: 223, urn: 112,
          },
        ],
        page: 1,
        hasMore: false,
      }),
    }));

    const libraryNavigationLabel = (page.viewportSize()?.width ?? 1280) < 768 ? 'القرآن' : 'القرآن والمصحف';
    await page.getByRole('button', { name: libraryNavigationLabel, exact: true }).click();
    await page.getByRole('button', { name: 'فتح المصحف بالصفحات (604)' }).click();
    const firstAyah = page.locator('#wird-ayah-1-1');
    await expect(firstAyah).toBeVisible();
    await firstAyah.click();

    const hadithToggle = page.getByRole('button', { name: 'أحاديث موثقة مرتبطة بالآية' });
    await expect(hadithToggle).toBeVisible();
    await hadithToggle.click();

    const cards = page.locator('article').filter({ hasText: 'صحيح البخاري' });
    await expect(cards).toHaveCount(2);
    const card = cards.first();
    await expect(card).toContainText('رقم الحديث 1');
    await expect(card).toContainText('بدء الوحي');
    await expect(card).toContainText('أحكام المحدثين في المصدر');
    await expect(card).toContainText('ناقد موثق للاختبار');
    await expect(card).toContainText('معرّف إحالة المصدر: 222');
    await expect(card).toContainText('معرّف نص الحديث: 111');
    await expect(card.locator('p[dir="rtl"][lang="ar"]')).toContainText('مَتْنُ حَدِيثٍ عَرَبِيٍّ بِالتَّشْكِيلِ');
    await expect(cards.nth(1).locator('p[dir="rtl"][lang="ar"]')).toContainText('رواية أخرى لها معرّف مصدر مستقل');
  });

});
