#import <React/RCTViewComponentView.h>

// Fabric component view for the Bunny Stream VOD player.
//
// Hosts the SDK's SwiftUI `BunnyStreamPlayer` via `UIHostingController`
// inside a Fabric component view. The actual hosting logic is in
// `BunnyStreamPlayerViewImpl` (Swift); this ObjC++ class is the Fabric
// integration point that conforms to the Codegen-generated
// `RCTBunnyStreamPlayerViewViewProtocol`.
//
// Because the SDK exposes neither a public controller nor public playback
// callbacks (see Plan-iOS.md §12.1), both commands and events are bridged
// through the SDK's internal `AVPlayer`, discovered via the `AVPlayerLayer`
// in the hosted view hierarchy.
//
// Remaining limitation: `controls={false}` has no effect, since the SDK does
// not expose a public `controlsEnabled` flag.
@interface BunnyStreamPlayerView : RCTViewComponentView

@end
