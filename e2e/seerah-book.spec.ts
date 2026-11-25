import { expect, test } from '@playwright/test';

test.describe('WIRD Complete Seerah Digital Book & Character Storytelling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
    await expect(page.getByRole('heading', { name: /السلام عليكم ورحمة الله/ })).toBeVisible();
    await page.goto('/#/seerah');
    await expect(page.locator('#seerah-book-landing')).toBeVisible({ timeout: 15000 });
  });

  test('navigates sections & chapters, reads narrative & verbatim quotes, tracks read/unread & resume, and links bidirectionally with characters', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // 1. Landing displays eras, sections, 40 chapters, progress bar, and character directory entry
    await expect(
      page.getByRole('progressbar', { name: 'نسبة الفصول المقروءة في كتاب السيرة النبوية' })
    ).toBeVisible();
    await expect(page.getByText('دعوة الخليل في الوادي المبارك').first()).toBeVisible();

    // 2. Open Chapter 10 (Revelation in Hira) via search
    const searchInput = page.getByRole('searchbox', { name: 'ابحث في فصول وشخصيات السيرة النبوية' });
    await searchInput.fill('غار حراء');
    const hiraHit = page.getByRole('button', { name: /في غار حراء: اقرأ باسم ربك/ }).first();
    await expect(hiraHit).toBeVisible({ timeout: 10000 });
    await hiraHit.click();

    // 3. Verify Chapter Reader renders scenes, verbatim Quran & Hadith blocks, and mark/unmark read
    await expect(page.locator('#seerah-chapter-reader')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: /في غار حراء: اقرأ باسم ربك/ })).toBeVisible();
    await expect(page.locator('#seerah-chapter-reader')).toContainText('القرآن الكريم — العلق: 1–5');

    const markBtn = page.getByRole('button', { name: 'تحديد الفصل كمقروء' });
    await markBtn.click();
    await expect(page.getByRole('button', { name: 'مقروء (إلغاء التحديد)' })).toBeVisible();

    // 4. Next chapter navigation works (Chapter 10 -> Chapter 11)
    await page.getByRole('button', { name: /الفصل التالي \(11\)/ }).click();
    await expect(page.getByRole('heading', { name: /الرعيل الأول ودار الأرقم/ })).toBeVisible({
      timeout: 15000,
    });

    // 5. Bidirectional Character Link: Chapter 11 -> Khadijah Profile -> Back to Chapter
    await page.getByRole('button', { name: /خديجة بنت خويلد/ }).first().click();
    await expect(page.locator('#seerah-character-profile')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: /خديجة بنت خويلد/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'الحكاية التاريخية الكاملة' })).toBeVisible();

    // Navigate from Character Profile back to Character Directory
    await page.getByRole('button', { name: 'دليل الشخصيات', exact: true }).click();
    await expect(page.locator('#seerah-character-directory')).toBeVisible({ timeout: 15000 });

    // Search inside Character Directory and open Abu Bakr Al-Siddiq
    await page
      .getByRole('searchbox', { name: 'ابحث في دليل شخصيات السيرة' })
      .fill('أبو بكر الصديق');
    await page.getByRole('button', { name: /أبو بكر الصديق/ }).first().click();
    await expect(page.locator('#seerah-character-profile')).toBeVisible({ timeout: 15000 });

    // Click a related chapter from Abu Bakr's profile
    await page.getByRole('button', { name: /في غار ثور وعلى طريق الهجرة/ }).first().click();
    await expect(page.locator('#seerah-chapter-reader')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: /في غار ثور وعلى طريق الهجرة/ })).toBeVisible();

    // 6. Reload on Landing and verify reading progress + last reading position persisted
    await page.goto('/#/seerah');
    await expect(page.locator('#seerah-book-landing')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/1 من 40 فصلاً/)).toBeVisible();
    await expect(
      page.getByRole('button', { name: /متابعة القراءة: في غار ثور وعلى طريق الهجرة/ })
    ).toBeVisible();

    // Unmark Chapter 10 from Landing and verify progress returns to 0
    await page
      .getByRole('button', { name: /إلغاء تحديد في غار حراء: اقرأ باسم ربك كمقروء/ })
      .click();
    await expect(page.getByText(/0 من 40 فصلاً/)).toBeVisible();

    const overflowX = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(overflowX).toBe(false);
    expect(pageErrors).toEqual([]);
  });

  test('renders responsive digital book and reader cleanly on mobile without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('#seerah-book-landing')).toBeVisible({ timeout: 15000 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);

    await page.getByRole('button', { name: 'اقرأ الفصل' }).first().click();
    await expect(page.locator('#seerah-chapter-reader')).toBeVisible({ timeout: 15000 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
  });
});
