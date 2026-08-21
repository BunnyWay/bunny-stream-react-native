package net.bunny.reactnative.view

import android.content.Context
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import androidx.lifecycle.findViewTreeLifecycleOwner
import androidx.lifecycle.setViewTreeLifecycleOwner
import androidx.lifecycle.setViewTreeViewModelStoreOwner
import net.bunny.bunnystreamplayer.livestream.BunnyLiveStreamPlayer
import net.bunny.reactnative.events.FabricEventEmitter
import net.bunny.reactnative.ownership.BunnyPlayerLease
import net.bunny.reactnative.state.RnEvent

/**
 * React Native Fabric wrapper that hosts the SDK's Compose
 * [BunnyLiveStreamPlayer] composable inside a [ComposeView].
 *
 * The SDK ships live playback as a Compose composable (not a classic `View`),
 * so the bridge cannot reuse the VOD `BunnyStreamPlayerView` path. Instead we:
 *
 *  1. Wrap a [ComposeView] in this `FrameLayout`.
 *  2. Propagate `LifecycleOwner` and `ViewModelStoreOwner` from a bridge-owned
 *     [HostingLifecycleOwner] to the Compose tree (the composable calls
 *     `viewModel(...)` and `collectAsStateWithLifecycle()`, both of which need
 *     those owners present in the view tree). `SavedStateRegistryOwner` is not
 *     set — the SDK live composable does not use `rememberSaveable`, and
 *     `ComposeView` creates its own `SavedStateRegistryOwner` from the
 *     `LifecycleOwner` when one is not found in the view tree.
 *  3. Render [BunnyLiveStreamPlayer] with the source props. The composable
 *     owns polling, the state resolver, countdown/trailer overlays, DVR,
 *     recovery and the live → VOD hand-off — the bridge does not reimplement
 *     any of it (PLAN.md §6 Faza 4: no resolver/polling duplication in JS).
 *  4. Forward `onVideoSizeChanged` and `onPlaybackError` to JS via the Fabric
 *     emitter.
 *
 * Source changes (`streamId`/`libraryId`/`token`/`expires`) trigger a
 * controlled recomposition: the composable's `LaunchedEffect(libraryId,
 * streamId)` re-runs and calls `viewModel.start(...)`, which is idempotent for
 * the same `streamId` but starts a new stream when the id changes. Because the
 * SDK ViewModel ignores a second `start()` with a different stream (see
 * `BunnyLiveStreamPlayerViewModel`), the ViewManager remounts this view on
 * `streamId` change via a `key` prop in the public TS wrapper (PLAN.md §5
 * Faza 6: reset on source identity change).
 *
 * Lifecycle: the composable's `DisposableEffect` observes
 * `LocalLifecycleOwner.current` (our [HostingLifecycleOwner]) and calls
 * `viewModel.onForeground()/onBackground()` on ON_START/ON_STOP. We forward
 * the **host Activity's** ON_START/ON_STOP to our hosting owner so polling
 * pauses when the app goes to background (not just when the view detaches).
 * On detach we additionally dispatch ON_STOP as a safety net.
 *
 * Lease: the live composable internally creates a [BunnyStreamPlayer] which
 * uses the `DefaultBunnyPlayer` singleton — the same engine the VOD path
 * uses. We acquire a [BunnyPlayerLease] on attach so that mounting a live
 * view revokes any active VOD lease (and vice versa). This does NOT fully
 * isolate the engines (the live composable's internal `BunnyStreamPlayer`
 * bypasses the bridge), but it ensures the VOD view cleans up when live
 * mounts. Concurrent VOD + live is not supported.
 *
 * Cleanup: `onDropViewInstance` calls [cleanup], which dispatches
 * `ON_DESTROY` (disposing the composition, cancelling polling and releasing
 * the player), clears the ViewModelStore (cancelling `viewModelScope`), and
 * releases the lease.
 */
class BunnyLiveStreamPlayerView(
  context: Context,
) : FrameLayout(context) {

  /** Event emitter for Fabric direct events. Null if not a ReactContext. */
  private val emitter: FabricEventEmitter? = FabricEventEmitter.forView(this)

  /**
   * Owner that provides `Lifecycle` and `ViewModelStore` to the Compose tree
   * hosted in [composeView]. We create our own (rather than reusing the
   * Activity's) so that disposing this view's composition does not tear down
   * the host Activity's state, and so the bridge can explicitly start/stop
   * the lifecycle when the view attaches/detaches or the app goes to
   * background/foreground.
   */
  private val hostingOwner = HostingLifecycleOwner()

  /**
   * Lease on the `DefaultBunnyPlayer` singleton. Acquired on attach, released
   * on cleanup. Ensures the VOD view is revoked when live mounts.
   */
  private var lease: BunnyPlayerLease? = null

  /**
   * Observer on the host Activity's lifecycle, used to forward ON_START/ON_STOP
   * to [hostingOwner] so polling pauses when the app goes to background.
   * Removed on detach.
   */
  private var activityLifecycle: LifecycleOwner? = null
  private var activityObserver: LifecycleEventObserver? = null

  /** The Compose host. Added as the only child, sized to fill. */
  private val composeView: ComposeView = ComposeView(context).also { cv ->
    // Propagate owners to the ComposeView so the SDK composable's
    // viewModel() / collectAsStateWithLifecycle() find them in the view tree.
    cv.setViewTreeLifecycleOwner(hostingOwner)
    cv.setViewTreeViewModelStoreOwner(hostingOwner)
    // Dispose the composition when the lifecycle reaches DESTROYED — Fabric
    // can detach/reattach during recycle, and we don't want a dangling
    // composition holding a player. The composable's DisposableEffect runs
    // its cleanup (viewModel.onBackground) on dispose.
    cv.setViewCompositionStrategy(
      ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed,
    )
    addView(cv, LayoutParams(MATCH_PARENT, MATCH_PARENT))
  }

  /** Latest committed source props. */
  private var source: LiveSource = LiveSource.Empty

  /** Idempotent cleanup guard. */
  private var cleanedUp = false

  init {
    // Propagate our hosting owner down from this FrameLayout too, so any
    // view-tree walk that starts above composeView still finds the owners.
    setViewTreeLifecycleOwner(hostingOwner)
    setViewTreeViewModelStoreOwner(hostingOwner)
  }

  // --- Prop accumulation ---

  private var pendingLibraryId: Long = 0L
  private var pendingStreamId: String = ""
  private var pendingToken: String? = null
  private var pendingExpires: Long? = null

  fun setLibraryId(value: Double) {
    if (value.isFinite() && value > 0 && value % 1.0 == 0.0) {
      pendingLibraryId = value.toLong()
    }
  }

  fun setStreamId(value: String?) {
    pendingStreamId = value.orEmpty()
  }

  fun setToken(value: String?) {
    pendingToken = value
  }

  fun setExpires(value: Double) {
    if (value.isFinite() && value >= 0 && value % 1.0 == 0.0) {
      pendingExpires = value.toLong()
    } else {
      pendingExpires = null
    }
  }

  /**
   * Snapshots accumulated props and (re)composes if the source identity
   * changed. Called from the ViewManager's `onAfterUpdateTransaction`.
   */
  fun commitProps() {
    val next = LiveSource(
      libraryId = pendingLibraryId,
      streamId = pendingStreamId,
      token = pendingToken,
      expires = pendingExpires,
    )
    val prev = source
    source = next
    if (next == prev) return
    if (next.streamId.isBlank()) return
    composeView.setContent { LivePlayerContent(next) }
  }

  /**
   * The Compose content: a thin wrapper that forwards `onVideoSizeChanged`
   * to the Fabric emitter and renders the SDK composable.
   *
   * `onPlaybackError` is NOT forwarded because the public
   * [BunnyLiveStreamPlayer] composable does not expose it — the SDK handles
   * live errors internally via its own overlay (terminalError state in
   * `BunnyLiveStreamPlayerViewModel`). JS consumers should dismiss loading
   * on `onVideoSizeChange` (first frame) and rely on the SDK's native error
   * overlay for failure cases.
   */
  @Composable
  private fun LivePlayerContent(src: LiveSource) {
    val em = emitter
    val onSize: ((Int, Int) -> Unit)? = em?.let { e ->
      { width, height ->
        e.dispatch(
          RnEvent("onVideoSizeChange") {
            mapOf("width" to width, "height" to height)
          },
        )
      }
    }
    // remember(src) so the lambda identity is stable for a given source —
    // avoids unnecessary recompositions of the SDK composable.
    val rememberedOnSize = remember(src) { onSize }
    BunnyLiveStreamPlayer(
      libraryId = src.libraryId,
      streamId = src.streamId,
      token = src.token,
      expires = src.expires,
      modifier = Modifier,
      onVideoSizeChanged = rememberedOnSize,
    )
  }

  // --- Lifecycle ---

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    // Acquire the player lease — revokes any active VOD lease so the VOD
    // view cleans up. The live composable uses the same DefaultBunnyPlayer
    // singleton internally; concurrent VOD + live is not supported.
    if (lease == null) {
      lease = BunnyPlayerLease(onRevoke = {
        // Another view (VOD) is taking ownership — pause our polling.
        hostingOwner.handleLifecycleEvent(Lifecycle.Event.ON_STOP)
      }).also { it.acquire() }
    }

    // Track the host Activity's lifecycle so polling pauses when the app
    // goes to background (not just when the view detaches). We look up
    // the parent's lifecycle owner because we set our own on `this`.
    val activityOwner = findActivityLifecycleOwner()
    if (activityOwner != null && activityLifecycle !== activityOwner) {
      // Remove any previous observer if the parent changed.
      activityLifecycle?.let { old ->
        activityObserver?.let { obs -> old.lifecycle.removeObserver(obs) }
      }
      activityLifecycle = activityOwner
      val obs = LifecycleEventObserver { _, event ->
        when (event) {
          Lifecycle.Event.ON_START -> hostingOwner.handleLifecycleEvent(Lifecycle.Event.ON_START)
          Lifecycle.Event.ON_STOP -> hostingOwner.handleLifecycleEvent(Lifecycle.Event.ON_STOP)
          else -> Unit
        }
      }
      activityObserver = obs
      activityOwner.lifecycle.addObserver(obs)
    }

    // Start the hosted lifecycle when the view attaches — the SDK composable's
    // DisposableEffect observes ON_START to begin polling. If we're tracking
    // the Activity lifecycle, the observer above will also fire ON_START if
    // the Activity is currently started; this duplicate is harmless because
    // LifecycleRegistry deduplicates state transitions.
    hostingOwner.handleLifecycleEvent(Lifecycle.Event.ON_START)
  }

  override fun onDetachedFromWindow() {
    // Pause polling before detaching — ON_STOP triggers viewModel.onBackground().
    hostingOwner.handleLifecycleEvent(Lifecycle.Event.ON_STOP)
    // Stop observing the Activity lifecycle while detached.
    activityLifecycle?.let { old ->
      activityObserver?.let { obs -> old.lifecycle.removeObserver(obs) }
    }
    activityLifecycle = null
    activityObserver = null
    super.onDetachedFromWindow()
  }

  /**
   * Finds the host Activity's [LifecycleOwner] by walking up the parent view
   * tree (skipping `this`, which has our [HostingLifecycleOwner]).
   */
  private fun findActivityLifecycleOwner(): LifecycleOwner? {
    val p = parent as? android.view.View ?: return null
    return p.findViewTreeLifecycleOwner()
  }

  // --- Sizing / layout (same as VOD view) ---

  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    val width = MeasureSpec.getSize(widthMeasureSpec)
    val height = MeasureSpec.getSize(heightMeasureSpec)
    setMeasuredDimension(width, height)
    measureChildWithMargins(composeView, widthMeasureSpec, 0, heightMeasureSpec, 0)
  }

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    if (childCount == 0) return
    val child = getChildAt(0)
    child.layout(0, 0, right - left, bottom - top)
  }

  // --- Cleanup ---

  /** Called from ViewManager.onDropViewInstance. Idempotent. */
  fun cleanup() {
    if (cleanedUp) return
    cleanedUp = true
    // Remove Activity lifecycle observer if still attached.
    activityLifecycle?.let { old ->
      activityObserver?.let { obs -> old.lifecycle.removeObserver(obs) }
    }
    activityLifecycle = null
    activityObserver = null
    // Dispatch ON_DESTROY — disposes the composition (DisposeOnViewTreeLifecycleDestroyed),
    // which runs the composable's DisposableEffect cleanup (viewModel.onBackground).
    hostingOwner.handleLifecycleEvent(Lifecycle.Event.ON_DESTROY)
    // Clear the ViewModelStore — cancels all viewModelScope coroutines,
    // including any in-flight polling.
    hostingOwner.clearStore()
    // Release the player lease.
    lease?.release()
    lease = null
    removeAllViews()
  }

  /** Immutable snapshot of the live source props. */
  private data class LiveSource(
    val libraryId: Long,
    val streamId: String,
    val token: String?,
    val expires: Long?,
  ) {
    companion object {
      val Empty = LiveSource(0L, "", null, null)
    }
  }

  companion object {
    private val MATCH_PARENT = ViewGroup.LayoutParams.MATCH_PARENT
  }
}

/**
 * A combined `LifecycleOwner` + `ViewModelStoreOwner` that the bridge controls
 * explicitly. This decouples the hosted Compose tree's lifecycle from the host
 * Activity's so that detaching this view (Fabric can recycle views) does not
 * tear down the Activity's state, and so the bridge can drive
 * `ON_START`/`ON_STOP`/`ON_DESTROY` at attach/detach/drop time or when the
 * Activity goes to background/foreground.
 */
private class HostingLifecycleOwner : LifecycleOwner, ViewModelStoreOwner {

  private val lifecycleRegistry = LifecycleRegistry(this)
  private val store = ViewModelStore()

  override val lifecycle: Lifecycle get() = lifecycleRegistry
  override val viewModelStore: ViewModelStore get() = store

  fun handleLifecycleEvent(event: Lifecycle.Event) {
    lifecycleRegistry.handleLifecycleEvent(event)
  }

  /** Clears the ViewModelStore, cancelling all viewModelScope coroutines. */
  fun clearStore() {
    store.clear()
  }
}
