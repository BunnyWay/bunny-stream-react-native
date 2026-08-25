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
/// - Events (`onReady`, `onProgress`, etc.) are **not emitted** because the
///   SDK does not expose public callbacks. The Fabric event emitter is wired
///   but never fires until the SDK adds callback support (Plan-iOS.md §12.1).
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

  private var hostingController: UIHostingController<BunnyStreamPlayer>?
  private var currentProps = Props()
  private var isMounted = false

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

    let host = UIHostingController(rootView: player)
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
  }

  private func removeHostingController() {
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

  /// Called when the Fabric view is dropped. Removes the hosted SwiftUI view.
  @objc public func cleanup() {
    removeHostingController()
  }
}
