import React from 'react';
import { Check } from 'lucide-react';

interface RuqyahCountdownRingProps {
  title: string;
  currentCount: number;
  repeatTarget: number | null;
  disabled: boolean;
  onTap: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

/**
 * Prominent SVG circular counter ring tailored to Ruqyah's evidence-based rules:
 * - Narrated fixed target (`repeatTarget !== null`): counts down (`target -> ... -> 1 -> مكتمل`).
 * - Open count (`repeatTarget === null`): counts upward (`0 قراءة`, `1 قراءة`, ...) with soft ring fill once read.
 * Preserves accessible `role="status"` announcements and exact screen-reader labels.
 */
export const RuqyahCountdownRing: React.FC<RuqyahCountdownRingProps> = ({
  title,
  currentCount,
  repeatTarget,
  disabled,
  onTap
}) => {
  const size = 80;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const isFixed = repeatTarget !== null;
  const remaining = isFixed ? Math.max(0, repeatTarget - currentCount) : 0;
  const isCompleted = isFixed ? remaining === 0 : currentCount > 0;
  const progressRatio = isFixed
    ? repeatTarget > 0
      ? Math.min(1, currentCount / repeatTarget)
      : 1
    : currentCount > 0
    ? 1
    : 0;
  const strokeDashoffset = circumference * (1 - progressRatio);

  const buttonAriaLabel = isFixed
    ? `تسجيل قراءة ${title}`
    : `تسجيل قراءة جديدة لـ ${title}. العدد الحالي ${currentCount}`;

  const statusAriaLabel = isFixed
    ? `المتبقي: ${remaining} من ${repeatTarget}`
    : `عدد القراءات: ${currentCount}`;

  return (
    <div className="flex flex-col items-center gap-1.5 shrink-0">
      <button
        type="button"
        onClick={onTap}
        disabled={disabled}
        aria-label={buttonAriaLabel}
        className={`group relative inline-flex items-center justify-center w-[80px] h-[80px] rounded-full shrink-0 transition-transform duration-150 active:scale-95 disabled:opacity-55 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--wird-surface)] ${
          isCompleted
            ? 'bg-emerald-600/12 dark:bg-emerald-400/15'
            : 'bg-[var(--wird-surface-muted)] hover:bg-[var(--wird-accent-soft)]'
        }`}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          aria-hidden="true"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--wird-border-strong)"
            strokeOpacity={0.35}
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={`transition-[stroke-dashoffset] duration-150 ease-out ${
              isCompleted
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-[var(--wird-primary)] dark:text-[var(--wird-accent)]'
            }`}
          />
        </svg>

        <span className="absolute inset-0 flex flex-col items-center justify-center leading-none select-none">
          {isFixed ? (
            isCompleted ? (
              <>
                <Check className="w-6 h-6 text-emerald-700 dark:text-emerald-300 stroke-[2.6]" />
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                  مكتمل
                </span>
              </>
            ) : (
              <>
                <span className="font-mono text-xl font-extrabold tabular-nums text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
                  {remaining}
                </span>
                <span className="text-[10px] font-semibold text-[var(--wird-muted)] mt-0.5">
                  {repeatTarget === 1 ? 'مرة' : 'متبقٍ'}
                </span>
              </>
            )
          ) : (
            <>
              <span
                className={`font-mono text-xl font-extrabold tabular-nums ${
                  currentCount > 0
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-[var(--wird-primary)] dark:text-[var(--wird-accent)]'
                }`}
              >
                {currentCount}
              </span>
              <span className="text-[10px] font-semibold text-[var(--wird-muted)] mt-0.5">
                {currentCount > 0 ? 'مقروء' : 'اضغط'}
              </span>
            </>
          )}
        </span>
      </button>

      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-label={statusAriaLabel}
        className="text-[11px] font-bold tabular-nums text-[var(--wird-muted)] text-center"
      >
        {isFixed ? (
          <span>
            <span className="font-mono">{remaining} / {repeatTarget}</span>
          </span>
        ) : (
          <span>
            <span className="font-mono">{currentCount}</span> قراءة
          </span>
        )}
      </div>
    </div>
  );
};
