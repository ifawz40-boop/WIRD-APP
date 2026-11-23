import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { StorageService } from '../../services/storageService';
import { replayJournalProjection } from '../../services/journalProjectionReplayer';
import { migrateLegacyPortionsJournaled } from '../../services/backupPersistence';
import { initializeEnginePlansArchiveForScope } from '../../services/enginePlanArchive';
import { AuthScreen } from './AuthScreen';
import { WirdAvatar } from '../brand/WirdAvatar';
import { WirdBrandLockup } from '../brand/WirdLogo';

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, isGuest, isEmailVerified } = useAuth();
  const storageScope = isGuest ? 'guest' : user && isEmailVerified ? `user:${user.uid}` : null;
  const [readyScope, setReadyScope] = useState<string | null>(null);
  const [scopeError, setScopeError] = useState(false);
  const [scopeErrorMessage, setScopeErrorMessage] = useState('');
  const [legacyDecisionScope, setLegacyDecisionScope] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!storageScope) {
      setReadyScope(null);
      setScopeError(false);
      setScopeErrorMessage('');
      setLegacyDecisionScope(null);
      return;
    }

    setReadyScope(null);
    setScopeError(false);
    setScopeErrorMessage('');
    setLegacyDecisionScope(null);

    const initializeScopedStorage = async () => {
      try {
        if (StorageService.needsLegacyDataDecision(storageScope)) {
          if (!cancelled) setLegacyDecisionScope(storageScope);
          return;
        }
        const success = StorageService.setStorageScope(storageScope);
        if (!success) throw new Error('تعذر تثبيت نطاق التخزين الخاص بالحساب.');
        if (typeof indexedDB !== 'undefined') {
          await initializeEnginePlansArchiveForScope(storageScope);
        }
        if (cancelled || StorageService.getStorageScope() !== storageScope) return;
        if (storageScope.startsWith('user:')) {
          await replayJournalProjection();
        }
        if (cancelled || StorageService.getStorageScope() !== storageScope) return;
        const migration = await migrateLegacyPortionsJournaled();
        if (!migration.success) throw new Error(migration.message);
        if (!cancelled && StorageService.getStorageScope() === storageScope) {
          setReadyScope(storageScope);
        }
      } catch (error) {
        if (!cancelled) {
          setScopeErrorMessage(error instanceof Error ? error.message : 'خطأ غير معروف أثناء استعادة سجل الحساب.');
          setScopeError(true);
        }
      }
    };

    void initializeScopedStorage();
    return () => { cancelled = true; };
  }, [storageScope, retryToken]);

  const handleLegacyDataChoice = async (choice: 'import' | 'keep-guest') => {
    if (!legacyDecisionScope) return;
    const targetScope = legacyDecisionScope;
    const success = StorageService.setStorageScope(targetScope, choice);
    if (!success) {
      setLegacyDecisionScope(null);
      setScopeErrorMessage('تعذر نقل البيانات القديمة بأمان؛ لم يتم حذف المصدر.');
      setScopeError(true);
      return;
    }
    setLegacyDecisionScope(null);
    setScopeError(false);
    setScopeErrorMessage('');
    try {
      if (typeof indexedDB !== 'undefined') {
        await initializeEnginePlansArchiveForScope(targetScope);
      }
      if (StorageService.getStorageScope() !== targetScope) return;
      if (targetScope.startsWith('user:')) await replayJournalProjection();
      if (StorageService.getStorageScope() !== targetScope) return;
      const migration = await migrateLegacyPortionsJournaled();
      if (!migration.success) throw new Error(migration.message);
      if (StorageService.getStorageScope() === targetScope) setReadyScope(targetScope);
    } catch (error) {
      setScopeErrorMessage(error instanceof Error ? error.message : 'تعذر استعادة سجل المزامنة المحلي.');
      setScopeError(true);
    }
  };

  // 1. Loading state during auth initialization
  if (loading) {
    return (
      <div dir="rtl" className="min-h-screen bg-[var(--wird-surface-muted)] flex flex-col items-center justify-center p-4 font-cairo">
        <div className="flex flex-col items-center space-y-5 text-center">
          <WirdAvatar size="xl" shape="squircle" variant="primary" withGlow={true} />
          <div className="flex flex-col items-center space-y-1.5">
            <h1 className="text-xl font-bold font-quran text-[var(--wird-text)]">منصة وِرد | WIRD</h1>
            <div className="flex items-center gap-2 text-[var(--wird-muted)] text-xs font-semibold">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--wird-accent)]" />
              <span>جاري تهيئة المنصة القرآنية...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. Ensure local data is isolated/migrated before mounting the application.
  // Existing unscoped data must be explicitly assigned to this account or kept in guest mode.
  if (storageScope && legacyDecisionScope === storageScope) {
    return (
      <div dir="rtl" className="min-h-screen bg-[var(--wird-surface-muted)] flex items-center justify-center p-4 font-cairo">
        <div className="max-w-lg rounded-2xl border border-[var(--wird-border-gold)] bg-[var(--wird-surface)] p-6 text-center shadow-xs">
          <h2 className="text-lg font-bold text-[var(--wird-text)]">بيانات محفوظة على هذا الجهاز</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--wird-muted)]">
            وجدنا تقدماً سابقاً محفوظاً قبل فصل بيانات الحسابات. هل تريد نقله إلى حسابك الحالي، أم بدء حساب فارغ مع الاحتفاظ بالبيانات السابقة في وضع الزائر؟ لن نحذف بياناتك دون اختيارك.
          </p>
          <div className="mt-5 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => handleLegacyDataChoice('import')}
              className="min-h-11 rounded-xl bg-[var(--wird-primary)] px-5 py-3 text-sm font-bold text-white hover:bg-[var(--wird-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wird-ring)]"
            >
              نقل البيانات إلى حسابي
            </button>
            <button
              type="button"
              onClick={() => handleLegacyDataChoice('keep-guest')}
              className="min-h-11 rounded-xl border border-[var(--wird-border)] px-5 py-3 text-sm font-bold text-[var(--wird-text)] hover:bg-[var(--wird-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wird-ring)]"
            >
              بدء حساب فارغ والاحتفاظ بها كضيف
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (storageScope && scopeError) {
    return (
      <div dir="rtl" className="min-h-screen bg-[var(--wird-surface-muted)] flex items-center justify-center p-4 font-cairo">
        <div className="max-w-md rounded-2xl border border-rose-200 dark:border-rose-900 bg-[var(--wird-surface)] p-6 text-center shadow-sm">
          <h2 className="text-lg font-bold text-[var(--wird-text)]">تعذر تجهيز مساحة بيانات الحساب</h2>
          <p className="mt-2 text-sm leading-7 text-[var(--wird-muted)]">
            لم نتمكن من تجهيز أو استعادة بيانات هذا الحساب بأمان. لم نعرض بيانات حساب آخر ولم نحذف السجل الأصلي، ولم نتجاوز أي حدث غير مستعاد. {scopeErrorMessage || 'حاول مرة أخرى بعد التأكد من توفر مساحة التخزين.'}
          </p>
          <button
            type="button"
            onClick={() => setRetryToken(value => value + 1)}
            className="mt-4 min-h-11 rounded-xl bg-[var(--wird-primary)] px-5 py-3 text-sm font-bold text-white hover:bg-[var(--wird-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wird-ring)]"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  if (storageScope && readyScope !== storageScope) {
    return (
      <div dir="rtl" className="min-h-screen bg-[var(--wird-surface-muted)] flex flex-col items-center justify-center p-4 font-cairo">
        <div className="flex items-center gap-2 text-[var(--wird-text)] text-sm font-bold">
          <Loader2 className="w-4 h-4 animate-spin text-[var(--wird-accent)]" />
          <span>جاري تجهيز بيانات حسابك بأمان...</span>
        </div>
      </div>
    );
  }

  // 3. Allow guest mode access
  if (isGuest) {
    return <>{children}</>;
  }

  // 4. Allow verified user access
  if (user && isEmailVerified) {
    return <>{children}</>;
  }

  // 5. Otherwise, show AuthScreen (handles login, signup, and pending email verification)
  return <AuthScreen />;
};
