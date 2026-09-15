package net.bunny.reactnative.module

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap
import net.bunny.api.error.BunnyError
import net.bunny.api.collection.domain.model.VideoCollection
import net.bunny.api.collection.domain.model.VideoCollectionList
import net.bunny.api.error.BunnyResult
import net.bunny.api.livestream.domain.model.LiveStream
import net.bunny.api.livestream.domain.model.LiveStreamIngestStatus
import net.bunny.api.livestream.domain.model.LiveStreamList
import net.bunny.api.livestream.domain.model.LiveStreamPlayData
import net.bunny.api.livestream.domain.model.LiveStreamThumbnail
import net.bunny.api.settings.domain.model.PlayerSettings
import net.bunny.api.livestream.domain.model.RtmpOutput
import net.bunny.api.video.domain.model.Caption
import net.bunny.api.video.domain.model.Chapter
import net.bunny.api.video.domain.model.MetaTag
import net.bunny.api.video.domain.model.Moment
import net.bunny.api.video.domain.model.ResolutionReference
import net.bunny.api.video.domain.model.StorageObject
import net.bunny.api.video.domain.model.Video
import net.bunny.api.video.domain.model.VideoList
import net.bunny.api.video.domain.model.VideoPlayData
import net.bunny.api.video.domain.model.VideoResolutionsInfo
import net.bunny.api.video.domain.model.VideoStatistics
import net.bunny.api.video.domain.model.VideoStorageSize

/**
 * Pure functions that map the SDK's domain models and [BunnyResult] envelope to
 * React Native [WritableMap]s ready to resolve a Promise with.
 *
 * Kept separate from [BunnyStreamApiModule] so they are unit-testable on the JVM
 * without a React Native context — every function takes a domain object and
 * returns a fresh [WritableNativeMap]/[WritableNativeArray], with no side effects.
 *
 * The JS side reads these as plain objects; the TypeScript surface in
 * `src/api/models` and `src/api/result` define the contract these shapes conform to.
 */
internal object BunnyApiMappers {

  // region — BunnyResult envelope —

  /**
   * Maps a [BunnyResult] to the JS envelope `{ ok: true, value }` or
   * `{ ok: false, error }`. [valueMapper] converts the Ok payload to a
   * [WritableMap]. Unit results use [toUnitEnvelope].
   */
  fun <T> BunnyResult<T>.toEnvelope(valueMapper: (T) -> WritableMap): WritableMap {
    val out = WritableNativeMap()
    when (this) {
      is BunnyResult.Ok -> {
        out.putBoolean("ok", true)
        out.putMap("value", valueMapper(value))
      }
      is BunnyResult.Err -> {
        out.putBoolean("ok", false)
        out.putMap("error", error.toWritableMap())
      }
    }
    return out
  }

  /** Maps a result whose successful JS value is an array. */
  fun <T> BunnyResult<T>.toArrayEnvelope(valueMapper: (T) -> WritableArray): WritableMap {
    val out = WritableNativeMap()
    when (this) {
      is BunnyResult.Ok -> {
        out.putBoolean("ok", true)
        out.putArray("value", valueMapper(value))
      }
      is BunnyResult.Err -> {
        out.putBoolean("ok", false)
        out.putMap("error", error.toWritableMap())
      }
    }
    return out
  }

  /** Maps a Unit result to an envelope whose successful value is JS `null`. */
  fun BunnyResult<Unit>.toUnitEnvelope(): WritableMap = WritableNativeMap().apply {
    when (this@toUnitEnvelope) {
      is BunnyResult.Ok -> {
        putBoolean("ok", true)
        putNull("value")
      }
      is BunnyResult.Err -> {
        putBoolean("ok", false)
        putMap("error", error.toWritableMap())
      }
    }
  }

  // endregion

  // region — BunnyError taxonomy —

  /**
   * Maps a [BunnyError] subclass to `{ kind, httpStatus, message, isTerminal }`.
   * The `kind` string is the JS discriminant — see `BunnyErrorKind` in
   * `src/api/result/BunnyResult.ts`.
   */
  fun BunnyError.toWritableMap(): WritableMap = WritableNativeMap().apply {
    putString("kind", kindName())
    putInt("httpStatus", httpStatus)
    putString("message", message)
    putBoolean("isTerminal", isTerminal)
  }

  private fun BunnyError.kindName(): String = when (this) {
    is BunnyError.Network -> "Network"
    is BunnyError.Http -> "Http"
    is BunnyError.Auth -> "Auth"
    is BunnyError.NotFound -> "NotFound"
    is BunnyError.Decode -> "Decode"
    is BunnyError.LocalFile -> "LocalFile"
    is BunnyError.InvalidState -> "InvalidState"
  }

  // endregion

  // region — Video —

  fun Video.toWritableMap(): WritableMap = WritableNativeMap().apply {
    putString("id", id)
    putDouble("videoLibraryId", videoLibraryId.toDouble())
    putString("title", title)
    putString("description", description)
    putString("collectionId", collectionId)
    putString("category", category)
    putString("dateUploaded", dateUploaded)
    putBoolean("isPublic", isPublic)
    putInt("status", status.value)

    // playback and media
    putInt("lengthSeconds", lengthSeconds)
    putNullableInt("width", width)
    putNullableInt("height", height)
    putNullableDouble("framerate", framerate)
    putNullableInt("rotation", rotation)
    putStringArray("availableResolutions", availableResolutions)
    putStringArray("outputCodecs", outputCodecs)
    putBoolean("hasMp4Fallback", hasMp4Fallback)
    putBoolean("jitEncodingEnabled", jitEncodingEnabled)

    // storage and processing
    putDouble("storageSizeBytes", storageSizeBytes.toDouble())
    putInt("encodeProgress", encodeProgress)
    putBoolean("hasOriginal", hasOriginal)
    putString("originalHash", originalHash)
    putBoolean("hasHighQualityPreview", hasHighQualityPreview)

    // thumbnails
    putInt("thumbnailCount", thumbnailCount)
    putString("thumbnailFileName", thumbnailFileName)
    putString("thumbnailBlurhash", thumbnailBlurhash)

    // analytics
    putDouble("views", views.toDouble())
    putDouble("averageWatchTimeSeconds", averageWatchTimeSeconds.toDouble())
    putDouble("totalWatchTimeSeconds", totalWatchTimeSeconds.toDouble())

    // content
    putArray("captions", captions.toWritableArray { it.toWritableMap() })
    putArray("chapters", chapters.toWritableArray { it.toWritableMap() })
    putArray("moments", moments.toWritableArray { it.toWritableMap() })
    putArray("metaTags", metaTags.toWritableArray { it.toWritableMap() })
  }

  private fun Caption.toWritableMap(): WritableMap = WritableNativeMap().apply {
    putString("languageCode", languageCode)
    putString("label", label)
    putNullableInt("version", version)
  }

  private fun Chapter.toWritableMap(): WritableMap = WritableNativeMap().apply {
    putString("title", title)
    putNullableInt("startSeconds", startSeconds)
    putNullableInt("endSeconds", endSeconds)
  }

  private fun Moment.toWritableMap(): WritableMap = WritableNativeMap().apply {
    putString("label", label)
    putNullableInt("timestampSeconds", timestampSeconds)
  }

  private fun MetaTag.toWritableMap(): WritableMap = WritableNativeMap().apply {
    putString("property", property)
    putString("value", value)
  }

  fun VideoList.toWritableMap(): WritableMap = WritableNativeMap().apply {
    putDouble("totalItems", totalItems.toDouble())
    putDouble("currentPage", currentPage.toDouble())
    putInt("itemsPerPage", itemsPerPage)
    putArray("items", items.toWritableArray { it.toWritableMap() })
  }

  fun heatmapToWritableMap(heatmap: Map<String, Int>): WritableMap = WritableNativeMap().apply {
    for ((offset, viewers) in heatmap) putInt(offset, viewers)
  }

  fun VideoStatistics.toWritableMap(): WritableMap = WritableNativeMap().apply {
    putMap("viewsChart", viewsChart.toWritableMap())
    putMap("watchTimeChart", watchTimeChart.toWritableMap())
    putMap("countryViewCounts", countryViewCounts.toWritableMap())
    putMap("countryWatchTime", countryWatchTime.toWritableMap())
    putInt("engagementScore", engagementScore)
  }

  fun VideoStorageSize.toWritableMap(): WritableMap = WritableNativeMap().apply {
    putMap("encoded", WritableNativeMap().apply {
      for ((key, rendition) in encoded) {
        putMap(key, WritableNativeMap().apply {
          putString("codec", rendition.codec)
          putString("resolution", rendition.resolution)
          putDouble("sizeBytes", rendition.sizeBytes.toDouble())
        })
      }
    })
    putDouble("thumbnailsBytes", thumbnailsBytes.toDouble())
    putDouble("previewsBytes", previewsBytes.toDouble())
    putDouble("originalsBytes", originalsBytes.toDouble())
    putDouble("mp4FallbackBytes", mp4FallbackBytes.toDouble())
    putDouble("miscellaneousBytes", miscellaneousBytes.toDouble())
    putString("calculatedAt", calculatedAt)
  }

  fun VideoResolutionsInfo.toWritableMap(): WritableMap = WritableNativeMap().apply {
    putString("videoId", videoId)
    putDouble("videoLibraryId", videoLibraryId.toDouble())
    putStringArray("availableResolutions", availableResolutions)
    putStringArray("configuredResolutions", configuredResolutions)
    putArray("playlistResolutions", playlistResolutions.toWritableArray { it.toWritableMap() })
    putArray("storageResolutions", storageResolutions.toWritableArray { it.toWritableMap() })
    putArray("mp4Resolutions", mp4Resolutions.toWritableArray { it.toWritableMap() })
    putArray("storageObjects", storageObjects.toWritableArray { it.toWritableMap() })
    putArray("oldResolutions", oldResolutions.toWritableArray { it.toWritableMap() })
    putBoolean("hasBothOldAndNewResolutionFormat", hasBothOldAndNewResolutionFormat)
    putBoolean("hasOriginal", hasOriginal)
  }

  private fun ResolutionReference.toWritableMap(): WritableMap = WritableNativeMap().apply {
    putString("resolution", resolution)
    putString("path", path)
  }

  private fun StorageObject.toWritableMap(): WritableMap = WritableNativeMap().apply {
    putString("id", id)
    putString("storageZoneName", storageZoneName)
    putNullableLong("storageZoneId", storageZoneId)
    putString("path", path)
    putString("objectName", objectName)
    putDouble("lengthBytes", lengthBytes.toDouble())
    putString("dateCreated", dateCreated)
    putString("lastChanged", lastChanged)
    putBoolean("isDirectory", isDirectory)
    putString("contentType", contentType)
    putNullableInt("serverId", serverId)
    putString("userId", userId)
    putString("checksum", checksum)
    putString("replicatedZones", replicatedZones)
  }

  // endregion

  // region — Collection —

  fun VideoCollection.toWritableMap(): WritableMap = WritableNativeMap().apply {
    putString("id", id)
    putDouble("videoLibraryId", videoLibraryId.toDouble())
    putString("name", name)
    putDouble("videoCount", videoCount.toDouble())
    putDouble("totalSizeBytes", totalSizeBytes.toDouble())
    putStringArray("previewVideoIds", previewVideoIds)
    putStringArray("previewImageUrls", previewImageUrls)
  }

  fun VideoCollectionList.toWritableMap(): WritableMap = WritableNativeMap().apply {
    putDouble("totalItems", totalItems.toDouble())
    putDouble("currentPage", currentPage.toDouble())
    putInt("itemsPerPage", itemsPerPage)
    putArray("items", items.toWritableArray { it.toWritableMap() })
  }

  // endregion

  // region — LiveStream —

  fun LiveStream.toWritableMap(): WritableMap = WritableNativeMap().apply {
    putString("id", id)
    putDouble("videoLibraryId", videoLibraryId.toDouble())
    putString("title", title)
    putString("description", description)
    putString("category", category)
    putString("collectionId", collectionId)
    putBoolean("isPublic", isPublic)
    putInt("status", status.value)
    putString("dateCreated", dateCreated)
    putString("scheduledStartTime", scheduledStartTime)
    putString("scheduledEndTime", scheduledEndTime)
    putString("startedAt", startedAt)
    putString("endedAt", endedAt)
    putNullableInt("durationSeconds", durationSeconds)
    putString("streamKey", streamKey)
    putString("playbackUrlHls", playbackUrlHls)
    putBoolean("dvrEnabled", dvrEnabled)
    putNullableInt("dvrWindowSeconds", dvrWindowSeconds)
    putBoolean("recordVod", recordVod)
    putString("availableResolutions", availableResolutions)
    putNullableInt("width", width)
    putNullableInt("height", height)
    putNullableDouble("framerate", framerate)
    putString("ingestRegion", ingestRegion)
    putNullableInt("peakConcurrentViewers", peakConcurrentViewers)
    putNullableDouble("totalViewerSeconds", totalViewerSeconds?.toDouble())
    putString("thumbnailFileName", thumbnailFileName)
    putString("thumbnailUpdatedAt", thumbnailUpdatedAt)
    putNullableBoolean("enableCountdown", enableCountdown)
    putArray("rtmpOutputs", rtmpOutputs.toWritableArray { it.toWritableMap() })
    putString("preStreamTrailerVideoId", preStreamTrailerVideoId)
    putString("primaryIngestUrl", primaryIngestUrl)
    putString("backupIngestUrl", backupIngestUrl)
  }

  private fun RtmpOutput.toWritableMap(): WritableMap = WritableNativeMap().apply {
    putString("endpoint", endpoint)
    putString("streamKey", streamKey)
  }

  fun LiveStreamList.toWritableMap(): WritableMap = WritableNativeMap().apply {
    putDouble("totalItems", totalItems.toDouble())
    putDouble("currentPage", currentPage.toDouble())
    putInt("itemsPerPage", itemsPerPage)
    putArray("items", items.toWritableArray { it.toWritableMap() })
  }

  fun LiveStreamIngestStatus.toWritableMap(): WritableMap = WritableNativeMap().apply {
    putBoolean("readyToStart", readyToStart)
    putBoolean("primaryLive", primaryLive)
    putBoolean("backupLive", backupLive)
    putBoolean("isLive", primaryLive || backupLive)
    putNullableLong("lastPingAgoMs", lastPingAgoMs)
    putNullableInt("durationSeconds", durationSeconds)
    // Verified in SDK 4.0.0: LiveStreamStatusModel.statusTimeUtc exists in the
    // generated DTO but is dropped by the domain LiveStreamIngestStatus — not
    // reachable through the public repository.
    putNull("statusTime")
  }

  fun LiveStreamThumbnail.toWritableMap(): WritableMap = WritableNativeMap().apply {
    putString("url", url)
    putString("timestamp", timestamp)
  }

  fun liveStreamThumbnailsToWritableArray(thumbnails: List<LiveStreamThumbnail>): WritableArray =
    thumbnails.toWritableArray { it.toWritableMap() }

  // endregion

  // region — PlayData —

  fun VideoPlayData.toWritableMap(): WritableMap = WritableNativeMap().apply {
    putMap("video", video?.toWritableMap())
    putString("libraryName", libraryName)
    putString("captionsPath", captionsPath)
    putString("seekPath", seekPath)
    putString("thumbnailUrl", thumbnailUrl)
    putString("fallbackUrl", fallbackUrl)
    putString("videoPlaylistUrl", videoPlaylistUrl)
    putString("originalUrl", originalUrl)
    putString("previewUrl", previewUrl)
    putString("controls", controls)
    putBoolean("enableDRM", enableDRM)
    putInt("drmVersion", drmVersion)
    putInt("keyColor", keyColor)
    putString("vastTagUrl", vastTagUrl)
    putString("viAiPublisherId", viAiPublisherId)
    putInt("captionsFontSize", captionsFontSize)
    putNullableInt("captionsFontColor", captionsFontColor)
    putNullableInt("captionsBackgroundColor", captionsBackgroundColor)
    putString("uiLanguage", uiLanguage)
    putBoolean("allowEarlyPlay", allowEarlyPlay)
    putBoolean("tokenAuthEnabled", tokenAuthEnabled)
    putBoolean("enableMP4Fallback", enableMP4Fallback)
    putBoolean("showHeatmap", showHeatmap)
    putString("fontFamily", fontFamily)
    putDoubleArray("playbackSpeeds", playbackSpeeds)
    putNullableInt("widevineMinClientSecurityLevel", widevineMinClientSecurityLevel)
    putNullableInt("zoneTier", zoneTier)
    putBoolean("isPlayable", isPlayable)
    putBoolean("isPlaylistPlayable", isPlaylistPlayable)
    putString("preferredPlaybackSource", preferredPlaybackSource?.name)
    putBoolean("rememberPlayerPosition", rememberPlayerPosition)
    putString("customCss", customCss)
    putBoolean("exposeVideoMetadata", exposeVideoMetadata)
    putBoolean("enableCompactControls", enableCompactControls)
  }

  fun LiveStreamPlayData.toWritableMap(): WritableMap = WritableNativeMap().apply {
    putMap("liveStream", liveStream?.toWritableMap())
    putString("libraryName", libraryName)
    putString("captionsPath", captionsPath)
    putString("seekPath", seekPath)
    putString("thumbnailUrl", thumbnailUrl)
    putString("fallbackUrl", fallbackUrl)
    putString("videoPlaylistUrl", videoPlaylistUrl)
    putString("originalUrl", originalUrl)
    putString("previewUrl", previewUrl)
    putString("controls", controls)
    putBoolean("enableDRM", enableDRM)
    putInt("drmVersion", drmVersion)
    putInt("keyColor", keyColor)
    putString("vastTagUrl", vastTagUrl)
    putInt("captionsFontSize", captionsFontSize)
    putNullableInt("captionsFontColor", captionsFontColor)
    putNullableInt("captionsBackgroundColor", captionsBackgroundColor)
    putString("uiLanguage", uiLanguage)
    putBoolean("allowEarlyPlay", allowEarlyPlay)
    putBoolean("tokenAuthEnabled", tokenAuthEnabled)
    putBoolean("enableMP4Fallback", enableMP4Fallback)
    putBoolean("showHeatmap", showHeatmap)
    putString("fontFamily", fontFamily)
    putDoubleArray("playbackSpeeds", playbackSpeeds)
    putNullableInt("widevineMinClientSecurityLevel", widevineMinClientSecurityLevel)
    putNullableInt("zoneTier", zoneTier)
    putBoolean("rememberPlayerPosition", rememberPlayerPosition)
    putBoolean("enableCompactControls", enableCompactControls)
  }

  // endregion

  // region — PlayerSettings —

  fun PlayerSettings.toWritableMap(): WritableMap = WritableNativeMap().apply {
    putString("thumbnailUrl", thumbnailUrl)
    putString("controls", controls)
    putInt("keyColor", keyColor)
    putInt("captionsFontSize", captionsFontSize)
    putNullableInt("captionsFontColor", captionsFontColor)
    putNullableInt("captionsBackgroundColor", captionsBackgroundColor)
    putString("uiLanguage", uiLanguage)
    putBoolean("showHeatmap", showHeatmap)
    putString("fontFamily", fontFamily)
    putDoubleArray("playbackSpeeds", playbackSpeeds)
    putBoolean("drmEnabled", drmEnabled)
    putString("vastTagUrl", vastTagUrl)
    putString("videoUrl", videoUrl)
    putString("seekPath", seekPath)
    putString("captionsPath", captionsPath)
    putDouble("resumePosition", resumePosition.toDouble())
  }

  // endregion

  // region — WritableMap helpers —

  private fun WritableMap.putNullableInt(key: String, value: Int?) {
    if (value == null) putNull(key) else putInt(key, value)
  }

  private fun WritableMap.putNullableDouble(key: String, value: Double?) {
    if (value == null) putNull(key) else putDouble(key, value)
  }

  private fun WritableMap.putNullableLong(key: String, value: Long?) {
    if (value == null) putNull(key) else putDouble(key, value.toDouble())
  }

  private fun WritableMap.putNullableBoolean(key: String, value: Boolean?) {
    if (value == null) putNull(key) else putBoolean(key, value)
  }

  private fun WritableMap.putStringArray(key: String, values: List<String>) {
    val array = WritableNativeArray()
    for (v in values) array.pushString(v)
    putArray(key, array)
  }

  private fun WritableMap.putDoubleArray(key: String, values: List<Float>) {
    val array = WritableNativeArray()
    for (v in values) array.pushDouble(v.toDouble())
    putArray(key, array)
  }

  private fun Map<String, Long>.toWritableMap(): WritableMap = WritableNativeMap().apply {
    for ((key, value) in this@toWritableMap) putDouble(key, value.toDouble())
  }

  private fun <T> List<T>.toWritableArray(mapper: (T) -> WritableMap): WritableArray {
    val array = WritableNativeArray()
    for (item in this) array.pushMap(mapper(item))
    return array
  }

  // endregion

  /**
   * Builds an `Err` envelope directly from a [BunnyError], for the
   * not-initialized guard and other bridge-side failures that never reach a
   * repository.
   */
  fun errEnvelope(error: BunnyError): WritableMap {
    val out = WritableNativeMap()
    out.putBoolean("ok", false)
    out.putMap("error", error.toWritableMap())
    return out
  }

  /** Convenience for `Arguments.createMap()` callers that need a fresh map. */
  fun createMap(): WritableMap = Arguments.createMap()
}
