#import <BunnyStreamReactNativeSpec/BunnyStreamReactNativeSpec.h>

// TurboModule implementing the Codegen-generated `NativeBunnyStreamPlayerSpec`.
//
// Exposes `initialize(accessKey, libraryId)` to JS. On iOS the SDK does not
// have a global `initialize` — instead the configuration is stored in
// `BunnyStreamConfiguration` (a bridge-owned, thread-safe, in-memory store)
// and read by Fabric views when they create a `BunnyStreamPlayer` or
// `BunnyStreamLivePlayer` (Plan-iOS.md §13.1).
@interface BunnyStreamPlayerModule : NSObject <NativeBunnyStreamPlayerSpec>

@end
