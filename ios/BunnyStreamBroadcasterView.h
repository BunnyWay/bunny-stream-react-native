#import <React/RCTViewComponentView.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * Fabric component view for the BunnyStreamBroadcaster.
 *
 * Hosts the SDK's SwiftUI `BunnyStreamCameraUploadView` inside a
 * `UIHostingController` and forwards broadcast events to JS via the
 * Fabric event emitter.
 */
@interface BunnyStreamBroadcasterView : RCTViewComponentView

@end

NS_ASSUME_NONNULL_END
