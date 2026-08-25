import SwiftUI
import UIKit
import BunnyStreamAPI
import BunnyStreamPlayer

/// Swift wrapper that hosts the SDK's `BunnyStreamLivePlayer` SwiftUI view
/// inside a `UIHostingController`, managed by the Fabric component view.
///
/// The iOS SDK exposes `onStateChange` and `onPlaybackError` callbacks for
/// live playback (Plan-iOS.md §13.3). This wrapper:
///
/// - Creates a `BunnyStreamLivePlayer` with the current props and hosts it.
/// - Forwards `onStateChange` to the Fabric event emitter as
///   `onLiveStateChange`.
/// - Forwards terminal errors from `onPlaybackError` as `onLiveError`
///   (only when `(error as? BunnyLiveStreamError)?.isPermanent == true`).
/// - `onVideoSizeChange` is **not emitted** because the SDK does not expose
///   this callback for live (Plan-iOS.md §12.2).
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

  /// Closure called when a live state change should be emitted to JS.
  /// Payload: (stateString, isLive, reason?, targetEpochMs?, title?, dvrEnabled?)
  @objc public var onLiveStateChange: ((String, Bool, String?, NSNumber?, String?, Bool) -> Void)?

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

    // Wrap in AnyView so the hosting controller type is stable across reloads.
    let host = UIHostingController(rootView: AnyView(livePlayer))
    host.view.backgroundColor = .black
    host.view.translatesAutoresizingMaskIntoConstraints = false
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
  }

  private func removeHostingController() {
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
  }

  // MARK: - State mapping

  private func handleStateChange(_ state: BunnyLiveStreamPlaybackState) {
    let (stateString, isLive) = mapLiveState(state)
    onLiveStateChange?(stateString, isLive, nil, nil, nil, false)
  }

  private func handlePlaybackError(_ error: Error) {
    // Only forward terminal/permanent errors as onLiveError.
    // The SDK's onPlaybackError also fires for transient failures that the
    // player recovers from on its own — those should NOT trigger onLiveError
    // (Plan-iOS.md §12.2).
    if let liveError = error as? BunnyLiveStreamError, liveError.isPermanent {
      onLiveError?(error.localizedDescription)
    }
  }

  /// Maps `BunnyLiveStreamPlaybackState` to the Codegen `onLiveStateChange`
  /// payload (state string + isLive boolean).
  private func mapLiveState(_ state: BunnyLiveStreamPlaybackState) -> (String, Bool) {
    switch state {
    case .loading:
      return ("loading", false)
    case .playing(let isVodRecording):
      // `.playing(isVodRecording: true)` is a finished stream's recording,
      // `.playing(isVodRecording: false)` is the live edge.
      return (isVodRecording ? "vod" : "live", !isVodRecording)
    case .countdown:
      return ("countdown", false)
    case .trailer:
      return ("trailer", false)
    case .offline:
      return ("offline", false)
    case .failed:
      return ("offline", false)
    }
  }

  @objc public func cleanup() {
    onLiveStateChange = nil
    onLiveError = nil
    removeHostingController()
  }
}
