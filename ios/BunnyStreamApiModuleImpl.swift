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
///
/// TODO(iOS SDK): Replace generated video API models with stable domain
/// VideoRepository and CollectionRepository surfaces when they become public.
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

  @objc public func fetchVideoHeatmapWithLibraryId(_ libraryId: Double,
                                                   videoId: String,
                                                   resolve: @escaping RCTPromiseResolveBlock) {
    fetchVideoHeatmap(libraryId: libraryId, videoId: videoId, resolve: resolve)
  }

  @objc public func fetchVideoStatisticsWithLibraryId(_ libraryId: Double,
                                                      videoId: String?,
                                                      dateFrom: String?,
                                                      dateTo: String?,
                                                      hourly: Bool,
                                                      resolve: @escaping RCTPromiseResolveBlock) {
    fetchVideoStatistics(libraryId: libraryId, videoId: videoId, dateFrom: dateFrom,
                         dateTo: dateTo, hourly: hourly, resolve: resolve)
  }

  @objc public func fetchVideoResolutionsWithLibraryId(_ libraryId: Double,
                                                       videoId: String,
                                                       resolve: @escaping RCTPromiseResolveBlock) {
    fetchVideoResolutions(libraryId: libraryId, videoId: videoId, resolve: resolve)
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

  @objc public func listCollectionsWithLibraryId(_ libraryId: Double,
                                                 page: Double,
                                                 itemsPerPage: Double,
                                                 search: String?,
                                                 orderBy: String,
                                                 includeThumbnails: Bool,
                                                 resolve: @escaping RCTPromiseResolveBlock) {
    listCollections(libraryId: libraryId, page: page, itemsPerPage: itemsPerPage,
                    search: search, orderBy: orderBy, includeThumbnails: includeThumbnails,
                    resolve: resolve)
  }

  @objc public func getCollectionWithLibraryId(_ libraryId: Double,
                                               collectionId: String,
                                               includeThumbnails: Bool,
                                               resolve: @escaping RCTPromiseResolveBlock) {
    getCollection(libraryId: libraryId, collectionId: collectionId,
                  includeThumbnails: includeThumbnails, resolve: resolve)
  }

  @objc public func createCollectionWithLibraryId(_ libraryId: Double,
                                                  name: String,
                                                  resolve: @escaping RCTPromiseResolveBlock) {
    createCollection(libraryId: libraryId, name: name, resolve: resolve)
  }

  @objc public func updateCollectionWithLibraryId(_ libraryId: Double,
                                                  collectionId: String,
                                                  name: String,
                                                  resolve: @escaping RCTPromiseResolveBlock) {
    updateCollection(libraryId: libraryId, collectionId: collectionId, name: name, resolve: resolve)
  }

  @objc public func deleteCollectionWithLibraryId(_ libraryId: Double,
                                                  collectionId: String,
                                                  resolve: @escaping RCTPromiseResolveBlock) {
    deleteCollection(libraryId: libraryId, collectionId: collectionId, resolve: resolve)
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

  @objc public func startLiveStreamWithLibraryId(_ libraryId: Double,
                                                 streamId: String,
                                                 resolve: @escaping RCTPromiseResolveBlock) {
    startLiveStream(libraryId: libraryId, streamId: streamId, resolve: resolve)
  }

  @objc public func stopLiveStreamWithLibraryId(_ libraryId: Double,
                                                streamId: String,
                                                resolve: @escaping RCTPromiseResolveBlock) {
    stopLiveStream(libraryId: libraryId, streamId: streamId, resolve: resolve)
  }

  @objc public func getLiveStreamStatusWithLibraryId(_ libraryId: Double,
                                                     streamId: String,
                                                     resolve: @escaping RCTPromiseResolveBlock) {
    getLiveStreamStatus(libraryId: libraryId, streamId: streamId, resolve: resolve)
  }

  @objc public func setLiveStreamThumbnailWithLibraryId(_ libraryId: Double,
                                                        streamId: String,
                                                        thumbnailUrl: String,
                                                        resolve: @escaping RCTPromiseResolveBlock) {
    setLiveStreamThumbnail(libraryId: libraryId, streamId: streamId,
                           thumbnailUrl: thumbnailUrl, resolve: resolve)
  }

  @objc public func uploadLiveStreamThumbnailWithLibraryId(_ libraryId: Double,
                                                           streamId: String,
                                                           uri: String,
                                                           contentType: String,
                                                           resolve: @escaping RCTPromiseResolveBlock) {
    uploadLiveStreamThumbnail(libraryId: libraryId, streamId: streamId, uri: uri,
                              contentType: contentType, resolve: resolve)
  }

  @objc public func listLiveStreamThumbnailsWithLibraryId(_ libraryId: Double,
                                                          streamId: String,
                                                          limit: NSNumber?,
                                                          from: String?,
                                                          to: String?,
                                                          resolve: @escaping RCTPromiseResolveBlock) {
    listLiveStreamThumbnails(libraryId: libraryId, streamId: streamId,
                             limit: limit?.doubleValue, from: from, to: to, resolve: resolve)
  }

  @objc public func deleteLiveStreamThumbnailWithLibraryId(_ libraryId: Double,
                                                           streamId: String,
                                                           restoreLibraryDefault: Bool,
                                                           resolve: @escaping RCTPromiseResolveBlock) {
    deleteLiveStreamThumbnail(libraryId: libraryId, streamId: streamId,
                              restoreLibraryDefault: restoreLibraryDefault, resolve: resolve)
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

  private func decodeError(_ message: String = "Unexpected response body") -> [String: Any] {
    errEnvelope(kind: "Decode", httpStatus: 0, message: message, isTerminal: false)
  }

  private func httpError(status: Int) -> [String: Any] {
    switch status {
    case 401, 403:
      return errEnvelope(kind: "Auth", httpStatus: status, message: "Unauthorized", isTerminal: true)
    case 404, 410:
      return errEnvelope(kind: "NotFound", httpStatus: status, message: "Not found", isTerminal: true)
    default:
      return errEnvelope(kind: "Http", httpStatus: status, message: "HTTP \(status)", isTerminal: false)
    }
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

  func fetchVideoHeatmap(libraryId: Double, videoId: String, resolve: @escaping RCTPromiseResolveBlock) {
    guard let api else { resolve(invalidState("BunnyStreamApi is not initialised.")); return }
    Task {
      do {
        let output = try await api.client.getVideoHeatmap(.init(
          path: .init(libraryId: Int64(libraryId), videoId: videoId)
        ))
        switch output {
        case .ok(let response):
          if case .json(let model) = response.body {
            resolve(okEnvelope(model.heatmap?.additionalProperties ?? [:]))
          } else {
            resolve(decodeError())
          }
        case .unauthorized:
          resolve(httpError(status: 401))
        case .notFound:
          resolve(httpError(status: 404))
        case .internalServerError:
          resolve(httpError(status: 500))
        case .undocumented(let code, _):
          resolve(httpError(status: code))
        }
      } catch {
        resolve(envelope(from: error))
      }
    }
  }

  func fetchVideoStatistics(
    libraryId: Double,
    videoId: String?,
    dateFrom: String?,
    dateTo: String?,
    hourly: Bool,
    resolve: @escaping RCTPromiseResolveBlock
  ) {
    guard let api else { resolve(invalidState("BunnyStreamApi is not initialised.")); return }
    let parsedFrom = dateFrom.flatMap(Self.parseDate)
    let parsedTo = dateTo.flatMap(Self.parseDate)
    if dateFrom != nil && parsedFrom == nil {
      resolve(invalidState("fetchVideoStatistics: 'dateFrom' must be a valid ISO 8601 date"))
      return
    }
    if dateTo != nil && parsedTo == nil {
      resolve(invalidState("fetchVideoStatistics: 'dateTo' must be a valid ISO 8601 date"))
      return
    }
    Task {
      do {
        let output = try await api.client.getVideoStatistics(.init(
          path: .init(libraryId: Int64(libraryId)),
          query: .init(dateFrom: parsedFrom, dateTo: parsedTo, hourly: hourly, videoGuid: videoId)
        ))
        switch output {
        case .ok(let response):
          if case .json(let model) = response.body {
            resolve(okEnvelope(Self.videoStatisticsDict(from: model)))
          } else {
            resolve(decodeError())
          }
        case .unauthorized:
          resolve(httpError(status: 401))
        case .notFound:
          resolve(httpError(status: 404))
        case .internalServerError:
          resolve(httpError(status: 500))
        case .undocumented(let code, _):
          resolve(httpError(status: code))
        }
      } catch {
        resolve(envelope(from: error))
      }
    }
  }

  func fetchVideoResolutions(libraryId: Double, videoId: String, resolve: @escaping RCTPromiseResolveBlock) {
    guard let api else { resolve(invalidState("BunnyStreamApi is not initialised.")); return }
    Task {
      do {
        let output = try await api.client.getVideoResolutions(.init(
          path: .init(libraryId: Int64(libraryId), videoId: videoId)
        ))
        switch output {
        case .ok(let response):
          guard case .json(let status) = response.body else {
            resolve(decodeError())
            return
          }
          if status.value1.success == false {
            let code = status.value1.statusCode.map(Int.init) ?? 0
            resolve(errEnvelope(kind: "InvalidState", httpStatus: code,
                                message: status.value1.message ?? "Unable to fetch video resolutions",
                                isTerminal: true))
          } else if case .VideoResolutionsInfoModel(let model)? = status.value2.data {
            resolve(okEnvelope(Self.videoResolutionsDict(from: model)))
          } else {
            resolve(decodeError("Video resolutions response did not contain data"))
          }
        case .unauthorized:
          resolve(httpError(status: 401))
        case .notFound:
          resolve(httpError(status: 404))
        case .internalServerError:
          resolve(httpError(status: 500))
        case .undocumented(let code, _):
          resolve(httpError(status: code))
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

  // MARK: - Collection operations

  func listCollections(
    libraryId: Double,
    page: Double,
    itemsPerPage: Double,
    search: String?,
    orderBy: String,
    includeThumbnails: Bool,
    resolve: @escaping RCTPromiseResolveBlock
  ) {
    guard let api else { resolve(invalidState("BunnyStreamApi is not initialised.")); return }
    Task {
      do {
        let output = try await api.client.listCollections(.init(
          path: .init(libraryId: Int64(libraryId)),
          query: .init(page: Int32(page), itemsPerPage: Int32(itemsPerPage), search: search,
                       orderBy: orderBy, includeThumbnails: includeThumbnails)
        ))
        switch output {
        case .ok(let response):
          if case .json(let model) = response.body {
            resolve(okEnvelope(Self.collectionListDict(from: model)))
          } else {
            resolve(decodeError())
          }
        case .unauthorized:
          resolve(httpError(status: 401))
        case .internalServerError:
          resolve(httpError(status: 500))
        case .undocumented(let code, _):
          resolve(httpError(status: code))
        }
      } catch {
        resolve(envelope(from: error))
      }
    }
  }

  func getCollection(
    libraryId: Double,
    collectionId: String,
    includeThumbnails: Bool,
    resolve: @escaping RCTPromiseResolveBlock
  ) {
    guard let api else { resolve(invalidState("BunnyStreamApi is not initialised.")); return }
    Task {
      do {
        let output = try await api.client.getCollection(.init(
          path: .init(libraryId: Int64(libraryId), collectionId: collectionId),
          query: .init(includeThumbnails: includeThumbnails)
        ))
        switch output {
        case .ok(let response):
          if case .json(let model) = response.body {
            resolve(okEnvelope(Self.collectionDict(from: model)))
          } else {
            resolve(decodeError())
          }
        case .unauthorized:
          resolve(httpError(status: 401))
        case .notFound:
          resolve(httpError(status: 404))
        case .internalServerError:
          resolve(httpError(status: 500))
        case .undocumented(let code, _):
          resolve(httpError(status: code))
        }
      } catch {
        resolve(envelope(from: error))
      }
    }
  }

  func createCollection(libraryId: Double, name: String, resolve: @escaping RCTPromiseResolveBlock) {
    guard let api else { resolve(invalidState("BunnyStreamApi is not initialised.")); return }
    guard !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { resolve(invalidState("createCollection: 'name' must not be blank")); return }
    Task {
      do {
        let output = try await api.client.createCollection(.init(
          path: .init(libraryId: Int64(libraryId)),
          body: .json(.UpdateCollectionModel(.init(name: name)))
        ))
        switch output {
        case .ok(let response):
          if case .json(let model) = response.body {
            resolve(okEnvelope(Self.collectionDict(from: model)))
          } else {
            resolve(decodeError())
          }
        case .unauthorized:
          resolve(httpError(status: 401))
        case .internalServerError:
          resolve(httpError(status: 500))
        case .undocumented(let code, _):
          resolve(httpError(status: code))
        }
      } catch {
        resolve(envelope(from: error))
      }
    }
  }

  func updateCollection(
    libraryId: Double,
    collectionId: String,
    name: String,
    resolve: @escaping RCTPromiseResolveBlock
  ) {
    guard let api else { resolve(invalidState("BunnyStreamApi is not initialised.")); return }
    guard !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { resolve(invalidState("updateCollection: 'name' must not be blank")); return }
    Task {
      do {
        let output = try await api.client.updateCollection(.init(
          path: .init(libraryId: Int64(libraryId), collectionId: collectionId),
          body: .json(.UpdateCollectionModel(.init(name: name)))
        ))
        switch output {
        case .ok(let response):
          guard case .json(let status) = response.body else {
            resolve(decodeError())
            return
          }
          if status.success == false {
            resolve(errEnvelope(kind: "InvalidState", httpStatus: status.statusCode.map(Int.init) ?? 0,
                                message: status.message ?? "Unable to update collection",
                                isTerminal: true))
          } else {
            resolve(okEnvelope(NSNull()))
          }
        case .unauthorized:
          resolve(httpError(status: 401))
        case .notFound:
          resolve(httpError(status: 404))
        case .internalServerError:
          resolve(httpError(status: 500))
        case .undocumented(let code, _):
          resolve(httpError(status: code))
        }
      } catch {
        resolve(envelope(from: error))
      }
    }
  }

  func deleteCollection(libraryId: Double, collectionId: String, resolve: @escaping RCTPromiseResolveBlock) {
    guard let api else { resolve(invalidState("BunnyStreamApi is not initialised.")); return }
    Task {
      do {
        let output = try await api.client.deleteCollection(.init(
          path: .init(libraryId: Int64(libraryId), collectionId: collectionId)
        ))
        switch output {
        case .ok(let response):
          guard case .json(let status) = response.body else {
            resolve(decodeError())
            return
          }
          if status.success == false {
            resolve(errEnvelope(kind: "InvalidState", httpStatus: status.statusCode.map(Int.init) ?? 0,
                                message: status.message ?? "Unable to delete collection",
                                isTerminal: true))
          } else {
            resolve(okEnvelope(NSNull()))
          }
        case .unauthorized:
          resolve(httpError(status: 401))
        case .notFound:
          resolve(httpError(status: 404))
        case .internalServerError:
          resolve(httpError(status: 500))
        case .undocumented(let code, _):
          resolve(httpError(status: code))
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

  func startLiveStream(libraryId: Double, streamId: String, resolve: @escaping RCTPromiseResolveBlock) {
    guard let api else { resolve(invalidState("BunnyStreamApi is not initialised.")); return }
    let repo = api.liveStreams
    Task {
      do {
        try await repo.startLiveStream(libraryId: Int(libraryId), streamId: streamId)
        // iOS SDK's startLiveStream is async throws (no return value), so we
        // return null — the caller should re-fetch the stream to get the updated
        // status. Android's variant returns the updated LiveStream.
        resolve(okEnvelope(NSNull()))
      } catch {
        resolve(envelope(from: error))
      }
    }
  }

  func stopLiveStream(libraryId: Double, streamId: String, resolve: @escaping RCTPromiseResolveBlock) {
    guard let api else { resolve(invalidState("BunnyStreamApi is not initialised.")); return }
    let repo = api.liveStreams
    Task {
      do {
        try await repo.stopLiveStream(libraryId: Int(libraryId), streamId: streamId)
        resolve(okEnvelope(NSNull()))
      } catch {
        resolve(envelope(from: error))
      }
    }
  }

  func getLiveStreamStatus(libraryId: Double, streamId: String, resolve: @escaping RCTPromiseResolveBlock) {
    guard let api else { resolve(invalidState("BunnyStreamApi is not initialised.")); return }
    let repo = api.liveStreams
    Task {
      do {
        let status = try await repo.ingestStatus(libraryId: Int(libraryId), streamId: streamId)
        resolve(okEnvelope(Self.liveStreamIngestStatusDict(from: status)))
      } catch {
        resolve(envelope(from: error))
      }
    }
  }

  func setLiveStreamThumbnail(
    libraryId: Double,
    streamId: String,
    thumbnailUrl: String,
    resolve: @escaping RCTPromiseResolveBlock
  ) {
    guard let api else { resolve(invalidState("BunnyStreamApi is not initialised.")); return }
    let repo = api.liveStreams
    Task {
      do {
        try await repo.setThumbnail(libraryId: Int(libraryId), streamId: streamId,
                                    thumbnailUrl: thumbnailUrl)
        resolve(okEnvelope(NSNull()))
      } catch {
        resolve(envelope(from: error))
      }
    }
  }

  func uploadLiveStreamThumbnail(
    libraryId: Double,
    streamId: String,
    uri: String,
    contentType: String,
    resolve: @escaping RCTPromiseResolveBlock
  ) {
    guard let api else { resolve(invalidState("BunnyStreamApi is not initialised.")); return }
    guard let format = Self.imageFormat(for: contentType) else {
      resolve(invalidState("uploadLiveStreamThumbnail: unsupported content type"))
      return
    }
    guard let fileURL = Self.localFileURL(from: uri) else {
      resolve(invalidState("uploadLiveStreamThumbnail: 'uri' must be a local file URI"))
      return
    }
    let repo = api.liveStreams
    Task {
      let accessingSecurityScopedResource = fileURL.startAccessingSecurityScopedResource()
      defer {
        if accessingSecurityScopedResource {
          fileURL.stopAccessingSecurityScopedResource()
        }
      }
      let imageData: Data
      do {
        let handle = try FileHandle(forReadingFrom: fileURL)
        defer { try? handle.close() }
        imageData = try handle.read(upToCount: Self.maxThumbnailBytes + 1) ?? Data()
      } catch {
        resolve(errEnvelope(kind: "LocalFile", httpStatus: 0,
                            message: "uploadLiveStreamThumbnail: unable to read the local image",
                            isTerminal: true))
        return
      }
      guard !imageData.isEmpty else {
        resolve(errEnvelope(kind: "LocalFile", httpStatus: 0,
                            message: "uploadLiveStreamThumbnail: local image is empty",
                            isTerminal: true))
        return
      }
      guard imageData.count <= Self.maxThumbnailBytes else {
        resolve(errEnvelope(kind: "LocalFile", httpStatus: 0,
                            message: "uploadLiveStreamThumbnail: local image exceeds the 20 MB limit",
                            isTerminal: true))
        return
      }
      do {
        try await repo.uploadThumbnail(libraryId: Int(libraryId), streamId: streamId,
                                       imageData: imageData, format: format)
        resolve(okEnvelope(NSNull()))
      } catch {
        resolve(envelope(from: error))
      }
    }
  }

  func listLiveStreamThumbnails(
    libraryId: Double,
    streamId: String,
    limit: Double?,
    from: String?,
    to: String?,
    resolve: @escaping RCTPromiseResolveBlock
  ) {
    guard let api else { resolve(invalidState("BunnyStreamApi is not initialised.")); return }
    let parsedFrom = from.flatMap(Self.parseDate)
    let parsedTo = to.flatMap(Self.parseDate)
    if from != nil && parsedFrom == nil {
      resolve(invalidState("listLiveStreamThumbnails: 'from' must be a valid ISO 8601 date"))
      return
    }
    if to != nil && parsedTo == nil {
      resolve(invalidState("listLiveStreamThumbnails: 'to' must be a valid ISO 8601 date"))
      return
    }
    let repo = api.liveStreams
    Task {
      do {
        let thumbnails = try await repo.listThumbnails(
          libraryId: Int(libraryId), streamId: streamId, limit: limit.map(Int.init),
          from: parsedFrom, to: parsedTo
        )
        resolve(okEnvelope(thumbnails.map(Self.liveStreamThumbnailDict(from:))))
      } catch {
        resolve(envelope(from: error))
      }
    }
  }

  func deleteLiveStreamThumbnail(
    libraryId: Double,
    streamId: String,
    restoreLibraryDefault: Bool,
    resolve: @escaping RCTPromiseResolveBlock
  ) {
    guard let api else { resolve(invalidState("BunnyStreamApi is not initialised.")); return }
    let repo = api.liveStreams
    Task {
      do {
        try await repo.deleteThumbnail(libraryId: Int(libraryId), streamId: streamId,
                                       restoreLibraryDefault: restoreLibraryDefault)
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
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = formatter.date(from: iso) { return date }
    formatter.formatOptions = [.withInternetDateTime]
    if let date = formatter.date(from: iso) { return date }
    formatter.formatOptions = [.withFullDate]
    return formatter.date(from: iso)
  }

  private static func imageFormat(for contentType: String) -> BunnyImageFormat? {
    switch contentType.lowercased() {
    case "image/jpeg": return .jpeg
    case "image/png": return .png
    case "image/webp": return .webp
    case "image/gif": return .gif
    default: return nil
    }
  }

  private static let maxThumbnailBytes = 20 * 1024 * 1024

  private static func localFileURL(from uri: String) -> URL? {
    guard let url = URL(string: uri), url.isFileURL else { return nil }
    return url
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

  static func collectionDict(from model: Components.Schemas.CollectionModel) -> [String: Any] {
    [
      "id": model.guid ?? "",
      "videoLibraryId": model.videoLibraryId ?? 0,
      "name": model.name ?? "",
      "videoCount": model.videoCount ?? 0,
      "totalSizeBytes": model.totalSize ?? 0,
      "previewVideoIds": (model.previewVideoIds ?? "")
        .split(separator: ",")
        .map { $0.trimmingCharacters(in: .whitespaces) }
        .filter { !$0.isEmpty },
      "previewImageUrls": model.previewImageUrls ?? [],
    ]
  }

  static func collectionListDict(from model: Components.Schemas.PaginationListOfCollectionModel) -> [String: Any] {
    [
      "totalItems": model.totalItems ?? 0,
      "currentPage": model.currentPage ?? 0,
      "itemsPerPage": model.itemsPerPage ?? 0,
      "items": (model.items ?? []).map(collectionDict(from:)),
    ]
  }

  static func videoStatisticsDict(from model: Components.Schemas.VideoStatisticsModel) -> [String: Any] {
    [
      "viewsChart": model.viewsChart?.additionalProperties ?? [:],
      "watchTimeChart": model.watchTimeChart?.additionalProperties ?? [:],
      "countryViewCounts": model.countryViewCounts?.additionalProperties ?? [:],
      "countryWatchTime": model.countryWatchTime?.additionalProperties ?? [:],
      "engagementScore": model.engagementScore ?? 0,
    ]
  }

  static func videoResolutionsDict(from model: Components.Schemas.VideoResolutionsInfoModel) -> [String: Any] {
    [
      "videoId": model.videoId ?? "",
      "videoLibraryId": model.videoLibraryId ?? 0,
      "availableResolutions": model.availableResolutions ?? [],
      "configuredResolutions": model.configuredResolutions ?? [],
      "playlistResolutions": (model.playlistResolutions ?? []).map(resolutionReferenceDict(from:)),
      "storageResolutions": (model.storageResolutions ?? []).map(resolutionReferenceDict(from:)),
      "mp4Resolutions": (model.mp4Resolutions ?? []).map(resolutionReferenceDict(from:)),
      "storageObjects": (model.storageObjects ?? []).map(storageObjectDict(from:)),
      "oldResolutions": (model.oldResolutions ?? []).map(storageObjectDict(from:)),
      "hasBothOldAndNewResolutionFormat": model.hasBothOldAndNewResolutionFormat ?? false,
      "hasOriginal": model.hasOriginal ?? false,
    ]
  }

  private static func resolutionReferenceDict(from model: Components.Schemas.ResolutionReference) -> [String: Any] {
    [
      "resolution": model.resolution ?? NSNull(),
      "path": model.path ?? NSNull(),
    ]
  }

  private static func storageObjectDict(from model: Components.Schemas.StorageObjectModel) -> [String: Any] {
    [
      "id": model.guid ?? NSNull(),
      "storageZoneName": model.storageZoneName ?? NSNull(),
      "storageZoneId": model.storageZoneId ?? NSNull(),
      "path": model.path ?? NSNull(),
      "objectName": model.objectName ?? NSNull(),
      "lengthBytes": model.length ?? 0,
      "dateCreated": model.dateCreated?.ISO8601Format() ?? NSNull(),
      "lastChanged": model.lastChanged?.ISO8601Format() ?? NSNull(),
      "isDirectory": model.isDirectory ?? false,
      "contentType": model.contentType ?? NSNull(),
      "serverId": model.serverId ?? NSNull(),
      "userId": model.userId ?? NSNull(),
      "checksum": model.checksum ?? NSNull(),
      "replicatedZones": model.replicatedZones ?? NSNull(),
    ]
  }

  static func liveStreamIngestStatusDict(from status: BunnyLiveStreamIngestStatus) -> [String: Any] {
    [
      "readyToStart": status.readyToStart,
      "primaryLive": status.primaryLive ?? NSNull(),
      "backupLive": status.backupLive ?? NSNull(),
      "isLive": status.isLive,
      "lastPingAgoMs": status.lastPingAgo ?? NSNull(),
      "durationSeconds": status.duration ?? NSNull(),
      "statusTime": status.statusTime?.ISO8601Format() ?? NSNull(),
    ]
  }

  static func liveStreamThumbnailDict(from thumbnail: BunnyLiveStreamThumbnail) -> [String: Any] {
    [
      "url": thumbnail.url ?? NSNull(),
      "timestamp": thumbnail.timestamp?.ISO8601Format() ?? NSNull(),
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
