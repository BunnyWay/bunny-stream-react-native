import AVFoundation
import AVKit
import SwiftUI
import UIKit
import BunnyStreamPlayer

/// Swift wrapper that hosts the SDK's `BunnyStreamPlayer` SwiftUI view inside
/// a `UIHostingController`, managed by the Fabric component view.
///
/// `autoPlay` and `controlsEnabled` are forwarded to the SDK initializer.
/// Commands and events go through the SDK's public
/// `BunnyStreamPlayerController`, which the player attaches to its internal
/// `MediaPlayer` once the video finishes loading.
///
/// - Creates a `BunnyStreamPlayer` with the current props and hosts it via
///   `UIHostingController`.
/// - Recreates the hosted view only when the source identity (`videoId` +
///   `libraryId` + `token` + `expires`) changes, mirroring Android's
///   `commitProps` reload-on-source-change semantics.
/// - Commands (`play`, `pause`, `seekTo`, `setVolume`, `setPlaybackRate`,
///   `mute`, `unmute`) are issued to the controller; commands sent before the
///   SDK attaches the `MediaPlayer` are queued inside the controller and
///   replayed on attach.
/// - Events (`onReady`, `onProgress`, etc.) are forwarded from the
///   controller's playback callbacks. Progress is emitted at the SDK's fixed
///   500 ms cadence.
/// - The `AVPlayerLayer` is still located in the view hierarchy only to build
///   the bridge-owned `AVPictureInPictureController` — the SDK's own
///   `PictureInPictureManager` is internal and can't be reached.
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
    var watermark: String? = nil
  }

  private var hostingController: UIHostingController<AnyView>?
  private var currentProps = Props()
  private var isMounted = false

  /// Public SDK controller passed to `BunnyStreamPlayer`. The SDK calls
  /// `attach(to:)` when the video's `MediaPlayer` is created and re-attaches
  /// it on every reload, so one instance lives as long as this view.
  private let playerController = BunnyStreamPlayerController()

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

  // MARK: - Event dedup state

  private var hasEmittedReady = false
  private var lastVolumeSnapshot: (Double, Bool)?
  private var lastPlaybackRate: Double?
  private var lastVideoSize: (Int32, Int32)?
  private var lastPlaybackErrorCode: String?
  private var lastIsBuffering: Bool?

  // MARK: - PiP state

  /// The discovered `AVPlayerLayer`, kept so `enterPiP` can build an
  /// `AVPictureInPictureController` on it (public AVKit API — the SDK's own
  /// `PictureInPictureManager` is internal and can't be reached).
  private var observedPlayerLayer: AVPlayerLayer?
  /// Bridge-owned PiP controller. Note the SDK may hold its own controller
  /// for the same layer; `isPictureInPictureActive` is tracked per
  /// controller, so toggling via the SDK's PiP button and this command can
  /// disagree on state — acceptable for the workaround.
  private var pipController: AVPictureInPictureController?
  private var playerSearchAttempts = 0
  private var playerSearchGeneration = 0

  public override init(frame: CGRect) {
    super.init(frame: frame)
    backgroundColor = .black
    wireControllerCallbacks()
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
  @objc public var pendingWatermark: String? = nil

  /// Snapshots accumulated props and reloads the hosted player if the source
  /// identity changed. Called from the Fabric view's `finalizeUpdates`.
  @objc public func commitProps() {
    let next = Props(
      videoId: pendingVideoId,
      libraryId: pendingLibraryId,
      token: pendingToken,
      expires: pendingExpires?.int64Value,
      autoPlay: pendingAutoPlay,
      controls: pendingControls,
      watermark: pendingWatermark
    )

    let sourceChanged = next.videoId != currentProps.videoId
      || next.libraryId != currentProps.libraryId
      || next.token != currentProps.token
      || next.expires != currentProps.expires
    let presentationChanged = next.controls != currentProps.controls
      || next.watermark != currentProps.watermark

    currentProps = next

    if next.videoId.isEmpty {
      removeHostingController()
      return
    }

    if sourceChanged || !isMounted {
      reloadPlayer()
    } else if presentationChanged {
      updateHostedPlayer()
    }
  }

  private func reloadPlayer() {
    removeHostingController()

    // Read the global configuration for the access key. The TurboModule's
    // `initialize(accessKey, libraryId)` stores it here.
    let accessKey = BunnyStreamConfiguration.shared.accessKey

    let host = UIHostingController(rootView: makePlayerView(accessKey: accessKey))
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
    // Search the view hierarchy for the AVPlayerLayer with retries — it is
    // needed to construct the bridge-owned PiP controller.
    playerSearchAttempts = 0
    playerSearchGeneration += 1
    searchForPlayer(generation: playerSearchGeneration)
  }

  private func makePlayerView(accessKey: String?) -> AnyView {
    AnyView(
      BunnyStreamPlayer(
        accessKey: accessKey,
        videoId: currentProps.videoId,
        libraryId: currentProps.libraryId,
        token: currentProps.token,
        expires: currentProps.expires,
        watermark: makeWatermark(from: currentProps.watermark),
        controller: playerController,
        autoPlay: currentProps.autoPlay,
        controlsEnabled: currentProps.controls
      )
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .ignoresSafeArea()
    )
  }

  private func updateHostedPlayer() {
    hostingController?.rootView = makePlayerView(
      accessKey: BunnyStreamConfiguration.shared.accessKey
    )
  }

  private func makeWatermark(from json: String?) -> PlayerWatermark? {
    guard let json, let data = json.data(using: .utf8),
          let config = try? JSONDecoder().decode(WatermarkConfig.self, from: data),
          let url = URL(string: config.imageUrl) else { return nil }
    let position: PlayerWatermark.Position
    switch config.position {
    case "topLeading": position = .topLeading
    case "bottomLeading": position = .bottomLeading
    case "bottomTrailing": position = .bottomTrailing
    case "center": position = .center
    default: position = .topTrailing
    }
    return PlayerWatermark(
      imageURL: url,
      position: position,
      relativeWidth: CGFloat(config.relativeWidth ?? 0.18),
      opacity: config.opacity ?? 0.85,
      margin: CGFloat(config.margin ?? 12)
    )
  }

  private struct WatermarkConfig: Decodable {
    let imageUrl: String
    let position: String?
    let relativeWidth: Double?
    let opacity: Double?
    let margin: Double?
  }

  private func removeHostingController() {
    playerSearchGeneration += 1
    resetEventDedup()
    observedPlayerLayer = nil
    if pipController?.isPictureInPictureActive == true {
      pipController?.stopPictureInPicture()
    }
    pipController = nil
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

  // MARK: - AVPlayerLayer discovery (PiP only)

  /// Searches the hosting controller's view hierarchy for an `AVPlayerLayer`
  /// so `enterPiP` can bind an `AVPictureInPictureController` to it. Retries
  /// up to 50 times (≈5 s) because the SDK creates the player asynchronously
  /// during SwiftUI's `.task`.
  private func searchForPlayer(generation: Int) {
    guard hostingController != nil, generation == playerSearchGeneration else { return }
    if let layer = findPlayerLayer(in: hostingController?.view ?? self) {
      observedPlayerLayer = layer
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

  // MARK: - Controller callback wiring

  /// Wires the SDK controller's playback callbacks to the Fabric event
  /// closures. Set up once in `init` — the controller instance outlives
  /// individual hosted players and is re-attached by the SDK on reload.
  private func wireControllerCallbacks() {
    // All controller callbacks are invoked from the @MainActor controller,
    // so assumeIsolated is safe inside each closure.
    playerController.onReady = { [weak self] snapshot in
      MainActor.assumeIsolated {
        guard let self, !self.hasEmittedReady else { return }
        self.hasEmittedReady = true
        self.onReady?(self.currentProps.videoId, snapshot.duration * 1000)
      }
    }
    playerController.onStateChange = { [weak self] snapshot in
      MainActor.assumeIsolated {
        guard let self else { return }
        // `.buffering` is surfaced via the dedicated `onBuffering` event —
        // it is not part of the RN playback-state union.
        let state: String
        switch snapshot.state {
        case .idle: state = "idle"
        case .preparing: state = "loading"
        case .ready: state = "ready"
        case .playing: state = "playing"
        case .paused: state = "paused"
        case .ended: state = "ended"
        case .failed: state = "error"
        case .buffering: return
        }
        self.onPlaybackStateChange?(state, snapshot.position * 1000)
      }
    }
    playerController.onProgress = { [weak self] snapshot in
      MainActor.assumeIsolated {
        guard let self else { return }
        let positionMs = snapshot.position * 1000
        let durationMs = snapshot.duration * 1000
        let progress = durationMs > 0 ? positionMs / durationMs : 0
        self.onProgress?(positionMs, durationMs, max(0, min(1, progress)))
      }
    }
    playerController.onBufferingChange = { [weak self] isBuffering in
      MainActor.assumeIsolated {
        guard let self, self.lastIsBuffering != isBuffering else { return }
        self.lastIsBuffering = isBuffering
        self.onBuffering?(isBuffering)
      }
    }
    playerController.onPlay = { [weak self] snapshot in
      MainActor.assumeIsolated {
        self?.onPlay?(snapshot.position * 1000, snapshot.duration * 1000)
      }
    }
    playerController.onPause = { [weak self] snapshot in
      MainActor.assumeIsolated {
        self?.onPause?(snapshot.position * 1000, snapshot.duration * 1000)
      }
    }
    playerController.onEnd = { [weak self] snapshot in
      MainActor.assumeIsolated {
        self?.onEnd?(snapshot.position * 1000, snapshot.duration * 1000)
      }
    }
    playerController.onVolumeChange = { [weak self] snapshot in
      MainActor.assumeIsolated {
        guard let self else { return }
        // Report volume as 0 while muted, matching Android's semantics.
        let volume = snapshot.isMuted ? 0 : Double(snapshot.volume)
        let next = (volume, snapshot.isMuted)
        guard self.lastVolumeSnapshot?.0 != next.0
          || self.lastVolumeSnapshot?.1 != next.1 else { return }
        self.lastVolumeSnapshot = next
        self.onVolumeChange?(next.0, next.1)
      }
    }
    playerController.onPlaybackRateChange = { [weak self] snapshot in
      MainActor.assumeIsolated {
        guard let self else { return }
        let rate = Double(snapshot.playbackRate)
        guard rate > 0, self.lastPlaybackRate != rate else { return }
        self.lastPlaybackRate = rate
        self.onPlaybackRateChange?(rate)
      }
    }
    playerController.onVideoSizeChange = { [weak self] snapshot in
      MainActor.assumeIsolated {
        self?.emitVideoSizeIfChanged(snapshot.videoSize)
      }
    }
    playerController.onError = { [weak self] error in
      MainActor.assumeIsolated {
        guard let self else { return }
        let nsError = error as NSError
        let message = error.localizedDescription
        let nativeCode = "\(nsError.domain):\(nsError.code)"
        let errorCode = nativeCode.isEmpty ? message : nativeCode
        guard self.lastPlaybackErrorCode != errorCode else { return }
        self.lastPlaybackErrorCode = errorCode
        self.onError?("PLAYBACK_ERROR", message, nativeCode)
        self.onPlaybackError?(message)
      }
    }
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

  private func resetEventDedup() {
    hasEmittedReady = false
    lastVolumeSnapshot = nil
    lastPlaybackRate = nil
    lastVideoSize = nil
    lastPlaybackErrorCode = nil
    lastIsBuffering = nil
  }

  // MARK: - Commands

  /// Commands are issued to the SDK controller; commands sent before the SDK
  /// attaches the `MediaPlayer` are queued inside the controller and replayed
  /// on attach.

  @objc public func play() {
    playerController.play()
  }

  @objc public func pause() {
    playerController.pause()
  }

  @objc public func seekTo(positionMs: Double) {
    guard positionMs.isFinite, positionMs >= 0 else { return }
    playerController.seek(to: positionMs / 1000)
  }

  @objc public func setVolume(volume: Double) {
    guard volume.isFinite else { return }
    playerController.setVolume(Float(max(0, min(1, volume))))
  }

  @objc public func setPlaybackRate(rate: Double) {
    guard rate.isFinite, rate > 0 else { return }
    playerController.setPlaybackRate(Float(rate))
  }

  @objc public func mute() {
    playerController.mute()
  }

  @objc public func unmute() {
    playerController.unmute()
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
  /// and releases the PiP controller. The event closures are kept wired
  /// because the same `BunnyStreamPlayerView` instance (and its emitter) can
  /// be recycled.
  @objc public func cleanup() {
    removeHostingController()
  }
}
