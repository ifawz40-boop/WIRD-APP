import React from 'react';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';

interface RouteErrorBoundaryProps {
  children: React.ReactNode;
  resetKey: string;
  onGoHome: () => void;
}

interface RouteErrorBoundaryState {
  hasError: boolean;
}

export class RouteErrorBoundary extends React.Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  state: RouteErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): RouteErrorBoundaryState {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: RouteErrorBoundaryProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  componentDidCatch(error: Error) {
    console.error('[WIRD Route Error]:', error.message);
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        dir="rtl"
        role="alert"
        className="wird-card max-w-lg mx-auto my-12 p-6 sm:p-8 text-center space-y-5 border border-[#C59B27]/35 dark:border-[#E0A96D]/30"
      >
        <div className="w-12 h-12 rounded-2xl bg-[#C59B27]/15 dark:bg-[#E0A96D]/15 text-[#C59B27] dark:text-[#E0A96D] flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-[#142421] dark:text-[#F5F1E8] font-quran">
            تعذر عرض هذا القسم مؤقتاً
          </h2>
          <p className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B] leading-relaxed">
            بياناتك ومحفوظاتك محفوظة بأمان. يمكنك إعادة محاولة فتح القسم أو العودة إلى الشاشة الرئيسية.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          <button
            type="button"
            onClick={this.handleRetry}
            className="wird-btn-primary min-h-11 px-4 py-2.5 text-xs inline-flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>إعادة المحاولة</span>
          </button>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false });
              this.props.onGoHome();
            }}
            className="min-h-11 px-4 py-2.5 text-xs font-bold rounded-xl border border-[#1C4E46]/20 dark:border-[#E0A96D]/25 text-[#142421] dark:text-[#F5F1E8] hover:bg-[#F2EDE2] dark:hover:bg-[#162744] inline-flex items-center gap-2 transition-colors"
          >
            <Home className="w-4 h-4 text-[#C59B27] dark:text-[#E0A96D]" />
            <span>العودة للرئيسية</span>
          </button>
        </div>
      </div>
    );
  }
}
