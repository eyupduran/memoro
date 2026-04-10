import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, ImageSourcePropType, Platform, View } from 'react-native';
import ViewShot from 'react-native-view-shot';

import { autoWallpaperService } from '../services/autoWallpaper';
import { dbService } from '../services/database';
import * as Wallpaper from 'expo-wallpaper';
import { useLanguage } from '../contexts/LanguageContext';
import type { Word } from '../types/words';
import type { WallpaperComposerLayout } from '../components/WallpaperComposer';

/**
 * Hook that refreshes the cached auto-wallpaper PNG whenever the app
 * becomes active — so that the next day's alarm has a fresh image to
 * apply, without the user needing to visit the settings screen.
 *
 * Skips work if auto mode is disabled, if we already refreshed today,
 * or if the user is not on Android.
 *
 * Returns a render prop (`offscreen`) that MUST be mounted in the host
 * screen's tree — it holds the invisible ViewShot container used for
 * capturing.
 */
export interface AutoWallpaperRefreshState {
  offscreen: React.ReactElement | null;
}

interface PendingRender {
  words: Word[];
  layout: WallpaperComposerLayout;
  background: ImageSourcePropType;
}

const REFRESH_DEBOUNCE_MS = 2000;
const SAME_DAY_WINDOW_MS = 18 * 60 * 60 * 1000; // Only regenerate every ~18h

export function useAutoWallpaperRefresh(): AutoWallpaperRefreshState {
  const { currentLanguagePair } = useLanguage();
  const [pending, setPending] = useState<PendingRender | null>(null);
  const composerRef = useRef<ViewShot>(null);
  const lastRefreshRef = useRef<number>(0);
  const inFlightRef = useRef(false);

  const doRefresh = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const settings = await autoWallpaperService.getSettings();
      if (!settings.enabled) return;

      const native = Wallpaper.getAutoWallpaperState();
      if (!native.enabled) return;

      // Skip if we already refreshed recently
      const sinceLast = Date.now() - lastRefreshRef.current;
      if (lastRefreshRef.current > 0 && sinceLast < SAME_DAY_WINDOW_MS) {
        return;
      }

      const selection = await autoWallpaperService.prepareWordSelection(currentLanguagePair);
      if (!selection || selection.words.length === 0) return;

      // Resolve background — pick a random one from DB so rotations
      // feel fresh; fall back to a dark placeholder if DB is empty.
      let background: ImageSourcePropType = {
        uri: 'https://via.placeholder.com/1080x1920/111111/ffffff?text=',
      };
      try {
        const images = await dbService.getBackgroundImages();
        if (images.length > 0) {
          const raw: any = images[Math.floor(Math.random() * images.length)];
          const url = raw?.url ?? raw?.uri ?? raw;
          if (typeof url === 'string') background = { uri: url };
        }
      } catch {
        // fallback already set
      }

      setPending({
        words: selection.words,
        layout: (selection.settings.layout as WallpaperComposerLayout) ?? 'standard',
        background,
      });
    } catch (e) {
      console.warn('[useAutoWallpaperRefresh] refresh failed:', e);
      inFlightRef.current = false;
    }
  }, [currentLanguagePair]);

  // Capture once the composer is mounted
  useEffect(() => {
    if (!pending) return;
    let cancelled = false;
    const run = async () => {
      try {
        // Give the layout a frame to settle
        await new Promise((r) => setTimeout(r, 120));
        if (cancelled) return;
        const ref = composerRef.current;
        if (!ref || typeof ref.capture !== 'function') return;
        const uri = await ref.capture!();
        await autoWallpaperService.registerPreparedWallpaper(uri);
        lastRefreshRef.current = Date.now();
      } catch (e) {
        console.warn('[useAutoWallpaperRefresh] capture failed:', e);
      } finally {
        if (!cancelled) {
          setPending(null);
          inFlightRef.current = false;
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [pending]);

  // Trigger on mount + on AppState 'active'
  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        doRefresh();
      }, REFRESH_DEBOUNCE_MS);
    };

    scheduleRefresh();

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') scheduleRefresh();
    });

    return () => {
      sub.remove();
      if (debounce) clearTimeout(debounce);
    };
  }, [doRefresh]);

  // Lazy import to avoid a circular dependency on the component layer
  const { WallpaperComposer } = require('../components/WallpaperComposer') as {
    WallpaperComposer: React.ForwardRefExoticComponent<any>;
  };

  const offscreen = pending ? (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: -10000, top: 0, opacity: 0 }}
    >
      <WallpaperComposer
        ref={composerRef}
        words={pending.words}
        layout={pending.layout}
        backgroundImage={pending.background}
      />
    </View>
  ) : null;

  return { offscreen };
}
