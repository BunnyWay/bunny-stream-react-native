#import <React/RCTViewComponentView.h>

// Fabric component view for the Bunny Stream VOD player.
//
// Hosts the SDK's SwiftUI `BunnyStreamPlayer` via `UIHostingController`
// inside a Fabric component view. The actual hosting logic is in
// `BunnyStreamPlayerViewImpl` (Swift); this ObjC++ class is the Fabric
// integration point that conforms to the Codegen-generated
// `RCTBunnyStreamPlayerViewViewProtocol`.
//
// Limitations (see Plan-iOS.md §12.1):
// - Commands (play/pause/seek/setVolume/setPlaybackRate/mute/unmute) are
//   no-ops because the SDK does not expose a public controller.
// - Events (onReady/onProgress/etc.) are not emitted because the SDK does
//   not expose public playback callbacks.
@interface BunnyStreamPlayerView : RCTViewComponentView

@end
