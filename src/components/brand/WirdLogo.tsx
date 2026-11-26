import React, { useId } from 'react';

export type WirdSymbolVariant = 'primary' | 'light' | 'dark' | 'gold' | 'monochrome' | 'simplified';

export interface WirdSymbolProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: number | string;
  variant?: WirdSymbolVariant;
  className?: string;
  withGlow?: boolean;
  renderMode?: 'vector' | 'raster';
}

export const OFFICIAL_BRAND_EMBLEM_URL = '/favicon.svg';

/**
 * Pure Scalable Vector Emblem SVG (الشعار الهندسي المعماري الجديد لتطبيق وِرد)
 * Clean, iconic open Mushaf folio with negative-space spine, minimalist brass Rihal cradle,
 * and single guiding diamond point — engineered for legibility from 16px to 512px.
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
      bgStart: '#0D3D2E',
      bgMid: '#06291F',
      bgEnd: '#031711',
      goldStart: '#EAC67A',
      goldMid: '#C89B3C',
      goldEnd: '#A67822',
      pageStart: '#FCF9F2',
      pageEnd: '#EDE4D0',
    },
    light: {
      bgStart: '#124B39',
      bgMid: '#083326',
      bgEnd: '#041E16',
      goldStart: '#F0CF88',
      goldMid: '#CFA244',
      goldEnd: '#AD7E26',
      pageStart: '#FFFFFF',
      pageEnd: '#F2EBE0',
    },
    dark: {
      bgStart: '#13283F',
      bgMid: '#0C1A2B',
      bgEnd: '#07101B',
      goldStart: '#EBC77D',
      goldMid: '#CE9F42',
      goldEnd: '#A87B25',
      pageStart: '#FAF7F0',
      pageEnd: '#E7DFCE',
    },
    gold: {
      bgStart: '#B58932',
      bgMid: '#8F691E',
      bgEnd: '#5E430E',
      goldStart: '#FFFDF9',
      goldMid: '#F6F0E3',
      goldEnd: '#E5DBC6',
      pageStart: '#FFFDF9',
      pageEnd: '#F2ECE0',
    },
    monochrome: {
      bgStart: '#27302E',
      bgMid: '#1A2120',
      bgEnd: '#101514',
      goldStart: '#E2E7E6',
      goldMid: '#B8C2C0',
      goldEnd: '#8E9B98',
      pageStart: '#F7F9F9',
      pageEnd: '#DCE3E1',
    },
    simplified: {
      bgStart: '#0D3D2E',
      bgMid: '#06291F',
      bgEnd: '#031711',
      goldStart: '#EAC67A',
      goldMid: '#C89B3C',
      goldEnd: '#A67822',
      pageStart: '#FCF9F2',
      pageEnd: '#EDE4D0',
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
        <radialGradient id={bgId} cx="50%" cy="28%" r="78%">
          <stop offset="0%" stopColor={palette.bgStart} />
          <stop offset="55%" stopColor={palette.bgMid} />
          <stop offset="100%" stopColor={palette.bgEnd} />
        </radialGradient>
        <linearGradient id={goldId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={palette.goldStart} />
          <stop offset="52%" stopColor={palette.goldMid} />
          <stop offset="100%" stopColor={palette.goldEnd} />
        </linearGradient>
        <linearGradient id={ivoryId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={palette.pageStart} />
          <stop offset="100%" stopColor={palette.pageEnd} />
        </linearGradient>
      </defs>

      {/* Clean Architectural Base */}
      <rect x="0" y="0" width="120" height="120" rx="28" fill={`url(#${bgId})`} />
      {!isSimplified && (
        <rect
          x="6"
          y="6"
          width="108"
          height="108"
          rx="23"
          fill="none"
          stroke={`url(#${goldId})`}
          strokeWidth="1.2"
          opacity="0.28"
        />
      )}

      {/* Guiding Wird Diamond Point */}
      <path d="M60 19.5 L65 26.5 L60 33.5 L55 26.5 Z" fill={`url(#${goldId})`} />

      {/* Sculpted Open Mushaf Folio Leaves with Clean Negative-Space Spine */}
      <path
        d="M58 41.5 C47.5 34.8 34 35.8 24.5 42.2 V79.5 C34 73.4 47.5 72.8 58 80.2 Z"
        fill={`url(#${ivoryId})`}
      />
      <path
        d="M62 41.5 C72.5 34.8 86 35.8 95.5 42.2 V79.5 C86 73.4 72.5 72.8 62 80.2 Z"
        fill={`url(#${ivoryId})`}
      />

      {/* Minimalist Architectural Rihal Cradle */}
      <path
        d="M33 87.5 L60 96.5 L87 87.5"
        fill="none"
        stroke={`url(#${goldId})`}
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {!isSimplified && (
        <path
          d="M46 97.5 L60 92.5 L74 97.5"
          fill="none"
          stroke={`url(#${goldId})`}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.82"
        />
      )}
    </svg>
  );
};

/**
 * Official WIRD Brand Symbol (رمز وِرد الرسمي)
 * Renders the crisp scalable vector emblem inside a refined architectural squircle.
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

  const ringStyle = withGlow
    ? 'shadow-sm ring-1 ring-[var(--wird-border-gold)]'
    : 'ring-1 ring-black/8 dark:ring-white/10';

  const filterStyle = variant === 'monochrome' ? 'grayscale opacity-85' : '';

  return (
    <div
      style={{ width: pixelSize, height: pixelSize }}
      className={`relative inline-flex items-center justify-center shrink-0 rounded-[23%] overflow-hidden bg-[var(--wird-primary)] select-none transition-transform duration-150 ${ringStyle} ${className}`}
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
      latin: 'text-[9px] tracking-[0.14em]',
      subtitle: 'text-[10px]',
      gap: 'gap-1.5',
    },
    md: {
      title: 'text-lg md:text-xl',
      latin: 'text-[10px] tracking-[0.16em]',
      subtitle: 'text-[11px]',
      gap: 'gap-1.5',
    },
    lg: {
      title: 'text-2xl md:text-3xl',
      latin: 'text-xs tracking-[0.18em]',
      subtitle: 'text-xs md:text-sm',
      gap: 'gap-2',
    },
    xl: {
      title: 'text-3xl md:text-4xl',
      latin: 'text-sm tracking-[0.2em]',
      subtitle: 'text-sm md:text-base',
      gap: 'gap-2.5',
    },
  }[size];

  return (
    <div className={`flex flex-col text-right ${className}`}>
      <div className={`flex items-baseline ${sizeConfig.gap}`}>
        <span
          className={`font-bold tracking-tight font-editorial-ar select-none leading-none ${sizeConfig.title} ${
            textColor || 'text-[var(--wird-primary)] dark:text-[var(--wird-text)]'
          }`}
        >
          وِرد
        </span>
        <span
          className={`font-semibold uppercase font-sans-ui select-none ${sizeConfig.latin} text-[var(--wird-accent)]`}
        >
          WIRD
        </span>
      </div>
      {showSubtitle && (
        <span
          className={`font-normal select-none mt-0.5 ${sizeConfig.subtitle} text-[var(--wird-muted)]`}
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
  symbolSize = 40,
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
            <span className="text-2xl md:text-3xl font-bold font-editorial-ar text-[var(--wird-primary)] dark:text-[var(--wird-text)]">
              وِرد
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--wird-accent)]">
              WIRD
            </span>
          </div>
          {showSubtitle && (
            <p className="text-xs text-[var(--wird-muted)] mt-1 font-normal">
              حفظ وتثبيت القرآن الكريم وفق منهجيات المراجعة المتباعدة
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <WirdSymbol size={symbolSize} variant={variant} withGlow={withGlow} />
      <WirdWordmark size={textSize} showSubtitle={showSubtitle} />
    </div>
  );
};
