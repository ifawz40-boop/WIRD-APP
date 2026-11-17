import React from 'react';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';

interface AppErrorBoundaryProps {
  children: React.ReactNode;
  resetKey?: string;
  onGoHome?: () => void;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  public state: AppErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: unknown): void {
    console.error('[WIRD ErrorBoundary] View failed to render:', error);
  }

  public componentDidUpdate(prevProps: AppErrorBoundaryProps): void {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  private handleGoHome = (): void => {
    this.setState({ hasError: false });
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
        className="wird-card mx-auto my-12 max-w-md p-6 sm:p-8 text-center space-y-5 border border-[#C59B27]/40 dark:border-[#E0A96D]/35"
      >
        <div className="w-14 h-14 mx-auto rounded-2xl bg-[#C59B27]/15 dark:bg-[#E0A96D]/15 text-[#C59B27] dark:text-[#E0A96D] flex items-center justify-center">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-bold font-quran text-[#142421] dark:text-[#F5F1E8]">
            تعذر عرض هذا القسم مؤقتاً
          </h2>
          <p className="text-xs leading-relaxed text-[#5B6F6B] dark:text-[#8B9E9B]">
            حدث عارض أثناء تحميل الصفحة. جميع بياناتك وسجلات حفظك محفوظة بأمان، ويمكنك إعادة المحاولة أو العودة إلى الرئيسية.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          <button
            type="button"
            onClick={this.handleRetry}
            className="wird-btn-primary min-h-11 px-5 py-2.5 text-xs inline-flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>إعادة المحاولة</span>
          </button>
          <button
            type="button"
            onClick={this.handleGoHome}
            className="min-h-11 px-4 py-2.5 text-xs font-bold rounded-xl border border-[#1C4E46]/20 dark:border-[#E0A96D]/25 bg-[#F9F6EE] dark:bg-[#0B132B] text-[#142421] dark:text-[#F5F1E8] hover:border-[#C59B27] inline-flex items-center gap-2 transition-colors"
          >
            <Home className="w-4 h-4 text-[#1C4E46] dark:text-[#E0A96D]" />
            <span>العودة إلى الرئيسية</span>
          </button>
        </div>
      </div>
    );
  }
}
