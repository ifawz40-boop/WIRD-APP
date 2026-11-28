import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Mic, Play, RotateCcw, Square, Volume2 } from 'lucide-react';

interface SelfRecitationRecorderCardProps {
  ayahKey: string;
  surahName: string;
  ayahNumber: number;
  onAutoHideForRecitation?: () => void;
  onRevealAfterRecitation?: () => void;
  onPlayQari?: () => void;
  onMarkWeak?: () => void;
}

export const SelfRecitationRecorderCard: React.FC<SelfRecitationRecorderCardProps> = ({
  ayahKey,
  surahName,
  ayahNumber,
  onAutoHideForRecitation,
  onRevealAfterRecitation,
  onPlayQari,
  onMarkWeak,
}) => {
  const [status, setStatus] = useState<'idle' | 'recording' | 'recorded' | 'playing_self' | 'error'>('idle');
  const [durationSec, setDurationSec] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [autoHideOnRecord, setAutoHideOnRecord] = useState(true);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioUrlRef = useRef<string | null>(null);
  const playbackElRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanupAll = () => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (playbackElRef.current) {
      playbackElRef.current.pause();
      playbackElRef.current.src = '';
      playbackElRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    mediaRecorderRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    chunksRef.current = [];
  };

  useEffect(() => {
    cleanupAll();
    setStatus('idle');
    setDurationSec(0);
    setErrorMsg(null);
    return () => cleanupAll();
  }, [ayahKey]);

  const startRecording = async () => {
    setErrorMsg(null);
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setStatus('error');
      setErrorMsg('متصفحك الحالي لا يدعم التسجيل الصوتي المباشر؛ تأكد من فتح التطبيق عبر اتصال آمن (HTTPS أو localhost).');
      return;
    }

    cleanupAll();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      if (autoHideOnRecord) {
        onAutoHideForRecitation?.();
      }

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        if (timerRef.current !== null) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        if (chunksRef.current.length === 0) {
          setStatus('idle');
          return;
        }
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = URL.createObjectURL(blob);
        setStatus('recorded');
        onRevealAfterRecitation?.();
      };

      recorder.start();
      setDurationSec(0);
      setStatus('recording');
      timerRef.current = setInterval(() => {
        setDurationSec((prev) => {
          if (prev >= 120) {
            recorder.stop();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      cleanupAll();
      setStatus('error');
      setErrorMsg('تعذر الوصول إلى الميكروفون؛ يرجى السماح بإذن الميكروفون للتسميع الذاتي.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const togglePlayRecorded = () => {
    if (!audioUrlRef.current) return;
    if (status === 'playing_self' && playbackElRef.current) {
      playbackElRef.current.pause();
      setStatus('recorded');
      return;
    }
    if (playbackElRef.current) {
      playbackElRef.current.pause();
    }
    const el = new Audio(audioUrlRef.current);
    playbackElRef.current = el;
    el.onended = () => setStatus('recorded');
    el.onerror = () => setStatus('recorded');
    void el
      .play()
      .then(() => setStatus('playing_self'))
      .catch(() => setStatus('recorded'));
  };

  const resetRecording = () => {
    cleanupAll();
    setStatus('idle');
    setDurationSec(0);
    setErrorMsg(null);
  };

  return (
    <section
      aria-label="حلقة التسميع الصوتي الذاتي"
      className="wird-card rounded-2xl p-3.5 sm:p-4 space-y-2.5 text-xs border border-[var(--wird-border)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[var(--wird-surface-muted)] border border-[var(--wird-border-gold)] flex items-center justify-center text-[var(--wird-primary)] dark:text-[var(--wird-accent)] shrink-0">
            <Mic className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="font-bold text-[var(--wird-text)]">
              التسميع الصوتي الذاتي والمقارنة (سورة {surahName} · آية {ayahNumber})
            </h4>
            <p className="text-[11px] text-[var(--wird-muted)]">
              سجّل تلاوتك غيباً ثم قارنها بصوت القارئ ونص المصحف — التسجيل محلي 100% داخل جهازك ولا يُرفع لأي خادم
            </p>
          </div>
        </div>

        <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--wird-muted)] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoHideOnRecord}
            onChange={(e) => setAutoHideOnRecord(e.target.checked)}
            className="rounded border-[var(--wird-border)] accent-[var(--wird-primary)]"
          />
          <span>إخفاء الآية تلقائياً أثناء التسجيل</span>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          {status !== 'recording' ? (
            <button
              type="button"
              onClick={() => void startRecording()}
              className="min-h-11 px-4 py-2 rounded-xl bg-[var(--wird-primary)] hover:bg-[var(--wird-primary-hover)] text-[var(--wird-primary-ink)] font-bold inline-flex items-center gap-1.5 transition-colors"
            >
              <Mic className="w-4 h-4" />
              <span>{status === 'recorded' || status === 'playing_self' ? 'إعادة تسجيل تسميعي' : 'سجّل تسميعك غيباً'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={stopRecording}
              className="min-h-11 px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold inline-flex items-center gap-2 animate-pulse"
            >
              <Square className="w-3.5 h-3.5" />
              <span>إيقاف التسجيل وكشف الآية ({durationSec} ث)</span>
            </button>
          )}

          {(status === 'recorded' || status === 'playing_self') && (
            <>
              <button
                type="button"
                onClick={togglePlayRecorded}
                className="min-h-11 px-3.5 py-2 rounded-xl border border-[var(--wird-border-gold)] bg-[var(--wird-accent-soft)] text-[var(--wird-primary)] dark:text-[var(--wird-accent)] font-bold inline-flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{status === 'playing_self' ? 'إيقاف صوتي' : `استمع لتسميعك (${durationSec} ث)`}</span>
              </button>

              {onPlayQari && (
                <button
                  type="button"
                  onClick={onPlayQari}
                  className="min-h-11 px-3.5 py-2 rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] text-[var(--wird-text)] font-bold inline-flex items-center gap-1.5"
                >
                  <Volume2 className="w-3.5 h-3.5 text-[var(--wird-accent)]" />
                  <span>قارن بتلاوة الشيخ</span>
                </button>
              )}

              <button
                type="button"
                onClick={resetRecording}
                aria-label="مسح التسجيل الصوتي المؤقت"
                className="min-h-11 px-3 py-2 rounded-xl border border-[var(--wird-border)] text-[var(--wird-muted)] hover:text-[var(--wird-text)] inline-flex items-center gap-1 font-semibold"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>مسح</span>
              </button>
            </>
          )}
        </div>

        {(status === 'recorded' || status === 'playing_self') && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
              <Check className="w-3.5 h-3.5" />
              <span>كُشفت الآية للمراجعة الذاتية</span>
            </span>
            {onMarkWeak && (
              <button
                type="button"
                onClick={onMarkWeak}
                className="min-h-10 px-3 py-1.5 rounded-xl border border-[var(--wird-border-gold)] bg-[var(--wird-surface-muted)] text-[11px] font-bold text-[var(--wird-text)] inline-flex items-center gap-1"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-[var(--wird-accent)]" />
                <span>سجّل موضع خطأ</span>
              </button>
            )}
          </div>
        )}
      </div>

      {errorMsg && (
        <p role="alert" className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">
          {errorMsg}
        </p>
      )}
    </section>
  );
};
