import React from 'react';
import {
  OFFICIAL_BRAND_EMBLEM_URL,
  WirdVectorEmblemSvg,
  type WirdSymbolVariant
} from './WirdLogo';

export type WirdAvatarShape = 'circle' | 'squircle' | 'rounded';
export type WirdAvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export interface WirdAvatarProps {
  size?: WirdAvatarSize | number;
  shape?: WirdAvatarShape;
  variant?: WirdSymbolVariant;
  className?: string;
  withRing?: boolean;
  withGlow?: boolean;
  alt?: string;
  renderMode?: 'vector' | 'raster';
}

const sizeMap: Record<WirdAvatarSize, { container: string; pixelSize: number }> = {
  xs: { container: 'w-6 h-6', pixelSize: 24 },
  sm: { container: 'w-8 h-8', pixelSize: 32 },
  md: { container: 'w-10 h-10', pixelSize: 40 },
  lg: { container: 'w-14 h-14', pixelSize: 56 },
  xl: { container: 'w-20 h-20', pixelSize: 80 },
  '2xl': { container: 'w-28 h-28', pixelSize: 112 },
};

const shapeMap: Record<WirdAvatarShape, string> = {
  circle: 'rounded-full',
  squircle: 'rounded-2xl',
  rounded: 'rounded-xl',
};

/**
 * Official WIRD Brand Avatar (الأفاتار والشعار الرسمي المعتمد لتطبيق وِرد)
 * Renders the crisp scalable vector emblem by default (with optional raster mode).
 */
export const WirdAvatar: React.FC<WirdAvatarProps> = ({
  size = 'md',
  shape = 'circle',
  variant = 'primary',
  className = '',
  withRing = true,
  withGlow = false,
  alt = 'شعار وأفاتار وِرد الرسمي',
  renderMode = 'vector',
}) => {
  const isCustomSize = typeof size === 'number';
  const pixel = isCustomSize ? size : sizeMap[size].pixelSize;
  const containerClass = isCustomSize ? '' : sizeMap[size].container;
  const shapeClass = shapeMap[shape];

  const ringStyles = withRing
    ? 'ring-1.5 ring-[#C59B27]/60 dark:ring-[#E0A96D]/50 shadow-sm'
    : '';

  const glowStyles = withGlow
    ? 'shadow-[0_0_25px_rgba(224,169,109,0.35)]'
    : '';

  return (
    <div
      role="img"
      aria-label={alt}
      data-emblem-mode={renderMode}
      style={isCustomSize ? { width: size, height: size } : undefined}
      className={`relative inline-flex items-center justify-center shrink-0 overflow-hidden select-none bg-[#0B132B] transition-all duration-200 ${shapeClass} ${containerClass} ${ringStyles} ${glowStyles} ${className}`}
    >
      {renderMode === 'raster' ? (
        <img
          src={OFFICIAL_BRAND_EMBLEM_URL}
          alt={alt}
          width={pixel}
          height={pixel}
          className={`w-full h-full object-cover transition-transform duration-300 hover:scale-105 ${
            variant === 'monochrome' ? 'grayscale opacity-85' : ''
          }`}
          loading="eager"
          decoding="async"
        />
      ) : (
        <WirdVectorEmblemSvg
          variant={variant}
          className={`w-full h-full transition-transform duration-300 hover:scale-105 ${
            variant === 'monochrome' ? 'grayscale opacity-85' : ''
          }`}
        />
      )}
    </div>
  );
};
