package net.bunny.reactnative.state

internal fun requiresLiveSpeedReset(isLivePlaybackActive: Boolean, speed: Float): Boolean =
  isLivePlaybackActive && speed != 1.0f
