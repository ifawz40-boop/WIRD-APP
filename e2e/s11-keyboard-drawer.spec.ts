import { expect, test } from '@playwright/test';

test('physical Ctrl+KeyB toggles the desktop sidebar with an Arabic keyboard value', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();

  const openToggle = page.getByRole('button', { name: 'إغلاق الشريط الجانبي' }).first();
  await expect(openToggle).toBeVisible();
  await expect(openToggle).toHaveAttribute('aria-expanded', 'true');

  const handled = await page.evaluate(() => {
    const event = new KeyboardEvent('keydown', {
      key: 'لا',
      code: 'KeyB',
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });

  expect(handled, 'the physical KeyB shortcut must be consumed with an Arabic key value').toBe(true);
  const closedToggle = page.getByRole('button', { name: 'فتح الشريط الجانبي' }).first();
  await expect(closedToggle).toHaveAttribute('aria-expanded', 'false');
});

test('mobile section drawer closes immediately with Escape and restores focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();

  const trigger = page.getByRole('button', { name: 'المزيد من الأقسام' });
  await expect(trigger).toBeVisible();
  await trigger.click();

  const dialog = page.getByRole('dialog', { name: 'قائمة الأقسام' });
  await expect(dialog).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(dialog.getByRole('button', { name: 'إغلاق القائمة' })).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('hidden');

  await page.keyboard.press('Escape');

  await expect(dialog).toHaveCount(0);
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('');
});
