import { expect, test } from '@playwright/test';
import { MUSHAF_OFFLINE_CACHE_NAME } from '../src/services/mushafFacsimileService';

const MUSHAF_SVG_PATTERN = /^https:\/\/raw\.githubusercontent\.com\/quran-ws\/quran-svg\/3ff27b46cecb0c0519d77531d9c868a579d1f623\/mushafs\/hafs\/kfqc\/svg\/\d{3}\.svg$/;

function makeValidTestPageSvg(): string {
  const polygons = Array.from({ length: 7 }, (_, index) =>
    `<path class="ayahPolygon" ayah="${index + 1}" surah="1" d="M 1 ${index + 1} L 90 ${index + 1} L 90 99 Z"/>`
  ).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" onload="window.__wirdSvgProbe=1" data-untrusted="remove-me"><g id="ayah_markers">${polygons}</g></svg>`;
}

test.describe('WIRD full printed Mushaf offline package', () => {
  // Keep the dedicated Cache Storage package under test; a controlling service worker would bypass Playwright route mocks.
  test.use({ serviceWorkers: 'block' });
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
  });

  test('resumes a partial 604-page download and opens a printed page with the browser offline', async ({ page, context }) => {
    test.setTimeout(120_000);
    const requestCounts = new Map<number, number>();
    const svg = makeValidTestPageSvg();

    await page.route(MUSHAF_SVG_PATTERN, async route => {
      const pathname = new URL(route.request().url()).pathname;
      const pageNumber = Number(pathname.split('/').pop()?.replace('.svg', ''));
      const count = (requestCounts.get(pageNumber) || 0) + 1;
      requestCounts.set(pageNumber, count);
      if (pageNumber === 4 && count === 1) {
        await route.fulfill({ status: 503, body: 'simulated one-time network interruption' });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'image/svg+xml; charset=utf-8',
        headers: { 'access-control-allow-origin': '*' },
        body: svg
      });
    });

    await page.evaluate(() => {
      try {
        Object.defineProperty(navigator.storage, 'estimate', {
          configurable: true,
          value: async () => ({ usage: 0, quota: 1024 * 1024 * 1024 })
        });
      } catch {
        // Chromium's native estimate is sufficient when the method is not configurable.
      }
    });

    if ((page.viewportSize()?.width ?? 1280) < 768) {
      const quickNavigation = page.getByRole('navigation', { name: 'التنقل السريع' });
      await quickNavigation.getByRole('button', { name: 'المزيد من الأقسام' }).click();
      await page.getByRole('navigation', { name: 'القائمة الرئيسية' }).getByRole('button', { name: 'الإعدادات' }).click();
    } else {
      await page.getByRole('button', { name: 'الإعدادات', exact: true }).click();
    }
    const offlinePackage = page.getByRole('heading', { name: 'المصحف المصوّر كاملًا دون إنترنت' }).locator('xpath=../..');
    await offlinePackage.getByRole('button', { name: 'تنزيل المصحف المصوّر كاملًا' }).click();

    await expect(offlinePackage).toContainText('5 / 604 صفحة محفوظة', { timeout: 30_000 });
    await expect(offlinePackage.getByRole('button', { name: 'استكمال تنزيل المصحف' })).toBeVisible();
    await offlinePackage.getByRole('button', { name: 'استكمال تنزيل المصحف' }).click();

    await expect(offlinePackage).toContainText('604 / 604 صفحة محفوظة', { timeout: 90_000 });
    expect(requestCounts.size).toBe(604);
    expect(requestCounts.get(1)).toBe(1);

    const cachedSvg = await page.evaluate(async cacheName => {
      const cache = await caches.open(cacheName);
      const request = (await cache.keys()).find(item => item.url.endsWith('/001.svg'));
      if (!request) throw new Error('The verified first Mushaf page was not cached.');
      return (await cache.match(request))?.text() || '';
    }, MUSHAF_OFFLINE_CACHE_NAME);
    expect(cachedSvg).toContain('ayahPolygon');
    expect(cachedSvg).not.toContain('onload=');
    expect(cachedSvg).not.toContain('data-untrusted');
    expect(requestCounts.get(4)).toBe(2);
    expect([...requestCounts.values()].filter(count => count > 1)).toEqual([2]);

    await page.getByRole('button', { name: /^(القرآن|القرآن والمصحف)$/ }).click();
    await page.getByRole('button', { name: 'فتح المصحف بالصفحات (604)' }).click();
    await context.setOffline(true);
    await page.getByRole('button', { name: 'الصفحة المطبوعة', exact: true }).click();

    await expect(page.locator('svg[aria-label="صفحة المصحف المطبوعة رقم 1"]')).toBeVisible();
    await expect(page.locator('#wird-ayah-1-1').first()).toBeVisible();
    expect(requestCounts.get(1)).toBe(1);
  });

  test('revalidates a complete Mushaf cache and repairs a malformed page, including offline verification', async ({ page, context }) => {
    test.setTimeout(120_000);
    const validSvg = makeValidTestPageSvg();
    const invalidSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g></g></svg>';
    const pageUrls = Array.from({ length: 604 }, (_, index) =>
      `https://raw.githubusercontent.com/quran-ws/quran-svg/3ff27b46cecb0c0519d77531d9c868a579d1f623/mushafs/hafs/kfqc/svg/${String(index + 1).padStart(3, '0')}.svg`
    );
    await page.evaluate(async ({ cacheName, urls, valid, invalid }) => {
      const cache = await caches.open(cacheName);
      for (const url of urls) {
        await cache.put(url, new Response(url.endsWith('/004.svg') ? invalid : valid, {
          status: 200,
          headers: { 'content-type': 'image/svg+xml; charset=utf-8' }
        }));
      }
      Object.defineProperty(navigator.storage, 'estimate', {
        configurable: true,
        value: async () => ({ usage: 0, quota: 1024 * 1024 * 1024 })
      });
    }, { cacheName: MUSHAF_OFFLINE_CACHE_NAME, urls: pageUrls, valid: validSvg, invalid: invalidSvg });

    const requestCounts = new Map<number, number>();
    await page.route(MUSHAF_SVG_PATTERN, async route => {
      const pageNumber = Number(new URL(route.request().url()).pathname.split('/').pop()?.replace('.svg', ''));
      requestCounts.set(pageNumber, (requestCounts.get(pageNumber) || 0) + 1);
      if (pageNumber === 4) await new Promise(resolve => setTimeout(resolve, 300));
      await route.fulfill({
        status: 200,
        contentType: 'image/svg+xml; charset=utf-8',
        headers: { 'access-control-allow-origin': '*' },
        body: validSvg
      });
    });

    if ((page.viewportSize()?.width ?? 1280) < 768) {
      const quickNavigation = page.getByRole('navigation', { name: 'التنقل السريع' });
      await quickNavigation.getByRole('button', { name: 'المزيد من الأقسام' }).click();
      await page.getByRole('navigation', { name: 'القائمة الرئيسية' }).getByRole('button', { name: 'الإعدادات' }).click();
    } else {
      await page.getByRole('button', { name: 'الإعدادات', exact: true }).click();
    }

    const offlinePackage = page.getByRole('heading', { name: 'المصحف المصوّر كاملًا دون إنترنت' }).locator('xpath=../..');
    await expect(offlinePackage).toContainText('604 / 604 صفحة محفوظة');
    const verifyButton = offlinePackage.getByRole('button', { name: 'إعادة التحقق من صفحات المصحف' });
    const verificationToast = page.getByText('تم التحقق من سلامة صفحات المصحف المصوّر الـ604. أصبحت قابلة للفتح دون اتصال.');
    await expect(verifyButton).toBeEnabled();
    await verifyButton.click();
    await expect(verificationToast).toBeVisible({ timeout: 90_000 });
    await expect(verifyButton).toBeEnabled({ timeout: 90_000 });
    expect(requestCounts.get(4)).toBe(1);
    await expect(verificationToast).toBeHidden({ timeout: 15_000 });

    await page.evaluate(() => Object.defineProperty(navigator.storage, 'estimate', {
      configurable: true,
      value: async () => ({ usage: 1023 * 1024 * 1024, quota: 1024 * 1024 * 1024 })
    }));
    await context.setOffline(true);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
    await expect(verifyButton).toBeEnabled();
    await verifyButton.click();
    await expect(verificationToast).toBeVisible({ timeout: 90_000 });
    await expect(verifyButton).toBeEnabled({ timeout: 90_000 });
    expect(requestCounts.get(4)).toBe(1);

    const repairedSvg = await page.evaluate(async ({ cacheName, url }) => {
      const cache = await caches.open(cacheName);
      return (await cache.match(url))?.text() || '';
    }, { cacheName: MUSHAF_OFFLINE_CACHE_NAME, url: pageUrls[3] });
    expect(repairedSvg).toContain('ayahPolygon');
    expect(repairedSvg).not.toContain('onload=');
    await context.setOffline(false);
  });

});
