import Foundation

// Compiled under the SDK's module name to exercise the qualified-type guard.
// These cases mirror the internal enum in the pinned iOS SDK.
enum VideoPlayerError: Error {
  case notAvailable, noInternetConnection, unauthorized, unknownError
}

enum OtherError: Error {
  case notAvailable
}

@main
enum PlaybackErrorClassifierTests {
  static func main() {
    let cases: [(Error, String)] = [
      (VideoPlayerError.notAvailable, "unavailable"),
      (VideoPlayerError.noInternetConnection, "network"),
      (VideoPlayerError.unauthorized, "unknown"),
      (VideoPlayerError.unknownError, "unknown"),
      (OtherError.notAvailable, "unknown"),
      (NSError(domain: NSURLErrorDomain, code: NSURLErrorNotConnectedToInternet), "unknown"),
      (NSError(domain: "HTTP", code: 403), "unknown"),
    ]
    for (error, expected) in cases {
      precondition(PlaybackErrorClassifier.category(for: error) == expected, "\(error)")
    }
    print("iOS playback error classification: \(cases.count) cases passed")
  }
}
