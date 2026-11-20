import React from 'react';

/**
 * Authentic 8-pointed Islamic Star Geometric Pattern (خلفية الزخرفة الهندسية الإسلامية)
 * Subtle, serene background mesh with mathematically exact Khatam geometry.
 */
export const WirdIslamicPattern: React.FC<{
  className?: string;
  opacity?: number;
  variant?: 'emerald' | 'gold' | 'ivory';
}> = ({
  className = '',
  opacity = 0.04,
  variant = 'emerald',
}) => {
  const strokeColor =
    variant === 'emerald'
      ? '#102D29'
      : variant === 'gold'
      ? '#B99B62'
      : '#E8DFC9';

  return (
    <div
      className={`absolute inset-0 pointer-events-none overflow-hidden select-none ${className}`}
      style={{ opacity }}
      aria-hidden="true"
    >
      <svg
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
      >
        <defs>
          <pattern
            id={`wird-islamic-pattern-${variant}`}
            width="60"
            height="60"
            patternUnits="userSpaceOnUse"
          >
            {/* 8-point Islamic interlocking star unit */}
            <g stroke={strokeColor} strokeWidth="0.8" fill="none">
              <rect x="15" y="15" width="30" height="30" rx="3" />
              <rect x="15" y="15" width="30" height="30" rx="3" transform="rotate(45 30 30)" />
              <circle cx="30" cy="30" r="8" strokeDasharray="1.5 2" />
              <circle cx="0" cy="0" r="10" />
              <circle cx="60" cy="0" r="10" />
              <circle cx="0" cy="60" r="10" />
              <circle cx="60" cy="60" r="10" />
            </g>
          </pattern>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill={`url(#wird-islamic-pattern-${variant})`}
        />
      </svg>
    </div>
  );
};

/**
 * Geometric Islamic Rosette Divider (فاصل زخرفي إسلامي هندسي هادئ)
 */
export const WirdGeometricDivider: React.FC<{
  className?: string;
  withStar?: boolean;
}> = ({
  className = '',
  withStar = true,
}) => {
  return (
    <div className={`flex items-center justify-center gap-3 w-full my-6 text-[#B99B62]/60 dark:text-[#C8AD73]/40 ${className}`} aria-hidden="true">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#B99B62]/30 dark:via-[#C8AD73]/20 to-transparent" />
      {withStar && (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="shrink-0 text-[#B99B62] dark:text-[#C8AD73]">
          <rect x="6" y="6" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1" />
          <rect x="6" y="6" width="12" height="12" rx="1.5" transform="rotate(45 12 12)" stroke="currentColor" strokeWidth="1" />
          <circle cx="12" cy="12" r="2.2" fill="currentColor" />
        </svg>
      )}
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#B99B62]/30 dark:via-[#C8AD73]/20 to-transparent" />
    </div>
  );
};

/**
 * Ornate Islamic Corner Accents (إطار هندسي إسلامي دقيق للبطاقات الفاخرة)
 */
export const WirdOrnateFrame: React.FC<{
  children: React.ReactNode;
  className?: string;
  variant?: 'emerald' | 'gold' | 'subtle';
}> = ({
  children,
  className = '',
  variant = 'subtle',
}) => {
  const borderColors = {
    emerald: 'border-[#102D29]/20 dark:border-[#1D4940]/40',
    gold: 'border-[#B99B62]/35 dark:border-[#B99B62]/25',
    subtle: 'border-[#1C4E46]/15 dark:border-[#E0A96D]/20',
  }[variant];

  return (
    <div className={`relative rounded-2xl border ${borderColors} p-5 md:p-6 bg-white dark:bg-[#111F36] shadow-xs overflow-hidden ${className}`}>
      {/* Decorative corner florets */}
      <svg className="absolute top-2 right-2 w-4 h-4 text-[#B99B62]/40 pointer-events-none" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M1 1 H7 M1 1 V7 M3 3 H6 M3 3 V6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      </svg>
      <svg className="absolute top-2 left-2 w-4 h-4 text-[#B99B62]/40 pointer-events-none" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M15 1 H9 M15 1 V7 M13 3 H10 M13 3 V6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      </svg>
      <svg className="absolute bottom-2 right-2 w-4 h-4 text-[#B99B62]/40 pointer-events-none" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M1 15 H7 M1 15 V9 M3 13 H6 M3 13 V10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      </svg>
      <svg className="absolute bottom-2 left-2 w-4 h-4 text-[#B99B62]/40 pointer-events-none" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M15 15 H9 M15 15 V9 M13 13 H10 M13 13 V10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      </svg>
      {children}
    </div>
  );
};

/**
 * Architectural Mihrab Arch & Illuminated Manuscript Vector Artwork
 * (زخرفة المحراب المعماري والمصحف المُنار للواجهات الترحيبية وحالات الفراغ)
 */
export const WirdMihrabArch: React.FC<{
  className?: string;
  size?: number;
  variant?: 'gold' | 'emerald';
}> = ({
  className = '',
  size = 140,
  variant = 'gold',
}) => {
  const strokeMain = variant === 'gold' ? '#C59B27' : '#1C4E46';
  const strokeAccent = variant === 'gold' ? '#E0A96D' : '#28665B';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none pointer-events-none ${className}`}
      aria-hidden="true"
    >
      {/* Outer Mihrab Arch */}
      <path
        d="M28 136 V74 C28 45 54 27 80 16 C106 27 132 45 132 74 V136"
        stroke={strokeMain}
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.7"
      />
      {/* Inner Scalloped Arch */}
      <path
        d="M36 132 V76 C36 51 58 35 80 25 C102 35 124 51 124 76 V132"
        stroke={strokeAccent}
        strokeWidth="1.1"
        strokeDasharray="3 3"
        opacity="0.55"
      />
      {/* Suspended Mosque Lamp (Mishkat) */}
      <line x1="80" y1="25" x2="80" y2="48" stroke={strokeMain} strokeWidth="1.2" opacity="0.65" />
      <path
        d="M73 48 H87 L84 59 C82 63 78 63 76 59 L73 48 Z"
        stroke={strokeMain}
        strokeWidth="1.3"
        fill={strokeAccent}
        fillOpacity="0.16"
      />
      <circle cx="80" cy="54" r="2.2" fill={strokeMain} />

      {/* Open Mushaf on Rihal */}
      <path
        d="M80 78 C69 72.5 55 73 45 77.5 V106 C55 101.5 69 101.5 80 107.5 C91 101.5 105 101.5 115 106 V77.5 C105 73 91 72.5 80 78 Z"
        stroke={strokeMain}
        strokeWidth="1.7"
        fill={strokeAccent}
        fillOpacity="0.1"
        strokeLinejoin="round"
      />
      <line x1="80" y1="78" x2="80" y2="107.5" stroke={strokeMain} strokeWidth="1.5" />
      <path
        d="M50 112 L80 122 L110 112 M62 128 L80 119 L98 128"
        stroke={strokeMain}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="22" y1="136" x2="138" y2="136" stroke={strokeMain} strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
};
