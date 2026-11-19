import { expect, test, type Page } from '@playwright/test';

async function openRuqyah(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'المتابعة كزائر دون تسجيل حساب' }).click();
  await page.goto('/#/ruqyah');
  await expect(page.getByRole('button', { name: 'المكتبة الموسعة' })).toBeVisible();
}

async function openIndex(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'المكتبة الموسعة' }).click();
  await expect(page.getByRole('heading', { name: 'فهرس مواضع الآيات' })).toBeVisible();
}

test.describe('W09 Ruqyah page reliability', () => {
  const failures = [
    {
      name: 'HTTP 500 internal proxy failure',
      status: 500,
      body: { error: 'RUQYAH_INTERNAL_ERROR' },
      expected: 'خطأ داخلي مؤقت'
    },
    {
      name: 'HTTP 502 upstream outage',
      status: 502,
      body: { error: 'RUQYAH_SOURCE_UNAVAILABLE' },
      expected: 'غير متاح مؤقتًا'
    },
    {
      name: 'HTTP 429 rate limit',
      status: 429,
      body: { error: 'RUQYAH_SOURCE_RATE_LIMITED' },
      expected: 'حد الطلبات مؤقتًا'
    }
  ];

  for (const scenario of failures) {
    test('index shows a safe actionable error for ' + scenario.name, async ({ page }) => {
      await openRuqyah(page);
      await page.route('**/api/ruqyah?*', route => route.fulfill({
        status: scenario.status,
        contentType: 'application/json',
        body: JSON.stringify(scenario.body)
      }));
      await openIndex(page);
      await expect(page.getByRole('alert')).toContainText(scenario.expected);
      await expect(page.getByRole('button', { name: 'إعادة المحاولة' })).toBeVisible();
    });
  }

  test('index rejects HTML responses and network failures without rendering provider content', async ({ page }) => {
    await openRuqyah(page);
    await page.route('**/api/ruqyah?*', route => route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>Vercel deployment error</title><h1>Not Found</h1>'
    }));
    await openIndex(page);
    await expect(page.getByRole('alert')).toContainText('صفحة HTML بدل بيانات JSON');
    await expect(page.getByText('Vercel deployment error')).toHaveCount(0);
  });

  test('index reports network failures and remains retryable', async ({ page }) => {
    await openRuqyah(page);
    await page.route('**/api/ruqyah?*', route => route.abort('failed'));
    await openIndex(page);
    await expect(page.getByRole('alert')).toContainText('تعذر الاتصال بمصدر الرقية');
    await expect(page.getByRole('button', { name: 'إعادة المحاولة' })).toBeVisible();
  });

  test('manual retry recovers from a transient upstream outage', async ({ page }) => {
    await openRuqyah(page);
    let attempts = 0;
    await page.route('**/api/ruqyah?*', route => {
      attempts += 1;
      if (attempts === 1) {
        return route.fulfill({
          status: 502,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'RUQYAH_SOURCE_UNAVAILABLE' })
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'success', data: [{ id: 1, title: '1:1-7' }] })
      });
    });
    await openIndex(page);
    await expect(page.getByRole('alert')).toContainText('غير متاح مؤقتًا');
    await page.getByRole('button', { name: 'إعادة المحاولة' }).click();
    await expect(page.getByRole('heading', { name: 'سورة الفاتحة' })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(attempts).toBe(2);
  });

  test('a valid empty index has a distinct empty state, not an error', async ({ page }) => {
    await openRuqyah(page);
    await page.route('**/api/ruqyah?*', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'success', data: [] })
    }));
    await openIndex(page);
    await expect(page.getByText('لا توجد مواضع قرآنية في هذا القسم من الفهرس.')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('index timeout settles loading and offers retry', async ({ page }) => {
    test.setTimeout(40_000);
    await page.addInitScript(() => {
      const originalFetch = window.fetch.bind(window);
      window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (!url.includes('/api/ruqyah?')) return originalFetch(input, init);
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
        });
      };
    });
    await openRuqyah(page);
    await openIndex(page);
    await expect(page.getByText('جارٍ تحديث الفهرس', { exact: true })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('انتهت مهلة تحميل فهرس مواضع الآيات', { timeout: 32_000 });
    await expect(page.getByText('جارٍ تحديث الفهرس', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'إعادة المحاولة' })).toBeVisible();
  });

  test('a validated cached index remains usable during a 502 outage', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('wird.ruqyah.index-cache.v1:brief-ruqya', JSON.stringify({
        savedAt: new Date().toISOString(),
        entries: [{ id: 1, title: '1:1-7' }]
      }));
    });
    await openRuqyah(page);
    await page.route('**/api/ruqyah?*', route => route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'RUQYAH_SOURCE_UNAVAILABLE' })
    }));
    await openIndex(page);
    await expect(page.getByText('نسخة محفوظة')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('نعرض آخر نسخة محفوظة');
    await expect(page.getByRole('heading', { name: 'سورة الفاتحة' })).toBeVisible();
  });

  test('short, medium, and long ayah playlists support play, next, pause, resume, and stop', async ({ page }) => {
    await page.addInitScript(() => {
      const media = HTMLMediaElement.prototype;
      media.load = function () {};
      media.play = function () {
        (window as unknown as { __wirdRuqyahAudio?: HTMLMediaElement }).__wirdRuqyahAudio = this;
        this.dispatchEvent(new Event('play'));
        return Promise.resolve();
      };
      media.pause = function () { this.dispatchEvent(new Event('pause')); };
    });
    await openRuqyah(page);

    for (const category of ['الرقية المختصرة', 'الرقية المتوسطة', 'الرقية المطولة الكاملة']) {
      await page.getByRole('button', { name: category }).click();
      await page.getByRole('button', { name: 'تشغيل آيات القسم' }).click();
      await expect(page.getByRole('status').filter({ hasText: 'يتم التشغيل:' })).toBeVisible();
      await expect(page.getByText(/1 \/ [1-9][0-9]*/)).toBeVisible();

      await page.evaluate(() => {
        const audio = (window as unknown as { __wirdRuqyahAudio?: HTMLMediaElement }).__wirdRuqyahAudio;
        audio?.dispatchEvent(new Event('ended'));
      });
      await expect(page.getByText(/2 \/ [1-9][0-9]*/)).toBeVisible();

      await page.getByRole('button', { name: 'إيقاف مؤقت' }).first().click();
      await expect(page.getByRole('status').filter({ hasText: 'متوقف مؤقتًا:' })).toBeVisible();
      await page.getByRole('button', { name: 'استكمال' }).click();
      await expect(page.getByRole('status').filter({ hasText: 'يتم التشغيل:' })).toBeVisible();
      await page.getByRole('button', { name: 'إيقاف', exact: true }).click();
      await expect(page.getByRole('button', { name: 'استكمال' })).toHaveCount(0);
    }
  });

  test('Ruqyah applies shared playback speed without overwriting session repeat preferences', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('wird.audio.playbackRate.v1', '1.5');
      localStorage.setItem('wird.audio.repeatCount.v1', '3');
      localStorage.setItem('wird.audio.segmentRepeatCount.v1', '5');
      const media = HTMLMediaElement.prototype;
      media.load = function () {};
      media.play = function () {
        (window as unknown as { __wirdRuqyahAudio?: HTMLMediaElement }).__wirdRuqyahAudio = this;
        this.dispatchEvent(new Event('play'));
        return Promise.resolve();
      };
      media.pause = function () { this.dispatchEvent(new Event('pause')); };
    });
    await openRuqyah(page);
    await page.getByRole('button', { name: 'تشغيل آيات القسم' }).click();
    await expect.poll(() => page.evaluate(() =>
      (window as unknown as { __wirdRuqyahAudio?: HTMLMediaElement }).__wirdRuqyahAudio?.playbackRate
    )).toBe(1.5);

    await page.getByRole('combobox', { name: 'اختيار قارئ الرقية' }).selectOption('ar.husary');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('wird.audio.ruqyahReciter.v1'))).toBe('ar.husary');
    const repeatPreferences = await page.evaluate(() => ({
      repeat: localStorage.getItem('wird.audio.repeatCount.v1'),
      segmentRepeat: localStorage.getItem('wird.audio.segmentRepeatCount.v1')
    }));
    expect(repeatPreferences).toEqual({ repeat: '3', segmentRepeat: '5' });
  });

  test('Ruqyah follows the shared reciter preference from the memorization session', async ({ page }) => {
    await openRuqyah(page);
    await page.goto('/#/session?surah=1&start=1&end=3&mode=memorize');
    const settings = page.getByRole('button', { name: /إعدادات العرض والصوت/ });
    await settings.click();
    await page.getByRole('combobox', { name: 'اختيار القارئ في الجلسة' }).selectOption('husary');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('wird.audio.preferredReciter.v1'))).toBe('husary');
    await page.goto('/#/ruqyah');
    await expect(page.getByRole('combobox', { name: 'اختيار قارئ الرقية' })).toHaveValue('ar.husary');
  });
});
