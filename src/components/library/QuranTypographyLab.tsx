import React, { useEffect, useState } from 'react';
import { loadAyahByCoordinate } from '../../data/quranDataLoader';
import type { Ayah } from '../../types/quran';
import { QuranText } from '../shared/QuranText';

type FontCandidate = 'amiri' | 'system' | 'amiri-quran' | 'uthmanic-hafs' | 'qcf-v2';

const CANDIDATES: Array<{ id: FontCandidate; label: string; family: string; available: boolean; note: string }> = [
  { id: 'amiri-quran', label: 'Amiri Quran', family: "'Amiri Quran', 'Amiri', serif", available: true, note: 'الخط القرآني الرسمي المحمل في التطبيق؛ يدعم كامل الضبط العثماني والإملائي وعلامات الوقف دون تشوه.' },
  { id: 'amiri', label: 'Amiri', family: 'Amiri, serif', available: true, note: 'محمل في التطبيق للقراءة التحريرية والكتب.' },
  { id: 'system', label: 'خط النظام الاحتياطي', family: 'serif', available: true, note: 'يختلف حسب نظام التشغيل والمتصفح.' },
  { id: 'uthmanic-hafs', label: 'Uthmanic Hafs / QPC Hafs', family: 'UthmanicHafs, serif', available: false, note: 'يتطلب نص QPC خاصاً غير متوافق مع ترميز تنزيل القياسي.' },
  { id: 'qcf-v2', label: 'QCF V2', family: 'serif', available: false, note: 'خط صفحي Glyph؛ لا يعمل مع نص Unicode الحالي.' },
];

const SAMPLE_COORDINATES = [
  { surah: 41, ayah: 7 },
  { surah: 2, ayah: 255 },
  { surah: 18, ayah: 1 },
  { surah: 2, ayah: 1 },
];

export function QuranTypographyLab({ onClose }: { onClose: () => void }) {
  const [samples, setSamples] = useState<Ayah[]>([]);
  const [selectedFont, setSelectedFont] = useState<FontCandidate>('amiri-quran');
  const [fontSize, setFontSize] = useState(30);
  const [fontLoaded, setFontLoaded] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all(SAMPLE_COORDINATES.map(point => loadAyahByCoordinate(point.surah, point.ayah)))
      .then(ayahs => {
        if (!cancelled) setSamples(ayahs.filter((ayah): ayah is Ayah => Boolean(ayah)));
      })
      .catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const candidate = CANDIDATES.find(item => item.id === selectedFont);
    if (!candidate?.available || selectedFont === 'system') {
      setFontLoaded(null);
      return;
    }
    document.fonts.ready.then(() => {
      if (!cancelled) setFontLoaded(document.fonts.check(`24px "${candidate.label}"`));
    });
    return () => { cancelled = true; };
  }, [selectedFont]);

  const currentCandidate = CANDIDATES.find(item => item.id === selectedFont) ?? CANDIDATES[0];

  return (
    <section aria-labelledby="quran-typography-title" className="wird-card space-y-5 rounded-2xl p-5 md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="quran-typography-title" className="text-xl font-bold text-[var(--wird-text)] font-editorial-ar">مختبر الخطوط القرآنية</h2>
          <p className="mt-1 text-sm text-[var(--wird-muted)]">النماذج أدناه تُحمّل من قاعدة وِرد المعتمدة، ولا يعاد تشكيل نصها برمجيًا.</p>
        </div>
        <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-[var(--wird-border)] px-4 text-sm font-semibold text-[var(--wird-text)] hover:border-[var(--wird-border-gold)] transition-colors">إغلاق المختبر</button>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="الخط المستخدم في المختبر">
        {CANDIDATES.map(candidate => (
          <button
            key={candidate.id}
            type="button"
            disabled={!candidate.available}
            aria-pressed={selectedFont === candidate.id}
            title={candidate.note}
            onClick={() => setSelectedFont(candidate.id)}
            className={`min-h-11 rounded-xl border px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45 transition-colors ${selectedFont === candidate.id ? 'border-[var(--wird-border-gold)] bg-[var(--wird-primary)] text-[var(--wird-primary-ink)]' : 'border-[var(--wird-border)] text-[var(--wird-text)] bg-[var(--wird-surface-muted)]'}`}
          >
            {candidate.label}{candidate.available ? '' : ' · غير متاح'}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[var(--wird-surface-muted)] p-3 border border-[var(--wird-border)]">
        <label htmlFor="quran-lab-font-size" className="text-sm font-medium text-[var(--wird-text)]">حجم الخط</label>
        <input id="quran-lab-font-size" aria-label="حجم خط المختبر" type="range" min="22" max="48" step="1" value={fontSize} onChange={event => setFontSize(Number(event.target.value))} className="accent-[var(--wird-primary)] dark:accent-[var(--wird-accent)]" />
        <output htmlFor="quran-lab-font-size" className="min-w-12 text-sm tabular-nums text-[var(--wird-text)]">{fontSize}px</output>
        <span role="status" className="text-xs text-[var(--wird-muted)]">
          {selectedFont === 'system' ? currentCandidate.note : fontLoaded === null ? currentCandidate.note : fontLoaded ? 'تم تحميل الخط المختار.' : 'الخط غير محمّل؛ سيعرض المتصفح خطًا احتياطيًا.'}
        </span>
      </div>

      {loadError ? (
        <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">تعذر تحميل نصوص الاختبار من قاعدة وِرد. أعد فتح المختبر للمحاولة مرة أخرى.</p>
      ) : samples.length === 0 ? (
        <p role="status" className="rounded-xl bg-[var(--wird-surface-muted)] p-4 text-sm text-[var(--wird-muted)]">جارٍ تحميل نماذج النص القرآني…</p>
      ) : (
        <div className="space-y-3">
          {samples.map(ayah => (
            <article key={`${ayah.surahNumber}:${ayah.numberInSurah}`} className="rounded-2xl border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] p-4">
              <div className="mb-2 text-xs font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] tabular-nums">الآية {ayah.numberInSurah}</div>
              <p lang="ar" dir="rtl" className="quran-text text-right leading-[2.7] text-[var(--wird-text)]" style={{ fontFamily: currentCandidate.family, fontSize: `${fontSize}px` }}>
                <QuranText surahNumber={ayah.surahNumber} ayahNumber={ayah.numberInSurah}>{ayah.text}</QuranText>
              </p>
            </article>
          ))}
        </div>
      )}

      <p className="text-xs leading-relaxed text-[var(--wird-muted)]">يعتمد التطبيق خط Amiri Quran وScheherazade New لعرض النص القرآني الموحد دون أي رموز دائرية مشوهة، بينما تظل خطوط QPC/QCF الصفحية معطلة لعدم توافقها مع ترميز Unicode القياسي.</p>
    </section>
  );
}
