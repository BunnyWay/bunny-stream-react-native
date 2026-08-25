import Foundation

/// Thread-safe in-memory configuration store for the React Native bridge.
///
/// The iOS SDK does not have a global `initialize()` like Android's
/// `BunnyStreamApi.initialize(context, accessKey, libraryId)`. Instead each
/// `BunnyStreamPlayer` / `BunnyStreamLivePlayer` takes `accessKey` and
/// `libraryId` directly in its constructor.
///
/// This store lets the TurboModule's `initialize(accessKey, libraryId)` persist
/// the configuration so that Fabric views can read it at creation time,
/// mirroring the Android bridge's flow without requiring a global SDK init.
@MainActor
@objc public final class BunnyStreamConfiguration: NSObject {
  @objc public static let shared = BunnyStreamConfiguration()

  public struct Config: Equatable {
    public let accessKey: String
    public let libraryId: Int
  }

  private var config: Config?

  private override init() { super.init() }

  /// Stores the configuration. Called from the TurboModule's `initialize`.
  @objc public func configure(accessKey: String, libraryId: Int) {
    config = Config(accessKey: accessKey, libraryId: libraryId)
  }

  /// Returns the stored access key, or `nil` if `initialize` was never called.
  @objc public var accessKey: String? { config?.accessKey }

  /// Returns the stored library ID, or 0 if `initialize` was never called.
  @objc public var libraryId: Int { config?.libraryId ?? 0 }

  /// Whether `initialize` has been called with a valid configuration.
  @objc public var isConfigured: Bool { config != nil }
}
