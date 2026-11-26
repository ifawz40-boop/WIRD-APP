import React, { useState } from 'react';
import {
  Check,
  Moon,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Sun,
} from 'lucide-react';
import {
  WIRD_DESIGNS,
  getActiveVariantSummary,
  type WirdAppearanceMode,
  type WirdCornerStyle,
  type WirdDesignId,
  type WirdLayoutDensity,
  type WirdPaperTone,
  type WirdQuranFontFamily,
  type WirdThemePreferences,
  type WirdVariantPalette,
} from '../../services/themePreferences';
import { WirdButton, WirdMetadataRow } from './WirdPrimitives';

export interface AppearanceSelectorPanelProps {
  mode: WirdAppearanceMode;
  onSetMode: (mode: WirdAppearanceMode) => void;
  preferences: WirdThemePreferences;
  onUpdatePreferences: (
    partial: Partial<Omit<WirdThemePreferences, 'schemaVersion'>>
  ) => void;
  onReset: () => void;
  onOpenShowcase?: () => void;
  /** 'sheet' = compact vertical stack; 'settings' = wider inline 2-column gallery. */
  layout?: 'sheet' | 'settings';
}

const VariantPreviewThumbnail: React.FC<{
  palette: WirdVariantPalette;
  designCode: 'A' | 'B';
  alt: string;
  compact?: boolean;
}> = ({ palette, designCode, alt, compact = false }) => {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl border border-black/10 dark:border-white/15 ${
        compact ? 'h-24' : 'h-32 sm:h-36'
      }`}
      style={{ backgroundColor: palette.bg }}
    >
      {!imgFailed ? (
        <img
          src={palette.previewImage}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover object-top select-none"
        />
      ) : (
        /* Graceful miniature UI preview derived from exact palette tokens if image cannot load */
        <div
          className="w-full h-full p-2.5 flex gap-2"
          style={{ backgroundColor: palette.bg }}
          aria-hidden="true"
        >
          <div
            className="w-10 rounded-lg border border-black/10 flex flex-col gap-1.5 p-1.5"
            style={{ backgroundColor: palette.surfaceMuted }}
          >
            <span
              className="h-2.5 rounded-sm"
              style={{ backgroundColor: palette.primary }}
            />
            <span
              className="h-1.5 rounded-sm opacity-45"
              style={{ backgroundColor: palette.ink }}
            />
            <span
              className="h-1.5 rounded-sm opacity-30"
              style={{ backgroundColor: palette.ink }}
            />
          </div>
          <div className="flex-1 flex flex-col gap-1.5">
            <div
              className="h-7 rounded-lg px-2 flex items-center justify-between"
              style={{ backgroundColor: palette.primary }}
            >
              <span
                className="w-10 h-1.5 rounded-full"
                style={{ backgroundColor: palette.accent }}
              />
              <span className="w-4 h-4 rounded-full bg-white/20" />
            </div>
            <div className="flex-1 grid grid-cols-2 gap-1.5">
              <div
                className="rounded-lg border border-black/10 p-1.5"
                style={{ backgroundColor: palette.surface }}
              >
                <span
                  className="block w-8 h-1.5 rounded-full opacity-70"
                  style={{ backgroundColor: palette.ink }}
                />
              </div>
              <div
                className="rounded-lg border border-black/10 p-1.5"
                style={{ backgroundColor: palette.surface }}
              >
                <span
                  className="block w-6 h-1.5 rounded-full"
                  style={{ backgroundColor: palette.accent }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subtle corner emblem badge from supplied design reference */}
      <div
        className="absolute bottom-2 inset-inline-end-2 flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-bold shadow-sm backdrop-blur-md border border-white/20"
        style={{
          backgroundColor: `${palette.primary}e6`,
          color: '#F6F0E3',
        }}
      >
        <img
          src={palette.emblemImage}
          alt=""
          aria-hidden="true"
          className="w-4 h-4 rounded-sm object-cover shrink-0"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
        <span>{designCode === 'A' ? 'التصميم A' : 'التصميم B'}</span>
      </div>
    </div>
  );
};

export const AppearanceSelectorPanel: React.FC<AppearanceSelectorPanelProps> = ({
  mode,
  onSetMode,
  preferences,
  onUpdatePreferences,
  onReset,
  onOpenShowcase,
  layout = 'sheet',
}) => {
  const activeSummary = getActiveVariantSummary(preferences.design, mode);
  const isSettingsLayout = layout === 'settings';

  const handleSelectDesign = (design: WirdDesignId) => {
    // Changing design NEVER resets the current Light/Dark appearance mode.
    onUpdatePreferences({ design, preset: design });
  };

  const handleSelectVariant = (
    design: WirdDesignId,
    nextMode: WirdAppearanceMode
  ) => {
    if (preferences.design !== design) {
      onUpdatePreferences({ design, preset: design });
    }
    if (mode !== nextMode) {
      onSetMode(nextMode);
    }
  };

  return (
    <div className="space-y-5" data-appearance-selector={layout}>
      {/* Active Combination Summary */}
      <div className="p-3.5 rounded-[var(--wird-radius-card)] bg-[var(--wird-surface-muted)] border border-[var(--wird-border-gold)] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl overflow-hidden border border-[var(--wird-border-gold)] shrink-0 bg-[var(--wird-primary)]">
            <img
              src={activeSummary.palette.emblemImage}
              alt={activeSummary.combinedLabelAr}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--wird-accent)]">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>المظهر النشط حالياً</span>
            </div>
            <div
              className="text-xs sm:text-sm font-bold text-[var(--wird-text)] truncate"
              data-active-variant-label
            >
              {activeSummary.combinedLabelAr}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0" aria-hidden="true">
          {[
            activeSummary.palette.bg,
            activeSummary.palette.surface,
            activeSummary.palette.primary,
            activeSummary.palette.accent,
          ].map((hex, index) => (
            <span
              key={`active-swatch-${index}`}
              className="w-5 h-5 rounded-md border border-black/15 dark:border-white/20"
              style={{ backgroundColor: hex }}
            />
          ))}
        </div>
      </div>

      {/* Axis 1: Independent Appearance Mode (Light vs Dark) */}
      <section className="space-y-2.5" aria-label="وضع الإضاءة">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold text-[var(--wird-text)]">
            1. وضع الإضاءة (مستقل عن التصميم)
          </h3>
          <WirdMetadataRow
            items={[mode === 'dark' ? 'ليلي (Dark)' : 'نهاري (Light)']}
          />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {(
            [
              {
                id: 'light' as WirdAppearanceMode,
                label: 'الوضع النهاري',
                sublabel: activeSummary.design.day.labelAr,
                icon: Sun,
                palette: activeSummary.design.day,
              },
              {
                id: 'dark' as WirdAppearanceMode,
                label: 'الوضع الليلي',
                sublabel: activeSummary.design.night.labelAr,
                icon: Moon,
                palette: activeSummary.design.night,
              },
            ] as const
          ).map((option) => {
            const Icon = option.icon;
            const isSelected = mode === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onSetMode(option.id)}
                aria-pressed={isSelected}
                data-appearance-mode-option={option.id}
                className={`min-h-14 p-3 rounded-[var(--wird-radius-control)] border text-right flex items-center justify-between gap-2 transition-colors wird-focus-ring ${
                  isSelected
                    ? 'border-[var(--wird-accent)] bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] shadow-xs'
                    : 'border-[var(--wird-border)] bg-[var(--wird-surface)] text-[var(--wird-text)] hover:border-[var(--wird-border-strong)]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-white/15 text-[var(--wird-accent)]'
                        : 'bg-[var(--wird-surface-muted)] text-[var(--wird-primary)] dark:text-[var(--wird-accent)]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">
                      {option.label}
                    </div>
                    <div
                      className={`text-[10px] truncate mt-0.5 ${
                        isSelected
                          ? 'opacity-85'
                          : 'text-[var(--wird-muted)]'
                      }`}
                    >
                      {option.sublabel}
                    </div>
                  </div>
                </div>
                {isSelected && (
                  <Check className="w-4 h-4 shrink-0 text-[var(--wird-accent)]" />
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Axis 2: Independent Design System (Design A vs Design B) */}
      <section className="space-y-3" aria-label="اختيار التصميم">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold text-[var(--wird-text)]">
            2. الهوية والتصميم (مستقل عن الوضع اللوني)
          </h3>
          <WirdMetadataRow items={['تصميمان × وضعان = 4 تجارب']} />
        </div>

        <div
          className={
            isSettingsLayout
              ? 'grid grid-cols-1 md:grid-cols-2 gap-3.5'
              : 'space-y-3'
          }
        >
          {WIRD_DESIGNS.map((design) => {
            const isSelected = preferences.design === design.id;
            const activePalette = mode === 'dark' ? design.night : design.day;

            return (
              <button
                key={design.id}
                type="button"
                onClick={() => handleSelectDesign(design.id)}
                aria-pressed={isSelected}
                data-design-option={design.id}
                className={`w-full text-right p-3.5 rounded-[var(--wird-radius-card)] border transition-all wird-focus-ring space-y-3 ${
                  isSelected
                    ? 'border-[var(--wird-accent)] bg-[var(--wird-surface-muted)] ring-1 ring-[var(--wird-border-gold)]'
                    : 'border-[var(--wird-border)] bg-[var(--wird-surface)] hover:border-[var(--wird-border-strong)]'
                }`}
              >
                <VariantPreviewThumbnail
                  palette={activePalette}
                  designCode={design.code}
                  alt={`معاينة ${design.nameAr} — ${activePalette.labelAr}`}
                  compact={!isSettingsLayout}
                />

                <div className="flex items-start justify-between gap-2.5">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-bold text-[var(--wird-text)]">
                        {design.nameAr}
                      </span>
                      {design.id === 'design-a' && (
                        <span className="text-[11px] font-semibold text-[var(--wird-accent)]">
                          · افتراضي
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--wird-muted)] leading-relaxed">
                      {design.taglineAr}
                    </p>
                  </div>
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)]'
                        : 'border border-[var(--wird-border-strong)] bg-transparent'
                    }`}
                    aria-hidden="true"
                  >
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                  </span>
                </div>

                {/* Palette swatches for both Day & Night */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--wird-border)]">
                  <div className="flex items-center gap-1.5" aria-hidden="true">
                    {[
                      activePalette.bg,
                      activePalette.surface,
                      activePalette.primary,
                      activePalette.accent,
                    ].map((hex, i) => (
                      <span
                        key={`${design.id}-${i}`}
                        className="w-5 h-5 rounded-md border border-black/15 dark:border-white/15"
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] font-medium text-[var(--wird-muted)] truncate">
                    {activePalette.labelAr}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 4-Variant Quick Visual Gallery (Shown in full Settings view) */}
      {isSettingsLayout && (
        <section className="space-y-2.5" aria-label="معاينة التركيبات الأربع">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-[var(--wird-text)]">
              معاينة مباشرة للتركيبات الأربع المعتمدة
            </h3>
            <WirdMetadataRow items={['تبديل فوري دون إعادة تحميل']} />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {WIRD_DESIGNS.flatMap((design) =>
              (['light', 'dark'] as const).map((variantMode) => {
                const palette =
                  variantMode === 'dark' ? design.night : design.day;
                const isExactActive =
                  preferences.design === design.id && mode === variantMode;
                return (
                  <button
                    key={`${design.id}-${variantMode}`}
                    type="button"
                    onClick={() => handleSelectVariant(design.id, variantMode)}
                    aria-pressed={isExactActive}
                    data-variant-tile={`${design.id}-${variantMode}`}
                    className={`p-2 rounded-xl border text-right transition-all wird-focus-ring space-y-2 ${
                      isExactActive
                        ? 'border-[var(--wird-accent)] bg-[var(--wird-surface-muted)] ring-1 ring-[var(--wird-border-gold)]'
                        : 'border-[var(--wird-border)] bg-[var(--wird-surface)] hover:border-[var(--wird-border-strong)]'
                    }`}
                  >
                    <div
                      className="relative h-20 rounded-lg overflow-hidden border border-black/10 dark:border-white/15"
                      style={{ backgroundColor: palette.bg }}
                    >
                      <img
                        src={palette.previewImage}
                        alt={`${design.shortNameAr} — ${palette.labelAr}`}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover object-top"
                      />
                      {isExactActive && (
                        <span className="absolute top-1.5 inset-inline-end-1.5 w-5 h-5 rounded-full bg-[var(--wird-accent)] text-[var(--wird-accent-ink)] flex items-center justify-center shadow-sm">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <div className="px-0.5">
                      <div className="text-[11px] font-bold text-[var(--wird-text)] truncate">
                        {design.shortNameAr} ·{' '}
                        {variantMode === 'dark' ? 'ليلي' : 'نهاري'}
                      </div>
                      <div className="text-[10px] text-[var(--wird-muted)] truncate">
                        {palette.labelAr}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>
      )}

      {/* Workspace Density & Corner Geometry */}
      <div
        className={
          isSettingsLayout
            ? 'grid grid-cols-1 md:grid-cols-2 gap-4 pt-1'
            : 'space-y-4'
        }
      >
        <section className="space-y-2">
          <h3 className="text-xs font-bold text-[var(--wird-text)]">
            كثافة المساحات
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                {
                  id: 'comfortable',
                  label: 'مريح وهادئ',
                  hint: 'مساحات تنفس أوسع',
                },
                {
                  id: 'compact',
                  label: 'مدمج ومنظم',
                  hint: 'تمرير أقل وعرض أوسع',
                },
              ] as const
            ).map((option) => {
              const active = preferences.density === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    onUpdatePreferences({
                      density: option.id as WirdLayoutDensity,
                    })
                  }
                  className={`p-2.5 rounded-[var(--wird-radius-control)] border text-right transition-colors wird-focus-ring ${
                    active
                      ? 'border-[var(--wird-accent)] bg-[var(--wird-surface-muted)]'
                      : 'border-[var(--wird-border)] bg-[var(--wird-surface)] hover:border-[var(--wird-border-strong)]'
                  }`}
                >
                  <div className="text-xs font-bold text-[var(--wird-text)]">
                    {option.label}
                  </div>
                  <div className="text-[11px] text-[var(--wird-muted)] mt-0.5">
                    {option.hint}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-bold text-[var(--wird-text)]">
            هندسة الحواف
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                {
                  id: 'refined',
                  label: 'متزن دقيق',
                  hint: 'حواف متناسقة مع التصميم',
                },
                {
                  id: 'soft',
                  label: 'ناعم مستدير',
                  hint: 'انحناءات أوسع للبطاقات',
                },
              ] as const
            ).map((option) => {
              const active = preferences.corners === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    onUpdatePreferences({
                      corners: option.id as WirdCornerStyle,
                    })
                  }
                  className={`p-2.5 rounded-[var(--wird-radius-control)] border text-right transition-colors wird-focus-ring ${
                    active
                      ? 'border-[var(--wird-accent)] bg-[var(--wird-surface-muted)]'
                      : 'border-[var(--wird-border)] bg-[var(--wird-surface)] hover:border-[var(--wird-border-strong)]'
                  }`}
                >
                  <div className="text-xs font-bold text-[var(--wird-text)]">
                    {option.label}
                  </div>
                  <div className="text-[11px] text-[var(--wird-muted)] mt-0.5">
                    {option.hint}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* Reading Paper Surface & Self-Hosted Quranic Font Selector */}
      <div
        className={
          isSettingsLayout
            ? 'grid grid-cols-1 md:grid-cols-2 gap-4 pt-1'
            : 'space-y-4'
        }
      >
        <section className="space-y-2" aria-label="خامة ورق القراءة والمصحف">
          <h3 className="text-xs font-bold text-[var(--wird-text)]">
            خامة ورق القراءة (الوضع النهاري)
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                {
                  id: 'default',
                  label: 'القياسي',
                  swatch: '#FAF6EE',
                },
                {
                  id: 'madinah-cream',
                  label: 'ورق المدينة',
                  swatch: '#FDF6E2',
                },
                {
                  id: 'sepia-warm',
                  label: 'سيبيا دافئ',
                  swatch: '#F5EAD2',
                },
              ] as const
            ).map((option) => {
              const active = (preferences.paperTone || 'default') === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    onUpdatePreferences({
                      paperTone: option.id as WirdPaperTone,
                    })
                  }
                  className={`p-2.5 rounded-[var(--wird-radius-control)] border text-right transition-colors wird-focus-ring flex items-center gap-2 ${
                    active
                      ? 'border-[var(--wird-accent)] bg-[var(--wird-surface-muted)]'
                      : 'border-[var(--wird-border)] bg-[var(--wird-surface)] hover:border-[var(--wird-border-strong)]'
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full border border-black/20 shrink-0"
                    style={{ backgroundColor: option.swatch }}
                    aria-hidden="true"
                  />
                  <span className="text-xs font-bold text-[var(--wird-text)] truncate">
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-2" aria-label="نوع الخط القرآني المدمج">
          <h3 className="text-xs font-bold text-[var(--wird-text)]">
            خط الآيات القرآنية (محلي أوفلاين)
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                {
                  id: 'amiri-quran',
                  label: 'أميري قرآني',
                  sample: 'بِسْمِ اللَّهِ',
                  fontFamily: "'Amiri Quran', serif",
                },
                {
                  id: 'scheherazade',
                  label: 'شهرزاد الفسيح',
                  sample: 'بِسْمِ اللَّهِ',
                  fontFamily: "'Scheherazade New', serif",
                },
              ] as const
            ).map((option) => {
              const active =
                (preferences.quranFont || 'amiri-quran') === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    onUpdatePreferences({
                      quranFont: option.id as WirdQuranFontFamily,
                    })
                  }
                  className={`p-2.5 rounded-[var(--wird-radius-control)] border text-right transition-colors wird-focus-ring flex items-center justify-between gap-2 ${
                    active
                      ? 'border-[var(--wird-accent)] bg-[var(--wird-surface-muted)]'
                      : 'border-[var(--wird-border)] bg-[var(--wird-surface)] hover:border-[var(--wird-border-strong)]'
                  }`}
                >
                  <span className="text-xs font-bold text-[var(--wird-text)]">
                    {option.label}
                  </span>
                  <span
                    className="text-sm text-[var(--wird-primary)] dark:text-[var(--wird-accent)]"
                    style={{ fontFamily: option.fontFamily }}
                  >
                    {option.sample}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* Footer Actions */}
      <section className="pt-3 border-t border-[var(--wird-border)] flex flex-wrap items-center justify-between gap-2.5">
        <WirdButton
          variant="secondary"
          size="sm"
          onClick={onReset}
          data-reset-appearance
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>استعادة الإعدادات الافتراضية</span>
        </WirdButton>
        {onOpenShowcase && (
          <WirdButton variant="ghost" size="sm" onClick={onOpenShowcase}>
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>معرض نظام التصميم</span>
          </WirdButton>
        )}
      </section>
    </div>
  );
};
