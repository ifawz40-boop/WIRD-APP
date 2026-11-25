import React from 'react';
import { RotateCcw } from 'lucide-react';
import { FREE_TASBIH_PRESETS } from '../../data/adhkarData';
import type { AdhkarProgressStore } from '../../services/adhkarProgressService';
import { LargeTasbihRing } from './CircularCountdownRing';

interface TasbihStudioPanelProps {
  tasbih: AdhkarProgressStore['freeTasbih'];
  onIncrement: () => void;
  onResetCurrent: () => void;
  onSelectPreset: (presetId: string) => void;
  onSelectTarget: (target: number) => void;
}

const TARGET_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 33, label: '33' },
  { value: 99, label: '99' },
  { value: 100, label: '100' },
  { value: 0, label: 'مفتوح' }
];

/**
 * Dedicated standalone Electronic Tasbih Studio tab — completely separated from daily Adhkar lists.
 */
export const TasbihStudioPanel: React.FC<TasbihStudioPanelProps> = ({
  tasbih,
  onIncrement,
  onResetCurrent,
  onSelectPreset,
  onSelectTarget
}) => {
  const activePreset =
    FREE_TASBIH_PRESETS.find(p => p.id === tasbih.presetId) || FREE_TASBIH_PRESETS[0];

  const completedCycles =
    tasbih.targetCount > 0 ? Math.floor(tasbih.currentCount / tasbih.targetCount) : 0;

  return (
    <section
      aria-labelledby="tasbih-studio-heading"
      className="space-y-6"
    >
      {/* Top Studio Header & Stats (Zero-Pill clean metadata) */}
      <div className="wird-card p-6 md:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[var(--wird-border)]">
          <div className="space-y-1">
            <h3
              id="tasbih-studio-heading"
              className="text-xl font-bold font-quran text-[var(--wird-text)]"
            >
              المسبحة الإلكترونية المستقلة
            </h3>
            <p className="text-xs sm:text-sm text-[var(--wird-muted)]">
              مساحة هادئة للذكر المفتوح؛ يُحفظ عدّادك التراكمي تلقائياً في حسابك.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs sm:text-sm text-[var(--wird-muted)] tabular-nums">
            <div>
              <span>الإجمالي التراكمي: </span>
              <strong className="font-mono font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
                {tasbih.totalLifetimeCount.toLocaleString('en-US')}
              </strong>
            </div>
            {tasbih.targetCount > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <div>
                  <span>الدورات: </span>
                  <strong className="font-mono font-bold text-[var(--wird-text)]">
                    {completedCycles}
                  </strong>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Centerpiece Formula + Large Circular Ring */}
        <div className="flex flex-col items-center text-center py-4 space-y-6">
          <div className="max-w-2xl space-y-2">
            <p className="font-quran text-2xl sm:text-3xl font-bold leading-relaxed text-[var(--wird-text)]">
              {activePreset.phrase}
            </p>
            <p className="text-xs sm:text-sm text-[var(--wird-muted)]">
              {activePreset.virtue}
            </p>
          </div>

          <LargeTasbihRing
            currentCount={tasbih.currentCount}
            targetCount={tasbih.targetCount}
            onTap={onIncrement}
          />

          {/* Cycle Target Selector & Reset */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <div
              role="group"
              aria-label="تحديد هدف دورة التسبيح"
              className="inline-flex items-center gap-1 p-1 rounded-xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)]"
            >
              <span className="px-2.5 text-xs font-semibold text-[var(--wird-muted)] whitespace-nowrap">
                هدف الدورة:
              </span>
              {TARGET_OPTIONS.map(opt => {
                const isSelected = tasbih.targetCount === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onSelectTarget(opt.value)}
                    className={`min-h-10 px-3.5 rounded-lg text-xs font-bold tabular-nums whitespace-nowrap transition-colors ${
                      isSelected
                        ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] shadow-xs'
                        : 'text-[var(--wird-text)] hover:bg-[var(--wird-surface)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={onResetCurrent}
              disabled={tasbih.currentCount === 0}
              className="min-h-11 px-4 rounded-xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] text-xs font-bold text-[var(--wird-text)] hover:border-[var(--wird-border-gold)] disabled:opacity-45 flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4" />
              <span>تصفير الدورة</span>
            </button>
          </div>
        </div>
      </div>

      {/* Formula Presets Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-[var(--wird-text)]">
            اختر صيغة الذكر
          </h4>
          <span className="text-xs text-[var(--wird-muted)] tabular-nums">
            {FREE_TASBIH_PRESETS.length} صيغ مأثورة
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {FREE_TASBIH_PRESETS.map(preset => {
            const isSelected = preset.id === activePreset.id;
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelectPreset(preset.id)}
                className={`text-right p-4 rounded-2xl border transition-all flex flex-col justify-between gap-2 min-h-[84px] ${
                  isSelected
                    ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] border-[var(--wird-border-gold)] shadow-xs'
                    : 'bg-[var(--wird-surface)] text-[var(--wird-text)] border-[var(--wird-border)] hover:border-[var(--wird-border-gold)]'
                }`}
              >
                <span className="font-quran text-base font-bold leading-relaxed">
                  {preset.phrase}
                </span>
                <span
                  className={`text-xs ${
                    isSelected ? 'text-white/80' : 'text-[var(--wird-muted)]'
                  }`}
                >
                  {preset.virtue} · الهدف المقترح: {preset.defaultTarget}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
