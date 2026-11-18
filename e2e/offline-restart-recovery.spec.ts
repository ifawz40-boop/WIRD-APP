import { expect, test, type Page } from '@playwright/test';
import { ALL_SURAHS } from '../src/data/quranMeta';
import { MUSHAF_OFFLINE_CACHE_NAME } from '../src/services/mushafFacsimileService';

const MUSHAF_CACHE_NAME = MUSHAF_OFFLINE_CACHE_NAME;
const MUSHAF_PATTERN = /^https:\/\/raw\.githubusercontent\.com\/quran-ws\/quran-svg\/3ff27b46cecb0c0519d77531d9c868a579d1f623\/mushafs\/hafs\/kfqc\/svg\/\d{3}\.svg$/;

function makeValidSvg(): string {
  const polygons = Array.from({ length: 7 }, (_, index) =>
    `<path class="ayahPolygon" ayah="${index + 1}" surah="1" d="M 1 ${index + 1} L 90 ${index + 1} L 90 99 Z"/>`
  ).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g id="ayah_markers">${polygons}</g></svg>`;
}

async function enterGuest(page: Page) {
  await page.goto('/');
  const guestButton = page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' });
  const readyHeading = page.getByRole('heading', { name: /السلام عليكم ورحمة الله|القرآن الكريم/ });
  await expect(guestButton.or(readyHeading)).toBeVisible({ timeout: 15_000 });
  if (await guestButton.isVisible().catch(() => false)) await guestButton.click();
}

async function openSettings(page: Page) {
  if ((page.viewportSize()?.width ?? 1280) < 768) {
    const quickNavigation = page.getByRole('navigation', { name: 'التنقل السريع' });
    await quickNavigation.getByRole('button', { name: 'المزيد من الأقسام' }).click();
    await page.getByRole('navigation', { name: 'القائمة الرئيسية' }).getByRole('button', { name: 'الإعدادات' }).click();
  } else {
    await page.getByRole('button', { name: 'الإعدادات', exact: true }).click();
  }
}

async function openTafsirDownloadPanel(page: Page) {
  await page.getByRole('button', { name: /^(القرآن|القرآن والمصحف)$/ }).click();
  await page.getByRole('button', { name: 'فتح المصحف بالصفحات (604)' }).click();
  await page.getByRole('button', { name: 'الصفحة المطبوعة', exact: true }).click();
  const spreadButton = page.getByRole('button', { name: 'صفحتان متقابلتان' });
  if (await spreadButton.isVisible().catch(() => false)) await spreadButton.click();
  await page.getByRole('button', { name: 'التفسير الميسر' }).first().click();
  return page.getByRole('region', { name: 'تجهيز التفسير الميسر دون إنترنت' });
}

test.describe('WIRD offline restart and durable-download recovery', () => {
  test.use({ serviceWorkers: 'block' });

  test('Tafsir partial download survives a page reload and resumes without refetching verified surahs', async ({ page }) => {
    const requestedSurahs: number[] = [];
    let failSurahTwoOnce = true;

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
    await page.route('https://quranenc.com/api/v1/translation/sura/arabic_moyassar/**', async route => {
      const surahNumber = Number(new URL(route.request().url()).pathname.split('/').at(-1));
      requestedSurahs.push(surahNumber);
      if (surahNumber === 2 && failSurahTwoOnce) {
        failSurahTwoOnce = false;
        await route.fulfill({ status: 503, body: 'simulated interruption before page reload' });
        return;
      }
      const surah = ALL_SURAHS[surahNumber - 1];
      const payload = Array.from({ length: surah.versesCount }, (_, index) => ({
        sura: surahNumber,
        aya: index + 1,
        translation: `تفسير استعادة إعادة التشغيل ${surahNumber}:${index + 1}`,
        footnotes: []
      }));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify(payload)
      });
    });

    await enterGuest(page);
    let panel = await openTafsirDownloadPanel(page);
    await panel.getByRole('button', { name: 'تنزيل التفسير الميسر كاملًا' }).click();
    await expect(panel.getByRole('alert')).toContainText('HTTP 503');
    await expect(panel).toContainText('1 / 114 سورة');

    // Simulate closing/reopening the app tab after a persisted partial download.
    await page.reload();
    await enterGuest(page);
    panel = await openTafsirDownloadPanel(page);
    await expect(panel).toContainText('1 / 114 سورة');
    await panel.getByRole('button', { name: 'استكمال التنزيل' }).click();

    await expect(page.getByText('التفسير متاح محليًا دون اتصال.')).toBeVisible({ timeout: 120_000 });
    expect(requestedSurahs.filter(number => number === 1)).toHaveLength(1);
    expect(requestedSurahs.filter(number => number === 2)).toHaveLength(2);
    expect(new Set(requestedSurahs).size).toBe(114);

    await page.context().setOffline(true);
    await expect(page.locator('#wird-tafsir-ayah-1-1')).toContainText('تفسير استعادة إعادة التشغيل 1:1');
  });

  test('Mushaf 604-page partial package survives a page reload and resumes from cached pages', async ({ page }) => {
    test.setTimeout(150_000);
    const requestCounts = new Map<number, number>();
    let failPageFourOnce = true;
    const svg = makeValidSvg();

    await page.route(MUSHAF_PATTERN, async route => {
      const pageNumber = Number(new URL(route.request().url()).pathname.split('/').pop()?.replace('.svg', ''));
      requestCounts.set(pageNumber, (requestCounts.get(pageNumber) || 0) + 1);
      if (pageNumber === 4 && failPageFourOnce) {
        failPageFourOnce = false;
        await route.fulfill({ status: 503, body: 'simulated interruption before page reload' });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'image/svg+xml; charset=utf-8',
        headers: { 'access-control-allow-origin': '*' },
        body: svg
      });
    });

    await enterGuest(page);
    await page.evaluate(() => {
      Object.defineProperty(navigator.storage, 'estimate', {
        configurable: true,
        value: async () => ({ usage: 0, quota: 1024 * 1024 * 1024 })
      });
    });
    await openSettings(page);
    let packagePanel = page.getByRole('heading', { name: 'المصحف المصوّر كاملًا دون إنترنت' }).locator('xpath=../..');
    await packagePanel.getByRole('button', { name: 'تنزيل المصحف المصوّر كاملًا' }).click();
    await expect(packagePanel).toContainText('5 / 604 صفحة محفوظة', { timeout: 30_000 });

    await page.reload();
    await enterGuest(page);
    await openSettings(page);
    packagePanel = page.getByRole('heading', { name: 'المصحف المصوّر كاملًا دون إنترنت' }).locator('xpath=../..');
    await expect(packagePanel).toContainText('5 / 604 صفحة محفوظة');
    await packagePanel.getByRole('button', { name: 'استكمال تنزيل المصحف' }).click();
    await expect(packagePanel).toContainText('604 / 604 صفحة محفوظة', { timeout: 120_000 });

    expect(requestCounts.size).toBe(604);
    expect(requestCounts.get(1)).toBe(1);
    expect(requestCounts.get(4)).toBe(2);

    const cachedPage = await page.evaluate(async ({ cacheName }) => {
      const cache = await caches.open(cacheName);
      const request = (await cache.keys()).find(item => item.url.endsWith('/001.svg'));
      return request ? (await cache.match(request))?.text() || '' : '';
    }, { cacheName: MUSHAF_CACHE_NAME });
    expect(cachedPage).toContain('ayahPolygon');
  });
});
