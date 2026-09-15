package net.bunny.reactnative.state

import net.bunny.api.playback.PlaybackPosition
import org.json.JSONObject

/**
 * Serializes the SDK's [PlaybackPosition] to the public JS shape
 * (`position`/`duration` become `positionMs`/`durationMs`). Shared by the
 * player view's `onResumePositionAvailable` event and the TurboModule's
 * `getAllSavedPositions` query — Codegen events/methods cannot carry arrays
 * or custom classes, so both paths use JSON strings.
 */
internal fun PlaybackPosition.toJsonString(): String {
  return JSONObject().apply {
    put("videoId", videoId)
    put("positionMs", position)
    put("durationMs", duration)
    put("watchPercentage", watchPercentage.toDouble())
    put("timestamp", timestamp)
    if (videoTitle.isNotEmpty()) put("videoTitle", videoTitle)
  }.toString()
}
