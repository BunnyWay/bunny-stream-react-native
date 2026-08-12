package net.bunny.reactnative.state

/**
 * Immutable snapshot of the React Native component props.
 *
 * Stored on the wrapper view and compared with `==` (Kotlin data class equality)
 * to decide whether a video reload is needed. Mutations arrive as individual
 * setter calls from the ViewManager delegate; the view accumulates them in
 * mutable fields and snapshots an instance of this class in [commitProps].
 *
 * `libraryId`, `token`, and `expires` are nullable to match the Codegen contract
 * (`libraryId?`, `token?`, `expires?`). `autoPlay` defaults to `true` per
 * `WithDefault<boolean, true>`.
 */
data class BunnyStreamPlayerProps(
  val videoId: String,
  val libraryId: Long?,
  val token: String?,
  val expires: Long?,
  val autoPlay: Boolean,
) {
  companion object {
    /**
     * Sentinel used before the first props commit. A video with empty `videoId`
     * is never loaded — [commitProps] skips reload when `videoId` is blank.
     */
    val EMPTY = BunnyStreamPlayerProps(
      videoId = "",
      libraryId = null,
      token = null,
      expires = null,
      autoPlay = true,
    )
  }
}
