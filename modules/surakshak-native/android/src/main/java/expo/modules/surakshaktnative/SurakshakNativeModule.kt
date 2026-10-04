package expo.modules.surakshaktnative

import android.Manifest
import android.app.Activity
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.telephony.SmsManager
import androidx.core.content.ContextCompat
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SurakshakNativeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SurakshakNative")

    /**
     * Send SMS directly in the background with no compose UI and no user
     * interaction. Requires the `SEND_SMS` permission (declared in
     * app.config.ts, requested at runtime from JS).
     *
     * The message is always run through `divideMessage`: a 160-character
     * check is wrong for anything containing Devanagari (UCS-2 segments
     * hold 70), and an oversized single part is dropped by the radio
     * without an error. Each part carries a sent-PendingIntent so the
     * promise reports what the radio actually did instead of resolving
     * "sent" the moment the request is queued.
     */
    AsyncFunction("sendSms") { phoneNumber: String, message: String, promise: expo.modules.kotlin.Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject("NO_CONTEXT", "No React context", null)
        return@AsyncFunction
      }

      if (ContextCompat.checkSelfPermission(context, Manifest.permission.SEND_SMS)
          != PackageManager.PERMISSION_GRANTED
      ) {
        promise.reject(
          "PERMISSION_DENIED",
          "SEND_SMS permission not granted. Ensure android.permission.SEND_SMS is in app.config.ts.",
          null,
        )
        return@AsyncFunction
      }

      if (phoneNumber.isBlank()) {
        promise.reject("INVALID_PHONE", "Phone number cannot be empty", null)
        return@AsyncFunction
      }

      try {
        val smsManager = context.getSystemService(SmsManager::class.java) ?: SmsManager.getDefault()
        val parts = smsManager.divideMessage(message)
        sendWithResult(context, smsManager, phoneNumber, parts, promise)
      } catch (e: Exception) {
        promise.reject("SMS_FAILED", "Failed to send SMS: ${e.message}", e)
      }
    }

    AsyncFunction("checkSmsPermission") { promise: expo.modules.kotlin.Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.resolve(false)
        return@AsyncFunction
      }
      val granted =
        ContextCompat.checkSelfPermission(context, Manifest.permission.SEND_SMS) ==
          PackageManager.PERMISSION_GRANTED
      promise.resolve(granted)
    }

    /**
     * Place a call directly via `Intent.ACTION_CALL` — no dialer, no prompt.
     * Requires the `CALL_PHONE` permission (declared in app.config.ts).
     */
    AsyncFunction("placeCall") { phoneNumber: String, promise: expo.modules.kotlin.Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject("NO_CONTEXT", "No React context", null)
        return@AsyncFunction
      }

      if (ContextCompat.checkSelfPermission(context, Manifest.permission.CALL_PHONE)
          != PackageManager.PERMISSION_GRANTED
      ) {
        promise.reject(
          "PERMISSION_DENIED",
          "CALL_PHONE permission not granted. Ensure android.permission.CALL_PHONE is in app.config.ts.",
          null,
        )
        return@AsyncFunction
      }

      if (phoneNumber.isBlank()) {
        promise.reject("INVALID_PHONE", "Phone number cannot be empty", null)
        return@AsyncFunction
      }

      try {
        val intent =
          Intent(Intent.ACTION_CALL).apply {
            data = Uri.parse("tel:${phoneNumber.trim()}")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
          }
        context.startActivity(intent)
        promise.resolve("calling")
      } catch (e: Exception) {
        promise.reject("CALL_FAILED", "Failed to place call: ${e.message}", e)
      }
    }
  }

  /**
   * Sends `parts` and settles `promise` once every part reports back (or
   * once [SEND_RESULT_TIMEOUT_MS] passes — some OEM builds never fire the
   * sent intent, and an SOS must not hang on that; the message was handed
   * to the radio, so it resolves as sent-unconfirmed).
   */
  private fun sendWithResult(
    context: Context,
    smsManager: SmsManager,
    phoneNumber: String,
    parts: ArrayList<String>,
    promise: expo.modules.kotlin.Promise,
  ) {
    val action = "${context.packageName}.SMS_SENT.${UUID.randomUUID()}"
    val remaining = AtomicInteger(parts.size)
    val settled = AtomicBoolean(false)
    val handler = Handler(Looper.getMainLooper())
    var failureCode: Int? = null

    lateinit var receiver: BroadcastReceiver
    fun settle(block: () -> Unit) {
      if (settled.compareAndSet(false, true)) {
        handler.removeCallbacksAndMessages(action)
        try {
          context.unregisterReceiver(receiver)
        } catch (_: IllegalArgumentException) {
          // Already unregistered.
        }
        block()
      }
    }

    receiver =
      object : BroadcastReceiver() {
        override fun onReceive(ctx: Context, intent: Intent) {
          if (resultCode != Activity.RESULT_OK) failureCode = resultCode
          if (remaining.decrementAndGet() > 0) return
          val code = failureCode
          settle {
            if (code == null) {
              promise.resolve("sent")
            } else {
              promise.reject("SMS_FAILED", "Radio reported send failure (code $code)", null)
            }
          }
        }
      }
    ContextCompat.registerReceiver(
      context,
      receiver,
      IntentFilter(action),
      ContextCompat.RECEIVER_NOT_EXPORTED,
    )

    val sentIntents =
      ArrayList(
        parts.indices.map { index ->
          PendingIntent.getBroadcast(
            context,
            index,
            Intent(action).setPackage(context.packageName),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
          )
        },
      )

    handler.postAtTime(
      { settle { promise.resolve("sent_unconfirmed") } },
      action,
      android.os.SystemClock.uptimeMillis() + SEND_RESULT_TIMEOUT_MS,
    )

    try {
      if (parts.size > 1) {
        smsManager.sendMultipartTextMessage(phoneNumber, null, parts, sentIntents, null)
      } else {
        smsManager.sendTextMessage(phoneNumber, null, parts.firstOrNull() ?: "", sentIntents[0], null)
      }
    } catch (e: Exception) {
      settle { promise.reject("SMS_FAILED", "Failed to send SMS: ${e.message}", e) }
    }
  }

  companion object {
    private const val SEND_RESULT_TIMEOUT_MS = 30_000L
  }
}
