import React, { useEffect, useRef, useState } from 'react';
import { ALL_SURAHS } from '../../data/quranMeta';
import type { Ayah } from '../../types/quran';
import { loadAyahByCoordinate } from '../../data/quranDataLoader';
import {
  getCachedMushafFacsimilePageSync,
  loadMushafFacsimilePage,
  matchMushafAyahAreas,
  preloadAdjacentMushafPages
} from '../../services/mushafFacsimileService';
import type { MushafFacsimilePageData } from '../../services/mushafFacsimileService';

interface QuranMushafFacsimilePageProps {
  page: number;
  onAyahsResolved: (resolved: { page: number; ayahs: Ayah[] }) => void;
  selectedAyah: Ayah | null;
  playingAyah?: Ayah | null;
  onSelectAyah: (ayah: Ayah) => void;
  onFallback: () => void;
  maxWidthClass?: string;
  sessionAyahKeys?: Set<string>;
}

interface MatchedAyahArea {
  area: MushafFacsimilePageData['ayahAreas'][number];
  ayah: Ayah;
}

export const QuranMushafFacsimilePage: React.FC<QuranMushafFacsimilePageProps> = ({
  page,
  onAyahsResolved,
  selectedAyah,
  playingAyah,
  onSelectAyah,
  onFallback,
  maxWidthClass = 'max-w-3xl',
  sessionAyahKeys
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [pageData, setPageData] = useState<MushafFacsimilePageData | null>(() =>
    getCachedMushafFacsimilePageSync(page)
  );
  const [matchedAreas, setMatchedAreas] = useState<MatchedAyahArea[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const syncHit = getCachedMushafFacsimilePageSync(page);
    if (!syncHit) {
      setPageData(null);
      setMatchedAreas([]);
    }
    setError(null);
    preloadAdjacentMushafPages(page);

    loadMushafFacsimilePage(page, controller.signal)
      .then(async data => {
        const resolvedAyahs = await Promise.all(data.ayahAreas.map(area =>
          loadAyahByCoordinate(area.surahNumber, area.ayahNumber)
        ));
        if (resolvedAyahs.some((ayah): ayah is undefined => !ayah)) {
          throw new Error('تحتوي الصفحة المطبوعة على آية لا توجد في بيانات وِرد المحلية.');
        }
        const localAyahs = resolvedAyahs as Ayah[];
        const matched = matchMushafAyahAreas(data.ayahAreas, localAyahs);
        if (!controller.signal.aborted) {
          setPageData(data);
          setMatchedAreas(matched);
          onAyahsResolved({ page, ayahs: matched.map(item => item.ayah) });
        }
      })
      .catch(reason => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error
          ? reason.message
          : 'تعذر التحقق من تخطيط الصفحة المطبوعة.');
      });

    return () => controller.abort();
  }, [page, retry, onAyahsResolved]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !pageData || matchedAreas.length === 0) return;
    const root = host.querySelector('svg');
    if (!(root instanceof SVGSVGElement)) {
      setError('ملف الصفحة لم ينتج رسمًا متجهيًا صالحًا.');
      return;
    }

    root.removeAttribute('width');
    root.removeAttribute('height');
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', `صفحة المصحف المطبوعة رقم ${page}`);
    root.style.width = '100%';
    root.style.height = 'auto';
    root.style.display = 'block';

    const localByCoordinate = new Map(
      matchedAreas.map(({ area, ayah }) => [`${area.surahNumber}:${area.ayahNumber}`, ayah])
    );
    const paths = Array.from(root.querySelectorAll('path.ayahPolygon'));
    if (paths.length !== matchedAreas.length) {
      setError('عدد مواضع الآيات داخل الرسم لا يطابق فهرس الصفحة.');
      return;
    }

    for (const path of paths) {
      const surahNumber = Number(path.getAttribute('surah'));
      const ayahNumber = Number(path.getAttribute('ayah'));
      const ayah = localByCoordinate.get(`${surahNumber}:${ayahNumber}`);
      if (!ayah) {
        setError('تعذر ربط أحد مواضع الرسم بنص وِرد المحلي.');
        return;
      }
      const key = `${surahNumber}:${ayahNumber}`;
      const selected = selectedAyah?.surahNumber === surahNumber &&
        selectedAyah?.numberInSurah === ayahNumber;
      const isRecitingNow = playingAyah?.surahNumber === surahNumber &&
        playingAyah?.numberInSurah === ayahNumber;
      const inSessionRange = sessionAyahKeys?.has(key) ?? false;
      const surah = ALL_SURAHS.find(item => item.number === surahNumber);
      path.setAttribute('id', `wird-ayah-${surahNumber}-${ayahNumber}`);
      path.setAttribute('class', 'ayahPolygon mushaf-ayah-hit-area');
      path.setAttribute('role', 'button');
      path.setAttribute('tabindex', '0');
      path.setAttribute('aria-label', `تفسير الآية ${ayahNumber} من سورة ${surah?.name || surahNumber}`);
      path.setAttribute('aria-pressed', selected ? 'true' : 'false');
      if (isRecitingNow) {
        path.setAttribute('data-playing-ayah', 'true');
      } else {
        path.removeAttribute('data-playing-ayah');
      }
      if (inSessionRange) {
        path.setAttribute('data-session-ayah', 'true');
      } else {
        path.removeAttribute('data-session-ayah');
      }
      if (isRecitingNow) {
        path.setAttribute('fill', '#d4a017');
        path.setAttribute('fill-opacity', '0.38');
      } else if (selected) {
        path.setAttribute('fill', '#c59b27');
        path.setAttribute('fill-opacity', '0.34');
      } else if (inSessionRange) {
        path.setAttribute('fill', '#1c4e46');
        path.setAttribute('fill-opacity', '0.14');
      } else {
        path.setAttribute('fill', '#c59b27');
        path.setAttribute('fill-opacity', '0');
      }
      path.setAttribute('pointer-events', 'visiblePainted');
    }

    const resolveTarget = (target: EventTarget | null): Ayah | null => {
      if (!(target instanceof Element)) return null;
      const path = target.closest('path.ayahPolygon');
      if (!path || !root.contains(path)) return null;
      return localByCoordinate.get(`${Number(path.getAttribute('surah'))}:${Number(path.getAttribute('ayah'))}`) || null;
    };

    const handleClick = (event: MouseEvent) => {
      const ayah = resolveTarget(event.target);
      if (ayah) onSelectAyah(ayah);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const ayah = resolveTarget(event.target);
      if (!ayah) return;
      event.preventDefault();
      onSelectAyah(ayah);
    };
    host.addEventListener('click', handleClick);
    host.addEventListener('keydown', handleKeyDown);

    // Only the opening spread (pages 1–2) has a deliberately oversized viewBox.
    // Preserve the publisher's exact page bounds for all ordinary pages.
    const frame = page <= 2 ? requestAnimationFrame(() => {
      try {
        const bounds = root.getBBox();
        if (bounds.width > 0 && bounds.height > 0) {
          const padding = Math.max(bounds.width, bounds.height) * 0.04;
          root.setAttribute('viewBox', `${bounds.x - padding} ${bounds.y - padding} ${bounds.width + padding * 2} ${bounds.height + padding * 2}`);
        }
      } catch {
        // Keep the publisher's original viewBox if the browser cannot measure SVG ink.
      }
    }) : 0;

    return () => {
      cancelAnimationFrame(frame);
      host.removeEventListener('click', handleClick);
      host.removeEventListener('keydown', handleKeyDown);
    };
  }, [page, pageData, matchedAreas, selectedAyah, playingAyah, onSelectAyah, sessionAyahKeys]);

  if (error) {
    return (
      <section role="alert" className="space-y-4 rounded-2xl border border-[#C59B27]/45 bg-[#F9F6EE] px-4 py-8 text-center dark:border-[#E0A96D]/35 dark:bg-[#111F36]">
        <p className="text-sm font-semibold text-[#142421] dark:text-[#F5F1E8]">{error}</p>
        <p className="text-xs leading-6 text-[#5B6F6B] dark:text-[#8B9E9B]">
          لم نستخدم أي نص قرآني من ملف الرسم. يمكنك الرجوع فورًا إلى نص وِرد المحلي، أو إعادة محاولة تحميل تخطيط الصفحة.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => setRetry(value => value + 1)} className="min-h-11 rounded-xl bg-[#1C4E46] dark:bg-[#1E4A47] px-4 py-2 text-xs font-bold text-white hover:bg-[#143D36]">
            إعادة المحاولة
          </button>
          <button type="button" onClick={onFallback} className="min-h-11 rounded-xl border border-[#C59B27]/45 bg-white px-4 py-2 text-xs font-bold text-[#142421] hover:bg-[#F2EDE2] dark:border-[#E0A96D]/35 dark:bg-[#0B132B] dark:text-[#F5F1E8]">
            متابعة القراءة بالعرض المرن
          </button>
        </div>
      </section>
    );
  }

  if (!pageData || matchedAreas.length === 0) {
    return (
      <div role="status" className="flex min-h-80 flex-col items-center justify-center gap-3 rounded-2xl border border-[#C59B27]/30 bg-[#F9F6EE]/90 px-4 py-12 text-center text-sm text-[#5B6F6B] dark:border-[#E0A96D]/25 dark:bg-[#0E1A2F] dark:text-[#F5F1E8]">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#1C4E46] dark:border-[#E0A96D] border-t-transparent" aria-hidden="true" />
        جارٍ تحميل رسم الصفحة والتحقق من تطابق جميع الآيات...
      </div>
    );
  }

  return (
    <figure className={`mushaf-printed-leaf isolate mx-auto w-full ${maxWidthClass} overflow-hidden rounded-2xl border border-[#C59B27]/45 bg-[var(--wird-mushaf-paper)] p-2 shadow-xl dark:border-[#E0A96D]/35 dark:bg-[#0E1A2F] sm:p-4 transition-colors`}>
      <div
        ref={hostRef}
        className="mushaf-facsimile-svg w-full"
        dangerouslySetInnerHTML={{ __html: pageData.svgMarkup }}
      />
      <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#C59B27]/30 px-2 pt-2 text-[10px] text-[#5B6F6B] dark:border-[#E0A96D]/25 dark:text-[#8B9E9B]">
        <span>رسم الصفحة: مجمع الملك فهد لطباعة المصحف الشريف</span>
        <span>مواضع الآيات التفاعلية: Quran.ws · الإصدار 1.1.1</span>
      </figcaption>
    </figure>
  );
};
