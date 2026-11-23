import React from 'react';
import { Palette } from 'lucide-react';
import {
  type WirdAppearanceMode,
  type WirdThemePreferences,
} from '../../services/themePreferences';
import { AppearanceSelectorPanel } from './AppearanceSelectorPanel';
import { WirdSheet } from './WirdPrimitives';

interface ThemeCustomizerSheetProps {
  open: boolean;
  onClose: () => void;
  mode: WirdAppearanceMode;
  onSetMode: (mode: WirdAppearanceMode) => void;
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
      title="تخصيص التصميم والمظهر"
      description="بدّل فورياً بين التصميم A و B والوضع النهاري أو الليلي بشكل مستقل دون إعادة تحميل."
    >
      <AppearanceSelectorPanel
        layout="sheet"
        mode={mode}
        onSetMode={onSetMode}
        preferences={preferences}
        onUpdatePreferences={onUpdatePreferences}
        onReset={onReset}
        onOpenShowcase={
          onOpenShowcase
            ? () => {
                onClose();
                onOpenShowcase();
              }
            : undefined
        }
      />
    </WirdSheet>
  );
};

export const ThemeCustomizerTriggerIcon = Palette;
