export type WallpaperErrorCode =
  | 'UNSUPPORTED_PLATFORM'
  | 'PERMISSION_DENIED'
  | 'FILE_NOT_FOUND'
  | 'BITMAP_DECODE_FAILED'
  | 'WALLPAPER_SET_FAILED'
  | 'VERIFICATION_FAILED'
  | 'UNKNOWN';

export interface WallpaperError {
  code: WallpaperErrorCode;
  message: string;
  /** True if the user likely needs to grant a permission in MIUI's "Other permissions" screen */
  needsMiuiPermission?: boolean;
}

export interface DeviceInfo {
  isMiui: boolean;
  manufacturer: string;
  androidApiLevel: number;
}
