import React from 'react';
import { PLAYBACK_RATES, type PlaybackRate } from '../../services/audioPreferences';

interface AudioPlaybackRateControlProps {
  value: PlaybackRate;
  onChange: (rate: PlaybackRate) => void;
}

export const AudioPlaybackRateControl: React.FC<AudioPlaybackRateControlProps> = ({ value, onChange }) => (
  <div className="inline-flex flex-col items-start gap-1">
    <label className="flex items-center gap-2 text-xs text-[var(--wird-muted)]">
      <span className="whitespace-nowrap font-semibold">سرعة الصوت</span>
      <select
        aria-label="سرعة تشغيل الصوت"
        value={value}
        onChange={event => onChange(Number(event.target.value) as PlaybackRate)}
        className="min-h-11 rounded-lg border border-[var(--wird-border)] bg-[var(--wird-surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--wird-text)] focus:outline-none focus:ring-2 focus:ring-[#C59B27]"
      >
        {PLAYBACK_RATES.map(rate => <option key={rate} value={rate}>{rate}×</option>)}
      </select>
    </label>
    <a href="https://everyayah.com/" target="_blank" rel="noopener noreferrer" className="text-[10px] text-[var(--wird-muted)] underline underline-offset-2 hover:text-[var(--wird-primary)] dark:text-[var(--wird-accent)] dark:hover:text-[var(--wird-accent)]">مصدر التلاوات: EveryAyah.com</a>
  </div>
);
