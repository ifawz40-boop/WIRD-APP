import { expect, test } from '@playwright/test';
import { PlanningEngine } from '../src/services/planningEngine';
import { buildCacheGenerationKey, buildCanonicalAudioFileKey, OFFLINE_AUDIO_CACHE_NAME, OFFLINE_AUDIO_DB_NAME, OFFLINE_AUDIO_DB_VERSION, STORE_AUDIO_FILES } from '../src/services/offlineQuranAudioLibrary';
import { buildQuranAyahAudioUrl } from '../src/services/ruqyahAudioService';

test('production app shell renders without uncaught runtime errors', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/');
  const root = page.locator('#root');
  await expect(root).toBeVisible();
  await expect(root).not.toBeEmpty();
  await expect(page.locator('body')).toBeVisible();

  expect(pageErrors).toEqual([]);
});

test('production app shell survives a hard refresh', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#root')).toBeVisible();
  await page.reload();
  await expect(page.locator('#root')).toBeVisible();
  await expect(page.locator('#root')).not.toBeEmpty();
});

test('installed service worker serves the complete app shell after an offline reload', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.locator('#root')).not.toBeEmpty();

  const workerReady = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false;
    await navigator.serviceWorker.ready;
    return true;
  });
  expect(workerReady).toBe(true);

  // A reload moves this already-open page under the newly activated worker's control.
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  const cachedShell = await page.evaluate(async () => {
    const cache = await caches.open('wird-app-v4');
    const keys = await cache.keys();
    return keys.map(request => new URL(request.url).pathname);
  });
  expect(cachedShell.some(path => path.endsWith('.js'))).toBe(true);
  expect(cachedShell.some(path => path.endsWith('.css'))).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#root')).toBeVisible();
  await expect(page.locator('#root')).not.toBeEmpty();

  await context.setOffline(false);
});

test('page does not introduce viewport-level horizontal overflow', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#root')).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth
  }));

  expect(
    dimensions.documentWidth,
    `document overflowed viewport: ${dimensions.documentWidth}px > ${dimensions.viewportWidth}px`
  ).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
});


test('dashboard shows the daily session action once and no hard-coded monthly progress', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
  await expect(page.getByText('الهدف الشهري: ختم جزء عمّ')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'جلسة اليوم' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /ابدأ ورد اليوم|ابدأ مراجعة اليوم/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /بدء جلسة الحفظ التفاعلية|بدء جلسة المراجعة التفاعلية/ })).toBeVisible();
});


test('dashboard displays due memorization tasks from all active plans and preserves the selected plan on quick start', async ({ page }) => {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const createPlan = (id: string, title: string, surahNumber: number) => {
    const plan = PlanningEngine.generatePlan({
      title,
      startSurah: surahNumber,
      startAyah: 1,
      endSurah: surahNumber,
      endAyah: 3,
      startDate: today,
      level: 'intermediate',
      dailyAvailableMinutes: 30,
      dailyRevisionMinutes: 15,
      paceType: 'verses_per_day',
      paceQuantity: 3,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      restDays: [],
      schedulePreference: 'single_session'
    });
    plan.id = id;
    plan.title = title;
    plan.input.title = title;
    plan.isActive = true;
    plan.isPaused = false;
    return plan;
  };
  const plans = [
    createPlan('plan-a', '01 خطة أولى', 67),
    createPlan('plan-b', '02 خطة ثانية', 68),
    createPlan('plan-c', '03 خطة ثالثة', 69)
  ];

  await page.addInitScript((enginePlans) => {
    localStorage.setItem('wird_engine_plans', JSON.stringify(enginePlans));
  }, plans);
  await page.goto('/');
  await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();

  const dueSection = page.getByRole('list', { name: 'مهام الخطط النشطة اليوم' });
  await expect(dueSection).toBeVisible();
  await expect(dueSection.getByRole('listitem')).toHaveCount(3);
  await expect(dueSection).toContainText('01 خطة أولى');
  await expect(dueSection).toContainText('02 خطة ثانية');
  await expect(dueSection).toContainText('03 خطة ثالثة');

  await page.goto('/#/revision');
  const headerDailySession = page.getByRole('button', { name: 'جلسة اليوم' });
  await expect(headerDailySession).toBeVisible();
  await headerDailySession.click();
  await expect(page).toHaveURL(new RegExp(`plan=plan-a.*planDate=${today}`));

  await page.goto('/#/dashboard');
  const secondPlanCard = dueSection.getByRole('listitem').filter({ hasText: '02 خطة ثانية' });
  await secondPlanCard.getByRole('button', { name: 'متابعة الحفظ' }).click();
  await expect(page).toHaveURL(new RegExp(`plan=plan-b.*planDate=${today}`));
});

test('tablet portrait keeps compact navigation and opens the full section drawer', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto('/');
  await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();

  const quickNav = page.getByRole('navigation', { name: 'التنقل السريع' });
  await expect(quickNav).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'القائمة الرئيسية' })).toBeHidden();

  await page.getByRole('button', { name: 'المزيد من الأقسام' }).click();
  await expect(page.getByRole('navigation', { name: 'القائمة الرئيسية' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'الإعدادات' })).toBeVisible();
  await expect(page.getByRole('button', { name: /معرض الهوية/ })).toHaveCount(0);
});

test('tablet section drawer traps focus, closes with Escape, and restores its trigger', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto('/');
  await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();

  const trigger = page.getByRole('button', { name: 'المزيد من الأقسام' });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'قائمة الأقسام' });
  const close = dialog.getByRole('button', { name: 'إغلاق القائمة', exact: true });
  const settings = dialog.getByRole('button', { name: 'الإعدادات' });
  await expect(dialog).toBeVisible();
  await expect(close).toBeFocused();
  await expect(close).toHaveCSS('min-height', '44px');
  await page.keyboard.press('Shift+Tab');
  await expect(settings).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('more navigation is marked active while a secondary section is open', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto('/');
  await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
  await page.goto('/#/progress');

  const moreButton = page.getByRole('button', { name: 'المزيد من الأقسام' });
  await expect(moreButton).toHaveAttribute('aria-current', 'page');
});

test('desktop sidebar toggle is persistent, exposes state, and expands the reading viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();

  const toggle = page.getByRole('button', { name: 'إغلاق الشريط الجانبي' }).first();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(toggle).toHaveAttribute('aria-keyshortcuts', 'Control+B Meta+B');
  await toggle.click();
  await expect(page.getByRole('button', { name: 'فتح الشريط الجانبي' })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('button', { name: 'فتح الشريط الجانبي' })).toBeFocused();
  await expect.poll(() => page.locator('main').evaluate(element => getComputedStyle(element).maxWidth)).toBe('none');

  await page.reload();
  const reopenedState = page.getByRole('button', { name: 'فتح الشريط الجانبي' });
  await expect(reopenedState).toHaveAttribute('aria-expanded', 'false');
  await reopenedState.click();
  await expect(page.getByRole('button', { name: 'إغلاق الشريط الجانبي' }).last()).toBeVisible();
  await page.getByRole('button', { name: 'إغلاق الشريط الجانبي' }).last().click();
  await expect(page.getByRole('button', { name: 'فتح الشريط الجانبي' })).toHaveAttribute('aria-expanded', 'false');
});

test('physical KeyB shortcut works with Arabic keyboard layout and mobile drawer closes with Escape', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();

  const desktopSidebarToggle = page.getByRole('button', { name: 'إغلاق الشريط الجانبي' }).first();
  await expect(desktopSidebarToggle).toBeVisible();
  const shortcutHandled = await page.evaluate(() => {
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
  expect(shortcutHandled, 'Ctrl+physical KeyB should be handled even with an Arabic key value').toBe(true);
  await expect(page.getByRole('button', { name: 'فتح الشريط الجانبي' })).toHaveAttribute('aria-expanded', 'false');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'فتح الشريط الجانبي' }).click();
  await expect(page.getByRole('navigation', { name: 'القائمة الرئيسية' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('hidden');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'فتح الشريط الجانبي' })).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('');
});
test('service worker serves durably downloaded Quran audio while offline', async ({ page, context }) => {
  const reciterId = 'ar.alafasy';
  const globalAyahNumber = 1;
  const url = buildQuranAyahAudioUrl(reciterId, globalAyahNumber);
  const generationId = 'e2e-offline-audio-generation';
  const fileKey = buildCanonicalAudioFileKey(reciterId, globalAyahNumber);
  const cacheKey = buildCacheGenerationKey(reciterId, globalAyahNumber, generationId);

  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  await page.evaluate(async ({ dbName, dbVersion, storeName, cacheName, url, fileKey, cacheKey, reciterId, globalAyahNumber, generationId }) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(dbName, dbVersion);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName, { keyPath: 'fileKey' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction([storeName], 'readwrite');
      transaction.objectStore(storeName).put({
        fileKey,
        reciterId,
        surahNumber: 1,
        ayahNumber: 1,
        globalAyahNumber,
        url,
        cacheGenerationId: generationId,
        byteLength: 21,
        contentType: 'audio/mpeg',
        available: true,
        pinned: false,
        deletionPending: false,
        verifiedAtMs: Date.now(),
        schemaVersion: 1
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();

    const cache = await caches.open(cacheName);
    await cache.put(cacheKey, new Response('offline-audio-payload', {
      status: 200,
      headers: { 'content-type': 'audio/mpeg', 'access-control-allow-origin': '*' }
    }));
  }, {
    dbName: OFFLINE_AUDIO_DB_NAME,
    dbVersion: OFFLINE_AUDIO_DB_VERSION,
    storeName: STORE_AUDIO_FILES,
    cacheName: OFFLINE_AUDIO_CACHE_NAME,
    url,
    fileKey,
    cacheKey,
    reciterId,
    globalAyahNumber,
    generationId
  });

  await context.setOffline(true);
  const result = await page.evaluate(async audioUrl => {
    const response = await fetch(audioUrl);
    return { status: response.status, body: await response.text() };
  }, url);
  expect(result).toEqual({ status: 200, body: 'offline-audio-payload' });
  await context.setOffline(false);
});


