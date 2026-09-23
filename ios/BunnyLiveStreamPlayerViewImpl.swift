import SwiftUI
import UIKit
import BunnyStreamAPI
import BunnyStreamPlayer

/// Swift wrapper that hosts the SDK's `BunnyStreamLivePlayer` SwiftUI view
/// inside a `UIHostingController`, managed by the Fabric component view.
///
/// The iOS SDK exposes `onStateChange` and `onPlaybackError` callbacks for
/// live playback. This wrapper:
///
/// - Creates a `BunnyStreamLivePlayer` with the current props and hosts it.
/// - Forwards `onStateChange` to the Fabric event emitter as
///   `onLiveStateChange`.
/// - Forwards terminal errors from `onPlaybackError` as `onLiveError`
///   (only when `(error as? BunnyLiveStreamError)?.isPermanent == true`).
/// - `onVideoSizeChange` is **not emitted** because the SDK does not expose
///   this callback for live.
/// - `dvrEnabled` is not part of the public playback state either, so the
///   bridge fetches it once per mount from `LiveStreamRepository` (the public
///   `BunnyLiveStream` model carries it) and attaches it to every
///   `onLiveStateChange` payload.
/// - Recreates the hosted view only when the source identity changes.
@MainActor
@objc public final class BunnyLiveStreamPlayerViewImpl: UIView {

  /// Immutable snapshot of committed props.
  struct Props: Equatable {
    var libraryId: Int = 0
    var streamId: String = ""
    var token: String? = nil
    var expires: Int64? = nil
  }

  private var hostingController: UIHostingController<AnyView>?
  private var currentProps = Props()
  private var isMounted = false

  /// `dvrEnabled` for the current stream, fetched once in `reloadPlayer`
  /// (the SDK's public live playback state does not carry it).
  private var dvrEnabled = false
  private var loadGeneration = 0

  /// Recovery for a just-ended stream whose recording is still being finalised.
  ///
  /// The iOS SDK treats every playback 403 as terminal, but during the
  /// ENDED → VOD transition the CDN keeps refusing until the recording is
  /// published (~30–60 s). When a terminal error arrives and the stream still
  /// reports a recordable ended/processing state, the hosted player is
  /// recreated after a delay — each reload re-polls and retries the recording's
  /// `/play` from scratch. Bounded by `maxRecoveryAttempts`, matching the
  /// Android SDK's recovery loop.
  private var recoveryAttempts = 0
  private var recoveryTask: Task<Void, Never>?
  private static let maxRecoveryAttempts = 12
  private static let recoveryDelayNs: UInt64 = 5_000_000_000

  /// Closure called when a live state change should be emitted to JS.
  /// Payload: state, isLive, reason, targetEpochMs, title, videoId, message, dvrEnabled.
  @objc public var onLiveStateChange: ((String, Bool, String?, NSNumber?, String?, String?, String?, Bool) -> Void)?

  /// Closure called when a terminal live error should be emitted to JS.
  @objc public var onLiveError: ((String) -> Void)?

  public override init(frame: CGRect) {
    super.init(frame: frame)
    backgroundColor = .black
  }

  public required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  // Pending props — set individually by the Fabric view, snapshotted in commitProps.
  @objc public var pendingLibraryId: Int = 0
  @objc public var pendingStreamId: String = ""
  @objc public var pendingToken: String? = nil
  @objc public var pendingExpires: NSNumber? = nil

  @objc public func commitProps() {
    let next = Props(
      libraryId: pendingLibraryId,
      streamId: pendingStreamId,
      token: pendingToken,
      expires: pendingExpires?.int64Value
    )

    let sourceChanged = next != currentProps
    currentProps = next

    if sourceChanged {
      recoveryAttempts = 0
    }

    if next.streamId.isEmpty {
      removeHostingController()
      return
    }

    if sourceChanged || !isMounted {
      reloadPlayer()
    }
  }

  private func reloadPlayer() {
    removeHostingController()

    let accessKey = BunnyStreamConfiguration.shared.accessKey ?? ""

    let onStateChange: (BunnyLiveStreamPlaybackState) -> Void = { [weak self] state in
      self?.handleStateChange(state)
    }

    let onPlaybackError: (Error) -> Void = { [weak self] error in
      self?.handlePlaybackError(error)
    }

    let livePlayer = BunnyStreamLivePlayer(
      accessKey: accessKey,
      libraryId: currentProps.libraryId,
      streamId: currentProps.streamId,
      token: currentProps.token,
      expires: currentProps.expires,
      onStateChange: onStateChange,
      onPlaybackError: onPlaybackError
    )
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .ignoresSafeArea()

    // Wrap in AnyView so the hosting controller type is stable across reloads.
    let host = UIHostingController(rootView: AnyView(livePlayer))
    if #available(iOS 16.4, *) {
      host.safeAreaRegions = []
    }
    host.view.backgroundColor = .black
    host.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    host.view.frame = bounds

    if let parentVC = findParentViewController() {
      parentVC.addChild(host)
      addSubview(host.view)
      host.didMove(toParent: parentVC)
    } else {
      addSubview(host.view)
    }
    hostingController = host
    isMounted = true

    // `dvrEnabled` is missing from the public live playback state — fetch it
    // once from the repository. Failure leaves the default (false).
    dvrEnabled = false
    loadGeneration += 1
    let generation = loadGeneration
    let libraryId = currentProps.libraryId
    let streamId = currentProps.streamId
    Task { [weak self] in
      guard let stream = try? await BunnyStreamAPI(accessKey: accessKey)
        .liveStreams
        .getLiveStream(libraryId: libraryId, streamId: streamId)
      else { return }
      await MainActor.run {
        guard let self, self.loadGeneration == generation else { return }
        self.dvrEnabled = stream.dvrEnabled
      }
    }
  }

  private func removeHostingController() {
    loadGeneration += 1
    dvrEnabled = false
    recoveryTask?.cancel()
    recoveryTask = nil
    hostingController?.willMove(toParent: nil)
    hostingController?.view.removeFromSuperview()
    hostingController?.removeFromParent()
    hostingController = nil
    isMounted = false
  }

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

  // MARK: - State mapping

  private func handleStateChange(_ state: BunnyLiveStreamPlaybackState) {
    let payload = mapLiveState(state)
    onLiveStateChange?(
      payload.state,
      payload.isLive,
      payload.reason,
      payload.targetEpochMs,
      payload.title,
      payload.videoId,
      payload.message,
      dvrEnabled
    )
  }

  private func handlePlaybackError(_ error: Error) {
    // Only forward terminal/permanent errors as onLiveError.
    // The SDK's onPlaybackError also fires for transient failures that the
    // player recovers from on its own — those should NOT trigger onLiveError.
    guard let liveError = error as? BunnyLiveStreamError, liveError.isPermanent else { return }

    // A 403 right after a stream ended usually means the recording is still
    // being finalised, not that playback is really refused — the SDK gives up
    // on the first 403, so the decision needs a fresh status fetch. A genuine
    // auth failure fails this fetch too and the error surfaces immediately.
    let generation = loadGeneration
    let libraryId = currentProps.libraryId
    let streamId = currentProps.streamId
    let accessKey = BunnyStreamConfiguration.shared.accessKey ?? ""
    Task { [weak self] in
      let stream = try? await BunnyStreamAPI(accessKey: accessKey)
        .liveStreams
        .getLiveStream(libraryId: libraryId, streamId: streamId)
      let recordingPending = stream.map {
        ($0.status == .ended || $0.status == .vodProcessing) && $0.recordVod
      } ?? false
      guard let self, self.loadGeneration == generation, self.isMounted else { return }
      if recordingPending && self.recoveryAttempts < Self.maxRecoveryAttempts {
        self.scheduleRecovery()
      } else {
        self.onLiveError?(error.localizedDescription)
      }
    }
  }

  private func scheduleRecovery() {
    guard recoveryTask == nil else { return }
    recoveryAttempts += 1
    recoveryTask = Task { [weak self] in
      try? await Task.sleep(nanoseconds: Self.recoveryDelayNs)
      guard let self, !Task.isCancelled else { return }
      self.recoveryTask = nil
      self.reloadPlayer()
    }
  }

  private struct LiveStatePayload {
    let state: String
    let isLive: Bool
    let reason: String?
    let targetEpochMs: NSNumber?
    let title: String?
    let videoId: String?
    let message: String?
  }

  /// Maps every value currently exposed by `BunnyLiveStreamPlaybackState` to
  /// the shared Codegen payload. `dvrEnabled` is attached separately from the
  /// repository fetch in `reloadPlayer` (the playback state does not carry it).
  private func mapLiveState(_ state: BunnyLiveStreamPlaybackState) -> LiveStatePayload {
    switch state {
    case .loading:
      return LiveStatePayload(
        state: "loading",
        isLive: false,
        reason: nil,
        targetEpochMs: nil,
        title: nil,
        videoId: nil,
        message: nil
      )
    case .playing(let isVodRecording):
      return LiveStatePayload(
        state: isVodRecording ? "vod" : "live",
        isLive: !isVodRecording,
        reason: nil,
        targetEpochMs: nil,
        title: nil,
        videoId: nil,
        message: nil
      )
    case .countdown(let date, let title):
      return LiveStatePayload(
        state: "countdown",
        isLive: false,
        reason: nil,
        targetEpochMs: NSNumber(value: date.timeIntervalSince1970 * 1000),
        title: title,
        videoId: nil,
        message: nil
      )
    case .trailer(let vodId, let scheduledStart, let title):
      return LiveStatePayload(
        state: "trailer",
        isLive: false,
        reason: nil,
        targetEpochMs: scheduledStart.map { NSNumber(value: $0.timeIntervalSince1970 * 1000) },
        title: title,
        videoId: vodId,
        message: nil
      )
    case .offline(let message):
      return LiveStatePayload(
        state: "offline",
        isLive: false,
        reason: "offline",
        targetEpochMs: nil,
        title: nil,
        videoId: nil,
        message: message
      )
    case .failed(let message):
      return LiveStatePayload(
        state: "offline",
        isLive: false,
        reason: "failed",
        targetEpochMs: nil,
        title: nil,
        videoId: nil,
        message: message
      )
    }
  }

  @objc public func cleanup() {
    removeHostingController()
  }
}
