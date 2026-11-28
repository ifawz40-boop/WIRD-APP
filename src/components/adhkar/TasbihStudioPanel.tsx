import React, { useState } from 'react';
import { Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { FREE_TASBIH_PRESETS } from '../../data/adhkarData';
import type {
  AdhkarProgressStore,
  CustomTasbihPhrase
} from '../../services/adhkarProgressService';
import { LargeTasbihRing } from './CircularCountdownRing';

interface TasbihStudioPanelProps {
  tasbih: AdhkarProgressStore['freeTasbih'];
  customPhrases: CustomTasbihPhrase[];
  onIncrement: () => void;
  onResetCurrent: () => void;
  onSelectPreset: (presetId: string) => void;
  onSelectTarget: (target: number) => void;
  onAddCustomPhrase: (input: {
    phrase: string;
    defaultTarget: number;
    virtue?: string;
  }) => { ok: true } | { ok: false; errorAr: string };
  onRemoveCustomPhrase: (phraseId: string) => void;
}

const TARGET_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 33, label: '33' },
  { value: 99, label: '99' },
  { value: 100, label: '100' },
  { value: 0, label: 'مفتوح' }
];

/**
 * Dedicated standalone Electronic Tasbih Studio tab — completely separated from daily Adhkar lists.
 * Supports built-in Prophetic presets as well as user-defined custom phrases synced across devices.
 */
export const TasbihStudioPanel: React.FC<TasbihStudioPanelProps> = ({
  tasbih,
  customPhrases,
  onIncrement,
  onResetCurrent,
  onSelectPreset,
  onSelectTarget,
  onAddCustomPhrase,
  onRemoveCustomPhrase
}) => {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [phraseDraft, setPhraseDraft] = useState('');
  const [virtueDraft, setVirtueDraft] = useState('');
  const [targetDraft, setTargetDraft] = useState<number>(33);
  const [formError, setFormError] = useState<string | null>(null);

  const activeCustom = customPhrases.find(p => p.id === tasbih.presetId);
  const activeBuiltIn = FREE_TASBIH_PRESETS.find(p => p.id === tasbih.presetId);
  const activePreset = activeCustom
    ? {
        id: activeCustom.id,
        phrase: activeCustom.phrase,
        virtue: activeCustom.virtue || 'ذكر مخصص أضفته إلى مسبحتك',
        defaultTarget: activeCustom.defaultTarget
      }
    : activeBuiltIn || FREE_TASBIH_PRESETS[0];

  const completedCycles =
    tasbih.targetCount > 0 ? Math.floor(tasbih.currentCount / tasbih.targetCount) : 0;

  const handleSubmitCustomPhrase = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const result = onAddCustomPhrase({
      phrase: phraseDraft,
      defaultTarget: targetDraft,
      virtue: virtueDraft || undefined
    });
    if (result.ok === false) {
      setFormError(result.errorAr);
      return;
    }
    setPhraseDraft('');
    setVirtueDraft('');
    setTargetDraft(33);
    setIsAddOpen(false);
  };

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
              مساحة هادئة للذكر المفتوح؛ يُحفظ عدّادك وأذكارك المخصصة وتُزامن تلقائياً عبر أجهزتك.
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

      {/* Custom User Tasbih Phrases Section + Inline Add Form */}
      <div className="wird-card p-5 md:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h4 className="text-sm font-bold text-[var(--wird-text)]">
              أذكارك المخصصة في المسبحة
            </h4>
            <p className="text-xs text-[var(--wird-muted)]">
              أضف أي صيغة ذكر ترغب في المداومة عليها، وستُحفظ وتُزامن تلقائياً مع حسابك.
            </p>
          </div>

          <button
            type="button"
            aria-expanded={isAddOpen}
            onClick={() => {
              setFormError(null);
              setIsAddOpen(prev => !prev);
            }}
            className="min-h-11 px-4 rounded-xl bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] hover:opacity-95 text-xs font-bold inline-flex items-center gap-1.5 transition-opacity whitespace-nowrap"
          >
            {isAddOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{isAddOpen ? 'إغلاق النموذج' : 'إضافة ذكر للمسبحة'}</span>
          </button>
        </div>

        {isAddOpen && (
          <form
            onSubmit={handleSubmitCustomPhrase}
            className="p-4 rounded-2xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] space-y-4"
          >
            <div className="space-y-1.5">
              <label
                htmlFor="wird-custom-tasbih-phrase"
                className="block text-xs font-bold text-[var(--wird-text)]"
              >
                صيغة الذكر
              </label>
              <input
                id="wird-custom-tasbih-phrase"
                type="text"
                required
                maxLength={240}
                value={phraseDraft}
                onChange={e => setPhraseDraft(e.target.value)}
                placeholder="مثال: اللهم إنك عفو تحب العفو فاعف عني"
                className="w-full min-h-11 px-3.5 rounded-xl bg-[var(--wird-surface)] border border-[var(--wird-border-strong)] text-sm text-[var(--wird-text)] focus:outline-none focus:ring-2 focus:ring-[var(--wird-accent)]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="wird-custom-tasbih-target"
                  className="block text-xs font-bold text-[var(--wird-text)]"
                >
                  العدد المستهدف للدورة (0 = مفتوح)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="wird-custom-tasbih-target"
                    type="number"
                    min={0}
                    max={10000}
                    value={targetDraft}
                    onChange={e => {
                      const num = Number(e.target.value);
                      setTargetDraft(Number.isFinite(num) && num >= 0 ? Math.min(10000, Math.floor(num)) : 0);
                    }}
                    className="w-28 min-h-11 px-3 rounded-xl bg-[var(--wird-surface)] border border-[var(--wird-border-strong)] text-sm font-mono tabular-nums text-[var(--wird-text)] focus:outline-none focus:ring-2 focus:ring-[var(--wird-accent)]"
                  />
                  <div className="flex flex-wrap items-center gap-1">
                    {TARGET_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setTargetDraft(opt.value)}
                        className={`min-h-9 px-2.5 rounded-lg text-xs font-bold tabular-nums border transition-colors ${
                          targetDraft === opt.value
                            ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] border-[var(--wird-primary)]'
                            : 'bg-[var(--wird-surface)] text-[var(--wird-text)] border-[var(--wird-border)] hover:border-[var(--wird-border-gold)]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="wird-custom-tasbih-virtue"
                  className="block text-xs font-bold text-[var(--wird-text)]"
                >
                  فضل أو ملاحظة مختصرة (اختياري)
                </label>
                <input
                  id="wird-custom-tasbih-virtue"
                  type="text"
                  maxLength={180}
                  value={virtueDraft}
                  onChange={e => setVirtueDraft(e.target.value)}
                  placeholder="مثال: ورد يومي بعد الفجر"
                  className="w-full min-h-11 px-3.5 rounded-xl bg-[var(--wird-surface)] border border-[var(--wird-border-strong)] text-xs text-[var(--wird-text)] focus:outline-none focus:ring-2 focus:ring-[var(--wird-accent)]"
                />
              </div>
            </div>

            {formError && (
              <p role="alert" className="text-xs font-semibold text-rose-700 dark:text-rose-300">
                {formError}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsAddOpen(false);
                  setFormError(null);
                }}
                className="min-h-10 px-4 rounded-xl bg-[var(--wird-surface)] border border-[var(--wird-border)] text-xs font-bold text-[var(--wird-muted)] hover:text-[var(--wird-text)] transition-colors"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="min-h-10 px-5 rounded-xl bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] text-xs font-bold inline-flex items-center gap-1.5 hover:opacity-95 transition-opacity"
              >
                <Plus className="w-4 h-4" />
                <span>حفظ وإضافة للمسبحة</span>
              </button>
            </div>
          </form>
        )}

        {customPhrases.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {customPhrases.map(item => {
              const isSelected = item.id === activePreset.id;
              return (
                <div
                  key={item.id}
                  className={`rounded-2xl border transition-all flex items-stretch overflow-hidden ${
                    isSelected
                      ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] border-[var(--wird-border-gold)] shadow-xs'
                      : 'bg-[var(--wird-surface)] text-[var(--wird-text)] border-[var(--wird-border)] hover:border-[var(--wird-border-gold)]'
                  }`}
                >
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onSelectPreset(item.id)}
                    className="flex-1 text-right p-4 flex flex-col justify-between gap-2 min-h-[84px] min-w-0"
                  >
                    <span className="font-quran text-base font-bold leading-relaxed break-words">
                      {item.phrase}
                    </span>
                    <span
                      className={`text-xs ${
                        isSelected ? 'text-white/80' : 'text-[var(--wird-muted)]'
                      }`}
                    >
                      {item.virtue ? `${item.virtue} · ` : 'ذكر مخصص · '}
                      الهدف: {item.defaultTarget === 0 ? 'مفتوح' : item.defaultTarget}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`حذف الذكر المخصص ${item.phrase}`}
                    title="حذف هذا الذكر المخصص"
                    onClick={() => onRemoveCustomPhrase(item.id)}
                    className={`px-3.5 min-w-11 flex items-center justify-center border-r transition-colors ${
                      isSelected
                        ? 'border-white/15 text-white/80 hover:text-white hover:bg-white/10'
                        : 'border-[var(--wird-border)] text-[var(--wird-muted)] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-[var(--wird-surface-muted)]'
                    }`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          !isAddOpen && (
            <p className="text-xs text-[var(--wird-muted)] bg-[var(--wird-surface-muted)] rounded-xl px-4 py-3 border border-[var(--wird-border)]">
              لم تضف أذكاراً مخصصة بعد. اضغط على «إضافة ذكر للمسبحة» لإدراج صيغك الخاصة ومزامنتها بين أجهزتك.
            </p>
          )
        )}
      </div>

      {/* Formula Presets Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-[var(--wird-text)]">
            الصيغ المأثورة
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
