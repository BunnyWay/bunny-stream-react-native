import Foundation

enum PlaybackErrorClassifier {
  static func category(for error: Error) -> String {
    // VideoPlayerError is internal to the SDK. Match its qualified type and
    // enum case, never localized copy or an unrelated error's case name.
    guard String(reflecting: type(of: error)) == "BunnyStreamPlayer.VideoPlayerError" else {
      return "unknown"
    }
    switch String(describing: error) {
    case "notAvailable": return "unavailable"
    case "noInternetConnection": return "network"
    default: return "unknown"
    }
  }
}
