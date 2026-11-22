import React, { useEffect, useLayoutEffect, useRef } from 'react';
import {
  Home,
  BookOpen,
  Calendar,
  Sparkles,
  Repeat,
  CheckCircle,
  BarChart3,
  Settings,
  X,
  ShieldCheck,
  Heart,
  ScrollText,
  Compass,
  MoreHorizontal,
} from 'lucide-react';
import { UserProfile } from '../../types/quran';
import { WirdBrandLockup } from '../brand/WirdLogo';
import { WirdAvatar } from '../brand/WirdAvatar';

export type NavTabId =
  | 'dashboard'
  | 'library'
  | 'plans'
  | 'session'
  | 'revision'
  | 'tests'
  | 'progress'
  | 'advisor'
  | 'adhkar'
  | 'seerah'
  | 'ruqyah'
  | 'settings'
  | 'showcase';

interface SidebarProps {
  currentTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onOpenMobileMenu: () => void;
  isDesktopOpen?: boolean;
  onToggleDesktop?: () => void;
  profile: UserProfile;
  dueRevisionCount: number;
}

interface NavItem {
  id: NavTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number | string;
}

const MOBILE_PRIMARY_TABS: ReadonlySet<NavTabId> = new Set([
  'dashboard',
  'library',
  'session',
  'revision',
]);

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isOpenMobile,
  onCloseMobile,
  onOpenMobileMenu,
  isDesktopOpen = true,
  onToggleDesktop,
  profile,
  dueRevisionCount,
}) => {
  const mobileDrawerRef = useRef<HTMLDivElement | null>(null);
  const mobileCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const closeMobileHandlerRef = useRef(onCloseMobile);
  const previousDesktopOpenRef = useRef(isDesktopOpen);
  closeMobileHandlerRef.current = onCloseMobile;

  useEffect(() => {
    if (previousDesktopOpenRef.current && !isDesktopOpen) {
      document
        .querySelector<HTMLButtonElement>('[data-sidebar-toggle="desktop"]')
        ?.focus();
    }
    previousDesktopOpenRef.current = isDesktopOpen;
  }, [isDesktopOpen]);

  // Attach modal Escape and focus-trap behavior synchronously with drawer commit.
  useLayoutEffect(() => {
    if (!isOpenMobile) return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    mobileCloseButtonRef.current?.focus();

    const handleDrawerKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMobileHandlerRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const drawer = mobileDrawerRef.current;
      if (!drawer) return;
      const focusable = Array.from(
        drawer.querySelectorAll<HTMLElement>(
          'button:not([disabled]):not([tabindex="-1"]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter(
        (element) =>
          element.getClientRects().length > 0 &&
          getComputedStyle(element).visibility !== 'hidden'
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleDrawerKeyDown);
    return () => {
      document.removeEventListener('keydown', handleDrawerKeyDown);
      if (previousFocusRef.current?.isConnected) {
        previousFocusRef.current.focus();
      }
      previousFocusRef.current = null;
    };
  }, [isOpenMobile]);

  const navGroups: { label: string; items: NavItem[] }[] = [
    {
      label: 'القراءة والورد',
      items: [
        { id: 'dashboard', label: 'الرئيسية', icon: Home },
        { id: 'library', label: 'القرآن والمصحف', icon: BookOpen },
      ],
    },
    {
      label: 'الحفظ والتثبيت',
      items: [
        { id: 'session', label: 'جلسة الحفظ', icon: Sparkles },
        { id: 'plans', label: 'خطط الحفظ', icon: Calendar },
        {
          id: 'revision',
          label: 'المراجعة',
          icon: Repeat,
          badge: dueRevisionCount > 0 ? dueRevisionCount : undefined,
        },
        { id: 'tests', label: 'اختبارات الحفظ', icon: CheckCircle },
      ],
    },
    {
      label: 'العبادة والمعرفة',
      items: [
        { id: 'progress', label: 'التقدم والإنجاز', icon: BarChart3 },
        { id: 'adhkar', label: 'الأذكار والأدعية', icon: Heart },
        { id: 'seerah', label: 'السيرة النبوية', icon: ScrollText },
        { id: 'ruqyah', label: 'الرقية الشرعية', icon: ShieldCheck },
        { id: 'advisor', label: 'المستشار القرآني', icon: Compass },
        { id: 'settings', label: 'الإعدادات', icon: Settings },
      ],
    },
  ];

  const handleSelect = (id: NavTabId) => {
    onSelectTab(id);
    onCloseMobile();
  };

  const sidebarContent = (
    <aside className="w-64 bg-[var(--wird-surface)] border-e border-[var(--wird-border)] flex flex-col h-full select-none transition-colors duration-150">
      {/* Brand Header */}
      <div className="px-4 py-3.5 border-b border-[var(--wird-border)] flex items-center justify-between gap-2">
        <WirdBrandLockup symbolSize={36} textSize="md" showSubtitle={true} />

        <div className="flex items-center gap-1 shrink-0">
          {onToggleDesktop && (
            <button
              type="button"
              onClick={onToggleDesktop}
              className="hidden lg:flex min-h-10 min-w-10 items-center justify-center rounded-[var(--wird-radius-control)] text-[var(--wird-muted)] hover:text-[var(--wird-text)] hover:bg-[var(--wird-surface-muted)] transition-colors wird-focus-ring"
              title="طي الشريط الجانبي (Ctrl+B / Cmd+B)"
              aria-label="إغلاق الشريط الجانبي"
              aria-expanded="true"
              aria-keyshortcuts="Control+B Meta+B"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {isOpenMobile && (
            <button
              type="button"
              ref={mobileCloseButtonRef}
              onClick={onCloseMobile}
              className="lg:hidden min-h-11 min-w-11 flex items-center justify-center rounded-[var(--wird-radius-control)] text-[var(--wird-muted)] hover:text-[var(--wird-text)] hover:bg-[var(--wird-surface-muted)] transition-colors wird-focus-ring"
              title="إغلاق القائمة"
              aria-label="إغلاق القائمة"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Grouped Navigation */}
      <nav
        aria-label="القائمة الرئيسية"
        className="flex-1 px-3 py-4 space-y-5 overflow-y-auto"
      >
        {navGroups.map((group) => (
          <div key={group.label} className="space-y-1">
            <p className="px-3 pb-1 text-[11px] font-semibold text-[var(--wird-muted)]">
              {group.label}
            </p>
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`w-full min-h-11 flex items-center justify-between px-3 py-2 rounded-[var(--wird-radius-control)] text-xs sm:text-[13px] font-semibold transition-colors duration-150 wird-focus-ring ${
                    isActive
                      ? 'wird-nav-indicator bg-[var(--wird-primary)] text-white'
                      : 'text-[var(--wird-text)] hover:bg-[var(--wird-surface-muted)]'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive
                          ? 'text-[var(--wird-accent)]'
                          : 'text-[var(--wird-muted)]'
                      }`}
                    />
                    <span className="truncate whitespace-nowrap">
                      {item.label}
                    </span>
                  </span>
                  {item.badge !== undefined && (
                    <span
                      className={`text-[11px] px-1.5 py-0.5 rounded-md font-bold wird-tabular font-mono ${
                        isActive
                          ? 'bg-[var(--wird-accent)] text-[#0C1412]'
                          : 'text-[var(--wird-primary)] dark:text-[var(--wird-accent)]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Quiet User Profile Footer */}
      <div className="px-3.5 py-3 border-t border-[var(--wird-border)]">
        <button
          type="button"
          onClick={() => handleSelect('settings')}
          className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-[var(--wird-radius-control)] hover:bg-[var(--wird-surface-muted)] transition-colors text-right wird-focus-ring"
        >
          <WirdAvatar size="sm" shape="circle" variant="primary" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-[var(--wird-text)] truncate">
              {profile.name}
            </div>
            <div className="text-[11px] text-[var(--wird-muted)] truncate">
              {profile.memorizationGoal || 'طالب حفظ ومراجعة'}
            </div>
          </div>
        </button>
      </div>
    </aside>
  );

  const isSecondaryMobileTab = !MOBILE_PRIMARY_TABS.has(currentTab);

  return (
    <>
      {/* Desktop Sidebar (Collapsible with smooth width transition) */}
      <div
        aria-hidden={!isDesktopOpen}
        className={`hidden lg:block shrink-0 h-screen sticky top-0 transition-all duration-200 ease-out ${
          isDesktopOpen
            ? 'w-64 opacity-100'
            : 'w-0 opacity-0 pointer-events-none overflow-hidden'
        }`}
      >
        {sidebarContent}
      </div>

      {/* Mobile Drawer (Overlay) */}
      {isOpenMobile && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            aria-hidden="true"
            className="fixed inset-0 bg-black/55 backdrop-blur-[2px] transition-opacity"
            onClick={onCloseMobile}
          />
          <div
            ref={mobileDrawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="قائمة الأقسام"
            className="relative z-10 w-72 max-w-[85vw] h-full shadow-2xl"
          >
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Mobile Bottom Thumb-Zone Bar (Hidden in distraction-free memorization session) */}
      {currentTab !== 'session' && (
        <nav className="wird-mobile-nav lg:hidden" aria-label="التنقل السريع">
          {[
            { id: 'dashboard' as NavTabId, label: 'الرئيسية', icon: Home },
            { id: 'library' as NavTabId, label: 'المصحف', icon: BookOpen },
            { id: 'session' as NavTabId, label: 'الحفظ', icon: Sparkles },
            { id: 'revision' as NavTabId, label: 'المراجعة', icon: Repeat },
          ].map((item) => {
            const Icon = item.icon;
            const active = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                aria-current={active ? 'page' : undefined}
                className={
                  active
                    ? 'wird-mobile-nav__item is-active'
                    : 'wird-mobile-nav__item'
                }
              >
                <Icon className="h-[19px] w-[19px]" />
                <span className="truncate">{item.label}</span>
                {item.id === 'revision' && dueRevisionCount > 0 && (
                  <span className="wird-mobile-nav__badge">
                    {dueRevisionCount}
                  </span>
                )}
              </button>
            );
          })}
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="المزيد من الأقسام"
            aria-expanded={isOpenMobile}
            aria-current={isSecondaryMobileTab ? 'page' : undefined}
            className={
              isSecondaryMobileTab
                ? 'wird-mobile-nav__item is-active'
                : 'wird-mobile-nav__item'
            }
          >
            <MoreHorizontal className="h-[19px] w-[19px]" />
            <span>المزيد</span>
          </button>
        </nav>
      )}
    </>
  );
};
