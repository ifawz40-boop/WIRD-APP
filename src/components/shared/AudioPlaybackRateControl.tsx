import React from 'react';
import { PLAYBACK_RATES, type PlaybackRate } from '../../services/audioPreferences';

interface AudioPlaybackRateControlProps {
  value: PlaybackRate;
  onChange: (rate: PlaybackRate) => void;
}

export const AudioPlaybackRateControl: React.FC<AudioPlaybackRateControlProps> = ({ value, onChange }) => (
  <div className="inline-flex flex-col items-start gap-1">
    <label className="flex items-center gap-2 text-xs text-[#5B6F6B] dark:text-[#8B9E9B]">
      <span className="whitespace-nowrap font-semibold">سرعة الصوت</span>
      <select
        aria-label="سرعة تشغيل الصوت"
        value={value}
        onChange={event => onChange(Number(event.target.value) as PlaybackRate)}
        className="min-h-11 rounded-lg border border-[#1C4E46]/15 dark:border-[#E0A96D]/25 bg-white dark:bg-[#111F36] px-2.5 py-1.5 text-xs font-semibold text-[#142421] dark:text-[#F5F1E8] focus:outline-none focus:ring-2 focus:ring-[#C59B27]"
      >
        {PLAYBACK_RATES.map(rate => <option key={rate} value={rate}>{rate}×</option>)}
      </select>
    </label>
    <a href="https://everyayah.com/" target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#5B6F6B] dark:text-[#8B9E9B] underline underline-offset-2 hover:text-[#1C4E46] dark:hover:text-[#E0A96D]">مصدر التلاوات: EveryAyah.com</a>
  </div>
);
