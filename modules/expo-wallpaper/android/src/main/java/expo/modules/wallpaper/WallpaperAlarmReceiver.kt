package expo.modules.wallpaper

import android.app.AlarmManager
import android.app.PendingIntent
import android.app.WallpaperManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageDecoder
import android.os.Build
import android.util.DisplayMetrics
import android.util.Log
import android.view.WindowManager
import java.io.File
import java.util.Calendar

/**
 * Handles the daily AlarmManager trigger for auto-rotating the lock-screen
 * wallpaper. Reads the pre-rendered PNG from the app cache directory and
 * calls WallpaperManager.setBitmap(..., FLAG_LOCK) — no JS/React needed,
 * so this runs even if the user never opens the app.
 *
 * Also re-schedules the next day's alarm on each fire, and on device boot
 * (via WallpaperBootReceiver).
 */
class WallpaperAlarmReceiver : BroadcastReceiver() {

  override fun onReceive(context: Context, intent: Intent) {
    Log.d(TAG, "Alarm fired, updating lock screen wallpaper from cache")
    try {
      applyCachedWallpaper(context)
    } catch (e: Throwable) {
      Log.e(TAG, "Failed to apply cached wallpaper", e)
    } finally {
      // Always re-schedule the next day so the chain continues
      try {
        val prefs = getPrefs(context)
        val hour = prefs.getInt(PREF_HOUR, -1)
        val minute = prefs.getInt(PREF_MINUTE, -1)
        if (hour in 0..23 && minute in 0..59) {
          scheduleNext(context, hour, minute)
        }
      } catch (e: Throwable) {
        Log.e(TAG, "Failed to reschedule alarm", e)
      }
    }
  }

  companion object {
    private const val TAG = "WallpaperAlarm"
    const val ACTION_FIRE = "expo.modules.wallpaper.ACTION_APPLY_WALLPAPER"
    const val PREFS_NAME = "expo_wallpaper_prefs"
    const val PREF_HOUR = "alarm_hour"
    const val PREF_MINUTE = "alarm_minute"
    const val PREF_CACHE_PATH = "cache_path"
    const val PREF_ENABLED = "enabled"
    const val PREF_LAST_RUN = "last_run_millis"
    const val REQUEST_CODE = 8817

    fun getPrefs(context: Context): SharedPreferences =
      context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun scheduleNext(context: Context, hour: Int, minute: Int) {
      val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
        ?: return

      val now = Calendar.getInstance()
      val target = Calendar.getInstance().apply {
        set(Calendar.HOUR_OF_DAY, hour)
        set(Calendar.MINUTE, minute)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
      }
      if (!target.after(now)) {
        target.add(Calendar.DAY_OF_YEAR, 1)
      }

      val pi = buildPendingIntent(context)

      val triggerAt = target.timeInMillis
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          // Android 12+: use setExactAndAllowWhileIdle if we can, fall back to setWindow
          if (alarmManager.canScheduleExactAlarms()) {
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
          } else {
            // Inexact but reliable — fires within a 10-minute window
            alarmManager.setWindow(AlarmManager.RTC_WAKEUP, triggerAt, 10 * 60_000L, pi)
          }
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
          alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
        } else {
          @Suppress("DEPRECATION")
          alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAt, pi)
        }
        Log.d(TAG, "Scheduled next alarm at $hour:$minute ($triggerAt)")
      } catch (e: SecurityException) {
        Log.e(TAG, "SecurityException scheduling alarm — fallback to setWindow", e)
        alarmManager.setWindow(AlarmManager.RTC_WAKEUP, triggerAt, 10 * 60_000L, pi)
      }
    }

    fun cancel(context: Context) {
      val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
        ?: return
      alarmManager.cancel(buildPendingIntent(context))
    }

    private fun buildPendingIntent(context: Context): PendingIntent {
      val intent = Intent(context, WallpaperAlarmReceiver::class.java).apply {
        action = ACTION_FIRE
        // Explicit package for Android 8+ background broadcast safety
        setPackage(context.packageName)
      }
      val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      } else {
        PendingIntent.FLAG_UPDATE_CURRENT
      }
      return PendingIntent.getBroadcast(context, REQUEST_CODE, intent, flags)
    }

    fun applyCachedWallpaper(context: Context) {
      val prefs = getPrefs(context)
      val path = prefs.getString(PREF_CACHE_PATH, null)
      if (path.isNullOrEmpty()) {
        Log.w(TAG, "No cached wallpaper path in prefs")
        return
      }
      val file = File(path)
      if (!file.exists()) {
        Log.w(TAG, "Cached wallpaper file missing: $path")
        return
      }

      val bitmap = decodeBitmap(context, file)
      if (bitmap == null) {
        Log.w(TAG, "Failed to decode cached bitmap")
        return
      }

      val scaled = scaleBitmapToScreen(context, bitmap)
      try {
        val wm = WallpaperManager.getInstance(context) ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
          wm.setBitmap(scaled, null, true, WallpaperManager.FLAG_LOCK)
        } else {
          // Pre-API 24: FLAG_LOCK not supported — skip silently
          Log.w(TAG, "FLAG_LOCK unsupported on API ${Build.VERSION.SDK_INT}")
        }
        prefs.edit().putLong(PREF_LAST_RUN, System.currentTimeMillis()).apply()
      } catch (e: Throwable) {
        Log.e(TAG, "setBitmap failed", e)
      } finally {
        if (scaled !== bitmap) scaled.recycle()
        bitmap.recycle()
      }
    }

    private fun decodeBitmap(context: Context, file: File): Bitmap? {
      return try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
          val src = ImageDecoder.createSource(file)
          ImageDecoder.decodeBitmap(src) { decoder, _, _ ->
            decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
            decoder.isMutableRequired = true
          }
        } else {
          BitmapFactory.decodeFile(file.absolutePath)
        }
      } catch (e: Exception) {
        Log.e(TAG, "decodeBitmap failed", e)
        null
      }
    }

    private fun scaleBitmapToScreen(context: Context, source: Bitmap): Bitmap {
      val (screenW, screenH) = try {
        val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
          val b = wm.currentWindowMetrics.bounds
          b.width() to b.height()
        } else {
          val m = DisplayMetrics()
          @Suppress("DEPRECATION")
          wm.defaultDisplay.getRealMetrics(m)
          m.widthPixels to m.heightPixels
        }
      } catch (_: Throwable) {
        0 to 0
      }
      if (screenW <= 0 || screenH <= 0) return source

      val srcRatio = source.width.toFloat() / source.height.toFloat()
      val dstRatio = screenW.toFloat() / screenH.toFloat()
      val (targetW, targetH) = if (srcRatio > dstRatio) {
        screenW to (screenW / srcRatio).toInt()
      } else {
        (screenH * srcRatio).toInt() to screenH
      }
      if (targetW == source.width && targetH == source.height) return source
      return Bitmap.createScaledBitmap(
        source,
        targetW.coerceAtLeast(1),
        targetH.coerceAtLeast(1),
        true
      )
    }
  }
}

/**
 * Re-schedules the daily alarm after the device reboots. Without this,
 * AlarmManager loses all pending alarms on boot.
 */
class WallpaperBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Intent.ACTION_BOOT_COMPLETED &&
      intent.action != Intent.ACTION_LOCKED_BOOT_COMPLETED &&
      intent.action != "android.intent.action.QUICKBOOT_POWERON"
    ) {
      return
    }
    val prefs = WallpaperAlarmReceiver.getPrefs(context)
    if (!prefs.getBoolean(WallpaperAlarmReceiver.PREF_ENABLED, false)) return
    val hour = prefs.getInt(WallpaperAlarmReceiver.PREF_HOUR, -1)
    val minute = prefs.getInt(WallpaperAlarmReceiver.PREF_MINUTE, -1)
    if (hour in 0..23 && minute in 0..59) {
      WallpaperAlarmReceiver.scheduleNext(context, hour, minute)
    }
  }
}
