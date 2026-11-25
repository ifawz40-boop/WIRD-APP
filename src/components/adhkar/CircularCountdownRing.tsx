import React from 'react';
import { Check } from 'lucide-react';

interface CircularCountdownRingProps {
  remaining: number;
  target: number;
  isCompleted: boolean;
  onTap: (e: React.MouseEvent<HTMLButtonElement>) => void;
  ariaLabel: string;
}

/**
 * Prominent SVG circular countdown ring inspired by specialized Adhkar apps (IslamBook).
 * Displays remaining repetitions counting down (`target -> ... -> 1 -> 0`) with smooth stroke progress.
 */
export const CircularCountdownRing: React.FC<CircularCountdownRingProps> = ({
  remaining,
  target,
  isCompleted,
  onTap,
  ariaLabel
}) => {
  const size = 76;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const completedCount = Math.max(0, target - remaining);
  const progressRatio = target > 0 ? Math.min(1, completedCount / target) : 1;
  const strokeDashoffset = circumference * (1 - progressRatio);

  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={ariaLabel}
      className={`group relative inline-flex items-center justify-center w-[76px] h-[76px] rounded-full shrink-0 transition-transform duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--wird-surface)] ${
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
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--wird-border-strong)"
          strokeOpacity={0.35}
          strokeWidth={strokeWidth}
        />
        {/* Active Progress Arc */}
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

      {/* Center Value */}
      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none select-none">
        {isCompleted ? (
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
              {target === 1 ? 'مرة' : 'متبقٍ'}
            </span>
          </>
        )}
      </span>
    </button>
  );
};

interface LargeTasbihRingProps {
  currentCount: number;
  targetCount: number; // 0 = open / unlimited
  onTap: () => void;
}

/**
 * Large central tactile ring for the dedicated Electronic Tasbih Studio.
 */
export const LargeTasbihRing: React.FC<LargeTasbihRingProps> = ({
  currentCount,
  targetCount,
  onTap
}) => {
  const size = 216;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const isUnlimited = targetCount === 0;
  const cycleCount = isUnlimited ? currentCount : currentCount % targetCount;
  const isCycleBoundary = !isUnlimited && currentCount > 0 && cycleCount === 0;
  const ratio = isUnlimited
    ? ((currentCount % 33) / 33)
    : isCycleBoundary
    ? 1
    : cycleCount / targetCount;
  const strokeDashoffset = circumference * (1 - Math.min(1, ratio));
  const completedCycles = !isUnlimited && targetCount > 0 ? Math.floor(currentCount / targetCount) : 0;

  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={`تسبيحة جديدة — العدد الحالي ${currentCount}${!isUnlimited ? ` من هدف ${targetCount}` : ' (وضع مفتوح)'}`}
      className="group relative inline-flex items-center justify-center w-[216px] h-[216px] rounded-full bg-[var(--wird-surface)] border border-[var(--wird-border-gold)] shadow-sm transition-transform duration-150 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--wird-bg)]"
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
          strokeOpacity={0.3}
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
            isCycleBoundary
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-[var(--wird-primary)] dark:text-[var(--wird-accent)]'
          }`}
        />
      </svg>

      <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 select-none">
        <span className="text-xs font-semibold text-[var(--wird-muted)]">
          اضغط للتسبيح
        </span>
        <span className="font-mono text-5xl font-extrabold tabular-nums text-[var(--wird-text)] tracking-tight">
          {currentCount}
        </span>
        <span className="text-xs font-bold tabular-nums text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
          {isUnlimited
            ? 'تسبيح مفتوح'
            : `الهدف ${targetCount}${completedCycles > 0 ? ` · ${completedCycles} دورة` : ''}`}
        </span>
      </span>
    </button>
  );
};
