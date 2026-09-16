import BunnyStreamAPI
import BunnyStreamCameraUpload
import Combine
import SwiftUI
import UIKit

/// Swift implementation backing the `BunnyStreamBroadcasterView` Fabric
/// component.
///
/// Hosts the SDK's SwiftUI `BunnyStreamCameraUploadView` inside a
/// `UIHostingController` and forwards broadcast state, duration, camera,
/// mute, ingest, reconnect, failover, and error events to the ObjC++ layer.
@MainActor
@objc public final class BunnyStreamBroadcasterViewImpl: UIView {

  // --- Event closures (set by the ObjC++ layer) ---

  @objc public var onStateChange: ((NSString) -> Void)?
  @objc public var onElapsedTime: ((Int, NSString) -> Void)?
  @objc public var onCameraChange: ((NSString) -> Void)?
  @objc public var onMuteChange: ((Bool) -> Void)?
  @objc public var onIngestStateChange: ((NSString, NSString) -> Void)?
  @objc public var onReconnecting: ((Int, Bool) -> Void)?
  @objc public var onReconnectFailed: (() -> Void)?
  @objc public var onFailover: ((Bool) -> Void)?
  @objc public var onError: ((NSString) -> Void)?

  // --- Pending props (set from ObjC++ updateProps) ---

  @objc public var pendingAccessKey: String?
  @objc public var pendingLibraryId: Int = 0
  @objc public var pendingStreamId: String?
  @objc public var pendingIngestEndpoint: String?
  @objc public var pendingQualityJson: String?
  @objc public var pendingCameraPosition: String = "back"
  @objc public var pendingHideDefaultControls: Bool = false
  @objc public var pendingDualPublish: Bool = false
  @objc public var pendingAutoStart: Bool = false

  // --- SDK controller ---

  private let controller = BunnyBroadcastController()
  private var hostingController: UIHostingController<AnyView>?
  private var cancellables: Set<AnyCancellable> = []
  private var isConfigured = false

  @objc public override init(frame: CGRect) {
    super.init(frame: frame)
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  /// Applies all pending props. Called from `finalizeUpdates`.
  @objc public func commitProps() {
    guard let accessKey = pendingAccessKey, !accessKey.isEmpty else { return }

    if !isConfigured {
      isConfigured = true
      configureView(accessKey: accessKey)
    }
  }

  private func configureView(accessKey: String) {
    if let streamId = pendingStreamId, !streamId.isEmpty {
      // Live broadcast to an existing stream. `BunnyStreamCameraUploadView`
      // needs a real `BunnyLiveStream` — the SDK reads `streamKey` and the
      // ingest URLs from it, so a placeholder cannot publish. The public
      // `LiveStreamRepository` resolves it by id.
      let libraryId = pendingLibraryId
      Task { [weak self] in
        do {
          let stream = try await BunnyStreamAPI(accessKey: accessKey)
            .liveStreams
            .getLiveStream(libraryId: libraryId, streamId: streamId)
          await MainActor.run {
            self?.attachView(accessKey: accessKey, liveStream: stream)
          }
        } catch {
          await MainActor.run {
            self?.isConfigured = false
            self?.onError?("Failed to load live stream: \(error.localizedDescription)" as NSString)
          }
        }
      }
    } else {
      // New VOD recording — no stream to resolve.
      attachView(accessKey: accessKey, liveStream: nil)
    }
  }

  private func attachView(accessKey: String, liveStream: BunnyLiveStream?) {
    let quality = parseQuality(pendingQualityJson)
    let cameraPos = pendingCameraPosition == "front"
      ? BunnyCameraPosition.front : .back

    let swiftUIView: AnyView
    if let liveStream {
      swiftUIView = AnyView(
        BunnyStreamCameraUploadView(
          liveStream: liveStream,
          accessKey: accessKey,
          libraryId: pendingLibraryId,
          quality: quality,
          controller: controller
        )
      )
    } else {
      swiftUIView = AnyView(
        BunnyStreamCameraUploadView(
          accessKey: accessKey,
          libraryId: pendingLibraryId,
          quality: quality,
          controller: controller
        )
      )
    }

    let host = UIHostingController(rootView: swiftUIView)
    host.view.frame = bounds
    host.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    host.view.backgroundColor = .black
    addSubview(host.view)
    hostingController = host

    // Observe controller state changes.
    controller.$state
      .receive(on: DispatchQueue.main)
      .sink { [weak self] state in
        let stateStr: String
        switch state {
        case .idle: stateStr = "idle"
        case .preparing: stateStr = "preparing"
        case .live: stateStr = "live"
        }
        self?.onStateChange?(stateStr as NSString)
      }
      .store(in: &cancellables)

    controller.$isMuted
      .receive(on: DispatchQueue.main)
      .sink { [weak self] muted in
        self?.onMuteChange?(muted)
      }
      .store(in: &cancellables)

    controller.$cameraPosition
      .receive(on: DispatchQueue.main)
      .sink { [weak self] position in
        let pos = position == .front ? "front" : "back"
        self?.onCameraChange?(pos as NSString)
      }
      .store(in: &cancellables)

    controller.$elapsedTime
      .receive(on: DispatchQueue.main)
      .sink { [weak self] formatted in
        guard let formatted = formatted else { return }
        // Parse HH:MM:SS to milliseconds.
        let parts = formatted.split(separator: ":").compactMap { Int($0) }
        let totalSeconds: Int
        if parts.count == 3 {
          totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2]
        } else if parts.count == 2 {
          totalSeconds = parts[0] * 60 + parts[1]
        } else {
          totalSeconds = parts.first ?? 0
        }
        self?.onElapsedTime?(totalSeconds * 1000, formatted as NSString)
      }
      .store(in: &cancellables)

    controller.$primaryIngestLive
      .receive(on: DispatchQueue.main)
      .sink { [weak self] live in
        guard let live = live else { return }
        let state = live ? "live" : "offline"
        self?.onIngestStateChange?("primary" as NSString, state as NSString)
      }
      .store(in: &cancellables)

    controller.$backupIngestLive
      .receive(on: DispatchQueue.main)
      .sink { [weak self] live in
        guard let live = live else { return }
        let state = live ? "live" : "offline"
        self?.onIngestStateChange?("backup" as NSString, state as NSString)
      }
      .store(in: &cancellables)

    // Observe broadcast events.
    controller.onEvent = { [weak self] event in
      guard let self = self else { return }
      DispatchQueue.main.async {
        switch event {
        case .reconnecting(let attempt, let usingBackup):
          self.onReconnecting?(attempt, usingBackup)
        case .reconnectFailed:
          self.onReconnectFailed?()
        case .failedOver(let usingBackup):
          self.onFailover?(usingBackup)
        case .failed(let message):
          self.onError?(message as NSString)
        case .ingestStatusChanged, .preparing, .started, .stopped:
          // Handled via @Published properties above.
          break
        }
      }
    }

    // autoStart is deferred to here — on the live path the view only exists
    // after the stream fetch completes.
    if pendingAutoStart {
      controller.startBroadcast()
      pendingAutoStart = false
    }
  }

  // --- Commands ---

  @objc public func startBroadcast() {
    controller.startBroadcast()
  }

  @objc public func stopBroadcast() {
    controller.stopBroadcast()
  }

  @objc public func switchCamera() {
    controller.rotateCamera()
  }

  @objc public func setMuted(_ muted: Bool) {
    // The SDK only has toggleMute; track state internally.
    if controller.isMuted != muted {
      controller.toggleMute()
    }
  }

  @objc public func toggleMute() {
    controller.toggleMute()
  }

  // --- Helpers ---

  private func parseQuality(_ json: String?) -> BroadcastQuality {
    guard let json = json,
          let data = json.data(using: .utf8),
          let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else {
      return .default
    }

    let resolutionStr = dict["resolution"] as? String ?? "fullHd1080"
    let frameRate = dict["frameRate"] as? Double ?? 30
    let videoBitrate = dict["videoBitrate"] as? Int ?? 9_300_000
    let audioBitrate = dict["audioBitrate"] as? Int ?? 128_000

    let resolution: BroadcastQuality.Resolution
    switch resolutionStr {
    case "sd480": resolution = .sd480
    case "hd720": resolution = .hd720
    case "fullHd1080": resolution = .fullHd1080
    default: resolution = .fullHd1080
    }

    return BroadcastQuality(
      resolution: resolution,
      frameRate: frameRate,
      videoBitrate: videoBitrate,
      audioBitrate: audioBitrate
    )
  }

  /// Called when the view is removed from the React Native tree.
  @objc public func cleanup() {
    controller.stopBroadcast()
    cancellables.removeAll()
    hostingController?.willMove(toParent: nil)
    hostingController?.view.removeFromSuperview()
    hostingController = nil
  }

  public override func layoutSubviews() {
    super.layoutSubviews()
    hostingController?.view.frame = bounds
  }
}
