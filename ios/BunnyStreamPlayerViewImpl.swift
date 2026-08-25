import AVFoundation
import SwiftUI
import UIKit
import BunnyStreamPlayer

/// Swift wrapper that hosts the SDK's `BunnyStreamPlayer` SwiftUI view inside
/// a `UIHostingController`, managed by the Fabric component view.
///
/// The iOS SDK does not expose public playback callbacks, a public controller,
/// `controlsEnabled`, or `autoPlay` (see Plan-iOS.md §12.1). This wrapper:
///
/// - Creates a `BunnyStreamPlayer` with the current props and hosts it via
///   `UIHostingController`.
/// - Recreates the hosted view only when the source identity (`videoId` +
///   `libraryId` + `token` + `expires`) changes, mirroring Android's
///   `commitProps` reload-on-source-change semantics.
/// - Commands (`play`, `pause`, `seekTo`, `setVolume`, `setPlaybackRate`,
///   `mute`, `unmute`) are **no-ops** because the SDK does not expose a public
///   controller. They log a warning so integrators know the SDK limitation.
/// - Events (`onReady`, `onProgress`, etc.) are emitted by discovering the
///   SDK's internal `AVPlayer` through the `AVPlayerLayer` in the view
///   hierarchy and observing it via KVO + periodic time observer. This
///   bridges the gap until the SDK exposes public callbacks
///   (Plan-iOS.md §12.1).
@MainActor
@objc public final class BunnyStreamPlayerViewImpl: UIView {

  /// Immutable snapshot of committed props, used to detect source changes.
  struct Props: Equatable {
    var videoId: String = ""
    var libraryId: Int = 0
    var token: String? = nil
    var expires: Int64? = nil
    var autoPlay: Bool = true
    var controls: Bool = true
  }

  private var hostingController: UIHostingController<AnyView>?
  private var currentProps = Props()
  private var isMounted = false

  // MARK: - Event closures (wired to the Fabric event emitter by the .mm)

  /// (videoId, durationMs)
  @objc public var onReady: ((String, Double) -> Void)?
  /// (stateString, positionMs)
  @objc public var onPlaybackStateChange: ((String, Double) -> Void)?
  /// (positionMs, durationMs, progress 0–1)
  @objc public var onProgress: ((Double, Double, Double) -> Void)?
  /// (code, message)
  @objc public var onError: ((String, String) -> Void)?
  /// (isBuffering)
  @objc public var onBuffering: ((Bool) -> Void)?
  /// (positionMs, durationMs)
  @objc public var onPlay: ((Double, Double) -> Void)?
  /// (positionMs, durationMs)
  @objc public var onPause: ((Double, Double) -> Void)?
  /// (positionMs, durationMs)
  @objc public var onEnd: ((Double, Double) -> Void)?

  // MARK: - AVPlayer observation state

  private var observedPlayer: AVPlayer?
  private var rateObservation: NSKeyValueObservation?
  private var currentItemObservation: NSKeyValueObservation?
  private var itemStatusKVO: NSKeyValueObservation?
  private var itemBufferingObservation: NSKeyValueObservation?
  private var itemDurationObservation: NSKeyValueObservation?
  private var periodicTimeObserver: Any?
  private var hasEmittedReady = false
  private var playerSearchAttempts = 0

  public override init(frame: CGRect) {
    super.init(frame: frame)
    backgroundColor = .black
  }

  public required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  /// Accumulated (pending) props — set individually by the Fabric view, then
  /// snapshotted in `commitProps`.
  @objc public var pendingVideoId: String = ""
  @objc public var pendingLibraryId: Int = 0
  @objc public var pendingToken: String? = nil
  @objc public var pendingExpires: NSNumber? = nil
  @objc public var pendingAutoPlay: Bool = true
  @objc public var pendingControls: Bool = true

  /// Snapshots accumulated props and reloads the hosted player if the source
  /// identity changed. Called from the Fabric view's `finalizeUpdates`.
  @objc public func commitProps() {
    let next = Props(
      videoId: pendingVideoId,
      libraryId: pendingLibraryId,
      token: pendingToken,
      expires: pendingExpires?.int64Value,
      autoPlay: pendingAutoPlay,
      controls: pendingControls
    )

    let sourceChanged = next.videoId != currentProps.videoId
      || next.libraryId != currentProps.libraryId
      || next.token != currentProps.token
      || next.expires != currentProps.expires

    currentProps = next

    if next.videoId.isEmpty {
      removeHostingController()
      return
    }

    // Only (re)create the hosted view when the source identity changed.
    // `autoPlay` and `controls` changes alone do NOT reload — the SDK does
    // not expose these as public props anyway (Plan-iOS.md §12.1).
    if sourceChanged || !isMounted {
      reloadPlayer()
    }
  }

  private func reloadPlayer() {
    removeHostingController()

    // Read the global configuration for the access key. The TurboModule's
    // `initialize(accessKey, libraryId)` stores it here.
    let accessKey = BunnyStreamConfiguration.shared.accessKey

    let player = BunnyStreamPlayer(
      accessKey: accessKey,
      videoId: currentProps.videoId,
      libraryId: currentProps.libraryId,
      token: currentProps.token,
      expires: currentProps.expires
    )
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .ignoresSafeArea()

    let host = UIHostingController(rootView: AnyView(player))
    if #available(iOS 16.4, *) {
      host.safeAreaRegions = []
    }
    host.view.backgroundColor = .black
    host.view.translatesAutoresizingMaskIntoConstraints = false
    host.view.frame = bounds

    // Find the parent view controller in the view hierarchy and add the
    // hosting controller as a child so it receives lifecycle events
    // (viewWillAppear, viewDidAppear, etc.) — SwiftUI's `.task` and
    // `.onAppear` depend on these.
    if let parentVC = findParentViewController() {
      parentVC.addChild(host)
      addSubview(host.view)
      host.didMove(toParent: parentVC)
    } else {
      // No parent VC found (e.g. during initial mount before the view is
      // attached to the hierarchy). Add the view and retain the controller;
      // it will be re-parented in `didMoveToWindow`.
      addSubview(host.view)
    }
    hostingController = host
    isMounted = true

    // The SDK creates its AVPlayer asynchronously during SwiftUI's `.task`.
    // Search the view hierarchy for the AVPlayerLayer with retries.
    playerSearchAttempts = 0
    searchForPlayer()
  }

  private func removeHostingController() {
    removePlayerObservers()
    hostingController?.willMove(toParent: nil)
    hostingController?.view.removeFromSuperview()
    hostingController?.removeFromParent()
    hostingController = nil
    isMounted = false
  }

  /// Walks up the view hierarchy to find the nearest parent `UIViewController`.
  private func findParentViewController() -> UIViewController? {
    var responder: UIResponder? = self
    while let next = responder?.next {
      if let vc = next as? UIViewController {
        return vc
      }
      responder = next
    }
    return nil
  }

  public override func didMoveToWindow() {
    super.didMoveToWindow()
    // If the hosting controller was created before the view was attached to
    // the hierarchy (no parent VC was available), re-parent it now.
    if let host = hostingController, host.parent == nil, let parentVC = findParentViewController() {
      parentVC.addChild(host)
      host.didMove(toParent: parentVC)
    }
  }

  public override func layoutSubviews() {
    super.layoutSubviews()

    // Workaround: the SDK's SwiftUI player reads the window's safe area
    // insets directly (via keyWindow) and applies them as internal padding,
    // even though we set `safeAreaRegions = []` on the hosting controller
    // and `.ignoresSafeArea()` on the view. This pushes the video content
    // down by the top safe area inset (notch / status bar height).
    //
    // Manual fix: shift the hosting controller's frame up by the top inset
    // and extend its height by the same amount so the video fills the
    // original bounds while the internal padding compensates for the shift.
    let topInset = hostingController?.view.window?.safeAreaInsets.top ?? 0
    var frame = bounds
    if topInset > 0 {
      frame.origin.y -= topInset
      frame.size.height += topInset
    }
    hostingController?.view.frame = frame

    // Also counter the safe area insets at the hosting controller level
    // (fallback for iOS < 16.4 where `safeAreaRegions` is unavailable).
    if #unavailable(iOS 16.4),
       let window = hostingController?.view.window,
       window.safeAreaInsets != .zero {
      let insets = window.safeAreaInsets
      hostingController?.additionalSafeAreaInsets = UIEdgeInsets(
        top: -insets.top,
        left: -insets.left,
        bottom: -insets.bottom,
        right: -insets.right
      )
    }
  }

  // MARK: - AVPlayer discovery & observation

  /// Searches the hosting controller's view hierarchy for an `AVPlayerLayer`,
  /// then attaches KVO observers + a periodic time observer to its `AVPlayer`.
  /// Retries up to 50 times (≈5 s) because the SDK creates the player
  /// asynchronously during SwiftUI's `.task`.
  private func searchForPlayer() {
    guard hostingController != nil else { return }
    if let layer = findPlayerLayer(in: hostingController?.view ?? self),
       let player = layer.player {
      attachObservers(to: player)
      return
    }
    playerSearchAttempts += 1
    if playerSearchAttempts < 50 {
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in
        self?.searchForPlayer()
      }
    }
  }

  /// Recursively walks the layer tree looking for an `AVPlayerLayer`.
  private func findPlayerLayer(in view: UIView) -> AVPlayerLayer? {
    for sublayer in view.layer.sublayers ?? [] {
      if let playerLayer = sublayer as? AVPlayerLayer {
        return playerLayer
      }
      if let sub = sublayer.sublayers {
        for subSub in sub {
          if let p = findPlayerLayer(in: subSub) {
            return p
          }
        }
      }
    }
    for subview in view.subviews {
      if let layer = findPlayerLayer(in: subview) {
        return layer
      }
    }
    return nil
  }

  private func findPlayerLayer(in layer: CALayer) -> AVPlayerLayer? {
    if let playerLayer = layer as? AVPlayerLayer {
      return playerLayer
    }
    for sub in layer.sublayers ?? [] {
      if let p = findPlayerLayer(in: sub) {
        return p
      }
    }
    return nil
  }

  /// Attaches KVO observers + a periodic time observer to the discovered
  /// `AVPlayer`, bridging its state transitions to the Fabric event closures.
  private func attachObservers(to player: AVPlayer) {
    removePlayerObservers()
    observedPlayer = player
    hasEmittedReady = false

    // Observe rate → play / pause transitions.
    rateObservation = player.observe(\.rate, options: [.new]) { [weak self] p, _ in
      DispatchQueue.main.async {
        guard let self = self else { return }
        let positionMs = self.currentPositionMs(p)
        let durationMs = self.currentDurationMs(p)
        if p.rate > 0 {
          self.onPlay?(positionMs, durationMs)
          self.onPlaybackStateChange?("playing", positionMs)
        } else {
          // rate == 0: could be pause or ended. `ended` is handled by the
          // AVPlayerItemDidPlayToEndTimeNotification. Only emit pause if
          // we previously emitted ready (player is loaded).
          if self.hasEmittedReady {
            self.onPause?(positionMs, durationMs)
            self.onPlaybackStateChange?("paused", positionMs)
          }
        }
      }
    }

    // Observe currentItem.status → ready / error.
    if let item = player.currentItem {
      observePlayerItem(item, player: player)
    }
    // Also observe currentItem itself in case it's set after we attach.
    currentItemObservation = player.observe(\.currentItem, options: [.new]) { [weak self] p, _ in
      DispatchQueue.main.async {
        guard let self = self, let item = p.currentItem else { return }
        self.observePlayerItem(item, player: p)
      }
    }

    // Periodic time observer for progress (~4×/s, matching Android).
    let interval = CMTime(value: 250, timescale: 1000)
    periodicTimeObserver = player.addPeriodicTimeObserver(
      forInterval: interval,
      queue: .main
    ) { [weak self] time in
      guard let self = self, time.isValid else { return }
      let positionMs = time.seconds * 1000
      let durationMs = self.currentDurationMs(player)
      let progress = durationMs > 0 ? positionMs / durationMs : 0
      self.onProgress?(positionMs, durationMs, max(0, min(1, progress)))
    }

    // End-of-playback notification.
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(playerItemDidPlayToEndTime(_:)),
      name: .AVPlayerItemDidPlayToEndTime,
      object: player.currentItem
    )
  }

  /// Observes a single `AVPlayerItem`'s `status`, `duration`, and buffering.
  private func observePlayerItem(_ item: AVPlayerItem, player: AVPlayer) {
    itemStatusKVO = item.observe(\.status, options: [.new]) { [weak self] it, _ in
      DispatchQueue.main.async {
        guard let self = self else { return }
        switch it.status {
        case .readyToPlay:
          if !self.hasEmittedReady {
            self.hasEmittedReady = true
            let durationMs = self.currentDurationMs(player)
            self.onReady?(self.currentProps.videoId, durationMs)
            self.onPlaybackStateChange?("ready", 0)
          }
        case .failed:
          let msg = it.error?.localizedDescription ?? "Playback failed"
          self.onError?("PLAYBACK_ERROR", msg)
          self.onPlaybackStateChange?("error", 0)
        case .unknown:
          break
        @unknown default:
          break
        }
      }
    }

    // Observe isPlaybackLikelyToKeepUp for buffering events.
    itemBufferingObservation = item.observe(\.isPlaybackLikelyToKeepUp, options: [.new]) { [weak self] it, _ in
      DispatchQueue.main.async {
        guard let self = self else { return }
        self.onBuffering?(!it.isPlaybackLikelyToKeepUp)
      }
    }

    // Observe duration — it may resolve after status becomes readyToPlay
    // for deferred-loading VOD assets.
    itemDurationObservation = item.observe(\.duration, options: [.new]) { [weak self] _, _ in
      DispatchQueue.main.async {
        guard let self = self, self.hasEmittedReady else { return }
        // Re-emit onReady with the now-valid duration so JS has the correct
        // durationMs for progress calculations.
        let durationMs = self.currentDurationMs(player)
        self.onReady?(self.currentProps.videoId, durationMs)
      }
    }
  }

  @objc private func playerItemDidPlayToEndTime(_ notification: Notification) {
    guard let player = observedPlayer else { return }
    let positionMs = currentPositionMs(player)
    let durationMs = currentDurationMs(player)
    onEnd?(positionMs, durationMs)
    onPlaybackStateChange?("ended", positionMs)
  }

  private func currentPositionMs(_ player: AVPlayer) -> Double {
    let seconds = player.currentTime().seconds
    return seconds.isFinite ? seconds * 1000 : 0
  }

  private func currentDurationMs(_ player: AVPlayer) -> Double {
    guard let item = player.currentItem else { return 0 }
    let seconds = item.duration.seconds
    return seconds.isFinite && !seconds.isNaN ? seconds * 1000 : 0
  }

  /// Removes all KVO observers, periodic time observer, and notification
  /// subscription from the currently observed `AVPlayer`.
  private func removePlayerObservers() {
    if let player = observedPlayer, let observer = periodicTimeObserver {
      player.removeTimeObserver(observer)
    }
    periodicTimeObserver = nil
    rateObservation?.invalidate()
    rateObservation = nil
    currentItemObservation?.invalidate()
    currentItemObservation = nil
    itemStatusKVO?.invalidate()
    itemStatusKVO = nil
    itemBufferingObservation?.invalidate()
    itemBufferingObservation = nil
    itemDurationObservation?.invalidate()
    itemDurationObservation = nil
    NotificationCenter.default.removeObserver(
      self,
      name: .AVPlayerItemDidPlayToEndTime,
      object: nil
    )
    observedPlayer = nil
    hasEmittedReady = false
  }

  // MARK: - Commands (no-op — SDK does not expose a public controller)

  @objc public func play() {
    #if DEBUG
    print("[BunnyStreamPlayerView] play() is a no-op — iOS SDK does not expose a public controller (Plan-iOS.md §12.1)")
    #endif
  }

  @objc public func pause() {
    #if DEBUG
    print("[BunnyStreamPlayerView] pause() is a no-op — iOS SDK does not expose a public controller (Plan-iOS.md §12.1)")
    #endif
  }

  @objc public func seekTo(positionMs: Double) {
    #if DEBUG
    print("[BunnyStreamPlayerView] seekTo(\(positionMs)) is a no-op — iOS SDK does not expose a public controller (Plan-iOS.md §12.1)")
    #endif
  }

  @objc public func setVolume(volume: Double) {
    #if DEBUG
    print("[BunnyStreamPlayerView] setVolume(\(volume)) is a no-op — iOS SDK does not expose a public controller (Plan-iOS.md §12.1)")
    #endif
  }

  @objc public func setPlaybackRate(rate: Double) {
    #if DEBUG
    print("[BunnyStreamPlayerView] setPlaybackRate(\(rate)) is a no-op — iOS SDK does not expose a public controller (Plan-iOS.md §12.1)")
    #endif
  }

  @objc public func mute() {
    #if DEBUG
    print("[BunnyStreamPlayerView] mute() is a no-op — iOS SDK does not expose a public controller (Plan-iOS.md §12.1)")
    #endif
  }

  @objc public func unmute() {
    #if DEBUG
    print("[BunnyStreamPlayerView] unmute() is a no-op — iOS SDK does not expose a public controller (Plan-iOS.md §12.1)")
    #endif
  }

  /// Called when the Fabric view is dropped. Removes the hosted SwiftUI view
  /// and all player observers.
  @objc public func cleanup() {
    removeHostingController()
    onReady = nil
    onPlaybackStateChange = nil
    onProgress = nil
    onError = nil
    onBuffering = nil
    onPlay = nil
    onPause = nil
    onEnd = nil
  }
}
