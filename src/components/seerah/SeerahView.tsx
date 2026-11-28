import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  loadSeerahBookManifest,
  loadSeerahChapter,
  loadSeerahCharacter,
  loadSeerahSearchIndex,
  readSeerahProgress,
  saveSeerahBookPosition,
  setSeerahBookFontSize,
  toggleSeerahChapterReadState,
  type SeerahBookManifest,
  type SeerahChapterDocument,
  type SeerahCharacterDocument,
  type SeerahFontSize,
  type SeerahProgressState,
  type SeerahSearchItem
} from '../../services/seerahBookService';
import { navigateTo, parseRoute } from '../../services/router';
import { SeerahBookLanding } from './SeerahBookLanding';
import { SeerahChapterReader } from './SeerahChapterReader';
import {
  SeerahCharacterDirectory,
  SeerahCharacterProfile
} from './SeerahCharacterViews';

interface SeerahViewProps {
  onToast?: (message: string, type?: 'success' | 'info' | 'warn' | 'error') => void;
}

type ActiveSeerahScreen =
  | { mode: 'landing' }
  | { mode: 'chapter'; chapterId: string; sceneId?: string }
  | { mode: 'characters' }
  | { mode: 'character'; characterId: string };

function screenFromCurrentHash(): ActiveSeerahScreen {
  const route = parseRoute();
  if (route.tab === 'seerah') {
    if (route.seerahChapterId) {
      return { mode: 'chapter', chapterId: route.seerahChapterId };
    }
    if (route.seerahCharacterId) {
      return { mode: 'character', characterId: route.seerahCharacterId };
    }
    if (route.seerahView === 'characters') {
      return { mode: 'characters' };
    }
  }
  return { mode: 'landing' };
}

export const SeerahView: React.FC<SeerahViewProps> = ({ onToast }) => {
  const [manifest, setManifest] = useState<SeerahBookManifest | null>(null);
  const [loadingManifest, setLoadingManifest] = useState(true);
  const [manifestError, setManifestError] = useState<string | null>(null);

  const [progress, setProgress] = useState<SeerahProgressState>(() =>
    readSeerahProgress()
  );

  useEffect(() => {
    const handleRemoteSync = () => {
      setProgress(readSeerahProgress());
    };
    window.addEventListener('wird:cloud-sync-applied', handleRemoteSync);
    window.addEventListener('wird:auxiliary-sync-applied', handleRemoteSync);
    return () => {
      window.removeEventListener('wird:cloud-sync-applied', handleRemoteSync);
      window.removeEventListener('wird:auxiliary-sync-applied', handleRemoteSync);
    };
  }, []);
  const [screen, setScreen] = useState<ActiveSeerahScreen>(() =>
    screenFromCurrentHash()
  );

  // Active Chapter state
  const [activeChapter, setActiveChapter] = useState<SeerahChapterDocument | null>(
    null
  );
  const [loadingChapter, setLoadingChapter] = useState(false);
  const [chapterError, setChapterError] = useState<string | null>(null);

  // Active Character state
  const [activeCharacter, setActiveCharacter] =
    useState<SeerahCharacterDocument | null>(null);
  const [loadingCharacter, setLoadingCharacter] = useState(false);
  const [characterError, setCharacterError] = useState<string | null>(null);

  // Search Index state (lazy-loaded on first search interaction)
  const [searchIndex, setSearchIndex] = useState<SeerahSearchItem[] | null>(null);
  const searchLoadingRef = useRef(false);
  const reqSeqRef = useRef(0);

  // Load Manifest on mount
  useEffect(() => {
    let alive = true;
    setLoadingManifest(true);
    loadSeerahBookManifest()
      .then((data) => {
        if (!alive) return;
        setManifest(data);
        setLoadingManifest(false);
      })
      .catch((err) => {
        if (!alive) return;
        setManifestError(
          err instanceof Error ? err.message : 'تعذر تحميل فهرس كتاب السيرة النبوية.'
        );
        setLoadingManifest(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Sync screen with browser hash navigation (Back/Forward support)
  useEffect(() => {
    const onHashChange = () => {
      const route = parseRoute();
      if (route.tab !== 'seerah') return;
      setScreen(screenFromCurrentHash());
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Load Chapter Document when in chapter screen
  useEffect(() => {
    if (screen.mode !== 'chapter') return;
    const seq = ++reqSeqRef.current;
    setLoadingChapter(true);
    setChapterError(null);

    loadSeerahChapter(screen.chapterId)
      .then((doc) => {
        if (seq !== reqSeqRef.current) return;
        setActiveChapter(doc);
        setLoadingChapter(false);
        setProgress(saveSeerahBookPosition(doc.id, screen.sceneId));
      })
      .catch((err) => {
        if (seq !== reqSeqRef.current) return;
        setChapterError(
          err instanceof Error ? err.message : 'تعذر تحميل محتوى هذا الفصل.'
        );
        setLoadingChapter(false);
      });
  }, [screen]);

  // Load Character Document when in character screen
  useEffect(() => {
    if (screen.mode !== 'character') return;
    const seq = ++reqSeqRef.current;
    setLoadingCharacter(true);
    setCharacterError(null);

    loadSeerahCharacter(screen.characterId)
      .then((doc) => {
        if (seq !== reqSeqRef.current) return;
        if (!doc) {
          setCharacterError('لم يُعثر على ملف هذه الشخصية.');
        } else {
          setActiveCharacter(doc);
        }
        setLoadingCharacter(false);
      })
      .catch((err) => {
        if (seq !== reqSeqRef.current) return;
        setCharacterError(
          err instanceof Error ? err.message : 'تعذر تحميل سيرة الشخصية.'
        );
        setLoadingCharacter(false);
      });
  }, [screen]);

  const ensureSearchIndex = useCallback(() => {
    if (searchIndex || searchLoadingRef.current) return;
    searchLoadingRef.current = true;
    loadSeerahSearchIndex()
      .then((items) => {
        setSearchIndex(items);
      })
      .catch(() => {
        searchLoadingRef.current = false;
      });
  }, [searchIndex]);

  const handleOpenLanding = useCallback(() => {
    setScreen({ mode: 'landing' });
    navigateTo({ tab: 'seerah' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleOpenChapter = useCallback((chapterId: string, sceneId?: string) => {
    setScreen({ mode: 'chapter', chapterId, sceneId });
    navigateTo({ tab: 'seerah', seerahChapterId: chapterId });
  }, []);

  const handleOpenCharacterDirectory = useCallback(() => {
    setScreen({ mode: 'characters' });
    navigateTo({ tab: 'seerah', seerahView: 'characters' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleOpenCharacter = useCallback((characterId: string) => {
    setScreen({ mode: 'character', characterId });
    navigateTo({ tab: 'seerah', seerahCharacterId: characterId });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleToggleChapterRead = useCallback(
    (chapterId: string) => {
      const updated = toggleSeerahChapterReadState(chapterId);
      setProgress(updated);
      const isNowRead = updated.completedChapterIds.includes(chapterId);
      const title =
        manifest?.chapters.find((c) => c.id === chapterId)?.title || 'الفصل';
      onToast?.(
        isNowRead
          ? `تم تحديد «${title}» كمقروء.`
          : `تم إلغاء تحديد «${title}» كمقروء.`,
        isNowRead ? 'success' : 'info'
      );
    },
    [manifest, onToast]
  );

  const handleChangeFontSize = useCallback((size: SeerahFontSize) => {
    setProgress(setSeerahBookFontSize(size));
  }, []);

  const handleSceneFocus = useCallback(
    (sceneId: string) => {
      if (screen.mode === 'chapter') {
        setProgress(saveSeerahBookPosition(screen.chapterId, sceneId));
      }
    },
    [screen]
  );

  if (loadingManifest) {
    return (
      <div className="max-w-4xl mx-auto wird-card p-12 flex flex-col items-center justify-center gap-3 text-center">
        <Loader2 className="w-7 h-7 animate-spin text-[var(--wird-accent)]" />
        <p className="text-sm font-bold text-[var(--wird-text)]">
          جارٍ فتح كتاب السيرة النبوية الشريفة…
        </p>
      </div>
    );
  }

  if (manifestError || !manifest) {
    return (
      <div className="max-w-4xl mx-auto wird-card p-10 text-center space-y-3">
        <p className="text-sm font-bold text-rose-700 dark:text-rose-300">
          {manifestError || 'تعذر فتح كتاب السيرة النبوية حالياً.'}
        </p>
      </div>
    );
  }

  if (screen.mode === 'chapter') {
    return (
      <SeerahChapterReader
        manifest={manifest}
        chapter={activeChapter}
        loading={loadingChapter}
        error={chapterError}
        isCompleted={progress.completedChapterIds.includes(screen.chapterId)}
        fontSize={progress.fontSize}
        initialSceneId={screen.sceneId}
        onChangeFontSize={handleChangeFontSize}
        onToggleCompleted={handleToggleChapterRead}
        onOpenChapter={handleOpenChapter}
        onOpenCharacter={handleOpenCharacter}
        onBackToIndex={handleOpenLanding}
        onSceneFocus={handleSceneFocus}
      />
    );
  }

  if (screen.mode === 'characters') {
    return (
      <SeerahCharacterDirectory
        manifest={manifest}
        onOpenCharacter={handleOpenCharacter}
        onBackToBook={handleOpenLanding}
      />
    );
  }

  if (screen.mode === 'character') {
    return (
      <SeerahCharacterProfile
        manifest={manifest}
        character={activeCharacter}
        loading={loadingCharacter}
        error={characterError}
        fontSize={progress.fontSize}
        onChangeFontSize={handleChangeFontSize}
        onOpenChapter={handleOpenChapter}
        onBackToDirectory={handleOpenCharacterDirectory}
        onBackToBook={handleOpenLanding}
      />
    );
  }

  return (
    <SeerahBookLanding
      manifest={manifest}
      progressState={progress}
      searchIndex={searchIndex}
      onEnsureSearchIndex={ensureSearchIndex}
      onOpenChapter={handleOpenChapter}
      onToggleChapterRead={handleToggleChapterRead}
      onOpenCharacterDirectory={handleOpenCharacterDirectory}
      onOpenCharacter={handleOpenCharacter}
    />
  );
};
