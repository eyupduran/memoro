import AsyncStorage from '@react-native-async-storage/async-storage';
import { Dimensions } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Wallpaper from 'expo-wallpaper';

import { dbService } from './database';
import { storageService } from './storage';
import type { Word } from '../types/words';

/**
 * Service for the auto lock-screen wallpaper feature.
 *
 * Flow:
 * - Settings live in AsyncStorage under `AUTO_WALLPAPER_SETTINGS_KEY`.
 *   Even before the user enables the feature, a default snapshot is
 *   pre-seeded so that "enable" is a single toggle, not a form.
 * - The configuration UI (settings screen + onboarding slide) writes to
 *   the snapshot and calls `autoWallpaperService.enable(...)` to schedule
 *   the native daily alarm via `expo-wallpaper`.
 * - `useAutoWallpaperRefresh` re-captures via a headless WordOverlayScreen
 *   mount when the app becomes active, so the next day's alarm uses
 *   fresh words with the snapshot's visual style.
 */

export type WordFormat =
  | 'standard'
  | 'inline'
  | 'compact'
  | 'flashcard'
  | 'dictionary'
  | 'quiz'
  | 'poetic'
  | 'bubble'
  | 'memo'
  | 'modern';

export type LayoutStyle =
  | 'plain'
  | 'box'
  | 'gradient'
  | 'shadow'
  | 'outline'
  | 'minimal'
  | 'card3d'
  | 'neon'
  | 'vintage'
  | 'watercolor';

/**
 * Full snapshot of the WordOverlayScreen customisation state. Mirrors
 * the defaults the manual flow uses when the screen first opens.
 */
export interface OverlaySnapshot {
  /** Background image URI used by ImageBackground (empty string = pick random at runtime) */
  backgroundImage: string;
  fontSizeScale: number;
  /** Stored as a hex/rgba string. Empty string = use theme default at render time. */
  textColor: string;
  layoutStyle: LayoutStyle;
  wordFormat: WordFormat;
  /** `null` (not `undefined`) so it round-trips through JSON cleanly. */
  fontFamily: string | null;
  positionOffsetX: number;
  positionOffsetY: number;
  /** Word selection rules for re-populating the snapshot on subsequent days */
  wordCount: number;
  level: string;
}

export interface AutoWallpaperSettings {
  enabled: boolean;
  /** 24-hour clock */
  hour: number;
  minute: number;
  snapshot: OverlaySnapshot;
}

const SETTINGS_KEY = 'auto_wallpaper_settings_v3';
const CACHE_FILENAME = 'auto_wallpaper.png';

/**
 * Sensible defaults — these mirror the initial state of WordOverlayScreen
 * when the manual flow first opens. If you change the manual flow's
 * defaults, keep this in sync.
 */
export const DEFAULT_SNAPSHOT: OverlaySnapshot = {
  backgroundImage: '',
  fontSizeScale: 1,
  // Empty string = "use theme default" (filled in at preview/render time)
  textColor: '',
  layoutStyle: 'plain',
  wordFormat: 'inline',
  fontFamily: null,
  positionOffsetX: 0,
  // Rough vertical centring for 5 words on a ~800px high screen.
  // The exact value is device-dependent but this is a reasonable seed —
  // users can tweak it in the settings screen.
  positionOffsetY: Math.min(Math.max(Dimensions.get('window').height / 2 - 250, 50), 600),
  wordCount: 5,
  level: 'A1',
};

export const DEFAULT_AUTO_WALLPAPER_SETTINGS: AutoWallpaperSettings = {
  enabled: false,
  hour: 8,
  minute: 0,
  snapshot: { ...DEFAULT_SNAPSHOT },
};

class AutoWallpaperService {
  /**
   * Load settings from AsyncStorage. If nothing is stored yet, returns
   * defaults (including a non-null default snapshot) and persists them
   * so subsequent reads are idempotent.
   */
  async getSettings(): Promise<AutoWallpaperSettings> {
    try {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      if (!raw) {
        const seeded = { ...DEFAULT_AUTO_WALLPAPER_SETTINGS, snapshot: { ...DEFAULT_SNAPSHOT } };
        await this.saveSettings(seeded);
        return seeded;
      }
      const parsed = JSON.parse(raw);
      // Merge-in any missing fields from the default (forward-compat)
      const snapshot: OverlaySnapshot = {
        ...DEFAULT_SNAPSHOT,
        ...(parsed.snapshot ?? {}),
      };
      // Clamp wordCount to the currently-supported range (3..5).
      // Older installs may have saved values up to 8 before the UI was
      // tightened, so normalise on read.
      snapshot.wordCount = Math.min(5, Math.max(3, snapshot.wordCount));
      return {
        ...DEFAULT_AUTO_WALLPAPER_SETTINGS,
        ...parsed,
        snapshot,
      };
    } catch {
      return { ...DEFAULT_AUTO_WALLPAPER_SETTINGS, snapshot: { ...DEFAULT_SNAPSHOT } };
    }
  }

  async saveSettings(settings: AutoWallpaperSettings): Promise<void> {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  /** Update just the snapshot inside the saved settings, leaving time/enabled alone. */
  async updateSnapshot(partial: Partial<OverlaySnapshot>): Promise<OverlaySnapshot> {
    const current = await this.getSettings();
    const merged: OverlaySnapshot = { ...current.snapshot, ...partial };
    await this.saveSettings({ ...current, snapshot: merged });
    return merged;
  }

  /**
   * Path where the pre-rendered wallpaper PNG should live. Uses app cache
   * dir so it survives between launches but can be cleared by the OS.
   */
  getCachePath(): string {
    const base = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? '';
    return `${base}${CACHE_FILENAME}`;
  }

  /**
   * Pick a background image URI, prefer the one stored in the snapshot,
   * otherwise pick a random one from the DB-stored backgrounds.
   */
  async resolveBackgroundImage(snapshot: OverlaySnapshot): Promise<string> {
    if (snapshot.backgroundImage && snapshot.backgroundImage.length > 0) {
      return snapshot.backgroundImage;
    }
    try {
      const images = await dbService.getBackgroundImages();
      if (images.length > 0) {
        const raw: any = images[Math.floor(Math.random() * images.length)];
        const url = raw?.url ?? raw?.uri ?? raw;
        if (typeof url === 'string') return url;
      }
    } catch {
      // ignore
    }
    return '';
  }

  /**
   * Pick fresh words for the next auto-wallpaper update. Prioritises
   * unlearned words at the snapshot's level.
   */
  async pickWordsForSnapshot(
    snapshot: OverlaySnapshot,
    languagePair: string
  ): Promise<Word[]> {
    const count = Math.max(1, Math.min(20, snapshot.wordCount));
    const level = snapshot.level;

    let pool: Word[] = [];
    try {
      if (level === 'mixed' || !level) {
        const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
        const all = await Promise.all(levels.map((l) => dbService.getWords(l, languagePair)));
        pool = all.flat();
      } else {
        pool = await dbService.getWords(level, languagePair);
      }
    } catch (e) {
      console.warn('[autoWallpaper] failed to load word pool:', e);
      pool = [];
    }

    if (pool.length === 0) return [];

    let learnedSet = new Set<string>();
    try {
      const learned = await storageService.getLearnedWords(languagePair);
      learnedSet = new Set(learned.map((w) => w.word));
    } catch {
      // ignore
    }

    const unlearned = pool.filter((w) => !learnedSet.has(w.word));
    const source = unlearned.length >= count ? unlearned : pool;

    const shuffled = [...source];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, count);
  }

  /**
   * Move a captured PNG into the known cache location and register it
   * with the native module for the next alarm fire.
   */
  async registerPreparedWallpaper(capturedUri: string): Promise<void> {
    const dest = this.getCachePath();
    const normalizedSrc = capturedUri.startsWith('file://')
      ? capturedUri
      : `file://${capturedUri}`;

    try {
      try {
        const info = await FileSystem.getInfoAsync(dest);
        if (info.exists) {
          await FileSystem.deleteAsync(dest, { idempotent: true });
        }
      } catch {
        // ignore
      }
      await FileSystem.copyAsync({ from: normalizedSrc, to: dest });
    } catch (e) {
      console.warn('[autoWallpaper] failed to copy captured wallpaper to cache:', e);
      throw e;
    }

    const nativePath = dest.startsWith('file://') ? dest.substring(7) : dest;
    await Wallpaper.setCachedWallpaperPath(nativePath);
  }

  /**
   * Enable auto-rotation with the currently-stored snapshot + given time.
   * Uses the existing snapshot (from AsyncStorage or defaults). Call
   * `updateSnapshot` first if you want to persist new overlay state.
   */
  async enable(hour: number, minute: number): Promise<Wallpaper.AutoWallpaperState> {
    const current = await this.getSettings();
    const updated: AutoWallpaperSettings = {
      ...current,
      enabled: true,
      hour,
      minute,
    };
    await this.saveSettings(updated);
    await Wallpaper.scheduleDailyWallpaper(hour, minute);
    return Wallpaper.getAutoWallpaperState();
  }

  /** Update just the alarm time, keeping the existing snapshot. */
  async updateTime(hour: number, minute: number): Promise<Wallpaper.AutoWallpaperState> {
    const current = await this.getSettings();
    const updated: AutoWallpaperSettings = { ...current, hour, minute };
    await this.saveSettings(updated);
    if (current.enabled) {
      await Wallpaper.scheduleDailyWallpaper(hour, minute);
    }
    return Wallpaper.getAutoWallpaperState();
  }

  /** Disable auto-rotation. Settings snapshot is kept so re-enabling is quick. */
  async disable(): Promise<void> {
    const current = await this.getSettings();
    await this.saveSettings({ ...current, enabled: false });
    await Wallpaper.cancelDailyWallpaper();
  }

  /** Combined state for the settings UI. */
  async getFullState(): Promise<{
    settings: AutoWallpaperSettings;
    native: Wallpaper.AutoWallpaperState;
    deviceInfo: Wallpaper.DeviceInfo;
  }> {
    const [settings, native, deviceInfo] = await Promise.all([
      this.getSettings(),
      Promise.resolve(Wallpaper.getAutoWallpaperState()),
      Promise.resolve(Wallpaper.getDeviceInfo()),
    ]);
    return { settings, native, deviceInfo };
  }
}

export const autoWallpaperService = new AutoWallpaperService();
