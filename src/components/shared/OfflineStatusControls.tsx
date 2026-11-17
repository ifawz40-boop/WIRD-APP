import React from 'react';
import { WifiOff, Download, Smartphone } from 'lucide-react';

interface OfflineNetworkBannerProps {
  isOnline: boolean;
}

/**
 * Calm offline indicator shown only when network connectivity is lost.
 * Uses semantic icon + Arabic copy (never color alone or decorative pulsing dots).
 */
export const OfflineNetworkBanner: React.FC<OfflineNetworkBannerProps> = ({ isOnline }) => {
  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-[#142421] dark:bg-[#111F36] text-[#F5F1E8] px-4 py-2 flex items-center justify-center gap-2.5 text-xs font-medium border-b border-[#C59B27]/35 dark:border-[#E0A96D]/30"
    >
      <WifiOff className="w-4 h-4 shrink-0 text-[#E0A96D]" aria-hidden="true" />
      <span>أنت تعمل بدون إنترنت — المصحف، استوديو الحفظ، المراجعة، الاختبارات، والتلاوات المحفوظة متاحة محلياً.</span>
    </div>
  );
};

interface PWAInstallActionProps {
  isStandalone: boolean;
  hasInstallPrompt: boolean;
  onInstall: () => void;
  variant?: 'compact' | 'card';
}

export const PWAInstallAction: React.FC<PWAInstallActionProps> = ({
  isStandalone,
  hasInstallPrompt,
  onInstall,
  variant = 'compact'
}) => {
  if (isStandalone) return null;

  if (variant === 'card') {
    return (
      <div className="p-4 rounded-xl border border-[#C59B27]/35 dark:border-[#E0A96D]/25 bg-[#F9F6EE] dark:bg-[#0D1C19] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1C4E46]/10 dark:bg-[#E0A96D]/15 text-[#1C4E46] dark:text-[#E0A96D] flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[#142421] dark:text-[#F5F1E8]">تثبيت «وِرد» كتطبيق مستقل</h4>
            <p className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B] mt-0.5 leading-relaxed">
              {hasInstallPrompt
                ? 'ثبّت المنصة على جهازك للفتح السريع والعمل الكامل أوفلاين كـ تطبيق مستقل.'
                : 'على آيفون وآيباد: افتح قائمة المشاركة (Share) في Safari ثم اختر «إضافة إلى الشاشة الرئيسية».'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onInstall}
          className="min-h-11 px-4 py-2 rounded-xl bg-[#1C4E46] hover:bg-[#143D36] dark:bg-[#1E4A47] dark:hover:bg-[#235D59] text-white text-xs font-bold flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-colors"
        >
          <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{hasInstallPrompt ? 'تثبيت التطبيق الآن' : 'دليل التثبيت على الجهاز'}</span>
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onInstall}
      className="min-h-11 px-3.5 py-2 rounded-xl border border-[#C59B27]/40 bg-[#C59B27]/10 hover:bg-[#C59B27]/20 text-[#142421] dark:text-[#F5F1E8] text-xs font-bold inline-flex items-center gap-2 whitespace-nowrap transition-colors"
    >
      <Download className="w-4 h-4 text-[#C59B27] dark:text-[#E0A96D] shrink-0" aria-hidden="true" />
      <span>تثبيت التطبيق</span>
    </button>
  );
};
