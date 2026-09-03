#import <BunnyStreamReactNativeSpec/BunnyStreamReactNativeSpec.h>
#import <React/RCTBridgeModule.h>

// TurboModule implementing the Codegen-generated `NativeBunnyStreamApiSpec`.
//
// Bridges the Bunny Stream REST API to JS. Every method resolves its Promise
// with a `BunnyResult`-shaped envelope (`{ ok: true, value }` /
// `{ ok: false, error }`) — never rejects — so the typed error taxonomy stays
// available to the JS caller. See `src/api/BunnyStreamApi.ts`.
//
// The actual SDK calls and domain-to-NSDictionary mapping live in
// `BunnyStreamApiModuleImpl.swift`; this ObjC++ wrapper only registers the
// TurboModule and forwards calls to Swift.
@interface BunnyStreamApiModule : NSObject <NativeBunnyStreamApiSpec>

@end
