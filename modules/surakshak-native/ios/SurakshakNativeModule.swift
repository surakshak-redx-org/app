import ExpoModulesCore

/**
 * iOS stubs for SurakshakNative.
 *
 * Apple does not allow either of these without a user tap — this is an OS
 * restriction enforced at the kernel level, not a gap in this module:
 *  - `sendSms`: no API sends SMS without presenting the compose sheet.
 *    The JS layer (`src/services/sms.service.ts`) falls back to `expo-sms`
 *    on iOS instead of calling into this module.
 *  - `placeCall`: no API places a call without the system dialer UI.
 *    The JS layer (`src/utils/phone.utils.ts`) falls back to
 *    `Linking.openURL('tel:...')` on iOS instead of calling into this module.
 *
 * These functions exist so the module has a matching iOS implementation, and
 * so a stray Android-only call site fails loudly instead of silently no-oping.
 */
public class SurakshakNativeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SurakshakNative")

    AsyncFunction("sendSms") { (_ phoneNumber: String, _ message: String) -> String in
      throw IosRestrictionError(
        "Direct SMS is not possible on iOS (Apple OS policy). Use the expo-sms compose sheet from JS instead."
      )
    }

    AsyncFunction("checkSmsPermission") { () -> Bool in
      true
    }

    AsyncFunction("placeCall") { (_ phoneNumber: String) -> String in
      throw IosRestrictionError(
        "Direct call is not possible on iOS (Apple OS policy). Use Linking.openURL('tel:...') from JS instead."
      )
    }
  }
}

struct IosRestrictionError: Error, CustomStringConvertible {
  let description: String
  init(_ description: String) {
    self.description = description
  }
}
