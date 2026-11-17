import { expect, test } from '@playwright/test';

const MUSHAF_SVG_PATTERN = /^https:\/\/raw\.githubusercontent\.com\/quran-ws\/quran-svg\/3ff27b46cecb0c0519d77531d9c868a579d1f623\/mushafs\/hafs\/kfqc\/svg\/\d{3}\.svg$/;

function makeValidTestPageSvg(): string {
  const polygons = Array.from({ length: 7 }, (_, index) =>
    `<path class="ayahPolygon" ayah="${index + 1}" surah="1" d="M 1 ${index + 1} L 90 ${index + 1} L 90 99 Z"/>`
  ).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g id="ayah_markers">${polygons}</g></svg>`;
}

test.describe('WIRD full printed Mushaf offline package', () => {
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

    await page.getByRole('button', { name: 'الإعدادات', exact: true }).click();
    const offlinePackage = page.getByRole('heading', { name: 'المصحف المصوّر كاملًا دون إنترنت' }).locator('..');
    await offlinePackage.getByRole('button', { name: 'تنزيل المصحف المصوّر كاملًا' }).click();

    await expect(offlinePackage).toContainText('5 / 604 صفحة محفوظة', { timeout: 30_000 });
    await expect(offlinePackage.getByRole('button', { name: 'استكمال تنزيل المصحف' })).toBeVisible();
    await offlinePackage.getByRole('button', { name: 'استكمال تنزيل المصحف' }).click();

    await expect(offlinePackage).toContainText('604 / 604 صفحة محفوظة', { timeout: 90_000 });
    expect(requestCounts.size).toBe(604);
    expect(requestCounts.get(1)).toBe(1);
    expect(requestCounts.get(4)).toBe(2);
    expect([...requestCounts.values()].filter(count => count > 1)).toEqual([2]);

    await page.getByRole('button', { name: /^(القرآن|القرآن والمصحف)$/ }).click();
    await page.getByRole('button', { name: 'فتح المصحف بالصفحات (604)' }).click();
    await context.setOffline(true);
    await page.getByRole('button', { name: 'الصفحة المطبوعة', exact: true }).click();

    await expect(page.locator('svg[aria-label="صفحة المصحف المطبوعة رقم 1"]')).toBeVisible();
    await expect(page.locator('#wird-ayah-1-1')).toBeVisible();
    expect(requestCounts.get(1)).toBe(1);
  });
});
