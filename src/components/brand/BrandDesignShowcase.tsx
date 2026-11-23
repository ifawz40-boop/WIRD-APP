import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  Copy,
  Moon,
  Palette,
  Repeat,
  RotateCcw,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import {
  WIRD_DESIGNS,
  loadThemePreferences,
  resetThemePreferences,
  saveThemePreferences,
  subscribeThemePreferences,
  type WirdDesignId,
  type WirdThemePreferences,
} from '../../services/themePreferences';
import { WirdBrandLockup } from './WirdLogo';
import {
  WirdButton,
  WirdCard,
  WirdCardHeader,
  WirdEmptyState,
  WirdMetadataRow,
  WirdSegmentedTabs,
} from '../ui/WirdPrimitives';

interface BrandDesignShowcaseProps {
  onClose?: () => void;
}

export const BrandDesignShowcase: React.FC<BrandDesignShowcaseProps> = ({
  onClose,
}) => {
  const [themePrefs, setThemePrefs] = useState<WirdThemePreferences>(() =>
    loadThemePreferences()
  );
  const [previewPreset, setPreviewPreset] = useState<WirdDesignId>(
    themePrefs.design
  );
  const [previewMode, setPreviewMode] = useState<'day' | 'night'>('day');
  const [sampleTab, setSampleTab] = useState<'mushaf' | 'hifz' | 'adhkar'>(
    'mushaf'
  );
  const [copiedHex, setCopiedHex] = useState<string | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const unsub = subscribeThemePreferences((next) => {
      setThemePrefs(next);
    });
    return () => {
      unsub();
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const copyHex = (hex: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(hex);
      setCopiedHex(hex);
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedHex(null);
        copyTimerRef.current = null;
      }, 1800);
    }
  };

  const selectedMeta =
    WIRD_DESIGNS.find((item) => item.id === previewPreset) ||
    WIRD_DESIGNS[0];
  const palette =
    previewMode === 'night' ? selectedMeta.night : selectedMeta.day;

  const swatches = [
    { label: 'خلفية القراءة (Canvas)', hex: palette.bg },
    { label: 'السطح التحريري (Surface)', hex: palette.surface },
    { label: 'اللون الأساسي (Primary)', hex: palette.primary },
    { label: 'اللمسة المطفأة (Accent)', hex: palette.accent },
    { label: 'النص الأساسي (Ink)', hex: palette.ink },
  ];

  const handleApplyPreset = (designId: WirdDesignId) => {
    const updated = saveThemePreferences({ design: designId, preset: designId });
    setThemePrefs(updated);
    setPreviewPreset(designId);
  };

  return (
    <div dir="rtl" className="space-y-6 max-w-6xl mx-auto pb-16 text-right">
      {/* Header Card */}
      <WirdCard className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <WirdBrandLockup symbolSize={36} textSize="md" showSubtitle={false} />
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--wird-text)] wird-headline-balance">
              نظام التصميم الرباعي — وِرد (Design A & B × Light / Dark)
            </h1>
            <WirdMetadataRow
              items={[
                'تصميمان مستقلان (A و B)',
                'وضعان لونيان مستقلان (نهاري وليلي)',
                '4 تجارب متكاملة بلا إعادة تحميل',
              ]}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <WirdSegmentedTabs
              ariaLabel="وضع المعاينة"
              value={previewMode}
              onChange={setPreviewMode}
              options={[
                { id: 'day', label: 'الوضع النهاري', icon: Sun },
                { id: 'night', label: 'الوضع الليلي', icon: Moon },
              ]}
            />
            {onClose && (
              <WirdButton
                variant="secondary"
                size="icon"
                onClick={onClose}
                aria-label="إغلاق معرض التصميم"
              >
                <X className="w-4 h-4" />
              </WirdButton>
            )}
          </div>
        </div>
      </WirdCard>

      {/* Design Comparison Grid */}
      <section className="space-y-3">
        <WirdCardHeader
          title="مقارنة التصميمين المعتمدين (A و B)"
          subtitle="عاين كل تصميم في الوضع النهاري والليلي وطبّقه مباشرة على التطبيق بأكمله."
          action={
            <WirdButton
              variant="secondary"
              size="sm"
              onClick={() => {
                const reset = resetThemePreferences();
                setThemePrefs(reset);
                setPreviewPreset(reset.design);
              }}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>استعادة الافتراضي</span>
            </WirdButton>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {WIRD_DESIGNS.map((design) => {
            const p = previewMode === 'night' ? design.night : design.day;
            const isApplied = themePrefs.design === design.id;
            const isPreviewed = previewPreset === design.id;
            return (
              <div
                key={design.id}
                className={`rounded-[var(--wird-radius-card)] border p-4 flex flex-col justify-between gap-4 transition-colors ${
                  isPreviewed
                    ? 'border-[var(--wird-accent)] bg-[var(--wird-surface)]'
                    : 'border-[var(--wird-border)] bg-[var(--wird-surface)]'
                }`}
              >
                <div className="space-y-3">
                  {/* Actual Reference Preview Image */}
                  <div
                    className="relative h-44 rounded-xl overflow-hidden border border-black/10 dark:border-white/15"
                    style={{ backgroundColor: p.bg }}
                  >
                    <img
                      src={p.previewImage}
                      alt={`معاينة ${design.nameAr} — ${p.labelAr}`}
                      loading="lazy"
                      className="w-full h-full object-cover object-top"
                    />
                    <span
                      className="absolute bottom-2 inset-inline-end-2 px-2.5 py-1 rounded-lg text-[11px] font-bold shadow-sm"
                      style={{ backgroundColor: p.primary, color: '#F6F0E3' }}
                    >
                      {p.labelAr}
                    </span>
                  </div>

                  {/* Live Typography Sample */}
                  <div
                    className="rounded-xl p-3 border text-xs leading-relaxed font-quran"
                    style={{
                      backgroundColor: p.surface,
                      borderColor: `${p.accent}44`,
                      color: p.ink,
                    }}
                  >
                    ﴿ إِنَّ هَـٰذَا ٱلْقُرْءَانَ يَهْدِى لِلَّتِى هِىَ أَقْوَمُ ﴾
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-[var(--wird-text)]">
                        {design.nameAr}
                      </h3>
                      {isApplied && (
                        <span className="text-[11px] font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
                          مفعّل الآن
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--wird-muted)] leading-relaxed">
                      {design.taglineAr}
                    </p>
                    <p className="text-[11px] text-[var(--wird-muted)] opacity-85">
                      {design.characterAr}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <WirdButton
                    variant={isApplied ? 'secondary' : 'primary'}
                    size="sm"
                    className="flex-1"
                    onClick={() => handleApplyPreset(design.id)}
                  >
                    {isApplied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>مطبّق حالياً</span>
                      </>
                    ) : (
                      <>
                        <Palette className="w-3.5 h-3.5" />
                        <span>تطبيق {design.shortNameAr}</span>
                      </>
                    )}
                  </WirdButton>
                  <WirdButton
                    variant="ghost"
                    size="sm"
                    onClick={() => setPreviewPreset(design.id)}
                  >
                    فحص الألوان
                  </WirdButton>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Active Preset Token Inspector */}
      <WirdCard className="space-y-4">
        <WirdCardHeader
          title={`توكنز الألوان — ${selectedMeta.nameAr}`}
          subtitle="انقر على أي لون لنسخ قيمته القياسية."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {swatches.map((swatch) => (
            <button
              key={`${selectedMeta.id}-${swatch.label}`}
              type="button"
              onClick={() => copyHex(swatch.hex)}
              className="p-3 rounded-[var(--wird-radius-control)] border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] hover:border-[var(--wird-border-strong)] transition-colors text-right space-y-2 wird-focus-ring"
            >
              <div
                className="h-12 w-full rounded-lg border border-black/10 dark:border-white/10"
                style={{ backgroundColor: swatch.hex }}
              />
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-[var(--wird-text)] truncate">
                  {swatch.label}
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono wird-tabular text-[var(--wird-muted)]">
                  <span>{swatch.hex}</span>
                  {copiedHex === swatch.hex ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 opacity-60" />
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </WirdCard>

      {/* Live Hand-Crafted UI Primitives Demo */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <WirdCard className="lg:col-span-7 space-y-4">
          <WirdCardHeader
            title="المكونات الأساسية المصممة يدوياً"
            subtitle="أزرار وتبويبات وبيانات وصفية خالية من الكبسولات العشوائية، متوافقة تماماً مع RTL."
          />

          <div className="flex flex-wrap items-center gap-2.5">
            <WirdButton variant="primary">بدء ورد اليوم</WirdButton>
            <WirdButton variant="secondary">تصفح المصحف</WirdButton>
            <WirdButton variant="accent">تسجيل الإتمام</WirdButton>
            <WirdButton variant="ghost">إلغاء</WirdButton>
          </div>

          <div className="pt-2 border-t border-[var(--wird-border)] space-y-3">
            <WirdSegmentedTabs
              ariaLabel="أقسام تجريبية"
              value={sampleTab}
              onChange={setSampleTab}
              options={[
                { id: 'mushaf', label: 'المصحف المطبوع', icon: BookOpen, count: 604 },
                { id: 'hifz', label: 'جلسة الحفظ', icon: Sparkles },
                { id: 'adhkar', label: 'المراجعة', icon: Repeat, count: 5 },
              ]}
            />
            <WirdMetadataRow
              items={[
                'سورة الكهف',
                'الجزء 15',
                'الصفحة 293',
                '110 آيات',
              ]}
            />
          </div>
        </WirdCard>

        <div className="lg:col-span-5">
          <WirdEmptyState
            icon={BookOpen}
            title="حالة فارغة موحدة وهادئة"
            description="تُستخدم عبر الأقسام كافة عند عدم وجود بيانات، مع رسالة واضحة وإجراء واحد مباشر دون ازدحام."
            action={
              <WirdButton variant="primary" size="sm">
                إضافة أول ورد
              </WirdButton>
            }
          />
        </div>
      </div>
    </div>
  );
};
