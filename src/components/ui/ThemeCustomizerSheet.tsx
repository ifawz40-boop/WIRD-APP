import React from 'react';
import {
  Check,
  Moon,
  Palette,
  RotateCcw,
  SlidersHorizontal,
  Sun,
} from 'lucide-react';
import {
  WIRD_THEME_PRESETS,
  type WirdCornerStyle,
  type WirdLayoutDensity,
  type WirdThemePreferences,
  type WirdThemePresetId,
} from '../../services/themePreferences';
import { WirdButton, WirdMetadataRow, WirdSheet } from './WirdPrimitives';

interface ThemeCustomizerSheetProps {
  open: boolean;
  onClose: () => void;
  mode: 'light' | 'dark';
  onSetMode: (mode: 'light' | 'dark') => void;
  preferences: WirdThemePreferences;
  onUpdatePreferences: (
    partial: Partial<Omit<WirdThemePreferences, 'schemaVersion'>>
  ) => void;
  onReset: () => void;
  onOpenShowcase?: () => void;
}

export const ThemeCustomizerSheet: React.FC<ThemeCustomizerSheetProps> = ({
  open,
  onClose,
  mode,
  onSetMode,
  preferences,
  onUpdatePreferences,
  onReset,
  onOpenShowcase,
}) => {
  return (
    <WirdSheet
      open={open}
      onClose={onClose}
      title="تخصيص المظهر ومساحة القراءة"
      description="اختر اللوحة البصرية والوضع النهاري أو الليلي وكثافة العرض فوراً على جهازك."
    >
      {/* 1. Light / Dark Mode */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-[var(--wird-text)]">
            وضع الإضاءة
          </h3>
          <WirdMetadataRow items={[mode === 'dark' ? 'ليلي' : 'نهاري']} />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => onSetMode('light')}
            aria-pressed={mode === 'light'}
            className={`min-h-12 px-3.5 py-2.5 rounded-[var(--wird-radius-control)] border text-xs font-bold flex items-center justify-center gap-2 transition-colors wird-focus-ring ${
              mode === 'light'
                ? 'border-[var(--wird-primary)] bg-[var(--wird-primary)] text-white'
                : 'border-[var(--wird-border)] bg-[var(--wird-surface-muted)] text-[var(--wird-text)] hover:border-[var(--wird-border-strong)]'
            }`}
          >
            <Sun className="w-4 h-4" />
            <span>الوضع النهاري</span>
          </button>
          <button
            type="button"
            onClick={() => onSetMode('dark')}
            aria-pressed={mode === 'dark'}
            className={`min-h-12 px-3.5 py-2.5 rounded-[var(--wird-radius-control)] border text-xs font-bold flex items-center justify-center gap-2 transition-colors wird-focus-ring ${
              mode === 'dark'
                ? 'border-[var(--wird-accent)] bg-[var(--wird-primary)] text-white'
                : 'border-[var(--wird-border)] bg-[var(--wird-surface-muted)] text-[var(--wird-text)] hover:border-[var(--wird-border-strong)]'
            }`}
          >
            <Moon className="w-4 h-4" />
            <span>الوضع الليلي</span>
          </button>
        </div>
      </section>

      {/* 2. Curated Multi-Theme Presets */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-[var(--wird-text)]">
            اللوحات البصرية المعتمدة
          </h3>
          <WirdMetadataRow items={['3 خطط متكاملة']} />
        </div>

        <div className="space-y-2.5">
          {WIRD_THEME_PRESETS.map((preset) => {
            const isSelected = preferences.preset === preset.id;
            const activePalette = mode === 'dark' ? preset.night : preset.day;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() =>
                  onUpdatePreferences({ preset: preset.id as WirdThemePresetId })
                }
                aria-pressed={isSelected}
                className={`w-full text-right p-3.5 rounded-[var(--wird-radius-card)] border transition-colors wird-focus-ring space-y-2.5 ${
                  isSelected
                    ? 'border-[var(--wird-accent)] bg-[var(--wird-surface-muted)]'
                    : 'border-[var(--wird-border)] bg-[var(--wird-surface)] hover:border-[var(--wird-border-strong)]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[var(--wird-text)]">
                        {preset.nameAr}
                      </span>
                      {preset.id === 'emerald-editorial' && (
                        <span className="text-[11px] font-semibold text-[var(--wird-accent)]">
                          · افتراضي
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--wird-muted)] leading-relaxed">
                      {preset.taglineAr}
                    </p>
                  </div>
                  {isSelected && (
                    <span className="w-6 h-6 rounded-full bg-[var(--wird-primary)] text-white flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>

                {/* Palette Preview Bar */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <div
                    className="flex items-center gap-1.5"
                    aria-hidden="true"
                  >
                    {[
                      activePalette.bg,
                      activePalette.surface,
                      activePalette.primary,
                      activePalette.accent,
                    ].map((hex, i) => (
                      <span
                        key={`${preset.id}-${i}`}
                        className="w-6 h-6 rounded-md border border-black/15 dark:border-white/15"
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] text-[var(--wird-muted)] truncate">
                    {preset.inspirationAr}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. Workspace Density */}
      <section className="space-y-2.5">
        <h3 className="text-xs font-bold text-[var(--wird-text)]">
          كثافة المساحات
        </h3>
        <div className="grid grid-cols-2 gap-2.5">
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
                hint: 'عرض بيانات أكثر',
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
                className={`p-3 rounded-[var(--wird-radius-control)] border text-right transition-colors wird-focus-ring ${
                  active
                    ? 'border-[var(--wird-primary)] bg-[var(--wird-surface-muted)]'
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

      {/* 4. Corner Geometry */}
      <section className="space-y-2.5">
        <h3 className="text-xs font-bold text-[var(--wird-text)]">
          هندسة الحواف
        </h3>
        <div className="grid grid-cols-2 gap-2.5">
          {(
            [
              {
                id: 'refined',
                label: 'تحريري متزن',
                hint: 'حواف دقيقة ومتناسقة',
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
                className={`p-3 rounded-[var(--wird-radius-control)] border text-right transition-colors wird-focus-ring ${
                  active
                    ? 'border-[var(--wird-primary)] bg-[var(--wird-surface-muted)]'
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

      {/* Footer Actions */}
      <section className="pt-3 border-t border-[var(--wird-border)] flex flex-wrap items-center justify-between gap-2.5">
        <WirdButton variant="secondary" size="sm" onClick={onReset}>
          <RotateCcw className="w-3.5 h-3.5" />
          <span>استعادة الافتراضي</span>
        </WirdButton>
        {onOpenShowcase && (
          <WirdButton
            variant="ghost"
            size="sm"
            onClick={() => {
              onClose();
              onOpenShowcase();
            }}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>معرض نظام التصميم</span>
          </WirdButton>
        )}
      </section>
    </WirdSheet>
  );
};

export const ThemeCustomizerTriggerIcon = Palette;
