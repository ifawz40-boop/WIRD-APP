import { expect, test } from '@playwright/test';

test.describe('WIRD dashboard accessibility and responsive UX', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
    await expect(page.getByRole('heading', { name: /السلام عليكم ورحمة الله/ })).toBeVisible();
  });

  test('weekly activity is exposed as a readable list and quick actions have touch targets', async ({ page }) => {
    const activity = page.getByRole('list', { name: 'النشاط الأسبوعي' });
    await expect(activity).toBeVisible();
    const quickAction = page.getByRole('button', { name: /اختبر حفظك الآن/ });
    await expect(quickAction).toBeVisible();
    await expect(quickAction).toHaveCSS('min-height', '64px');
    await expect(activity.getByRole('listitem')).toHaveCount(7);
    await expect(page.getByRole('progressbar')).toHaveCount(9);
    await expect(page.getByRole('progressbar', { name: 'نسبة الآيات المحفوظة' })).toBeVisible();
    await expect(page.getByRole('progressbar', { name: 'نسبة الصفحات المحفوظة بالكامل' })).toBeVisible();
    await quickAction.focus();
    await expect(quickAction).toBeFocused();
  });

  test('dashboard surfaces due memorization tasks from all active plans with different dates', async ({ page }) => {
    const dueDates = await page.evaluate(() => [-2, -1, 0].map(offset => {
      const date = new Date();
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() + offset);
      return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
    }));

    const enginePlans = [
      { id: 'e2e-plan-oldest', title: 'خطة الحفظ الأولى', date: dueDates[0], surahNumber: 2, surahName: 'البقرة' },
      { id: 'e2e-plan-middle', title: 'خطة الحفظ الثانية', date: dueDates[1], surahNumber: 3, surahName: 'آل عمران' },
      { id: 'e2e-plan-today', title: 'خطة الحفظ الثالثة', date: dueDates[2], surahNumber: 4, surahName: 'النساء' }
    ].map(plan => ({
      id: plan.id,
      title: plan.title,
      input: { title: plan.title },
      meta: {},
      feasibility: {},
      rationale: 'E2E fixture',
      schedule: [{
        id: plan.id + '-day',
        date: plan.date,
        dayOfWeek: 0,
        dayNameAr: 'اليوم',
        isRestDay: false,
        status: 'pending',
        memorizationTask: {
          surahNumber: plan.surahNumber,
          surahName: plan.surahName,
          startAyah: 1,
          endAyah: 3,
          versesCount: 3,
          estimatedMinutes: 10,
          completed: false
        }
      }],
      actualVsPlanned: {},
      isActive: true,
      isPaused: false,
      createdAt: new Date().toISOString()
    }));

    await page.evaluate(async plans => {
      // AuthGate has already created an empty guest archive in IndexedDB.
      // Clear only the three archive stores so startup performs the real
      // legacy-localStorage -> verified IndexedDB migration with our fixture.
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('wird-sync-journal');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const archiveStores = ['enginePlanArchiveHeads', 'enginePlanArchiveManifests', 'enginePlanArchiveRecords'];
      if (!archiveStores.every(name => database.objectStoreNames.contains(name))) {
        database.close();
        throw new Error('Engine plan archive stores are missing from the guest database.');
      }
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(archiveStores, 'readwrite');
        archiveStores.forEach(name => transaction.objectStore(name).clear());
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
      database.close();
      localStorage.setItem('wird_engine_plans', JSON.stringify(plans));
    }, enginePlans);
    await page.reload();
    await expect(page.getByRole('heading', { name: /السلام عليكم ورحمة الله/ })).toBeVisible();

    const dueSection = page.getByRole('list', { name: 'مهام الخطط النشطة اليوم' });
    await expect(dueSection).toBeVisible();
    await expect(dueSection.getByRole('listitem')).toHaveCount(3);
    await expect(page.locator('#dashboard-daily-wird')).toContainText('خطة: خطة الحفظ الأولى');
    await expect(dueSection).toContainText('خطة الحفظ الأولى');
    await expect(dueSection).toContainText('خطة الحفظ الثانية');
    await expect(dueSection).toContainText('خطة الحفظ الثالثة');
    await expect(dueSection).toContainText(`مستحق من ${dueDates[0]}`);
    await expect(dueSection).toContainText(`مستحق من ${dueDates[1]}`);
    await expect(dueSection).toContainText('مهمة اليوم');
  });

  test('dashboard remains usable on a narrow phone without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('heading', { name: 'إجراءات سريعة' })).toBeVisible();
    await expect(page.getByRole('button', { name: /تصفح المصحف والمكتبة/ })).toHaveCSS('min-height', '64px');
    await expect(page.getByRole('button', { name: /بدء جلسة|اختر نطاق الخطة/ })).toHaveCSS('min-height', '48px');
    await expect(page.getByRole('button', { name: 'سورة أخرى' })).toHaveCSS('min-height', '44px');
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
