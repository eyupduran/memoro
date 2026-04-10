import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

import type { DeviceInfo, WallpaperError } from './WallpaperModule.types';

export type { DeviceInfo, WallpaperError, WallpaperErrorCode } from './WallpaperModule.types';

export interface AutoWallpaperState {
  enabled: boolean;
  hour: number;
  minute: number;
  cachePath: string | null;
  lastRunMillis: number;
  canScheduleExactAlarms: boolean;
}

interface WallpaperModuleNative {
  isSupported(): boolean;
  getDeviceInfo(): DeviceInfo;
  setLockScreenWallpaper(uri: string): Promise<boolean>;
  openMiuiOtherPermissions(): Promise<boolean>;
  openAutostartSettings(): Promise<boolean>;
  openBatteryOptimizationSettings(): Promise<boolean>;
  setCachedWallpaperPath(path: string): Promise<boolean>;
  scheduleDailyWallpaper(hour: number, minute: number): Promise<boolean>;
  cancelDailyWallpaper(): Promise<boolean>;
  applyCachedWallpaperNow(): Promise<boolean>;
  getAutoWallpaperState(): AutoWallpaperState;
  openExactAlarmSettings(): Promise<boolean>;
}

const nativeModule = requireNativeModule<WallpaperModuleNative>('Wallpaper');

/**
 * Whether the current platform supports programmatic lock-screen wallpaper.
 * Android: true. iOS: false (Apple restriction — no public API).
 */
export function isSupported(): boolean {
  if (Platform.OS !== 'android') return false;
  return nativeModule.isSupported();
}

/**
 * Returns device info used to tailor MIUI-specific onboarding.
 */
export function getDeviceInfo(): DeviceInfo {
  if (Platform.OS !== 'android') {
    return { isMiui: false, manufacturer: 'unknown', androidApiLevel: 0 };
  }
  return nativeModule.getDeviceInfo();
}

/**
 * Sets the given image as the device lock-screen wallpaper (FLAG_LOCK only).
 * Resolves to true on success. Rejects with a `WallpaperError` on failure.
 *
 * On MIUI, if the "Change wallpaper" permission under "Other permissions"
 * is disabled, this may fail with code `PERMISSION_DENIED` and
 * `needsMiuiPermission: true`. Callers should offer to open the MIUI
 * permission screen via `openMiuiOtherPermissions()`.
 */
export async function setLockScreenWallpaper(uri: string): Promise<boolean> {
  if (Platform.OS !== 'android') {
    const err: WallpaperError = {
      code: 'UNSUPPORTED_PLATFORM',
      message: 'Lock screen wallpaper is only supported on Android.',
    };
    throw err;
  }
  return nativeModule.setLockScreenWallpaper(uri);
}

/**
 * Opens MIUI's "Other permissions" screen for this app, where users can
 * toggle the "Change wallpaper" permission. Returns true if the intent
 * was launched successfully. On non-MIUI devices, returns false.
 */
export async function openMiuiOtherPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  return nativeModule.openMiuiOtherPermissions();
}

/**
 * Opens the per-app autostart settings screen on MIUI, or a best-effort
 * fallback on other manufacturers.
 */
export async function openAutostartSettings(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  return nativeModule.openAutostartSettings();
}

/**
 * Opens the battery optimization settings for this app so the user can
 * exempt Memoro from background restrictions.
 */
export async function openBatteryOptimizationSettings(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  return nativeModule.openBatteryOptimizationSettings();
}

// ---- Auto-rotation ----

/**
 * Register the path to the pre-rendered PNG that the daily alarm receiver
 * should apply. Typically called whenever the JS layer regenerates the
 * next-day wallpaper cache.
 */
export async function setCachedWallpaperPath(path: string): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  return nativeModule.setCachedWallpaperPath(path);
}

/**
 * Enable auto-rotation at the given local time (24h clock). The native
 * alarm self-reschedules after each fire, so one call is enough.
 */
export async function scheduleDailyWallpaper(hour: number, minute: number): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  return nativeModule.scheduleDailyWallpaper(hour, minute);
}

/**
 * Disable auto-rotation and cancel the pending alarm.
 */
export async function cancelDailyWallpaper(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  return nativeModule.cancelDailyWallpaper();
}

/**
 * Apply the currently cached wallpaper immediately. Used by the
 * "Test now" button and by the JS layer after regenerating the cache.
 */
export async function applyCachedWallpaperNow(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  return nativeModule.applyCachedWallpaperNow();
}

/**
 * Returns the current auto-rotation state from SharedPreferences.
 */
export function getAutoWallpaperState(): AutoWallpaperState {
  if (Platform.OS !== 'android') {
    return {
      enabled: false,
      hour: -1,
      minute: -1,
      cachePath: null,
      lastRunMillis: 0,
      canScheduleExactAlarms: false,
    };
  }
  return nativeModule.getAutoWallpaperState();
}

/**
 * Opens the "Schedule exact alarms" settings page on Android 12+.
 * Required if `canScheduleExactAlarms` is false in the auto state.
 */
export async function openExactAlarmSettings(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  return nativeModule.openExactAlarmSettings();
}
