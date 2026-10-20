package expo.modules.surakshaktnative

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

class FakeCallAlarmReceiver : BroadcastReceiver() {

  override fun onReceive(context: Context, intent: Intent) {
    val callerName = intent.getStringExtra(EXTRA_CALLER_NAME)
      ?: "Incoming Call"
      context.getSharedPreferences("fake_call", Context.MODE_PRIVATE)
  .edit()
  .putString(EXTRA_CALLER_NAME, callerName)
  .putBoolean("pending_fake_call", true)
  .apply()

    val notificationManager =
      context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      notificationManager.createNotificationChannel(
        NotificationChannel(
          CHANNEL_ID,
          "Scheduled Fake Calls",
          NotificationManager.IMPORTANCE_HIGH
        ).apply {
          description = "Incoming calls scheduled by the user"
          lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
        }
      )
    }

    val launchIntent = context.packageManager
      .getLaunchIntentForPackage(context.packageName)
      ?.apply {
        action = ACTION_FAKE_CALL
        putExtra(EXTRA_CALLER_NAME, callerName)
        addFlags(
          Intent.FLAG_ACTIVITY_NEW_TASK or
            Intent.FLAG_ACTIVITY_SINGLE_TOP or
            Intent.FLAG_ACTIVITY_CLEAR_TOP
        )
      } ?: return

    val fullScreenIntent = PendingIntent.getActivity(
      context,
      REQUEST_CODE,
      launchIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(context.applicationInfo.icon)
      .setContentTitle(callerName)
      .setContentText("Incoming call")
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setFullScreenIntent(fullScreenIntent, true)
      .setAutoCancel(true)
      .build()

    try {
      NotificationManagerCompat.from(context)
        .notify(NOTIFICATION_ID, notification)
    } catch (_: SecurityException) {
      // Notification permission is not granted.
      // The app must request permission before scheduling calls.
    }
  }

    companion object {
    const val ACTION_SCHEDULE_FAKE_CALL =
      "expo.modules.surakshaktnative.ACTION_SCHEDULE_FAKE_CALL"

    const val ACTION_FAKE_CALL =
      "expo.modules.surakshaktnative.ACTION_FAKE_CALL"

    const val EXTRA_CALLER_NAME = "fake_call_caller_name"

    const val CHANNEL_ID = "scheduled_fake_calls"
    const val NOTIFICATION_ID = 111
    const val REQUEST_CODE = 111

    private const val EXTRA_DELAY_MS = "fake_call_delay_ms"

    fun schedule(context: Context, delayMs: Long, callerName: String) {
      require(delayMs > 0) { "Delay must be greater than zero" }

      val alarmManager =
        context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

      val intent = Intent(context, FakeCallAlarmReceiver::class.java).apply {
        action = ACTION_SCHEDULE_FAKE_CALL
        putExtra(EXTRA_CALLER_NAME, callerName)
      }

      val pendingIntent = PendingIntent.getBroadcast(
        context,
        REQUEST_CODE,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )

      val triggerAt = System.currentTimeMillis() + delayMs

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
          alarmManager.canScheduleExactAlarms()
      ) {
        alarmManager.setExactAndAllowWhileIdle(
          AlarmManager.RTC_WAKEUP,
          triggerAt,
          pendingIntent
        )
      } else {
        alarmManager.setAndAllowWhileIdle(
          AlarmManager.RTC_WAKEUP,
          triggerAt,
          pendingIntent
        )
      }
    }

    fun cancel(context: Context) {
      val alarmManager =
        context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

      val intent = Intent(context, FakeCallAlarmReceiver::class.java).apply {
        action = ACTION_SCHEDULE_FAKE_CALL
      }

      val pendingIntent = PendingIntent.getBroadcast(
        context,
        REQUEST_CODE,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )

      alarmManager.cancel(pendingIntent)
      pendingIntent.cancel()
    }
  }
}