package net.bunny.reactnative.events

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
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
 * The emitter captures the `surfaceId` at construction time and resolves the
 * view tag at dispatch time, after React Native has assigned it to the view.
 */
class FabricEventEmitter(
  private val eventDispatcher: EventDispatcher,
  private val surfaceId: Int,
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
    eventDispatcher.dispatchEvent(
      object : Event<Nothing>() {
        init {
          init(surfaceId, viewTag)
        }

        override fun getEventName(): String = event.eventName

        override fun canCoalesce(): Boolean = coalesce

        override fun getEventData(): WritableMap? {
          val map = Arguments.createMap()
          event.payloadBuilder().forEach { (key, value) ->
            when (value) {
              null -> map.putNull(key)
              is Boolean -> map.putBoolean(key, value)
              is Int -> map.putInt(key, value)
              is Long -> map.putDouble(key, value.toDouble())
              is Float -> map.putDouble(key, value.toDouble())
              is Double -> map.putDouble(key, value)
              is String -> map.putString(key, value)
              else -> map.putString(key, value.toString())
            }
          }
          return map
        }
      },
    )
  }

  companion object {
    /**
     * Creates an emitter for [view], or returns `null` if the event dispatcher
     * is unavailable (e.g. during teardown).
     */
    fun forView(view: android.view.View): FabricEventEmitter? {
      val context = view.context as? com.facebook.react.bridge.ReactContext ?: return null
      val dispatcher = UIManagerHelper.getEventDispatcher(context) ?: return null
      val surfaceId = UIManagerHelper.getSurfaceId(context)
      return FabricEventEmitter(dispatcher, surfaceId, view)
    }
  }
}
