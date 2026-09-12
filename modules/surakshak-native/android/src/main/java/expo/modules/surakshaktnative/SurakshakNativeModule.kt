package expo.modules.surakshaktnative

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.telephony.SmsManager
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SurakshakNativeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SurakshakNative")

    /**
     * Send SMS directly in the background with no compose UI and no user
     * interaction. Requires the `SEND_SMS` permission (declared in
     * app.config.ts). Long messages (>160 chars) are split automatically.
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

        if (message.length > SMS_SINGLE_PART_LIMIT) {
          val parts = smsManager.divideMessage(message)
          smsManager.sendMultipartTextMessage(phoneNumber, null, parts, null, null)
        } else {
          smsManager.sendTextMessage(phoneNumber, null, message, null, null)
        }
        promise.resolve("sent")
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

  companion object {
    private const val SMS_SINGLE_PART_LIMIT = 160
  }
}
