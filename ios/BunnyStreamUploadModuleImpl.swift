import Foundation
import BunnyStreamAPI
import BunnyStreamUploader
import Combine
import React

/// Swift implementation backing the `BunnyStreamUpload` TurboModule.
///
/// Uploads are identified by an `uploadId` string. On iOS the native uploader
/// does not return an `uploadId` from `uploadVideo` — the uploader creates an
/// `UploadVideoInfo` internally and registers it in the `UploadTracker`. This
/// bridge generates a stable `uploadId` (the `UploadVideoInfo.uuid` string)
/// and reads the tracker to find the `UploadVideoInfo` for control methods.
///
/// Progress and lifecycle events are delivered through `UploadTrackerObservable`
/// (the only public way to observe the tracker, since `UploadTracker.delegate`
/// is internal) and forwarded to JS via `RCTDeviceEventEmitter` under the
/// `bunnyStreamUploadEvent` name.
///
/// Platform notes:
/// - **Basic (URLSessionVideoUploader)**: pause/resume work via
///   `URLSessionTask.suspend/resume`. Uploads do not survive process death.
/// - **TUS (TUSVideoUploader)**: pause/resume/cancel work. A background
///   `URLSession` and persistent cache support recovery after system termination.
///   User force-quit cancels background transfers until relaunch.
///   `TUSVideoUploader.make` calls `start()` internally, which restores
///   stored uploads from previous sessions.
///
/// The iOS uploader requires a pre-provisioned `videoId`. This bridge calls
/// `BunnyStreamAPI.client.createVideo` internally before starting the upload,
/// so the JS caller does not need to provision one separately.
///
/// Security: this module never logs `accessKey`, tokens, or file paths.
@objc public final class BunnyStreamUploadModuleImpl: NSObject {

  @objc public static let shared = BunnyStreamUploadModuleImpl()

  private override init() { super.init() }

  // MARK: - Uploaders

  /// Lazily-created uploaders keyed by mode. Each uploader has its own
  /// `UploadTracker`; we wrap each tracker in an `UploadTrackerObservable`
  /// (the only public way to observe it) and subscribe via Combine.
  ///
  /// Initializing an uploader is expensive — `TUSVideoUploader.make` spawns
  /// a background `URLSession` (synchronous IPC with `nsurlsessiond`) and
  /// scans the on-disk TUS cache — so creation must never happen on the JS
  /// thread, and lookups/control methods must not force-initialize an
  /// uploader they do not need.
  private var _basicUploader: URLSessionVideoUploader?
  private var _tusUploader: TUSVideoUploader?

  private var basicUploader: URLSessionVideoUploader {
    if let existing = _basicUploader { return existing }
    let uploader = URLSessionVideoUploader.make(accessKey: BunnyStreamConfiguration.shared.accessKey ?? "")
    observeTracker(uploader.uploadTracker)
    _basicUploader = uploader
    return uploader
  }

  private var tusUploader: TUSVideoUploader {
    if let existing = _tusUploader { return existing }
    let uploader = TUSVideoUploader.make(accessKey: BunnyStreamConfiguration.shared.accessKey ?? "")
    observeTracker(uploader.uploadTracker)
    _tusUploader = uploader
    return uploader
  }

  /// Uploaders already initialized — iterating this never triggers lazy
  /// initialization of the other uploader.
  private var createdUploaders: [any VideoUploader] {
    var uploaders: [any VideoUploader] = []
    if let _basicUploader { uploaders.append(_basicUploader) }
    if let _tusUploader { uploaders.append(_tusUploader) }
    return uploaders
  }

  /// Holds the `UploadTrackerObservable` instances so they stay alive (they
  /// are the tracker's delegate and must not be deallocated).
  private var trackerObservables: [UploadTrackerObservable] = []
  private var combineCancellables: Set<AnyCancellable> = []

  /// Maps `uploadId` (UUID string) to the last observed `UploadStatus`.
  private var lastStates: [String: UploadStatus] = [:]

  /// Maps `videoId` (the Bunny Stream video GUID) to `uploadId` so we can
  /// correlate tracker updates with the upload that created the video.
  private var videoIdToUploadId: [String: String] = [:]

  /// Maps `videoId` → `libraryId` for videos this bridge created via
  /// `createVideo` inside `startUpload`. `cancelUpload` uses it to delete the
  /// orphaned server-side entry. `continueUpload` videos are never recorded —
  /// the `videoId` belongs to the caller. In-memory only: uploads restored
  /// after a process restart are treated as unowned.
  private var ownedVideoLibraryIds: [String: Int] = [:]

  /// `UUID.uuidString` uppercases the GUID, but Bunny's management API is
  /// case-sensitive and only accepts the lowercase form it issued — an
  /// uppercased videoId makes `deleteVideo` return 404. Always normalize
  /// tracker-derived videoIds through this.
  private func canonicalVideoId(_ uuid: UUID) -> String {
    uuid.uuidString.lowercased()
  }

  /// Delivers upload events to JS. `BunnyStreamUploadModule` (the
  /// `RCTEventEmitter`-backed TurboModule) installs this when it is
  /// created; `sendEventWithName` then routes through
  /// `RCTCallableJSModules` → `RCTDeviceEventEmitter`, which also works in
  /// bridgeless mode where `RCTBridge.current()` is `nil`.
  @objc public var eventEmitter: ((_ name: String, _ body: [String: Any]) -> Void)?

  // MARK: - SDK access

  private var isInitialized: Bool {
    BunnyStreamConfiguration.shared.isConfigured
  }

  private var api: BunnyStreamAPI? {
    let cfg = BunnyStreamConfiguration.shared
    guard cfg.isConfigured, let key = cfg.accessKey else { return nil }
    return BunnyStreamAPI(accessKey: key)
  }

  // MARK: - Upload lifecycle

  @objc public func startUploadWithLibraryId(_ libraryId: Double,
                                              uri: String,
                                              title: String?,
                                              collectionId: String?,
                                              mode: String,
                                              resolve: @escaping RCTPromiseResolveBlock) {
    startUpload(libraryId: libraryId, uri: uri, title: title,
                collectionId: collectionId, mode: mode, resolve: resolve)
  }

  @objc public func continueUploadWithLibraryId(_ libraryId: Double,
                                                videoId: String,
                                                uri: String,
                                                mode: String,
                                                resolve: @escaping RCTPromiseResolveBlock) {
    continueUpload(libraryId: libraryId, videoId: videoId, uri: uri,
                   mode: mode, resolve: resolve)
  }

  @objc public func pauseUploadWithUploadId(_ uploadId: String,
                                            resolve: @escaping RCTPromiseResolveBlock) {
    guard isInitialized else { resolve(invalidState("BunnyStreamApi is not initialised. Call initialize(accessKey, libraryId) first.")); return }
    // Unknown uploadIds are a no-op: the upload is already gone or never
    // registered. This mirrors the Android bridge, where control calls on
    // non-owned ids silently succeed.
    guard let (uploader, info) = findOwner(of: uploadId) else {
      resolve(okEnvelope(NSNull()))
      return
    }
    try? uploader.pauseUpload(for: info)
    resolve(okEnvelope(NSNull()))
  }

  @objc public func resumeUploadWithUploadId(_ uploadId: String,
                                             resolve: @escaping RCTPromiseResolveBlock) {
    guard isInitialized else { resolve(invalidState("BunnyStreamApi is not initialised. Call initialize(accessKey, libraryId) first.")); return }
    // Unknown uploadIds are a no-op: the upload is already gone or never
    // registered. This mirrors the Android bridge, where control calls on
    // non-owned ids silently succeed.
    guard let (uploader, info) = findOwner(of: uploadId) else {
      resolve(okEnvelope(NSNull()))
      return
    }
    try? uploader.resumeUpload(for: info)
    resolve(okEnvelope(NSNull()))
  }

  @objc public func cancelUploadWithUploadId(_ uploadId: String,
                                             resolve: @escaping RCTPromiseResolveBlock) {
    guard isInitialized else { resolve(invalidState("BunnyStreamApi is not initialised. Call initialize(accessKey, libraryId) first.")); return }
    // Resolve the videoId even when the tracker entry is already gone (e.g.
    // failed uploads may lose it) — the ownership marker below is keyed by
    // videoId and still needs cleanup.
    let owner = findOwner(of: uploadId)
    let videoId = owner.map { canonicalVideoId($0.info.videoUUID) }
      ?? videoIdToUploadId.first(where: { $0.value == uploadId })?.key
    if let (uploader, info) = owner {
      try? uploader.removeUpload(for: info)
    }
    lastStates.removeValue(forKey: uploadId)
    if let videoId { videoIdToUploadId.removeValue(forKey: videoId) }
    // Cancelling an upload started via startUpload abandons it, so the video
    // entry it created is deleted — it would otherwise linger in the library
    // as a processing video. continueUpload videos belong to the caller and
    // are never touched. Best-effort: a failed delete leaves an orphan but
    // does not fail the cancel.
    if let videoId,
       let library = ownedVideoLibraryIds.removeValue(forKey: videoId),
       let api {
      deleteVideoEntry(api: api, libraryId: library, videoId: videoId)
    }
    resolve(okEnvelope(NSNull()))
  }

  @objc public func getUploadStateWithUploadId(_ uploadId: String,
                                               resolve: @escaping RCTPromiseResolveBlock) {
    guard let status = lastStates[uploadId] else {
      resolve(okEnvelope(NSNull()))
      return
    }
    let info = findUploadInfo(uploadId)
    let videoId = info.map { canonicalVideoId($0.videoUUID) }
    resolve(okEnvelope(stateDict(from: status, videoId: videoId)))
  }

  /// Reattaches to TUS uploads restored from the persistent cache.
  ///
  /// `TUSVideoUploader.make` calls `start()` internally, which restores
  /// stored uploads into `uploadTracker.uploads`. Touching `tusUploader`
  /// runs that restoration; the Combine subscription then publishes the
  /// restored entries to the tracker observer. We additionally emit an
  /// explicit snapshot per entry so JS always learns each `uploadId`,
  /// even for uploads whose status never changes again.
  @objc public func restoreUploads() {
    // `restoreUploads` is a synchronous TurboModule call — it runs on the JS
    // thread. Creating the TUS uploader spawns a background `URLSession`
    // (synchronous IPC with `nsurlsessiond`, which can block for a long
    // time) and scans the on-disk TUS cache, so the lazy initialization
    // must happen off the JS thread or the app will freeze.
    DispatchQueue.global(qos: .userInitiated).async { [weak self] in
      guard let self else { return }
      let uploader = self.tusUploader
      DispatchQueue.main.async { [weak self, uploader] in
        guard let self else { return }
        for (info, status) in uploader.uploadTracker.uploads {
          let uploadId = info.uuid.uuidString
          let videoId = canonicalVideoId(info.videoUUID)
          self.videoIdToUploadId[videoId] = uploadId
          self.lastStates[uploadId] = status
          self.emitEvent(uploadId: uploadId, videoId: videoId, status: status)
        }
      }
    }
  }

  // MARK: - Codegen event emitter stubs

  @objc public func addListener(_ eventName: String) {
    // Required by Codegen; RCTDeviceEventEmitter manages JS-side listeners.
  }

  @objc public func removeListeners(_ count: Double) {
    // Required by Codegen; no native bookkeeping needed.
  }

  // MARK: - Internals

  private func uploaderForMode(_ mode: String) -> any VideoUploader {
    if mode == "tus" { return tusUploader }
    return basicUploader
  }

  /// Finds the `UploadVideoInfo` for a given `uploadId` (the `UploadVideoInfo.uuid`
  /// string) by searching the trackers of already-initialized uploaders.
  private func findUploadInfo(_ uploadId: String) -> UploadVideoInfo? {
    guard let uuid = UUID(uuidString: uploadId) else { return nil }
    for uploader in createdUploaders {
      if let info = uploader.uploadTracker.uploads.keys.first(where: { $0.uuid == uuid }) {
        return info
      }
    }
    return nil
  }

  /// Finds the `UploadVideoInfo` and the uploader that owns it, for a given
  /// `uploadId`. Control methods should act on the owning uploader only —
  /// calling into the other uploader would force-initialize it.
  private func findOwner(of uploadId: String) -> (uploader: any VideoUploader, info: UploadVideoInfo)? {
    guard let uuid = UUID(uuidString: uploadId) else { return nil }
    for uploader in createdUploaders {
      if let info = uploader.uploadTracker.uploads.keys.first(where: { $0.uuid == uuid }) {
        return (uploader, info)
      }
    }
    return nil
  }

  /// Finds the `UploadVideoInfo` for a given Bunny `videoId` (the `videoUUID`
  /// string) by searching the trackers of already-initialized uploaders.
  /// Used to resolve the `uploadId` (the `UploadVideoInfo.uuid`) after
  /// `uploadVideo(with:)` adds the entry to the tracker.
  private func findUploadInfoByVideoId(_ videoId: String) -> UploadVideoInfo? {
    guard let videoUUID = UUID(uuidString: videoId) else { return nil }
    for uploader in createdUploaders {
      if let info = uploader.uploadTracker.uploads.keys.first(where: { $0.videoUUID == videoUUID }) {
        return info
      }
    }
    return nil
  }

  /// Wraps the tracker in an `UploadTrackerObservable` (which becomes the
  /// delegate) and subscribes to its `$uploads` publisher. When the dictionary
  /// changes, we diff it against `lastStates` and emit events for changed
  /// entries.
  private func observeTracker(_ tracker: UploadTracker) {
    let observable = UploadTrackerObservable(tracker: tracker)
    trackerObservables.append(observable)
    observable.$uploads
      .receive(on: DispatchQueue.main)
      .sink { [weak self] uploads in
        guard let self else { return }
        for (info, status) in uploads {
          let uploadId = info.uuid.uuidString
          let videoId = canonicalVideoId(info.videoUUID)
          // Register the videoId → uploadId mapping if not already present.
          if self.videoIdToUploadId[videoId] == nil {
            self.videoIdToUploadId[videoId] = uploadId
          }
          // Only emit when the status actually changes.
          if self.lastStates[uploadId] != status {
            self.lastStates[uploadId] = status
            self.emitEvent(uploadId: uploadId, videoId: videoId, status: status)
          }
          // A completed or already-removed upload must never have its video
          // deleted by a later cancel — drop the ownership marker.
          switch status {
          case .uploaded, .removed:
            self.ownedVideoLibraryIds.removeValue(forKey: videoId)
          default:
            break
          }
        }
      }
      .store(in: &combineCancellables)
  }

  private func startUpload(libraryId: Double, uri: String, title: String?,
                          collectionId: String?, mode: String,
                          resolve: @escaping RCTPromiseResolveBlock) {
    guard isInitialized else { resolve(invalidState("BunnyStreamApi is not initialised. Call initialize(accessKey, libraryId) first.")); return }
    guard let api else { resolve(invalidState("BunnyStreamApi is not initialised.")); return }

    guard let fileURL = URL(string: uri), fileURL.isFileURL else {
      resolve(invalidState("Invalid upload URI: \(uri). Must be a file:// URL."))
      return
    }

    let resolvedTitle = title ?? fileURL.lastPathComponent
    let library = Int(libraryId)
    let uploader = uploaderForMode(mode)

    Task {
      var createdVideoId: String?
      do {
        // The iOS uploader requires a pre-provisioned videoId. Create the
        // video entry first via the generated API client.
        let videoId = try await createVideoEntry(api: api, libraryId: library,
                                                  title: resolvedTitle,
                                                  collectionId: collectionId)
        createdVideoId = videoId.lowercased()
        ownedVideoLibraryIds[videoId.lowercased()] = library
        let info = VideoInfo(content: .url(fileURL),
                             title: resolvedTitle,
                             fileType: fileTypeForURL(fileURL),
                             videoId: videoId,
                             collectionId: collectionId,
                             libraryId: library)

        // Start the upload — the uploader creates the UploadVideoInfo
        // internally and adds it to the tracker synchronously inside
        // `uploadVideos`. After `uploadVideo(with:)` returns, the entry is
        // already in `uploadTracker.uploads`, so we can read the real
        // `uploadId` (`UploadVideoInfo.uuid`) directly.
        try await uploader.uploadVideo(with: info)

        guard let uploadInfo = findUploadInfoByVideoId(videoId) else {
          ownedVideoLibraryIds.removeValue(forKey: videoId.lowercased())
          deleteVideoEntry(api: api, libraryId: library, videoId: videoId.lowercased())
          resolve(errEnvelope(kind: "NotFound", httpStatus: 0,
                              message: "Upload was started but the tracker has no entry for videoId \(videoId).",
                              isTerminal: true))
          return
        }
        let uploadId = uploadInfo.uuid.uuidString
        resolve(okEnvelope(["uploadId": uploadId] as [String: Any]))
      } catch {
        // The upload never started (or failed immediately) — remove the
        // video entry we created so it does not linger in the library as a
        // processing video.
        if let videoId = createdVideoId {
          ownedVideoLibraryIds.removeValue(forKey: videoId)
          deleteVideoEntry(api: api, libraryId: library, videoId: videoId)
        }
        resolve(envelope(from: error))
      }
    }
  }

  private func continueUpload(libraryId: Double, videoId: String, uri: String,
                              mode: String, resolve: @escaping RCTPromiseResolveBlock) {
    guard isInitialized else { resolve(invalidState("BunnyStreamApi is not initialised. Call initialize(accessKey, libraryId) first.")); return }

    guard let fileURL = URL(string: uri), fileURL.isFileURL else {
      resolve(invalidState("Invalid upload URI: \(uri). Must be a file:// URL."))
      return
    }

    let library = Int(libraryId)
    let uploader = uploaderForMode(mode)

    Task {
      do {
        // For continueUpload, the videoId already exists on the server.
        // Build a VideoInfo with the existing videoId — TUS will resume from
        // the cached fingerprint; basic will re-upload from scratch.
        let info = VideoInfo(content: .url(fileURL),
                             title: fileURL.lastPathComponent,
                             fileType: fileTypeForURL(fileURL),
                             videoId: videoId,
                             collectionId: nil,
                             libraryId: library)

        try await uploader.uploadVideo(with: info)

        guard let uploadInfo = findUploadInfoByVideoId(videoId) else {
          resolve(errEnvelope(kind: "NotFound", httpStatus: 0,
                              message: "Upload was started but the tracker has no entry for videoId \(videoId).",
                              isTerminal: true))
          return
        }
        let uploadId = uploadInfo.uuid.uuidString
        resolve(okEnvelope(["uploadId": uploadId] as [String: Any]))
      } catch {
        resolve(envelope(from: error))
      }
    }
  }

  /// Calls the generated `createVideo` endpoint to provision a `videoId`.
  private func createVideoEntry(api: BunnyStreamAPI, libraryId: Int,
                                 title: String, collectionId: String?) async throws -> String {
    let output = try await api.client.createVideo(.init(
      path: .init(libraryId: Int64(libraryId)),
      body: .json(.CreateVideoModel(.init(
        title: title,
        collectionId: collectionId,
        thumbnailTime: nil
      )))
    ))
    switch output {
    case .ok(let resp):
      if case .json(let model) = resp.body {
        return model.guid ?? ""
      }
      throw VideoUploaderError.failedToCreateVideo
    case .unauthorized:
      throw VideoUploaderError.failedToCreateVideoWithReason(message: "Unauthorized")
    case .internalServerError:
      throw VideoUploaderError.failedToCreateVideoWithReason(message: "Internal server error")
    case .undocumented(let code, _):
      throw VideoUploaderError.failedToCreateVideoWithReason(message: "HTTP \(code)")
    }
  }

  /// Best-effort delete of a video entry created by `startUpload`.
  private func deleteVideoEntry(api: BunnyStreamAPI, libraryId: Int, videoId: String) {
    Task {
      _ = try? await api.client.deleteVideo(.init(path: .init(libraryId: Int64(libraryId), videoId: videoId)))
    }
  }

  private func fileTypeForURL(_ url: URL) -> String {
    let ext = url.pathExtension.lowercased()
    switch ext {
    case "mp4": return "video/mp4"
    case "mov": return "video/quicktime"
    case "m4v": return "video/x-m4v"
    default: return "video/mp4"
    }
  }

  // MARK: - Event emission

  private func emitEvent(uploadId: String, videoId: String, status: UploadStatus) {
    let body = eventDict(uploadId: uploadId, videoId: videoId, status: status)
    if let eventEmitter {
      eventEmitter(Self.eventName, body)
      return
    }
    // Fallback for setups where the TurboModule-backed RCTEventEmitter has
    // not been created yet (e.g. a classic bridge). In bridgeless mode
    // `RCTBridge.current()` is `nil` and this path is a no-op.
    RCTBridge.current()?.eventDispatcher().sendAppEvent(withName: Self.eventName, body: body)
  }

  private func eventDict(uploadId: String, videoId: String, status: UploadStatus) -> [String: Any] {
    switch status {
    case .uploading(let progress):
      return [
        "type": "progress",
        "uploadId": uploadId,
        "videoId": videoId,
        "bytesUploaded": progress.bytesUploaded,
        "totalBytes": progress.totalBytes,
        "progress": progress.fractionCompleted,
        "pauseSupported": "supported",
      ]
    case .paused(let progress):
      return [
        "type": "paused",
        "uploadId": uploadId,
        "videoId": videoId,
        "bytesUploaded": progress.bytesUploaded,
        "totalBytes": progress.totalBytes,
        "progress": progress.fractionCompleted,
        "pauseSupported": "supported",
      ]
    case .failed(let errorMessage):
      return [
        "type": "failed",
        "uploadId": uploadId,
        "videoId": videoId,
        "error": errDict(kind: "Network", httpStatus: 0, message: errorMessage, isTerminal: true),
      ]
    case .uploaded:
      return [
        "type": "completed",
        "uploadId": uploadId,
        "videoId": videoId,
      ]
    case .removed:
      return [
        "type": "cancelled",
        "uploadId": uploadId,
        "videoId": videoId,
      ]
    }
  }

  private func stateDict(from status: UploadStatus, videoId: String?) -> [String: Any] {
    switch status {
    case .uploading(let progress):
      return [
        "status": "uploading",
        "videoId": videoId ?? NSNull(),
        "bytesUploaded": progress.bytesUploaded,
        "totalBytes": progress.totalBytes,
        "progress": progress.fractionCompleted,
      ]
    case .paused(let progress):
      return [
        "status": "paused",
        "videoId": videoId ?? NSNull(),
        "bytesUploaded": progress.bytesUploaded,
        "totalBytes": progress.totalBytes,
        "progress": progress.fractionCompleted,
      ]
    case .failed(let errorMessage):
      return [
        "status": "failed",
        "videoId": videoId ?? NSNull(),
        "error": errDict(kind: "Network", httpStatus: 0, message: errorMessage, isTerminal: true),
      ]
    case .uploaded:
      return ["status": "completed", "videoId": videoId ?? NSNull()]
    case .removed:
      return ["status": "cancelled", "videoId": videoId ?? NSNull()]
    }
  }

  // MARK: - Envelope helpers

  private func invalidState(_ message: String) -> [String: Any] {
    errEnvelope(kind: "InvalidState", httpStatus: 0, message: message, isTerminal: true)
  }

  private func errEnvelope(kind: String, httpStatus: Int, message: String, isTerminal: Bool) -> [String: Any] {
    ["ok": false, "error": errDict(kind: kind, httpStatus: httpStatus, message: message, isTerminal: isTerminal)]
  }

  private func errDict(kind: String, httpStatus: Int, message: String, isTerminal: Bool) -> [String: Any] {
    ["kind": kind, "httpStatus": httpStatus, "message": message, "isTerminal": isTerminal]
  }

  private func okEnvelope(_ value: Any?) -> [String: Any] {
    ["ok": true, "value": value ?? NSNull()]
  }

  private func envelope(from error: Error) -> [String: Any] {
    if let e = error as? VideoUploaderError {
      return errEnvelope(kind: "InvalidState", httpStatus: 0, message: e.errorDescription ?? "Upload failed", isTerminal: true)
    }
    return errEnvelope(kind: "Network", httpStatus: 0, message: error.localizedDescription, isTerminal: false)
  }

  // MARK: - Constants

  @objc public static let eventName = "bunnyStreamUploadEvent"
}
