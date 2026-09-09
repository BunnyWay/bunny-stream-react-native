#import <BunnyStreamReactNativeSpec/BunnyStreamReactNativeSpec.h>
#import <React/RCTBridgeModule.h>

// TurboModule implementing the Codegen-generated `NativeBunnyStreamUploadSpec`.
//
// Bridges the Bunny Stream video uploader to JS. Uploads are identified by
// an `uploadId` string returned from `startUpload` / `continueUpload`.
// Progress and lifecycle events are emitted through `RCTDeviceEventEmitter`
// under the `bunnyStreamUploadEvent` name.
//
// Control methods (`pauseUpload`, `resumeUpload`, `cancelUpload`) resolve
// their Promise with a `BunnyResult`-shaped envelope — never reject — so the
// typed error taxonomy stays available to the JS caller.
//
// The actual SDK calls and tracker-delegate-to-event mapping live in
// `BunnyStreamUploadModuleImpl.swift`; this ObjC++ wrapper only registers
// the TurboModule and forwards calls to Swift.
@interface BunnyStreamUploadModule : NSObject <NativeBunnyStreamUploadSpec>

@end
