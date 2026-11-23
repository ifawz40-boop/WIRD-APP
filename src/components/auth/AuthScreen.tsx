import React, { useEffect, useRef, useState } from 'react';
import { 
  BookOpen, 
  Mail, 
  Lock, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  UserCheck, 
  KeyRound, 
  LogOut, 
  Sparkles,
  Loader2,
  Copy,
  Check,
  Sun,
  Moon
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { WirdBrandLockup } from '../brand/WirdLogo';
import { WirdAvatar } from '../brand/WirdAvatar';
import { WirdIslamicPattern } from '../brand/WirdPattern';
import {
  applyThemePreferencesToDocument,
  loadSavedAppearanceMode,
  loadThemePreferences,
  saveThemePreferences,
  type WirdAppearanceMode,
  type WirdDesignId,
} from '../../services/themePreferences';

export const AuthScreen: React.FC = () => {
  const { 
    user, 
    isEmailVerified, 
    lastVerificationSent,
    authError, 
    isFirebaseReady,
    loginWithGoogle, 
    signUpWithEmail, 
    loginWithEmail, 
    resendVerificationEmail, 
    checkVerificationStatus, 
    sendPasswordReset, 
    logout, 
    continueAsGuest,
    clearError
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isCopiedDomain, setIsCopiedDomain] = useState(false);
  const [designId, setDesignId] = useState<WirdDesignId>(() => loadThemePreferences().design);
  const [appearanceMode, setAppearanceMode] = useState<WirdAppearanceMode>(() => loadSavedAppearanceMode('light'));
  const copyDomainTimerRef = useRef<number | null>(null);
  const resendIntervalRef = useRef<number | null>(null);

  const handleSelectAuthDesign = (nextDesign: WirdDesignId) => {
    setDesignId(nextDesign);
    const updated = saveThemePreferences({ design: nextDesign, preset: nextDesign });
    applyThemePreferencesToDocument(updated, appearanceMode);
  };

  const handleToggleAuthMode = () => {
    const nextMode: WirdAppearanceMode = appearanceMode === 'dark' ? 'light' : 'dark';
    setAppearanceMode(nextMode);
    applyThemePreferencesToDocument(loadThemePreferences(), nextMode);
  };

  useEffect(() => {
    return () => {
      if (copyDomainTimerRef.current !== null) window.clearTimeout(copyDomainTimerRef.current);
      if (resendIntervalRef.current !== null) window.clearInterval(resendIntervalRef.current);
    };
  }, []);

  const handleCopyDomain = () => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      navigator.clipboard?.writeText(hostname);
      if (copyDomainTimerRef.current !== null) window.clearTimeout(copyDomainTimerRef.current);
      setIsCopiedDomain(true);
      copyDomainTimerRef.current = window.setTimeout(() => {
        setIsCopiedDomain(false);
        copyDomainTimerRef.current = null;
      }, 2500);
    }
  };

  // If user is logged in via email/password but not yet verified
  const needsEmailVerification = Boolean(user && !isEmailVerified);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setSuccessMessage(null);

    if (mode === 'register') {
      if (password !== confirmPassword) {
        return;
      }
      if (password.length < 6) {
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
      } else if (mode === 'register') {
        await signUpWithEmail(email, password);
      } else if (mode === 'forgot') {
        await sendPasswordReset(email);
        setSuccessMessage('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني بنجاح.');
      }
    } catch (err) {
      // Error handled by context
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    clearError();
    setSuccessMessage(null);
    setIsSubmitting(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      // Error handled by context
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendEmail = async () => {
    if (resendCooldown > 0) return;
    setIsSubmitting(true);
    try {
      await resendVerificationEmail();
      setSuccessMessage('تم إرسال رابط التفعيل مجدداً إلى بريدك الإلكتروني.');
      setResendCooldown(60);
      if (resendIntervalRef.current !== null) window.clearInterval(resendIntervalRef.current);
      resendIntervalRef.current = window.setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            if (resendIntervalRef.current !== null) {
              window.clearInterval(resendIntervalRef.current);
              resendIntervalRef.current = null;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      // Error handled
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecheckStatus = async () => {
    setIsCheckingStatus(true);
    setSuccessMessage(null);
    try {
      const verified = await checkVerificationStatus();
      if (verified) {
        setSuccessMessage('تم التحقق من تفعيل البريد الإلكتروني بنجاح! يمكنك الآن الاستفادة من كافة الميزات.');
      } else {
        setSuccessMessage('لم يتم تفعيل البريد الإلكتروني بعد. يرجى الضغط على الرابط المرسل إلى صندوق الوارد.');
      }
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // If logged in but email verification is pending
  if (needsEmailVerification) {
    return (
      <div dir="rtl" className="min-h-screen bg-[var(--wird-surface-muted)] flex flex-col items-center justify-center p-4 font-cairo">
        <div className="w-full max-w-md bg-[var(--wird-surface)] rounded-3xl p-8 shadow-xl border border-[var(--wird-border)] space-y-6">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 bg-[var(--wird-accent-soft)] text-[var(--wird-accent)] rounded-2xl flex items-center justify-center mx-auto border border-[#C59B27]/35">
              <Mail className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--wird-text)] font-quran">
              تأكيد البريد الإلكتروني مطلوب
            </h2>
            {lastVerificationSent === false ? (
              <p className="text-xs text-rose-600 dark:text-rose-400 font-bold leading-relaxed bg-rose-50 dark:bg-rose-950/60 p-2.5 rounded-xl border border-rose-200 dark:border-rose-800">
                تعذر إرسال بريد التفعيل تلقائياً عند التسجيل. يرجى الضغط على "إعادة إرسال رسالة التفعيل" أدناه.
              </p>
            ) : lastVerificationSent === true ? (
              <p className="text-xs text-[var(--wird-muted)] leading-relaxed">
                تم إرسال رسالة تأكيد إلى البريد الإلكتروني:
              </p>
            ) : (
              <p className="text-xs text-[var(--wird-muted)] leading-relaxed">
                حسابك بانتظار التفعيل. يمكنك إرسال رسالة التأكيد بالضغط على الزر أدناه:
              </p>
            )}
            <div dir="ltr" className="font-mono text-sm font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] bg-[var(--wird-surface-muted)] py-2 px-3 rounded-xl border border-[#C59B27]/30 text-center">
              {user?.email}
            </div>
          </div>

          {successMessage && (
            <div className="p-3.5 bg-[var(--wird-primary)]/12 dark:bg-[var(--wird-primary)]/40 border border-[var(--wird-border)] dark:border-[#6EE7B7]/30 text-[var(--wird-primary)] dark:text-emerald-300 text-xs rounded-xl flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[var(--wird-primary)] dark:text-emerald-300 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {authError && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs rounded-xl flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          <div className="space-y-3 pt-2">
            <button
              onClick={handleRecheckStatus}
              disabled={isCheckingStatus}
              className="w-full min-h-11 py-3 bg-[var(--wird-primary)] hover:bg-[var(--wird-primary-hover)] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isCheckingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span>تحديث وحالة التفعيل</span>
            </button>

            <button
              onClick={handleResendEmail}
              disabled={isSubmitting || resendCooldown > 0}
              className="w-full min-h-11 py-3 bg-[var(--wird-surface-muted)] hover:bg-[var(--wird-surface-muted)] dark:hover:bg-[#1d345c] text-[var(--wird-text)] border border-[var(--wird-border)] rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {resendCooldown > 0 ? `إعادة الإرسال خلال (${resendCooldown}ث)` : 'إعادة إرسال رسالة التفعيل'}
            </button>
          </div>

          <div className="pt-4 border-t border-[var(--wird-border)] flex items-center justify-between text-xs">
            <button
              onClick={continueAsGuest}
              className="text-[var(--wird-primary)] dark:text-[var(--wird-accent)] font-bold hover:underline flex items-center gap-1"
            >
              <span>المتابعة كزائر مؤقتاً</span>
              <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            </button>

            <button
              onClick={() => logout()}
              className="text-[var(--wird-muted)] hover:text-rose-600 dark:text-[#8B9E9B] flex items-center gap-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="wird-app-shell relative min-h-screen flex flex-col items-center justify-center p-4 font-cairo overflow-hidden transition-colors">
      {/* Subtle Islamic Geometry Background Watermark */}
      <WirdIslamicPattern opacity={0.04} variant="gold" />

      {/* Compact Four-Variant Quick Switcher */}
      <div className="relative z-10 w-full max-w-md mb-3 flex items-center justify-between gap-2">
        <div
          role="group"
          aria-label="اختيار التصميم"
          className="inline-flex items-center gap-1 p-1 rounded-xl bg-[var(--wird-surface)] border border-[var(--wird-border)] shadow-2xs"
        >
          {(['design-a', 'design-b'] as const).map((id) => {
            const active = designId === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleSelectAuthDesign(id)}
                aria-pressed={active}
                className={`min-h-8 px-2.5 rounded-lg text-[11px] font-bold transition-colors wird-focus-ring ${
                  active
                    ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)]'
                    : 'text-[var(--wird-muted)] hover:text-[var(--wird-text)]'
                }`}
              >
                {id === 'design-a' ? 'التصميم A' : 'التصميم B'}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleToggleAuthMode}
          aria-label="تبديل المظهر النهاري والليلي"
          className="min-h-10 px-3 rounded-xl bg-[var(--wird-surface)] border border-[var(--wird-border)] text-xs font-bold text-[var(--wird-text)] hover:border-[var(--wird-border-strong)] inline-flex items-center gap-1.5 shadow-2xs transition-colors wird-focus-ring"
        >
          {appearanceMode === 'dark' ? (
            <>
              <Sun className="w-3.5 h-3.5 text-[var(--wird-accent)]" />
              <span>نهاري</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
              <span>ليلي</span>
            </>
          )}
        </button>
      </div>

      <div className="relative z-10 w-full max-w-md bg-[var(--wird-surface)]/95 backdrop-blur-xl rounded-[var(--wird-radius-card)] p-6 sm:p-7 shadow-xl border border-[var(--wird-border)] space-y-5">
        
        {/* Brand Header */}
        <div className="text-center pt-1">
          <WirdBrandLockup symbolSize={54} textSize="lg" layout="vertical" showSubtitle={true} />
        </div>

        {/* Firebase Config Notice Banner */}
        {!isFirebaseReady && (
          <div dir="rtl" className="p-4 bg-[var(--wird-surface-muted)] border border-[var(--wird-border-gold)] rounded-2xl text-[var(--wird-text)] text-xs space-y-2.5">
            <div className="flex items-center gap-2 font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
              <AlertCircle className="w-4 h-4 text-[var(--wird-accent)] shrink-0" />
              <span>تنبيه: مفاتيح Firebase غير مهيأة بعد</span>
            </div>
            <p className="text-[11px] leading-relaxed text-[var(--wird-muted)]">
              يتطلب تسجيل الدخول السحابي ضبط متغيرات البيئة (VITE_FIREBASE_*). يمكنك المتابعة الآن مباشرة كزائر بدون عائق وبكامل الميزات محلياً.
            </p>
            <button
              type="button"
              onClick={continueAsGuest}
              className="w-full min-h-11 py-2.5 bg-[var(--wird-accent)] hover:bg-[var(--wird-accent-hover)] text-[var(--wird-accent-ink)] rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>المتابعة السريعة كزائر (Guest Mode)</span>
            </button>
          </div>
        )}

        {/* Crisp 3-Mode Tab Switcher */}
        <div role="group" aria-label="أوضاع بوابة الدخول" className="grid grid-cols-3 bg-[var(--wird-surface-muted)] p-1 rounded-2xl border border-[var(--wird-border)] text-[11px] sm:text-xs font-bold gap-1">
          <button
            type="button"
            aria-pressed={mode === 'login'}
            onClick={() => { setMode('login'); clearError(); setSuccessMessage(null); }}
            className={`min-h-11 py-2 px-2 rounded-xl transition-all ${
              mode === 'login'
                ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] shadow-xs ring-1 ring-[#C59B27]/40'
                : 'text-[var(--wird-muted)] hover:text-[var(--wird-text)] dark:text-[#8B9E9B] dark:hover:text-[#F5F1E8]'
            }`}
          >
            تسجيل الدخول
          </button>
          <button
            type="button"
            aria-pressed={mode === 'register'}
            onClick={() => { setMode('register'); clearError(); setSuccessMessage(null); }}
            className={`min-h-11 py-2 px-2 rounded-xl transition-all ${
              mode === 'register'
                ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] shadow-xs ring-1 ring-[#C59B27]/40'
                : 'text-[var(--wird-muted)] hover:text-[var(--wird-text)] dark:text-[#8B9E9B] dark:hover:text-[#F5F1E8]'
            }`}
          >
            حساب جديد
          </button>
          <button
            type="button"
            aria-pressed={mode === 'forgot'}
            onClick={() => { setMode('forgot'); clearError(); setSuccessMessage(null); }}
            className={`min-h-11 py-2 px-2 rounded-xl transition-all ${
              mode === 'forgot'
                ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] shadow-xs ring-1 ring-[#C59B27]/40'
                : 'text-[var(--wird-muted)] hover:text-[var(--wird-text)] dark:text-[#8B9E9B] dark:hover:text-[#F5F1E8]'
            }`}
          >
            استعادة كلمة المرور
          </button>
        </div>

        {/* Error Feedback */}
        {authError && (authError.includes('unauthorized-domain') || authError.includes('غير مصرح') || authError.includes('unauthorized')) ? (
          <div dir="rtl" className="p-4 bg-[#C59B27]/12 dark:bg-[#E0A96D]/12 border border-[var(--wird-border-gold)] rounded-2xl text-[var(--wird-text)] text-xs space-y-3 shadow-xs">
            <div className="flex items-center gap-2 font-bold text-[var(--wird-accent-hover)] dark:text-[var(--wird-accent)]">
              <AlertCircle className="w-4 h-4 text-[var(--wird-accent)] shrink-0" />
              <span>هذا النطاق غير مصرح به في Firebase</span>
            </div>
            
            <p className="text-[11px] leading-relaxed text-[var(--wird-muted)]">
              يتطلب Firebase Authentication إضافة نطاق الموقع الحالي إلى القائمة المسموح بها (Authorized Domains) في لوحة التحكم.
            </p>

            {/* Domain Box with 1-click Copy */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[var(--wird-muted)] block">
                نطاق الموقع الحالي المطلوب إضافته:
              </label>
              <div className="flex items-center gap-2 bg-[var(--wird-surface)] p-2 rounded-xl border border-[var(--wird-border-gold)]">
                <code dir="ltr" className="flex-1 font-mono text-[11px] text-[var(--wird-primary)] dark:text-[var(--wird-accent)] truncate text-left px-1">
                  {typeof window !== 'undefined' ? window.location.hostname : ''}
                </code>
                <button
                  type="button"
                  onClick={handleCopyDomain}
                  className="px-2.5 py-1 bg-[var(--wird-accent)] hover:bg-[var(--wird-accent-hover)] text-[var(--wird-accent-ink)] rounded-lg text-[11px] font-bold flex items-center gap-1 shrink-0 transition-colors"
                >
                  {isCopiedDomain ? (
                    <>
                      <Check className="w-3 h-3" />
                      <span>تم النسخ!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>نسخ النطاق</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Instruction Steps */}
            <div className="text-[10px] text-[var(--wird-text)] bg-[var(--wird-surface-muted)] p-2.5 rounded-xl border border-[var(--wird-border-gold)] leading-relaxed space-y-1">
              <div className="font-bold text-[var(--wird-text)] dark:text-[var(--wird-accent)]">خطوات إضافة النطاق في Firebase:</div>
              <div>1. افتح Firebase Console ← مشروعك</div>
              <div>2. اذهب إلى Authentication ← Settings ← Authorized Domains</div>
              <div>3. انقر "Add Domain" وألصق النطاق المنسوخ أعلاه</div>
            </div>

            {/* Instant Guest Mode Fallback */}
            <button
              type="button"
              onClick={continueAsGuest}
              className="w-full py-2.5 bg-[var(--wird-primary)] hover:bg-[var(--wird-primary-hover)] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-[#E0A96D]" />
              <span>المتابعة فوراً كزائر دون انتظار (Guest Mode)</span>
            </button>
          </div>
        ) : authError ? (
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs rounded-xl flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">{authError}</div>
          </div>
        ) : null}

        {/* Success Feedback */}
        {successMessage && (
          <div className="p-3.5 bg-[var(--wird-primary)]/12 dark:bg-[var(--wird-primary)]/40 border border-[var(--wird-border)] dark:border-[#6EE7B7]/30 text-[var(--wird-primary)] dark:text-emerald-300 text-xs rounded-xl flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[var(--wird-primary)] dark:text-emerald-300 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">{successMessage}</div>
          </div>
        )}

        {/* Google Provider Button */}
        {mode !== 'forgot' && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isSubmitting}
              className="w-full min-h-11 py-3 px-4 bg-[var(--wird-surface)] hover:bg-[var(--wird-surface-muted)] text-[var(--wird-text)] border border-[var(--wird-border)] rounded-2xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>المتابعة عبر حساب Google</span>
            </button>

            <div className="flex items-center gap-3 my-2">
              <div className="flex-1 h-px bg-[var(--wird-border)]" />
              <span className="text-[11px] text-[var(--wird-muted)]">أو بالبريد الإلكتروني</span>
              <div className="flex-1 h-px bg-[var(--wird-border)]" />
            </div>
          </div>
        )}

        {/* Email & Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[var(--wird-text)] block">
              البريد الإلكتروني
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[var(--wird-muted)] absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                dir="ltr"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@domain.com"
                className="w-full min-h-11 pr-10 pl-4 py-2.5 bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] rounded-xl text-xs text-[var(--wird-text)] focus:outline-none focus:border-[var(--wird-accent)] transition-colors text-right"
              />
            </div>
          </div>

          {mode !== 'forgot' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[var(--wird-text)] block">
                  كلمة المرور
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); clearError(); setSuccessMessage(null); }}
                    className="text-[11px] text-[var(--wird-primary)] dark:text-[var(--wird-accent)] hover:underline font-medium"
                  >
                    نسيت كلمة المرور؟
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[var(--wird-muted)] absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  dir="ltr"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full min-h-11 pr-10 pl-4 py-2.5 bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] rounded-xl text-xs text-[var(--wird-text)] focus:outline-none focus:border-[var(--wird-accent)] transition-colors text-right"
                />
              </div>
            </div>
          )}

          {mode === 'register' && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--wird-text)] block">
                تأكيد كلمة المرور
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[var(--wird-muted)] absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  dir="ltr"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full min-h-11 pr-10 pl-4 py-2.5 bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] rounded-xl text-xs text-[var(--wird-text)] focus:outline-none focus:border-[var(--wird-accent)] transition-colors text-right"
                />
              </div>
              {password && confirmPassword && password !== confirmPassword && (
                <p className="text-[11px] text-rose-600 mt-1">كلمتا المرور غير متطابقتين.</p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || (mode === 'register' && password !== confirmPassword)}
            className="w-full min-h-11 py-3 bg-[var(--wird-primary)] hover:bg-[var(--wird-primary-hover)] text-white rounded-2xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 ring-1 ring-[var(--wird-border-gold)]"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : mode === 'login' ? (
              <span>تسجيل الدخول</span>
            ) : mode === 'register' ? (
              <span>إنشاء الحساب والتفعيل</span>
            ) : (
              <span>إرسال رابط استعادة كلمة المرور</span>
            )}
          </button>
        </form>

        {/* Continue as Guest CTA - Critical Protected Flow */}
        <div className="pt-4 border-t border-[var(--wird-border)] space-y-2">
          <button
            type="button"
            onClick={continueAsGuest}
            className="w-full min-h-11 py-3 bg-[var(--wird-surface-muted)] hover:bg-[var(--wird-surface-muted)] text-[var(--wird-text)] border border-[var(--wird-border-gold)] rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 group shadow-2xs"
          >
            <Sparkles className="w-4 h-4 text-[var(--wird-accent)] group-hover:rotate-12 transition-transform" />
            <span>المتابعة كزائر دون تسجيل حساب</span>
            <ArrowRight className="w-3.5 h-3.5 rotate-180 text-[var(--wird-accent)]" />
          </button>
          <p className="text-[10px] text-center text-[var(--wird-muted)] leading-normal">
            تتيح لك تجربة الزائر الوصول التام لكافة سور المصحف الشريف والخطط وجلسات الحفظ والتكرار المتباعد محلياً دون الحاجة لتسجيل حساب.
          </p>
        </div>

      </div>
    </div>
  );
};
