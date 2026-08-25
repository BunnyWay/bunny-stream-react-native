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
public final class BunnyStreamConfiguration {
  public static let shared = BunnyStreamConfiguration()

  public struct Config: Equatable {
    public let accessKey: String
    public let libraryId: Int
  }

  private var config: Config?

  private init() {}

  /// Stores the configuration. Called from the TurboModule's `initialize`.
  public func configure(accessKey: String, libraryId: Int) {
    config = Config(accessKey: accessKey, libraryId: libraryId)
  }

  /// Returns the stored configuration, or `nil` if `initialize` was never called.
  public func current() -> Config? { config }

  /// Whether `initialize` has been called with a valid configuration.
  public var isConfigured: Bool { config != nil }
}
