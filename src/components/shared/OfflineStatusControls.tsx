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
      className="bg-[#142421] dark:bg-[var(--wird-surface)] text-[#F5F1E8] px-4 py-2 flex items-center justify-center gap-2.5 text-xs font-medium border-b border-[var(--wird-border-gold)]"
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
      <div className="p-4 rounded-xl border border-[var(--wird-border-gold)] bg-[var(--wird-bg)] dark:bg-[#0D1C19] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--wird-border)] text-[var(--wird-primary)] dark:text-[var(--wird-accent)] flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[var(--wird-text)]">تثبيت «وِرد» كتطبيق مستقل</h4>
            <p className="text-xs text-[var(--wird-muted)] mt-0.5 leading-relaxed">
              {hasInstallPrompt
                ? 'ثبّت المنصة على جهازك للفتح السريع والعمل الكامل أوفلاين كـ تطبيق مستقل.'
                : 'على آيفون وآيباد: افتح قائمة المشاركة (Share) في Safari ثم اختر «إضافة إلى الشاشة الرئيسية».'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onInstall}
          className="min-h-11 px-4 py-2 rounded-xl bg-[var(--wird-primary)] hover:bg-[var(--wird-primary-hover)] text-white text-xs font-bold flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-colors"
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
      className="min-h-11 px-3.5 py-2 rounded-xl border border-[#C59B27]/40 bg-[#C59B27]/10 hover:bg-[#C59B27]/20 text-[var(--wird-text)] text-xs font-bold inline-flex items-center gap-2 whitespace-nowrap transition-colors"
    >
      <Download className="w-4 h-4 text-[var(--wird-accent)] shrink-0" aria-hidden="true" />
      <span>تثبيت التطبيق</span>
    </button>
  );
};
