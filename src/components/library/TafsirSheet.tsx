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
  const [activeAyah, setActiveAyah] = useState<Ayah | null>(ayah);
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    setActiveAyah(ayah);
  }, [ayah]);

  // Wait until activeAyah has rendered the dialog and its close button before focusing.
  // On the first open, the incoming ayah prop updates one render before activeAyah.
  const isOpen = Boolean(ayah);
  useEffect(() => {
    if (!isOpen || !activeAyah) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
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
    return () => document.removeEventListener('keydown', handleDialogKeyDown);
  }, [isOpen, Boolean(activeAyah)]);

  // Restore focus only after the dialog has actually closed and unmounted.
  useEffect(() => {
    if (isOpen) return;
    previousFocusRef.current?.focus();
    previousFocusRef.current = null;
  }, [isOpen]);

  if (!activeAyah) return null;

  const handleSelectAyah = (nextAyah: Ayah) => {
    setActiveAyah(nextAyah);
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
          ayah={activeAyah}
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

