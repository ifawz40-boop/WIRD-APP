import {
  computeGlobalAyahNumber,
  formatAyahAudioUrl,
  resolveApprovedOfflineReciterId,
} from './audioService';
import { getSavedPreferredReciter } from './audioPreferences';
import { globalAudioCoordinator } from './globalAudioCoordinator';
import { offlineQuranAudioLibrary } from './offlineQuranAudioLibrary';
import type { SeerahChapterDocument, SeerahCharacterDocument } from './seerahBookService';

export const SEERAH_AUDIO_CACHE_NAME = 'wird-app-seerah-audio-v1';
const SEERAH_VOICE_PREF_KEY = 'wird.seerah.narratorVoice.v1';
const SEERAH_RATE_PREF_KEY = 'wird.seerah.narratorRate.v1';

export type SeerahNarratorVoicePreset = 'Charon' | 'Kore' | 'local-neural';
export type SeerahSleepTimerOption = null | 15 | 30 | 45 | 'end_of_chapter';

export interface SeerahAudioSegment {
  id: string;
  domElementId: string;
  sceneId?: string;
  kind: 'narration' | 'quran_ayahs' | 'hadith';
  labelAr: string;
  spokenText?: string;
  surahNumber?: number;
  startAyah?: number;
  endAyah?: number;
}

export interface SeerahNarratorState {
  status: 'idle' | 'loading' | 'playing' | 'paused' | 'error';
  activeIndex: number;
  totalSegments: number;
  activeSegment: SeerahAudioSegment | null;
  engineSource: 'cloud-neural' | 'offline-cache' | 'qari-recitation' | 'device-neural';
  voicePreset: SeerahNarratorVoicePreset;
  playbackRate: number;
  sleepTimer: SeerahSleepTimerOption;
  sleepRemainingSeconds: number | null;
  cloudTtsAvailable: boolean | null;
  offlineCachedCount: number;
  isDownloadingOffline: boolean;
  errorMessage: string | null;
}

export function prepareArabicSpokenText(raw: string): string {
  return raw
    .replace(/ﷺ/g, ' صلى الله عليه وسلم ')
    .replace(/ﷻ/g, ' جل جلاله ')
    .replace(/«/g, ' ')
    .replace(/»/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hashTextKey(text: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193);
    h2 = Math.imul(h2 ^ ch, 0x85ebca6b);
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

function splitLongTextIntoBoundedChunks(text: string, maxChars = 750): string[] {
  const cleaned = prepareArabicSpokenText(text);
  if (!cleaned) return [];
  if (cleaned.length <= maxChars) return [cleaned];

  const sentences = cleaned.split(/(?<=[.؟!؛\n])\s+/);
  const chunks: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if (!sentence) continue;
    if ((current + ' ' + sentence).trim().length <= maxChars) {
      current = (current + ' ' + sentence).trim();
    } else {
      if (current) chunks.push(current);
      if (sentence.length <= maxChars) {
        current = sentence;
      } else {
        for (let pos = 0; pos < sentence.length; pos += maxChars) {
          chunks.push(sentence.slice(pos, pos + maxChars).trim());
        }
        current = '';
      }
    }
  }
  if (current) chunks.push(current);
  return chunks.filter(Boolean);
}

/**
 * Builds the complete ordered audio sequence for a Seerah chapter, automatically
 * interleaving authentic Qari recitation segments whenever `block.type === 'quran'` appears.
 */
export function buildChapterAudioSegments(chapter: SeerahChapterDocument): SeerahAudioSegment[] {
  const segments: SeerahAudioSegment[] = [];

  segments.push({
    id: `${chapter.id}-header`,
    domElementId: `seerah-block-header-${chapter.id}`,
    kind: 'narration',
    labelAr: `مقدمة الفصل ${chapter.order}: ${chapter.title}`,
    spokenText: prepareArabicSpokenText(`الفصل ${chapter.order}: ${chapter.title}. ${chapter.subtitle}. ${chapter.openingHook}`),
  });

  if (chapter.historicalContext?.trim()) {
    for (const [idx, chunk] of splitLongTextIntoBoundedChunks(chapter.historicalContext).entries()) {
      segments.push({
        id: `${chapter.id}-context-${idx}`,
        domElementId: `seerah-block-context-${chapter.id}`,
        kind: 'narration',
        labelAr: 'مدخل السياق التاريخي',
        spokenText: idx === 0 ? `مدخل السياق التاريخي: ${chunk}` : chunk,
      });
    }
  }

  for (const scene of chapter.scenes) {
    segments.push({
      id: `${chapter.id}-${scene.id}-title`,
      domElementId: `seerah-scene-${scene.id}`,
      sceneId: scene.id,
      kind: 'narration',
      labelAr: scene.title,
      spokenText: prepareArabicSpokenText(scene.title),
    });

    for (const block of scene.blocks) {
      const domId = `seerah-block-${block.id}`;
      if (block.type === 'quran') {
        if (block.leadIn?.trim()) {
          segments.push({
            id: `${block.id}-lead`,
            domElementId: domId,
            sceneId: scene.id,
            kind: 'narration',
            labelAr: `${scene.title} — تمهيد الآيات`,
            spokenText: prepareArabicSpokenText(block.leadIn),
          });
        }
        segments.push({
          id: `${block.id}-quran`,
          domElementId: domId,
          sceneId: scene.id,
          kind: 'quran_ayahs',
          labelAr: `تلاوة مباركة — ${block.reference}`,
          surahNumber: block.surahNumber,
          startAyah: block.startAyah,
          endAyah: block.endAyah,
        });
      } else if (block.type === 'hadith') {
        if (block.leadIn?.trim()) {
          segments.push({
            id: `${block.id}-lead`,
            domElementId: domId,
            sceneId: scene.id,
            kind: 'narration',
            labelAr: `${scene.title} — تمهيد الحديث`,
            spokenText: prepareArabicSpokenText(block.leadIn),
          });
        }
        for (const [idx, chunk] of splitLongTextIntoBoundedChunks(block.verbatimText).entries()) {
          segments.push({
            id: `${block.id}-hadith-${idx}`,
            domElementId: domId,
            sceneId: scene.id,
            kind: 'hadith',
            labelAr: `حديث وأثر موثق — ${block.reference}`,
            spokenText: chunk,
          });
        }
      } else {
        const prefix = block.type === 'uncertainty_note' ? 'إضاءة تحقيقية: ' : '';
        for (const [idx, chunk] of splitLongTextIntoBoundedChunks(prefix + block.text).entries()) {
          segments.push({
            id: `${block.id}-p-${idx}`,
            domElementId: domId,
            sceneId: scene.id,
            kind: 'narration',
            labelAr: scene.title,
            spokenText: chunk,
          });
        }
      }
    }
  }

  if (chapter.closingBridge?.trim()) {
    for (const [idx, chunk] of splitLongTextIntoBoundedChunks(chapter.closingBridge).entries()) {
      segments.push({
        id: `${chapter.id}-closing-${idx}`,
        domElementId: `seerah-block-closing-${chapter.id}`,
        kind: 'narration',
        labelAr: 'خاتمة الفصل وتمهيد ما بعده',
        spokenText: chunk,
      });
    }
  }

  return segments;
}

export function buildCharacterAudioSegments(character: SeerahCharacterDocument): SeerahAudioSegment[] {
  const segments: SeerahAudioSegment[] = [];

  segments.push({
    id: `${character.id}-intro`,
    domElementId: `seerah-char-intro-${character.id}`,
    kind: 'narration',
    labelAr: `${character.name} — ${character.epithet}`,
    spokenText: prepareArabicSpokenText(`${character.name}، ${character.epithet}. ${character.introduction}`),
  });

  segments.push({
    id: `${character.id}-bg`,
    domElementId: `seerah-char-context-${character.id}`,
    kind: 'narration',
    labelAr: 'النشأة والصلة برسول الله ﷺ',
    spokenText: prepareArabicSpokenText(
      `النشأة والخلفية التاريخية: ${character.backgroundAndContext}. صلته ومكانته عند رسول الله صلى الله عليه وسلم: ${character.relationshipWithProphet}`
    ),
  });

  character.narrativeStoryParagraphs.forEach((para, pIdx) => {
    for (const [cIdx, chunk] of splitLongTextIntoBoundedChunks(para).entries()) {
      segments.push({
        id: `${character.id}-story-${pIdx}-${cIdx}`,
        domElementId: `seerah-char-para-${pIdx}`,
        kind: 'narration',
        labelAr: `الحكاية التاريخية (${pIdx + 1}/${character.narrativeStoryParagraphs.length})`,
        spokenText: chunk,
      });
    }
  });

  if (character.documentedVirtues.length > 0) {
    segments.push({
      id: `${character.id}-virtues`,
      domElementId: `seerah-char-virtues-${character.id}`,
      kind: 'narration',
      labelAr: 'مناقب وإسهامات موثقة',
      spokenText: prepareArabicSpokenText(`من مناقبه الموثقة: ${character.documentedVirtues.join('. ')}`),
    });
  }

  return segments;
}

export function getSavedSeerahVoicePreset(): SeerahNarratorVoicePreset {
  try {
    if (typeof localStorage === 'undefined') return 'Charon';
    const raw = localStorage.getItem(SEERAH_VOICE_PREF_KEY);
    if (raw === 'Kore' || raw === 'local-neural' || raw === 'Charon') return raw;
  } catch {
    // ignore
  }
  return 'Charon';
}

export function saveSeerahVoicePreset(voice: SeerahNarratorVoicePreset): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(SEERAH_VOICE_PREF_KEY, voice);
  } catch {
    // ignore
  }
}

export function getSavedSeerahPlaybackRate(): number {
  try {
    if (typeof localStorage === 'undefined') return 1;
    const num = Number(localStorage.getItem(SEERAH_RATE_PREF_KEY));
    if ([0.75, 1, 1.25, 1.5, 1.75, 2].includes(num)) return num;
  } catch {
    // ignore
  }
  return 1;
}

export function saveSeerahPlaybackRate(rate: number): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(SEERAH_RATE_PREF_KEY, String(rate));
  } catch {
    // ignore
  }
}

function buildCacheUrlForSegment(voice: string, spokenText: string): string {
  return `/__wird_seerah_tts_v1__/${encodeURIComponent(voice)}/${hashTextKey(spokenText)}.wav`;
}

function pickBestArabicSpeechVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  const arVoices = voices.filter((v) => /^ar(?:-|_|$)/i.test(v.lang) || /arabic|عرب/i.test(v.name));
  if (arVoices.length === 0) return null;

  const scoreVoice = (v: SpeechSynthesisVoice): number => {
    const n = `${v.name} ${v.lang}`.toLowerCase();
    let score = 0;
    if (n.includes('natural') || n.includes('neural') || n.includes('online')) score += 50;
    if (n.includes('hamed') || n.includes('shakir') || n.includes('maged') || n.includes('salma') || n.includes('zariyah')) score += 35;
    if (n.includes('ar-sa') || n.includes('ar_sa')) score += 15;
    if (n.includes('google') || n.includes('microsoft') || n.includes('apple')) score += 10;
    return score;
  };

  return [...arVoices].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0] || arVoices[0];
}

export class SeerahAudioNarratorController {
  private segments: SeerahAudioSegment[] = [];
  private titleAr = '';
  private listeners = new Set<(state: SeerahNarratorState) => void>();
  private audioEl: HTMLAudioElement | null = null;
  private activeObjectUrl: string | null = null;
  private activeRevoke: (() => void) | null = null;
  private playSeq = 0;
  private sleepInterval: ReturnType<typeof setInterval> | null = null;
  private unregisterCoordinator: (() => void) | null = null;
  private serverTtsUnavailable = false;
  private state: SeerahNarratorState = {
    status: 'idle',
    activeIndex: 0,
    totalSegments: 0,
    activeSegment: null,
    engineSource: 'device-neural',
    voicePreset: getSavedSeerahVoicePreset(),
    playbackRate: getSavedSeerahPlaybackRate(),
    sleepTimer: null,
    sleepRemainingSeconds: null,
    cloudTtsAvailable: null,
    offlineCachedCount: 0,
    isDownloadingOffline: false,
    errorMessage: null,
  };

  constructor(segments: SeerahAudioSegment[], titleAr: string) {
    this.segments = segments;
    this.titleAr = titleAr;
    this.state.totalSegments = segments.length;
    this.state.activeSegment = segments[0] || null;
    this.unregisterCoordinator = globalAudioCoordinator.register('seerah', () => this.stop());
    void this.probeCapabilitiesAndCache();
  }

  public subscribe(listener: (state: SeerahNarratorState) => void): () => void {
    this.listeners.add(listener);
    listener({ ...this.state });
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(partial: Partial<SeerahNarratorState>): void {
    this.state = { ...this.state, ...partial };
    for (const listener of this.listeners) {
      listener({ ...this.state });
    }
  }

  private async probeCapabilitiesAndCache(): Promise<void> {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
    }
    await this.refreshOfflineCacheCount();
    try {
      const res = await fetch('/api/seerah-tts?status=1');
      if (res.ok) {
        const data = (await res.json()) as { available?: boolean };
        const available = Boolean(data?.available);
        this.serverTtsUnavailable = !available;
        this.emit({ cloudTtsAvailable: available });
      } else {
        this.serverTtsUnavailable = true;
        this.emit({ cloudTtsAvailable: false });
      }
    } catch {
      this.serverTtsUnavailable = true;
      this.emit({ cloudTtsAvailable: false });
    }
  }

  public async refreshOfflineCacheCount(): Promise<void> {
    if (typeof caches === 'undefined') return;
    const voice = this.state.voicePreset === 'local-neural' ? 'Charon' : this.state.voicePreset;
    const spokenSegments = this.segments.filter((s) => s.kind !== 'quran_ayahs' && s.spokenText);
    if (spokenSegments.length === 0) return;
    try {
      const cache = await caches.open(SEERAH_AUDIO_CACHE_NAME);
      let count = 0;
      for (const seg of spokenSegments) {
        const hit = await cache.match(buildCacheUrlForSegment(voice, seg.spokenText!));
        if (hit) count++;
      }
      this.emit({ offlineCachedCount: count });
    } catch {
      // ignore
    }
  }

  private cleanupActiveAudioResources(): void {
    if (this.audioEl) {
      this.audioEl.onended = null;
      this.audioEl.onerror = null;
      this.audioEl.pause();
      this.audioEl.src = '';
      this.audioEl = null;
    }
    if (this.activeObjectUrl) {
      URL.revokeObjectURL(this.activeObjectUrl);
      this.activeObjectUrl = null;
    }
    if (this.activeRevoke) {
      this.activeRevoke();
      this.activeRevoke = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
  }

  public destroy(): void {
    this.stop();
    this.clearSleepTimer();
    this.unregisterCoordinator?.();
    this.listeners.clear();
  }

  public stop(): void {
    this.playSeq++;
    this.cleanupActiveAudioResources();
    globalAudioCoordinator.releaseFocus('seerah');
    this.emit({ status: 'idle', errorMessage: null });
  }

  public pause(): void {
    if (this.state.status !== 'playing' && this.state.status !== 'loading') return;
    this.playSeq++;
    if (this.audioEl && !this.audioEl.paused) {
      this.audioEl.pause();
      this.emit({ status: 'paused' });
      return;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    this.emit({ status: 'paused' });
  }

  public playFrom(index: number = this.state.activeIndex): void {
    if (this.segments.length === 0) return;
    const clamped = Math.max(0, Math.min(this.segments.length - 1, index));
    if (this.state.status === 'paused' && clamped === this.state.activeIndex && this.audioEl && this.audioEl.src) {
      globalAudioCoordinator.claimFocus('seerah');
      const seq = ++this.playSeq;
      this.audioEl.playbackRate = this.state.playbackRate;
      void this.audioEl
        .play()
        .then(() => {
          if (seq === this.playSeq) this.emit({ status: 'playing' });
        })
        .catch(() => {
          if (seq === this.playSeq) void this.startSegment(clamped);
        });
      return;
    }
    void this.startSegment(clamped);
  }

  public togglePlayPause(): void {
    if (this.state.status === 'playing' || this.state.status === 'loading') {
      this.pause();
    } else {
      this.playFrom(this.state.activeIndex);
    }
  }

  public next(): void {
    if (this.state.activeIndex + 1 < this.segments.length) {
      this.playFrom(this.state.activeIndex + 1);
    } else {
      this.stop();
    }
  }

  public prev(): void {
    this.playFrom(Math.max(0, this.state.activeIndex - 1));
  }

  public setVoicePreset(voice: SeerahNarratorVoicePreset): void {
    saveSeerahVoicePreset(voice);
    const wasPlaying = this.state.status === 'playing' || this.state.status === 'loading';
    this.emit({ voicePreset: voice });
    void this.refreshOfflineCacheCount();
    if (wasPlaying) {
      this.playFrom(this.state.activeIndex);
    }
  }

  public setPlaybackRate(rate: number): void {
    saveSeerahPlaybackRate(rate);
    this.emit({ playbackRate: rate });
    if (this.audioEl) {
      this.audioEl.playbackRate = rate;
    } else if (this.state.status === 'playing' && this.state.engineSource === 'device-neural') {
      this.playFrom(this.state.activeIndex);
    }
  }

  public setSleepTimer(option: SeerahSleepTimerOption): void {
    this.clearSleepTimer();
    if (option === null || option === 'end_of_chapter') {
      this.emit({ sleepTimer: option, sleepRemainingSeconds: null });
      return;
    }
    const seconds = option * 60;
    this.emit({ sleepTimer: option, sleepRemainingSeconds: seconds });
    this.sleepInterval = setInterval(() => {
      const rem = (this.state.sleepRemainingSeconds ?? 0) - 1;
      if (rem <= 0) {
        this.clearSleepTimer();
        this.pause();
      } else {
        this.emit({ sleepRemainingSeconds: rem });
      }
    }, 1000);
  }

  private clearSleepTimer(): void {
    if (this.sleepInterval !== null) {
      clearInterval(this.sleepInterval);
      this.sleepInterval = null;
    }
  }

  private updateMediaSession(segment: SeerahAudioSegment): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') {
      return;
    }
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: segment.labelAr,
        artist: 'كتاب السيرة النبوية — وِرد',
        album: this.titleAr,
      });
      navigator.mediaSession.setActionHandler('play', () => this.playFrom(this.state.activeIndex));
      navigator.mediaSession.setActionHandler('pause', () => this.pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => this.prev());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.next());
    } catch {
      // ignore unsupported MediaSession handlers
    }
  }

  private async fetchOrReadCachedTtsBlob(spokenText: string, voice: 'Charon' | 'Kore'): Promise<{ blob: Blob; fromCache: boolean } | null> {
    const cacheUrl = buildCacheUrlForSegment(voice, spokenText);
    if (typeof caches !== 'undefined') {
      try {
        const cache = await caches.open(SEERAH_AUDIO_CACHE_NAME);
        const cached = await cache.match(cacheUrl);
        if (cached) {
          return { blob: await cached.blob(), fromCache: true };
        }
      } catch {
        // ignore cache read error
      }
    }

    if (this.serverTtsUnavailable || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
      return null;
    }

    try {
      const res = await fetch('/api/seerah-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: spokenText, voice }),
      });
      if (res.status === 503) {
        this.serverTtsUnavailable = true;
        this.emit({ cloudTtsAvailable: false });
        return null;
      }
      if (!res.ok) return null;
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.startsWith('audio/')) return null;

      const blob = await res.blob();
      if (blob.size < 128) return null;

      if (typeof caches !== 'undefined') {
        try {
          const cache = await caches.open(SEERAH_AUDIO_CACHE_NAME);
          await cache.put(
            cacheUrl,
            new Response(blob.slice(0), { headers: { 'Content-Type': contentType } })
          );
          void this.refreshOfflineCacheCount();
        } catch {
          // ignore quota error
        }
      }
      return { blob, fromCache: false };
    } catch {
      return null;
    }
  }

  private prefetchNextSpokenSegment(fromIndex: number): void {
    if (this.state.voicePreset === 'local-neural' || this.serverTtsUnavailable) return;
    const nextSeg = this.segments[fromIndex + 1];
    if (!nextSeg || nextSeg.kind === 'quran_ayahs' || !nextSeg.spokenText) return;
    void this.fetchOrReadCachedTtsBlob(nextSeg.spokenText, this.state.voicePreset);
  }

  public async downloadChapterForOffline(
    onProgress?: (done: number, total: number) => void,
    signal?: AbortSignal
  ): Promise<{ downloaded: number; total: number }> {
    const voice: 'Charon' | 'Kore' = this.state.voicePreset === 'Kore' ? 'Kore' : 'Charon';
    const targets = this.segments.filter((s) => s.kind !== 'quran_ayahs' && s.spokenText);
    if (targets.length === 0 || this.serverTtsUnavailable) {
      return { downloaded: 0, total: targets.length };
    }

    this.emit({ isDownloadingOffline: true });
    let completed = 0;
    try {
      for (const seg of targets) {
        if (signal?.aborted) break;
        const hit = await this.fetchOrReadCachedTtsBlob(seg.spokenText!, voice);
        if (hit) completed++;
        onProgress?.(completed, targets.length);
      }
      await this.refreshOfflineCacheCount();
      return { downloaded: completed, total: targets.length };
    } finally {
      this.emit({ isDownloadingOffline: false });
    }
  }

  private advanceAfterSegment(seq: number, completedIndex: number): void {
    if (seq !== this.playSeq) return;
    if (completedIndex + 1 < this.segments.length) {
      void this.startSegment(completedIndex + 1);
    } else {
      if (this.state.sleepTimer === 'end_of_chapter') {
        this.emit({ sleepTimer: null });
      }
      this.stop();
    }
  }

  private async playQuranAyahsSegment(seq: number, index: number, seg: SeerahAudioSegment): Promise<void> {
    const surah = seg.surahNumber ?? 1;
    const start = seg.startAyah ?? 1;
    const end = seg.endAyah ?? start;
    const reciter = getSavedPreferredReciter();
    const approvedReciter = resolveApprovedOfflineReciterId(reciter);

    this.emit({ status: 'playing', engineSource: 'qari-recitation' });

    for (let ayahNum = start; ayahNum <= end; ayahNum++) {
      if (seq !== this.playSeq) return;
      this.cleanupActiveAudioResources();
      const fallbackUrl = formatAyahAudioUrl(surah, ayahNum, reciter);
      const globalAyah = computeGlobalAyahNumber(surah, ayahNum);
      const resolved = await offlineQuranAudioLibrary.resolvePlaybackSource(
        approvedReciter,
        globalAyah,
        fallbackUrl
      );
      if (seq !== this.playSeq) {
        resolved.revoke?.();
        return;
      }
      this.activeRevoke = resolved.revoke ?? null;

      const playedOk = await new Promise<boolean>((resolve) => {
        const audio = new Audio(resolved.src);
        this.audioEl = audio;
        audio.playbackRate = this.state.playbackRate;
        audio.onended = () => resolve(true);
        audio.onerror = () => resolve(false);
        void audio.play().catch(() => resolve(false));
      });

      if (seq !== this.playSeq) return;
      if (!playedOk) break;
    }

    this.advanceAfterSegment(seq, index);
  }

  private speakViaBrowserSynthesis(seq: number, index: number, text: string): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      this.emit({
        status: 'error',
        errorMessage: 'متصفحك الحالي لا يدعم النطق الصوتي المحلي ولا يتوفر اتصال بخدمة الصوت السحابي.',
      });
      return;
    }

    const clauses = text
      .split(/(?<=[.،؛؟!])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (clauses.length === 0) {
      this.advanceAfterSegment(seq, index);
      return;
    }

    const bestVoice = pickBestArabicSpeechVoice();
    this.emit({ status: 'playing', engineSource: 'device-neural', errorMessage: null });

    const speakClause = (cIdx: number) => {
      if (seq !== this.playSeq) return;
      if (cIdx >= clauses.length) {
        this.advanceAfterSegment(seq, index);
        return;
      }
      const utter = new SpeechSynthesisUtterance(clauses[cIdx]);
      utter.lang = bestVoice?.lang || 'ar-SA';
      if (bestVoice) utter.voice = bestVoice;
      utter.rate = Math.max(0.65, Math.min(2, this.state.playbackRate * 0.96));
      utter.pitch = 0.96;
      utter.onend = () => speakClause(cIdx + 1);
      utter.onerror = () => {
        if (seq !== this.playSeq) return;
        speakClause(cIdx + 1);
      };
      window.speechSynthesis.speak(utter);
    };

    window.speechSynthesis.cancel();
    speakClause(0);
  }

  private async startSegment(index: number): Promise<void> {
    const seg = this.segments[index];
    if (!seg) return;

    this.cleanupActiveAudioResources();
    globalAudioCoordinator.claimFocus('seerah');
    const seq = ++this.playSeq;

    this.emit({
      status: 'loading',
      activeIndex: index,
      activeSegment: seg,
      errorMessage: null,
    });
    this.updateMediaSession(seg);

    if (seg.kind === 'quran_ayahs') {
      await this.playQuranAyahsSegment(seq, index, seg);
      return;
    }

    const spokenText = seg.spokenText || '';
    if (!spokenText) {
      this.advanceAfterSegment(seq, index);
      return;
    }

    if (this.state.voicePreset !== 'local-neural') {
      const cloudOrCached = await this.fetchOrReadCachedTtsBlob(spokenText, this.state.voicePreset);
      if (seq !== this.playSeq) return;
      if (cloudOrCached) {
        this.prefetchNextSpokenSegment(index);
        const objUrl = URL.createObjectURL(cloudOrCached.blob);
        this.activeObjectUrl = objUrl;
        const audio = new Audio(objUrl);
        this.audioEl = audio;
        audio.playbackRate = this.state.playbackRate;
        audio.onended = () => this.advanceAfterSegment(seq, index);
        audio.onerror = () => {
          if (seq !== this.playSeq) return;
          this.speakViaBrowserSynthesis(seq, index, spokenText);
        };
        try {
          await audio.play();
          if (seq === this.playSeq) {
            this.emit({
              status: 'playing',
              engineSource: cloudOrCached.fromCache ? 'offline-cache' : 'cloud-neural',
            });
          }
          return;
        } catch {
          if (seq !== this.playSeq) return;
        }
      }
    }

    this.speakViaBrowserSynthesis(seq, index, spokenText);
  }
}
