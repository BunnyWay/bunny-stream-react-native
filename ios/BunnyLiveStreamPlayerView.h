#import <React/RCTViewComponentView.h>

// Fabric component view for the Bunny Stream live player.
//
// Hosts the SDK's SwiftUI `BunnyStreamLivePlayer` via `UIHostingController`.
// The actual hosting logic is in `BunnyLiveStreamPlayerViewImpl` (Swift);
// this ObjC++ class is the Fabric integration point that conforms to the
// Codegen-generated `RCTBunnyLiveStreamPlayerViewViewProtocol`.
//
// Events:
// - `onLiveStateChange`: forwarded from the SDK's `onStateChange` callback.
// - `onLiveError`: forwarded only for terminal/permanent errors from
//   `onPlaybackError` (see Plan-iOS.md §12.2).
// - `onVideoSizeChange`: NOT emitted — the SDK does not expose this callback
//   for live (Plan-iOS.md §12.2).
@interface BunnyLiveStreamPlayerView : RCTViewComponentView

@end
