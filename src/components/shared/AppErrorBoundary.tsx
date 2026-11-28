import React from 'react';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';
import { WirdButton } from '../ui/WirdPrimitives';

interface AppErrorBoundaryProps {
  children: React.ReactNode;
  resetKey?: string;
  onGoHome?: () => void;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  isModuleLoadError: boolean;
}

const STALE_MODULE_RELOAD_KEY = 'wird:stale-module-reload-at';
const STALE_MODULE_RELOAD_COOLDOWN_MS = 15_000;

function isStaleModuleError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  return (
    message.includes('does not provide an export named') ||
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed') ||
    message.includes('ChunkLoadError')
  );
}

function tryGuardedModuleReload(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const lastReloadRaw = window.sessionStorage.getItem(STALE_MODULE_RELOAD_KEY);
    const lastReloadAt = lastReloadRaw ? Number(lastReloadRaw) : 0;
    const now = Date.now();
    if (Number.isFinite(lastReloadAt) && now - lastReloadAt < STALE_MODULE_RELOAD_COOLDOWN_MS) {
      return false;
    }
    window.sessionStorage.setItem(STALE_MODULE_RELOAD_KEY, String(now));
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}

export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  public state: AppErrorBoundaryState = { hasError: false, isModuleLoadError: false };

  public static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return { hasError: true, isModuleLoadError: isStaleModuleError(error) };
  }

  public componentDidCatch(error: unknown): void {
    console.error('[WIRD ErrorBoundary] View failed to render:', error);
    if (isStaleModuleError(error)) {
      tryGuardedModuleReload();
    }
  }

  public componentDidUpdate(prevProps: AppErrorBoundaryProps): void {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, isModuleLoadError: false });
    }
  }

  private handleRetry = (): void => {
    if (this.state.isModuleLoadError && typeof window !== 'undefined') {
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, isModuleLoadError: false });
  };

  private handleGoHome = (): void => {
    this.setState({ hasError: false, isModuleLoadError: false });
    this.props.onGoHome?.();
  };

  public render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        role="alert"
        dir="rtl"
        className="wird-surface-editorial mx-auto my-12 max-w-md p-6 sm:p-8 text-center space-y-5"
      >
        <div className="w-12 h-12 mx-auto rounded-2xl bg-[var(--wird-accent-soft)] text-[var(--wird-accent)] flex items-center justify-center">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="space-y-2">
          <h2 className="text-base sm:text-lg font-bold text-[var(--wird-text)] wird-headline-balance">
            تعذر عرض هذا القسم مؤقتاً
          </h2>
          <p className="text-xs leading-relaxed text-[var(--wird-muted)]">
            حدث عارض غير متوقع أثناء عرض الصفحة. جميع بياناتك وسجلات حفظك محفوظة بأمان، ويمكنك إعادة المحاولة أو العودة إلى الرئيسية.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
          <WirdButton variant="primary" size="md" onClick={this.handleRetry}>
            <RotateCcw className="w-4 h-4" />
            <span>إعادة المحاولة</span>
          </WirdButton>
          <WirdButton variant="secondary" size="md" onClick={this.handleGoHome}>
            <Home className="w-4 h-4 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
            <span>العودة إلى الرئيسية</span>
          </WirdButton>
        </div>
      </div>
    );
  }
}
