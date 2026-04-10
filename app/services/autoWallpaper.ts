import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Wallpaper from 'expo-wallpaper';

import { dbService } from './database';
import { storageService } from './storage';
import type { Word } from '../types/words';

/**
 * Service for the auto lock-screen wallpaper feature (Option C hybrid).
 *
 * Architecture:
 * - User settings live in AsyncStorage under AUTO_WALLPAPER_SETTINGS_KEY.
 * - When enabled, the JS layer pre-renders tomorrow's wallpaper PNG and
 *   writes it to a known cache path. The path is handed to the native
 *   module, which schedules an AlarmManager trigger at the chosen time.
 * - When the alarm fires, the native receiver reads the cached PNG and
 *   calls WallpaperManager.setBitmap(..., FLAG_LOCK) — no JS involved,
 *   so it works even if the user never opens the app.
 * - On next app foreground, the JS layer regenerates the cache for the
 *   *next* day and updates the path.
 *
 * The actual PNG generation is NOT done here — it requires a ViewShot in
 * the React tree. `prepareWordSelection()` returns the words + layout
 * metadata, the caller renders them off-screen, captures the URI, then
 * calls `registerPreparedWallpaper(uri)` to hand it over.
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

export interface AutoWallpaperSettings {
  enabled: boolean;
  /** 24-hour clock */
  hour: number;
  minute: number;
  wordCount: number;
  level: string; // e.g. "A1" | "B2" | ... | "mixed"
  layout: WordFormat;
  /** Which background image was last used for the wallpaper (asset index or URI) */
  backgroundImage?: string;
}

export interface PreparedWallpaper {
  words: Word[];
  settings: AutoWallpaperSettings;
}

const SETTINGS_KEY = 'auto_wallpaper_settings_v1';
const CACHE_FILENAME = 'auto_wallpaper.png';

export const DEFAULT_AUTO_WALLPAPER_SETTINGS: AutoWallpaperSettings = {
  enabled: false,
  hour: 8,
  minute: 0,
  wordCount: 5,
  level: 'A1',
  layout: 'standard',
};

class AutoWallpaperService {
  async getSettings(): Promise<AutoWallpaperSettings> {
    try {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      if (!raw) return { ...DEFAULT_AUTO_WALLPAPER_SETTINGS };
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_AUTO_WALLPAPER_SETTINGS, ...parsed };
    } catch {
      return { ...DEFAULT_AUTO_WALLPAPER_SETTINGS };
    }
  }

  async saveSettings(settings: AutoWallpaperSettings): Promise<void> {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  /**
   * Path where the pre-rendered wallpaper PNG should live.
   * Uses app cache dir so it survives between launches but can be cleared
   * by the OS if needed.
   */
  getCachePath(): string {
    const base = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? '';
    return `${base}${CACHE_FILENAME}`;
  }

  /**
   * Pick the words that should appear on the next wallpaper.
   * Prioritises unlearned words at the chosen level, falls back to
   * random words if not enough unlearned remain.
   */
  async pickWordsForWallpaper(
    settings: AutoWallpaperSettings,
    languagePair: string
  ): Promise<Word[]> {
    const count = Math.max(1, Math.min(20, settings.wordCount));
    const level = settings.level;

    let pool: Word[] = [];
    try {
      if (level === 'mixed' || !level) {
        // Union across levels — cheap heuristic: pull from A1..C2 and flatten
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

    // Prioritise unlearned — learned words have already been shown
    let learnedSet = new Set<string>();
    try {
      const learned = await storageService.getLearnedWords(languagePair);
      learnedSet = new Set(learned.map((w) => w.word));
    } catch {
      // ignore — fall through to pure random
    }

    const unlearned = pool.filter((w) => !learnedSet.has(w.word));
    const source = unlearned.length >= count ? unlearned : pool;

    // Fisher-Yates shuffle, then take `count`
    const shuffled = [...source];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, count);
  }

  /**
   * Prepare a word selection for the *next* wallpaper update. The caller
   * is responsible for rendering the words off-screen via ViewShot and
   * then calling `registerPreparedWallpaper(uri)`.
   */
  async prepareWordSelection(languagePair: string): Promise<PreparedWallpaper | null> {
    const settings = await this.getSettings();
    if (!settings.enabled) return null;
    const words = await this.pickWordsForWallpaper(settings, languagePair);
    if (words.length === 0) return null;
    return { words, settings };
  }

  /**
   * Move a captured PNG into the known cache location and register it
   * with the native module, so the next alarm fire will apply it.
   */
  async registerPreparedWallpaper(capturedUri: string): Promise<void> {
    const dest = this.getCachePath();

    // Ensure the URI is a plain path for copying
    const normalizedSrc = capturedUri.startsWith('file://')
      ? capturedUri
      : `file://${capturedUri}`;

    try {
      // Overwrite any previous cached wallpaper
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

    // Hand the path to native — strip file:// prefix because Kotlin
    // expects a plain filesystem path (it also accepts file:// but plain
    // is safer for SharedPreferences round-tripping).
    const nativePath = dest.startsWith('file://') ? dest.substring(7) : dest;
    await Wallpaper.setCachedWallpaperPath(nativePath);
  }

  /**
   * Enable auto-rotation with the given settings. Persists them, asks
   * native to schedule the daily alarm, and returns the native state.
   */
  async enable(settings: AutoWallpaperSettings): Promise<Wallpaper.AutoWallpaperState> {
    await this.saveSettings({ ...settings, enabled: true });
    await Wallpaper.scheduleDailyWallpaper(settings.hour, settings.minute);
    return Wallpaper.getAutoWallpaperState();
  }

  /**
   * Disable auto-rotation.
   */
  async disable(): Promise<void> {
    const current = await this.getSettings();
    await this.saveSettings({ ...current, enabled: false });
    await Wallpaper.cancelDailyWallpaper();
  }

  /**
   * Read the combined native + JS state for display in the settings UI.
   */
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
