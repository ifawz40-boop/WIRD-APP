import React from 'react';
import { Play, Moon, Sun, Download, Cloud, CloudCheck, CloudOff, CloudAlert, RefreshCw, Menu } from 'lucide-react';
import { UserProfile } from '../../types/quran';
import { useCloudSync } from '../../hooks/useCloudSync';

interface HeaderProps {
  currentTab: string;
  tabTitle: string;
  profile: UserProfile;
  onToggleTheme: () => void;
  onStartDailySession: () => void;
  pwaInstallPrompt?: any;
  isStandalone?: boolean;
  onInstallPwa?: () => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  tabTitle,
  profile,
  onToggleTheme,
  onStartDailySession,
  pwaInstallPrompt,
  isStandalone,
  onInstallPwa,
  isSidebarOpen,
  onToggleSidebar
}) => {
  const { status, pendingCount, triggerSync } = useCloudSync();

  const tabSubtitles: Record<string, string> = {
    dashboard: 'متابعة الورد اليومي والحفظ والمراجعة',
    library: 'المصحف الشريف · تلاوة وتفسير واستماع',
    plans: 'تخطيط ذكي وجدولة متوازنة',
    session: 'بيئة تركيز وتكرار وتسميع تراكمي',
    revision: 'تثبيت المحفوظ بنظام المراجعة المتباعدة',
    tests: 'قياس الإتقان وجودة الاستحضار',
    progress: 'خريطة المصحف وإحصاءات الإنجاز',
    advisor: 'إرشاد منهجي وتوجيه قرآني',
    adhkar: 'أذكار الصباح والمساء والأدعية القرآنية والنبوية',
    seerah: 'كتاب السيرة النبوية السردي الموثق من المولد إلى الرفيق الأعلى',
    ruqyah: 'آيات وأدعية نبوية موثقة',
    settings: 'الحساب والمظهر والتخزين بدون إنترنت',
    showcase: 'نظام التصميم والهوية البصرية',
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-[#F9F6EE]/92 dark:bg-[#0B132B]/92 backdrop-blur-xl border-b border-[#1C4E46]/10 dark:border-[#E0A96D]/15 px-4 md:px-7 flex items-center justify-between gap-3 transition-colors">
      {/* Page context with Sidebar Toggle */}
      <div className="flex items-center gap-2.5 min-w-0">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className={`min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27] shrink-0 ${
              !isSidebarOpen
                ? 'bg-[#F2EDE2] dark:bg-[#111F36] text-[#1C4E46] dark:text-[#E0A96D] ring-1 ring-[#C59B27]/40 shadow-2xs'
                : 'text-[#142421] dark:text-[#F5F1E8] hover:text-[#1C4E46] dark:hover:text-[#E0A96D] hover:bg-[#F2EDE2] dark:hover:bg-[#111F36]'
            }`}
            title={isSidebarOpen
              ? 'إغلاق الشريط الجانبي (Ctrl+B / Cmd+B)'
              : 'فتح الشريط الجانبي (Ctrl+B / Cmd+B)'}
            aria-label={isSidebarOpen ? 'إغلاق الشريط الجانبي' : 'فتح الشريط الجانبي'}
            data-sidebar-toggle="desktop"
            aria-keyshortcuts="Control+B Meta+B"
            aria-expanded={isSidebarOpen}
            data-sidebar-state={isSidebarOpen ? 'open' : 'closed'}
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div className="min-w-0 flex flex-col">
          <h1 className="text-base md:text-lg font-bold text-[#142421] dark:text-[#F5F1E8] truncate font-quran leading-tight">
            {tabTitle}
          </h1>
          {tabSubtitles[currentTab] && (
            <span className="hidden md:block text-[11px] font-medium text-[#5B6F6B] dark:text-[#98ADAA] truncate">
              {tabSubtitles[currentTab]}
            </span>
          )}
        </div>
      </div>

      {/* Actions: Optional PWA Install (only when prompt ready) + Sync + Theme + Session CTA on secondary views */}
      <div className="flex items-center gap-2 shrink-0">
        {!isStandalone && pwaInstallPrompt && onInstallPwa && (
          <button
            type="button"
            onClick={onInstallPwa}
            className="hidden sm:inline-flex min-h-11 items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1C4E46] dark:text-[#E0A96D] bg-[#F2EDE2] dark:bg-[#111F36] border border-[#C59B27]/35 dark:border-[#E0A96D]/25 rounded-xl hover:border-[#C59B27] transition-colors"
            title="تثبيت التطبيق على الجهاز كبرنامج مستقل"
          >
            <Download className="w-3.5 h-3.5" />
            <span>تثبيت</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => triggerSync()}
          disabled={status === 'syncing'}
          className={`min-h-11 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27] ${
            status === 'synced'
              ? 'text-[#1C4E46] dark:text-[#6EE7B7] hover:bg-[#1C4E46]/8 dark:hover:bg-[#1E4A47]/40'
              : status === 'syncing'
              ? 'text-[#9A7415] dark:text-[#E0A96D] bg-[#C59B27]/10 dark:bg-[#E0A96D]/12'
              : status === 'unverified'
              ? 'text-[#9A7415] dark:text-[#E0A96D] hover:bg-[#C59B27]/10 dark:hover:bg-[#E0A96D]/12'
              : 'text-[#5B6F6B] dark:text-[#8B9E9B] hover:bg-[#F2EDE2] dark:hover:bg-[#111F36]'
          }`}
          title={
            status === 'synced'
              ? 'المزامنة السحابية مكتملة (انقر لإعادة المزامنة)'
              : status === 'syncing'
              ? 'جاري المزامنة مع السحابة...'
              : status === 'offline'
              ? 'الجهاز غير متصل بالإنترنت'
              : status === 'unverified'
              ? 'بانتظار تفعيل البريد للمزامنة'
              : 'نمط الزائر (محلي فقط)'
          }
        >
          {status === 'syncing' ? (
            <RefreshCw className="w-4 h-4 animate-spin text-[#C59B27] dark:text-[#E0A96D]" />
          ) : status === 'synced' ? (
            <CloudCheck className="w-4 h-4 text-[#1C4E46] dark:text-[#6EE7B7]" />
          ) : status === 'offline' ? (
            <CloudOff className="w-4 h-4 text-[#5B6F6B] dark:text-[#8B9E9B]" />
          ) : status === 'unverified' ? (
            <CloudAlert className="w-4 h-4 text-[#C59B27] dark:text-[#E0A96D]" />
          ) : (
            <Cloud className="w-4 h-4 text-[#5B6F6B] dark:text-[#8B9E9B]" />
          )}
          <span className="hidden sm:inline">
            {status === 'synced'
              ? 'مُزامن'
              : status === 'syncing'
              ? 'مزامنة...'
              : status === 'offline'
              ? 'أوفلاين'
              : status === 'unverified'
              ? 'تفعيل البريد'
              : 'محلي'}
          </span>
          {pendingCount > 0 && (
            <span className="text-[#8A6914] dark:text-[#E0A96D] text-[11px] font-mono tabular-nums">
              ({pendingCount})
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onToggleTheme}
          className="min-h-11 min-w-11 inline-flex items-center justify-center text-[#142421] dark:text-[#F5F1E8] hover:bg-[#F2EDE2] dark:hover:bg-[#111F36] rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27]"
          title={profile.theme === 'dark' ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع الليلي'}
          aria-label="تبديل المظهر النهاري والليلي"
        >
          {profile.theme === 'dark' ? (
            <Sun className="w-4 h-4 text-[#E0A96D]" />
          ) : (
            <Moon className="w-4 h-4 text-[#1C4E46]" />
          )}
        </button>

        {currentTab !== 'dashboard' && currentTab !== 'session' && (
          <button
            type="button"
            onClick={onStartDailySession}
            className="min-h-11 inline-flex items-center gap-2 px-4 py-2 text-xs md:text-sm font-bold text-white bg-[#1C4E46] hover:bg-[#28665B] dark:bg-[#1E4A47] dark:hover:bg-[#235D59] rounded-xl shadow-xs transition-all active:scale-95 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27] ring-1 ring-[#C59B27]/40 dark:ring-[#E0A96D]/30"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>جلسة اليوم</span>
          </button>
        )}
      </div>
    </header>
  );
};

