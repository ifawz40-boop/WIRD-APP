import { expect, test } from '@playwright/test';

test.describe('WIRD Seerah Encyclopedia (Ibn Kathir 4 Volumes)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
    await expect(page.getByRole('heading', { name: /السلام عليكم ورحمة الله/ })).toBeVisible();
    await page.goto('/#/seerah');
    await expect(page.locator('#seerah-encyclopedia-workspace')).toBeVisible({ timeout: 15000 });
  });

  test('loads all 4 volumes, navigates by volume & printed page, searches full text, and persists bookmarks', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // 1. Default view loads Volume 1 Page 1 classical matn without modern preface
    await expect(page.locator('#ency-page-v1-p1')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#ency-page-v1-p1')).toContainText('ذكر أخبار العرب');
    await expect(page.locator('#ency-page-v1-p1')).not.toContainText('مصطفى عبد الواحد');

    // 2. Switch to Volume 3 and jump directly to printed page 526 (Fath Makkah)
    await page.getByRole('button', { name: /المجلد الثالث/ }).click();
    await expect(page.locator('#ency-page-v3-p3')).toBeVisible({ timeout: 15000 });

    const pageInput = page.locator('#seerah-page-jump');
    await pageInput.fill('526');
    await page.getByRole('button', { name: 'انتقال', exact: true }).click();
    await expect(page.locator('#ency-page-v3-p526')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#ency-page-v3-p526')).toContainText('غزوة الفتح الأعظم');

    // 3. Bookmark page 526 and attach a personal study note
    const page526Card = page.locator('#ency-page-v3-p526');
    await page526Card.getByRole('button', { name: 'علامة' }).click();
    await expect(page526Card.getByRole('button', { name: 'محفوظة' })).toBeVisible();
    await page526Card.getByRole('button', { name: 'إضافة ملاحظة' }).click();
    await page526Card.locator('textarea').fill('فتح مكة في رمضان سنة ثمان');
    await page526Card.getByRole('button', { name: 'حفظ الملاحظة' }).click();
    await expect(page526Card).toContainText('فتح مكة في رمضان سنة ثمان');

    // 4. Full-text Arabic search in Volume 2
    await page.getByRole('button', { name: /البحث الشامل/ }).click();
    const searchBox = page.getByRole('searchbox', { name: /البحث النصي الكامل/ });
    await searchBox.fill('غزوة بدر');
    await page.getByLabel('نطاق المجلد للبحث').selectOption('2');
    await page.getByRole('button', { name: 'بحث', exact: true }).click();

    await expect(page.getByText(/نتائج البحث عن «غزوة بدر»/)).toBeVisible({ timeout: 15000 });
    const firstResult = page.locator('#seerah-encyclopedia-workspace button').filter({ hasText: /ج 2 · ص/ }).first();
    await expect(firstResult).toBeVisible();
    await firstResult.click();
    await expect(page.locator('[id^="ency-page-v2-p"]').first()).toBeVisible({ timeout: 15000 });

    // 5. Cross-link from Curated 16-Chapter Narrative into Encyclopedia
    await page.getByRole('button', { name: /الخلاصة السردية/ }).click();
    const crossLinkBtn = page.getByRole('button', { name: /ج 1 · ص 1/ });
    await expect(crossLinkBtn).toBeVisible();
    await crossLinkBtn.click();
    await expect(page.locator('#ency-page-v1-p1')).toBeVisible({ timeout: 15000 });

    // 6. Verify Bookmarks tab displays the saved Encyclopedia bookmark & note after reload
    await page.reload();
    await expect(page.locator('#seerah-encyclopedia-workspace')).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /العلامات المرجعية/ }).click();
    await expect(page.getByText('فتح مكة في رمضان سنة ثمان', { exact: true })).toBeVisible();

    // 7. Zero horizontal overflow & zero page errors
    const overflowX = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(overflowX).toBe(false);
    expect(pageErrors).toEqual([]);
  });

  test('renders cleanly on mobile viewport without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('#ency-page-v1-p1')).toBeVisible({ timeout: 15000 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
  });
});
