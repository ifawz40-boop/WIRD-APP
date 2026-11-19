import React, { useEffect, useRef, useState } from 'react';
import type { Ayah } from '../../types/quran';
import { TafsirContentPane } from './TafsirContentPane';

interface TafsirSheetProps {
  ayah: Ayah | null;
  onClose: () => void;
  onSelectAyah?: (nextAyah: Ayah) => void;
  pageNumber?: number;
  pageAyahs?: Ayah[];
}

export const TafsirSheet: React.FC<TafsirSheetProps> = ({
  ayah,
  onClose,
  onSelectAyah,
  pageNumber,
  pageAyahs
}) => {
  const [steppedAyah, setSteppedAyah] = useState<Ayah | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    setSteppedAyah(null);
  }, [ayah]);

  const currentAyah = ayah ? (steppedAyah ?? ayah) : null;

  // Trap keyboard focus inside modal when opened; restore opener focus on close.
  const isOpen = Boolean(currentAyah);
  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();

    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialogRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleDialogKeyDown);
    return () => {
      document.removeEventListener('keydown', handleDialogKeyDown);
      previousFocus?.focus();
    };
  }, [isOpen]);

  if (!currentAyah) return null;

  const handleSelectAyah = (nextAyah: Ayah) => {
    setSteppedAyah(nextAyah);
    onSelectAyah?.(nextAyah);
  };

  return (
    <div
      className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 transition-opacity animate-in fade-in duration-200"
      onClick={onClose}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wird-tafsir-dialog-title"
        onClick={event => event.stopPropagation()}
        className="w-full sm:max-w-3xl max-h-[92vh] sm:max-h-[88vh] bg-[#F9F6EE] dark:bg-[#111F36] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-[#C59B27]/35 dark:border-[#E0A96D]/30 overflow-hidden flex flex-col"
      >
        <TafsirContentPane
          ayah={currentAyah}
          onSelectAyah={handleSelectAyah}
          onClose={onClose}
          closeButtonRef={closeButtonRef}
          titleId="wird-tafsir-dialog-title"
          pageNumber={pageNumber}
          pageAyahs={pageAyahs}
        />
      </section>
    </div>
  );
};

