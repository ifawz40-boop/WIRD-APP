import React from 'react';
import {
  Play,
  Moon,
  Sun,
  Download,
  Cloud,
  CloudCheck,
  CloudOff,
  CloudAlert,
  RefreshCw,
  Menu,
  Palette,
} from 'lucide-react';
import { UserProfile } from '../../types/quran';
import { useCloudSync } from '../../hooks/useCloudSync';

import { type WirdDesignId } from '../../services/themePreferences';

interface HeaderProps {
  currentTab: string;
  tabTitle: string;
  profile: UserProfile;
  activeDesign?: WirdDesignId;
  onToggleTheme: () => void;
  onOpenThemeCustomizer?: () => void;
  onStartDailySession: () => void;
  pwaInstallPrompt?: any;
  isStandalone?: boolean;
  onInstallPwa?: () => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

const TAB_SECTION_GROUPS: Record<string, string> = {
  dashboard: 'وِرد اليوم',
  library: 'القراءة والتلاوة',
  plans: 'الحفظ والتثبيت',
  session: 'الحفظ والتثبيت',
  revision: 'الحفظ والتثبيت',
  tests: 'الحفظ والتثبيت',
  progress: 'المتابعة',
  adhkar: 'العبادة اليومية',
  seerah: 'السيرة النبوية',
  ruqyah: 'العبادة اليومية',
  advisor: 'الإرشاد القرآني',
  settings: 'النظام والحساب',
  showcase: 'نظام التصميم',
};

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  tabTitle,
  profile,
  activeDesign = 'design-a',
  onToggleTheme,
  onOpenThemeCustomizer,
  onStartDailySession,
  pwaInstallPrompt,
  isStandalone,
  onInstallPwa,
  isSidebarOpen,
  onToggleSidebar,
}) => {
  const { status, pendingCount, triggerSync } = useCloudSync();

  const syncLabel =
    status === 'synced'
      ? 'مُزامن'
      : status === 'partial'
      ? 'مزامنة جزئية'
      : status === 'syncing'
      ? 'جارٍ المزامنة'
      : status === 'offline'
      ? 'دون اتصال'
      : status === 'unverified'
      ? 'تفعيل البريد'
      : status === 'error'
      ? 'تعذر المزامنة'
      : 'محلي';

  const syncTitle =
    status === 'synced'
      ? 'المزامنة السحابية مكتملة (انقر للتحديث)'
      : status === 'partial'
      ? 'تم الرفع السحابي بانتظار اكتمال الإسقاط المحلي'
      : status === 'syncing'
      ? 'جارٍ المزامنة مع السحابة...'
      : status === 'offline'
      ? 'الجهاز غير متصل بالإنترنت — كل تغييراتك محفوظة محلياً'
      : status === 'unverified'
      ? 'بانتظار تفعيل البريد الإلكتروني لتفعيل المزامنة'
      : status === 'error'
      ? 'تعذر إكمال المزامنة الأخيرة — انقر لإعادة المحاولة'
      : 'نمط محلي على هذا الجهاز';

  const sectionGroup = TAB_SECTION_GROUPS[currentTab];

  return (
    <header className="sticky top-0 z-30 h-14 sm:h-15 bg-[var(--wird-header-glass)] backdrop-blur-md border-b border-[var(--wird-border)] px-3.5 sm:px-6 flex items-center justify-between gap-3 transition-colors duration-150">
      {/* Zone 1: Navigation Toggle + Editorial Breadcrumb Title */}
      <div className="flex items-center gap-2.5 min-w-0">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className={`min-h-11 min-w-11 inline-flex items-center justify-center rounded-[var(--wird-radius-control)] transition-colors wird-focus-ring shrink-0 ${
              !isSidebarOpen
                ? 'bg-[var(--wird-surface-muted)] text-[var(--wird-primary)] dark:text-[var(--wird-accent)] border border-[var(--wird-border)]'
                : 'text-[var(--wird-text)] hover:bg-[var(--wird-surface-muted)]'
            }`}
            title={
              isSidebarOpen
                ? 'إغلاق الشريط الجانبي (Ctrl+B / Cmd+B)'
                : 'فتح الشريط الجانبي (Ctrl+B / Cmd+B)'
            }
            aria-label={
              isSidebarOpen ? 'إغلاق الشريط الجانبي' : 'فتح الشريط الجانبي'
            }
            data-sidebar-toggle="desktop"
            aria-keyshortcuts="Control+B Meta+B"
            aria-expanded={isSidebarOpen}
            data-sidebar-state={isSidebarOpen ? 'open' : 'closed'}
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="min-w-0 flex items-baseline gap-2">
          <h1 className="text-sm sm:text-base font-bold text-[var(--wird-text)] truncate whitespace-nowrap leading-tight">
            {tabTitle}
          </h1>
          {sectionGroup && (
            <span className="hidden md:inline-flex items-center gap-2 text-xs text-[var(--wird-muted)] whitespace-nowrap shrink-0">
              <span aria-hidden="true" className="opacity-45">
                ·
              </span>
              <span>{sectionGroup}</span>
            </span>
          )}
        </div>
      </div>

      {/* Zone 2: Restraint Utility Controls & Single Contextual Primary Action */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {!isStandalone && pwaInstallPrompt && onInstallPwa && (
          <button
            type="button"
            onClick={onInstallPwa}
            className="hidden sm:inline-flex min-h-10 items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[var(--wird-text)] bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] rounded-[var(--wird-radius-control)] hover:border-[var(--wird-border-strong)] transition-colors whitespace-nowrap shrink-0 wird-focus-ring"
            title="تثبيت التطبيق على الجهاز للعمل دون إنترنت"
          >
            <Download className="w-3.5 h-3.5 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
            <span>تثبيت</span>
          </button>
        )}

        {/* Honest Cloud Sync Trigger */}
        <button
          type="button"
          onClick={() => triggerSync()}
          disabled={status === 'syncing'}
          className={`min-h-11 inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-[var(--wird-radius-control)] transition-colors whitespace-nowrap shrink-0 wird-focus-ring ${
            status === 'synced'
              ? 'text-[var(--wird-primary)] dark:text-emerald-300 hover:bg-[var(--wird-surface-muted)]'
              : status === 'syncing' || status === 'partial' || status === 'unverified'
              ? 'text-[var(--wird-accent-hover)] dark:text-[var(--wird-accent)] hover:bg-[var(--wird-surface-muted)]'
              : status === 'error'
              ? 'text-rose-700 dark:text-rose-300 hover:bg-[var(--wird-surface-muted)]'
              : 'text-[var(--wird-muted)] hover:bg-[var(--wird-surface-muted)]'
          }`}
          title={syncTitle}
          aria-label={syncTitle}
        >
          {status === 'syncing' ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : status === 'synced' ? (
            <CloudCheck className="w-4 h-4" />
          ) : status === 'offline' ? (
            <CloudOff className="w-4 h-4" />
          ) : status === 'unverified' || status === 'error' || status === 'partial' ? (
            <CloudAlert className="w-4 h-4" />
          ) : (
            <Cloud className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">{syncLabel}</span>
          {pendingCount > 0 && (
            <span className="text-[11px] font-mono wird-tabular opacity-85">
              ({pendingCount})
            </span>
          )}
        </button>

        {/* Live Theme & Design Customizer Trigger */}
        {onOpenThemeCustomizer && (
          <button
            type="button"
            onClick={onOpenThemeCustomizer}
            data-theme-customizer-trigger
            className="min-h-11 inline-flex items-center justify-center gap-1.5 px-2.5 text-[var(--wird-text)] hover:bg-[var(--wird-surface-muted)] rounded-[var(--wird-radius-control)] transition-colors wird-focus-ring"
            title={`تخصيص التصميم والمظهر (النشط: ${activeDesign === 'design-b' ? 'التصميم B' : 'التصميم A'})`}
            aria-label="تخصيص التصميم والمظهر"
          >
            <Palette className="w-4 h-4 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
            <span className="hidden sm:inline text-[11px] font-bold text-[var(--wird-muted)]">
              {activeDesign === 'design-b' ? 'B' : 'A'}
            </span>
          </button>
        )}

        {/* Quick Light/Dark Toggle */}
        <button
          type="button"
          onClick={onToggleTheme}
          className="min-h-11 min-w-11 inline-flex items-center justify-center text-[var(--wird-text)] hover:bg-[var(--wird-surface-muted)] rounded-[var(--wird-radius-control)] transition-colors wird-focus-ring"
          title={
            profile.theme === 'dark'
              ? 'التبديل إلى الوضع النهاري'
              : 'التبديل إلى الوضع الليلي'
          }
          aria-label="تبديل المظهر النهاري والليلي"
        >
          {profile.theme === 'dark' ? (
            <Sun className="w-4 h-4 text-[var(--wird-accent)]" />
          ) : (
            <Moon className="w-4 h-4 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
          )}
        </button>

        {/* Single Contextual Primary Action on Secondary Views */}
        {currentTab !== 'dashboard' && currentTab !== 'session' && (
          <button
            type="button"
            onClick={onStartDailySession}
            className="wird-btn-primary min-h-10 sm:min-h-11 px-3.5 sm:px-4 py-2 text-xs sm:text-[13px] whitespace-nowrap shrink-0 wird-focus-ring"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>جلسة اليوم</span>
          </button>
        )}
      </div>
    </header>
  );
};
