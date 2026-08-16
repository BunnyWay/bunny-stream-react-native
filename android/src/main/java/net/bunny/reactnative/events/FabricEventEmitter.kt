package net.bunny.reactnative.events

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.events.Event
import com.facebook.react.uimanager.events.EventDispatcher
import net.bunny.reactnative.state.RnEvent

/**
 * Thin wrapper over the Fabric [EventDispatcher] that builds [WritableMap]
 * payloads from [RnEvent]s and dispatches them as direct events.
 *
 * Coalescing: `onProgress` events use the view tag as the coalescing key so
 * that newer progress updates overwrite older ones within the same frame.
 * All other events have coalescing disabled (`canCoalesce = false`) to
 * preserve ordering guarantees required by the state machine.
 *
 * The emitter resolves the view tag at dispatch time, after React Native
 * has assigned it to the view.
 */
class FabricEventEmitter(
  private val eventDispatcher: EventDispatcher,
  private val view: android.view.View,
) {
  /**
   * Dispatches [event] to JS. The payload is built lazily via
   * [RnEvent.payloadBuilder] only if the event is not coalesced away.
   */
  fun dispatch(event: RnEvent) {
    val coalesce = event.eventName == "onProgress"
    val viewTag = view.id
    if (viewTag == android.view.View.NO_ID) return
    val nativeEventName = event.eventName.removePrefix("on").let { "top$it" }
    eventDispatcher.dispatchEvent(object : Event<Nothing>() {
      // The Java ViewManager uses RN's Fabric interop path. Omitting a
      // surface ID makes EventDispatcher route this through the compatible
      // emitter, which resolves the ViewManager's direct-event registration.
      init { init(-1, viewTag) }
      override fun getEventName(): String = nativeEventName
      override fun canCoalesce(): Boolean = coalesce
      override fun getEventData() = Arguments.createMap().apply {
        event.payloadBuilder().forEach { (key, value) ->
          when (value) {
            null -> putNull(key)
            is Boolean -> putBoolean(key, value)
            is Int -> putInt(key, value)
            is Long -> putDouble(key, value.toDouble())
            is Float -> putDouble(key, value.toDouble())
            is Double -> putDouble(key, value)
            is String -> putString(key, value)
            else -> putString(key, value.toString())
          }
        }
      }
    })
  }

  companion object {
    /**
     * Creates an emitter for [view], or returns `null` if the event dispatcher
     * is unavailable (e.g. during teardown).
     */
    fun forView(view: android.view.View): FabricEventEmitter? {
      val context = view.context as? ReactContext ?: return null
      val dispatcher = UIManagerHelper.getEventDispatcher(context) ?: return null
      return FabricEventEmitter(dispatcher, view)
    }
  }
}
