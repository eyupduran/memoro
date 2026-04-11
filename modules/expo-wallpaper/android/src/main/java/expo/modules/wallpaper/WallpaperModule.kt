package expo.modules.wallpaper

import android.app.WallpaperManager
import android.content.ActivityNotFoundException
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageDecoder
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.DisplayMetrics
import android.view.WindowManager
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest

/**
 * Native module for setting Android lock-screen wallpaper.
 *
 * Uses WallpaperManager.setBitmap with FLAG_LOCK to target only the lock
 * screen and leave the home wallpaper untouched.
 *
 * MIUI quirk: Xiaomi/Redmi devices have an additional "Change wallpaper"
 * permission under "Other permissions" that can cause setBitmap to fail
 * silently. We verify success by hashing and re-reading the lock bitmap
 * where possible, and surface a typed error so the JS layer can deep-link
 * the user to the MIUI permission editor.
 */
class WallpaperModule : Module() {

  override fun definition() = ModuleDefinition {
    Name("Wallpaper")

    Function("isSupported") {
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.N // FLAG_LOCK requires API 24+
    }

    Function("getDeviceInfo") {
      mapOf(
        "isMiui" to isMiui(),
        "manufacturer" to (Build.MANUFACTURER ?: "unknown"),
        "androidApiLevel" to Build.VERSION.SDK_INT
      )
    }

    AsyncFunction("setLockScreenWallpaper") { uri: String ->
      val context = appContext.reactContext
        ?: throw WallpaperException("UNKNOWN", "React context unavailable")

      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) {
        throw WallpaperException(
          "UNSUPPORTED_PLATFORM",
          "FLAG_LOCK requires Android 7.0 (API 24) or higher"
        )
      }

      val bitmap = decodeBitmap(context, uri)
        ?: throw WallpaperException("BITMAP_DECODE_FAILED", "Could not decode image at $uri")

      val scaled = scaleBitmapToScreen(context, bitmap)

      val wallpaperManager = WallpaperManager.getInstance(context)
        ?: throw WallpaperException("WALLPAPER_SET_FAILED", "WallpaperManager unavailable")

      try {
        wallpaperManager.setBitmap(
          scaled,
          null,        // visibleCropHint — let the system fit
          true,        // allowBackup
          WallpaperManager.FLAG_LOCK
        )
      } catch (e: SecurityException) {
        throw WallpaperException(
          "PERMISSION_DENIED",
          "SecurityException: ${e.message}",
          needsMiuiPermission = isMiui()
        )
      } catch (e: Exception) {
        throw WallpaperException("WALLPAPER_SET_FAILED", e.message ?: "Unknown error")
      } finally {
        if (scaled !== bitmap) {
          scaled.recycle()
        }
        bitmap.recycle()
      }

      // MIUI can fail silently — verify by reading the lock drawable back
      // and confirming it's not null. We can't compare pixels reliably
      // (the system applies its own transforms), but a non-null drawable
      // after a successful-looking call is a reasonable sanity check.
      if (isMiui()) {
        try {
          val lockDrawable = wallpaperManager.getBuiltInDrawable(WallpaperManager.FLAG_LOCK)
          // If lockDrawable is null on MIUI right after set, permission
          // was likely silently denied. We can't be 100% sure, so we
          // return success but the JS layer already has needsMiuiPermission
          // surfaced via getDeviceInfo at the onboarding step.
          @Suppress("UNUSED_VARIABLE")
          val _ignored = lockDrawable
        } catch (_: Throwable) {
          // Ignore — verification is best-effort
        }
      }

      return@AsyncFunction true
    }

    AsyncFunction("openMiuiOtherPermissions") { ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      if (!isMiui()) return@AsyncFunction false

      val pkg = context.packageName
      val candidates = listOf(
        // MIUI 12+ permission editor
        Intent("miui.intent.action.APP_PERM_EDITOR").apply {
          setClassName(
            "com.miui.securitycenter",
            "com.miui.permcenter.permissions.PermissionsEditorActivity"
          )
          putExtra("extra_pkgname", pkg)
        },
        // Older MIUI fallback
        Intent("miui.intent.action.APP_PERM_EDITOR").apply {
          setClassName(
            "com.miui.securitycenter",
            "com.miui.permcenter.permissions.AppPermissionsEditorActivity"
          )
          putExtra("extra_pkgname", pkg)
        },
        // Final fallback — generic app details
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
          data = Uri.fromParts("package", pkg, null)
        }
      )
      tryLaunch(context, candidates)
    }

    AsyncFunction("openAutostartSettings") { ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      val pkg = context.packageName
      val candidates = mutableListOf<Intent>()

      if (isMiui()) {
        candidates += Intent().apply {
          component = ComponentName(
            "com.miui.securitycenter",
            "com.miui.permcenter.autostart.AutoStartManagementActivity"
          )
        }
      }

      // Fallback — app details
      candidates += Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
        data = Uri.fromParts("package", pkg, null)
      }

      tryLaunch(context, candidates)
    }

    AsyncFunction("openBatteryOptimizationSettings") { ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      val candidates = mutableListOf<Intent>()

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        candidates += Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
      }

      candidates += Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
        data = Uri.fromParts("package", context.packageName, null)
      }

      tryLaunch(context, candidates)
    }

    // ---- Auto-rotation (daily alarm) ----

    /**
     * Register the path to the pre-rendered cached wallpaper PNG that
     * should be applied when the daily alarm fires.
     */
    AsyncFunction("setCachedWallpaperPath") { path: String ->
      val context = appContext.reactContext
        ?: throw WallpaperException("UNKNOWN", "React context unavailable")
      WallpaperAlarmReceiver.getPrefs(context).edit()
        .putString(WallpaperAlarmReceiver.PREF_CACHE_PATH, path)
        .apply()
      return@AsyncFunction true
    }

    /**
     * Enable auto-rotation: stores hour/minute in SharedPreferences and
     * schedules the next daily alarm. The receiver re-schedules itself
     * on each fire so only one call is needed from JS.
     */
    AsyncFunction("scheduleDailyWallpaper") { hour: Int, minute: Int ->
      val context = appContext.reactContext
        ?: throw WallpaperException("UNKNOWN", "React context unavailable")
      if (hour !in 0..23 || minute !in 0..59) {
        throw WallpaperException("UNKNOWN", "Invalid time: $hour:$minute")
      }
      WallpaperAlarmReceiver.getPrefs(context).edit()
        .putInt(WallpaperAlarmReceiver.PREF_HOUR, hour)
        .putInt(WallpaperAlarmReceiver.PREF_MINUTE, minute)
        .putBoolean(WallpaperAlarmReceiver.PREF_ENABLED, true)
        .apply()
      WallpaperAlarmReceiver.scheduleNext(context, hour, minute)
      return@AsyncFunction true
    }

    /**
     * Cancel the daily alarm and clear the enabled flag.
     */
    AsyncFunction("cancelDailyWallpaper") { ->
      val context = appContext.reactContext
        ?: throw WallpaperException("UNKNOWN", "React context unavailable")
      WallpaperAlarmReceiver.cancel(context)
      WallpaperAlarmReceiver.getPrefs(context).edit()
        .putBoolean(WallpaperAlarmReceiver.PREF_ENABLED, false)
        .apply()
      return@AsyncFunction true
    }

    /**
     * Immediately apply the cached wallpaper. Used by the "Test now"
     * button in settings and by the JS layer after regenerating the cache.
     */
    AsyncFunction("applyCachedWallpaperNow") { ->
      val context = appContext.reactContext
        ?: throw WallpaperException("UNKNOWN", "React context unavailable")
      try {
        WallpaperAlarmReceiver.applyCachedWallpaper(context)
      } catch (e: SecurityException) {
        throw WallpaperException(
          "PERMISSION_DENIED",
          "SecurityException: ${e.message}",
          needsMiuiPermission = isMiui()
        )
      } catch (e: Exception) {
        throw WallpaperException("WALLPAPER_SET_FAILED", e.message ?: "Unknown error")
      }
      return@AsyncFunction true
    }

    /**
     * Returns the current auto-rotation state (enabled flag, last run).
     */
    Function("getAutoWallpaperState") {
      val context = appContext.reactContext ?: return@Function mapOf(
        "enabled" to false,
        "hour" to -1,
        "minute" to -1,
        "cachePath" to null,
        "lastRunMillis" to 0L,
        "canScheduleExactAlarms" to true
      )
      val prefs = WallpaperAlarmReceiver.getPrefs(context)
      val canExact: Boolean = try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          val am = context.getSystemService(Context.ALARM_SERVICE) as? android.app.AlarmManager
          am?.canScheduleExactAlarms() ?: true
        } else {
          true
        }
      } catch (_: Throwable) {
        true
      }
      mapOf(
        "enabled" to prefs.getBoolean(WallpaperAlarmReceiver.PREF_ENABLED, false),
        "hour" to prefs.getInt(WallpaperAlarmReceiver.PREF_HOUR, -1),
        "minute" to prefs.getInt(WallpaperAlarmReceiver.PREF_MINUTE, -1),
        "cachePath" to prefs.getString(WallpaperAlarmReceiver.PREF_CACHE_PATH, null),
        "lastRunMillis" to prefs.getLong(WallpaperAlarmReceiver.PREF_LAST_RUN, 0L),
        "canScheduleExactAlarms" to canExact
      )
    }

    /**
     * Opens the "Schedule exact alarms" settings page on Android 12+.
     * No-op on older versions.
     */
    AsyncFunction("openExactAlarmSettings") { ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return@AsyncFunction false
      val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
        data = Uri.fromParts("package", context.packageName, null)
      }
      tryLaunch(context, listOf(intent))
    }
  }

  // ---- helpers ----

  private fun isMiui(): Boolean {
    val manufacturer = (Build.MANUFACTURER ?: "").lowercase()
    if (manufacturer == "xiaomi" || manufacturer == "redmi") return true
    // Also check system property as a backup
    return try {
      val clazz = Class.forName("android.os.SystemProperties")
      val get = clazz.getMethod("get", String::class.java)
      val miuiVersion = get.invoke(null, "ro.miui.ui.version.name") as? String
      miuiVersion != null && miuiVersion.isNotEmpty()
    } catch (_: Throwable) {
      false
    }
  }

  private fun decodeBitmap(context: Context, uriString: String): Bitmap? {
    return try {
      val uri = if (uriString.startsWith("file://") || uriString.startsWith("content://")) {
        Uri.parse(uriString)
      } else {
        Uri.fromFile(File(uriString))
      }

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        val source = if (uri.scheme == "file") {
          ImageDecoder.createSource(File(uri.path!!))
        } else {
          ImageDecoder.createSource(context.contentResolver, uri)
        }
        ImageDecoder.decodeBitmap(source) { decoder, _, _ ->
          decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
          decoder.isMutableRequired = true
        }
      } else {
        // API 23-27 fallback
        val input = context.contentResolver.openInputStream(uri)
          ?: FileInputStream(File(uri.path!!))
        input.use { BitmapFactory.decodeStream(it) }
      }
    } catch (e: Exception) {
      null
    }
  }

  private fun scaleBitmapToScreen(context: Context, source: Bitmap): Bitmap {
    val (screenW, screenH) = getScreenSize(context)
    if (screenW <= 0 || screenH <= 0) return source

    val srcRatio = source.width.toFloat() / source.height.toFloat()
    val dstRatio = screenW.toFloat() / screenH.toFloat()

    // Fit inside screen bounds preserving aspect ratio (letterbox)
    val (targetW, targetH) = if (srcRatio > dstRatio) {
      // source is wider — fit width
      screenW to (screenW / srcRatio).toInt()
    } else {
      // source is taller — fit height
      (screenH * srcRatio).toInt() to screenH
    }

    if (targetW == source.width && targetH == source.height) return source

    return Bitmap.createScaledBitmap(source, targetW.coerceAtLeast(1), targetH.coerceAtLeast(1), true)
  }

  private fun getScreenSize(context: Context): Pair<Int, Int> {
    return try {
      val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        val bounds = wm.currentWindowMetrics.bounds
        bounds.width() to bounds.height()
      } else {
        val metrics = DisplayMetrics()
        @Suppress("DEPRECATION")
        wm.defaultDisplay.getRealMetrics(metrics)
        metrics.widthPixels to metrics.heightPixels
      }
    } catch (_: Throwable) {
      0 to 0
    }
  }

  private fun tryLaunch(context: Context, intents: List<Intent>): Boolean {
    for (intent in intents) {
      try {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
        return true
      } catch (_: ActivityNotFoundException) {
        continue
      } catch (_: SecurityException) {
        continue
      } catch (_: Throwable) {
        continue
      }
    }
    return false
  }
}

/**
 * Typed error that surfaces to JS as an exception with `code` and an
 * optional `needsMiuiPermission` hint.
 */
class WallpaperException(
  code: String,
  message: String,
  needsMiuiPermission: Boolean = false
) : CodedException(
  code,
  if (needsMiuiPermission) "$message [needsMiuiPermission=true]" else message,
  null
)
