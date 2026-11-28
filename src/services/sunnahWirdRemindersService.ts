export interface SunnahWirdSuggestion {
  id: 'friday_kahf' | 'nightly_mulk' | 'morning_adhkar' | 'evening_adhkar';
  badgeAr: string;
  titleAr: string;
  subtitleAr: string;
  actionLabelAr: string;
  target:
    | { kind: 'surah'; surahNumber: number; startAyah: number; endAyah: number }
    | { kind: 'tab'; tab: 'adhkar' };
}

/**
 * Computes timely Sunnah & daily Wird gentle prompts (inspired by Khatmah & Ayah)
 * based on day-of-week and local hour, with zero external tracking.
 */
export function getContextualSunnahSuggestions(now: Date = new Date()): SunnahWirdSuggestion[] {
  const day = now.getDay(); // 5 = Friday
  const hour = now.getHours();
  const suggestions: SunnahWirdSuggestion[] = [];

  if (day === 5) {
    suggestions.push({
      id: 'friday_kahf',
      badgeAr: 'سُنّة يوم الجمعة',
      titleAr: 'قراءة سورة الكهف',
      subtitleAr: 'نورٌ ما بين الجمعتين — افتحها مباشرة في جلسة القراءة والتدبر',
      actionLabelAr: 'ابدأ سورة الكهف',
      target: { kind: 'surah', surahNumber: 18, startAyah: 1, endAyah: 10 },
    });
  }

  if (hour >= 19 || hour < 4) {
    suggestions.push({
      id: 'nightly_mulk',
      badgeAr: 'وِرد المساء والمنجية',
      titleAr: 'قراءة سورة الملك قبل النوم',
      subtitleAr: 'ثلاثون آية تشفع لصاحبها وتُراجَع في دقائق معدودة',
      actionLabelAr: 'افتح سورة الملك',
      target: { kind: 'surah', surahNumber: 67, startAyah: 1, endAyah: 30 },
    });
  }

  if (hour >= 4 && hour < 11) {
    suggestions.push({
      id: 'morning_adhkar',
      badgeAr: 'حصن الصباح',
      titleAr: 'أذكار الصباح المأثورة',
      subtitleAr: 'ابدأ يومك بذكر الله والطمأنينة مع العدّاد التفاعلي الموثق',
      actionLabelAr: 'فتح أذكار الصباح',
      target: { kind: 'tab', tab: 'adhkar' },
    });
  } else if (hour >= 15 && hour < 20) {
    suggestions.push({
      id: 'evening_adhkar',
      badgeAr: 'حصن المساء',
      titleAr: 'أذكار المساء المأثورة',
      subtitleAr: 'أمسِ على ذكر الله ومراجعة حصن المساء الصحيح',
      actionLabelAr: 'فتح أذكار المساء',
      target: { kind: 'tab', tab: 'adhkar' },
    });
  }

  return suggestions.slice(0, 2);
}
