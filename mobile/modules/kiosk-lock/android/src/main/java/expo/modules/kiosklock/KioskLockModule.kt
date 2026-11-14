package expo.modules.kiosklock

import android.app.ActivityManager
import android.content.Context
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Till kiosks: pin the app to the screen (lock task mode). As a device owner
 * (dedicated device) this is a full lock; otherwise Android shows its
 * screen-pinning prompt and unpinning asks for the device PIN when
 * "Ask for PIN before unpinning" is on.
 */
class KioskLockModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("KioskLock")

    AsyncFunction("isLocked") {
      val am = appContext.reactContext?.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
      (am?.lockTaskModeState ?: ActivityManager.LOCK_TASK_MODE_NONE) != ActivityManager.LOCK_TASK_MODE_NONE
    }

    AsyncFunction("lock") {
      val activity = appContext.currentActivity ?: return@AsyncFunction false
      activity.startLockTask()
      true
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("unlock") {
      val activity = appContext.currentActivity ?: return@AsyncFunction false
      activity.stopLockTask()
      true
    }.runOnQueue(Queues.MAIN)
  }
}
