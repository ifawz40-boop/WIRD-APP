import React, { useId } from 'react';

export type WirdSymbolVariant = 'primary' | 'light' | 'dark' | 'gold' | 'monochrome' | 'simplified';

export interface WirdSymbolProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: number | string;
  variant?: WirdSymbolVariant;
  className?: string;
  withGlow?: boolean;
  renderMode?: 'vector' | 'raster';
}

export const OFFICIAL_BRAND_EMBLEM_URL = '/assets/aistudio/IMG_0140_900ee5d2.jpeg';

/**
 * Pure Scalable Vector Emblem SVG (الشعار الهندسي المتجهي الرسمي لتطبيق وِرد)
 * Features an 8-pointed Rub el Hizb (Khatam) geometric frame, Mihrab arch with
 * crescent finial, and an illuminated open Mushaf on a traditional Rihal stand.
 */
export const WirdVectorEmblemSvg: React.FC<{
  variant?: WirdSymbolVariant;
  className?: string;
}> = ({ variant = 'primary', className = 'w-full h-full' }) => {
  const uid = useId().replace(/:/g, '');
  const bgId = `wird-bg-${uid}`;
  const goldId = `wird-gold-${uid}`;
  const ivoryId = `wird-ivory-${uid}`;

  const palette = {
    primary: {
      bgStart: '#1C4E46',
      bgMid: '#0F293A',
      bgEnd: '#0B132B',
      goldStart: '#F6D78B',
      goldMid: '#E0A96D',
      goldEnd: '#C59B27',
      pageStart: '#FFFDF7',
      pageEnd: '#EAE1CE',
      ink: '#1C4E46',
    },
    light: {
      bgStart: '#28665B',
      bgMid: '#1C4E46',
      bgEnd: '#123731',
      goldStart: '#F8DF9D',
      goldMid: '#D4AF37',
      goldEnd: '#C59B27',
      pageStart: '#FFFFFF',
      pageEnd: '#F2EDE2',
      ink: '#1C4E46',
    },
    dark: {
      bgStart: '#162744',
      bgMid: '#111F36',
      bgEnd: '#0B132B',
      goldStart: '#F8DF9D',
      goldMid: '#E0A96D',
      goldEnd: '#C59B27',
      pageStart: '#F9F6EE',
      pageEnd: '#E5DEC9',
      ink: '#162744',
    },
    gold: {
      bgStart: '#C59B27',
      bgMid: '#9A7415',
      bgEnd: '#5D4409',
      goldStart: '#FFFDF7',
      goldMid: '#F9F6EE',
      goldEnd: '#E8DFC9',
      pageStart: '#FFFDF7',
      pageEnd: '#F2EDE2',
      ink: '#5D4409',
    },
    monochrome: {
      bgStart: '#2A3634',
      bgMid: '#1D2625',
      bgEnd: '#121817',
      goldStart: '#E2E8E7',
      goldMid: '#B8C4C2',
      goldEnd: '#8B9E9B',
      pageStart: '#F5F7F7',
      pageEnd: '#D6DFDD',
      ink: '#1D2625',
    },
    simplified: {
      bgStart: '#1C4E46',
      bgMid: '#143832',
      bgEnd: '#0B132B',
      goldStart: '#F3C878',
      goldMid: '#E0A96D',
      goldEnd: '#C59B27',
      pageStart: '#FFFDF7',
      pageEnd: '#EAE1CE',
      ink: '#1C4E46',
    },
  }[variant];

  const isSimplified = variant === 'simplified';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 120 120"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={bgId} cx="50%" cy="36%" r="68%">
          <stop offset="0%" stopColor={palette.bgStart} />
          <stop offset="58%" stopColor={palette.bgMid} />
          <stop offset="100%" stopColor={palette.bgEnd} />
        </radialGradient>
        <linearGradient id={goldId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={palette.goldStart} />
          <stop offset="50%" stopColor={palette.goldMid} />
          <stop offset="100%" stopColor={palette.goldEnd} />
        </linearGradient>
        <linearGradient id={ivoryId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={palette.pageStart} />
          <stop offset="100%" stopColor={palette.pageEnd} />
        </linearGradient>
      </defs>

      {/* Outer Medallion Base */}
      <circle cx="60" cy="60" r="57" fill={`url(#${bgId})`} stroke={`url(#${goldId})`} strokeWidth="2.6" />
      {!isSimplified && (
        <circle
          cx="60"
          cy="60"
          r="51.5"
          fill="none"
          stroke={`url(#${goldId})`}
          strokeWidth="0.95"
          strokeDasharray="2.5 2.5"
          opacity="0.68"
        />
      )}

      {/* Rub el Hizb (8-Pointed Khatam Star) Geometric Frame */}
      {!isSimplified && (
        <g stroke={`url(#${goldId})`} strokeWidth="1.35" fill="none" opacity="0.52">
          <rect x="27" y="27" width="66" height="66" rx="5" />
          <rect x="27" y="27" width="66" height="66" rx="5" transform="rotate(45 60 60)" />
        </g>
      )}

      {/* Mihrab Arch & Finial */}
      <path
        d="M36 82 V53 C36 37 48 28 60 22 C72 28 84 37 84 53 V82"
        fill="none"
        stroke={`url(#${goldId})`}
        strokeWidth="1.9"
        strokeLinecap="round"
        opacity="0.9"
      />
      <circle cx="60" cy="17.5" r="2.3" fill={`url(#${goldId})`} />

      {/* Radiant Illumination Rays above the Mushaf */}
      <g stroke={`url(#${goldId})`} strokeWidth="1.3" strokeLinecap="round" opacity="0.8">
        <line x1="60" y1="32.5" x2="60" y2="41" />
        <line x1="49" y1="36" x2="53" y2="43" />
        <line x1="71" y1="36" x2="67" y2="43" />
      </g>

      {/* Open Illuminated Mushaf Pages */}
      <path
        d="M60 49 C52 45 41 45.5 33 49 V72 C41 68.5 52 68.5 60 73 C68 68.5 79 68.5 87 72 V49 C79 45.5 68 45 60 49 Z"
        fill={`url(#${ivoryId})`}
        stroke={`url(#${goldId})`}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {/* Mushaf Center Spine & Script Lines */}
      <line x1="60" y1="49" x2="60" y2="73" stroke={palette.ink} strokeWidth="1.65" strokeLinecap="round" />
      <g stroke={palette.ink} strokeWidth="1.3" strokeLinecap="round" opacity="0.8">
        <path d="M39 55 C44 53.5 50 53.5 55 55.5" fill="none" />
        <path d="M39 60.5 C44 59 50 59 55 61" fill="none" />
        <path d="M39 66 C44 64.5 50 64.5 55 66.5" fill="none" />
        <path d="M65 55.5 C70 53.5 76 53.5 81 55" fill="none" />
        <path d="M65 61 C70 59 76 59 81 60.5" fill="none" />
        <path d="M65 66.5 C70 64.5 76 64.5 81 66" fill="none" />
      </g>

      {/* Rihal (Traditional Quran Stand) */}
      <path
        d="M36 75 L60 83 L84 75 M46 89 L60 81 L74 89"
        fill="none"
        stroke={`url(#${goldId})`}
        strokeWidth="2.45"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="60" cy="95" r="2.2" fill={`url(#${goldId})`} />
    </svg>
  );
};

/**
 * Official WIRD Brand Symbol (رمز وِرد الإسلامي الرسمي)
 * Renders the crisp scalable vector emblem by default (with optional raster mode).
 */
export const WirdSymbol: React.FC<WirdSymbolProps> = ({
  size = 40,
  variant = 'primary',
  className = '',
  withGlow = false,
  renderMode = 'vector',
  ...props
}) => {
  const pixelSize = typeof size === 'number' ? `${size}px` : size;

  const glowStyle = withGlow
    ? 'shadow-[0_0_22px_var(--wird-ring)] ring-2 ring-[var(--wird-border-gold)]'
    : 'ring-1 ring-[var(--wird-border-gold)]';

  const filterStyle = variant === 'monochrome'
    ? 'grayscale opacity-85'
    : '';

  return (
    <div
      style={{ width: pixelSize, height: pixelSize }}
      className={`relative inline-flex items-center justify-center shrink-0 rounded-full overflow-hidden bg-[var(--wird-primary)] select-none transition-transform duration-200 ${glowStyle} ${className}`}
      role="img"
      aria-label="شعار وِرد الرسمي"
      data-emblem-mode={renderMode}
      {...props}
    >
      {renderMode === 'raster' ? (
        <img
          src={OFFICIAL_BRAND_EMBLEM_URL}
          alt="شعار وِرد الرسمي"
          className={`w-full h-full object-cover select-none ${filterStyle}`}
          loading="eager"
          decoding="async"
        />
      ) : (
        <WirdVectorEmblemSvg variant={variant} className={`w-full h-full select-none ${filterStyle}`} />
      )}
    </div>
  );
};

export interface WirdWordmarkProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  textColor?: string;
}

/**
 * Official WIRD Typographic Wordmark (الشعار اللفظي «وِرد»)
 * Features the authentic Arabic calligraphic title paired with uppercase Latin WIRD
 */
export const WirdWordmark: React.FC<WirdWordmarkProps> = ({
  className = '',
  size = 'md',
  showSubtitle = true,
  textColor,
}) => {
  const sizeConfig = {
    sm: {
      title: 'text-base',
      latin: 'text-[9px] tracking-wider',
      subtitle: 'text-[10px]',
      gap: 'gap-1',
    },
    md: {
      title: 'text-lg md:text-xl',
      latin: 'text-[10px] md:text-[11px] tracking-widest',
      subtitle: 'text-[11px]',
      gap: 'gap-1.5',
    },
    lg: {
      title: 'text-2xl md:text-3xl',
      latin: 'text-xs md:text-sm tracking-widest',
      subtitle: 'text-xs md:text-sm',
      gap: 'gap-2',
    },
    xl: {
      title: 'text-3xl md:text-4xl',
      latin: 'text-sm md:text-base tracking-[0.2em]',
      subtitle: 'text-sm md:text-base',
      gap: 'gap-2.5',
    },
  }[size];

  return (
    <div className={`flex flex-col text-right ${className}`}>
      <div className={`flex items-baseline ${sizeConfig.gap}`}>
        <span
          className={`font-black tracking-tight font-quran select-none ${sizeConfig.title} ${
            textColor || 'text-[var(--wird-primary)] dark:text-[var(--wird-text)]'
          }`}
        >
          وِرد
        </span>
        <span
          className={`font-extrabold uppercase font-sans-ui select-none ${sizeConfig.latin} text-[var(--wird-accent)]`}
        >
          WIRD
        </span>
      </div>
      {showSubtitle && (
        <span
          className={`font-medium select-none ${sizeConfig.subtitle} text-[var(--wird-muted)]`}
        >
          رفيق القرآن والورد اليومي
        </span>
      )}
    </div>
  );
};

export interface WirdBrandLockupProps {
  symbolSize?: number | string;
  textSize?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: WirdSymbolVariant;
  layout?: 'horizontal' | 'vertical';
  showSubtitle?: boolean;
  className?: string;
  withGlow?: boolean;
}

/**
 * Complete Official WIRD Brand Lockup (الهوية الكاملة: الشعار والاسم)
 */
export const WirdBrandLockup: React.FC<WirdBrandLockupProps> = ({
  symbolSize = 42,
  textSize = 'md',
  variant = 'primary',
  layout = 'horizontal',
  showSubtitle = true,
  className = '',
  withGlow = false,
}) => {
  if (layout === 'vertical') {
    return (
      <div className={`flex flex-col items-center text-center space-y-3 ${className}`}>
        <WirdSymbol size={symbolSize} variant={variant} withGlow={withGlow} />
        <div className="flex flex-col items-center">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-black font-quran text-[var(--wird-primary)] dark:text-[var(--wird-text)]">
              وِرد
            </span>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--wird-accent)]">
              WIRD
            </span>
          </div>
          {showSubtitle && (
            <p className="text-xs text-[var(--wird-muted)] mt-1 font-medium">
              حفظ وتثبيت القرآن الكريم وفق منهجيات المراجعة المتباعدة
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <WirdSymbol size={symbolSize} variant={variant} withGlow={withGlow} />
      <WirdWordmark size={textSize} showSubtitle={showSubtitle} />
    </div>
  );
};
