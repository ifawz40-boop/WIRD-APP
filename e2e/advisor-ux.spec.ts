import { expect, test } from '@playwright/test';

test.describe('WIRD Quran advisor UX', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
    await page.goto('/#/advisor');
  });

  test('advisor tabs expose selected state and the mutashabihat disclaimer', async ({ page }) => {
    const advisorTab = page.getByRole('button', { name: /المستشار الذكي وتحليل وتيرة الحفظ/ });
    const rulesTab = page.getByRole('button', { name: 'قواعد ضبط المتشابهات' });

    await expect(page.getByRole('group', { name: 'أقسام المستشار القرآني' })).toBeVisible();
    await expect(advisorTab).toHaveAttribute('aria-pressed', 'true');
    await expect(advisorTab).toHaveCSS('min-height', '44px');
    await expect(advisorTab).toHaveClass(/focus-visible:ring-2/);
    await rulesTab.click();
    await expect(rulesTab).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText(/وسائل تذكّر مساعدة وليست قواعد قطعية/)).toBeVisible();

    await advisorTab.click();
    await expect(advisorTab).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText(/لا تعتمد عليه في نقل نص القرآن أو تفسيره/)).toBeVisible();
  });

  test('advisor quick actions and chat controls are accessible on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await expect(page.getByRole('button', { name: /تحليل وتيرة الحفظ والمراجعة/ })).toHaveCSS('min-height', '44px');
    await expect(page.getByRole('textbox', { name: 'رسالتك إلى المستشار القرآني' })).toHaveCSS('min-height', '44px');
    await expect(page.getByRole('button', { name: 'إرسال الرسالة' })).toHaveCSS('min-height', '44px');

    await page.getByRole('button', { name: 'حاسبة التخطيط القرآني' }).click();
    await expect(page.getByRole('combobox')).toHaveCSS('min-height', '44px');
  });

  test('planning calculator handles cleared input without NaN and uses 604 pages for full Quran', async ({ page }) => {
    await page.getByRole('button', { name: 'حاسبة التخطيط القرآني' }).click();

    const minutesInput = page.getByRole('spinbutton', { name: 'الوقت المتاح يومياً بالدقائق' });
    await minutesInput.fill('');
    await expect(page.getByText(/يوماً/)).not.toContainText('NaN');
    await expect(page.getByText('60 يوماً')).toBeVisible();

    await page.getByRole('combobox', { name: 'الهدف القرآني المراد حفظه' }).selectOption('30');
    await expect(page.getByText('604 يوماً')).toBeVisible();
  });
});
