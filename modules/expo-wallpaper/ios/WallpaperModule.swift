import ExpoModulesCore

/**
 * iOS stub for expo-wallpaper.
 *
 * Apple does not expose any public API for programmatically setting the
 * lock-screen wallpaper. Calls to `setLockScreenWallpaper` will throw
 * `UNSUPPORTED_PLATFORM`. The JS layer is expected to fall back to saving
 * the image to the photo library and instructing the user to set it
 * manually via Photos → Share → "Use as Wallpaper".
 */
public class WallpaperModule: Module {
  public func definition() -> ModuleDefinition {
    Name("Wallpaper")

    Function("isSupported") { () -> Bool in
      return false
    }

    Function("getDeviceInfo") { () -> [String: Any] in
      return [
        "isMiui": false,
        "manufacturer": "apple",
        "androidApiLevel": 0
      ]
    }

    AsyncFunction("setLockScreenWallpaper") { (_: String) -> Bool in
      throw WallpaperError.unsupported
    }

    AsyncFunction("openMiuiOtherPermissions") { () -> Bool in
      return false
    }

    AsyncFunction("openAutostartSettings") { () -> Bool in
      return false
    }

    AsyncFunction("openBatteryOptimizationSettings") { () -> Bool in
      return false
    }

    AsyncFunction("setCachedWallpaperPath") { (_: String) -> Bool in
      return false
    }

    AsyncFunction("scheduleDailyWallpaper") { (_: Int, _: Int) -> Bool in
      return false
    }

    AsyncFunction("cancelDailyWallpaper") { () -> Bool in
      return false
    }

    AsyncFunction("applyCachedWallpaperNow") { () -> Bool in
      return false
    }

    Function("getAutoWallpaperState") { () -> [String: Any] in
      return [
        "enabled": false,
        "hour": -1,
        "minute": -1,
        "cachePath": NSNull(),
        "lastRunMillis": 0,
        "canScheduleExactAlarms": false
      ]
    }

    AsyncFunction("openExactAlarmSettings") { () -> Bool in
      return false
    }
  }
}

enum WallpaperError: Error, LocalizedError {
  case unsupported

  var errorDescription: String? {
    switch self {
    case .unsupported:
      return "UNSUPPORTED_PLATFORM: Lock-screen wallpaper is not supported on iOS."
    }
  }
}
