import Foundation
import BunnyStreamAPI
import CryptoKit
import OpenAPIRuntime
import React

/// Swift implementation backing the `BunnyStreamApi` TurboModule.
///
/// Every method resolves its Promise with a `BunnyResult`-shaped envelope
/// (`{ ok: true, value }` / `{ ok: false, error }`) — never rejects — so the
/// typed error taxonomy stays available to the JS caller.
///
/// The iOS SDK does not have a global `initialize()` like Android's
/// `BunnyStreamApi.initialize(...)`. Instead the access key + library ID are
/// stored in `BunnyStreamConfiguration` by the `BunnyStreamPlayer` TurboModule's
/// `initialize(accessKey, libraryId)`, and this module reads them to construct
/// a `BunnyStreamAPI` instance lazily.
@objc public final class BunnyStreamApiModuleImpl: NSObject {

  @objc public static let shared = BunnyStreamApiModuleImpl()

  private override init() { super.init() }

  // MARK: - SDK access

  /// Returns a `BunnyStreamAPI` configured with the stored access key, or `nil`
  /// when `initialize` was never called. `BunnyStreamConfiguration` is thread-
  /// safe so this can be called from any queue (TurboModule methods run on a
  /// background queue, not the main thread).
  private var api: BunnyStreamAPI? {
    let cfg = BunnyStreamConfiguration.shared
    guard cfg.isConfigured, let key = cfg.accessKey else { return nil }
    return BunnyStreamAPI(accessKey: key)
  }

  @objc public var isInitialized: Bool {
    BunnyStreamConfiguration.shared.isConfigured
  }

  // MARK: - ObjC-facing wrappers

  // The Codegen-generated ObjC protocol passes NSNumber* for nullable doubles.
  // These wrappers convert and forward to the internal Swift methods.

  @objc public func listVideosWithLibraryId(_ libraryId: Double,
                                      page: Double,
                                      itemsPerPage: Double,
                                      search: String?,
                                      orderBy: String?,
                                      collectionId: String?,
                                      resolve: @escaping RCTPromiseResolveBlock) {
    listVideos(libraryId: libraryId, page: page, itemsPerPage: itemsPerPage,
               search: search, orderBy: orderBy, collectionId: collectionId, resolve: resolve)
  }

  @objc public func getVideoWithLibraryId(_ libraryId: Double,
                                    videoId: String,
                                    resolve: @escaping RCTPromiseResolveBlock) {
    getVideo(libraryId: libraryId, videoId: videoId, resolve: resolve)
  }

  @objc public func fetchVideoPlayDataWithLibraryId(_ libraryId: Double,
                                              videoId: String,
                                              token: String?,
                                              expires: NSNumber?,
                                              resolve: @escaping RCTPromiseResolveBlock) {
    fetchVideoPlayData(libraryId: libraryId, videoId: videoId,
                       token: token, expires: expires?.doubleValue, resolve: resolve)
  }

  @objc public func createVideoWithLibraryId(_ libraryId: Double,
                                       request: NSDictionary,
                                       resolve: @escaping RCTPromiseResolveBlock) {
    createVideo(libraryId: libraryId, request: request, resolve: resolve)
  }

  @objc public func updateVideoWithLibraryId(_ libraryId: Double,
                                       videoId: String,
                                       request: NSDictionary,
                                       resolve: @escaping RCTPromiseResolveBlock) {
    updateVideo(libraryId: libraryId, videoId: videoId, request: request, resolve: resolve)
  }

  @objc public func deleteVideoWithLibraryId(_ libraryId: Double,
                                       videoId: String,
                                       resolve: @escaping RCTPromiseResolveBlock) {
    deleteVideo(libraryId: libraryId, videoId: videoId, resolve: resolve)
  }

  @objc public func listLiveStreamsWithLibraryId(_ libraryId: Double,
                                           page: NSNumber?,
                                           itemsPerPage: NSNumber?,
                                           search: String?,
                                           orderBy: String?,
                                           collectionId: String?,
                                           resolve: @escaping RCTPromiseResolveBlock) {
    listLiveStreams(libraryId: libraryId, page: page?.doubleValue,
                    itemsPerPage: itemsPerPage?.doubleValue, search: search,
                    orderBy: orderBy, collectionId: collectionId, resolve: resolve)
  }

  @objc public func getLiveStreamWithLibraryId(_ libraryId: Double,
                                         streamId: String,
                                         resolve: @escaping RCTPromiseResolveBlock) {
    getLiveStream(libraryId: libraryId, streamId: streamId, resolve: resolve)
  }

  @objc public func fetchLiveStreamPlayDataWithLibraryId(_ libraryId: Double,
                                                   streamId: String,
                                                   token: String?,
                                                   expires: NSNumber?,
                                                   resolve: @escaping RCTPromiseResolveBlock) {
    fetchLiveStreamPlayData(libraryId: libraryId, streamId: streamId,
                            token: token, expires: expires?.doubleValue, resolve: resolve)
  }

  @objc public func createLiveStreamWithLibraryId(_ libraryId: Double,
                                            request: NSDictionary,
                                            resolve: @escaping RCTPromiseResolveBlock) {
    createLiveStream(libraryId: libraryId, request: request, resolve: resolve)
  }

  @objc public func updateLiveStreamWithLibraryId(_ libraryId: Double,
                                            streamId: String,
                                            request: NSDictionary,
                                            resolve: @escaping RCTPromiseResolveBlock) {
    updateLiveStream(libraryId: libraryId, streamId: streamId, request: request, resolve: resolve)
  }

  @objc public func deleteLiveStreamWithLibraryId(_ libraryId: Double,
                                            streamId: String,
                                            resolve: @escaping RCTPromiseResolveBlock) {
    deleteLiveStream(libraryId: libraryId, streamId: streamId, resolve: resolve)
  }

  @objc public func fetchPlayerSettingsWithLibraryId(_ libraryId: Double,
                                               videoId: String,
                                               token: String?,
                                               expires: NSNumber?,
                                               resolve: @escaping RCTPromiseResolveBlock) {
    fetchPlayerSettings(libraryId: libraryId, videoId: videoId,
                        token: token, expires: expires?.doubleValue, resolve: resolve)
  }

  @objc public func generateEmbedTokenWithTokenAuthKey(_ tokenAuthKey: String,
                                                 videoId: String,
                                                 expires: Double) -> String {
    return generateEmbedToken(tokenAuthKey: tokenAuthKey, videoId: videoId, expires: expires)
  }

  // MARK: - Helpers

  /// Builds the InvalidState envelope for the not-initialised guard.
  private func invalidState(_ message: String) -> [String: Any] {
    errEnvelope(kind: "InvalidState", httpStatus: 0, message: message, isTerminal: true)
  }

  /// Builds an error envelope.
  private func errEnvelope(kind: String, httpStatus: Int, message: String, isTerminal: Bool) -> [String: Any] {
    [
      "ok": false,
      "error": [
        "kind": kind,
        "httpStatus": httpStatus,
        "message": message,
        "isTerminal": isTerminal,
      ],
    ]
  }

  /// Builds an Ok envelope wrapping a value dictionary.
  private func okEnvelope(_ value: Any?) -> [String: Any] {
    ["ok": true, "value": value ?? NSNull()]
  }

  /// Maps a `BunnyLiveStreamError` to the JS error envelope fields.
  private func envelope(from error: BunnyLiveStreamError) -> [String: Any] {
    let kind: String
    switch error.kind {
    case .unauthorized: kind = "Auth"
    case .notFound: kind = "NotFound"
    case .invalidRequest: kind = "InvalidState"
    case .unprocessable: kind = "InvalidState"
    case .server: kind = "Network"
    case .transport: kind = "Network"
    case .invalidResponse: kind = "Decode"
    case .unexpected: kind = "Network"
    }
    return errEnvelope(
      kind: kind,
      httpStatus: error.statusCode ?? 0,
      message: error.errorDescription ?? "Unknown error",
      isTerminal: error.isPermanent
    )
  }

  /// Maps any error thrown by a video operation (generated client) to the JS
  /// error envelope. The generated client throws `ClientError` for transport /
  /// decoding failures and the response-case throws map to HTTP status codes.
  private func envelope(from error: Error) -> [String: Any] {
    if let e = error as? BunnyLiveStreamError { return envelope(from: e) }
    if let e = error as? ClientError {
      if e.underlyingError is URLError {
        return errEnvelope(kind: "Network", httpStatus: 0, message: e.underlyingError.localizedDescription, isTerminal: false)
      }
      return errEnvelope(kind: "Decode", httpStatus: 0, message: e.underlyingError.localizedDescription, isTerminal: false)
    }
    if let e = error as? URLError {
      return errEnvelope(kind: "Network", httpStatus: 0, message: e.localizedDescription, isTerminal: false)
    }
    return errEnvelope(kind: "Network", httpStatus: 0, message: error.localizedDescription, isTerminal: false)
  }

  // MARK: - Video operations

  func listVideos(
    libraryId: Double,
    page: Double,
    itemsPerPage: Double,
    search: String?,
    orderBy: String?,
    collectionId: String?,
    resolve: @escaping RCTPromiseResolveBlock
  ) {
    guard let api else { resolve(invalidState("BunnyStreamApi is not initialised. Call initialize(accessKey, libraryId) first.")); return }
    Task {
      do {
        let output = try await api.client.listVideos(.init(
          path: .init(libraryId: Int64(libraryId)),
          query: .init(
            page: Int32(page),
            itemsPerPage: Int32(itemsPerPage),
            search: search,
            collection: collectionId,
            orderBy: orderBy
          )
        ))
        switch output {
        case .ok(let resp):
          if case .json(let model) = resp.body {
            resolve(okEnvelope(Self.videoListDict(from: model)))
          } else {
            resolve(errEnvelope(kind: "Decode", httpStatus: 0, message: "Unexpected response body", isTerminal: false))
          }
        case .unauthorized:
          resolve(errEnvelope(kind: "Auth", httpStatus: 401, message: "Unauthorized", isTerminal: true))
        case .internalServerError:
          resolve(errEnvelope(kind: "Network", httpStatus: 500, message: "Internal server error", isTerminal: false))
        case .undocumented(let code, _):
          resolve(errEnvelope(kind: "Network", httpStatus: code, message: "HTTP \(code)", isTerminal: !(500...599).contains(code)))
        }
      } catch {
        resolve(envelope(from: error))
      }
    }
  }

  func getVideo(libraryId: Double, videoId: String, resolve: @escaping RCTPromiseResolveBlock) {
    guard let api else { resolve(invalidState("BunnyStreamApi is not initialised.")); return }
    Task {
      do {
        let output = try await api.client.getVideo(.init(path: .init(libraryId: Int64(libraryId), videoId: videoId)))
        switch output {
        case .ok(let resp):
          if case .json(let model) = resp.body {
            resolve(okEnvelope(Self.videoDict(from: model)))
          } else {
            resolve(errEnvelope(kind: "Decode", httpStatus: 0, message: "Unexpected response body", isTerminal: false))
          }
        case .unauthorized:
          resolve(errEnvelope(kind: "Auth", httpStatus: 401, message: "Unauthorized", isTerminal: true))
        case .notFound:
          resolve(errEnvelope(kind: "NotFound", httpStatus: 404, message: "Not found", isTerminal: true))
        case .internalServerError:
          resolve(errEnvelope(kind: "Network", httpStatus: 500, message: "Internal server error", isTerminal: false))
        case .undocumented(let code, _):
          resolve(errEnvelope(kind: "Network", httpStatus: code, message: "HTTP \(code)", isTerminal: !(500...599).contains(code)))
        }
      } catch {
        resolve(envelope(from: error))
      }
    }
  }

  func fetchVideoPlayData(
    libraryId: Double,
    videoId: String,
    token: String?,
    expires: Double?,
    resolve: @escaping RCTPromiseResolveBlock
  ) {
    guard let api else { resolve(invalidState("BunnyStreamApi is not initialised.")); return }
    Task {
      do {
        let output = try await api.client.getVideoPlayData(.init(
          path: .init(libraryId: Int64(libraryId), videoId: videoId),
          query: .init(token: token, expires: expires.map(Int64.init))
        ))
        switch output {
        case .ok(let resp):
          if case .json(let model) = resp.body {
            resolve(okEnvelope(Self.videoPlayDataDict(from: model)))
          } else {
            resolve(errEnvelope(kind: "Decode", httpStatus: 0, message: "Unexpected response body", isTerminal: false))
          }
        case .unauthorized:
          resolve(errEnvelope(kind: "Auth", httpStatus: 401, message: "Unauthorized", isTerminal: true))
        case .notFound:
          resolve(errEnvelope(kind: "NotFound", httpStatus: 404, message: "Not found", isTerminal: true))
        case .internalServerError:
          resolve(errEnvelope(kind: "Network", httpStatus: 500, message: "Internal server error", isTerminal: false))
        case .undocumented(let code, _):
          resolve(errEnvelope(kind: "Network", httpStatus: code, message: "HTTP \(code)", isTerminal: !(500...599).contains(code)))
        }
      } catch {
        resolve(envelope(from: error))
      }
    }
  }

  func createVideo(libraryId: Double, request: NSDictionary, resolve: @escaping RCTPromiseResolveBlock) {
    guard let api else { resolve(invalidState("BunnyStreamApi is not initialised.")); return }
    guard let title = request["title"] as? String, !title.isEmpty else {
      resolve(invalidState("createVideo: missing required field 'title'"))
      return
    }
    let collectionId = request["collectionId"] as? String
    let thumbnailTime: Int32? = (request["thumbnailTime"] as? Double).map { Int32($0) }
    Task {
      do {
        let output = try await api.client.createVideo(.init(
          path: .init(libraryId: Int64(libraryId)),
          body: .json(.CreateVideoModel(.init(
            title: title,
            collectionId: collectionId,
            thumbnailTime: thumbnailTime
          )))
        ))
        switch output {
        case .ok(let resp):
          if case .json(let model) = resp.body {
            resolve(okEnvelope(Self.videoDict(from: model)))
          } else {
            resolve(errEnvelope(kind: "Decode", httpStatus: 0, message: "Unexpected response body", isTerminal: false))
          }
        case .unauthorized:
          resolve(errEnvelope(kind: "Auth", httpStatus: 401, message: "Unauthorized", isTerminal: true))
        case .internalServerError:
          resolve(errEnvelope(kind: "Network", httpStatus: 500, message: "Internal server error", isTerminal: false))
        case .undocumented(let code, _):
          resolve(errEnvelope(kind: "Network", httpStatus: code, message: "HTTP \(code)", isTerminal: !(500...599).contains(code)))
        }
      } catch {
        resolve(envelope(from: error))
      }
    }
  }

  func updateVideo(libraryId: Double, videoId: String, request: NSDictionary, resolve: @escaping RCTPromiseResolveBlock) {
    guard let api else { resolve(invalidState("BunnyStreamApi is not initialised.")); return }
    let title = request["title"] as? String
    let collectionId = request["collectionId"] as? String
    Task {
      do {
        let output = try await api.client.updateVideo(.init(
          path: .init(libraryId: Int64(libraryId), videoId: videoId),
          body: .json(.UpdateVideoModel(.init(title: title, collectionId: collectionId)))
        ))
        switch output {
        case .ok:
          resolve(okEnvelope(NSNull()))
        case .unauthorized:
          resolve(errEnvelope(kind: "Auth", httpStatus: 401, message: "Unauthorized", isTerminal: true))
        case .notFound:
          resolve(errEnvelope(kind: "NotFound", httpStatus: 404, message: "Not found", isTerminal: true))
        case .internalServerError:
          resolve(errEnvelope(kind: "Network", httpStatus: 500, message: "Internal server error", isTerminal: false))
        case .undocumented(let code, _):
          resolve(errEnvelope(kind: "Network", httpStatus: code, message: "HTTP \(code)", isTerminal: !(500...599).contains(code)))
        }
      } catch {
        resolve(envelope(from: error))
      }
    }
  }

  func deleteVideo(libraryId: Double, videoId: String, resolve: @escaping RCTPromiseResolveBlock) {
    guard let api else { resolve(invalidState("BunnyStreamApi is not initialised.")); return }
    Task {
      do {
        let output = try await api.client.deleteVideo(.init(path: .init(libraryId: Int64(libraryId), videoId: videoId)))
        switch output {
        case .ok:
          resolve(okEnvelope(NSNull()))
        case .unauthorized:
          resolve(errEnvelope(kind: "Auth", httpStatus: 401, message: "Unauthorized", isTerminal: true))
        case .notFound:
          resolve(errEnvelope(kind: "NotFound", httpStatus: 404, message: "Not found", isTerminal: true))
        case .internalServerError:
          resolve(errEnvelope(kind: "Network", httpStatus: 500, message: "Internal server error", isTerminal: false))
        case .undocumented(let code, _):
          resolve(errEnvelope(kind: "Network", httpStatus: code, message: "HTTP \(code)", isTerminal: !(500...599).contains(code)))
        }
      } catch {
        resolve(envelope(from: error))
      }
    }
  }

  // MARK: - Live stream operations

  func listLiveStreams(
    libraryId: Double,
    page: Double?,
    itemsPerPage: Double?,
    search: String?,
    orderBy: String?,
    collectionId: String?,
    resolve: @escaping RCTPromiseResolveBlock
  ) {
    guard let api else { resolve(invalidState("BunnyStreamApi is not initialised.")); return }
    let repo = api.liveStreams
    Task {
      do {
        let list = try await repo.listLiveStreams(
          libraryId: Int(libraryId),
          page: page.map(Int.init),
          itemsPerPage: itemsPerPage.map(Int.init),
          search: search,
          orderBy: orderBy
        )
        resolve(okEnvelope(Self.liveStreamListDict(from: list)))
      } catch {
        resolve(envelope(from: error))
      }
    }
  }

  func getLiveStream(libraryId: Double, streamId: String, resolve: @escaping RCTPromiseResolveBlock) {
    guard let api else { resolve(invalidState("BunnyStreamApi is not initialised.")); return }
    let repo = api.liveStreams
    Task {
      do {
        let stream = try await repo.getLiveStream(libraryId: Int(libraryId), streamId: streamId)
        resolve(okEnvelope(Self.liveStreamDict(from: stream)))
      } catch {
        resolve(envelope(from: error))
      }
    }
  }

  func fetchLiveStreamPlayData(
    libraryId: Double,
    streamId: String,
    token: String?,
    expires: Double?,
    resolve: @escaping RCTPromiseResolveBlock
  ) {
    guard let api else { resolve(invalidState("BunnyStreamApi is not initialised.")); return }
    let repo = api.liveStreams
    Task {
      do {
        let data = try await repo.fetchPlayData(
          libraryId: Int(libraryId),
          streamId: streamId,
          token: token,
          expires: expires.map(Int64.init)
        )
        resolve(okEnvelope(Self.liveStreamPlayDataDict(from: data)))
      } catch {
        resolve(envelope(from: error))
      }
    }
  }

  func createLiveStream(libraryId: Double, request: NSDictionary, resolve: @escaping RCTPromiseResolveBlock) {
    guard let api else { resolve(invalidState("BunnyStreamApi is not initialised.")); return }
    let repo = api.liveStreams
    guard let req = Self.parseLiveStreamCreateRequest(request) else {
      resolve(invalidState("createLiveStream: missing required field 'title'"))
      return
    }
    Task {
      do {
        let stream = try await repo.createLiveStream(libraryId: Int(libraryId), request: req)
        resolve(okEnvelope(Self.liveStreamDict(from: stream)))
      } catch {
        resolve(envelope(from: error))
      }
    }
  }

  func updateLiveStream(libraryId: Double, streamId: String, request: NSDictionary, resolve: @escaping RCTPromiseResolveBlock) {
    guard let api else { resolve(invalidState("BunnyStreamApi is not initialised.")); return }
    let repo = api.liveStreams
    let req = Self.parseLiveStreamUpdateRequest(request)
    Task {
      do {
        let stream = try await repo.updateLiveStream(libraryId: Int(libraryId), streamId: streamId, request: req)
        resolve(okEnvelope(Self.liveStreamDict(from: stream)))
      } catch {
        resolve(envelope(from: error))
      }
    }
  }

  func deleteLiveStream(libraryId: Double, streamId: String, resolve: @escaping RCTPromiseResolveBlock) {
    guard let api else { resolve(invalidState("BunnyStreamApi is not initialised.")); return }
    let repo = api.liveStreams
    Task {
      do {
        try await repo.deleteLiveStream(libraryId: Int(libraryId), streamId: streamId)
        resolve(okEnvelope(NSNull()))
      } catch {
        resolve(envelope(from: error))
      }
    }
  }

  // MARK: - Player settings

  func fetchPlayerSettings(
    libraryId: Double,
    videoId: String,
    token: String?,
    expires: Double?,
    resolve: @escaping RCTPromiseResolveBlock
  ) {
    guard let api else { resolve(invalidState("BunnyStreamApi is not initialised.")); return }
    Task {
      do {
        let output = try await api.client.getVideoPlayData(.init(
          path: .init(libraryId: Int64(libraryId), videoId: videoId),
          query: .init(token: token, expires: expires.map(Int64.init))
        ))
        switch output {
        case .ok(let resp):
          if case .json(let model) = resp.body {
            resolve(okEnvelope(Self.playerSettingsDict(from: model)))
          } else {
            resolve(errEnvelope(kind: "Decode", httpStatus: 0, message: "Unexpected response body", isTerminal: false))
          }
        case .unauthorized:
          resolve(errEnvelope(kind: "Auth", httpStatus: 401, message: "Unauthorized", isTerminal: true))
        case .notFound:
          resolve(errEnvelope(kind: "NotFound", httpStatus: 404, message: "Not found", isTerminal: true))
        case .internalServerError:
          resolve(errEnvelope(kind: "Network", httpStatus: 500, message: "Internal server error", isTerminal: false))
        case .undocumented(let code, _):
          resolve(errEnvelope(kind: "Network", httpStatus: code, message: "HTTP \(code)", isTerminal: !(500...599).contains(code)))
        }
      } catch {
        resolve(envelope(from: error))
      }
    }
  }

  // MARK: - Token auth

  func generateEmbedToken(tokenAuthKey: String, videoId: String, expires: Double) -> String {
    let raw = tokenAuthKey + videoId + String(Int64(expires))
    let hash = SHA256.hash(data: Data(raw.utf8))
    return hash.map { String(format: "%02x", $0) }.joined()
  }

  // MARK: - Request parsing

  private static func parseLiveStreamCreateRequest(_ map: NSDictionary) -> BunnyLiveStreamCreateRequest? {
    guard let title = map["title"] as? String, !title.isEmpty else { return nil }
    return BunnyLiveStreamCreateRequest(
      title: title,
      description: map["description"] as? String,
      collectionId: map["collectionId"] as? String,
      scheduledStartTime: (map["scheduledStartTime"] as? String).flatMap(Self.parseDate),
      scheduledEndTime: (map["scheduledEndTime"] as? String).flatMap(Self.parseDate),
      isPublic: map["isPublic"] as? Bool,
      dvrEnabled: map["dvrEnabled"] as? Bool,
      dvrWindowSeconds: (map["dvrWindowSeconds"] as? Double).map(Int.init),
      recordVod: map["recordVod"] as? Bool,
      enableCountdown: map["enableCountdown"] as? Bool,
      preStreamTrailerVideoId: map["preStreamTrailerVideoId"] as? String,
      rtmpOutputs: (map["rtmpOutputs"] as? [[String: Any]]).map { arr in
        arr.map { BunnyRtmpOutput(endpoint: $0["endpoint"] as? String, streamKey: $0["streamKey"] as? String) }
      }
    )
  }

  private static func parseLiveStreamUpdateRequest(_ map: NSDictionary) -> BunnyLiveStreamUpdateRequest {
    BunnyLiveStreamUpdateRequest(
      title: map["title"] as? String,
      description: map["description"] as? String,
      collectionId: map["collectionId"] as? String,
      scheduledStartTime: (map["scheduledStartTime"] as? String).flatMap(Self.parseDate),
      scheduledEndTime: (map["scheduledEndTime"] as? String).flatMap(Self.parseDate),
      isPublic: map["isPublic"] as? Bool,
      dvrEnabled: map["dvrEnabled"] as? Bool,
      dvrWindowSeconds: (map["dvrWindowSeconds"] as? Double).map(Int.init),
      recordVod: map["recordVod"] as? Bool,
      enableCountdown: map["enableCountdown"] as? Bool,
      preStreamTrailerVideoId: map["preStreamTrailerVideoId"] as? String,
      rtmpOutputs: (map["rtmpOutputs"] as? [[String: Any]]).map { arr in
        arr.map { BunnyRtmpOutput(endpoint: $0["endpoint"] as? String, streamKey: $0["streamKey"] as? String) }
      }
    )
  }

  private static func parseDate(_ iso: String) -> Date? {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let d = f.date(from: iso) { return d }
    f.formatOptions = [.withInternetDateTime]
    return f.date(from: iso)
  }

  // MARK: - Domain → NSDictionary mappers

  static func videoDict(from model: Components.Schemas.VideoModel) -> [String: Any] {
    let statusInt: Int
    if case .VideoModelStatus(let s) = model.status {
      statusInt = s.rawValue
    } else {
      statusInt = 0
    }
    return [
      "id": model.guid ?? "",
      "videoLibraryId": model.videoLibraryId ?? 0,
      "title": model.title ?? "",
      "description": NSNull(),
      "collectionId": model.collectionId ?? NSNull(),
      "category": model.category ?? NSNull(),
      "dateUploaded": (model.dateUploaded?.ISO8601Format()) ?? NSNull(),
      "isPublic": model.isPublic ?? false,
      "status": statusInt,
      "lengthSeconds": model.length ?? 0,
      "width": model.width ?? NSNull(),
      "height": model.height ?? NSNull(),
      "framerate": model.framerate ?? NSNull(),
      "rotation": model.rotation ?? NSNull(),
      "availableResolutions": (model.availableResolutions ?? "").split(separator: ",").map { String($0) },
      "outputCodecs": (model.outputCodecs ?? "").split(separator: ",").map { String($0) },
      "hasMp4Fallback": model.hasMP4Fallback ?? false,
      "jitEncodingEnabled": false,
      "storageSizeBytes": model.storageSize ?? 0,
      "encodeProgress": model.encodeProgress ?? 0,
      "hasOriginal": false,
      "originalHash": NSNull(),
      "hasHighQualityPreview": false,
      "thumbnailCount": model.thumbnailCount ?? 0,
      "thumbnailFileName": model.thumbnailFileName ?? NSNull(),
      "thumbnailBlurhash": NSNull(),
      "views": model.views ?? 0,
      "averageWatchTimeSeconds": model.averageWatchTime ?? 0,
      "totalWatchTimeSeconds": model.totalWatchTime ?? 0,
      "captions": (model.captions ?? []).map { captionDict($0) },
      "chapters": (model.chapters ?? []).map { chapterDict($0) },
      "moments": (model.moments ?? []).map { momentDict($0) },
      "metaTags": (model.metaTags ?? []).map { metaTagDict($0) },
    ]
  }

  private static func captionDict(_ c: Components.Schemas.CaptionModel) -> [String: Any] {
    [
      "languageCode": c.srclang ?? NSNull(),
      "label": c.label ?? NSNull(),
      "version": NSNull(),
    ]
  }

  private static func chapterDict(_ c: Components.Schemas.ChapterModel) -> [String: Any] {
    [
      "title": c.title,
      "startSeconds": c.start ?? NSNull(),
      "endSeconds": c.end ?? NSNull(),
    ]
  }

  private static func momentDict(_ m: Components.Schemas.MomentModel) -> [String: Any] {
    [
      "label": m.label,
      "timestampSeconds": m.timestamp ?? NSNull(),
    ]
  }

  private static func metaTagDict(_ m: Components.Schemas.MetaTagModel) -> [String: Any] {
    [
      "property": m.property ?? NSNull(),
      "value": m.value ?? NSNull(),
    ]
  }

  static func videoListDict(from model: Components.Schemas.PaginationListOfVideoModel) -> [String: Any] {
    [
      "totalItems": model.totalItems ?? 0,
      "currentPage": model.currentPage ?? 0,
      "itemsPerPage": model.itemsPerPage ?? 0,
      "items": (model.items ?? []).map { videoDict(from: $0) },
    ]
  }

  static func videoPlayDataDict(from model: Components.Schemas.VideoPlayDataModel) -> [String: Any] {
    var dict: [String: Any] = [
      "libraryName": NSNull(),
      "captionsPath": model.captionsPath ?? NSNull(),
      "seekPath": model.seekPath ?? NSNull(),
      "thumbnailUrl": model.thumbnailUrl ?? NSNull(),
      "fallbackUrl": model.fallbackUrl ?? NSNull(),
      "videoPlaylistUrl": model.videoPlaylistUrl ?? NSNull(),
      "originalUrl": model.originalUrl ?? NSNull(),
      "previewUrl": model.previewUrl ?? NSNull(),
      "controls": model.controls ?? "",
      "enableDRM": model.enableDRM ?? false,
      "drmVersion": model.drmVersion ?? 0,
      "keyColor": 0,
      "vastTagUrl": model.vastTagUrl ?? NSNull(),
      "viAiPublisherId": NSNull(),
      "captionsFontSize": model.captionsFontSize ?? 0,
      "captionsFontColor": NSNull(),
      "captionsBackgroundColor": NSNull(),
      "uiLanguage": model.uiLanguage ?? NSNull(),
      "allowEarlyPlay": model.allowEarlyPlay ?? false,
      "tokenAuthEnabled": model.tokenAuthEnabled ?? false,
      "enableMP4Fallback": model.enableMP4Fallback ?? false,
      "showHeatmap": model.showHeatmap ?? false,
      "fontFamily": model.fontFamily ?? NSNull(),
      "playbackSpeeds": (model.playbackSpeeds ?? "").split(separator: ",").compactMap { Double($0) },
      "widevineMinClientSecurityLevel": NSNull(),
      "zoneTier": NSNull(),
      "isPlayable": true,
      "isPlaylistPlayable": true,
      "preferredPlaybackSource": NSNull(),
      "rememberPlayerPosition": false,
      "customCss": NSNull(),
      "exposeVideoMetadata": false,
      "enableCompactControls": false,
    ]
    if case .VideoModel(let v) = model.video {
      dict["video"] = videoDict(from: v)
    } else {
      dict["video"] = NSNull()
    }
    return dict
  }

  static func playerSettingsDict(from model: Components.Schemas.VideoPlayDataModel) -> [String: Any] {
    [
      "thumbnailUrl": model.thumbnailUrl ?? "",
      "controls": model.controls ?? "",
      "keyColor": 0,
      "captionsFontSize": model.captionsFontSize ?? 0,
      "captionsFontColor": NSNull(),
      "captionsBackgroundColor": NSNull(),
      "uiLanguage": model.uiLanguage ?? "",
      "showHeatmap": model.showHeatmap ?? false,
      "fontFamily": model.fontFamily ?? "",
      "playbackSpeeds": (model.playbackSpeeds ?? "").split(separator: ",").compactMap { Double($0) },
      "drmEnabled": model.enableDRM ?? false,
      "vastTagUrl": model.vastTagUrl ?? NSNull(),
      "videoUrl": model.videoPlaylistUrl ?? "",
      "seekPath": model.seekPath ?? "",
      "captionsPath": model.captionsPath ?? "",
      "resumePosition": 0,
    ]
  }

  static func liveStreamDict(from s: BunnyLiveStream) -> [String: Any] {
    [
      "id": s.id ?? "",
      "videoLibraryId": s.libraryId ?? 0,
      "title": s.title ?? "",
      "description": s.description ?? NSNull(),
      "category": NSNull(),
      "collectionId": s.collectionId ?? NSNull(),
      "isPublic": s.isPublic,
      "status": s.status.rawValue,
      "dateCreated": NSNull(),
      "scheduledStartTime": (s.scheduledStartTime?.ISO8601Format()) ?? NSNull(),
      "scheduledEndTime": (s.scheduledEndTime?.ISO8601Format()) ?? NSNull(),
      "startedAt": (s.startedAt?.ISO8601Format()) ?? NSNull(),
      "endedAt": NSNull(),
      "durationSeconds": NSNull(),
      "streamKey": s.streamKey ?? NSNull(),
      "playbackUrlHls": s.playbackUrl ?? NSNull(),
      "dvrEnabled": s.dvrEnabled,
      "dvrWindowSeconds": s.dvrWindowSeconds == 0 ? NSNull() : s.dvrWindowSeconds,
      "recordVod": s.recordVod,
      "availableResolutions": NSNull(),
      "width": NSNull(),
      "height": NSNull(),
      "framerate": NSNull(),
      "ingestRegion": s.ingestRegion ?? NSNull(),
      "peakConcurrentViewers": NSNull(),
      "totalViewerSeconds": NSNull(),
      "thumbnailFileName": s.thumbnailFileName ?? NSNull(),
      "thumbnailUpdatedAt": NSNull(),
      "enableCountdown": s.enableCountdown ? true : NSNull(),
      "rtmpOutputs": s.rtmpOutputs.map { r -> [String: Any] in
        var d: [String: Any] = [:]
        if let e = r.endpoint { d["endpoint"] = e } else { d["endpoint"] = NSNull() }
        if let k = r.streamKey { d["streamKey"] = k } else { d["streamKey"] = NSNull() }
        return d
      },
      "preStreamTrailerVideoId": s.preStreamTrailerVideoId ?? NSNull(),
      "primaryIngestUrl": s.primaryIngestUrl ?? NSNull(),
      "backupIngestUrl": s.backupIngestUrl ?? NSNull(),
    ]
  }

  static func liveStreamListDict(from list: BunnyLiveStreamList) -> [String: Any] {
    [
      "totalItems": list.totalItems,
      "currentPage": list.currentPage,
      "itemsPerPage": list.itemsPerPage,
      "items": list.items.map { liveStreamDict(from: $0) },
    ]
  }

  static func liveStreamPlayDataDict(from data: BunnyLiveStreamPlayData) -> [String: Any] {
    var dict: [String: Any] = [
      "libraryName": data.libraryName ?? NSNull(),
      "captionsPath": data.captionsPath ?? NSNull(),
      "seekPath": data.seekPath ?? NSNull(),
      "thumbnailUrl": data.thumbnailUrl ?? NSNull(),
      "fallbackUrl": NSNull(),
      "videoPlaylistUrl": data.videoPlaylistUrl ?? NSNull(),
      "originalUrl": NSNull(),
      "previewUrl": data.previewUrl ?? NSNull(),
      "controls": (data.controls.isEmpty ? "" : data.controls.joined(separator: ",")),
      "enableDRM": data.isDRMEnabled,
      "drmVersion": 0,
      "keyColor": 0,
      "vastTagUrl": NSNull(),
      "captionsFontSize": 0,
      "captionsFontColor": NSNull(),
      "captionsBackgroundColor": NSNull(),
      "uiLanguage": data.uiLanguage ?? NSNull(),
      "allowEarlyPlay": false,
      "tokenAuthEnabled": false,
      "enableMP4Fallback": false,
      "showHeatmap": data.showHeatmap,
      "fontFamily": data.fontFamily ?? NSNull(),
      "playbackSpeeds": [] as [Double],
      "widevineMinClientSecurityLevel": NSNull(),
      "zoneTier": NSNull(),
      "rememberPlayerPosition": false,
      "enableCompactControls": data.enableCompactControls,
    ]
    if let s = data.liveStream {
      dict["liveStream"] = liveStreamDict(from: s)
    } else {
      dict["liveStream"] = NSNull()
    }
    return dict
  }
}
