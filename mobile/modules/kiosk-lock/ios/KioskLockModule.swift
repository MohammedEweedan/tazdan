import ExpoModulesCore
import UIKit

/// Till kiosks: keep the device in the app until a manager unlocks it.
///
/// iOS only allows an app to start Single App Mode itself on a supervised
/// device with the app allowed by MDM ("Autonomous Single App Mode").
/// Otherwise `lock` returns false and the manager turns Guided Access on
/// (triple-click the side button); then only the Guided Access passcode or
/// this app's unlock — after the manager PIN — ends it.
public class KioskLockModule: Module {
  public func definition() -> ModuleDefinition {
    Name("KioskLock")

    AsyncFunction("isLocked") { () -> Bool in
      UIAccessibility.isGuidedAccessEnabled
    }.runOnQueue(.main)

    AsyncFunction("lock") { (promise: Promise) in
      UIAccessibility.requestGuidedAccessSession(enabled: true) { ok in promise.resolve(ok) }
    }.runOnQueue(.main)

    AsyncFunction("unlock") { (promise: Promise) in
      UIAccessibility.requestGuidedAccessSession(enabled: false) { ok in promise.resolve(ok) }
    }.runOnQueue(.main)
  }
}
