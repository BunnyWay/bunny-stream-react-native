#import "BunnyStreamPlayerModule.h"

#import <React/RCTBridgeModule.h>
#import "BunnyStreamReactNative-Swift.h"

@implementation BunnyStreamPlayerModule

RCT_EXPORT_MODULE("BunnyStreamPlayer")

- (void)initialize:(NSString *)accessKey libraryId:(double)libraryId
{
  if (accessKey.length == 0) {
    @throw [NSException exceptionWithName:@"InvalidArgumentException"
                                   reason:@"accessKey must be a non-empty string"
                                 userInfo:nil];
  }
  if (!isfinite(libraryId) || libraryId <= 0 || libraryId != floor(libraryId)) {
    @throw [NSException exceptionWithName:@"InvalidArgumentException"
                                   reason:@"libraryId must be a positive integer"
                                 userInfo:nil];
  }

  // Store the configuration in the bridge-owned configuration store.
  // Fabric views read it when creating a BunnyStreamPlayer / BunnyStreamLivePlayer.
  // This mirrors Android's BunnyStreamApi.initialize(context, accessKey, libraryId)
  // without requiring a global SDK init.
  dispatch_async(dispatch_get_main_queue(), ^{
    [[BunnyStreamConfiguration shared] configureWithAccessKey:accessKey
                                                    libraryId:(int)libraryId];
  });
}

// iOS does not support tvOS; always NO.
- (NSNumber *)isRunningOnTV
{
  return @NO;
}

// The iOS SDK hardcodes this speed list internally.
- (void)getPlaybackSpeeds:(RCTPromiseResolveBlock)resolve
                   reject:(RCTPromiseRejectBlock)reject
{
  resolve(@[ @0.5, @0.75, @1.0, @1.25, @1.5, @1.75, @2.0 ]);
}

// MARK: - Resume position management (stubs)
// The iOS SDK exposes no resume-position API; JS-side AsyncStorage fallback
// owns persistence and never calls these. Stubs keep the Codegen contract
// satisfied.

- (void)getAllSavedPositions:(RCTPromiseResolveBlock)resolve
                      reject:(RCTPromiseRejectBlock)reject
{
  resolve(@"[]");
}

- (void)clearSavedPosition:(NSString *)videoId
                   resolve:(RCTPromiseResolveBlock)resolve
                    reject:(RCTPromiseRejectBlock)reject
{
  resolve(nil);
}

- (void)clearAllSavedPositions:(RCTPromiseResolveBlock)resolve
                        reject:(RCTPromiseRejectBlock)reject
{
  resolve(nil);
}

- (void)exportPositions:(RCTPromiseResolveBlock)resolve
                 reject:(RCTPromiseRejectBlock)reject
{
  resolve(@"[]");
}

- (void)importPositions:(NSString *)jsonData
                resolve:(RCTPromiseResolveBlock)resolve
                 reject:(RCTPromiseRejectBlock)reject
{
  resolve(@NO);
}

- (void)cleanupExpiredPositions:(RCTPromiseResolveBlock)resolve
                         reject:(RCTPromiseRejectBlock)reject
{
  resolve(nil);
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeBunnyStreamPlayerSpecJSI>(params);
}

@end
