import AVFoundation
import AVKit
import SwiftUI
import UIKit
import BunnyStreamPlayer

/// Swift wrapper that hosts the SDK's `BunnyStreamPlayer` SwiftUI view inside
/// a `UIHostingController`, managed by the Fabric component view.
///
/// The iOS SDK does not expose public playback callbacks, a public controller,
/// `controlsEnabled`, or `autoPlay`. This wrapper:
///
/// - Creates a `BunnyStreamPlayer` with the current props and hosts it via
///   `UIHostingController`.
/// - Recreates the hosted view only when the source identity (`videoId` +
///   `libraryId` + `token` + `expires`) changes, mirroring Android's
///   `commitProps` reload-on-source-change semantics.
/// - Commands (`play`, `pause`, `seekTo`, `setVolume`, `setPlaybackRate`,
///   `mute`, `unmute`) are applied to that same discovered `AVPlayer`, because
///   the SDK does not expose a public controller. Commands issued before the
///   player is discovered are queued and replayed on attach.
/// - Events (`onReady`, `onProgress`, etc.) are emitted by discovering the
///   SDK's internal `AVPlayer` through the `AVPlayerLayer` in the view
///   hierarchy and observing it via KVO + periodic time observer.
/// - TODO(iOS SDK): Replace AVPlayerLayer discovery and KVO after the public SDK
///   exposes a stable VOD controller and playback event callbacks.
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
  /// (code, message, nativeCode)
  @objc public var onError: ((String, String, String?) -> Void)?
  /// (isBuffering)
  @objc public var onBuffering: ((Bool) -> Void)?
  /// (positionMs, durationMs)
  @objc public var onPlay: ((Double, Double) -> Void)?
  /// (positionMs, durationMs)
  @objc public var onPause: ((Double, Double) -> Void)?
  /// (positionMs, durationMs)
  @objc public var onEnd: ((Double, Double) -> Void)?
  /// (volume, isMuted)
  @objc public var onVolumeChange: ((Double, Bool) -> Void)?
  /// (rate)
  @objc public var onPlaybackRateChange: ((Double) -> Void)?
  /// (width, height)
  @objc public var onVideoSizeChange: ((Int32, Int32) -> Void)?
  /// (message)
  @objc public var onPlaybackError: ((String) -> Void)?

  // MARK: - AVPlayer observation state

  private var observedPlayer: AVPlayer?
  /// The discovered `AVPlayerLayer`, kept so `enterPiP` can build an
  /// `AVPictureInPictureController` on it (public AVKit API — the SDK's own
  /// `PictureInPictureManager` is internal and can't be reached).
  private var observedPlayerLayer: AVPlayerLayer?
  /// Bridge-owned PiP controller. Note the SDK may hold its own controller
  /// for the same layer; `isPictureInPictureActive` is tracked per
  /// controller, so toggling via the SDK's PiP button and this command can
  /// disagree on state — acceptable for the workaround.
  private var pipController: AVPictureInPictureController?
  private var playerStatusObservation: NSKeyValueObservation?
  private var rateObservation: NSKeyValueObservation?
  private var volumeObservation: NSKeyValueObservation?
  private var mutedObservation: NSKeyValueObservation?
  private var currentItemObservation: NSKeyValueObservation?
  private var itemStatusKVO: NSKeyValueObservation?
  private var itemBufferingObservation: NSKeyValueObservation?
  private var itemDurationObservation: NSKeyValueObservation?
  private var itemPresentationSizeObservation: NSKeyValueObservation?
  private var periodicTimeObserver: Any?
  private var itemEndObserver: NSObjectProtocol?
  private var itemFailureObserver: NSObjectProtocol?
  private var hasEmittedReady = false
  private var lastVolumeSnapshot: (Double, Bool)?
  private var lastPlaybackRate: Double?
  private var lastVideoSize: (Int32, Int32)?
  private var lastPlaybackErrorCode: String?
  private var playerSearchAttempts = 0
  private var playerSearchGeneration = 0

  /// Commands issued before the SDK's `AVPlayer` was discovered. Replayed in
  /// order once `attachObservers(to:)` runs.
  private var pendingCommands: [(AVPlayer) -> Void] = []

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
    // not expose these as public props anyway.
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
    host.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
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
    pendingCommands.removeAll()
    playerSearchAttempts = 0
    playerSearchGeneration += 1
    searchForPlayer(generation: playerSearchGeneration)
  }

  private func removeHostingController() {
    playerSearchGeneration += 1
    removePlayerObservers()
    pendingCommands.removeAll()
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
    hostingController?.view.frame = bounds
    // Counter the window-level safe area insets that UIHostingController
    // applies to its root view even though this view is embedded mid-screen.
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
  private func searchForPlayer(generation: Int) {
    guard hostingController != nil, generation == playerSearchGeneration else { return }
    if let layer = findPlayerLayer(in: hostingController?.view ?? self),
       let player = layer.player {
      observedPlayerLayer = layer
      attachObservers(to: player)
      return
    }
    playerSearchAttempts += 1
    if playerSearchAttempts < 50 {
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in
        self?.searchForPlayer(generation: generation)
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
    lastVolumeSnapshot = nil
    lastPlaybackRate = nil
    lastVideoSize = nil
    lastPlaybackErrorCode = nil

    playerStatusObservation = player.observe(\.status, options: [.new]) { [weak self] p, _ in
      DispatchQueue.main.async {
        guard let self = self,
              self.observedPlayer === p,
              p.status == .failed,
              p.currentItem?.status != .failed else { return }
        self.emitPlaybackFailure(p.error, player: p)
      }
    }
    if player.status == .failed, player.currentItem?.status != .failed {
      emitPlaybackFailure(player.error, player: player)
    }

    // Observe rate → play / pause transitions.
    rateObservation = player.observe(\.rate, options: [.new]) { [weak self] p, _ in
      DispatchQueue.main.async {
        guard let self = self, self.observedPlayer === p else { return }
        let positionMs = self.currentPositionMs(p)
        let durationMs = self.currentDurationMs(p)
        if p.rate > 0 {
          self.emitPlaybackRateIfChanged(Double(p.rate))
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

    volumeObservation = player.observe(\.volume, options: [.new]) { [weak self] p, _ in
      DispatchQueue.main.async {
        guard let self = self, self.observedPlayer === p else { return }
        self.emitVolumeIfChanged(p)
      }
    }
    mutedObservation = player.observe(\.isMuted, options: [.new]) { [weak self] p, _ in
      DispatchQueue.main.async {
        guard let self = self, self.observedPlayer === p else { return }
        self.emitVolumeIfChanged(p)
      }
    }
    emitVolumeIfChanged(player)

    // Observe currentItem.status → ready / error.
    if let item = player.currentItem {
      observePlayerItem(item, player: player)
    }
    // Also observe currentItem itself in case it's set after we attach.
    currentItemObservation = player.observe(\.currentItem, options: [.new]) { [weak self] p, _ in
      DispatchQueue.main.async {
        guard let self = self, self.observedPlayer === p else { return }
        self.hasEmittedReady = false
        if let item = p.currentItem {
          self.observePlayerItem(item, player: p)
        } else {
          self.removeItemObservers()
        }
      }
    }

    // Emit the initial play state if the player is already playing.
    if player.rate > 0 {
      emitPlaybackRateIfChanged(Double(player.rate))
      let positionMs = currentPositionMs(player)
      let durationMs = currentDurationMs(player)
      onPlay?(positionMs, durationMs)
      onPlaybackStateChange?("playing", positionMs)
    }

    // Periodic time observer for progress (~4×/s, matching Android).
    let interval = CMTime(value: 250, timescale: 1000)
    periodicTimeObserver = player.addPeriodicTimeObserver(
      forInterval: interval,
      queue: .main
    ) { [weak self] time in
      guard time.isValid else { return }
      DispatchQueue.main.async {
        guard let self = self, self.observedPlayer === player else { return }
        let positionMs = time.seconds * 1000
        let durationMs = self.currentDurationMs(player)
        let progress = durationMs > 0 ? positionMs / durationMs : 0
        self.onProgress?(positionMs, durationMs, max(0, min(1, progress)))
      }
    }

    // Replay commands issued while the player was still being created.
    let queued = pendingCommands
    pendingCommands.removeAll()
    for command in queued {
      command(player)
    }
  }

  /// Observes a single `AVPlayerItem`'s status, duration, buffering, size, and
  /// terminal playback notifications.
  private func observePlayerItem(_ item: AVPlayerItem, player: AVPlayer) {
    removeItemObservers()
    lastVideoSize = nil
    lastPlaybackErrorCode = nil

    itemStatusKVO = item.observe(\.status, options: [.new]) { [weak self] it, _ in
      DispatchQueue.main.async {
        guard let self = self,
              self.observedPlayer === player,
              player.currentItem === it else { return }
        switch it.status {
        case .readyToPlay:
          if !self.hasEmittedReady {
            self.hasEmittedReady = true
            let durationMs = self.currentDurationMs(player)
            self.onReady?(self.currentProps.videoId, durationMs)
            self.onPlaybackStateChange?("ready", 0)
            // The public SDK no longer starts playback on appear ("playback
            // starts when the viewer taps the play button"), so honor the
            // `autoPlay` prop here — once per item, before any user pause.
            if self.currentProps.autoPlay, player.rate == 0 {
              player.play()
            }
          }
        case .failed:
          self.emitPlaybackFailure(it.error, player: player)
        case .unknown:
          break
        @unknown default:
          break
        }
      }
    }

    switch item.status {
    case .readyToPlay:
      if !hasEmittedReady {
        hasEmittedReady = true
        let durationMs = currentDurationMs(player)
        onReady?(currentProps.videoId, durationMs)
        onPlaybackStateChange?("ready", 0)
        // Same autoPlay bridge as the KVO path above — the public SDK removed
        // play-on-appear, so the wrapper starts playback itself.
        if currentProps.autoPlay, player.rate == 0 {
          player.play()
        }
      }
    case .failed:
      emitPlaybackFailure(item.error, player: player)
    case .unknown:
      break
    @unknown default:
      break
    }

    itemBufferingObservation = item.observe(\.isPlaybackLikelyToKeepUp, options: [.new]) { [weak self] it, _ in
      DispatchQueue.main.async {
        guard let self = self,
              self.observedPlayer === player,
              player.currentItem === it else { return }
        self.onBuffering?(!it.isPlaybackLikelyToKeepUp)
      }
    }
    onBuffering?(!item.isPlaybackLikelyToKeepUp)

    itemDurationObservation = item.observe(\.duration, options: [.new]) { [weak self] it, _ in
      DispatchQueue.main.async {
        guard let self = self,
              self.observedPlayer === player,
              player.currentItem === it,
              self.hasEmittedReady else { return }
        let durationMs = self.currentDurationMs(player)
        self.onReady?(self.currentProps.videoId, durationMs)
      }
    }

    itemPresentationSizeObservation = item.observe(\.presentationSize, options: [.new]) { [weak self] it, _ in
      DispatchQueue.main.async {
        guard let self = self,
              self.observedPlayer === player,
              player.currentItem === it else { return }
        self.emitVideoSizeIfChanged(it.presentationSize)
      }
    }
    emitVideoSizeIfChanged(item.presentationSize)

    itemEndObserver = NotificationCenter.default.addObserver(
      forName: .AVPlayerItemDidPlayToEndTime,
      object: item,
      queue: .main
    ) { [weak self] _ in
      MainActor.assumeIsolated {
        guard let self = self,
              self.observedPlayer === player,
              player.currentItem === item else { return }
        let positionMs = self.currentPositionMs(player)
        let durationMs = self.currentDurationMs(player)
        self.onEnd?(positionMs, durationMs)
        self.onPlaybackStateChange?("ended", positionMs)
      }
    }

    itemFailureObserver = NotificationCenter.default.addObserver(
      forName: .AVPlayerItemFailedToPlayToEndTime,
      object: item,
      queue: .main
    ) { [weak self] notification in
      MainActor.assumeIsolated {
        guard let self = self,
              self.observedPlayer === player,
              player.currentItem === item else { return }
        let error = notification.userInfo?[AVPlayerItemFailedToPlayToEndTimeErrorKey] as? Error
        self.emitPlaybackFailure(error ?? item.error, player: player)
      }
    }
  }

  private func emitVolumeIfChanged(_ player: AVPlayer) {
    let volume = player.isMuted ? 0 : Double(player.volume)
    let snapshot = (volume, player.isMuted)
    guard lastVolumeSnapshot?.0 != snapshot.0 || lastVolumeSnapshot?.1 != snapshot.1 else { return }
    lastVolumeSnapshot = snapshot
    onVolumeChange?(snapshot.0, snapshot.1)
  }

  private func emitPlaybackRateIfChanged(_ rate: Double) {
    guard rate > 0, lastPlaybackRate != rate else { return }
    lastPlaybackRate = rate
    onPlaybackRateChange?(rate)
  }

  private func emitVideoSizeIfChanged(_ size: CGSize) {
    guard size.width.isFinite,
          size.height.isFinite,
          size.width > 0,
          size.height > 0,
          size.width <= CGFloat(Int32.max),
          size.height <= CGFloat(Int32.max) else { return }
    let videoSize = (Int32(size.width.rounded()), Int32(size.height.rounded()))
    guard lastVideoSize?.0 != videoSize.0 || lastVideoSize?.1 != videoSize.1 else { return }
    lastVideoSize = videoSize
    onVideoSizeChange?(videoSize.0, videoSize.1)
  }

  private func emitPlaybackFailure(_ error: Error?, player: AVPlayer) {
    guard observedPlayer === player else { return }
    let nsError = error as NSError?
    let message = error?.localizedDescription ?? "Playback failed"
    let nativeCode = nsError.map { "\($0.domain):\($0.code)" }
    let errorCode = nativeCode ?? message
    guard lastPlaybackErrorCode != errorCode else { return }
    lastPlaybackErrorCode = errorCode
    onError?("PLAYBACK_ERROR", message, nativeCode)
    onPlaybackError?(message)
    onPlaybackStateChange?("error", currentPositionMs(player))
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

  private func removeItemObservers() {
    itemStatusKVO?.invalidate()
    itemStatusKVO = nil
    itemBufferingObservation?.invalidate()
    itemBufferingObservation = nil
    itemDurationObservation?.invalidate()
    itemDurationObservation = nil
    itemPresentationSizeObservation?.invalidate()
    itemPresentationSizeObservation = nil
    if let observer = itemEndObserver {
      NotificationCenter.default.removeObserver(observer)
      itemEndObserver = nil
    }
    if let observer = itemFailureObserver {
      NotificationCenter.default.removeObserver(observer)
      itemFailureObserver = nil
    }
  }

  /// Removes every KVO observation, time observer, and notification token from
  /// the currently observed player and item.
  private func removePlayerObservers() {
    if let player = observedPlayer, let observer = periodicTimeObserver {
      player.removeTimeObserver(observer)
    }
    periodicTimeObserver = nil
    playerStatusObservation?.invalidate()
    playerStatusObservation = nil
    rateObservation?.invalidate()
    rateObservation = nil
    volumeObservation?.invalidate()
    volumeObservation = nil
    mutedObservation?.invalidate()
    mutedObservation = nil
    currentItemObservation?.invalidate()
    currentItemObservation = nil
    removeItemObservers()
    observedPlayer = nil
    observedPlayerLayer = nil
    if pipController?.isPictureInPictureActive == true {
      pipController?.stopPictureInPicture()
    }
    pipController = nil
    hasEmittedReady = false
    lastVolumeSnapshot = nil
    lastPlaybackRate = nil
    lastVideoSize = nil
    lastPlaybackErrorCode = nil
  }

  // MARK: - Commands

  /// Runs `command` against the discovered `AVPlayer`, or queues it until the
  /// SDK finishes creating one (see `searchForPlayer`).
  private func withPlayer(_ command: @escaping (AVPlayer) -> Void) {
    if let player = observedPlayer {
      command(player)
    } else {
      pendingCommands.append(command)
    }
  }

  @objc public func play() {
    withPlayer { $0.play() }
  }

  @objc public func pause() {
    withPlayer { $0.pause() }
  }

  @objc public func seekTo(positionMs: Double) {
    guard positionMs.isFinite, positionMs >= 0 else { return }
    withPlayer { player in
      let time = CMTime(value: CMTimeValue(positionMs.rounded()), timescale: 1000)
      // Zero tolerance so custom scrubbers land on the requested frame, and
      // no implicit `play()` — seeking while paused must not resume playback.
      player.seek(to: time, toleranceBefore: .zero, toleranceAfter: .zero)
    }
  }

  @objc public func setVolume(volume: Double) {
    guard volume.isFinite else { return }
    let clamped = Float(max(0, min(1, volume)))
    withPlayer { $0.volume = clamped }
  }

  @objc public func setPlaybackRate(rate: Double) {
    guard rate.isFinite, rate > 0 else { return }
    withPlayer { player in
      // Only push the rate onto a playing player — assigning a non-zero rate
      // to a paused one would resume playback.
      if player.rate > 0 {
        player.rate = Float(rate)
      }
    }
  }

  @objc public func mute() {
    withPlayer { $0.isMuted = true }
  }

  @objc public func unmute() {
    withPlayer { $0.isMuted = false }
  }

  /// Toggles Picture in Picture using a bridge-owned
  /// `AVPictureInPictureController` bound to the discovered layer. Requires
  /// the host app to enable the "Audio, AirPlay, and Picture in Picture"
  /// background mode (`UIBackgroundModes` = `audio`) — without it
  /// `startPictureInPicture()` silently does nothing.
  @objc public func enterPiP() {
    guard AVPictureInPictureController.isPictureInPictureSupported() else { return }
    if pipController == nil, let layer = observedPlayerLayer {
      pipController = AVPictureInPictureController(playerLayer: layer)
    }
    guard let pipController else { return }
    if pipController.isPictureInPictureActive {
      pipController.stopPictureInPicture()
    } else if pipController.isPictureInPicturePossible {
      pipController.startPictureInPicture()
    }
  }

  /// Called when the Fabric view is dropped. Removes the hosted SwiftUI view
  /// and all player observers. The event closures are kept wired because the
  /// same `BunnyStreamPlayerView` instance (and its emitter) can be recycled.
  @objc public func cleanup() {
    removeHostingController()
  }
}
