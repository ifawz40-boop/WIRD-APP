import React, { useEffect, useRef, useState } from 'react';
import {
  Sparkles,
  Trash2,
  Play,
  Layers,
  Compass
} from 'lucide-react';
import { MemorizationPlan } from '../../types/quran';
import { EngineGeneratedPlan } from '../../services/planningEngine';
import { PlanningEngineWizard } from './PlanningEngineWizard';
import { RetentionService } from '../../services/retentionService';
import { getNextPresetMemorizationRange, isPresetAutoStartSupported } from '../../services/dailySessionSelection';

interface MemorizationPlansViewProps {
  plans: MemorizationPlan[];
  onUpdatePlans: (plans: MemorizationPlan[]) => boolean | Promise<boolean>;
  enginePlans: EngineGeneratedPlan[];
  onUpdateEnginePlans: (plans: EngineGeneratedPlan[]) => boolean | Promise<boolean>;
  onStartSession: (surahNumber?: number, startAyah?: number, endAyah?: number, mode?: 'memorize' | 'review') => void;
  onOpenAdvisor?: () => void;
  onToast?: (message: string, type?: 'success' | 'warn' | 'error' | 'info') => void;
}

export const MemorizationPlansView: React.FC<MemorizationPlansViewProps> = ({
  plans,
  onUpdatePlans,
  enginePlans,
  onUpdateEnginePlans,
  onStartSession,
  onOpenAdvisor,
  onToast
}) => {
  const [activeTab, setActiveTab] = useState<'engine' | 'presets'>('engine');
  const [planToDelete, setPlanToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const isDeletingRef = useRef(false);
  const deleteDialogRef = useRef<HTMLDivElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!planToDelete) return;
    const trigger = deleteTriggerRef.current;
    cancelDeleteRef.current?.focus();

    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!isDeletingRef.current) setPlanToDelete(null);
        return;
      }
      if (event.key !== 'Tab') return;

      const dialog = deleteDialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ));
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleDialogKeyDown);
    return () => {
      document.removeEventListener('keydown', handleDialogKeyDown);
      (deleteTriggerRef.current ?? trigger)?.focus();
    };
  }, [planToDelete]);

  const handleToggleActive = async (planId: string) => {
    const updated = plans.map(p => ({
      ...p,
      isActive: p.id === planId
    }));
    if (!await onUpdatePlans(updated)) return;
    onToast?.('تم تفعيل الخطة المحددة بنجاح', 'success');
  };

  const handleConfirmDelete = async () => {
    if (!planToDelete || isDeletingRef.current) return;
    isDeletingRef.current = true;
    setIsDeleting(true);
    try {
      const updated = plans.filter(p => p.id !== planToDelete);
      if (updated.length > 0 && !updated.some(p => p.isActive)) {
        updated[0].isActive = true;
      }
      if (!await onUpdatePlans(updated)) return;
      setPlanToDelete(null);
      onToast?.('تم حذف الخطة من قائمتك بنجاح', 'info');
    } catch {
      onToast?.('تعذر حذف الخطة. لم يتم تأكيد حفظ التغيير.', 'error');
    } finally {
      isDeletingRef.current = false;
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Segmented Control */}
      <div role="group" aria-label="طرق إدارة خطط الحفظ" className="wird-card p-2.5 flex flex-wrap items-center justify-between gap-3 text-xs font-bold">
        <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => setActiveTab('engine')}
            aria-pressed={activeTab === 'engine'}
            className={`flex w-full min-h-11 items-center justify-center gap-2 px-4 py-2 rounded-[var(--wird-radius-control)] text-center whitespace-nowrap transition-all sm:w-auto ${
              activeTab === 'engine'
                ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] border border-[var(--wird-accent)] shadow-xs'
                : 'text-[var(--wird-muted)] hover:bg-[var(--wird-surface-muted)] hover:text-[var(--wird-text)]'
            }`}
          >
            <Sparkles className={`w-4 h-4 ${activeTab === 'engine' ? 'text-[var(--wird-accent)]' : 'text-[var(--wird-accent)]'}`} />
            <span>الخطط الذكية المخصصة</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('presets')}
            aria-pressed={activeTab === 'presets'}
            className={`flex w-full min-h-11 items-center justify-center gap-2 px-4 py-2 rounded-[var(--wird-radius-control)] text-center whitespace-nowrap transition-all sm:w-auto ${
              activeTab === 'presets'
                ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] border border-[var(--wird-accent)] shadow-xs'
                : 'text-[var(--wird-muted)] hover:bg-[var(--wird-surface-muted)] hover:text-[var(--wird-text)]'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>النماذج المنهجية ({plans.length})</span>
          </button>
        </div>

        {onOpenAdvisor && (
          <button
            type="button"
            onClick={onOpenAdvisor}
            className="min-h-11 px-3.5 py-2 rounded-[var(--wird-radius-control)] border border-[var(--wird-border-gold)] bg-[var(--wird-surface-muted)] text-[var(--wird-text)] hover:border-[var(--wird-accent)] flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors w-full sm:w-auto"
          >
            <Compass className="w-4 h-4 text-[var(--wird-accent)]" />
            <span>استشارة المستشار القرآني</span>
          </button>
        )}
      </div>

      {/* TAB 1: Real Functional Planning Engine */}
      {activeTab === 'engine' && (
        <PlanningEngineWizard
          enginePlans={enginePlans}
          onUpdateEnginePlans={onUpdateEnginePlans}
          onStartSession={onStartSession}
          onOpenAdvisor={onOpenAdvisor}
          onToast={onToast}
        />
      )}

      {/* TAB 2: Preset Plans */}
      {activeTab === 'presets' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold text-[var(--wird-text)]">
              النماذج المنهجية الجاهزة ({plans.length})
            </h3>
            <span className="text-xs text-[var(--wird-muted)]">
              خطط دور التحفيظ المعتمدة
            </span>
          </div>

          {plans.length === 0 ? (
            <div role="status" className="wird-card border-dashed px-6 py-10 text-center">
              <Layers className="mx-auto h-10 w-10 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
              <h4 className="mt-3 text-sm font-bold text-[var(--wird-text)]">لم تحفظ أي خطة بعد</h4>
              <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-[var(--wird-muted)]">
                يمكنك إنشاء خطة تناسب وقتك ومقدار الحفظ اليومي من الخطط الذكية، وستظهر هنا لمتابعة تقدمك.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('engine')}
                className="wird-btn-primary mt-4 min-h-11 px-5 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-ring)]"
              >
                إنشاء خطة حفظ
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {plans.map((plan) => {
              const percent = plan.totalUnits > 0
                ? Math.min(100, Math.max(0, Math.round((plan.completedUnits / plan.totalUnits) * 100)))
                : 0;
              const nextRange = getNextPresetMemorizationRange(plan, RetentionService.getPortions(), plan.dailyTarget);
              const quickStartSupported = isPresetAutoStartSupported(plan);

              return (
                <div
                  key={plan.id}
                  className={`wird-card p-6 transition-all flex flex-col justify-between ${
                    plan.isActive
                      ? 'border-[var(--wird-accent)] ring-1 ring-[var(--wird-ring)]'
                      : ''
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-base text-[var(--wird-text)]">
                            {plan.title}
                          </h4>
                          {plan.isActive && (
                            <span className="text-[11px] font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
                              · الخطة النشطة
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--wird-muted)] mt-1 leading-relaxed">
                          {plan.description}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={(event) => { deleteTriggerRef.current = event.currentTarget; setPlanToDelete(plan.id); }}
                        aria-label={`حذف الخطة ${plan.title}`}
                        className="min-h-11 min-w-11 flex items-center justify-center text-[var(--wird-muted)] hover:text-rose-600 dark:hover:text-rose-400 p-1 transition-colors"
                        title="حذف الخطة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Progress Info */}
                    <div className="space-y-2 mt-4 pt-3 border-t border-[var(--wird-border)]">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[var(--wird-muted)]">نسبة الإنجاز:</span>
                        <span className="font-bold text-[var(--wird-text)] font-mono tabular-nums">
                          {plan.completedUnits} / {plan.totalUnits} {plan.unitType === 'page' ? 'صفحة' : 'آية'} ({percent}%)
                        </span>
                      </div>

                      <div role="progressbar" aria-label={`نسبة إنجاز خطة ${plan.title}`} aria-valuemin={0} aria-valuemax={Math.max(1, plan.totalUnits)} aria-valuenow={Math.min(Math.max(0, plan.completedUnits), Math.max(1, plan.totalUnits))} aria-valuetext={`${percent}%`} className="w-full bg-[var(--wird-surface-muted)] h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-[var(--wird-primary)] dark:bg-[var(--wird-accent)] h-full rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    {/* Plan Specs (hairline unboxed metadata grid) */}
                    <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-[var(--wird-border)] text-[11px] text-[var(--wird-muted)]">
                      <div>
                        المستهدف اليومي: <strong className="text-[var(--wird-text)] tabular-nums">{plan.dailyTarget} {plan.unitType === 'page' ? 'صفحة' : 'آيات'}</strong>
                      </div>
                      <div>
                        أيام الحفظ / المراجعة: <strong className="text-[var(--wird-text)] tabular-nums">{plan.memorizationDaysPerWeek} / {plan.revisionDaysPerWeek}</strong>
                      </div>
                      <div>
                        تاريخ البدء: <span className="font-mono tabular-nums">{plan.startDate}</span>
                      </div>
                      <div>
                        الختم المتوقع: <span className="font-mono tabular-nums text-[var(--wird-primary)] dark:text-[var(--wird-accent)] font-bold">{plan.targetEndDate}</span>
                      </div>
                    </div>
                  </div>

                  {/* Plan Card Actions */}
                  <div className="flex items-center justify-between gap-3 mt-5 pt-4 border-t border-[var(--wird-border)]">
                    {plan.isActive ? (
                      <button
                        type="button"
                        disabled={!nextRange}
                        onClick={() => {
                          if (nextRange) onStartSession(nextRange.surahNumber, nextRange.startAyah, nextRange.endAyah, 'memorize');
                        }}
                        title={!quickStartSupported
                          ? 'البدء السريع غير متاح لخطط الصفحات والأجزاء حتى يتوفر تحديد آيات دقيق.'
                          : !nextRange ? 'اكتملت نطاقات الحفظ المحددة في هذه الخطة.' : 'ابدأ من أول آية غير مسجلة في نطاق الخطة'}
                        className="wird-btn-primary flex-1 flex min-h-11 items-center justify-center gap-2 py-2 px-4 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>{nextRange ? 'متابعة جلسة اليوم' : quickStartSupported ? 'اكتملت نطاقات الخطة' : 'البدء السريع غير متاح'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleToggleActive(plan.id)}
                        className="flex-1 min-h-11 py-2 px-4 bg-[var(--wird-surface-muted)] hover:bg-[var(--wird-primary)] text-[var(--wird-text)] hover:text-[var(--wird-primary-ink)] border border-[var(--wird-border)] rounded-[var(--wird-radius-control)] text-xs font-semibold transition-colors"
                      >
                        تفعيل هذه الخطة كورد رئيسي
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            </div>
          )}
        </div>
      )}

      {/* In-app Plan Delete Confirmation Modal */}
      {planToDelete && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4">
          <div ref={deleteDialogRef} role="dialog" aria-modal="true" aria-labelledby="wird-plan-delete-title" className="bg-[var(--wird-surface)] rounded-[var(--wird-radius-card)] p-6 max-w-md w-full border border-[var(--wird-border-gold)] shadow-2xl space-y-4 text-right">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 id="wird-plan-delete-title" className="font-bold text-[var(--wird-text)] text-base">
                  تأكيد حذف الخطة
                </h3>
                <p className="text-xs text-[var(--wird-muted)]">
                  هل تريد إزالة هذه الخطة من قائمتك؟
                </p>
              </div>
            </div>

            <p className="text-xs text-[var(--wird-text)] leading-relaxed bg-[var(--wird-surface-muted)] p-3.5 rounded-xl border border-[var(--wird-border)]">
              سيتم حذف بطاقة الخطة المحددة. لن يؤثر ذلك على سجلات الأوراد التي أنجزتها سابقاً.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                ref={cancelDeleteRef}
                onClick={() => setPlanToDelete(null)}
                disabled={isDeleting}
                className="min-h-11 disabled:opacity-50 px-4 py-2 text-xs font-semibold text-[var(--wird-muted)] hover:bg-[var(--wird-surface-muted)] rounded-[var(--wird-radius-control)] transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="min-h-11 disabled:opacity-50 px-5 py-2 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-[var(--wird-radius-control)] shadow-xs transition-colors"
              >
                {isDeleting ? 'جارٍ الحذف...' : 'تأكيد الحذف'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

