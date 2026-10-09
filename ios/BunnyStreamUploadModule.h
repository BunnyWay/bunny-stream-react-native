#import <BunnyStreamReactNativeSpec/BunnyStreamReactNativeSpec.h>
#import <React/RCTEventEmitter.h>

// TurboModule implementing the Codegen-generated `NativeBunnyStreamUploadSpec`.
//
// Bridges the Bunny Stream video uploader to JS. Uploads are identified by
// an `uploadId` string returned from `startUpload` / `continueUpload`.
// Progress and lifecycle events are emitted through `RCTDeviceEventEmitter`
// under the `bunnyStreamUploadEvent` name.
//
// This subclasses `RCTEventEmitter` because `sendEventWithName` routes
// through `RCTCallableJSModules`, which is injected by the TurboModule
// infrastructure and works in bridgeless mode — the previous
// `RCTBridge.current()` approach silently dropped every event there.
//
// Control methods (`pauseUpload`, `resumeUpload`, `cancelUpload`) resolve
// their Promise with a `BunnyResult`-shaped envelope — never reject — so the
// typed error taxonomy stays available to the JS caller.
//
// The actual SDK calls and tracker-delegate-to-event mapping live in
// `BunnyStreamUploadModuleImpl.swift`; this ObjC++ wrapper only registers
// the TurboModule and forwards calls to Swift.
@interface BunnyStreamUploadModule : RCTEventEmitter <NativeBunnyStreamUploadSpec>

@end
